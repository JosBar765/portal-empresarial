# Reglas de Integración Continua (CI)

Cada pull request hacia `dev`, `staging` o `main` ejecuta el workflow `.github/workflows/ci.yml` (job `verificar`). También se puede lanzar a mano desde la pestaña Actions (`workflow_dispatch`). Fase 1: solo verifica; no despliega ni usa secretos.

## Qué verifica

1. **Sintaxis** (`npm run ci:sintaxis`): todo el JS de `src/`, `scripts/` y `public/` debe parsear. El backend es CommonJS; en `public/` vale como script clásico o como módulo ES.
2. **Scripts de base de datos** (`npm run ci:migraciones`), sobre una MySQL 8.0 temporal:
   - **Escenario A, instalación nueva**: vacía la base, importa `schema.sql`, `seed.sql` y `users.sql` del PR y aplica las migraciones con el ejecutor.
   - **Escenario B, actualización estilo producción**: vacía la base, importa esos tres archivos tal como están en `origin/main` y aplica las migraciones del PR con el ejecutor (`src/core/migrations/`). Si un archivo no existe en `origin/main`, usa el del PR y lo avisa.
   - En ambos, el ejecutor corre **dos veces**: la segunda debe aplicar 0 scripts y `schema_migrations` debe tener una fila por script. Después cada script se vuelve a ejecutar directamente para comprobar su idempotencia.
3. **Arranque** (`npm run ci:arranque`): levanta `node src/server.js` con `NODE_ENV=test` contra la base resultante, espera hasta 30 s a que escuche, pide `/login/` (200) y `/api/modules` sin sesión (401), y falla si la salida contiene `[FATAL]`.

## Qué NO verifica

- Peculiaridades de los datos reales de producción (el escenario B parte de los scripts de `main`, no de una copia de la base).
- Lógica de negocio ni interfaz: no hay pruebas funcionales ni de UI.
- Diferencias del hosting: versión de MySQL, variables de entorno reales, Supabase real (el CI usa valores falsos), proxy inverso.

## Cómo leer un fallo

- Abre el job `verificar` en la pestaña Checks del PR y busca el paso en rojo.
- **Sintaxis**: línea `[FALLO] ruta: mensaje` con el archivo y el error del parser.
- **Base de datos**: línea `FALLO` con el archivo SQL (o la pasada del ejecutor) seguida del error de MySQL. Un fallo en la «re-ejecución directa» indica que el script no es idempotente.
- **Arranque**: se imprime la salida completa del servidor; un `[FATAL]` apunta a una variable de `src/config/env.js` o a la conexión MySQL.

## Ejecutarlo en local

- `npm run ci:sintaxis`: no necesita nada más.
- `npm run ci:migraciones`: necesita una base **desechable** (el script borra todas sus tablas) y estas variables: `CI_DB_HOST`, `CI_DB_PORT`, `CI_DB_USER`, `CI_DB_PASSWORD`, `CI_DB_NAME`. Nunca apuntarlo a la base de trabajo. El escenario B necesita `origin/main` actualizado (`git fetch origin`).
- `npm run ci:arranque`: pensado para el CI. En este proyecto el servidor de desarrollo lo levanta solo su dueño; no se ejecuta en local.
- `npm run ci` encadena los tres.

## Hacer obligatorio el chequeo (lo aplica el dueño del repositorio)

En GitHub: Settings > Rules > Rulesets, editar el ruleset de cada rama protegida (`dev`, `staging`, `main`), activar **Require status checks to pass** y añadir el check `verificar`. El check solo aparece en la lista después de haberse ejecutado al menos una vez.
