# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

There is no test suite, linter, or build step configured in `package.json`.

Database: create a MySQL database named `portal_empresarial`, then import `database/schema.sql` (structure only) and `database/seed.sql` (real catalogs/org data) in that order — see `.agents/reglas/reglas_archivosSQL.md` for the split's rationale. Then copy `.env.example` to `.env` and set `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, etc. **MySQL is a hard requirement, not an optional dependency** — `src/config/database.js` has no fallback; if the initial connection fails, the process logs a fatal error and exits (`process.exit(1)`) instead of starting in a degraded state.

Query code (repositories) always goes through `db.query(sql, params, tag)`. The 3rd `tag` argument (e.g. `'vale:insert'`, `'usuario:find_by_id'`) is passed through to every call for consistency/documentation, but MySQL itself ignores it and just runs the parameterized SQL as-is.

Test accounts (seeded in `database/seed.sql`, all passwords match the pattern `<role>123`): `admin@munditrofeos.com` / `admin123` (rol_id 1, Administrador, all permissions), `encargado.diseno@munditrofeos.com` / `disenoenc123` (rol_id 4), `encargado.uv3d@munditrofeos.com` / `uv3denc123` (rol_id 5), `tecnico.a@munditrofeos.com` / `tecnico.b@...` / `tecnico.c@...` / `tecnico123` (rol_id 6, `a`/`b` report to encargado 4, `c` to encargado 5), `asistente@munditrofeos.com` / `asisgeneral123` (rol_id 7), `gerente@munditrofeos.com` / `gerente123` (rol_id 8). Real asesores/supervisores (not `@munditrofeos.com` test accounts) are seeded in `database/seed.sql` — roles were renumbered and the old generic "Diseñador"/"Asesor Comercial"/"Supervisor de Ventas"/"Encargado General" test accounts and roles were removed (analisis_correcciones_16.md #7/#8) since real accounts now cover asesor/supervisor roles.

## Architecture

Single Node/Express **modular monolith** — never split modules into separate services/servers. This constraint is intentional: the target hosting is a managed Node host with MySQL, no Docker/VPS/root access. Do not introduce infrastructure that requires that.

### Auth is JWT, not sessions

Despite `express-session` conventions elsewhere, this app uses **stateless JWT in an httpOnly cookie** (`README.md`'s architecture diagram is stale on this point — `.agents/reglas/reglas_autenticacion.md` is the authoritative spec). Key points:

- The JWT payload (`{ id, nombre, email, rolId, rolNombre, modulosPermitidos, permissions }`) is the single source of truth for identity — never trust `req.body`/`req.query` for who the current user is.
- `src/core/auth/jwtHelper.js` signs/verifies tokens with `JWT_SECRET`.
- `src/core/permissions/permissionMiddleware.js` exports the guards used everywhere:
  - `authenticateJWT` — global interceptor (mounted in `app.js` after public static routes, before protected ones). Reads the `token` cookie or `Authorization: Bearer`, sets `Cache-Control: no-store` on every response to prevent viewing protected pages via browser back/forward cache, and redirects HTML requests to `/login/?expired=true` (or 401s API requests) when the token is missing/invalid.
  - `requireAuth` — asserts `req.user` was set by `authenticateJWT`.
  - `requirePermission('modulo.accion')` — 403s unless `req.user.permissions` includes the code.
  - `requireModule('modulo')` — 403s unless `req.user.modulosPermitidos` includes it; rol_id 1 (Administrador) always bypasses this.
- Static routes must be registered **before** `app.use(authenticateJWT)` in `app.js` if they should be public (see the ordering there); anything registered after is implicitly protected.
- Permission checks belong in the backend only — hiding a button in the frontend is not access control.

### Adding a new business module

Follow `.agents/reglas/reglas_modulo.md` exactly (the README's pointer to `src/modules/reglas_modulo.md` is stale — the guide lives under `.agents/reglas/`) — it has full code templates, and `src/modules/vales/` is now a concrete example of the pattern applied end-to-end. Summary:

1. Backend: `src/modules/<name>/{controllers,services,repositories}/`, plus `routes.js` and `events.js`. Controllers stay thin (HTTP in/out only), services hold business rules, repositories hold all SQL.
2. Frontend: `public/modules/<name>/{index.html, css/styles.css, js/app.js}`, styled to match `public/css/global.css` (shared design tokens) — same typography/colors/proportions as login and dashboard.
3. Register in `src/app.js`: mount `app.use('/api/<name>', requireAuth, require('./modules/<name>/routes'))`, and add an entry to the `catalog` array inside the `/api/modules` handler (id, nombre, descripcion, icono, path, `permission` code, color) — the dashboard lists modules dynamically from this endpoint based on the user's permissions, no frontend changes needed.
4. Add new permission codes (`<modulo>.ver`, `.crear`, etc.) to `database/seed.sql` and assign them to roles.
5. Real-time updates for a module go through `socketManager.sendToModule(moduleName, event, data)`; clients join with `socket.emit('register_module', '<name>')`.

### Business domain: Vales de Arte

`.agents/analisis_modulo_vales_de_arte.md` is the full functional spec (state machine, per-role dashboards/views, PDF layout rules) — it's the source of truth if behavior here seems to disagree with it. It's implemented under `src/modules/vales/` (repositories → `valeService.js` owns the whole state machine and business rules → `valeController.js`/`routes.js`) and `public/modules/vales/` (one adaptive `app.js`/`index.html` that renders different counters/actions per `rolId` rather than separate pages per role — the buzón table columns are identical across roles per spec, only filtering/ordering/actions differ). Core points:

- State machine: `CREADO → ASIGNADO → EN_PROCESO → EN_REVISION → APROBADO → (asesor confirms) VENDIDO | CANCELADO`, with a rejection loop back to `ASIGNADO` and a modification sub-flow (`APROBADO → CONFIRMACION_MODIFICACION → MODIFICADO`, re-entering the encargados' buzón same as `CREADO`, correlativo gets a `MOD-` prefix, only one modification allowed per vale — enforced via `vales.modificado`).
- Roles/permissions (`database/seed.sql` roles 2–6, renumbered by analisis_correcciones_16.md #7): Asesor de Ventas (`vales.crear/confirmar/solicitar_modificacion`), Supervisor de Ventas (`vales.supervisar/aprobar_modificacion`, read-mostly per the spec's own description — don't give it confirm/cancel powers despite one contradictory paragraph in the spec doc), Encargado de Diseño + Encargado de Diseño UV/3D (`vales.asignar/revisar`, share one buzón, each has their own técnicos via `usuarios.encargado_id`), Técnico (`vales.trabajar`, one vale `EN_PROCESO` at a time — enforced in `valeService.comenzar()`). Administrador bypasses all ownership checks (`esAdministrador()` in `valeService.js`) — when adding an admin-facing list (e.g. assignable técnicos), remember admin has no `encargado_id` of its own, so it needs the "all técnicos" branch, not the "técnicos under me" branch. **Note (as of analisis_correcciones_17.md #0):** this bypass only matters where the *service* logic is actually reached — Administrador's own `rol_permisos` row was deliberately trimmed to `vales.ver` + `admin.ver` only, and `requirePermission` (the route guard) has no rol-based bypass, so in practice Administrador can view the buzón/admin panel but not call the write endpoints (asignar/revisar/aprobar-general/confirmar/etc.) — a known, accepted gap, not a bug.
- "Atraso" (delay) is a derived condition based on `fecha_entrega`, not a stored state — `calcularAtraso()` computes it live (frozen at `actualizado_en` once a vale reaches `VENDIDO`/`CANCELADO`, live otherwise).
- The generated PDF (`valePdfService.js`, via `pdf-lib`) is authoritative output for a vale, regenerated on creation and on modification; attached PDF documents get their pages copied in at the end via `pdfDoc.copyPages`. Images/attachments are never stored in MySQL, only their resulting public URL (`src/core/files/supabaseStorage.js`, uploaded to Supabase Storage — see `.env.example` for `SUPABASE_*`) via `vale_documentos`. Uploads go through `multer` (memory storage) and `src/core/files/subirYRegistrarArchivo.js` (Storage-then-DB with rollback on DB failure, throwing `StorageUploadError`/`DatabaseInsertError`/`StorageRollbackError`) — see `routes.js`. The 3 endpoints that combine a file upload with a DB write (crear vale, entregar propuesta, aprobar general) accept an `idempotencyKey` form field, checked server-side against the generic `idempotency_keys` table so a network retry doesn't duplicate the upload/row.
- Daily vale limit per asesor (`asesor_limites.limite_diario`, default 6): once hit, a new vale is still created but silently dated for the next day rather than being blocked (`valeService.crearVale`) — this is a literal spec requirement, not a bug.
- Real-time updates: all vales-module clients join one shared `'vales'` Socket.IO room (`events.js` / `socketManager.sendToModule`) and get a generic `vale_evento` they react to by refetching their buzón — simpler and more robust than maintaining per-role/per-user rooms.

### Frontend conventions

No frontend framework or Tailwind — vanilla HTML/CSS/JS with Ionicons for icons. `public/css/global.css` holds shared design tokens; module CSS should import/extend it rather than redefine colors/typography, to keep visual consistency with `public/login` and `public/dashboard`. `.agents/sistema_diseno_ui.md` is the high-level reference for the color palette (including the `--color-primary` vs `--color-primary-dark` role split — light blue for selection/emphasis, dark navy for primary-action surfaces/buttons) and overall design line — read it before touching colors, typography, or shared UI patterns.
