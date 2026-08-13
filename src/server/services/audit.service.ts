import { db } from '../db.js';

export function logAudit(options: {
  userId?: number;
  username?: string;
  action: string;
  repositoryId?: number;
  ipAddress?: string;
  details?: string;
}) {
  try {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, repository_id, ip_address, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      options.userId || null,
      options.username || 'system',
      options.action,
      options.repositoryId || null,
      options.ipAddress || null,
      options.details || null,
      now
    );
  } catch (e) {
    console.error('Failed to log audit:', e);
  }
}

export function getAuditLogs(limit = 100) {
  return db.prepare(`
    SELECT a.*, r.name as repository_name
    FROM audit_logs a
    LEFT JOIN repositories r ON a.repository_id = r.id
    ORDER BY a.id DESC
    LIMIT ?
  `).all(limit);
}
