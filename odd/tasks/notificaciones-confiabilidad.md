# Device notifications: reliability fixes

Branch: `fix/notificaciones-confiabilidad` (from `origin/dev` 1576fb5e). No push without the owner. Follows `notificaciones-dispositivos.md`; reference guide `.agents/reglas/reglas_notificaciones.md`.

## Why
Audit on 2026-11-25 after the first staging test.

## Approved scope
- [x] F1 Notification lost when another module is focused: the service worker skips it only when the focused window is on the notification's own module. Apple keeps showing always.
- [x] F2 Logout keeps the owner's choice: the device remembers who activated it and reactivates on that same user's next login. Logout still removes the server row. Another user: stays off until they activate (browser subscription dropped). «Desactivar» forgets the choice.
- [x] F3 A dead or missing subscription is restored on load and when the app returns to the foreground, for the owner with permission granted.
- [x] F4 A subscription made with a different VAPID key is replaced automatically.
- [x] F5 Outside production the log says why recipients got no push (no checkbox, no device of that class) and lists recipient ids.

## Constraints
- No visual or UI text change (no mockup needed).
- Never request permission outside a user click.
- Existing active devices without a remembered owner adopt the current user.
- Offline tests, RED before GREEN. No servers, migrations or database changes.

## Tentative (not approved; the owner will not do all of them)
Phone lost or lent keeps receiving after the session ends; night-time alerts; clicking a notification navigates an open window; test-notification button; hint when active with no boxes checked; open the specific item; quiet hours.

## Progress and evidence
- Route: one bounded writer (fork).
- RED: 9 failing tests of 47. GREEN: `node --test scripts/notificaciones/` 47/47; `npm run ci:sintaxis` 792 files OK.
- F1: `public/sw.js` compares the focused window path with the module path.
- F2-F4: `planSincronizacion` and `mismaClave` in `public/js/pushDispositivo.js`; the push config returns `usuarioId`; runs on load and when the app returns to the foreground.
- F5: `push:diagnostico` query, only outside production and only when someone got no push.
- Not verified: real browser or phone, the diagnostic query against a real database, iOS re-subscription without a tap. `pushsubscriptionchange` is not handled: a lost subscription is restored when the portal is opened.

## Next step
Owner tests by hand, then push and PR when asked.
