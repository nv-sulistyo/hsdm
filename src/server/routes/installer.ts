import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { getStackStatus, getInstallJob, startInstall } from '../services/installer.service.js';

const router = Router();

router.use(requireAuth);

router.get('/status', async (_req, res) => {
  try {
    return res.json(await getStackStatus());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/job', (_req, res) => {
  try {
    return res.json(getInstallJob());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/install', async (req: AuthenticatedRequest, res) => {
  try {
    const components = Array.isArray(req.body?.components) ? req.body.components.map(String) : [];
    const job = await startInstall(components, req.user?.id, req.user?.username, req.ip);
    return res.json(job);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;