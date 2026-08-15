# AGENTS.md

Full-stack app: React 19 + Vite + Tailwind 4 frontend, Express + SQLite backend, bootstrapped in a single process. Targeted at Linux aaPanel home servers (git/SSH/system features read `/etc/passwd`, default execution user `nova`, deploy root `/www/wwwroot`).

## Commands
- `npm run dev` — `tsx server.ts`: Express + Vite dev middleware, SPA on port 3000. Use for everything; no separate frontend server.
- `npm run lint` — `tsc --noEmit`. This IS the typecheck; there is no ESLint/Prettier.
- `npm run build` — vite build + esbuild server bundle → `dist/server.cjs`; `npm start` serves the static SPA from `dist/` in production mode.
- No test framework or test scripts exist.
- npm is the package manager; `package-lock.json` is the lockfile (bun removed — never use `bun install`).
- `dotenv` is a dependency but never imported — env vars (e.g. `JWT_SECRET`) come from the process environment only.

## Architecture
- `server.ts` — Express entry; mounts `/api/auth`, `/api/repositories`, `/api/deployments`, `/api/system`, `/api/actions`, `/api/docker`, `/api/monitoring`, `/api/systemd`, `/api/webserver`, `/api/installer`, `/webhooks`, plus `/api/health`. Webhooks use a raw-body middleware (before `express.json()`) so HMAC-SHA256 verification sees the exact bytes.
- `src/server/` — backend: `db.ts` (schema + seeds), `routes/`, `services/`, `middleware/auth.middleware.ts` (`requireAuth` on all API routes except login).
- `src/` root — React frontend: `pages/`, `components/`, `services/api.ts` (typed client), `types.ts` (shared between frontend and backend).
- SQLite via Node built-in `node:sqlite` (`DatabaseSync`), no ORM. DB auto-created at `database/deployment_manager.db`; `initDatabase()` runs schema + `ALTER TABLE`-style column migrations on startup. Default admin `admin/admin123` is seeded.
- Auth: JWT (7 days), `JWT_SECRET` env with hardcoded fallback; accepted via Bearer header or httpOnly cookie.
- Deployments (`executeDeployment`) run fire-and-forget in the background; `POST /api/repositories/:id/pull` returns immediately. An in-memory `runningRepos` Set rejects concurrent deploys per repo. Logs go to `deployments.output`.
- `before_command`/`post_pull_command` run via shell `exec` (10MB maxBuffer, 5min timeout); all git operations use `execFile` with an args array (no shell injection) and `GIT_SSH_COMMAND` from settings.

## Conventions & gotchas
- Relative imports use `.js` extensions pointing at `.ts` files (e.g. `from '../db.js'`); `allowImportingTsExtensions` is enabled. Keep this style everywhere, frontend included.
- Frontend alias `@/*` → repo root.
- Every repository path must pass `validateAllowedPath` (`settings.service.ts`) — restricted to `allowed_deploy_roots` (default `/www/wwwroot`) and blocks critical system dirs. Never bypass.
- Vite config's `DISABLE_HMR` HMR/watch logic in `vite.config.ts` must not be modified (prevents flicker during agent edits).
- The AI Studio boilerplate (stale README, `metadata.json`, `assets/.aistudio/`, `@google/genai` dependency, Gemini env vars) has been removed. Trust code, not docs.

## Project state (session log 2026-08-13)

### VPS stack (session log 2026-08-15, branch `feat/vps-stack`, HEAD `651d2a3`)
Topologi target (Level B): Cloudflare DNS proxy langsung → **satu container Caddy di network `proxy`** → container aplikasi per **nama service**. GitHub compose yaml tidak pernah diubah — HSDM menulis `docker-compose.override.yml`. Proxy attachment **opt-in** (hanya service bertanda yang join `proxy`); DB/Redis tetap di network default project (isolasi otomatis). Backward compat: mode `native` (nginx/caddy via apt, proxy ke 127.0.0.1) tetap default untuk ko-eksistensi aaPanel.

- Commit: `436e8b3` settings · `8569bd3` compose override · `3ecec2c` caddy container mode · `4a93d09` portainer/netdata installer · `651d2a3` guide docs.
- Settings baru (SettingsPage "VPS Stack"): `deploy_root` (`/opt/hsdm/projects`), `proxy_network` (`proxy`), `infrastructure_dir` (`/opt/hsdm/infrastructure`), `proxy_mode` (`native`|`container`, default `native`), `caddy_container_name` (`caddy`). Fix bug dead code: `getSettings` kini benar-benar mengembalikan `nginx_sites_dir`, `nginx_sites_enabled_dir`, `caddyfile_path`.
- Override compose: kolom `repositories.compose_proxy_services` (dual marking: field form RepositoriesPage **dan** checkbox DockerPage). `docker.service.ts`: `overrideFileName`, `composeArgs` auto-include override, `writeComposeOverride` (validasi `docker compose config -q`, hapus file jika kosong). Route `GET/POST /api/docker/compose/:repositoryId/override` — **body key `services` (array), BUKAN `proxiedServices`**. Deploy compose: tulis/hapus override + `docker compose -f <file> -f <override> up -d --build`.
- Mode container: installer `caddy_container` (tulis infra compose di `infrastructure_dir/caddy` + `docker network create proxy` + set `proxy_mode=container`). `webserver.service.ts`: `getCaddyfilePath` → `infrastructure_dir/caddy/Caddyfile`; status caddy via `docker inspect`/`docker exec caddy version`; validate/reload via `docker exec caddy validate|reload --config /etc/caddy/Caddyfile`; `generateReverseProxy` menerima `targetHost` (default: `frontend` di container mode, `127.0.0.1` di native). WebServerPage ReverseProxyModal punya field Target host (prefill dari service pertama `compose_proxy_services`).
- Installer opsional: `portainer` (9443+9000, docker.sock) dan `netdata` (19999, mount /proc /sys) — satu instance untuk semua project. `StackStatus` + `caddyContainer`, `portainer`, `netdata`, `proxyMode`.
- GuidePage: section `vps` baru (topologi, mekanisme override, expose vs ports, langkah setup).

### Production server (live environment)
- Deployment: Ubuntu + aaPanel, GitHub repo `https://github.com/nv-sulistyo/hsdm.git`, folder `/www/wwwroot/hsdm`, PM2 app name `hsdm` (root), PORT 3210, public via Cloudflare Tunnel. **Port 3000 is another app (`rekap_transaksi`) — never touch.**
- Server folder was originally a ZIP upload (no `.git`). Fixed with `git init && git remote add origin git@github.com:nv-sulistyo/hsdm.git && git fetch && git branch -M main && git reset --hard origin/main`. Now updates with plain `git pull` (branch `main`).
- Update routine: `git pull && npm ci && npm run build && pm2 restart hsdm`. `--update-env` only needed when env values change (JWT_SECRET/PORT/NODE_ENV persist in PM2).
- The server's SSH key is registered as a GitHub **account** SSH key (Settings → SSH and GPG keys) → applies to all repos, **no deploy keys needed**; GitHub's "Key already in use" error is expected, not a bug.
- DB saga: original server DB file was deleted while PM2 held the deleted file (ghost); a laptop DB (empty, with `C:\www\wwwroot` roots) was uploaded. After PM2 restart the ghost is gone; `db.ts` self-heals Windows-style paths on non-Windows startup (`toLinuxPath`, audit `DB_SELF_HEAL`). Old/new DBs both work — all migrations are additive.
- Dashboard used to be broken on the server until build was updated: stats endpoint is `/api/system/dashboard/stats` (NOT `/api/dashboard/stats` — that 404s) and `system.ts` SQL must use single-quoted string literals (double quotes = SQLite identifiers → 500).

### Features completed this session (all committed, HEAD `54dfd36`)
- Hash routing: `App.tsx` reads `location.hash` (`#<tab>`, `#settings/<sub>`, `#guide/<section>`), `navigateTab` writes hash (dashboard → `#`, skips when empty); SettingsPage/GuidePage have their own `hashchange` listeners guarded by top segment. Back/forward works.
- SettingsPage 4 pill tabs (server/account/templates/data) synced to hash; GuidePage 5 pill sections synced to hash.
- SSH account-key flow: `parseAuthenticatedUser` in `ssh.service.ts` (regex `Hi\s+([A-Za-z0-9._-]+)!`) → `authenticatedUser` in `testGithubConnection` success response; GitSshPage "Authenticated as" badge; Guide/FAQ/dashboard copy updated (account-level key, not deploy keys).
- Circular logo: `public/logo.svg` is now a circle (white server bars on sage disc); `Logo.tsx` no longer uses `rounded-[25%]`.
- **Init Git** feature (existing non-git folder → managed repo): `initializeGitRepository` in `git.service.ts` runs `git init` + `remote add origin` + `fetch` + `branch -M <branch>`; if `origin/<branch>` exists → `reset --hard origin/<branch>` + set upstream (untracked files kept); if remote is empty → requires `gitUser`/`gitEmail`/`commitMessage`, then `git add -A` + `git -c user.name ... commit` + `push -u` (error code `REMOTE_EMPTY` returned as 400 + `code` field). Route `POST /api/repositories/:id/init-git` (audit `INIT_GIT_REPOSITORY`), `api.initGitRepo`, "Init Git" button on `NOT_A_REPOSITORY` cards + confirm modal in RepositoriesPage. `request()` in `api.ts` now attaches `data.code` to thrown errors. Idempotent — retry after REMOTE_EMPTY works.

### Features completed previous session (HEAD `0fe4184`)
- `deployment_trigger` gating per repo (`MANUAL`/`WEBHOOK`/`BOTH`): manual pull → 403 when `WEBHOOK` (`routes/repositories.ts`); webhook → `IGNORED_TRIGGER_MANUAL` when `MANUAL` (`webhook.service.ts`); Pull Now button disabled + tooltip.
- Repo Actions: tables `action_templates` (19 built-in seeds) + `action_runs`; `src/server/services/action.service.ts` (sequential commands, stop on fail, 30–3600s timeout, 200KB output cap, concurrent guard per repo); routes `/api/actions`; `ActionRunnerModal.tsx`; SettingsPage CRUD. Built-ins are recommendations only — fully CRUD-able (deleted built-ins are re-seeded by `INSERT OR IGNORE` on next startup).
- Clear history endpoints: `DELETE /api/deployments` (+`?repositoryId`), `DELETE /api/actions/runs` (+`?repositoryId`), `DELETE /webhooks/events` (+`?repositoryId` — under `/webhooks`, not `/api`), `DELETE /api/system/audit-logs`; each logs `CLEAR_*` audit. UI buttons in DeploymentsPage/WebhooksPage/AuditLogsPage/ActionRunnerModal + SettingsPage "Data & Logs" section (per-category + Clear All Data).
- Dashboard: `Promise.allSettled` for stats+SSH (SSH failure no longer blanks stats) + silent 10s polling; RepositoriesPage silent 10s polling too.
- Webhook history path: `/webhooks/history` (mounted router is `/webhooks`).
- Font: Poppins replaces Newsreader (`@theme { --font-serif: 'Poppins', ... }` in `index.css`); use `font-serif` without `italic` anywhere.
- Branding: circular SVG logo at `public/logo.svg` (white server bars on sage disc); `src/components/Logo.tsx` renders `<img src="/logo.svg">` (no rounding CSS needed — the SVG is already a circle); favicon = `/logo.svg`; sidebar header shows "HSDM" + subtitle only.
- GuidePage FAQ #5: "Key already in use" → key is the account SSH key, no deploy key needed.

### Verification workflow
- Dev server: `tsx watch server.ts` on PORT 3210 (laptop SQLite DB, empty repos), login `admin/admin123`; API smoke tests via PowerShell `Invoke-RestMethod` against `http://localhost:3210`; always run `npm run lint` + `npm run build` before committing; commit messages are one-line summaries in the style of the git log.
- **Testing Docker/VPS-stack features on Windows**: Docker Desktop CLI works from the host (docker daemon 29.x). WSL2 exists but only has the `docker-desktop` distro (no Ubuntu). Full stack flow verified this way: start Docker Desktop (`C:\Program Files\Docker\Docker\Docker Desktop.exe`), register a test repo from a `file:///` bare remote, set `proxy_mode=container`, then override/compose/webserver endpoints all work (Linux containers run inside the Docker Desktop VM; Windows paths for `local_path`/`infrastructure_dir` are translated automatically). The Stack Installer (`isWindows()` guard + bash `execFile`) still requires real Linux — test on VPS or after installing an Ubuntu WSL distro.
- Test domain trick: use `testapp.localhost` (Caddy issues a local cert, no Let's Encrypt) + `curl -sk --resolve testapp.localhost:443:127.0.0.1 https://testapp.localhost/`. HTTP on :80 answers 308 → HTTPS. End-to-end verified: `Hello from testapp web` served from the `web` container via `reverse_proxy web:80`.
