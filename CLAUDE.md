# CLAUDE.md

Master guide of the MundiTrofeos portal. Platform-wide rules only. Module details live in `.agents/modulos/<module>/`.

## 1. Project overview

- Corporate portal hosting internal modules.
- One Node/Express **modular monolith**; never split into services.
- Hosting: managed Node + MySQL; no Docker/VPS/root.
- MySQL is mandatory: no fallback, fatal exit.
- Stack: Express, MySQL, Socket.IO, vanilla JS, Supabase Storage.

## 2. Quick start

- Full walkthrough and new-module guide: `README.md`.
- No tests, linter, or build step.
- Create MySQL database `portal_empresarial`.
- Import `database/schema.sql`, `seed.sql`, `users.sql`, in order.
- Copy `.env.example` to `.env`; fill every variable.
- Run `npm run dev`: `http://localhost:3000`.
- Env vars: all required, no defaults; missing or invalid: `[FATAL]`, exit.
- `NODE_ENV`: `development|staging|production|test`.
- `JWT_SECRET` ≥ 32 chars; `SOCKET_CORS_ORIGIN` exact origins, never `*`.
- `DB_PASSWORD` empty only outside production; other formats: `src/config/env.js`.
- Accounts: header of `database/users.sql`; admin is `admin@grupopremia.com`.
- Change dev passwords in production.
- Roles (rol_id 1-10): `.agents/modulos/admin/README.md`.

## 3. Folder map

```text
src/
  app.js              # mounts everything; order matters
  config/             # env.js (fail-fast), database.js (MySQL pool)
  core/               # shared: auth, permissions, websocket, files, idempotency, calendario, notifications, utils
  modules/<name>/     # controllers/ services/ repositories/ routes.js events.js
public/
  css/global.css      # shared design tokens
  modules/<name>/     # index.html, css/styles.css, js/app.js
database/             # schema.sql, seed.sql, users.sql, migrations/
.agents/              # reglas/ (global rules), modulos/<name>/ (README.md + documentacion/)
```

- `src/app.js` order: public routes and `/api/auth`, then `authenticateJWT`, then maintenance gate.
- Everything after `authenticateJWT` is protected.
- Register modules in `MODULOS` (`src/core/permissions/modulesCatalog.js`), never inline in `app.js`.
- Real-time: `socketManager.sendToModule(module, event, data)`; clients join with `register_module`.
- Files never live in MySQL; store only the Storage URL.
- Upload + DB endpoints accept `idempotencyKey`.

## 4. Code conventions

- Controllers: HTTP only.
- Services: business rules; no SQL, no `req`/`res`.
- Repositories: all SQL, via `db.query(sql, params, tag)`, parameterized.
- Errors via `responderError`; ids via `idObligatorio`/`idOpcional`.
- Gate actions by permission, not role name.
- Frontend: vanilla HTML/CSS/JS, Ionicons, `public/css/global.css` tokens; UI rules in `.agents/reglas/reglas_disenoUI.md`.
- Design changes start with a Figma mockup approved by the owner; no code before that.
- Keep DOM ids, classes, `data-*` stable.
- Names: Spanish domain terms; `<x>Controller.js`, `<x>Service.js`, `<x>Repository.js`; permissions `<modulo>.<accion>`.
- Storage objects named by correlativo; states written in full words.
- Simple, cohesive code (SOLID, DRY, KISS); one-line "why" comments (`.agents/reglas/reglas_implementacion.md`).
- Conventional Commits, in Spanish; no AI attribution.
- Every change goes on a new branch from an updated `dev` (pull first).
- Never commit directly to `dev`, `staging`, or `main`.
- Business rules live in module docs; update them with behavior.
- CI runs on every PR: `.agents/reglas/reglas_ci.md`.

## 5. Security & auth

- Stateless JWT (cookie `token`) + rotating refresh token (`refresh_token`); httpOnly, sameSite strict.
- Identity only from `req.user`; never from body/query.
- Permissions enforced in the backend only.
- Guards in `src/core/permissions/permissionMiddleware.js`: `authenticateJWT`, `requireAuth`, `requirePermission('modulo.accion')`, `requireModule`.
- Spec: `.agents/reglas/reglas_autenticacion.md`.

## 6. Environments & critical actions

- `development`: local. `staging`: testing domain, production backup, own bucket. `production`. `test`: automated.
- Critical actions run **only in production**; elsewhere do nothing and log it.
- Critical: Storage delete/replace, purges, emails, push, webhooks, third-party calls, external resources located by DB values.
- Guarded today: `supabaseStorage.eliminar`, retention watcher.
- New actions: follow `.agents/reglas/reglas_entornos.md`; update its inventory.
- Session cookies are `Secure` in staging and production.
- Refresh staging from production: `npm run staging:probar-conexion` / `staging:refrescar`; rules: `.agents/reglas/reglas_refresco_staging.md`.
- Environment mark: only the staging DB holds `parametros_sistema.entorno = 'staging'` (set once with `npm run staging:marcar`); production never has one. Refresh needs it in DESTINO, not ORIGEN; startup mismatch: `[FATAL]`.

## 7. Migrations (directive for AI agents)

- Folder: **`database/migrations/`** (formerly `database/migraciones/`); never create or reference the old name.
- Scripts: additive, idempotent, named `NN_topic.sql`; never edit one already applied.
- Never edit `schema.sql`/`seed.sql` for production changes.
- Applied automatically at server start in `staging` and `production` (failure: server exits). In `development`: `npm run migrate` / `npm run migrate:estado`.
- Runner: `src/core/migrations/`; control table `schema_migrations`; rules: `.agents/reglas/reglas_archivosSQL.md`.
- Docs and comments cite scripts **without** the correlativo.

## 7.1 Deployments

- Flow: feature branch, PR to `dev`, `staging`, `main`; merge commits only in the last two.
- Hostinger deploys on merge.
- Migrations apply at startup in staging/production.
- Staging refresh and production backup run from the owner's PC.
- AI agents never run them, push to protected branches, or touch production.
- Full runbook: `.agents/reglas/reglas_despliegue.md`.

## 8. Pitfalls: mistakes to avoid

- Don't use `database/migraciones/`.
- Don't hardcode defaults for env variables.
- Don't return raw `error.message` from MySQL/Storage.
- Don't answer 401 for business errors: `public/js/sessionGuard.js` treats any 401 from `/api/` as an expired session. Use 403.
- Don't register protected routes before `authenticateJWT`, or public ones after it.
- Don't delete Storage files outside production.
- Don't add frameworks, Tailwind, bundlers, or TypeScript.
- Don't rename DOM ids, classes, `data-*` in refactors.
- Don't abbreviate states in UI, docs, or reports.
- Don't rewrite whole files: keep line endings (most are CRLF).
- Don't remove the importmap markers from module HTML or the Hostinger Build command `npm run estaticos:versionar`: the CDN serves statics without cache headers.
- Don't skip documenting a new module in `.agents/modulos/`.
- Module-specific pitfalls: that module's `README.md`.

## 9. Docs map

| Module | Docs | Purpose |
|---|---|---|
| Vales de Arte (`vales`) | `.agents/modulos/vales de arte/README.md` | Vouchers: create, authorize, assign, deliver, confirm. |
| Administración Central (`admin`) | `.agents/modulos/admin/README.md` | Users, roles, talleres, maintenance, schedules, admin tools. |

- New module: `README.md` section 4 and `.agents/reglas/reglas_modulo.md`; document it under `.agents/modulos/<name>/` (`README.md` + `documentacion/`).
- Global rules: `.agents/reglas/` (architecture, module templates, auth, implementation style, UI, SQL files, environments, CI, deployment).
- Vales also has `flujo_vale_de_arte.md` (source of truth), `analisis_modulo.md` (history), `correcciones/` (changelog).
