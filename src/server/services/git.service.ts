import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { db } from '../db.js';
import { getSettings, validateAllowedPath, expandHome, getExecutionHomeDir } from './settings.service.js';
import { RepoStatus, GitStatusDetails, BranchInfo, CommitLogItem, DirectoryInspection } from '../../types.js';

const execFileAsync = promisify(execFile);

function getGitEnv(): Record<string, string> {
  const settings = getSettings();
  const executionUser = settings.execution_user || 'nova';
  const { homeDir } = getExecutionHomeDir(executionUser);

  const keyPath = expandHome(settings.ssh_key_path, executionUser);
  const knownHostsPath = expandHome(settings.known_hosts_path, executionUser);

  const env: Record<string, string | undefined> = {
    ...process.env,
    HOME: homeDir,
    USER: executionUser,
    LOGNAME: executionUser
  };

  if (fs.existsSync(keyPath)) {
    let sshCmd = `ssh -i "${keyPath}" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10`;
    if (fs.existsSync(knownHostsPath)) {
      sshCmd += ` -o UserKnownHostsFile="${knownHostsPath}"`;
    }
    env.GIT_SSH_COMMAND = sshCmd;
  }
  return env;
}

/**
 * Inspect a filesystem path for repository mode decisions (CLONE vs CONNECT)
 * and detailed permission/accessibility diagnostics.
 */
export async function inspectDirectory(localPath: string, expectedGitUrl?: string): Promise<DirectoryInspection> {
  const settings = getSettings();
  const executionUser = settings.execution_user || 'nova';

  const pathValidation = validateAllowedPath(localPath);
  if (!pathValidation.valid) {
    return {
      path: localPath,
      allowed: false,
      pathError: pathValidation.error,
      exists: false,
      parentExists: false,
      writable: false,
      isGitRepo: false
    };
  }

  const resolved = pathValidation.resolvedPath;
  const exists = fs.existsSync(resolved);
  const parentDir = path.dirname(resolved);
  const parentExists = fs.existsSync(parentDir);

  // Check write access
  let writable = false;
  let accessError: string | undefined;

  try {
    if (exists) {
      fs.accessSync(resolved, fs.constants.R_OK | fs.constants.W_OK);
      writable = true;
    } else if (parentExists) {
      fs.accessSync(parentDir, fs.constants.R_OK | fs.constants.W_OK);
      writable = true;
    } else {
      writable = false;
      accessError = `Parent directory '${parentDir}' does not exist.`;
    }
  } catch (err: any) {
    writable = false;
    accessError = `'${executionUser}' user does not have write permissions to ${exists ? resolved : parentDir}. Suggested action: Set ownership or chmod permissions for user '${executionUser}'.`;
  }

  // Check if registered in DB
  let alreadyRegistered = false;
  let registeredRepoName: string | undefined;
  const existingDbRepo = db.prepare('SELECT name FROM repositories WHERE local_path = ?').get(resolved) as { name: string } | undefined;
  if (existingDbRepo) {
    alreadyRegistered = true;
    registeredRepoName = existingDbRepo.name;
  }

  // Check if Git repo
  let isGitRepo = false;
  let currentBranch: string | undefined;
  let remoteOrigin: string | undefined;
  let remoteMatches: boolean | undefined;
  let isDirty: boolean | undefined;

  if (exists && fs.existsSync(path.join(resolved, '.git'))) {
    try {
      await runGit(['rev-parse', '--is-inside-work-tree'], resolved);
      isGitRepo = true;

      // Get branch
      try {
        const { stdout } = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], resolved);
        currentBranch = stdout.trim();
      } catch {}

      // Get remote
      try {
        const { stdout } = await runGit(['remote', 'get-url', 'origin'], resolved);
        remoteOrigin = stdout.trim();
        if (expectedGitUrl) {
          const cleanExpected = expectedGitUrl.trim().replace(/\.git$/, '');
          const cleanRemote = remoteOrigin.replace(/\.git$/, '');
          remoteMatches = cleanRemote.toLowerCase() === cleanExpected.toLowerCase();
        }
      } catch {}

      // Get dirty status
      try {
        const { stdout } = await runGit(['status', '--porcelain'], resolved);
        isDirty = stdout.trim().length > 0;
      } catch {}

    } catch {
      isGitRepo = false;
    }
  }

  return {
    path: resolved,
    allowed: true,
    exists,
    parentExists,
    writable,
    accessError,
    isGitRepo,
    currentBranch,
    remoteOrigin,
    remoteMatches,
    isDirty,
    alreadyRegistered,
    registeredRepoName
  };
}

/**
 * Execute Git CLI command safely using argument array (prevents shell injection).
 */
export async function runGit(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string }> {
  const settings = getSettings();
  const env = getGitEnv();

  const options: any = {
    env,
    maxBuffer: 10 * 1024 * 1024 // 10MB buffer
  };

  if (cwd) {
    if (!fs.existsSync(cwd)) {
      throw new Error(`Directory '${cwd}' does not exist.`);
    }
    options.cwd = cwd;
  }

  try {
    const { stdout, stderr } = await execFileAsync(settings.git_executable, args, options);
    return { stdout: stdout.toString(), stderr: stderr.toString() };
  } catch (err: any) {
    const combinedError = `${err.stdout || ''}\n${err.stderr || ''}\n${err.message || ''}`.trim();
    throw new Error(`Git error (${args.join(' ')}): ${combinedError}`);
  }
}

/**
 * Check health, commit details, dirty state, and remote synchronization status of a repository.
 */
export async function checkRepoStatus(localPath: string, targetBranch = 'main'): Promise<GitStatusDetails> {
  const pathValidation = validateAllowedPath(localPath);
  if (!pathValidation.valid) {
    return {
      status: 'ERROR',
      isGitRepo: false,
      currentBranch: '',
      ahead: 0,
      behind: 0,
      isDirty: false,
      dirtyFilesCount: 0,
      dirtyFiles: [],
      lastCommitHash: '',
      lastCommitMessage: pathValidation.error || 'Path not allowed',
      lastCommitAuthor: '',
      lastCommitDate: ''
    };
  }

  const resolved = pathValidation.resolvedPath;

  if (!fs.existsSync(resolved)) {
    return {
      status: 'NOT_A_REPOSITORY',
      isGitRepo: false,
      currentBranch: '',
      ahead: 0,
      behind: 0,
      isDirty: false,
      dirtyFilesCount: 0,
      dirtyFiles: [],
      lastCommitHash: '',
      lastCommitMessage: 'Directory does not exist yet',
      lastCommitAuthor: '',
      lastCommitDate: ''
    };
  }

  // Check if inside git work tree
  try {
    await runGit(['rev-parse', '--is-inside-work-tree'], resolved);
  } catch {
    return {
      status: 'NOT_A_REPOSITORY',
      isGitRepo: false,
      currentBranch: '',
      ahead: 0,
      behind: 0,
      isDirty: false,
      dirtyFilesCount: 0,
      dirtyFiles: [],
      lastCommitHash: '',
      lastCommitMessage: 'Directory exists but is not a Git repository',
      lastCommitAuthor: '',
      lastCommitDate: ''
    };
  }

  // Get current branch name
  let currentBranch = targetBranch;
  try {
    const { stdout } = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], resolved);
    currentBranch = stdout.trim() || targetBranch;
  } catch {
    // ignore
  }

  // Check dirty status (uncommitted local changes)
  let isDirty = false;
  let dirtyFiles: string[] = [];
  try {
    const { stdout } = await runGit(['status', '--porcelain'], resolved);
    const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      isDirty = true;
      dirtyFiles = lines.map(l => l.slice(3).trim()).slice(0, 10);
    }
  } catch {
    // ignore
  }

  // Get last commit info
  let lastCommitHash = '';
  let lastCommitMessage = '';
  let lastCommitAuthor = '';
  let lastCommitDate = '';
  try {
    const { stdout } = await runGit(['log', '-1', '--pretty=format:%H|%s|%an|%ad', '--date=iso'], resolved);
    const parts = stdout.split('|');
    if (parts.length >= 4) {
      lastCommitHash = parts[0];
      lastCommitMessage = parts[1];
      lastCommitAuthor = parts[2];
      lastCommitDate = parts[3];
    }
  } catch {
    // ignore
  }

  // Fetch remote to check sync status
  let unreachable = false;
  try {
    await runGit(['fetch', 'origin', currentBranch], resolved);
  } catch {
    unreachable = true;
  }

  if (unreachable) {
    return {
      status: isDirty ? 'DIRTY' : 'UNREACHABLE',
      isGitRepo: true,
      currentBranch,
      ahead: 0,
      behind: 0,
      isDirty,
      dirtyFilesCount: dirtyFiles.length,
      dirtyFiles,
      lastCommitHash,
      lastCommitMessage,
      lastCommitAuthor,
      lastCommitDate
    };
  }

  // Compare local HEAD vs origin/<branch>
  let ahead = 0;
  let behind = 0;
  try {
    const { stdout } = await runGit(['rev-list', '--left-right', '--count', `HEAD...origin/${currentBranch}`], resolved);
    const counts = stdout.trim().split(/\s+/);
    if (counts.length === 2) {
      ahead = parseInt(counts[0], 10) || 0;
      behind = parseInt(counts[1], 10) || 0;
    }
  } catch {
    // ignore
  }

  let calculatedStatus: RepoStatus = 'SYNCED';
  if (isDirty) {
    calculatedStatus = 'DIRTY';
  } else if (ahead > 0 && behind > 0) {
    calculatedStatus = 'DIVERGED';
  } else if (behind > 0) {
    calculatedStatus = 'BEHIND';
  } else if (ahead > 0) {
    calculatedStatus = 'AHEAD';
  } else {
    calculatedStatus = 'SYNCED';
  }

  return {
    status: calculatedStatus,
    isGitRepo: true,
    currentBranch,
    ahead,
    behind,
    isDirty,
    dirtyFilesCount: dirtyFiles.length,
    dirtyFiles,
    lastCommitHash,
    lastCommitMessage,
    lastCommitAuthor,
    lastCommitDate
  };
}

/**
 * Clone a repository if directory doesn't exist or is empty.
 */
export async function cloneRepository(gitUrl: string, branch: string, localPath: string): Promise<{ stdout: string }> {
  const pathValidation = validateAllowedPath(localPath);
  if (!pathValidation.valid) {
    throw new Error(pathValidation.error);
  }

  const resolved = pathValidation.resolvedPath;

  // Ensure parent directory exists
  const parentDir = path.dirname(resolved);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  // If local directory already exists and is a git repository, don't clone over it!
  if (fs.existsSync(resolved)) {
    if (fs.existsSync(path.join(resolved, '.git'))) {
      // Already a git repo, verify remote
      const { stdout } = await runGit(['remote', '-v'], resolved);
      return { stdout: `Directory '${resolved}' is already a Git repository.\nRemotes:\n${stdout}` };
    } else {
      // Check if directory is non-empty
      const files = fs.readdirSync(resolved);
      if (files.length > 0) {
        throw new Error(`Directory '${resolved}' exists and is not empty. Cannot clone into a non-empty directory.`);
      }
    }
  }

  // Run clone
  const { stdout, stderr } = await runGit(['clone', '-b', branch, gitUrl, resolved]);
  return { stdout: `${stdout}\n${stderr}`.trim() };
}

/**
 * Fetch remote updates.
 */
export async function fetchRepository(localPath: string): Promise<{ stdout: string }> {
  const pathValidation = validateAllowedPath(localPath);
  if (!pathValidation.valid) {
    throw new Error(pathValidation.error);
  }

  const { stdout, stderr } = await runGit(['fetch', 'origin'], pathValidation.resolvedPath);
  return { stdout: `${stdout}\n${stderr}`.trim() };
}

/**
 * Convert an existing (non-git) directory into a managed repository:
 * git init + remote add origin + fetch + branch rename, then either
 * sync the working tree with origin/<branch> (if the remote already has commits)
 * or create the first commit and push (if the remote is empty).
 */
export async function initializeGitRepository(options: {
  gitUrl: string;
  branch: string;
  localPath: string;
  gitUser?: string;
  gitEmail?: string;
  commitMessage?: string;
}): Promise<{ message: string; createdInitialCommit: boolean }> {
  const pathValidation = validateAllowedPath(options.localPath);
  if (!pathValidation.valid) {
    throw new Error(pathValidation.error);
  }

  const resolved = pathValidation.resolvedPath;
  if (!fs.existsSync(resolved)) {
    throw new Error(`Directory '${resolved}' does not exist.`);
  }
  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error(`'${resolved}' is not a directory.`);
  }

  // Initialize if needed (idempotent so a retry after REMOTE_EMPTY works)
  if (!fs.existsSync(path.join(resolved, '.git'))) {
    await runGit(['init'], resolved);
  }
  try {
    await runGit(['remote', 'get-url', 'origin'], resolved);
  } catch {
    await runGit(['remote', 'add', 'origin', options.gitUrl], resolved);
  }

  // Contact the remote; fails loudly on unreachable/SSH issues
  await runGit(['fetch', 'origin'], resolved);

  // Normalize branch name to the repository's configured branch
  await runGit(['branch', '-M', options.branch], resolved);

  // Does the remote already have this branch?
  let originBranchExists = false;
  try {
    await runGit(['rev-parse', '--verify', '--quiet', `origin/${options.branch}`], resolved);
    originBranchExists = true;
  } catch {
    // branch not on remote yet
  }

  if (originBranchExists) {
    // Sync the working tree with the remote (tracked files only; untracked files are kept)
    await runGit(['reset', '--hard', `origin/${options.branch}`], resolved);
    try {
      await runGit(['branch', '--set-upstream-to', `origin/${options.branch}`, options.branch], resolved);
    } catch {
      // already tracked
    }
    return {
      message: `Git initialized. Working tree synced with origin/${options.branch}.`,
      createdInitialCommit: false
    };
  }

  // Remote branch does not exist (empty remote) — create the first commit and push
  const gitUser = (options.gitUser || '').trim();
  const gitEmail = (options.gitEmail || '').trim();
  const commitMessage = (options.commitMessage || '').trim();
  if (!gitUser || !gitEmail || !commitMessage) {
    throw new Error(
      'REMOTE_EMPTY: Remote repository has no commits yet. Provide a Git name, email and commit message to create the initial commit and push.'
    );
  }

  await runGit(['add', '-A'], resolved);
  await runGit(['-c', `user.name=${gitUser}`, '-c', `user.email=${gitEmail}`, 'commit', '-m', commitMessage], resolved);
  await runGit(['push', '-u', 'origin', options.branch], resolved);

  return {
    message: `Initial commit created and pushed to origin/${options.branch}.`,
    createdInitialCommit: true
  };
}

/**
 * Pull remote changes into working tree.
 */
export async function pullRepository(
  localPath: string,
  branch = 'main',
  force = false
): Promise<{ stdout: string; commitBefore: string; commitAfter: string }> {
  const pathValidation = validateAllowedPath(localPath);
  if (!pathValidation.valid) {
    throw new Error(pathValidation.error);
  }

  const resolved = pathValidation.resolvedPath;

  // Check dirty status
  const { stdout: dirtyOut } = await runGit(['status', '--porcelain'], resolved);
  const isDirty = dirtyOut.trim().length > 0;

  if (isDirty && !force) {
    throw new Error(
      'LOCAL_CHANGES_DETECTED: Working tree has uncommitted local changes. Operation canceled to prevent overwriting local files.'
    );
  }

  // Record commit before
  let commitBefore = '';
  try {
    const { stdout } = await runGit(['rev-parse', 'HEAD'], resolved);
    commitBefore = stdout.trim();
  } catch {
    commitBefore = 'unknown';
  }

  let outputLog = '';

  if (force && isDirty) {
    // If force pull requested by admin, fetch first then reset hard to remote branch
    await runGit(['fetch', 'origin', branch], resolved);
    const { stdout: resetOut } = await runGit(['reset', '--hard', `origin/${branch}`], resolved);
    outputLog += `[FORCE RESET] ${resetOut}\n`;
  }

  // Perform git pull
  const { stdout, stderr } = await runGit(['pull', 'origin', branch], resolved);
  outputLog += `${stdout}\n${stderr}`.trim();

  // Record commit after
  let commitAfter = '';
  try {
    const { stdout } = await runGit(['rev-parse', 'HEAD'], resolved);
    commitAfter = stdout.trim();
  } catch {
    commitAfter = 'unknown';
  }

  return {
    stdout: outputLog,
    commitBefore,
    commitAfter
  };
}

/**
 * List branches for a repository.
 */
export async function getBranches(localPath: string): Promise<BranchInfo[]> {
  const pathValidation = validateAllowedPath(localPath);
  if (!pathValidation.valid) {
    return [];
  }

  const resolved = pathValidation.resolvedPath;
  if (!fs.existsSync(resolved) || !fs.existsSync(path.join(resolved, '.git'))) {
    return [];
  }

  try {
    const { stdout } = await runGit(['branch', '-a'], resolved);
    const lines = stdout.split('\n').filter(Boolean);
    const branches: BranchInfo[] = [];

    for (const line of lines) {
      const isCurrent = line.startsWith('*');
      const cleanName = line.replace('*', '').trim();
      const isRemote = cleanName.startsWith('remotes/');

      branches.push({
        name: cleanName,
        isCurrent,
        isRemote
      });
    }

    return branches;
  } catch {
    return [];
  }
}

/**
 * Get commit logs for a repository.
 */
export async function getCommitLogs(localPath: string, limit = 20): Promise<CommitLogItem[]> {
  const pathValidation = validateAllowedPath(localPath);
  if (!pathValidation.valid) {
    return [];
  }

  const resolved = pathValidation.resolvedPath;
  if (!fs.existsSync(resolved) || !fs.existsSync(path.join(resolved, '.git'))) {
    return [];
  }

  try {
    const { stdout } = await runGit(
      ['log', `-n${limit}`, '--pretty=format:%H|%an|%ae|%ad|%s', '--date=relative'],
      resolved
    );

    const lines = stdout.split('\n').filter(Boolean);
    return lines.map(line => {
      const [hash, author, email, date, ...msgParts] = line.split('|');
      return {
        hash,
        author,
        email,
        date,
        message: msgParts.join('|')
      };
    });
  } catch {
    return [];
  }
}
