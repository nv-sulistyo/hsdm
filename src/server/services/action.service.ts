import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { db } from '../db.js';
import { validateAllowedPath, getExecutionHomeDir } from './settings.service.js';
import { logAudit } from './audit.service.js';
import { ActionTemplate, ActionRun } from '../../types.js';

const execAsync = promisify(exec);

// In-memory set of repository IDs with a running action to prevent concurrent runs
const runningActions = new Set<number>();

const MAX_OUTPUT_CHARS = 200000;

function parseCommands(commands: string | string[]): string[] {
  const arr = Array.isArray(commands) ? commands : (commands || '').split('\n');
  return arr.map((c: string) => c.trim()).filter(Boolean);
}

function capOutput(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return `[OUTPUT TRUNCATED - original size ${text.length} chars, keeping last ${MAX_OUTPUT_CHARS}]\n\n` + text.slice(-MAX_OUTPUT_CHARS);
}

function mapTemplateRow(row: any): ActionTemplate {
  return {
    ...row,
    is_builtin: Boolean(row.is_builtin),
    commands: JSON.parse(row.commands || '[]') as string[]
  };
}

export function getActionTemplates(): ActionTemplate[] {
  const rows = db.prepare('SELECT * FROM action_templates ORDER BY is_builtin DESC, id ASC').all() as any[];
  return rows.map(mapTemplateRow);
}

export function getActionTemplateById(id: number): ActionTemplate | undefined {
  const row = db.prepare('SELECT * FROM action_templates WHERE id = ?').get(id) as any;
  if (!row) return undefined;
  return mapTemplateRow(row);
}

export function createActionTemplate(input: {
  name: string;
  tech_stack?: string;
  description?: string;
  commands: string[] | string;
}): ActionTemplate {
  const name = (input.name || '').trim();
  if (!name) {
    throw new Error('Template name is required.');
  }
  const commands = parseCommands(input.commands);
  if (commands.length === 0) {
    throw new Error('At least one command is required.');
  }

  const existing = db.prepare('SELECT id FROM action_templates WHERE name = ?').get(name);
  if (existing) {
    throw new Error(`Template '${name}' already exists.`);
  }

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO action_templates (name, tech_stack, description, commands, is_builtin, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(
    name,
    (input.tech_stack || 'General').trim(),
    input.description?.trim() || null,
    JSON.stringify(commands),
    now,
    now
  );

  const row = db.prepare('SELECT * FROM action_templates WHERE id = last_insert_rowid()').get() as any;
  return mapTemplateRow(row);
}

export function updateActionTemplate(
  id: number,
  input: {
    name?: string;
    tech_stack?: string;
    description?: string;
    commands?: string[] | string;
  }
): ActionTemplate {
  const row = db.prepare('SELECT * FROM action_templates WHERE id = ?').get(id) as any;
  if (!row) {
    throw new Error(`Action template with ID ${id} not found.`);
  }

  const name = (input.name !== undefined ? input.name : row.name).trim();
  if (!name) {
    throw new Error('Template name is required.');
  }

  const commands = input.commands !== undefined ? parseCommands(input.commands) : parseCommands(row.commands);
  if (commands.length === 0) {
    throw new Error('At least one command is required.');
  }

  const conflict = db.prepare('SELECT id FROM action_templates WHERE name = ? AND id != ?').get(name, id);
  if (conflict) {
    throw new Error(`Template '${name}' already exists.`);
  }

  db.prepare(`
    UPDATE action_templates
    SET name = ?, tech_stack = ?, description = ?, commands = ?, updated_at = ?
    WHERE id = ?
  `).run(
    name,
    (input.tech_stack !== undefined ? input.tech_stack : row.tech_stack || 'General').trim(),
    input.description !== undefined ? input.description.trim() || null : row.description,
    JSON.stringify(commands),
    new Date().toISOString(),
    id
  );

  const updated = db.prepare('SELECT * FROM action_templates WHERE id = ?').get(id) as any;
  return mapTemplateRow(updated);
}

export function deleteActionTemplate(id: number): void {
  const row = db.prepare('SELECT * FROM action_templates WHERE id = ?').get(id) as any;
  if (!row) {
    throw new Error(`Action template with ID ${id} not found.`);
  }
  db.prepare('DELETE FROM action_templates WHERE id = ?').run(id);
}

export function runAction(options: {
  repositoryId: number;
  templateId?: number;
  commands?: string[] | string;
  timeoutSeconds?: number;
  userId?: number;
  username?: string;
  ipAddress?: string;
}): ActionRun {
  const { repositoryId, templateId, commands, timeoutSeconds = 1800, userId, username, ipAddress } = options;

  if (runningActions.has(repositoryId)) {
    throw new Error('An action is already running for this repository.');
  }

  const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(repositoryId) as any;
  if (!repo) {
    throw new Error(`Repository with ID ${repositoryId} not found.`);
  }

  let template: any = null;
  if (templateId) {
    template = db.prepare('SELECT * FROM action_templates WHERE id = ?').get(templateId);
    if (!template) {
      throw new Error(`Action template with ID ${templateId} not found.`);
    }
  }

  const cmdList = template ? parseCommands(template.commands) : parseCommands(commands || []);
  if (cmdList.length === 0) {
    throw new Error('No commands to execute.');
  }

  const timeoutMs = Math.min(Math.max(timeoutSeconds, 30), 3600) * 1000;

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO action_runs (repository_id, template_id, template_name, command, status, started_at, created_at)
    VALUES (?, ?, ?, ?, 'RUNNING', ?, ?)
  `).run(repositoryId, templateId || null, template?.name || 'Custom command', cmdList.join('\n'), now, now);
  const runId = Number(insert.lastInsertRowid);

  runningActions.add(repositoryId);

  (async () => {
    let fullLog = `[ACTION START] ${new Date().toISOString()}\n`;
    fullLog += `Repository: ${repo.name} (${repo.local_path})\n`;
    fullLog += `Execution user: ${repo.execution_user || 'nova'}\n`;
    fullLog += `Template: ${template?.name || 'Custom command'}\n\n`;

    let finalStatus: 'SUCCESS' | 'FAILED' = 'SUCCESS';
    let errorMessage = '';
    let exitCode: number | null = 0;

    try {
      const pathVal = validateAllowedPath(repo.local_path);
      if (!pathVal.valid) {
        throw new Error(pathVal.error);
      }

      const { homeDir } = getExecutionHomeDir(repo.execution_user || 'nova');
      const execEnv = {
        ...process.env,
        HOME: homeDir,
        USER: repo.execution_user,
        LOGNAME: repo.execution_user
      };

      for (const cmd of cmdList) {
        fullLog += `$ ${cmd}\n`;
        try {
          const { stdout, stderr } = await execAsync(cmd, {
            cwd: pathVal.resolvedPath,
            env: execEnv,
            maxBuffer: 10 * 1024 * 1024,
            timeout: timeoutMs
          });
          if (stdout) fullLog += stdout.endsWith('\n') ? stdout : `${stdout}\n`;
          if (stderr) fullLog += stderr.endsWith('\n') ? stderr : `${stderr}\n`;
        } catch (cmdErr: any) {
          fullLog += `[ERROR] ${cmdErr.message || 'Command failed'}\n`;
          if (cmdErr.stdout) fullLog += `${cmdErr.stdout}\n`;
          if (cmdErr.stderr) fullLog += `${cmdErr.stderr}\n`;
          finalStatus = 'FAILED';
          errorMessage = `Command failed: ${cmd}`;
          exitCode = cmdErr.code !== undefined ? cmdErr.code : 1;
          break;
        }
        fullLog += '\n';
      }

      fullLog += finalStatus === 'SUCCESS'
        ? `\n[ACTION SUCCESS] Finished at ${new Date().toISOString()}\n`
        : `\n[ACTION FAILED] ${errorMessage} at ${new Date().toISOString()}\n`;
    } catch (err: any) {
      finalStatus = 'FAILED';
      errorMessage = err.message || 'Action execution failed';
      exitCode = 1;
      fullLog += `\n[ACTION FAILED] ${errorMessage}\n`;
    } finally {
      runningActions.delete(repositoryId);
      const finishedAt = new Date().toISOString();
      db.prepare(`
        UPDATE action_runs SET status = ?, exit_code = ?, finished_at = ?, output = ?, error = ?
        WHERE id = ?
      `).run(finalStatus, exitCode, finishedAt, capOutput(fullLog), errorMessage || null, runId);

      logAudit({
        userId,
        username,
        action: `ACTION_${finalStatus}`,
        repositoryId,
        ipAddress,
        details: `Run #${runId}, Template: ${template?.name || 'Custom'}, Commands: ${cmdList.join(' && ')}${errorMessage ? `, Error: ${errorMessage}` : ''}`
      });
    }
  })();

  const run = db.prepare('SELECT * FROM action_runs WHERE id = ?').get(runId) as any;
  return run;
}

export function getActionRuns(repositoryId?: number, limit = 50): ActionRun[] {
  if (repositoryId) {
    return (db.prepare(`
      SELECT r.*, repo.name as repository_name
      FROM action_runs r
      JOIN repositories repo ON r.repository_id = repo.id
      WHERE r.repository_id = ?
      ORDER BY r.id DESC
      LIMIT ?
    `).all(repositoryId, limit) as unknown) as ActionRun[];
  }

  return (db.prepare(`
    SELECT r.*, repo.name as repository_name
    FROM action_runs r
    JOIN repositories repo ON r.repository_id = repo.id
    ORDER BY r.id DESC
    LIMIT ?
  `).all(limit) as unknown) as ActionRun[];
}

export function getActionRunById(id: number): ActionRun | undefined {
  return (db.prepare(`
    SELECT r.*, repo.name as repository_name
    FROM action_runs r
    JOIN repositories repo ON r.repository_id = repo.id
    WHERE r.id = ?
  `).get(id) as unknown) as ActionRun | undefined;
}