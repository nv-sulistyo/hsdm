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
    { key: 'auto_refresh_interval', value: '30' }
  ];

  const now = new Date().toISOString();
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);

  for (const s of defaultSettings) {
    insertSetting.run(s.key, s.value, now, now);
  }

  console.log('[DB] Database initialized successfully');
}
