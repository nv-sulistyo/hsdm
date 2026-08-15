import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  getDockerStatus,
  listContainers,
  getContainerLogs,
  startContainer,
  stopContainer,
  restartContainer,
  removeContainer,
  listImages,
  pullImage,
  removeImage,
  composePs,
  composeUp,
  composeBuild,
  composeDown,
  getComposeContent,
  saveComposeContent,
  getComposeServiceNames,
  addComposeService,
  getComposeOverrideContent,
  writeComposeOverride
} from '../services/docker.service.js';
import { getSettings } from '../services/settings.service.js';
import { logAudit } from '../services/audit.service.js';
import { db } from '../db.js';

const router = Router();

router.use(requireAuth);

function getRepo(repositoryId: number) {
  const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(repositoryId) as any;
  if (!repo) {
    const err: any = new Error(`Repository with ID ${repositoryId} not found.`);
    err.status = 404;
    throw err;
  }
  return repo;
}

function getComposeFile(req: any): string {
  const file = (req.query.file as string) || 'docker-compose.yml';
  if (!/^[A-Za-z0-9._-]+\.ya?ml$/.test(file)) {
    throw new Error('Invalid compose file name.');
  }
  return file;
}

router.get('/status', async (_req, res) => {
  try {
    return res.json(await getDockerStatus());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/containers', async (req, res) => {
  try {
    const all = req.query.all !== 'false';
    return res.json(await listContainers(all));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/containers/:id/logs', async (req, res) => {
  try {
    const tail = Math.min(Math.max(parseInt(req.query.tail as string, 10) || 200, 1), 5000);
    const log = await getContainerLogs(req.params.id, tail);
    return res.json({ id: req.params.id, log });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/containers/:id/start', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await startContainer(req.params.id);
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'DOCKER_CONTAINER_START',
      ipAddress: req.ip,
      details: `Container: ${req.params.id}`
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/containers/:id/stop', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await stopContainer(req.params.id);
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'DOCKER_CONTAINER_STOP',
      ipAddress: req.ip,
      details: `Container: ${req.params.id}`
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/containers/:id/restart', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await restartContainer(req.params.id);
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'DOCKER_CONTAINER_RESTART',
      ipAddress: req.ip,
      details: `Container: ${req.params.id}`
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/containers/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const force = req.query.force === 'true';
    const result = await removeContainer(req.params.id, force);
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'DOCKER_CONTAINER_REMOVE',
      ipAddress: req.ip,
      details: `Container: ${req.params.id}${force ? ' (force)' : ''}`
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/images', async (_req, res) => {
  try {
    return res.json(await listImages());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/images/pull', async (req: AuthenticatedRequest, res) => {
  try {
    const { image } = req.body || {};
    const result = await pullImage(image);
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'DOCKER_IMAGE_PULL',
      ipAddress: req.ip,
      details: `Image: ${image}`
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/images/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const force = req.query.force === 'true';
    const result = await removeImage(req.params.id, force);
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'DOCKER_IMAGE_REMOVE',
      ipAddress: req.ip,
      details: `Image: ${req.params.id}${force ? ' (force)' : ''}`
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------- Compose (per repository) ----------

router.get('/compose/:repositoryId/ps', async (req, res) => {
  try {
    const repo = getRepo(Number(req.params.repositoryId));
    const file = getComposeFile(req);
    return res.json(await composePs(repo.local_path, file));
  } catch (err: any) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/compose/:repositoryId/up', async (req: AuthenticatedRequest, res) => {
  try {
    const repo = getRepo(Number(req.params.repositoryId));
    const file = getComposeFile(req);
    const build = req.query.build !== 'false';
    const services = Array.isArray(req.body?.services) ? req.body.services.map(String) : [];
    const result = await composeUp(repo.local_path, file, build, services);
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'COMPOSE_UP',
      repositoryId: repo.id,
      ipAddress: req.ip,
      details: `File: ${file}, Build: ${build}${services.length ? `, Services: ${services.join(', ')}` : ''}`
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/compose/:repositoryId/build', async (req: AuthenticatedRequest, res) => {
  try {
    const repo = getRepo(Number(req.params.repositoryId));
    const file = getComposeFile(req);
    const services = Array.isArray(req.body?.services) ? req.body.services.map(String) : [];
    const result = await composeBuild(repo.local_path, file, services);
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'COMPOSE_BUILD',
      repositoryId: repo.id,
      ipAddress: req.ip,
      details: `File: ${file}${services.length ? `, Services: ${services.join(', ')}` : ''}`
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/compose/:repositoryId/down', async (req: AuthenticatedRequest, res) => {
  try {
    const repo = getRepo(Number(req.params.repositoryId));
    const file = getComposeFile(req);
    const result = await composeDown(repo.local_path, file);
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'COMPOSE_DOWN',
      repositoryId: repo.id,
      ipAddress: req.ip,
      details: `File: ${file}`
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/compose/:repositoryId/file', async (req, res) => {
  try {
    const repo = getRepo(Number(req.params.repositoryId));
    const file = getComposeFile(req);
    return res.json({ file, content: getComposeContent(repo.local_path, file) });
  } catch (err: any) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

router.put('/compose/:repositoryId/file', async (req: AuthenticatedRequest, res) => {
  try {
    const repo = getRepo(Number(req.params.repositoryId));
    const file = getComposeFile(req);
    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    const result = await saveComposeContent(repo.local_path, file, content);
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'COMPOSE_SAVE',
      repositoryId: repo.id,
      ipAddress: req.ip,
      details: `File: ${file}`
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/compose/:repositoryId/services', async (req, res) => {
  try {
    const repo = getRepo(Number(req.params.repositoryId));
    const file = getComposeFile(req);
    return res.json(getComposeServiceNames(repo.local_path, file));
  } catch (err: any) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/compose/:repositoryId/services', async (req: AuthenticatedRequest, res) => {
  try {
    const repo = getRepo(Number(req.params.repositoryId));
    const file = getComposeFile(req);
    const result = await addComposeService(repo.local_path, file, req.body || {});
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'COMPOSE_ADD_SERVICE',
      repositoryId: repo.id,
      ipAddress: req.ip,
      details: `File: ${file}, Service: ${req.body?.name}`
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/compose/:repositoryId/override', async (req, res) => {
  try {
    const repo = getRepo(Number(req.params.repositoryId));
    const file = getComposeFile(req);
    const proxied = (repo.compose_proxy_services || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    return res.json({ file, content: getComposeOverrideContent(repo.local_path, file), proxiedServices: proxied });
  } catch (err: any) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/compose/:repositoryId/override', async (req: AuthenticatedRequest, res) => {
  try {
    const repo = getRepo(Number(req.params.repositoryId));
    const file = getComposeFile(req);
    const proxiedServices = Array.isArray(req.body?.services) ? req.body.services.map(String) : [];
    const settings = getSettings();
    const result = await writeComposeOverride(repo.local_path, file, proxiedServices, settings.proxy_network || 'proxy');
    db.prepare('UPDATE repositories SET compose_proxy_services = ?, updated_at = ? WHERE id = ?')
      .run(proxiedServices.filter(Boolean).join(','), new Date().toISOString(), repo.id);
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'COMPOSE_OVERRIDE',
      repositoryId: repo.id,
      ipAddress: req.ip,
      details: `File: ${file}, Proxied services: ${proxiedServices.join(', ') || 'none'}`
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;