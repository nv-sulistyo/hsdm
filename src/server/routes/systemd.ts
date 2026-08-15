import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  listServices,
  getServiceStatus,
  startService,
  stopService,
  restartService,
  enableService,
  disableService,
  getServiceLogs
} from '../services/systemd.service.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();

router.use(requireAuth);

router.get('/services', async (req, res) => {
  try {
    const filter = (req.query.filter as string) || '';
    return res.json(await listServices(filter));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/services/:unit/status', async (req, res) => {
  try {
    return res.json(await getServiceStatus(req.params.unit));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/services/:unit/logs', async (req, res) => {
  try {
    const tail = Math.min(Math.max(parseInt(req.query.tail as string, 10) || 200, 1), 5000);
    return res.json(await getServiceLogs(req.params.unit, tail));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

function auditAndRespond(action: string, req: AuthenticatedRequest, res: any, fn: () => Promise<any>) {
  fn()
    .then(result => {
      logAudit({
        userId: req.user?.id,
        username: req.user?.username,
        action,
        ipAddress: req.ip,
        details: `Service: ${req.params.unit}`
      });
      return res.json(result);
    })
    .catch((err: any) => res.status(500).json({ error: err.message }));
}

router.post('/services/:unit/start', (req: AuthenticatedRequest, res) =>
  auditAndRespond('SYSTEMD_START', req, res, () => startService(req.params.unit))
);
router.post('/services/:unit/stop', (req: AuthenticatedRequest, res) =>
  auditAndRespond('SYSTEMD_STOP', req, res, () => stopService(req.params.unit))
);
router.post('/services/:unit/restart', (req: AuthenticatedRequest, res) =>
  auditAndRespond('SYSTEMD_RESTART', req, res, () => restartService(req.params.unit))
);
router.post('/services/:unit/enable', (req: AuthenticatedRequest, res) =>
  auditAndRespond('SYSTEMD_ENABLE', req, res, () => enableService(req.params.unit))
);
router.post('/services/:unit/disable', (req: AuthenticatedRequest, res) =>
  auditAndRespond('SYSTEMD_DISABLE', req, res, () => disableService(req.params.unit))
);

export default router;