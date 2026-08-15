import fs from 'node:fs';
import path from 'node:path';
import { runCommand, runPrivileged, detectTools } from './system.service.js';
import { getSettings } from './settings.service.js';

export interface NginxSite {
  name: string;
  enabled: boolean;
  path: string;
  enabledPath?: string;
}

export interface WebServerStatus {
  nginx: { installed: boolean; version?: string; sitesDir?: string; enabledDir?: string };
  caddy: { installed: boolean; version?: string; caddyfilePath?: string };
}

function getNginxDirs() {
  const settings = getSettings();
  const sitesDir = (settings as any).nginx_sites_dir || '/etc/nginx/sites-available';
  const enabledDir = (settings as any).nginx_sites_enabled_dir || '/etc/nginx/sites-enabled';
  return { sitesDir, enabledDir };
}

function getCaddyfilePath(): string {
  const settings = getSettings();
  return (settings as any).caddyfile_path || '/etc/caddy/Caddyfile';
}

export async function getWebServerStatus(): Promise<WebServerStatus> {
  const tools = await detectTools();
  const { sitesDir, enabledDir } = getNginxDirs();
  return {
    nginx: {
      installed: tools.nginx.installed,
      version: tools.nginx.version,
      sitesDir,
      enabledDir
    },
    caddy: {
      installed: tools.caddy.installed,
      version: tools.caddy.version,
      caddyfilePath: getCaddyfilePath()
    }
  };
}

function sanitizeSiteName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '-').replace(/^-+|-+$/g, '');
}

// ---------- nginx ----------

export async function listNginxSites(): Promise<NginxSite[]> {
  const status = await getWebServerStatus();
  if (!status.nginx.installed) return [];
  const { sitesDir, enabledDir } = getNginxDirs();
  if (!fs.existsSync(sitesDir)) return [];
  const files = fs.readdirSync(sitesDir).filter(f => f.endsWith('.conf') || !f.includes('.'));
  return files
    .filter(name => {
      const full = path.join(sitesDir, name);
      try {
        return fs.statSync(full).isFile();
      } catch {
        return false;
      }
    })
    .map(name => {
      const full = path.join(sitesDir, name);
      const enabledPath = path.join(enabledDir, name);
      let enabled = false;
      try {
        enabled = fs.lstatSync(enabledPath).isSymbolicLink() || fs.existsSync(enabledPath);
      } catch {
        enabled = false;
      }
      return { name, enabled, path: full, enabledPath };
    });
}

export function getNginxSiteContent(name: string): string {
  const { sitesDir } = getNginxDirs();
  const full = path.join(sitesDir, sanitizeSiteName(name));
  if (!fs.existsSync(full)) throw new Error(`Site config ${name} not found.`);
  return fs.readFileSync(full, 'utf8');
}

async function testNginx(): Promise<void> {
  const res = await runCommand('nginx', ['-t'], { timeout: 30000 });
  if (res.code !== 0) {
    throw new Error((res.stderr || res.stdout || '').trim() || 'nginx configuration test failed');
  }
}

export async function saveNginxSite(name: string, content: string): Promise<{ message: string }> {
  const status = await getWebServerStatus();
  if (!status.nginx.installed) throw new Error('nginx is not installed on this server.');
  const safeName = sanitizeSiteName(name);
  if (!safeName) throw new Error('Invalid site name.');
  const { sitesDir, enabledDir } = getNginxDirs();
  if (!fs.existsSync(sitesDir)) throw new Error(`nginx sites directory not found: ${sitesDir}`);
  const full = path.join(sitesDir, safeName);
  const backup = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
  fs.writeFileSync(full, content, 'utf8');

  const enabledPath = path.join(enabledDir, safeName);
  const hadLink = fs.existsSync(enabledPath);
  if (!hadLink) {
    try {
      fs.symlinkSync(full, enabledPath);
    } catch {
      // Directory may not exist; config is still testable via -t only if linked.
    }
  }
  try {
    await testNginx();
  } catch (err) {
    if (backup !== null) fs.writeFileSync(full, backup, 'utf8');
    if (!hadLink && fs.existsSync(enabledPath)) {
      try { fs.unlinkSync(enabledPath); } catch {}
    }
    throw err;
  }
  return { message: `Site config ${safeName} saved and validated.` };
}

export async function enableNginxSite(name: string): Promise<{ message: string }> {
  const status = await getWebServerStatus();
  if (!status.nginx.installed) throw new Error('nginx is not installed on this server.');
  const safeName = sanitizeSiteName(name);
  const { sitesDir, enabledDir } = getNginxDirs();
  const full = path.join(sitesDir, safeName);
  if (!fs.existsSync(full)) throw new Error(`Site config ${safeName} not found.`);
  const enabledPath = path.join(enabledDir, safeName);
  if (!fs.existsSync(enabledPath)) {
    fs.symlinkSync(full, enabledPath);
  }
  try {
    await testNginx();
  } catch (err) {
    try { fs.unlinkSync(enabledPath); } catch {}
    throw err;
  }
  await reloadNginx();
  return { message: `Site ${safeName} enabled and nginx reloaded.` };
}

export async function disableNginxSite(name: string): Promise<{ message: string }> {
  const status = await getWebServerStatus();
  if (!status.nginx.installed) throw new Error('nginx is not installed on this server.');
  const safeName = sanitizeSiteName(name);
  const { enabledDir } = getNginxDirs();
  const enabledPath = path.join(enabledDir, safeName);
  if (fs.existsSync(enabledPath)) {
    fs.unlinkSync(enabledPath);
  }
  try {
    await testNginx();
  } catch (err) {
    const { sitesDir } = getNginxDirs();
    try { fs.symlinkSync(path.join(sitesDir, safeName), enabledPath); } catch {}
    throw err;
  }
  await reloadNginx();
  return { message: `Site ${safeName} disabled and nginx reloaded.` };
}

export async function testNginxConfig(): Promise<{ ok: boolean; output: string }> {
  try {
    await testNginx();
    return { ok: true, output: 'nginx configuration test passed.' };
  } catch (err: any) {
    return { ok: false, output: err.message };
  }
}

export async function reloadNginx(): Promise<{ message: string }> {
  const status = await getWebServerStatus();
  if (!status.nginx.installed) throw new Error('nginx is not installed on this server.');
  const res = await runPrivileged(['nginx', '-s', 'reload'], { timeout: 30000 });
  if (res.code !== 0) {
    throw new Error((res.stderr || res.stdout || '').trim() || 'nginx reload failed');
  }
  return { message: 'nginx reloaded.' };
}

// ---------- caddy ----------

export function getCaddyfileContent(): string {
  const p = getCaddyfilePath();
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf8');
}

async function validateCaddyfile(configPath: string): Promise<void> {
  const res = await runCommand('caddy', ['validate', '--config', configPath], { timeout: 60000 });
  if (res.code !== 0) {
    throw new Error((res.stderr || res.stdout || '').trim() || 'caddy config validation failed');
  }
}

export async function saveCaddyfile(content: string): Promise<{ message: string }> {
  const status = await getWebServerStatus();
  if (!status.caddy.installed) throw new Error('caddy is not installed on this server.');
  const p = getCaddyfilePath();
  const backup = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  fs.writeFileSync(p, content, 'utf8');
  try {
    await validateCaddyfile(p);
  } catch (err) {
    if (backup !== null) fs.writeFileSync(p, backup, 'utf8');
    throw err;
  }
  await reloadCaddy();
  return { message: 'Caddyfile saved and validated.' };
}

export async function reloadCaddy(): Promise<{ message: string }> {
  const status = await getWebServerStatus();
  if (!status.caddy.installed) throw new Error('caddy is not installed on this server.');
  const p = getCaddyfilePath();
  const viaSystemd = await runPrivileged(['systemctl', 'reload', 'caddy'], { timeout: 30000 });
  if (viaSystemd.code === 0) return { message: 'caddy reloaded via systemd.' };
  const res = await runCommand('caddy', ['reload', '--config', p], { timeout: 30000 });
  if (res.code !== 0) {
    throw new Error((res.stderr || res.stdout || '').trim() || 'caddy reload failed');
  }
  return { message: 'caddy reloaded via admin API.' };
}

// ---------- Reverse proxy generator ----------

export interface ReverseProxyInput {
  engine: 'nginx' | 'caddy';
  name: string;
  domain: string;
  targetPort: number;
}

export interface ReverseProxyResult {
  engine: 'nginx' | 'caddy';
  name: string;
  path: string;
  message: string;
}

export async function generateReverseProxy(input: ReverseProxyInput): Promise<ReverseProxyResult> {
  const safeName = sanitizeSiteName(input.name);
  if (!safeName) throw new Error('Invalid site name.');
  const domain = (input.domain || '').trim().toLowerCase();
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    throw new Error('Invalid domain name.');
  }
  const targetPort = parseInt(String(input.targetPort), 10);
  if (!Number.isFinite(targetPort) || targetPort < 1 || targetPort > 65535) {
    throw new Error('Invalid target port.');
  }

  if (input.engine === 'nginx') {
    const { sitesDir } = getNginxDirs();
    const fileName = `hsdm-${safeName}.conf`;
    const full = path.join(sitesDir, fileName);
    const content = [
      `# Generated by HSDM for ${safeName}`,
      'server {',
      '    listen 80;',
      `    server_name ${domain};`,
      '',
      '    location / {',
      `        proxy_pass http://127.0.0.1:${targetPort};`,
      '        proxy_set_header Host $host;',
      '        proxy_set_header X-Real-IP $remote_addr;',
      '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
      '        proxy_set_header X-Forwarded-Proto $scheme;',
      '    }',
      '}',
      ''
    ].join('\n');
    await saveNginxSite(fileName, content);
    await enableNginxSite(fileName);
    return { engine: 'nginx', name: fileName, path: full, message: `Reverse proxy for ${domain} created and enabled.` };
  }

  // caddy: marker-based block inside the Caddyfile
  const p = getCaddyfilePath();
  const begin = `# HSDM-BEGIN:${safeName}`;
  const end = `# HSDM-END:${safeName}`;
  const block = [
    begin,
    `${domain} {`,
    `    reverse_proxy 127.0.0.1:${targetPort}`,
    '}',
    end
  ].join('\n');

  const current = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  let updated: string;
  const beginIdx = current.indexOf(begin);
  const endIdx = current.indexOf(end);
  if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
    updated = current.slice(0, beginIdx) + block + current.slice(endIdx + end.length);
  } else {
    updated = `${current.trimEnd()}\n\n${block}\n`;
  }
  fs.writeFileSync(p, updated, 'utf8');
  try {
    await validateCaddyfile(p);
  } catch (err) {
    fs.writeFileSync(p, current, 'utf8');
    throw err;
  }
  await reloadCaddy();
  return { engine: 'caddy', name: safeName, path: p, message: `Reverse proxy for ${domain} created and loaded.` };
}