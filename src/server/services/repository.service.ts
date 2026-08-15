import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db.js';
import { validateAllowedPath } from './settings.service.js';
import { checkRepoStatus } from './git.service.js';
import { logAudit } from './audit.service.js';
import { Repository, RepoStatus } from '../../types.js';

export function assertValidGitUrl(url: string): void {
  const trimmed = (url || '').trim();
  if (!trimmed) {
    throw new Error('Git repository URL is required.');
  }
  // Values starting with "-" would be parsed as git CLI options (argument injection).
  if (trimmed.startsWith('-')) {
    throw new Error('Invalid Git repository URL.');
  }
  const looksLikeUrl =
    /^(https?:\/\/|ssh:\/\/|git:\/\/)/i.test(trimmed) ||
    trimmed.startsWith('git@') ||
    trimmed.includes(':') ||
    path.isAbsolute(trimmed);
  if (!looksLikeUrl) {
    throw new Error('Invalid Git repository URL. Use an http(s), ssh, git protocol URL or an absolute local path.');
  }
}

export function getAllRepositories(): Repository[] {
  const rows = db.prepare('SELECT * FROM repositories ORDER BY id DESC').all() as any[];
  return rows.map(r => ({
    ...r,
    auto_deploy: Boolean(r.auto_deploy),
    webhook_enabled: Boolean(r.webhook_enabled)
  }));
}

export function getRepositoryById(id: number): Repository | undefined {
  const r = db.prepare('SELECT * FROM repositories WHERE id = ?').get(id) as any;
  if (!r) return undefined;
  return {
    ...r,
    auto_deploy: Boolean(r.auto_deploy),
    webhook_enabled: Boolean(r.webhook_enabled)
  };
}

export async function createRepository(options: {
  name: string;
  git_url: string;
  branch?: string;
  local_path: string;
  execution_user?: string;
  mode?: 'CLONE' | 'CONNECT';
  git_strategy?: 'PULL' | 'FETCH_ONLY' | 'RESET_HARD';
  deployment_trigger?: 'MANUAL' | 'WEBHOOK' | 'BOTH';
  before_command?: string;
  post_pull_command?: string;
  auto_deploy?: boolean;
  webhook_enabled?: boolean;
  webhook_secret?: string;
  description?: string;
  userId?: number;
  username?: string;
  ipAddress?: string;
}): Promise<Repository> {
  const {
    name,
    git_url,
    branch = 'main',
    local_path,
    execution_user = 'nova',
    mode = 'CLONE',
    git_strategy = 'PULL',
    deployment_trigger = 'BOTH',
    before_command,
    post_pull_command,
    auto_deploy = true,
    webhook_enabled = true,
    webhook_secret,
    description,
    userId,
    username,
    ipAddress
  } = options;

  if (!name || !name.trim()) {
    throw new Error('Repository name is required.');
  }
  if (!local_path || !local_path.trim()) {
    throw new Error('Local path is required.');
  }
  assertValidGitUrl(git_url);

  // Validate path against Allowed Deploy Roots
  const pathValidation = validateAllowedPath(local_path);
  if (!pathValidation.valid) {
    throw new Error(pathValidation.error);
  }

  // Check unique name
  const existingName = db.prepare('SELECT id FROM repositories WHERE name = ?').get(name);
  if (existingName) {
    throw new Error(`Repository name '${name}' is already registered.`);
  }

  // Check unique local path
  const existingPath = db.prepare('SELECT id FROM repositories WHERE local_path = ?').get(pathValidation.resolvedPath);
  if (existingPath) {
    throw new Error(`Local path '${pathValidation.resolvedPath}' is already assigned to another repository.`);
  }

  const secret = webhook_secret || crypto.randomBytes(24).toString('hex');
  const now = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO repositories (
      name, git_url, branch, local_path, execution_user, mode, git_strategy,
      deployment_trigger, before_command, post_pull_command, auto_deploy, webhook_enabled,
      webhook_secret, description, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNCHECKED', ?, ?)
  `).run(
    name.trim(),
    git_url.trim(),
    branch.trim(),
    pathValidation.resolvedPath,
    execution_user.trim(),
    mode,
    git_strategy,
    deployment_trigger,
    before_command ? before_command.trim() : null,
    post_pull_command ? post_pull_command.trim() : null,
    auto_deploy ? 1 : 0,
    webhook_enabled ? 1 : 0,
    secret,
    description ? description.trim() : null,
    now,
    now
  );

  const newRepoId = Number(result.lastInsertRowid);

  // Check initial Git status asynchronously
  try {
    const status = await checkRepoStatus(pathValidation.resolvedPath, branch);
    db.prepare('UPDATE repositories SET status = ? WHERE id = ?').run(status.status, newRepoId);
  } catch {
    // ignore initial status check failure
  }

  logAudit({
    userId,
    username,
    action: 'CREATE_REPOSITORY',
    repositoryId: newRepoId,
    ipAddress,
    details: `Created repository '${name}' (Mode: ${mode}, User: ${execution_user}) at '${pathValidation.resolvedPath}'`
  });

  return getRepositoryById(newRepoId)!;
}

export async function updateRepository(
  id: number,
  options: {
    name?: string;
    git_url?: string;
    branch?: string;
    local_path?: string;
    execution_user?: string;
    mode?: 'CLONE' | 'CONNECT';
    git_strategy?: 'PULL' | 'FETCH_ONLY' | 'RESET_HARD';
    deployment_trigger?: 'MANUAL' | 'WEBHOOK' | 'BOTH';
    before_command?: string;
    post_pull_command?: string;
    deploy_mode?: 'NONE' | 'DOCKER_COMPOSE' | 'SYSTEMD';
    compose_file?: string;
    compose_service?: string;
    systemd_unit?: string;
    domain?: string;
    proxy_target_port?: number;
    auto_deploy?: boolean;
    webhook_enabled?: boolean;
    webhook_secret?: string;
    description?: string;
    userId?: number;
    username?: string;
    ipAddress?: string;
  }
): Promise<Repository> {
  const current = getRepositoryById(id);
  if (!current) {
    throw new Error(`Repository ID ${id} not found.`);
  }

  let targetPath = current.local_path;
  if (options.local_path && options.local_path !== current.local_path) {
    const pathValidation = validateAllowedPath(options.local_path);
    if (!pathValidation.valid) {
      throw new Error(pathValidation.error);
    }
    targetPath = pathValidation.resolvedPath;
  }

  if (options.git_url !== undefined) {
    assertValidGitUrl(options.git_url);
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE repositories
    SET name = ?, git_url = ?, branch = ?, local_path = ?, execution_user = ?,
        mode = ?, git_strategy = ?, deployment_trigger = ?, before_command = ?,
        post_pull_command = ?, deploy_mode = ?, compose_file = ?, compose_service = ?,
        systemd_unit = ?, domain = ?, proxy_target_port = ?,
        auto_deploy = ?, webhook_enabled = ?,
        webhook_secret = ?, description = ?, updated_at = ?
    WHERE id = ?
  `).run(
    options.name !== undefined ? options.name.trim() : current.name,
    options.git_url !== undefined ? options.git_url.trim() : current.git_url,
    options.branch !== undefined ? options.branch.trim() : current.branch,
    targetPath,
    options.execution_user !== undefined ? options.execution_user.trim() : current.execution_user,
    options.mode !== undefined ? options.mode : current.mode,
    options.git_strategy !== undefined ? options.git_strategy : (current.git_strategy || 'PULL'),
    options.deployment_trigger !== undefined ? options.deployment_trigger : (current.deployment_trigger || 'BOTH'),
    options.before_command !== undefined ? options.before_command.trim() : current.before_command,
    options.post_pull_command !== undefined ? options.post_pull_command.trim() : current.post_pull_command,
    options.deploy_mode !== undefined ? options.deploy_mode : (current.deploy_mode || 'NONE'),
    options.compose_file !== undefined ? (options.compose_file || 'docker-compose.yml') : (current.compose_file || 'docker-compose.yml'),
    options.compose_service !== undefined ? (options.compose_service || null) : (current.compose_service || null),
    options.systemd_unit !== undefined ? (options.systemd_unit || null) : (current.systemd_unit || null),
    options.domain !== undefined ? (options.domain || null) : (current.domain || null),
    options.proxy_target_port !== undefined ? options.proxy_target_port : (current.proxy_target_port || null),
    options.auto_deploy !== undefined ? (options.auto_deploy ? 1 : 0) : (current.auto_deploy ? 1 : 0),
    options.webhook_enabled !== undefined ? (options.webhook_enabled ? 1 : 0) : (current.webhook_enabled ? 1 : 0),
    options.webhook_secret !== undefined ? options.webhook_secret : current.webhook_secret,
    options.description !== undefined ? options.description.trim() : current.description,
    now,
    id
  );

  logAudit({
    userId: options.userId,
    username: options.username,
    action: 'UPDATE_REPOSITORY',
    repositoryId: id,
    ipAddress: options.ipAddress,
    details: `Updated configuration for repository '${current.name}'`
  });

  return getRepositoryById(id)!;
}

export function deleteRepository(options: {
  id: number;
  deleteFilesystem?: boolean;
  userId?: number;
  username?: string;
  ipAddress?: string;
}): void {
  const { id, deleteFilesystem = false, userId, username, ipAddress } = options;

  const current = getRepositoryById(id);
  if (!current) {
    throw new Error(`Repository ID ${id} not found.`);
  }

  // Delete from DB
  db.prepare('DELETE FROM repositories WHERE id = ?').run(id);

  let fsDeleted = false;
  if (deleteFilesystem && current.local_path) {
    const pathValidation = validateAllowedPath(current.local_path);
    if (pathValidation.valid && fs.existsSync(pathValidation.resolvedPath)) {
      try {
        fs.rmSync(pathValidation.resolvedPath, { recursive: true, force: true });
        fsDeleted = true;
      } catch (err: any) {
        console.error('Failed to remove filesystem directory:', err);
      }
    }
  }

  logAudit({
    userId,
    username,
    action: 'DELETE_REPOSITORY',
    repositoryId: id,
    ipAddress,
    details: `Deleted repository '${current.name}'. Filesystem deleted: ${fsDeleted}`
  });
}

export async function refreshRepositoryStatus(id: number): Promise<RepoStatus> {
  const repo = getRepositoryById(id);
  if (!repo) {
    throw new Error(`Repository ID ${id} not found.`);
  }

  const statusDetails = await checkRepoStatus(repo.local_path, repo.branch);

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE repositories
    SET status = ?, last_commit_hash = ?, last_commit_message = ?, updated_at = ?
    WHERE id = ?
  `).run(
    statusDetails.status,
    statusDetails.lastCommitHash || repo.last_commit_hash,
    statusDetails.lastCommitMessage || repo.last_commit_message,
    now,
    id
  );

  return statusDetails.status;
}
