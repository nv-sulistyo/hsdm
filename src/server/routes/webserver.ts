import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  getWebServerStatus,
  listNginxSites,
  getNginxSiteContent,
  saveNginxSite,
  enableNginxSite,
  disableNginxSite,
  testNginxConfig,
  reloadNginx,
  getCaddyfileContent,
  saveCaddyfile,
  reloadCaddy,
  generateReverseProxy
} from '../services/webserver.service.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();

router.use(requireAuth);

router.get('/status', async (_req, res) => {
  try {
    return res.json(await getWebServerStatus());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------- nginx ----------

router.get('/nginx/sites', async (_req, res) => {
  try {
    return res.json(await listNginxSites());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/nginx/sites/:name', async (req, res) => {
  try {
    return res.json({ name: req.params.name, content: getNginxSiteContent(req.params.name) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/nginx/sites/:name', async (req: AuthenticatedRequest, res) => {
  try {
    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    const result = await saveNginxSite(req.params.name, content);
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'NGINX_SAVE_SITE',
      ipAddress: req.ip,
      details: `Site: ${req.params.name}`
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/nginx/sites/:name/enable', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await enableNginxSite(req.params.name);
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'NGINX_ENABLE_SITE',
      ipAddress: req.ip,
      details: `Site: ${req.params.name}`
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/nginx/sites/:name/disable', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await disableNginxSite(req.params.name);
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'NGINX_DISABLE_SITE',
      ipAddress: req.ip,
      details: `Site: ${req.params.name}`
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/nginx/test', async (_req, res) => {
  try {
    return res.json(await testNginxConfig());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/nginx/reload', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await reloadNginx();
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'NGINX_RELOAD',
      ipAddress: req.ip,
      details: 'Reloaded nginx'
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------- caddy ----------

router.get('/caddy/caddyfile', async (_req, res) => {
  try {
    return res.json({ path: (await getWebServerStatus()).caddy.caddyfilePath, content: getCaddyfileContent() });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/caddy/caddyfile', async (req: AuthenticatedRequest, res) => {
  try {
    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    const result = await saveCaddyfile(content);
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'CADDY_SAVE_CADDYFILE',
      ipAddress: req.ip,
      details: 'Saved Caddyfile'
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/caddy/reload', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await reloadCaddy();
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'CADDY_RELOAD',
      ipAddress: req.ip,
      details: 'Reloaded caddy'
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------- reverse proxy generator ----------

router.post('/proxy', async (req: AuthenticatedRequest, res) => {
  try {
    const { engine, name, domain, targetPort, targetHost } = req.body || {};
    if (engine !== 'nginx' && engine !== 'caddy') {
      return res.status(400).json({ error: 'engine must be "nginx" or "caddy".' });
    }
    const result = await generateReverseProxy({ engine, name, domain, targetPort, targetHost });
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: engine === 'nginx' ? 'NGINX_GENERATE_PROXY' : 'CADDY_GENERATE_PROXY',
      ipAddress: req.ip,
      details: `Domain: ${domain}, Port: ${targetPort}${targetHost ? `, Host: ${targetHost}` : ''}, Name: ${result.name}`
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;