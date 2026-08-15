import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import fs from 'node:fs';

const execFileAsync = promisify(execFile);

export interface ToolVersion {
  installed: boolean;
  version?: string;
}

export interface ToolStatus {
  docker: ToolVersion;
  compose: ToolVersion;
  nginx: ToolVersion;
  caddy: ToolVersion;
  systemd: ToolVersion;
  isRoot: boolean;
  platform: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

const TOOLS_CACHE_TTL = 30000;
let toolsCache: { data: ToolStatus; at: number } | null = null;

export function isWindows(): boolean {
  return process.platform === 'win32';
}

export function isRootUser(): boolean {
  if (isWindows()) return false;
  return typeof process.getuid === 'function' && process.getuid() === 0;
}

export async function runCommand(
  bin: string,
  args: string[] = [],
  options: { timeout?: number; maxBuffer?: number; cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<CommandResult> {
  const { timeout = 60000, maxBuffer = 10 * 1024 * 1024, cwd, env } = options;
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      cwd,
      env,
      timeout,
      maxBuffer,
      windowsHide: true
    });
    return { stdout: stdout || '', stderr: stderr || '', code: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      code: typeof err.code === 'number' ? err.code : 1
    };
  }
}

export async function runCommandOrThrow(
  bin: string,
  args: string[] = [],
  options: { timeout?: number; maxBuffer?: number; cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<CommandResult> {
  const res = await runCommand(bin, args, options);
  if (res.code !== 0) {
    const detail = (res.stderr || res.stdout || '').trim();
    throw new Error(`Command failed (${bin} ${args.join(' ')}): ${detail || `exit code ${res.code}`}`);
  }
  return res;
}

// Runs a privileged command: directly when running as root, otherwise tries
// `sudo -n` (non-interactive) so the server admin does not get a password prompt.
export async function runPrivileged(
  args: string[],
  options: { timeout?: number; maxBuffer?: number; cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<CommandResult> {
  if (isWindows() || isRootUser()) {
    return runCommand(args[0], args.slice(1), options);
  }
  const res = await runCommand('sudo', ['-n', ...args], options);
  if (res.code !== 0) {
    const detail = (res.stderr || res.stdout || '').trim();
    return {
      stdout: res.stdout,
      stderr: `Requires root privileges. ${detail}`.trim(),
      code: res.code
    };
  }
  return res;
}

async function getToolVersion(bin: string, args: string[]): Promise<ToolVersion> {
  const res = await runCommand(bin, args, { timeout: 15000 });
  if (res.code !== 0) return { installed: false };
  const output = (res.stdout + res.stderr).trim();
  return { installed: true, version: output.split('\n')[0] || undefined };
}

export async function detectTools(force = false): Promise<ToolStatus> {
  if (!force && toolsCache && Date.now() - toolsCache.at < TOOLS_CACHE_TTL) {
    return toolsCache.data;
  }

  const [docker, compose, nginx, caddy, systemd] = await Promise.all([
    getToolVersion('docker', ['--version']),
    (async () => {
      const dockerCheck = await runCommand('docker', ['compose', 'version'], { timeout: 15000 });
      if (dockerCheck.code !== 0) return { installed: false } as ToolVersion;
      return { installed: true, version: (dockerCheck.stdout + dockerCheck.stderr).trim().split('\n')[0] } as ToolVersion;
    })(),
    getToolVersion('nginx', ['-v']),
    getToolVersion('caddy', ['version']),
    getToolVersion('systemctl', ['--version'])
  ]);

  const data: ToolStatus = {
    docker,
    compose,
    nginx,
    caddy,
    systemd,
    isRoot: isRootUser(),
    platform: process.platform
  };
  toolsCache = { data, at: Date.now() };
  return data;
}

export function invalidateToolsCache() {
  toolsCache = null;
}

export function readFileSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

export function getOsReleaseInfo(): { distro?: string; version?: string } {
  if (isWindows()) return {};
  const content = readFileSafe('/etc/os-release');
  const distro = content.match(/^PRETTY_NAME="?([^"\n]+)"?/m)?.[1];
  const version = content.match(/^VERSION="?([^"\n]+)"?/m)?.[1];
  return { distro, version };
}

export function getHostInfo() {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    uptime: os.uptime(),
    ...getOsReleaseInfo()
  };
}