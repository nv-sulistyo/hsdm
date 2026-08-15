import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db.js';
import { pullRepository, checkRepoStatus } from './git.service.js';
import { validateAllowedPath, getExecutionHomeDir, getSettings } from './settings.service.js';
import { logAudit } from './audit.service.js';
import { TriggerType, Deployment } from '../../types.js';

const execAsync = promisify(exec);

// In-memory set of running repo deployment IDs to prevent race conditions / concurrent pulls
const runningRepos = new Set<number>();

export async function executeDeployment(options: {
  repositoryId: number;
  triggerType: TriggerType;
  force?: boolean;
  userId?: number;
  username?: string;
  ipAddress?: string;
}): Promise<Deployment> {
  const { repositoryId, triggerType, force = false, userId, username, ipAddress } = options;

  if (runningRepos.has(repositoryId)) {
    throw new Error('A deployment is already running for this repository.');
  }

  // Fetch repository record
  const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(repositoryId) as any;
  if (!repo) {
    throw new Error(`Repository with ID ${repositoryId} not found.`);
  }

  // Insert initial deployment record (PENDING/RUNNING)
  const now = new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT INTO deployments (repository_id, trigger_type, status, started_at, created_at)
    VALUES (?, ?, 'RUNNING', ?, ?)
  `);
  const result = insertStmt.run(repositoryId, triggerType, now, now);
  const deploymentId = Number(result.lastInsertRowid);

  runningRepos.add(repositoryId);

  // Execute in background / async
  (async () => {
    let fullLog = `[DEPLOYMENT START] ${new Date().toISOString()}\n`;
    fullLog += `Repository: ${repo.name} (${repo.local_path})\n`;
    fullLog += `Branch: ${repo.branch}\n`;
    fullLog += `Trigger: ${triggerType}\n`;

    let finalStatus: 'SUCCESS' | 'FAILED' = 'SUCCESS';
    let errorMessage = '';
    let commitBefore = '';
    let commitAfter = '';

    try {
      const executionUser = repo.execution_user || 'nova';
      const pathVal = validateAllowedPath(repo.local_path);
      if (!pathVal.valid) {
        throw new Error(pathVal.error);
      }

      const { homeDir } = getExecutionHomeDir(executionUser);
      const execEnv = {
        ...process.env,
        HOME: homeDir,
        USER: executionUser,
        LOGNAME: executionUser
      };

      // 1. Optional before_command
      if (repo.before_command && repo.before_command.trim().length > 0) {
        const cmd = repo.before_command.trim();
        fullLog += `\n--- Executing Optional Before-Pull Command ---\nCommand: ${cmd}\n`;
        try {
          const { stdout, stderr } = await execAsync(cmd, {
            cwd: pathVal.resolvedPath,
            env: execEnv,
            maxBuffer: 10 * 1024 * 1024,
            timeout: 300000
          });
          fullLog += `[BEFORE-PULL STDOUT]\n${stdout}\n`;
          if (stderr) fullLog += `[BEFORE-PULL STDERR]\n${stderr}\n`;
        } catch (cmdErr: any) {
          fullLog += `[BEFORE-PULL ERROR]\n${cmdErr.message || ''}\n${cmdErr.stderr || ''}\n`;
          throw new Error(`Before-pull command failed: ${cmdErr.message || 'Error executing pre-script'}`);
        }
      }

      // 2. Run git pull / sync
      fullLog += `\n--- Executing Git Pull ---\n`;
      const pullResult = await pullRepository(repo.local_path, repo.branch, force);
      fullLog += pullResult.stdout + '\n';
      commitBefore = pullResult.commitBefore;
      commitAfter = pullResult.commitAfter;

      // 3. Optional post-pull command
      if (repo.post_pull_command && repo.post_pull_command.trim().length > 0) {
        const cmd = repo.post_pull_command.trim();
        fullLog += `\n--- Executing Optional Post-Pull Command ---\nCommand: ${cmd}\n`;

        try {
          const { stdout, stderr } = await execAsync(cmd, {
            cwd: pathVal.resolvedPath,
            env: execEnv,
            maxBuffer: 10 * 1024 * 1024, // 10MB
            timeout: 300000 // 5 min timeout
          });
          fullLog += `[POST-PULL STDOUT]\n${stdout}\n`;
          if (stderr) {
            fullLog += `[POST-PULL STDERR]\n${stderr}\n`;
          }
        } catch (cmdErr: any) {
          fullLog += `[POST-PULL ERROR]\n${cmdErr.message || ''}\n${cmdErr.stderr || ''}\n`;
          throw new Error(`Post-pull command failed: ${cmdErr.message || 'Error executing script'}`);
        }
      }

      // 4. Optional auto-deploy step based on deploy_mode (kept separate from
      //    pull logic; configured per-repository, not part of the add wizard)
      if (repo.deploy_mode === 'DOCKER_COMPOSE') {
        const composeFile = repo.compose_file || 'docker-compose.yml';
        fullLog += `\n--- Auto-Deploy: Docker Compose (${composeFile}) ---\n`;
        try {
          const proxiedServices = (repo.compose_proxy_services || '')
            .split(',').map((s: string) => s.trim()).filter(Boolean);
          const overrideFile = composeFile.replace(/\.ya?ml$/i, '.override.yml');
          if (proxiedServices.length > 0) {
            const proxyNetwork = getSettings().proxy_network || 'proxy';
            const lines: string[] = ['# Generated by HSDM — attaches web-facing services to the shared proxy network.'];
            lines.push('services:');
            for (const s of proxiedServices) {
              lines.push(`  ${s}:`);
              lines.push('    networks:');
              lines.push('      - default');
              lines.push(`      - ${proxyNetwork}`);
            }
            lines.push('networks:');
            lines.push(`  ${proxyNetwork}:`);
            lines.push('    external: true');
            fs.writeFileSync(path.join(pathVal.resolvedPath, overrideFile), lines.join('\n') + '\n', 'utf8');
            fullLog += `[COMPOSE OVERRIDE] ${overrideFile} written for: ${proxiedServices.join(', ')}\n`;
          } else {
            const overridePath = path.join(pathVal.resolvedPath, overrideFile);
            if (fs.existsSync(overridePath)) {
              fs.unlinkSync(overridePath);
              fullLog += `[COMPOSE OVERRIDE] ${overrideFile} removed (no proxied services).\n`;
            }
          }
          const overrideArgs = fs.existsSync(path.join(pathVal.resolvedPath, overrideFile))
            ? ` -f ${composeFile} -f ${overrideFile}`
            : ` -f ${composeFile}`;
          const cmd = `docker compose${overrideArgs} up -d --build`;
          fullLog += `Command: ${cmd}\n`;
          const { stdout, stderr } = await execAsync(cmd, {
            cwd: pathVal.resolvedPath,
            env: execEnv,
            maxBuffer: 10 * 1024 * 1024,
            timeout: 600000 // 10 min for image builds
          });
          fullLog += `[COMPOSE STDOUT]\n${stdout}\n`;
          if (stderr) {
            fullLog += `[COMPOSE STDERR]\n${stderr}\n`;
          }
        } catch (cmdErr: any) {
          fullLog += `[COMPOSE ERROR]\n${cmdErr.message || ''}\n${cmdErr.stderr || ''}\n`;
          throw new Error(`Docker Compose deploy failed: ${cmdErr.message || 'Error executing compose'}`);
        }
      } else if (repo.deploy_mode === 'SYSTEMD' && repo.systemd_unit && repo.systemd_unit.trim()) {
        const unit = repo.systemd_unit.trim();
        fullLog += `\n--- Auto-Deploy: systemd restart (${unit}) ---\n`;
        try {
          const cmd = `systemctl restart ${unit}`;
          fullLog += `Command: ${cmd}\n`;
          const { stdout, stderr } = await execAsync(cmd, {
            cwd: pathVal.resolvedPath,
            env: execEnv,
            maxBuffer: 10 * 1024 * 1024,
            timeout: 120000
          });
          fullLog += `[SYSTEMD STDOUT]\n${stdout}\n`;
          if (stderr) {
            fullLog += `[SYSTEMD STDERR]\n${stderr}\n`;
          }
        } catch (cmdErr: any) {
          fullLog += `[SYSTEMD ERROR]\n${cmdErr.message || ''}\n${cmdErr.stderr || ''}\n`;
          throw new Error(`systemd restart failed: ${cmdErr.message || 'Error executing systemctl'}`);
        }
      }

      fullLog += `\n[DEPLOYMENT SUCCESS] Finished at ${new Date().toISOString()}\n`;
    } catch (err: any) {
      finalStatus = 'FAILED';
      errorMessage = err.message || 'Deployment execution failed';
      fullLog += `\n[DEPLOYMENT FAILED] ${errorMessage}\n`;
    } finally {
      runningRepos.delete(repositoryId);
      const finishedAt = new Date().toISOString();

      // Update deployment record
      db.prepare(`
        UPDATE deployments
        SET status = ?, commit_before = ?, commit_after = ?, finished_at = ?, output = ?, error = ?
        WHERE id = ?
      `).run(
        finalStatus,
        commitBefore,
        commitAfter,
        finishedAt,
        fullLog,
        errorMessage || null,
        deploymentId
      );

      // Refresh repository status in DB
      try {
        const repoStatus = await checkRepoStatus(repo.local_path, repo.branch);
        db.prepare(`
          UPDATE repositories
          SET status = ?, last_pull_at = ?, last_commit_hash = ?, last_commit_message = ?, updated_at = ?
          WHERE id = ?
        `).run(
          repoStatus.status,
          finalStatus === 'SUCCESS' ? finishedAt : repo.last_pull_at,
          repoStatus.lastCommitHash || repo.last_commit_hash,
          repoStatus.lastCommitMessage || repo.last_commit_message,
          finishedAt,
          repositoryId
        );
      } catch (stErr) {
        console.error('Failed to update repo status after deployment:', stErr);
      }

      // Audit log entry
      logAudit({
        userId,
        username,
        action: `DEPLOYMENT_${finalStatus}`,
        repositoryId,
        ipAddress,
        details: `Trigger: ${triggerType}, Deployment ID: #${deploymentId}, Error: ${errorMessage || 'None'}`
      });
    }
  })();

  // Return the created deployment object
  const dep = db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId) as any;
  return dep;
}

export function getDeployments(limit = 100, repositoryId?: number): Deployment[] {
  if (repositoryId) {
    return (db.prepare(`
      SELECT d.*, r.name as repository_name
      FROM deployments d
      JOIN repositories r ON d.repository_id = r.id
      WHERE d.repository_id = ?
      ORDER BY d.id DESC
      LIMIT ?
    `).all(repositoryId, limit) as unknown) as Deployment[];
  }

  return (db.prepare(`
    SELECT d.*, r.name as repository_name
    FROM deployments d
    JOIN repositories r ON d.repository_id = r.id
    ORDER BY d.id DESC
    LIMIT ?
  `).all(limit) as unknown) as Deployment[];
}

export function getDeploymentById(id: number): Deployment | undefined {
  return (db.prepare(`
    SELECT d.*, r.name as repository_name
    FROM deployments d
    JOIN repositories r ON d.repository_id = r.id
    WHERE d.id = ?
  `).get(id) as unknown) as Deployment | undefined;
}
