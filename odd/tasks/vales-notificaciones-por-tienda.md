# Vales notifications follow the supervisor's selected stores

Branch: `feat/vales-notificaciones-por-tienda` (from `origin/dev` ed8c6728). No push without the owner.

## User story (supervisor, 2026-11-26)
Select some of the assigned stores, see and receive notifications only for those, without losing the history of the others (supervisors rotate).

## Approved behaviour
- Mockup: https://www.figma.com/design/X7Eg6rNsNy6VzsdCf4JHE3?node-id=7-2 (page «Campana por tiendas v1»; collapsed variant approved).
- Every notification is still stored; the selection only decides what is shown.
- With a selection: bell list, bell count, dashboard badge, toast, sound and push include only the selected stores (and selected special-supervision advisors). No selection: everything, as today.
- Switching selection reveals what arrived meanwhile as unread; no retroactive push.
- The supervisor's own vouchers and notifications without a store always show.
- Bell subtitle «Mostrando: …». Block at the bottom, collapsed by default: «N sin leer en M tiendas que no ves» with «Toca para ver cuáles»; expanded: one compact row per store with unread («tienda · cantidad · Ver») and «Ver todas mis tiendas». «Ver» adds the store to the selection. Hidden when nothing is unread outside.
- «Marcar todas como leídas» marks only what is shown.
- The selection is the same one as the Buzón store filter, stored on the server so it applies to push and follows the user across devices.
- Only for supervisors; Administrador and Gerente keep today's behaviour. Other modules unchanged.
- Bell keeps its 30-day retention.

## Constraints
- Always verify responsive (desktop and ~360-390 px). Owner rule.
- Additive idempotent migration `60_*`; never edit applied ones or `schema.sql`/`seed.sql`. Do not run it on the local database without the owner's permission.
- Temporarily removing the store filter when opening a voucher from a notification must not change the saved selection.
- The server decides which stores a user may select; never trust the client.
- Offline tests, RED before GREEN. Keep CRLF, ids, classes; no inline handlers.

## Tasks
- [x] B1 Data: store and advisor on each Vales notification (with backfill from the voucher) and the saved selection.
- [x] B2 Server: save/read selection; filter list, counts, summary, mark-all and push; per-store unread counts.
- [x] B3 Client: persist the Buzón filter to the server, bell subtitle and block, toast/sound filter, live updates.
- [x] B4 Docs (flow, notifications guide).
- [ ] B5 Browser verification with responsive after the owner allows the local migration.

## Progress and evidence
- Route: one bounded writer (fork). RED: `alcanceAvisos` module missing. GREEN: `node --test scripts/notificaciones/` 55/55, `scripts/vales/alcanceAvisos.test.js` 8/8, `avisoAtraso.test.js` 4/4, `ci:sintaxis` OK. `ci:migraciones` not run (needs a CI database).
- Commits: 2d4dbecb (data and server), 2dafc61c (client), 79656fb5 (this document), 0b9e03f3 (guide and flow).
- Visibility rule checked read-only on the local engine with inline rows (7 cases). The migration and the new queries have not run against real tables.
- Responsive: static harness with the real CSS and bell script at 360x700 and in a 1366x768 window, collapsed and expanded; fixed a truncated subtitle and a squashed list.
- Decisions: server is the source of truth, with a `guardado` marker so an old browser value is not uploaded again; selection pruned on load; stores no longer assigned appear in the block without «Ver»; a special advisor whose store is not selectable gets its own row.
- Open: after an administrator reassigns stores, the old selection is pruned only when the supervisor next opens Vales; until then push for the new stores is silent.

## Next step
B5: the owner allows `npm run migrate` on the local database, then browser verification. Until the migration runs, notifications fail on a server running this branch.
