import { db } from '../db.js';
import { AppSettings } from '../../types.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export function getExecutionHomeDir(username = 'nova'): { homeDir: string; userExists: boolean } {
  const targetUser = username || 'nova';
  
  if (targetUser === 'root') {
    return { homeDir: '/root', userExists: true };
  }

  // Try reading /etc/passwd on Linux
  try {
    if (fs.existsSync('/etc/passwd')) {
      const content = fs.readFileSync('/etc/passwd', 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const parts = line.split(':');
        if (parts.length >= 6 && parts[0] === targetUser) {
          return { homeDir: parts[5] || `/home/${targetUser}`, userExists: true };
        }
      }
    }
  } catch {
    // ignore filesystem read error
  }

  // Fallback to /home/<username>
  return { homeDir: `/home/${targetUser}`, userExists: false };
}

export function expandHome(p: string, username = 'nova'): string {
  if (p.startsWith('~/') || p === '~') {
    const { homeDir } = getExecutionHomeDir(username);
    return path.join(homeDir, p.slice(1));
  }
  return p;
}

export function getSettings(): AppSettings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }

  let allowedRoots: string[] = ['/www/wwwroot'];
  if (map.allowed_deploy_roots) {
    try {
      const parsed = JSON.parse(map.allowed_deploy_roots);
      if (Array.isArray(parsed) && parsed.every(r => typeof r === 'string')) {
        allowedRoots = parsed;
      }
    } catch {
      allowedRoots = ['/www/wwwroot'];
    }
  }

  const executionUser = map.execution_user || 'nova';
  const { homeDir } = getExecutionHomeDir(executionUser);

  return {
    allowed_deploy_roots: allowedRoots,
    execution_user: executionUser,
    execution_home_dir: homeDir,
    git_executable: map.git_executable || 'git',
    ssh_key_path: map.ssh_key_path || '~/.ssh/id_ed25519',
    known_hosts_path: map.known_hosts_path || '~/.ssh/known_hosts',
    auto_refresh_interval: parseInt(map.auto_refresh_interval || '30', 10)
  };
}

export const CRITICAL_SYSTEM_DIRS = ['/', '/root', '/etc', '/home', '/var', '/usr', '/opt', '/bin', '/sbin'];

export function updateSettings(newSettings: Partial<AppSettings>): AppSettings {
  const now = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO settings (key, value, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);

  if (newSettings.allowed_deploy_roots) {
    if (!Array.isArray(newSettings.allowed_deploy_roots) || newSettings.allowed_deploy_roots.length === 0) {
      throw new Error('At least one allowed deploy root is required.');
    }
    const cleaned = newSettings.allowed_deploy_roots.map(r => path.resolve(String(r)));
    for (const root of cleaned) {
      if (CRITICAL_SYSTEM_DIRS.includes(root)) {
        throw new Error(`Deploy root '${root}' is a critical system directory and cannot be used.`);
      }
    }
    upsert.run('allowed_deploy_roots', JSON.stringify(cleaned), now, now);
  }
  if (newSettings.execution_user !== undefined) {
    upsert.run('execution_user', newSettings.execution_user.trim(), now, now);
  }
  if (newSettings.git_executable !== undefined) {
    upsert.run('git_executable', newSettings.git_executable, now, now);
  }
  if (newSettings.ssh_key_path !== undefined) {
    upsert.run('ssh_key_path', newSettings.ssh_key_path, now, now);
  }
  if (newSettings.known_hosts_path !== undefined) {
    upsert.run('known_hosts_path', newSettings.known_hosts_path, now, now);
  }
  if (newSettings.auto_refresh_interval !== undefined) {
    upsert.run('auto_refresh_interval', String(newSettings.auto_refresh_interval), now, now);
  }

  return getSettings();
}

/**
 * Security helper to validate if a target path is inside one of the Allowed Deploy Roots.
 */
export function validateAllowedPath(targetPath: string): { valid: boolean; resolvedPath: string; error?: string } {
  const settings = getSettings();

  const resolved = path.resolve(targetPath);

  // Reject dangerous system paths
  const forbiddenExact = CRITICAL_SYSTEM_DIRS;
  if (forbiddenExact.includes(resolved)) {
    return {
      valid: false,
      resolvedPath: resolved,
      error: `Path '${resolved}' is a critical system directory and cannot be used as a deployment target.`
    };
  }

  // Check if path starts with one of allowedRoots
  const isAllowed = settings.allowed_deploy_roots.some(root => {
    const resolvedRoot = path.resolve(root);
    return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep);
  });

  if (!isAllowed) {
    return {
      valid: false,
      resolvedPath: resolved,
      error: `Path '${resolved}' is outside the Allowed Deploy Roots (${settings.allowed_deploy_roots.join(', ')}). Add it in Settings if intended.`
    };
  }

  return { valid: true, resolvedPath: resolved };
}
