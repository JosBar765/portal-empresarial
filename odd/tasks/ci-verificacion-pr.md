# CI fase 1: verificación en pull requests

## Objetivo

Que cada PR hacia `dev`, `staging` y `main` verifique sintaxis JS, scripts SQL (instalación nueva y actualización estilo producción, idempotencia) y arranque del servidor, sin secretos ni despliegue.

## Decisiones

- Solo fase 1: CI. Despliegues, secretos, respaldos y modo mantenimiento quedan fuera.
- El dueño hará el check `verificar` obligatorio en los rulesets más adelante (instrucciones en `.agents/reglas/reglas_ci.md`).
- Corre en PRs a `dev`, `staging` y `main` y manualmente.
- Scripts en `scripts/ci/` con Node y dependencias existentes; MySQL 8.0 como service container con contraseña desechable.
- El arranque nunca se ejecuta en local: la primera ejecución real es en GitHub Actions.

## Tareas

- [x] T1 Scripts `scripts/ci/{sintaxis,migraciones,arranque}.js` y scripts npm. Commit 01b5f8d.
- [x] T2 Workflow `.github/workflows/ci.yml`. Commit 2e6e933.
- [x] T3 Documentación: `reglas_ci.md`, CLAUDE.md, README.md y este plan. Commit `docs(ci)` de esta rama.

## Checks

- [x] `npm run ci:sintaxis`: 195 archivos correctos; detecta error real y acepta módulos ES en `public/`.
- [x] `npm run ci:migraciones` en local (base desechable): escenarios A y B correctos, migraciones dos veces.
- [ ] `ci:arranque` y el workflow completo: pendientes de la primera ejecución en el PR.

## Progreso

Ruta de implementación: delegada (un escritor). Siguiente paso: abrir el PR a `dev` y confirmar la primera ejecución.
