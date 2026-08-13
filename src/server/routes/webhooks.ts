import { Router } from 'express';
import { processGithubWebhook, getWebhookHistory } from '../services/webhook.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Public Webhook receiver endpoint from GitHub
router.post('/github/:repositoryId', async (req, res) => {
  const repositoryId = parseInt(req.params.repositoryId, 10);
  const headerSignature = req.headers['x-hub-signature-256'] as string;
  const eventType = (req.headers['x-github-event'] as string) || 'push';
  const eventId = req.headers['x-github-delivery'] as string;

  // Use raw body saved by express middleware or body JSON string
  const rawBody = (req as any).rawBody || JSON.stringify(req.body || {});

  const result = await processGithubWebhook({
    repositoryId,
    headerSignature,
    eventType,
    eventId,
    rawBody,
    payload: req.body,
    ipAddress: req.ip
  });

  return res.status(result.status).json(result.body);
});

// Authenticated endpoint to view webhook logs
router.get('/history', requireAuth, (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 100, 1), 500);
  try {
    const history = getWebhookHistory(limit);
    return res.json(history);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
