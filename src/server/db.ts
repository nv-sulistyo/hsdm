import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';

const dbDir = path.resolve(process.cwd(), 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'deployment_manager.db');
export const db = new DatabaseSync(dbPath);

// Convert a Windows-style path (e.g. "C:\www\wwwroot") to a Linux absolute path ("/www/wwwroot").
export function toLinuxPath(p: string): string {
  if (!p) return p;
  let out = p.replace(/\\/g, '/');
  const m = out.match(/^[A-Za-z]:\/+(.*)$/);
  if (m) {
    out = '/' + m[1].replace(/^\/+/, '');
  } else if (!out.startsWith('/')) {
    out = '/' + out;
  }
  out = out.replace(/\/{2,}/g, '/');
  return out;
}

// Enable WAL mode and foreign keys
try {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
} catch (e) {
  console.warn('SQLite PRAGMA setup note:', e);
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS repositories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      git_url TEXT NOT NULL,
      branch TEXT NOT NULL DEFAULT 'main',
      local_path TEXT NOT NULL,
      execution_user TEXT NOT NULL DEFAULT 'nova',
      mode TEXT NOT NULL DEFAULT 'CLONE',
      git_strategy TEXT DEFAULT 'PULL',
      deployment_trigger TEXT DEFAULT 'BOTH',
      before_command TEXT,
      post_pull_command TEXT,
      auto_deploy INTEGER NOT NULL DEFAULT 1,
      webhook_enabled INTEGER NOT NULL DEFAULT 1,
      webhook_secret TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'UNCHECKED',
      last_pull_at TEXT,
      last_commit_hash TEXT,
      last_commit_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deployments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      trigger_type TEXT NOT NULL DEFAULT 'MANUAL',
      status TEXT NOT NULL DEFAULT 'PENDING',
      commit_before TEXT,
      commit_after TEXT,
      started_at TEXT,
      finished_at TEXT,
      output TEXT,
      error TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repository_id INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
      event_id TEXT,
      event_type TEXT NOT NULL,
      signature_valid INTEGER NOT NULL DEFAULT 0,
      payload_hash TEXT,
      received_at TEXT NOT NULL,
      processed_at TEXT,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username TEXT,
      action TEXT NOT NULL,
      repository_id INTEGER,
      ip_address TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS action_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      tech_stack TEXT NOT NULL,
      description TEXT,
      commands TEXT NOT NULL,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS action_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      template_id INTEGER REFERENCES action_templates(id) ON DELETE SET NULL,
      template_name TEXT,
      command TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'RUNNING',
      exit_code INTEGER,
      started_at TEXT,
      finished_at TEXT,
      output TEXT,
      error TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Deduplicate webhook deliveries (GitHub retries send the same X-GitHub-Delivery)
  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_dedup ON webhook_events (repository_id, event_id);');
  } catch {
    // Index may fail on legacy databases that already contain duplicates; dedup stays best-effort.
  }

  // Safe column migrations for repositories table
  const repoCols = db.prepare("PRAGMA table_info('repositories')").all() as Array<{ name: string }>;
  const colNames = repoCols.map(c => c.name);

  if (!colNames.includes('execution_user')) {
    try { db.exec("ALTER TABLE repositories ADD COLUMN execution_user TEXT NOT NULL DEFAULT 'nova';"); } catch {}
  }
  if (!colNames.includes('mode')) {
    try { db.exec("ALTER TABLE repositories ADD COLUMN mode TEXT NOT NULL DEFAULT 'CLONE';"); } catch {}
  }
  if (!colNames.includes('git_strategy')) {
    try { db.exec("ALTER TABLE repositories ADD COLUMN git_strategy TEXT DEFAULT 'PULL';"); } catch {}
  }
  if (!colNames.includes('deployment_trigger')) {
    try { db.exec("ALTER TABLE repositories ADD COLUMN deployment_trigger TEXT DEFAULT 'BOTH';"); } catch {}
  }
  if (!colNames.includes('before_command')) {
    try { db.exec("ALTER TABLE repositories ADD COLUMN before_command TEXT;"); } catch {}
  }
  if (!colNames.includes('deploy_mode')) {
    try { db.exec("ALTER TABLE repositories ADD COLUMN deploy_mode TEXT NOT NULL DEFAULT 'NONE';"); } catch {}
  }
  if (!colNames.includes('compose_file')) {
    try { db.exec("ALTER TABLE repositories ADD COLUMN compose_file TEXT NOT NULL DEFAULT 'docker-compose.yml';"); } catch {}
  }
  if (!colNames.includes('compose_service')) {
    try { db.exec("ALTER TABLE repositories ADD COLUMN compose_service TEXT;"); } catch {}
  }
  if (!colNames.includes('systemd_unit')) {
    try { db.exec("ALTER TABLE repositories ADD COLUMN systemd_unit TEXT;"); } catch {}
  }
  if (!colNames.includes('domain')) {
    try { db.exec("ALTER TABLE repositories ADD COLUMN domain TEXT;"); } catch {}
  }
  if (!colNames.includes('proxy_target_port')) {
    try { db.exec("ALTER TABLE repositories ADD COLUMN proxy_target_port INTEGER;"); } catch {}
  }
  if (!colNames.includes('compose_proxy_services')) {
    try { db.exec("ALTER TABLE repositories ADD COLUMN compose_proxy_services TEXT;"); } catch {}
  }

  // Seed default admin user if no users exist
  const checkUser = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (checkUser.count === 0) {
    const defaultPassHash = bcrypt.hashSync('admin123', 10);
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO users (username, password_hash, role, created_at, updated_at)
      VALUES (?, ?, 'admin', ?, ?)
    `).run('admin', defaultPassHash, now, now);
    console.log('[DB] Seeded default admin user: admin / admin123');
  }

  // Seed default settings if not exists
  const defaultSettings = [
    { key: 'allowed_deploy_roots', value: JSON.stringify(['/www/wwwroot']) },
    { key: 'execution_user', value: 'nova' },
    { key: 'git_executable', value: 'git' },
    { key: 'ssh_key_path', value: '~/.ssh/id_ed25519' },
    { key: 'known_hosts_path', value: '~/.ssh/known_hosts' },
    { key: 'auto_refresh_interval', value: '30' },
    { key: 'deploy_root', value: '/opt/hsdm/projects' },
    { key: 'proxy_network', value: 'proxy' },
    { key: 'infrastructure_dir', value: '/opt/hsdm/infrastructure' },
    { key: 'nginx_sites_dir', value: '/etc/nginx/sites-available' },
    { key: 'nginx_sites_enabled_dir', value: '/etc/nginx/sites-enabled' },
    { key: 'caddyfile_path', value: '/etc/caddy/Caddyfile' }
  ];

  const now = new Date().toISOString();
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);

  for (const s of defaultSettings) {
    insertSetting.run(s.key, s.value, now, now);
  }

  // Seed built-in action templates for well-known tech stacks
  const builtinTemplates: Array<{ name: string; tech_stack: string; description: string; commands: string[] }> = [
    { name: 'Node.js — Install Dependencies', tech_stack: 'Node.js / npm', description: 'Install npm dependencies', commands: ['npm install'] },
    { name: 'Node.js — Build', tech_stack: 'Node.js / npm', description: 'Install dependencies and build the project', commands: ['npm install', 'npm run build'] },
    { name: 'Node.js — Test', tech_stack: 'Node.js / npm', description: 'Run the test suite', commands: ['npm test'] },
    { name: 'Node.js — Dev Server', tech_stack: 'Node.js / npm', description: 'Start the development server (long-running, terminated by timeout)', commands: ['npm run dev'] },
    { name: 'Vite / React — Build', tech_stack: 'Vite / React', description: 'Install and build a Vite/React app', commands: ['npm install', 'npm run build'] },
    { name: 'Next.js — Build', tech_stack: 'Next.js', description: 'Install and build a Next.js app', commands: ['npm install', 'npm run build'] },
    { name: 'Next.js — Production Start', tech_stack: 'Next.js', description: 'Start the Next.js production server', commands: ['npm run start'] },
    { name: 'Yarn — Install & Build', tech_stack: 'Yarn', description: 'Install dependencies and build with Yarn', commands: ['yarn install', 'yarn build'] },
    { name: 'pnpm — Install & Build', tech_stack: 'pnpm', description: 'Install dependencies and build with pnpm', commands: ['pnpm install', 'pnpm build'] },
    { name: 'Python — Install Requirements', tech_stack: 'Python', description: 'Install Python dependencies via pip', commands: ['pip install -r requirements.txt'] },
    { name: 'Python — venv + Install', tech_stack: 'Python', description: 'Create a virtual environment and install dependencies', commands: ['python3 -m venv .venv', '.venv/bin/pip install -r requirements.txt'] },
    { name: 'Python — Django Migrate', tech_stack: 'Python / Django', description: 'Apply Django database migrations', commands: ['python3 manage.py migrate'] },
    { name: 'PHP — Composer Install', tech_stack: 'PHP', description: 'Install Composer dependencies (production)', commands: ['composer install --no-dev'] },
    { name: 'Laravel — Full Deploy', tech_stack: 'PHP / Laravel', description: 'Install dependencies, migrate, and build assets', commands: ['composer install --no-dev', 'php artisan migrate --force', 'npm install', 'npm run build'] },
    { name: 'Go — Build All', tech_stack: 'Go', description: 'Compile all Go packages', commands: ['go build ./...'] },
    { name: 'Go — Test All', tech_stack: 'Go', description: 'Run the Go test suite', commands: ['go test ./...'] },
    { name: 'Docker — Build & Up', tech_stack: 'Docker', description: 'Build images and start containers in detached mode', commands: ['docker compose build', 'docker compose up -d'] },
    { name: 'Rust — Cargo Build', tech_stack: 'Rust', description: 'Compile the Rust project', commands: ['cargo build'] },
    { name: 'Rust — Cargo Test', tech_stack: 'Rust', description: 'Run the Rust test suite', commands: ['cargo test'] }
  ];

  const insertTemplate = db.prepare(`
    INSERT OR IGNORE INTO action_templates (name, tech_stack, description, commands, is_builtin, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `);
  for (const t of builtinTemplates) {
    insertTemplate.run(t.name, t.tech_stack, t.description, JSON.stringify(t.commands), now, now);
  }

  // Self-heal: if the DB file was produced on a Windows machine (e.g. a laptop DB
  // uploaded to the Linux server), convert Windows-style paths to Linux equivalents
  // so path validation keeps working. Runs only on non-Windows hosts and is idempotent.
  if (process.platform !== 'win32') {
    const changes: string[] = [];

    const rootsRow = db.prepare("SELECT value FROM settings WHERE key = 'allowed_deploy_roots'").get() as { value: string } | undefined;
    if (rootsRow) {
      try {
        const roots = JSON.parse(rootsRow.value);
        if (Array.isArray(roots)) {
          const fixed = roots.map(r => (typeof r === 'string' ? toLinuxPath(r) : r));
          if (JSON.stringify(fixed) !== JSON.stringify(roots)) {
            db.prepare("UPDATE settings SET value = ?, updated_at = ? WHERE key = 'allowed_deploy_roots'")
              .run(JSON.stringify(fixed), now);
            changes.push(`allowed_deploy_roots: ${rootsRow.value} -> ${JSON.stringify(fixed)}`);
          }
        }
      } catch {
        // Leave malformed value untouched.
      }
    }

    for (const key of ['ssh_key_path', 'known_hosts_path']) {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
      if (row && /^[A-Za-z]:[\\/]|\\\\/.test(row.value)) {
        const fixed = toLinuxPath(row.value);
        db.prepare('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?').run(fixed, now, key);
        changes.push(`${key}: ${row.value} -> ${fixed}`);
      }
    }

    const repos = db.prepare('SELECT id, local_path FROM repositories').all() as Array<{ id: number; local_path: string }>;
    for (const r of repos) {
      if (/^[A-Za-z]:[\\/]|\\\\/.test(r.local_path)) {
        const fixed = toLinuxPath(r.local_path);
        db.prepare('UPDATE repositories SET local_path = ?, updated_at = ? WHERE id = ?').run(fixed, now, r.id);
        changes.push(`repo #${r.id} local_path: ${r.local_path} -> ${fixed}`);
      }
    }

    if (changes.length > 0) {
      db.prepare(`
        INSERT INTO audit_logs (username, action, details, created_at)
        VALUES ('system', 'DB_SELF_HEAL', ?, ?)
      `).run(changes.join('; '), now);
      console.log(`[DB] Self-heal (Windows -> Linux paths): ${changes.join('; ')}`);
    }
  }

  console.log('[DB] Database initialized successfully');
}
