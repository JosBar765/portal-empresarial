# Open the referenced record from a notification

Branch: `feat/notificaciones-abrir-registro` (from `origin/dev` f0d62495). No push or PR without the owner.

## Objective
Tapping a notification (system push or bell) opens the record it is about, in the four modules that notify. Owner approved all four on 2026-11-25.

## Design
- One shared path: the push URL is `/modules/<x>/?aviso=<notificationId>`; the page fetches that notification (owner only) and runs the same action as the bell click, marks it read and cleans the URL.
- A portal window already on that module is not reloaded: the service worker posts it a message.
- The login redirect keeps `?aviso=<digits>` and nothing else from the query.
- Vales: ask the server where the voucher is for this user (tab, delivery date, correlativo); switch tab, set the month of the delivery date, clear other filters, type the correlativo in the search box. Deleted or no longer visible: a toast explaining it.
- Viáticos: notifications start storing the request they refer to; open that request.
- Incidencias and Proyectos: reuse their existing bell action.
- No new screens or visual components (no mockup).

## Constraints
- Existing bell behaviour (drafts links) stays.
- Server decides what the user may see; never trust the URL.
- No migration (`referencia_tipo`/`referencia_id` and `vale_id` already exist). Old Viáticos notifications open nothing.
- Offline tests, RED before GREEN.

## Tasks
- [x] A1 Shared plumbing: payload URL, service worker, login destination, notification lookup endpoint, bell script.
- [x] A2 Vales locator and action.
- [x] A3 Viáticos references and action.
- [x] A4 Incidencias and Proyectos through the shared path.
- [x] A5 Guide update.
- [ ] A6 Parent verifies in a browser on localhost; the owner clicks a real system notification.

## Progress and evidence
- Route: bounded writer (fork). RED: 8 failing tests of 8. GREEN: `node --test scripts/notificaciones/` 55/55, security tests 8/8, `ci:sintaxis` 800 files.
- Both locators run read-only against local data: each role gets its tab; outsiders get 404.
- Not verified: any browser run, a real notification click.
- A6 browser (Chrome, localhost, admin test account): Vales from URL, from the service worker message and from the bell (tab, month, search box); deleted voucher shows the toast; another user's notification returns 404. Viáticos moved to the request (simulated notification, real record). Incidencias: route only (no local records). Proyectos: not verified (test account has no project permissions). Pending: real system notification click.

## Next step
A6.
