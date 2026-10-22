# ejecutor-migraciones

Rama: `feat/ejecutor-migraciones` (desde `dev`) · Estado: T1-T4 hechas.

## Objetivo
Reemplazar el paso manual «el dueño importa los scripts de migración» por un ejecutor que aplica los pendientes al arrancar el servidor en `staging` y `production`, y a demanda en otros entornos.

## Decisiones (del usuario)
- Ejecutor en `src/core/migrations/ejecutor.js`, conexión propia (el pool no se toca), `multipleStatements`, zona -06:00.
- Tabla `schema_migrations` (nombre, checksum SHA-256 con LF, aplicada_en, duracion_ms); se registra solo un script completo.
- Bloqueo `GET_LOCK('portal_migraciones', 60)`; un script aplicado y editado solo avisa.
- Arranque: `staging` y `production` migran (error = `[FATAL]` y exit 1); `development`/`test` no, usan `npm run migrate`.
- Sin línea base: los scripts son idempotentes, la primera corrida los registra.
- `schema_migrations` también en `schema.sql` (se reflejan las tablas de runtime `sesiones_activas` e `idempotency_keys`); el ejecutor la crea igual.

## Tareas
- [x] T1 Ejecutor + funciones puras + tabla en schema.sql — 28e8141
- [x] T2 Gancho en server.js, CLI `scripts/migrate.js`, npm `migrate` y `migrate:estado` — 9cb2cd0
- [x] T3 CI usa el ejecutor (dos pasadas + conteo de filas + re-ejecución directa) — 7e248d2
- [x] T4 Documentación y este plan — commit de documentación (ver `git log`)

## Comprobaciones (base desechable `retencion_test`)
- Primera corrida aplica las 14 y las registra; la segunda aplica 0.
- Checksum alterado: aviso y sin re-ejecución.
- Carpeta con un .sql roto: error con el nombre del archivo, el bueno anterior queda registrado y el roto no.
- Dos ejecutores en paralelo: cada script corre una sola vez (bloqueo).
- `npm run ci:sintaxis`, `npm run ci:migraciones`, `npm run migrate` y `npm run migrate:estado` correctos.
- Pendiente: el gancho de `server.js` solo se confirma en la primera corrida real en `staging` o en el CI de arranque.

## Siguiente paso
PR a `dev`; luego `staging` (revisar el log `[Migraciones]` y `SELECT nombre, aplicada_en FROM schema_migrations`), y después `main`.
