# Buzón remembers the selected period

Branch: `feat/vales-periodo-recordado` (from `origin/dev` ed8c6728). No push without the owner.

## User story (supervisor, 2026-11-26)
The date selector must not reset on reload or after leaving the platform.

## Approved behaviour
- Per user and browser; Buzón and «Trabajo realizado» (shared period). Reportes unchanged.
- Only a future day, week or month is kept. Current or past opens the current one of the same type (owner: looking back is a momentary query).
- A range is kept while it has not ended (owner confirmed).
- Opening a notification moves the period without saving it.

## Tasks
- [x] D1 Remember and restore the period, with tests and flow doc.

## Evidence
- Route: inline (one small module plus its wiring).
- RED: module missing. GREEN: `scripts/vales/periodoRecordado.test.js` 4/4, `avisoAtraso` 4/4, `ci:sintaxis` OK.
- Browser (localhost, admin test account): next month kept after reload; past month opens November after leaving; next week kept; 375 px without overflow.
- Shares `toolbar.js` with PR #236; different lines.

## Next step
Owner tries it; push and PR when asked.
