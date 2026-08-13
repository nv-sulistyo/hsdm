import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { testGithubConnection, checkSshKeyStatus, generateSshKey } from '../services/ssh.service.js';
import { getSettings, updateSettings } from '../services/settings.service.js';
import { getAuditLogs, logAudit } from '../services/audit.service.js';
import { inspectDirectory } from '../services/git.service.js';
import { db } from '../db.js';
import { DashboardStats, AuditLog } from '../../types.js';
import fs from 'node:fs';
import path from 'node:path';

const router = Router();

router.use(requireAuth);

router.post('/inspect-directory', async (req, res) => {
  try {
    const { path: dirPath, git_url } = req.body || {};
    if (!dirPath) {
      return res.status(400).json({ error: 'Path parameter is required.' });
    }
    const result = await inspectDirectory(dirPath, git_url);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/detect-environment', async (req, res) => {
  try {
    const sshStatus = await checkSshKeyStatus();
    const settings = getSettings();
    const githubResult = await testGithubConnection();

    // Check deploy roots write permissions
    const rootPermissions = settings.allowed_deploy_roots.map(rootPath => {
      const resolved = path.resolve(rootPath);
      const exists = fs.existsSync(resolved);
      let writable = false;
      try {
        if (exists) {
          fs.accessSync(resolved, fs.constants.R_OK | fs.constants.W_OK);
          writable = true;
        }
      } catch {
        writable = false;
      }
      return {
        path: resolved,
        exists,
        writable
      };
    });

    return res.json({
      gitInstalled: sshStatus.gitInstalled,
      gitVersion: sshStatus.gitVersion,
      executionUser: sshStatus.executionUser,
      executionUserHome: sshStatus.executionUserHome,
      userExistsOnSystem: sshStatus.userExistsOnSystem,
      keyPath: sshStatus.keyPath,
      pubKeyPath: sshStatus.pubKeyPath,
      privateKeyExists: sshStatus.privateKeyExists,
      publicKeyExists: sshStatus.publicKeyExists,
      publicKeyContent: sshStatus.publicKeyContent,
      knownHostsPath: sshStatus.knownHostsPath,
      knownHostsExists: sshStatus.knownHostsExists,
      allowedRoots: settings.allowed_deploy_roots,
      rootPermissions,
      githubConnected: githubResult.success,
      githubMessage: githubResult.message
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/test-github', async (req, res) => {
  try {
    const result = await testGithubConnection();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to test GitHub connection',
      details: err.message
    });
  }
});

router.get('/ssh-key', async (req, res) => {
  try {
    const status = await checkSshKeyStatus();
    return res.json(status);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/generate-ssh-key', async (req: AuthenticatedRequest, res) => {
  try {
    const status = await generateSshKey();
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'GENERATE_SSH_KEY',
      ipAddress: req.ip,
      details: `Generated new SSH key at ${status.keyPath}`
    });
    return res.json({ message: 'New SSH key generated successfully.', status });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/settings', (req, res) => {
  try {
    const settings = getSettings();
    return res.json(settings);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/settings', (req: AuthenticatedRequest, res) => {
  try {
    const updated = updateSettings(req.body || {});
    logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action: 'UPDATE_SETTINGS',
      ipAddress: req.ip,
      details: 'Updated system settings'
    });
    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/audit-logs', (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 100, 1), 500);
  try {
    const logs = getAuditLogs(limit);
    return res.json(logs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/dashboard/stats', (req, res) => {
  try {
    const totalRepoRow = db.prepare('SELECT COUNT(*) as count FROM repositories').get() as { count: number };
    const autoDeployRow = db.prepare('SELECT COUNT(*) as count FROM repositories WHERE auto_deploy = 1').get() as { count: number };
    const successDeployRow = db.prepare('SELECT COUNT(*) as count FROM deployments WHERE status = "SUCCESS"').get() as { count: number };
    const failedDeployRow = db.prepare('SELECT COUNT(*) as count FROM deployments WHERE status = "FAILED"').get() as { count: number };

    const lastDep = db.prepare(`
      SELECT d.*, r.name as repository_name
      FROM deployments d
      JOIN repositories r ON d.repository_id = r.id
      ORDER BY d.id DESC
      LIMIT 1
    `).get() as any;

    const recentDeployments = db.prepare(`
      SELECT d.*, r.name as repository_name
      FROM deployments d
      JOIN repositories r ON d.repository_id = r.id
      ORDER BY d.id DESC
      LIMIT 10
    `).all() as any[];

    const recentAuditLogs = getAuditLogs(10) as unknown as AuditLog[];

    const stats: DashboardStats = {
      totalRepositories: totalRepoRow.count,
      autoDeployCount: autoDeployRow.count,
      successfulDeployments: successDeployRow.count,
      failedDeployments: failedDeployRow.count,
      lastDeployment: lastDep,
      recentDeployments,
      recentAuditLogs
    };

    return res.json(stats);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
