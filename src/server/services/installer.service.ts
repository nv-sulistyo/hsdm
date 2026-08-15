import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { detectTools, invalidateToolsCache, isWindows, isRootUser } from './system.service.js';
import { db } from '../db.js';
import { logAudit } from './audit.service.js';

const execFileAsync = promisify(execFile);

export interface StackStatusItem {
  installed: boolean;
  version?: string;
  installedAt?: string;
}

export interface StackStatus {
  docker: StackStatusItem;
  compose: StackStatusItem;
  nginx: StackStatusItem;
  caddy: StackStatusItem;
  isRoot: boolean;
  installable: boolean;
}

export interface InstallJob {
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | null;
  components: string[];
  log: string[];
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

const INSTALL_LOG_CAP = 3000;
let installJob: InstallJob | null = null;

function getStoredInstallRecord(): Record<string, { version?: string; installedAt?: string }> {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'stack_install'").get() as { value: string } | undefined;
    if (!row) return {};
    return JSON.parse(row.value) || {};
  } catch {
    return {};
  }
}

function saveInstallRecord(component: string, info: { version?: string }) {
  const record = getStoredInstallRecord();
  record[component] = { version: info.version, installedAt: new Date().toISOString() };
  db.prepare(`
    INSERT INTO settings (key, value, created_at, updated_at) VALUES ('stack_install', ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(JSON.stringify(record), new Date().toISOString(), new Date().toISOString());
}

export async function getStackStatus(): Promise<StackStatus> {
  const tools = await detectTools(true);
  const record = getStoredInstallRecord();
  const map = (tool: typeof tools.docker, key: string): StackStatusItem => ({
    installed: tool.installed,
    version: tool.version,
    installedAt: record[key]?.installedAt
  });
  return {
    docker: map(tools.docker, 'docker'),
    compose: map(tools.compose, 'compose'),
    nginx: map(tools.nginx, 'nginx'),
    caddy: map(tools.caddy, 'caddy'),
    isRoot: isRootUser(),
    installable: !isWindows() && isRootUser()
  };
}

function appendLog(line: string) {
  if (!installJob) return;
  installJob.log.push(line);
  if (installJob.log.length > INSTALL_LOG_CAP) {
    installJob.log = installJob.log.slice(installJob.log.length - INSTALL_LOG_CAP);
  }
}

async function runStep(label: string, command: string, timeout = 1200000) {
  appendLog(`\n=== ${label} ===`);
  appendLog(`$ ${command}`);
  try {
    const { stdout, stderr } = await execFileAsync('bash', ['-c', command], {
      timeout,
      maxBuffer: 20 * 1024 * 1024,
      env: {
        ...process.env,
        DEBIAN_FRONTEND: 'noninteractive'
      }
    });
    if (stdout.trim()) appendLog(stdout.trimEnd());
    if (stderr.trim()) appendLog(stderr.trimEnd());
    appendLog('[OK]');
  } catch (err: any) {
    if (err.stdout) appendLog(String(err.stdout).trimEnd());
    if (err.stderr) appendLog(String(err.stderr).trimEnd());
    appendLog(`[FAILED] ${err.message || 'command error'}`);
    throw new Error(`${label} failed: ${err.message || 'command error'}`);
  }
}

function getInstalledVersion(bin: string, args: string[]): string | undefined {
  return `via ${bin}`;
}

async function installDocker() {
  await runStep('Update apt package index', 'apt-get update -y');
  await runStep('Install Docker Engine (docker.io)', 'apt-get install -y docker.io');
  try {
    await runStep('Install Docker Compose plugin (docker-compose-plugin)', 'apt-get install -y docker-compose-plugin');
  } catch {
    try {
      await runStep('Install Docker Compose plugin (docker-compose-v2)', 'apt-get install -y docker-compose-v2');
    } catch {
      // Compose v1 fallback (deprecated but available on some Ubuntu versions)
      await runStep('Install Docker Compose (python)', 'apt-get install -y docker-compose');
    }
  }
  await runStep('Verify docker', 'docker --version');
  const composeCheck = await execFileAsync('docker', ['compose', 'version']).catch(() => null);
  if (composeCheck) {
    appendLog('[OK] docker compose plugin verified');
  } else {
    appendLog('[WARN] docker compose plugin not detected — legacy compose may be installed');
  }
  saveInstallRecord('docker', {});
  saveInstallRecord('compose', {});
}

async function installNginx() {
  await runStep('Install nginx', 'apt-get install -y nginx');
  await runStep('Enable and start nginx', 'systemctl enable --now nginx');
  saveInstallRecord('nginx', {});
}

async function installCaddy() {
  await runStep('Install prerequisites', 'apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl');
  await runStep(
    'Add Caddy GPG key',
    "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg"
  );
  await runStep(
    'Add Caddy apt repository',
    "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list"
  );
  await runStep('Update apt package index', 'apt-get update -y');
  await runStep('Install Caddy', 'apt-get install -y caddy');
  await runStep('Enable and start caddy', 'systemctl enable --now caddy');
  saveInstallRecord('caddy', {});
}

const INSTALLERS: Record<string, () => Promise<void>> = {
  docker: installDocker,
  nginx: installNginx,
  caddy: installCaddy
};

export function getInstallJob(): InstallJob {
  if (!installJob) {
    return { status: null, components: [], log: [] };
  }
  return installJob;
}

export async function startInstall(components: string[], userId?: number, username?: string, ipAddress?: string) {
  const valid = components.filter(c => Object.prototype.hasOwnProperty.call(INSTALLERS, c));
  const unique = Array.from(new Set(valid));
  if (unique.length === 0) throw new Error('No valid components selected.');

  if (isWindows()) {
    throw new Error('The installer only supports Linux servers.');
  }
  if (!isRootUser()) {
    throw new Error('Installer must run as root. Start HSDM as root or run this feature on the server directly.');
  }
  if (installJob && installJob.status === 'RUNNING') {
    throw new Error('An install job is already running.');
  }

  installJob = {
    status: 'RUNNING',
    components: unique,
    log: [`[STACK INSTALL START] ${new Date().toISOString()}`, `Components: ${unique.join(', ')}`],
    startedAt: new Date().toISOString()
  };

  logAudit({ userId, username, action: 'STACK_INSTALL_START', ipAddress, details: `Components: ${unique.join(', ')}` });

  (async () => {
    try {
      for (const component of unique) {
        appendLog(`\n----------------------------------------\nInstalling: ${component.toUpperCase()}\n----------------------------------------`);
        await INSTALLERS[component]();
        appendLog(`\n[OK] ${component.toUpperCase()} installed.`);
      }
      appendLog(`\n[STACK INSTALL SUCCESS] Finished at ${new Date().toISOString()}`);
      installJob.status = 'SUCCESS';
      installJob.finishedAt = new Date().toISOString();
      invalidateToolsCache();
      logAudit({ userId, username, action: 'STACK_INSTALL_SUCCESS', ipAddress, details: `Components: ${unique.join(', ')}` });
    } catch (err: any) {
      appendLog(`\n[STACK INSTALL FAILED] ${err.message || 'install failed'}`);
      installJob.status = 'FAILED';
      installJob.error = err.message || 'Install failed';
      installJob.finishedAt = new Date().toISOString();
      invalidateToolsCache();
      logAudit({ userId, username, action: 'STACK_INSTALL_FAILED', ipAddress, details: `Components: ${unique.join(', ')} — ${installJob.error}` });
    }
  })();

  return getInstallJob();
}