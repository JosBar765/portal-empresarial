# Respaldo de producción

## Objetivo
`npm run main:backup` descarga una copia completa de la base de producción a un `.sql` en el PC del dueño (sin `mysqldump`, solo lectura, fecha en el nombre) para usarla antes de cada despliegue y restaurarla con phpMyAdmin o DBeaver.

## Decisiones
- Script nuevo `scripts/backup/respaldar.js`; reutiliza `scripts/staging/lib` (config `ORIGEN_*`, `conectarOrigen`, normalización de valores, marca de entorno).
- Solo lectura demostrable: lista blanca de sentencias (`guardaSoloLectura.js`) aplicada a `query`/`execute`/`prepare` de la conexión de ORIGEN antes de enviar.
- Aborta si ORIGEN lleva `entorno = staging`; confirmación tecleando el nombre de la base.
- Nombre `<base>_<AAAA-MM-DD>.sql`; nunca sobrescribe (`_HHmm`, luego contador); `--comprimir` => `.sql.gz`.
- Verificación con `COUNT(*)` en el mismo snapshot; discrepancia => exit 1 y el archivo se conserva.
- `respaldos/` y `*.sql.gz` en `.gitignore`.

## Tareas
- [x] T1 Script, guarda de solo lectura, reutilización mínima en `scripts/staging/lib`, npm scripts, `.gitignore` (cd97084)
- [x] T2 Documentación (`reglas_respaldo_produccion.md`, README, puntero en `reglas_refresco_staging.md`) y este plan

## Comprobaciones (solo contra Docker local)
- Respaldo de `munditrofeos` (44 tablas, 6373 filas): verificación correcta, conteos iguales antes/después.
- Sesión de solo lectura: CREATE/DELETE rechazados por el servidor; la guarda rechaza antes de enviar.
- Sentencias en el cable: SELECT, SHOW, SET SESSION, START TRANSACTION (ninguna de escritura).
- Restauración en `retencion_test`: mismos `COUNT(*)` y `CHECKSUM TABLE` en las 44 tablas, también sobre una base ya poblada.
- Guardas: marca staging, confirmación errónea, carpeta inválida; `.sql.gz` idéntico al plano.
- `npm run ci:sintaxis` y `npm run main:backup:probar-guarda`.

## Progreso
- T1: cd97084
- T2: ver commit de documentación

## Sin confirmar (solo contra el servidor real)
Tamaño máximo de subida de phpMyAdmin en Hostinger, diferencias MariaDB/MySQL en el DDL real de producción y tiempos por la red.
