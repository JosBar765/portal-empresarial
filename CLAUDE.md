# CLAUDE.md

Master guide of the MundiTrofeos portal. Platform-wide rules only. Module details live in `.agents/modulos/<module>/`.

## 1. Project overview

- Corporate portal hosting internal tools (modules).
- One Node/Express **modular monolith**.
- Never split into services or servers.
- Hosting: managed Node + MySQL. No Docker/VPS/root.
- MySQL is mandatory: no fallback, fatal exit if down.
- Stack: Express, MySQL, Socket.IO, vanilla JS, Ionicons, Supabase Storage.
- Modules today: Vales de Arte, Administración Central.

## 2. Quick start

- Full walkthrough and new-module guide: `README.md`.
- No tests, linter, or build step.
- Create MySQL database `portal_empresarial`.
- Import `database/schema.sql`, `seed.sql`, `users.sql`, in that order.
- Copy `.env.example` to `.env`; fill every variable.
- Run `npm run dev`: `http://localhost:3000`.
- Security tests: `scripts/security/`, disposable DB only.

**Environment variables** (all required, no defaults):
- Missing or invalid: one `[FATAL]` line each, process exits.
- `NODE_ENV`: `development|staging|production|test`.
- `JWT_SECRET`: at least 32 characters.
- Token lifetimes: `<int><s|m|h|d>`.
- `SOCKET_CORS_ORIGIN`: exact origins, never `*`, no trailing slash.
- `TRUST_PROXY`: reverse-proxy hops (0 = none).
- `DB_PASSWORD`: empty only outside production.

**Accounts and roles:**
- Users load from `database/users.sql`.
- Dev passwords: comment at top of that file.
- Change them in production.
- Administrador: `admin@grupopremia.com` (rol_id 1).
- Roles: 1 Administrador, 2 Asesor, 3 Supervisor, 4 Encargado de Diseño, 5 Encargado de Diseño UV/3D, 6 Diseñador, 7 Asistente, 8 Gerente, 9 Encargado de Protextil, 10 Encargado de Diseño Local.
- Assistants inherit their encargado's role (`roles.hereda_de_rol_id`): `.agents/modulos/admin/documentacion/asistentes_por_taller.md`.

## 3. Folder map

```text
src/
  app.js              # mounts everything; order matters
  server.js           # entry point
  config/             # env.js (fail-fast), database.js (MySQL pool)
  core/               # shared infrastructure
    auth/ permissions/ websocket/ files/ idempotency/ calendario/ notifications/ utils/
  modules/<name>/     # controllers/ services/ repositories/ routes.js events.js
public/
  css/global.css      # shared design tokens
  login/ dashboard/   # shared pages
  modules/<name>/     # index.html, css/styles.css, js/app.js
database/             # schema.sql, seed.sql, users.sql, migrations/
.agents/              # reglas/ (global rules), modulos/<name>/ (README.md + documentacion/)
```

- `src/app.js` order: public routes and `/api/auth` first.
- Then `authenticateJWT`, then the maintenance gate.
- Everything after `authenticateJWT` is protected.
- Modules register in `MODULOS` (`src/core/permissions/modulesCatalog.js`).
- Never register modules inline in `app.js`.

## 4. Code conventions

**Backend**
- Controllers: HTTP in/out only.
- Services: business rules; no SQL, no `req`/`res`.
- Repositories: all SQL, via `db.query(sql, params, tag)`.
- Always pass the `tag` argument.
- Always parameterize queries.
- Errors go through `responderError`.
- Business errors: plain `Error`, message kept.
- Ids go through `idObligatorio`/`idOpcional`.
- Gate actions by permission, not role name.

**Frontend**
- Vanilla HTML/CSS/JS only.
- Ionicons for icons.
- Reuse `public/css/global.css` tokens.
- Palette and UI rules: `.agents/reglas/reglas_disenoUI.md`.
- Keep DOM ids, classes, `data-*` stable.

**Naming**
- Domain names in Spanish.
- Files: `<x>Controller.js`, `<x>Service.js`, `<x>Repository.js`.
- Permission codes: `<modulo>.<accion>`.
- Storage objects named by correlativo.
- States written in full words.

**Style, comments, commits, docs**
- Simple, cohesive, loosely coupled code.
- SOLID, DRY, KISS; no over-architecture.
- Comments: one short line, "why" only.
- Details: `.agents/reglas/reglas_implementacion.md`.
- Conventional Commits, in Spanish.
- No `Co-Authored-By`, no AI attribution.
- Business rules live in module docs.
- Update module docs when behavior changes.

## 5. Security & auth

- Stateless JWT, not sessions.
- Short-lived access token (cookie `token`).
- Rotating opaque refresh token (cookie `refresh_token`).
- Cookies: httpOnly, sameSite strict.
- Identity comes only from `req.user`.
- Never trust body/query for identity.
- Permissions are enforced in the backend only.
- Hiding a button is not access control.
- Guards (`src/core/permissions/permissionMiddleware.js`):
  - `authenticateJWT`: global; renews expired access token.
  - `requireAuth`: needs `req.user`.
  - `requirePermission('modulo.accion')`: 403 otherwise.
  - `requireModule('modulo')`: 403; Administrador bypasses.
- Spec: `.agents/reglas/reglas_autenticacion.md`.
- Maintenance mode: `.agents/modulos/admin/documentacion/mantenimiento_cuenta_regresiva.md`.

## 6. Environments & critical actions

- `NODE_ENV` required, no default.
- `development`: local machine.
- `staging`: testing domain, production backup, own bucket.
- `production`: real data.
- `test`: automated tests.
- Critical actions run **only in production**.
- Critical: Storage delete/replace, purges, emails, push, webhooks, third-party calls.
- Also critical: any external resource located by a DB value.
- Outside production: do nothing, log it.
- Guarded today: `supabaseStorage.eliminar`, retention watcher.
- New actions: follow `.agents/reglas/reglas_entornos.md`.
- Update its inventory.
- Session cookies are `Secure` in staging and production.

## 7. Real-time & files

- Events: `socketManager.sendToModule(module, event, data)`.
- Clients join with `register_module`.
- Rooms validated server-side.
- Clients refetch on every event.
- Files never live in MySQL.
- Store only the Storage URL.
- Upload + DB endpoints accept `idempotencyKey`.
- Helpers: `src/core/files/supabaseStorage.js`, `subirYRegistrarArchivo.js`.

## 8. Migrations (directive for AI agents)

- Folder: **`database/migrations/`** (formerly `database/migraciones/`).
- Use only the new name; never create or reference the old one.
- Scripts: idempotent, named `NN_topic.sql`.
- The owner imports them by hand in production.
- Never edit `schema.sql`/`seed.sql` for production changes.
- Docs and comments cite scripts **without** the correlativo.

## 9. Pitfalls: mistakes to avoid

- Don't use `database/migraciones/`.
- Don't hardcode defaults for env variables.
- Don't put SQL in controllers or services.
- Don't return raw `error.message` from MySQL/Storage.
- Don't take identity from the request body.
- Don't answer 401 for business errors: `public/js/sessionGuard.js` treats any 401 from `/api/` as an expired session. Use 403.
- Don't register protected routes before `authenticateJWT`.
- Don't register public routes after it.
- Don't delete Storage files outside production.
- Don't add frameworks, Tailwind, bundlers, or TypeScript.
- Don't rename DOM ids, classes, `data-*` in refactors.
- Don't abbreviate states in UI, docs, or reports.
- Don't cite migration scripts with their correlativo.
- Don't rewrite whole files: keep each file's line endings (most are CRLF).
- Don't reference correction cycles in code comments.
- Don't skip documenting a new module in `.agents/modulos/`.
- Module-specific pitfalls: read that module's `README.md`.

## 10. Docs map

| Module | Docs | Purpose |
|---|---|---|
| Vales de Arte (`vales`) | `.agents/modulos/vales de arte/README.md` | Vouchers: create, authorize, assign, deliver, confirm. |
| Administración Central (`admin`) | `.agents/modulos/admin/README.md` | Users, roles, talleres, maintenance, schedules, admin tools. |

- New module: `README.md` section 4, plus `.agents/reglas/reglas_modulo.md` (templates).
- Per module: `README.md` overview, `documentacion/` technical detail.
- Vales extras, in `.agents/modulos/vales de arte/`: `flujo_vale_de_arte.md` (source of truth), `analisis_modulo.md` (history), `correcciones/` (changelog).

Global rules (`.agents/reglas/`):
- `reglas_arquitectura.md`: monolith layers.
- `reglas_modulo.md`: module code templates.
- `reglas_autenticacion.md`: auth spec.
- `reglas_implementacion.md`: implementation and comment style.
- `reglas_disenoUI.md`: palette and UI patterns.
- `reglas_archivosSQL.md`: SQL files split and migrations.
- `reglas_entornos.md`: environments and critical actions.
