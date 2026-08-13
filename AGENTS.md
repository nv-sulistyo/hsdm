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
- `server.ts` — Express entry; mounts `/api/auth`, `/api/repositories`, `/api/deployments`, `/api/system`, `/webhooks`, plus `/api/health`. Webhooks use a raw-body middleware (before `express.json()`) so HMAC-SHA256 verification sees the exact bytes.
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

### Production server (live environment)
- Deployment: Ubuntu + aaPanel, GitHub repo `https://github.com/nv-sulistyo/hsdm.git`, folder `/www/wwwroot/hsdm`, PM2 app name `hsdm` (root), PORT 3210, public via Cloudflare Tunnel. **Port 3000 is another app (`rekap_transaksi`) — never touch.**
- Server folder was originally a ZIP upload (no `.git`). Fixed with `git init && git remote add origin git@github.com:nv-sulistyo/hsdm.git && git fetch && git branch -M main && git reset --hard origin/main`. Now updates with plain `git pull` (branch `main`).
- Update routine: `git pull && npm ci && npm run build && pm2 restart hsdm`. `--update-env` only needed when env values change (JWT_SECRET/PORT/NODE_ENV persist in PM2).
- The server's SSH key is registered as a GitHub **account** SSH key (Settings → SSH and GPG keys) → applies to all repos, **no deploy keys needed**; GitHub's "Key already in use" error is expected, not a bug.
- DB saga: original server DB file was deleted while PM2 held the deleted file (ghost); a laptop DB (empty, with `C:\www\wwwroot` roots) was uploaded. After PM2 restart the ghost is gone; `db.ts` self-heals Windows-style paths on non-Windows startup (`toLinuxPath`, audit `DB_SELF_HEAL`). Old/new DBs both work — all migrations are additive.
- Dashboard used to be broken on the server until build was updated: stats endpoint is `/api/system/dashboard/stats` (NOT `/api/dashboard/stats` — that 404s) and `system.ts` SQL must use single-quoted string literals (double quotes = SQLite identifiers → 500).

### Features completed this session (all committed, HEAD `0fe4184`)
- `deployment_trigger` gating per repo (`MANUAL`/`WEBHOOK`/`BOTH`): manual pull → 403 when `WEBHOOK` (`routes/repositories.ts`); webhook → `IGNORED_TRIGGER_MANUAL` when `MANUAL` (`webhook.service.ts`); Pull Now button disabled + tooltip.
- Repo Actions: tables `action_templates` (19 built-in seeds) + `action_runs`; `src/server/services/action.service.ts` (sequential commands, stop on fail, 30–3600s timeout, 200KB output cap, concurrent guard per repo); routes `/api/actions`; `ActionRunnerModal.tsx`; SettingsPage CRUD (built-ins locked).
- Clear history endpoints: `DELETE /api/deployments` (+`?repositoryId`), `DELETE /api/actions/runs` (+`?repositoryId`), `DELETE /webhooks/events` (+`?repositoryId` — under `/webhooks`, not `/api`), `DELETE /api/system/audit-logs`; each logs `CLEAR_*` audit. UI buttons in DeploymentsPage/WebhooksPage/AuditLogsPage/ActionRunnerModal + SettingsPage "Data & Logs" section (per-category + Clear All Data).
- Dashboard: `Promise.allSettled` for stats+SSH (SSH failure no longer blanks stats) + silent 10s polling; RepositoriesPage silent 10s polling too.
- Webhook history path: `/webhooks/history` (mounted router is `/webhooks`).
- Font: Poppins replaces Newsreader (`@theme { --font-serif: 'Poppins', ... }` in `index.css`); use `font-serif` without `italic` anywhere.
- Branding: user-made square SVG logo at `public/logo.svg`; `src/components/Logo.tsx` renders `<img src="/logo.svg">` with `rounded-[25%]` CSS (never a text initial); favicon = `/logo.svg`; sidebar header shows "HSDM" + subtitle only.
- GuidePage FAQ #5: "Key already in use" → key is the account SSH key, no deploy key needed.

### Verification workflow
- Dev server: `tsx watch server.ts` on PORT 3210 (laptop SQLite DB, empty repos), login `admin/admin123`; API smoke tests via PowerShell `Invoke-RestMethod` against `http://localhost:3210`; always run `npm run lint` + `npm run build` before committing; commit messages are one-line summaries in the style of the git log.
