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
