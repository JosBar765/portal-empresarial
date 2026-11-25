# Device notifications (desktop and mobile push)

Branch: `feat/notificaciones-dispositivos` (from `origin/dev` 494fb942). No push, PR or deploy without the owner.

## Objective
Let each user receive chosen notification categories as system notifications on desktop and mobile (Android, iOS 16.4+), configured from the bell of each module.

## Why
Today notifications are only visible inside the open portal. An earlier push implementation exists on local branch `rescate/notificaciones-push` (5c2144a, 875 commits behind): reuse its code, do not merge it.

## Approved decisions (owner, 2026-11-25)
- Mockup approved: https://www.figma.com/design/X7Eg6rNsNy6VzsdCf4JHE3 (exact UI texts and layout).
- Single session per user is unchanged.
- The notification center keeps receiving everything as today; push is opt-in per category, off by default, separate desktop and mobile checkboxes.
- Each module configures only its own categories, from a gear button in its bell. No gear when the user has no categories (Prompts, Tiempos, Administración). Dashboard has no bell.
- Only categories the user's role/permissions can receive are listed.
- Checkboxes autosave; on failure the box reverts and the footer explains why. A "Todos" row toggles a column.
- Info icon on the left of each category opens a popover with what it includes.
- Preferences belong to the user; activation belongs to the device. Boxes can be checked without activating.
- Portal asks before the browser prompt; blocked and iOS-not-installed states show instructions.
- Push is allowed in production, staging and development (exception to the critical-actions rule), each with its own VAPID keys; the staging refresh deletes subscriptions. Disabled in `test`.

## Categories
- Vales: Pendientes de autorización (created, modification requested, resent, moved to your authorization); Autorizados y rechazados; Asignación de diseño (assigned, rejected-and-reassigned); Avance del diseño (cancelled, proposal delivered); Aprobación y entrega (workshop approved, shared proposal, general fusion, received confirmed); Rechazo de propuesta (requested, accepted, rejected, cancelled); Revisión de adjuntos (verified, rejected, answered); Mensajes (both rejection chats); Atrasos y por vencer (late, validity expiring, attachments expiring); Bajas y eliminaciones (voucher/workshop removed, expired, moved to drafts).
- Vales center-only (never pushable): corrected, taken, paused, resumed.
- Viáticos: Por autorizar; Autorizadas y rechazadas; Liquidadas; Vencimientos.
- Incidencias: Buzón y asignación (new, returned, reassigned, priority); Avance (taken, progress, waiting, resumed); Verificación y cierre (to verification, correction, closed, discarded); Comentarios.
- Proyectos: Reparto; Seguimiento; Proyecto (closing soon, overdue, auto-activation failed); Aprobaciones; Ventas; Muestras.

## Constraints
- Push never blocks or breaks `notificacionService.registrar`.
- VAPID variables are optional: without them push is off and the UI hides activation.
- No offline cache in the service worker; CSP unchanged unless required.
- Apple browsers revoke subscriptions on silent pushes: always show the notification there.
- Disabled users, password changes and admin revocations delete that user's subscriptions; explicit logout deletes the device's.
- Do not start servers, run migrations or touch the local database without the owner's permission; never read `.env`.
- Migration is additive and idempotent in `database/migrations/` (next number 59); never edit `schema.sql`/`seed.sql`.
- Keep line endings (mostly CRLF), existing DOM ids/classes, existing `tipo` values.
- Commits in Spanish, Conventional Commits, no AI attribution.

## Tasks
- [x] T1 Data and catalog: migration (subscriptions with device class, preferences), category catalog per module with role/permission visibility. Route: delegated (writer trigger).
- [x] T2 Backend push: service, repositories, routes (config, subscribe, unsubscribe, preferences), gate by preference and device class, VAPID env, `web-push`, subscription removal, staging cleanup, environment rules. Route: delegated.
- [x] T3 Types: every Vales notification gets a `tipo`; check the other modules map completely. Route: delegated.
- [x] T4 Frontend: public `sw.js`, manifest, icons, device activation, gear and modal in the bell for all module pages, logout cleanup. Route: delegated.
- [x] T5 Docs (`README` of notifications, modules, `reglas_entornos.md`) and verification. Route: delegated.

## Checks
- Offline tests with stubbed repositories (`node --test`), RED before GREEN for backend behavior.
- `npm run ci:sintaxis`, `npm run ci:migraciones` (only if it needs no database).
- Pending owner: apply migration locally, browser test, phone test on staging, `.env`/`.env.example` VAPID variables.

## Delivery
Forecast well over 400 authored lines. Work-unit commits per task; PR slicing is pending the owner's choice.

## Progress and evidence
- 2026-11-25: branch created; plan written.
- T1 fe31e935: migration `59_notificaciones_dispositivos.sql` (not applied anywhere), `categorias.js`. RED (module missing) then GREEN.
- T2 4a6079c3: push service/repositories, preferences API, env, `web-push`, revocation on disable/password change, staging cleanup, environment rules. RED then GREEN. Added: endpoint allowlist of known push services.
- T3 (see git log): every Vales notification has a `tipo`. RED then GREEN.
- `node --test scripts/notificaciones/`: 27/27. `npm run ci:sintaxis`: 787 files OK. Not run: `ci:migraciones`, `ci:arranque` (need a database); no real push, no browser.
- Route: delegated to one forked writer (writer trigger). RDD assessment: left to the parent.

- T4 2fa8dc2d: public sw.js/manifest, icons, pushDispositivo.js, notificacionesAjustes.js, gear in 7 modules, logout cleanup (capture click on #logout-btn). RED (modules missing) then GREEN: node --test 33/33; ci:sintaxis 792 OK.
- T4 UI checked with a static harness (stubbed API) in headless Edge at 1366x768 and 360px: gear, rows, autosave, revert, column toggle, pre-prompt, popover, Escape. Not checked against a running server, nor a real push.
- T5: notificaciones_dispositivos.md, staging refresh rules, CLAUDE.md push exception.

## API for T4 (authenticated, under /api/notificaciones/push)
- `GET /config` -> `{ habilitado, clavePublica }`
- `POST /suscripcion` `{ endpoint, keys: { p256dh, auth }, dispositivo: 'escritorio'|'movil' }` -> `{ ok }` / 400 `{ error }`
- `DELETE /suscripcion` `{ endpoint }` -> `{ ok }`
- `GET /preferencias?modulo=<id>` -> `{ categorias: [{ id, nombre, descripcion, escritorio, movil }] }` (empty = no gear)
- `PUT /preferencias` `{ modulo, categoria | todas: true, canal: 'escritorio'|'movil', activo: boolean }` -> `{ ok }` / 400 / 403 `{ error }`
- Push payload: `{ titulo, cuerpo, url, tag: 'notif-<id>', nivel, modulo }`
- Service worker: skip only when a portal window is visible and focused, except on Apple browsers (always show).

## Open points
- Maintenance mode closes sessions but keeps subscriptions (not treated as a revocation).
- Session revocation by refresh-token reuse (`tokenService`) keeps subscriptions: outside the edit surfaces.
- Proyectos categories are shown by permission; if the admin matrix turns an event off for a role, the category still shows.
- Explicit logout removes the device subscription, so the user must activate again after logging back in.
- 2026-11-25: diagnostic logging for the hosting (startup state, send failures with service and reason; per-notification detail outside production). Route: inline. RED 3 failing, GREEN 37/37; ci:sintaxis OK.

## Next step
Owner: set VAPID keys in .env, run npm run migrate, test on localhost, then staging with a phone. Choose PR slicing.
