import { runCommand, runPrivileged, detectTools } from './system.service.js';

export interface SystemdService {
  unit: string;
  load: string;
  active: string;
  sub: string;
  description: string;
}

export async function getSystemdAvailable(): Promise<boolean> {
  const tools = await detectTools();
  return tools.systemd.installed;
}

export async function listServices(filter = ''): Promise<SystemdService[]> {
  if (!(await getSystemdAvailable())) return [];
  const res = await runCommand(
    'systemctl',
    ['list-units', '--type=service', '--all', '--no-pager', '--plain', '--no-legend'],
    { timeout: 30000 }
  );
  if (res.code !== 0) return [];
  const services: SystemdService[] = [];
  for (const line of res.stdout.split('\n')) {
    if (!line.trim()) continue;
    const match = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/);
    if (!match) continue;
    const [, unit, load, active, sub, description] = match;
    if (filter && !unit.toLowerCase().includes(filter.toLowerCase()) && !description.toLowerCase().includes(filter.toLowerCase())) {
      continue;
    }
    services.push({ unit, load, active, sub, description: description.trim() });
  }
  return services;
}

export async function getServiceStatus(unit: string): Promise<{ unit: string; output: string }> {
  if (!(await getSystemdAvailable())) throw new Error('systemd is not available on this server.');
  const res = await runCommand('systemctl', ['status', unit, '--no-pager', '-l'], { timeout: 30000 });
  // systemctl status exits non-zero for inactive units; the output is still useful.
  return { unit, output: (res.stdout + res.stderr).trim() };
}

async function serviceAction(action: string, unit: string) {
  if (!(await getSystemdAvailable())) throw new Error('systemd is not available on this server.');
  const res = await runPrivileged(['systemctl', action, unit], { timeout: 120000 });
  if (res.code !== 0) {
    throw new Error((res.stderr || res.stdout || '').trim() || `systemctl ${action} ${unit} failed`);
  }
  return { message: `Service ${unit} ${action} requested.`, unit };
}

export const startService = (unit: string) => serviceAction('start', unit);
export const stopService = (unit: string) => serviceAction('stop', unit);
export const restartService = (unit: string) => serviceAction('restart', unit);
export const enableService = (unit: string) => serviceAction('enable', unit);
export const disableService = (unit: string) => serviceAction('disable', unit);

export async function getServiceLogs(unit: string, tail = 200): Promise<{ unit: string; log: string }> {
  if (!(await getSystemdAvailable())) throw new Error('systemd is not available on this server.');
  const res = await runCommand('journalctl', ['-u', unit, '-n', String(tail), '--no-pager'], { timeout: 30000 });
  if (res.code !== 0 && !res.stdout) {
    throw new Error((res.stderr || '').trim() || `journalctl failed for ${unit}`);
  }
  return { unit, log: (res.stdout + res.stderr).trim() };
}