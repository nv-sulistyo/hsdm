import fs from 'node:fs';
import path from 'node:path';
import { runCommand, runCommandOrThrow, detectTools } from './system.service.js';
import { validateAllowedPath } from './settings.service.js';

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  command: string;
  created_at: string;
  state: string;
  status: string;
  ports: string;
  networks: string;
}

export interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  created_at: string;
  size: string;
}

export interface ComposePsEntry {
  name: string;
  service: string;
  status: string;
  ports: string;
}

export interface ComposeServiceInput {
  name: string;
  image: string;
  container_name?: string;
  ports?: string[];
  volumes?: string[];
  environment?: string[];
  restart?: string;
  depends_on?: string[];
  network?: string;
  command?: string;
}

const runningPulls = new Set<string>();
const runningCompose = new Set<string>();

function composeKey(dir: string, file: string) {
  return `${dir}|${file}`;
}

function assertDockerInstalled(tools?: { docker: { installed: boolean }; compose: { installed: boolean } }) {
  if (!tools) throw new Error('Docker is not installed on this server.');
  if (!tools.docker.installed) throw new Error('Docker is not installed on this server.');
}

function assertComposeInstalled(tools: { compose: { installed: boolean } }) {
  if (!tools.compose.installed) throw new Error('Docker Compose is not installed on this server.');
}

function resolveRepoDir(localPath: string): string {
  const check = validateAllowedPath(localPath);
  if (!check.valid) throw new Error(check.error);
  return check.resolvedPath;
}

export async function getDockerStatus() {
  const tools = await detectTools();
  return {
    docker: tools.docker,
    compose: tools.compose,
    installed: tools.docker.installed
  };
}

async function docker(args: string[], options: { timeout?: number; cwd?: string } = {}) {
  const res = await runCommand('docker', args, options);
  if (res.code !== 0) {
    throw new Error((res.stderr || res.stdout || '').trim() || `docker ${args.join(' ')} failed`);
  }
  return res;
}

export async function listContainers(all = true): Promise<DockerContainer[]> {
  const tools = await detectTools();
  assertDockerInstalled(tools);
  const args = all ? ['ps', '-a'] : ['ps'];
  const res = await docker([...args, '--format', '{{json .}}'], { timeout: 30000 });
  return res.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      try {
        const raw = JSON.parse(line);
        return {
          id: raw.ID || '',
          name: (raw.Names || '').replace(/^\//, ''),
          image: raw.Image || '',
          command: raw.Command || '',
          created_at: raw.CreatedAt || '',
          state: raw.State || '',
          status: raw.Status || '',
          ports: raw.Ports || '',
          networks: raw.Networks || ''
        } as DockerContainer;
      } catch {
        return null;
      }
    })
    .filter((c): c is DockerContainer => c !== null);
}

export async function getContainerLogs(id: string, tail = 200): Promise<string> {
  const tools = await detectTools();
  assertDockerInstalled(tools);
  const res = await docker(['logs', '--tail', String(tail), id], { timeout: 30000 });
  return (res.stdout + res.stderr).trim();
}

async function containerAction(action: 'start' | 'stop' | 'restart', id: string) {
  const tools = await detectTools();
  assertDockerInstalled(tools);
  await docker([action, id], { timeout: 60000 });
  return { message: `Container ${action} requested.`, id };
}

export const startContainer = (id: string) => containerAction('start', id);
export const stopContainer = (id: string) => containerAction('stop', id);
export const restartContainer = (id: string) => containerAction('restart', id);

export async function removeContainer(id: string, force = false) {
  const tools = await detectTools();
  assertDockerInstalled(tools);
  const args = ['rm', ...(force ? ['-f'] : []), id];
  await docker(args, { timeout: 60000 });
  return { message: `Container ${id} removed.` };
}

export async function listImages(): Promise<DockerImage[]> {
  const tools = await detectTools();
  assertDockerInstalled(tools);
  const res = await docker(['images', '--format', '{{json .}}'], { timeout: 30000 });
  return res.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      try {
        const raw = JSON.parse(line);
        return {
          id: raw.ID || '',
          repository: raw.Repository || '',
          tag: raw.Tag || '',
          created_at: raw.CreatedAt || '',
          size: raw.Size || ''
        } as DockerImage;
      } catch {
        return null;
      }
    })
    .filter((i): i is DockerImage => i !== null);
}

export async function pullImage(image: string) {
  if (!image || !image.trim()) throw new Error('Image name is required.');
  if (runningPulls.has(image)) throw new Error(`Image ${image} is already being pulled.`);
  const tools = await detectTools();
  assertDockerInstalled(tools);
  runningPulls.add(image);
  try {
    const res = await runCommandOrThrow('docker', ['pull', image.trim()], { timeout: 600000 });
    return { message: `Image ${image} pulled successfully.`, output: res.stdout || res.stderr };
  } finally {
    runningPulls.delete(image);
  }
}

export async function removeImage(id: string, force = false) {
  const tools = await detectTools();
  assertDockerInstalled(tools);
  const args = ['rmi', ...(force ? ['-f'] : []), id];
  await docker(args, { timeout: 60000 });
  return { message: `Image ${id} removed.` };
}

// ---------- Docker Compose ----------

function composeArgs(file: string, rest: string[]) {
  return ['compose', '-f', file, ...rest];
}

export async function composePs(localPath: string, file = 'docker-compose.yml'): Promise<ComposePsEntry[]> {
  const tools = await detectTools();
  assertDockerInstalled(tools);
  assertComposeInstalled(tools);
  const dir = resolveRepoDir(localPath);
  const res = await docker(composeArgs(file, ['ps', '--format', '{{.Name}}\t{{.Service}}\t{{.Status}}\t{{.Ports}}']), {
    timeout: 30000,
    cwd: dir
  });
  return res.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [name, service, status, ...ports] = line.split('\t');
      return { name: name || '', service: service || '', status: status || '', ports: ports.join('\t') };
    });
}

export async function composeUp(localPath: string, file = 'docker-compose.yml', build = true, services: string[] = []) {
  const tools = await detectTools();
  assertDockerInstalled(tools);
  assertComposeInstalled(tools);
  const dir = resolveRepoDir(localPath);
  const key = composeKey(dir, file);
  if (runningCompose.has(key)) throw new Error('A compose operation is already running for this project.');
  runningCompose.add(key);
  try {
    const args = composeArgs(file, ['up', '-d', ...(build ? ['--build'] : []), ...services]);
    const res = await runCommandOrThrow('docker', args, { timeout: 600000, cwd: dir });
    return { message: 'Compose stack started.', output: res.stdout || res.stderr };
  } finally {
    runningCompose.delete(key);
  }
}

export async function composeBuild(localPath: string, file = 'docker-compose.yml', services: string[] = []) {
  const tools = await detectTools();
  assertDockerInstalled(tools);
  assertComposeInstalled(tools);
  const dir = resolveRepoDir(localPath);
  const key = composeKey(dir, file);
  if (runningCompose.has(key)) throw new Error('A compose operation is already running for this project.');
  runningCompose.add(key);
  try {
    const args = composeArgs(file, ['build', ...services]);
    const res = await runCommandOrThrow('docker', args, { timeout: 600000, cwd: dir });
    return { message: 'Compose images built.', output: res.stdout || res.stderr };
  } finally {
    runningCompose.delete(key);
  }
}

export async function composeDown(localPath: string, file = 'docker-compose.yml') {
  const tools = await detectTools();
  assertDockerInstalled(tools);
  assertComposeInstalled(tools);
  const dir = resolveRepoDir(localPath);
  const key = composeKey(dir, file);
  if (runningCompose.has(key)) throw new Error('A compose operation is already running for this project.');
  runningCompose.add(key);
  try {
    const args = composeArgs(file, ['down']);
    const res = await runCommandOrThrow('docker', args, { timeout: 300000, cwd: dir });
    return { message: 'Compose stack stopped.', output: res.stdout || res.stderr };
  } finally {
    runningCompose.delete(key);
  }
}

export function getComposeContent(localPath: string, file = 'docker-compose.yml'): string {
  const dir = resolveRepoDir(localPath);
  const full = path.join(dir, file);
  if (!fs.existsSync(full)) return '';
  return fs.readFileSync(full, 'utf8');
}

export async function saveComposeContent(localPath: string, file = 'docker-compose.yml', content: string): Promise<{ message: string }> {
  const tools = await detectTools();
  assertDockerInstalled(tools);
  assertComposeInstalled(tools);
  const dir = resolveRepoDir(localPath);
  const full = path.join(dir, file);
  const tmp = path.join(dir, `.${file}.hsdm-tmp`);

  fs.writeFileSync(tmp, content, 'utf8');
  try {
    const res = await runCommand('docker', composeArgs(file, ['config', '-q']), { timeout: 60000, cwd: dir });
    if (res.code !== 0) {
      throw new Error(`Invalid compose file: ${(res.stderr || res.stdout || '').trim() || 'docker compose config failed'}`);
    }
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }

  const backup = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
  fs.writeFileSync(full, content, 'utf8');
  try {
    const res = await runCommand('docker', composeArgs(file, ['config', '-q']), { timeout: 60000, cwd: dir });
    if (res.code !== 0) {
      if (backup !== null) fs.writeFileSync(full, backup, 'utf8');
      throw new Error(`Invalid compose file: ${(res.stderr || res.stdout || '').trim() || 'docker compose config failed'}`);
    }
  } catch (err) {
    if (backup !== null) fs.writeFileSync(full, backup, 'utf8');
    throw err;
  }

  return { message: `Compose file ${file} saved and validated.` };
}

export function getComposeServiceNames(localPath: string, file = 'docker-compose.yml'): string[] {
  const content = getComposeContent(localPath, file);
  if (!content.trim()) return [];
  const names: string[] = [];
  const lines = content.split('\n');
  let inServices = false;
  let servicesIndent = -1;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    if (!inServices) {
      if (line.trim() === 'services:') {
        inServices = true;
        servicesIndent = indent;
      }
      continue;
    }
    if (indent <= servicesIndent) break;
    if (indent === servicesIndent + 2 && /^[A-Za-z0-9._-]+:\s*$/.test(line.trim())) {
      names.push(line.trim().replace(/:$/, ''));
    }
  }
  return names;
}

export function buildServiceBlock(input: ComposeServiceInput, indent: number): string {
  const pad = ' '.repeat(indent);
  const child = ' '.repeat(indent + 2);
  const lines: string[] = [`${pad}${input.name}:`];
  if (input.image) lines.push(`${child}image: ${input.image}`);
  if (input.container_name) lines.push(`${child}container_name: ${input.container_name}`);
  if (input.command) lines.push(`${child}command: ${JSON.stringify(input.command)}`);
  if (input.restart) lines.push(`${child}restart: ${input.restart}`);
  if (input.network) lines.push(`${child}networks:\n${child}  - ${input.network}`);
  if (input.ports && input.ports.length > 0) {
    lines.push(`${child}ports:`);
    for (const p of input.ports) lines.push(`${child}  - "${p}"`);
  }
  if (input.volumes && input.volumes.length > 0) {
    lines.push(`${child}volumes:`);
    for (const v of input.volumes) lines.push(`${child}  - ${v}`);
  }
  if (input.environment && input.environment.length > 0) {
    lines.push(`${child}environment:`);
    for (const e of input.environment) lines.push(`${child}  - ${e}`);
  }
  if (input.depends_on && input.depends_on.length > 0) {
    lines.push(`${child}depends_on:`);
    for (const d of input.depends_on) lines.push(`${child}  - ${d}`);
  }
  return lines.join('\n');
}

export function insertServiceIntoContent(content: string, block: string): string {
  const lines = content.split('\n');
  let servicesIdx = -1;
  let servicesIndent = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (line.trim() === 'services:') {
      servicesIdx = i;
      servicesIndent = line.length - line.trimStart().length;
      break;
    }
  }

  if (servicesIdx === -1) {
    return `${content.trimEnd()}\n\nservices:\n${block}\n`;
  }

  let insertAt = lines.length;
  for (let i = servicesIdx + 1; i < lines.length; i++) {
    const line = lines[i].replace(/\s+$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    if (indent <= servicesIndent) {
      insertAt = i;
      break;
    }
  }

  const needsBlank = insertAt > 0 && lines[insertAt - 1].trim() !== '';
  const insertLines = needsBlank ? ['', ...block.split('\n')] : block.split('\n');
  lines.splice(insertAt, 0, ...insertLines);
  return lines.join('\n');
}

export async function addComposeService(
  localPath: string,
  file: string,
  input: ComposeServiceInput
): Promise<{ message: string; services: string[] }> {
  if (!input.name || !input.name.trim()) throw new Error('Service name is required.');
  if (!input.image || !input.image.trim()) throw new Error('Image is required.');
  if (!/^[A-Za-z0-9._-]+$/.test(input.name)) {
    throw new Error('Service name may only contain letters, numbers, dots, underscores and dashes.');
  }

  const existing = getComposeContent(localPath, file);
  const currentServices = getComposeServiceNames(localPath, file);
  if (currentServices.includes(input.name.trim())) {
    throw new Error(`Service "${input.name}" already exists in ${file}.`);
  }

  let indent = 2;
  if (existing.trim()) {
    const lines = existing.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/\s+$/, '');
      if (!line.trim() || line.trim().startsWith('#')) continue;
      if (line.trim() === 'services:') {
        const servicesIndent = line.length - line.trimStart().length;
        for (let j = i + 1; j < lines.length; j++) {
          const l = lines[j].replace(/\s+$/, '');
          if (!l.trim() || l.trim().startsWith('#')) continue;
          const ind = l.length - l.trimStart().length;
          if (ind <= servicesIndent) break;
          if (/^[A-Za-z0-9._-]+:/.test(l.trim())) {
            indent = ind;
            break;
          }
        }
        break;
      }
    }
  }

  const block = buildServiceBlock({ ...input, name: input.name.trim() }, indent);
  const updated = insertServiceIntoContent(existing, block);
  await saveComposeContent(localPath, file, updated);
  return { message: `Service "${input.name}" added to ${file}.`, services: getComposeServiceNames(localPath, file) };
}