import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getDeployments, getDeploymentById } from '../services/deployment.service.js';

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

export default router;
