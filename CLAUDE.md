# CLAUDE.md

Master guide of the MundiTrofeos business portal (modular monolith). It holds only what applies to the whole platform. Everything specific to a module lives in `.agents/modulos/<module>/` (see the module index in section 5).

## 1. Project overview

- Corporate web platform that hosts several internal tools (modules) behind one login and one dashboard. Today: Vales de Arte and Administración Central.
- Single Node/Express **modular monolith**. Never split modules into separate services/servers. This is intentional: the target hosting is a managed Node host with MySQL, no Docker/VPS/root access. Do not introduce infrastructure that requires that.
- **MySQL is a hard requirement**, not an optional dependency: `src/config/database.js` has no fallback; if the initial connection fails the process logs a fatal error and exits (`process.exit(1)`) instead of starting degraded.
- Stack: Node.js + Express, MySQL, Socket.IO, vanilla HTML/CSS/JS with Ionicons, Supabase Storage for files.

## 2. Commands & setup

There is no test suite, linter, or build step configured in `package.json`. Security tests live in `scripts/security/` and need a disposable DB (see `.agents/modulos/vales de arte/documentacion/plan_remediacion_30.md`).

1. Create a MySQL database named `portal_empresarial`.
2. Import, in this order: `database/schema.sql` (structure only), `database/seed.sql` (real catalogs/org data), `database/users.sql` (users, talleres and their assignments). Rationale of the split: `.agents/reglas/reglas_archivosSQL.md`.
3. Copy `.env.example` to `.env` and fill in **every** variable. All are required, there are no defaults: `src/config/env.js` prints one `[FATAL]` line per missing/invalid variable and exits.
   - `NODE_ENV`: `development|staging|production|test`.
   - `JWT_SECRET`: at least 32 chars.
   - Token lifetimes (`ACCESS_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`): `<int><s|m|h|d>`.
   - `SOCKET_CORS_ORIGIN`: exact origin(s), no trailing slash, never `*`.
   - `TRUST_PROXY`: hops of reverse proxy (0 = none).
   - `DB_PASSWORD`: may be empty only outside production.
4. Run with `npm run dev` (watch mode), served at `http://localhost:3000`.

**Accounts:** all users are loaded by `database/users.sql` with `@grupopremia.com` / `@trofex.com` emails. The shared development password of each role is written in the comment at the top of that file and **must be changed in production**. The Administrador (rol_id 1) is `admin@grupopremia.com`.

**Roles:** 1 Administrador, 2 Asesor, 3 Supervisor, 4 Encargado de Diseño, 5 Encargado de Diseño UV/3D, 6 Diseñador, 7 Asistente, 8 Gerente, 9 Encargado de Protextil, 10 Encargado de Diseño Local. The assistants (rol 7 and those of UV/3D, Protextil and Diseño Local) are roles with `roles.hereda_de_rol_id` pointing to their encargado's role: see `.agents/modulos/admin/documentacion/asistentes_por_taller.md`.

## 3. Global project rules

### Development guidelines
- Backend and frontend follow the layers of section 5; do not mix responsibilities across layers.
- Permission checks belong in the backend only: hiding a button in the frontend is not access control.
- Never trust `req.body`/`req.query` for who the current user is; identity comes only from the JWT (`req.user`).
- Documentation-first for module work: business rules live in `.agents/modulos/<module>/`; update them when behavior changes.

### Express.js (backend) conventions
- **Controllers** are thin (HTTP in/out only), **services** hold business rules, **repositories** hold all SQL.
- Repositories always query through `db.query(sql, params, tag)`. The 3rd `tag` argument (e.g. `'vale:insert'`, `'usuario:find_by_id'`) is passed on every call for consistency/documentation; MySQL ignores it and runs the parameterized SQL as-is.
- Controllers answer errors with `responderError` (`src/core/utils/erroresHttp.js`): business errors (plain `Error`s thrown by services) keep their message; MySQL/Storage/bug errors become a generic 500 and only the log has the detail. Never `res.json({ error: error.message })` directly.
- Ids from URLs/bodies go through `idObligatorio`/`idOpcional` (`src/core/utils/validar.js`).
- Actions are gated by **permission** (`requirePermission` in `routes.js`), not by role name.

### Vanilla JS / frontend conventions
- No frontend framework or Tailwind: vanilla HTML/CSS/JS with Ionicons for icons.
- `public/css/global.css` holds the shared design tokens; module CSS imports/extends it instead of redefining colors/typography, to stay consistent with `public/login` and `public/dashboard`.
- `.agents/reglas/reglas_disenoUI.md` is the reference for the color palette (including the `--color-primary` vs `--color-primary-dark` split: light blue for selection/emphasis, dark navy for primary-action surfaces/buttons) and the overall design line. Read it before touching colors, typography or shared UI patterns.

### Naming conventions
- Domain names (tables, columns, states, permissions, file names) are in Spanish; code identifiers follow the existing style of the module.
- Backend files: `controllers/<x>Controller.js`, `services/<x>Service.js` (e.g. `vale*Service.js`), `repositories/<x>Repository.js`, plus `routes.js` and `events.js` per module.
- Permission codes: `<modulo>.<accion>` (e.g. `vales.ver`, `admin.horarios.gestionar`).
- Storage objects are named after the document's correlativo, never after the uploaded file name (`src/core/files/nombreArchivo.js`). Module-specific details live in the module docs.
- Statuses and states are written with their full name, never with abbreviations.

### Comments
- Code comments as short as possible; the detail goes to the module docs/changelog. Style rules: `.agents/reglas/reglas_implementacion.md`.

### Commits
- Conventional Commits, in Spanish (e.g. `docs: ...`, `feat(vales): ...`, `fix(admin): ...`).
- Never add `Co-Authored-By` or any AI attribution line.

## 4. Environments & critical actions

- `NODE_ENV` is required, no default: `development` (local machine), `staging` (testing domain: HTTPS, a restored production backup, its own Storage bucket), `production`, `test` (automated tests).
- **Platform-wide rule:** critical actions (deleting/replacing Storage files, automatic purges, emails, push, webhooks, third-party API calls, anything that uses a DB value to locate an external resource) run **only with `NODE_ENV=production`** and do nothing otherwise, because staging/development databases are restored from production backups. Today: the Storage deletion guard in `supabaseStorage.eliminar` and the retention watcher.
- Every new module/action must follow `.agents/reglas/reglas_entornos.md` (rules, how to implement, inventory to update).
- Session cookies are `Secure` in `staging` and `production`.

## 5. Architecture of modules

### Layout
- `src/core/*`: shared infrastructure used by every module.
  - `auth/` (JWT, tokens, sessions), `permissions/` (guards, `modulesCatalog.js`, maintenance gate), `websocket/` (`socketManager`), `files/` (Supabase Storage, naming, upload helpers), `idempotency/`, `calendario/` (working hours/holidays), `notifications/`, `utils/` (`erroresHttp`, `validar`, logs).
- `src/config/`: `env.js` (fail-fast variables) and `database.js` (MySQL pool).
- `src/modules/<name>/{controllers,services,repositories}/` + `routes.js` + `events.js`: one folder per business module.
- `public/modules/<name>/{index.html,css/styles.css,js/app.js}`: the module's frontend. `public/login`, `public/dashboard`, `public/css/global.css` are shared.
- `src/app.js` mounts everything. Order matters: public static routes and `/api/auth` come first, then `app.use(authenticateJWT)` and the maintenance gate; **anything registered after `authenticateJWT` is implicitly protected**.
- `src/core/permissions/modulesCatalog.js` (`MODULOS`) registers the modules; it feeds `/api/modules` (dashboard cards) and the `/modules/<id>` gate. Modules are not registered inline in `app.js`.

### Authentication (stateless JWT, not sessions)
- Authoritative spec: `.agents/reglas/reglas_autenticacion.md`.
- The JWT payload (`{ id, nombre, email, rolId, rolNombre, modulosPermitidos, permissions }`) is the single source of truth for identity. A short-lived **access token** (cookie `token`) is paired with an opaque, rotating **refresh token** (cookie `refresh_token`; only its SHA-256 hash is stored in `sesiones_activas`). Both cookies are httpOnly + sameSite strict. `src/core/auth/tokenService.js` issues/rotates them and `authenticateJWT` renews an expired access token transparently, re-reading role/permissions/`activo` from the DB.
- Guards in `src/core/permissions/permissionMiddleware.js`:
  - `authenticateJWT`: global interceptor; reads the `token` cookie or `Authorization: Bearer`, sets `Cache-Control: no-store`, redirects HTML requests to `/login/?expired=true` (401 for API requests) when the token is missing/invalid.
  - `requireAuth`: asserts `req.user` was set.
  - `requirePermission('modulo.accion')`: 403 unless `req.user.permissions` includes the code.
  - `requireModule('modulo')` / `requireModuleAccess`: 403 unless `req.user.modulosPermitidos` includes it; rol_id 1 (Administrador) always bypasses this.
- Maintenance mode (`maintenanceGate`, after `authenticateJWT`; `/api/auth` is mounted before it) is an Administración feature: see `.agents/modulos/admin/documentacion/mantenimiento_cuenta_regresiva.md`.

### Real-time
- Events go through `socketManager.sendToModule(moduleName, event, data)`; clients join with `socket.emit('register_module', '<name>')`.
- Each event is sent only to the rooms it concerns; rooms are validated server-side per connection. Clients refetch their data on each event. The rooms of each module are documented in its own docs.

### Files and idempotency
- Files are never stored in MySQL, only their Supabase Storage URL (`src/core/files/supabaseStorage.js`, `subirYRegistrarArchivo.js`).
- Endpoints that combine upload + DB write accept an `idempotencyKey` form field checked against the `idempotency_keys` table (`src/core/idempotency/`).

### Module index

| Module | Docs | Purpose |
|---|---|---|
| Vales de Arte (`vales`) | `.agents/modulos/vales de arte/README.md` | Creation, authorization, assignment to talleres, delivery and confirmation of art vouchers, with real-time buzón per role. |
| Administración Central (`admin`) | `.agents/modulos/admin/README.md` | Users, roles, permissions, talleres, maintenance mode, working hours/holidays and admin tools. |

## 6. Guide: create a new module from scratch

Code templates: `.agents/reglas/reglas_modulo.md` (the old README pointer to `src/modules/reglas_modulo.md` is stale). Concrete examples of the pattern: `src/modules/vales/` and `src/modules/admin/`. Replace `<name>` with the module id.

1. **Backend folders:** create `src/modules/<name>/{controllers,services,repositories}/`, `routes.js` and `events.js`.
   - Routes declare each endpoint with `requirePermission('<name>.<accion>')`.
   - Controller: HTTP in/out only, errors through `responderError`, ids through `idObligatorio`/`idOpcional`.
   - Service: business rules; no SQL, no `req`/`res`.
   - Repository: all SQL through `db.query(sql, params, tag)`.
2. **Mount the API** in `src/app.js` after `authenticateJWT`: `app.use('/api/<name>', requireAuth, requirePermission('<name>.ver'), require('./modules/<name>/routes'))`.
3. **Register the module** in `MODULOS` of `src/core/permissions/modulesCatalog.js` (id, nombre, descripcion, icono, path, `permission`, color). The dashboard lists modules dynamically; no frontend change needed.
4. **Permissions:** add the codes (`<name>.ver`, `.crear`, ...) to `database/seed.sql` and assign them to roles. For databases already in production, also add an idempotent script in `database/migrations/` (see section 7).
5. **Frontend:** create `public/modules/<name>/{index.html,css/styles.css,js/app.js}`, styled with `public/css/global.css` tokens (same typography/colors/proportions as login and dashboard).
6. **Real-time:** send events from `events.js` with `socketManager.sendToModule`; the client joins with `register_module`.
7. **Critical actions:** anything touching real data or files outside the module's own tables (Storage deletion, purges, emails, third-party calls) must run only in production: follow `.agents/reglas/reglas_entornos.md`.
8. **Document the module:** create `.agents/modulos/<name>/README.md` (purpose, dependencies, where the code lives, key rules, index of docs) and `.agents/modulos/<name>/documentacion/` (deep technical docs). Add the module to the index in section 5.

## 7. Migrations (directive for AI agents)

- The folder for database scripts is **`database/migrations/`** (formerly `database/migraciones/`). Use only the new name; never create or reference the old one.
- Existing (production) databases are updated with idempotent scripts named `NN_topic.sql` in that folder, imported by hand by the owner, with comments explaining each table/column.
- Never change a production database by editing `schema.sql`/`seed.sql`; those describe fresh installs.
- Docs and comments cite scripts by name **without** the correlativo (e.g. `script.sql`), because several people work in parallel and correlativos can collide.

## 8. Where to find things

Rules (`.agents/reglas/`):
- `reglas_arquitectura.md`: architecture of the monolith and its layers.
- `reglas_modulo.md`: step by step and code templates for a new module.
- `reglas_autenticacion.md`: authoritative auth spec (JWT, refresh, guards).
- `reglas_implementacion.md`: implementation and comment style rules.
- `reglas_disenoUI.md`: palette, typography and UI patterns.
- `reglas_archivosSQL.md`: `schema.sql` / `seed.sql` / `users.sql` / migrations split.
- `reglas_entornos.md`: environments and critical actions.

Per module (`.agents/modulos/<module>/`): `README.md` for the overview and `documentacion/` for technical detail. Vales de Arte also has `flujo_vale_de_arte.md` (source of truth for the flow), `analisis_modulo.md` (original spec, history only) and `correcciones/` (changelog history).
