# A designer can cancel the process after having delivered

Branch: `fix/vales-cancelar-tras-entregar` (from `origin/dev` ed8c6728). No push without the owner.

## Problem
After delivering once (even if disapproved), the designer loses «Cancelar proceso» for that voucher, and the workshop lead cannot reassign while it is in process.

## Approved behaviour (owner, 2026-11-26)
- The designer may cancel whenever the voucher is «En proceso», with or without earlier deliveries.
- Cancelling voids that designer's earlier proposals of that voucher: they are not shown as proposals and cannot be approved. Files stay stored (numbering and retention still count them).
- «Revisar propuesta» says the designer cancelled; only «Desaprobar y reasignar» is possible.
- A new delivery after that is a normal proposal.

## Tasks
- [x] T1 Additive migration `62_*` (60 and 61 belong to PR #236) marking void proposals; void them on cancel; every «current/latest proposal» read ignores them; remove the cancel block and the `ya_entrego_propuesta` flag. Offline tests, flow doc.
- [x] T2 Apply the migration locally (owner permission) and verify by API and browser, desktop and phone width.

## Delivery
Route: one bounded writer (fork). Local database migration needs the owner's permission.

## Evidence
- T1 (c9c4bfcf): RED `listarVigentesPorVale` / `anularDeDisenador` missing and cancel rejected; GREEN `scripts/vales/*.test.js` 11/11, `ci:sintaxis` 804 files. Migration not run; no query executed against a database.
- Void marker: `vale_propuestas.anulada_en`. Cancel voids first, in one transaction with the single-workshop general copy, then changes the state.

- T2 (2026-11-27): migration applied locally with owner permission; API cycle deliver, disapprove, cancel, approve rejected, disapprove, deliver again, approve; review modal checked on desktop. No CSS or markup change, phone width not checked.
- Owner accepted: the previous merged proposal stays visible; same designer in two workshops (admin only) left as is.

## Next step
Push and PR when the owner asks.
