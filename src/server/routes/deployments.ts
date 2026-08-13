import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { getDeployments, getDeploymentById } from '../services/deployment.service.js';
import { db } from '../db.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const repositoryId = req.query.repositoryId ? parseInt(req.query.repositoryId as string, 10) : undefined;
  const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 100, 1), 500);

  try {
    const list = getDeployments(limit, repositoryId);
    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const dep = getDeploymentById(id);
  if (!dep) {
    return res.status(404).json({ error: `Deployment ID ${id} not found.` });
  }
  return res.json(dep);
});

// Clear deployment history (optional ?repositoryId= filter)
router.delete('/', (req: AuthenticatedRequest, res) => {
  try {
    const repositoryId = req.query.repositoryId ? parseInt(req.query.repositoryId as string, 10) : undefined;
    let info;
    if (repositoryId) {
      info = db.prepare('DELETE FROM deployments WHERE repository_id = ?').run(repositoryId);
    } else {
      info = db.prepare('DELETE FROM deployments').run();
    }
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'CLEAR_DEPLOYMENTS',
      repositoryId,
      ipAddress: req.ip,
      details: `Deleted ${Number(info.changes)} deployment(s)`
    });
    return res.json({ message: `Deleted ${Number(info.changes)} deployment(s).`, deleted: Number(info.changes) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
