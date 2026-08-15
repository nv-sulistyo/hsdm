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
    auto_refresh_interval: parseInt(map.auto_refresh_interval || '30', 10),
    deploy_root: map.deploy_root || '/opt/hsdm/projects',
    proxy_network: map.proxy_network || 'proxy',
    infrastructure_dir: map.infrastructure_dir || '/opt/hsdm/infrastructure',
    nginx_sites_dir: map.nginx_sites_dir || '/etc/nginx/sites-available',
    nginx_sites_enabled_dir: map.nginx_sites_enabled_dir || '/etc/nginx/sites-enabled',
    caddyfile_path: map.caddyfile_path || '/etc/caddy/Caddyfile',
    proxy_mode: (map.proxy_mode === 'container' ? 'container' : 'native') as 'native' | 'container',
    caddy_container_name: map.caddy_container_name || 'caddy'
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
  if (newSettings.deploy_root !== undefined) {
    const cleaned = path.resolve(String(newSettings.deploy_root));
    if (CRITICAL_SYSTEM_DIRS.includes(cleaned)) {
      throw new Error(`Deploy root '${cleaned}' is a critical system directory and cannot be used.`);
    }
    upsert.run('deploy_root', cleaned, now, now);
  }
  if (newSettings.proxy_network !== undefined) {
    const network = String(newSettings.proxy_network).trim().replace(/[^A-Za-z0-9_-]/g, '');
    if (!network) throw new Error('Proxy network name cannot be empty.');
    upsert.run('proxy_network', network, now, now);
  }
  if (newSettings.infrastructure_dir !== undefined) {
    const cleaned = path.resolve(String(newSettings.infrastructure_dir));
    if (CRITICAL_SYSTEM_DIRS.includes(cleaned)) {
      throw new Error(`Infrastructure directory '${cleaned}' is a critical system directory and cannot be used.`);
    }
    upsert.run('infrastructure_dir', cleaned, now, now);
  }
  if (newSettings.nginx_sites_dir !== undefined) {
    upsert.run('nginx_sites_dir', String(newSettings.nginx_sites_dir), now, now);
  }
  if (newSettings.nginx_sites_enabled_dir !== undefined) {
    upsert.run('nginx_sites_enabled_dir', String(newSettings.nginx_sites_enabled_dir), now, now);
  }
  if (newSettings.caddyfile_path !== undefined) {
    upsert.run('caddyfile_path', String(newSettings.caddyfile_path), now, now);
  }
  if (newSettings.proxy_mode !== undefined) {
    const mode = String(newSettings.proxy_mode) === 'container' ? 'container' : 'native';
    upsert.run('proxy_mode', mode, now, now);
  }
  if (newSettings.caddy_container_name !== undefined) {
    const name = String(newSettings.caddy_container_name).trim().replace(/[^A-Za-z0-9_-]/g, '');
    if (!name) throw new Error('Caddy container name cannot be empty.');
    upsert.run('caddy_container_name', name, now, now);
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
