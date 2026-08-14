import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getSettings, expandHome, getExecutionHomeDir } from './settings.service.js';

const execFileAsync = promisify(execFile);

export async function checkSshKeyStatus() {
  const settings = getSettings();
  const executionUser = settings.execution_user || 'nova';
  const { homeDir, userExists } = getExecutionHomeDir(executionUser);

  const keyPath = expandHome(settings.ssh_key_path, executionUser);
  const pubKeyPath = `${keyPath}.pub`;
  const knownHostsPath = expandHome(settings.known_hosts_path, executionUser);

  const privateKeyExists = fs.existsSync(keyPath);
  const publicKeyExists = fs.existsSync(pubKeyPath);
  const knownHostsExists = fs.existsSync(knownHostsPath);

  let publicKeyContent = '';
  if (publicKeyExists) {
    try {
      publicKeyContent = fs.readFileSync(pubKeyPath, 'utf8').trim();
    } catch {
      publicKeyContent = '';
    }
  }

  // Check if git executable is available
  let gitInstalled = false;
  let gitVersion = '';
  try {
    const { stdout } = await execFileAsync(settings.git_executable, ['--version']);
    gitInstalled = true;
    gitVersion = stdout.trim();
  } catch {
    gitInstalled = false;
    gitVersion = 'Git CLI not found';
  }

  return {
    gitInstalled,
    gitVersion,
    executionUser,
    executionUserHome: homeDir,
    userExistsOnSystem: userExists,
    keyPath,
    pubKeyPath,
    privateKeyExists,
    publicKeyExists,
    publicKeyContent,
    knownHostsPath,
    knownHostsExists
  };
}

export async function testGithubConnection() {
  const settings = getSettings();
  const executionUser = settings.execution_user || 'nova';
  const keyPath = expandHome(settings.ssh_key_path, executionUser);

  const status = await checkSshKeyStatus();

  if (!status.gitInstalled) {
    return {
      success: false,
      message: 'Git is not installed or not found in system PATH.',
      details: status.gitVersion,
      stepResults: {
        git: false,
        sshKey: status.privateKeyExists,
        connection: false
      }
    };
  }

  if (!status.privateKeyExists) {
    return {
      success: false,
      message: `SSH private key not found at path: ${keyPath}. Generate or configure an SSH key for execution user '${executionUser}'.`,
      details: 'Missing SSH key',
      stepResults: {
        git: true,
        sshKey: false,
        connection: false
      }
    };
  }

  // Try testing SSH connection to GitHub
  const env = {
    ...process.env,
    HOME: status.executionUserHome,
    USER: executionUser,
    LOGNAME: executionUser
  };

  try {
    const { stdout, stderr } = await execFileAsync('ssh', [
      '-T',
      '-i', keyPath,
      '-o', 'StrictHostKeyChecking=accept-new',
      '-o', 'ConnectTimeout=10',
      'git@github.com'
    ], { env });
    const combined = `${stdout}\n${stderr}`;
    
    // GitHub returns exit code 1 with message: "Hi username! You've successfully authenticated..."
    if (combined.includes('successfully authenticated') || combined.includes('You\'ve successfully authenticated')) {
      return {
        success: true,
        message: 'GitHub authentication successful!',
        details: combined.trim(),
        authenticatedUser: parseAuthenticatedUser(combined),
        stepResults: {
          git: true,
          sshKey: true,
          connection: true
        }
      };
    }

    return {
      success: false,
      message: 'GitHub connection test responded but user signature was not recognized.',
      details: combined.trim(),
      stepResults: {
        git: true,
        sshKey: true,
        connection: false
      }
    };
  } catch (err: any) {
    const output = `${err.stdout || ''}\n${err.stderr || ''}\n${err.message || ''}`.trim();

    if (output.includes('successfully authenticated') || output.includes('You\'ve successfully authenticated')) {
      return {
        success: true,
        message: 'GitHub authentication successful!',
        details: output,
        authenticatedUser: parseAuthenticatedUser(output),
        stepResults: {
          git: true,
          sshKey: true,
          connection: true
        }
      };
    }

    let errorSummary = 'GitHub connection failed.';
    if (output.includes('Permission denied (publickey)')) {
      errorSummary = 'Permission denied (publickey). Add this SSH public key to your GitHub account (Settings > SSH and GPG keys) so it applies to all repositories.';
    } else if (output.includes('Could not resolve hostname')) {
      errorSummary = 'Could not resolve github.com hostname. Check server DNS/internet connection.';
    }

    return {
      success: false,
      message: errorSummary,
      details: output,
      stepResults: {
        git: true,
        sshKey: true,
        connection: false
      }
    };
  }
}

export async function generateSshKey(options?: { force?: boolean }) {
  const settings = getSettings();
  const executionUser = settings.execution_user || 'nova';
  const keyPath = expandHome(settings.ssh_key_path, executionUser);
  const sshDir = path.dirname(keyPath);

  if (fs.existsSync(keyPath) && !options?.force) {
    throw new Error(`An existing SSH key was detected at ${keyPath}. Using existing key is recommended. Set force=true to replace.`);
  }

  if (!fs.existsSync(sshDir)) {
    fs.mkdirSync(sshDir, { recursive: true, mode: 0o700 });
  }

  if (fs.existsSync(keyPath) && options?.force) {
    fs.unlinkSync(keyPath);
    if (fs.existsSync(`${keyPath}.pub`)) {
      fs.unlinkSync(`${keyPath}.pub`);
    }
  }

  const comment = `${executionUser}@${os.hostname()}`;
  await execFileAsync('ssh-keygen', ['-t', 'ed25519', '-C', comment, '-f', keyPath, '-N', '']);
  
  // Set permissions
  try {
    fs.chmodSync(keyPath, 0o600);
    if (fs.existsSync(`${keyPath}.pub`)) {
      fs.chmodSync(`${keyPath}.pub`, 0o644);
    }
  } catch {
    // Ignore chmod errors on mounted filesystems
  }

  return checkSshKeyStatus();
}

function parseAuthenticatedUser(output: string): string | null {
  // GitHub SSH greeting: "Hi username! You've successfully authenticated..."
  const match = output.match(/Hi\s+([A-Za-z0-9._-]+)!/);
  return match ? match[1] : null;
}
