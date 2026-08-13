import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  getAllRepositories,
  getRepositoryById,
  createRepository,
  updateRepository,
  deleteRepository,
  refreshRepositoryStatus
} from '../services/repository.service.js';
import { cloneRepository, fetchRepository, checkRepoStatus, getBranches, getCommitLogs } from '../services/git.service.js';
import { executeDeployment } from '../services/deployment.service.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  try {
    const repos = getAllRepositories();
    return res.json(repos);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const repo = await createRepository({
      ...req.body,
      userId: req.user?.id,
      username: req.user?.username,
      ipAddress: req.ip
    });
    return res.status(201).json(repo);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const repo = getRepositoryById(id);
  if (!repo) {
    return res.status(404).json({ error: `Repository ID ${id} not found.` });
  }
  return res.json(repo);
});

router.put('/:id', async (req: AuthenticatedRequest, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const updated = await updateRepository(id, {
      ...req.body,
      userId: req.user?.id,
      username: req.user?.username,
      ipAddress: req.ip
    });
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', (req: AuthenticatedRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const deleteFilesystem = req.body?.deleteFilesystem === true || req.query.deleteFilesystem === 'true';

  try {
    deleteRepository({
      id,
      deleteFilesystem,
      userId: req.user?.id,
      username: req.user?.username,
      ipAddress: req.ip
    });
    return res.json({ message: 'Repository deleted successfully.' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/:id/clone', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const repo = getRepositoryById(id);
  if (!repo) {
    return res.status(404).json({ error: `Repository ID ${id} not found.` });
  }

  try {
    const result = await cloneRepository(repo.git_url, repo.branch, repo.local_path);
    await refreshRepositoryStatus(id);
    return res.json({ message: 'Clone output', stdout: result.stdout });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/:id/fetch', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const repo = getRepositoryById(id);
  if (!repo) {
    return res.status(404).json({ error: `Repository ID ${id} not found.` });
  }

  try {
    const result = await fetchRepository(repo.local_path);
    await refreshRepositoryStatus(id);
    return res.json({ message: 'Fetch successful', stdout: result.stdout });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/:id/pull', async (req: AuthenticatedRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const force = req.body?.force === true || req.query.force === 'true';

  const repo = getRepositoryById(id);
  if (!repo) {
    return res.status(404).json({ error: `Repository ID ${id} not found.` });
  }

  const trigger = repo.deployment_trigger || 'BOTH';
  if (trigger === 'WEBHOOK') {
    return res.status(403).json({
      error: 'Manual deployment is disabled for this repository (Deployment Trigger is set to WEBHOOK only).'
    });
  }

  try {
    const deployment = await executeDeployment({
      repositoryId: id,
      triggerType: 'MANUAL',
      force,
      userId: req.user?.id,
      username: req.user?.username,
      ipAddress: req.ip
    });
    return res.json({ message: 'Deployment triggered', deployment });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/:id/status', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const repo = getRepositoryById(id);
  if (!repo) {
    return res.status(404).json({ error: `Repository ID ${id} not found.` });
  }

  try {
    const statusDetails = await checkRepoStatus(repo.local_path, repo.branch);
    await refreshRepositoryStatus(id);
    return res.json(statusDetails);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:id/branches', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const repo = getRepositoryById(id);
  if (!repo) {
    return res.status(404).json({ error: `Repository ID ${id} not found.` });
  }

  try {
    const branches = await getBranches(repo.local_path);
    return res.json(branches);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:id/log', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const limit = Math.min(Math.max(parseInt(req.query.limit as string || '20', 10), 1), 100);

  const repo = getRepositoryById(id);
  if (!repo) {
    return res.status(404).json({ error: `Repository ID ${id} not found.` });
  }

  try {
    const logs = await getCommitLogs(repo.local_path, limit);
    return res.json(logs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
