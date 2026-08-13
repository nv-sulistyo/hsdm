import crypto from 'node:crypto';
import { db } from '../db.js';
import { executeDeployment } from './deployment.service.js';
import { logAudit } from './audit.service.js';

export function verifyWebhookSignature(rawBody: string | Buffer, secret: string, headerSignature?: string): boolean {
  if (!headerSignature || !headerSignature.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = headerSignature.slice(7);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const calculatedSignature = hmac.digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(calculatedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

export async function processGithubWebhook(options: {
  repositoryId: number;
  headerSignature?: string;
  eventType?: string;
  eventId?: string;
  rawBody: string | Buffer;
  payload: any;
  ipAddress?: string;
}) {
  const { repositoryId, headerSignature, eventType = 'push', eventId, rawBody, payload, ipAddress } = options;

  const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(repositoryId) as any;
  if (!repo) {
    return {
      status: 404,
      body: { error: `Repository ID ${repositoryId} not found.` }
    };
  }

  const now = new Date().toISOString();
  const payloadHash = crypto.createHash('sha256').update(typeof rawBody === 'string' ? rawBody : rawBody.toString()).digest('hex');

  // Verify signature
  const isValid = verifyWebhookSignature(rawBody, repo.webhook_secret, headerSignature);

  if (!isValid) {
    // Log invalid attempt
    db.prepare(`
      INSERT INTO webhook_events (repository_id, event_id, event_type, signature_valid, payload_hash, received_at, status)
      VALUES (?, ?, ?, 0, ?, ?, 'INVALID_SIGNATURE')
      ON CONFLICT(repository_id, event_id) DO NOTHING
    `).run(repositoryId, eventId || null, eventType, payloadHash, now);

    logAudit({
      action: 'WEBHOOK_INVALID_SIGNATURE',
      repositoryId,
      ipAddress,
      details: `Failed signature check for event ${eventType}`
    });

    return {
      status: 401,
      body: { error: 'Invalid webhook signature.' }
    };
  }

  // Record valid event
  const insertEvt = db.prepare(`
    INSERT INTO webhook_events (repository_id, event_id, event_type, signature_valid, payload_hash, received_at, status)
    VALUES (?, ?, ?, 1, ?, ?, 'RECEIVED')
    ON CONFLICT(repository_id, event_id) DO NOTHING
  `).run(repositoryId, eventId || null, eventType, payloadHash, now);
  const eventRecordId = Number(insertEvt.lastInsertRowid);

  // Duplicate delivery (GitHub retry): already processed, do not re-deploy
  if (eventId && Number(insertEvt.changes) === 0) {
    return {
      status: 200,
      body: { message: 'Duplicate webhook delivery ignored.', deploymentTriggered: false }
    };
  }

  // Check if webhook and auto_deploy are enabled
  if (!repo.webhook_enabled || !repo.auto_deploy) {
    db.prepare('UPDATE webhook_events SET processed_at = ?, status = ? WHERE id = ?')
      .run(now, 'IGNORED_AUTO_DEPLOY_DISABLED', eventRecordId);

    return {
      status: 200,
      body: { message: 'Webhook signature verified, but Auto Deploy is disabled for this repository.', deploymentTriggered: false }
    };
  }

  // Check Deployment Trigger setting (MANUAL / WEBHOOK / BOTH)
  const trigger = repo.deployment_trigger || 'BOTH';
  if (trigger === 'MANUAL') {
    db.prepare('UPDATE webhook_events SET processed_at = ?, status = ? WHERE id = ?')
      .run(now, 'IGNORED_TRIGGER_MANUAL', eventRecordId);

    return {
      status: 200,
      body: { message: 'Webhook signature verified, but Deployment Trigger is set to MANUAL only. Ignored.', deploymentTriggered: false }
    };
  }

  // Check payload branch ref (e.g., refs/heads/main)
  const targetRef = `refs/heads/${repo.branch}`;
  const payloadRef = payload?.ref || '';

  if (eventType === 'push' && payloadRef && payloadRef !== targetRef) {
    db.prepare('UPDATE webhook_events SET processed_at = ?, status = ? WHERE id = ?')
      .run(now, `IGNORED_BRANCH_MISMATCH (${payloadRef})`, eventRecordId);

    return {
      status: 200,
      body: { message: `Webhook branch '${payloadRef}' does not match target branch '${targetRef}'. Ignored.`, deploymentTriggered: false }
    };
  }

  // Trigger deployment queue asynchronously
  try {
    await executeDeployment({
      repositoryId,
      triggerType: 'WEBHOOK',
      ipAddress
    });

    db.prepare('UPDATE webhook_events SET processed_at = ?, status = ? WHERE id = ?')
      .run(new Date().toISOString(), 'QUEUED', eventRecordId);

    return {
      status: 200,
      body: { message: 'Webhook verified and auto-deployment queued successfully.', deploymentTriggered: true }
    };
  } catch (err: any) {
    db.prepare('UPDATE webhook_events SET processed_at = ?, status = ? WHERE id = ?')
      .run(new Date().toISOString(), `ERROR: ${err.message}`, eventRecordId);

    return {
      status: 500,
      body: { error: `Failed to trigger deployment: ${err.message}` }
    };
  }
}

export function getWebhookHistory(limit = 100) {
  return db.prepare(`
    SELECT w.*, r.name as repository_name
    FROM webhook_events w
    LEFT JOIN repositories r ON w.repository_id = r.id
    ORDER BY w.id DESC
    LIMIT ?
  `).all(limit);
}
