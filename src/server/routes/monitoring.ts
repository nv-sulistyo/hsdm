import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getSystemMetrics, getContainerStats } from '../services/monitoring.service.js';
import { detectTools } from '../services/system.service.js';

const router = Router();

router.use(requireAuth);

router.get('/system', async (_req, res) => {
  try {
    return res.json(await getSystemMetrics());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/containers', async (_req, res) => {
  try {
    return res.json(await getContainerStats());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/tools', async (_req, res) => {
  try {
    return res.json(await detectTools());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;