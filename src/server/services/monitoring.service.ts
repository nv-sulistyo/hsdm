import os from 'node:os';
import fs from 'node:fs';
import { runCommand, detectTools, getHostInfo, isWindows } from './system.service.js';

export interface DiskInfo {
  filesystem: string;
  mount: string;
  size: number;
  used: number;
  available: number;
  percent: number;
}

export interface SystemMetrics {
  hostname: string;
  platform: string;
  release: string;
  arch: string;
  distro?: string;
  uptime: number;
  loadAvg: number[];
  cpuUsage: number;
  cpuCount: number;
  memory: {
    total: number;
    available: number;
    used: number;
    percent: number;
  };
  disks: DiskInfo[];
  timestamp: string;
}

export interface ContainerStat {
  container: string;
  name: string;
  cpu_percent: string;
  mem_usage: string;
  mem_percent: string;
  net_io: string;
  block_io: string;
  pids: string;
}

let lastCpuSample: { idle: number; total: number } | null = null;

function readProcFile(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function getLinuxCpuUsage(): number {
  const content = readProcFile('/proc/stat');
  const line = content.split('\n').find(l => l.startsWith('cpu '));
  if (!line) return 0;
  const parts = line.trim().split(/\s+/).slice(1).map(Number);
  if (parts.length < 4) return 0;
  const idle = parts[3] + (parts[4] || 0); // idle + iowait
  const total = parts.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
  const now = { idle, total };
  if (lastCpuSample) {
    const idleDelta = now.idle - lastCpuSample.idle;
    const totalDelta = now.total - lastCpuSample.total;
    lastCpuSample = now;
    if (totalDelta <= 0) return 0;
    const usage = ((totalDelta - idleDelta) / totalDelta) * 100;
    return Math.max(0, Math.min(100, Math.round(usage * 10) / 10));
  }
  lastCpuSample = now;
  return 0;
}

function getWindowsCpuUsage(): number {
  const cpus = os.cpus();
  if (!cpus || cpus.length === 0) return 0;
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    const times = cpu.times;
    idle += times.idle;
    total += times.user + times.nice + times.sys + times.idle + times.irq;
  }
  const now = { idle, total };
  if (lastCpuSample) {
    const idleDelta = now.idle - lastCpuSample.idle;
    const totalDelta = now.total - lastCpuSample.total;
    lastCpuSample = now;
    if (totalDelta <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round(((totalDelta - idleDelta) / totalDelta) * 1000) / 10));
  }
  lastCpuSample = now;
  return 0;
}

function getLinuxMemory(): { total: number; available: number; used: number; percent: number } {
  const content = readProcFile('/proc/meminfo');
  const get = (key: string) => {
    const m = content.match(new RegExp(`^${key}:\\s+(\\d+)`));
    return m ? parseInt(m[1], 10) * 1024 : 0;
  };
  const total = get('MemTotal');
  const available = get('MemAvailable') || get('MemFree') + get('Buffers') + get('Cached');
  const used = total - available;
  return {
    total,
    available,
    used,
    percent: total > 0 ? Math.round((used / total) * 1000) / 10 : 0
  };
}

async function getDisks(): Promise<DiskInfo[]> {
  if (isWindows()) return [];
  const res = await runCommand('df', ['-kP'], { timeout: 15000 });
  if (res.code !== 0) return [];
  const disks: DiskInfo[] = [];
  const lines = res.stdout.split('\n').filter(l => l.trim());
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].trim().split(/\s+/);
    if (parts.length < 6) continue;
    const size = parseInt(parts[1], 10) * 1024;
    const used = parseInt(parts[2], 10) * 1024;
    const available = parseInt(parts[3], 10) * 1024;
    const percent = parseInt(parts[4].replace('%', ''), 10);
    disks.push({
      filesystem: parts[0],
      size,
      used,
      available,
      percent: Number.isFinite(percent) ? percent : 0,
      mount: parts.slice(5).join(' ')
    });
  }
  return disks;
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const host = getHostInfo();
  const memory = isWindows()
    ? (() => {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        return {
          total,
          available: free,
          used,
          percent: total > 0 ? Math.round((used / total) * 1000) / 10 : 0
        };
      })()
    : getLinuxMemory();

  const loadAvg = isWindows() ? [] : (() => {
    const content = readProcFile('/proc/loadavg');
    return content
      .split(/\s+/)
      .slice(0, 3)
      .map(v => parseFloat(v))
      .filter(v => Number.isFinite(v));
  })();

  const cpuUsage = isWindows() ? getWindowsCpuUsage() : getLinuxCpuUsage();

  return {
    hostname: host.hostname,
    platform: host.platform,
    release: host.release,
    arch: host.arch,
    distro: host.distro,
    uptime: host.uptime,
    loadAvg,
    cpuUsage,
    cpuCount: os.cpus().length,
    memory,
    disks: await getDisks(),
    timestamp: new Date().toISOString()
  };
}

export async function getContainerStats(): Promise<ContainerStat[]> {
  const tools = await detectTools();
  if (!tools.docker.installed) return [];
  const res = await runCommand('docker', ['stats', '--no-stream', '--format', '{{json .}}'], { timeout: 60000 });
  if (res.code !== 0) return [];
  return res.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      try {
        const raw = JSON.parse(line);
        return {
          container: raw.Container || '',
          name: raw.Name || '',
          cpu_percent: raw.CPUPerc || '0%',
          mem_usage: raw.MemUsage || '',
          mem_percent: raw.MemPerc || '0%',
          net_io: raw.NetIO || '',
          block_io: raw.BlockIO || '',
          pids: raw.PIDs || '0'
        } as ContainerStat;
      } catch {
        return null;
      }
    })
    .filter((c): c is ContainerStat => c !== null);
}

export { getHostInfo, detectTools };