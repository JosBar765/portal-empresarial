# Refresco de staging desde producción (Fase 2b)

## Objetivo
Comando local que reemplaza la base de staging por una copia de producción sin `mysqldump`, más una prueba de conexión de solo lectura. Tras el refresco se reinicia staging y el ejecutor de migraciones aplica lo pendiente.

## Decisiones
- ORIGEN solo lectura (`SET SESSION TRANSACTION READ ONLY` verificada + snapshot consistente); DESTINO se vacía por completo y se reescribe.
- DDL exacto con `SHOW CREATE TABLE`; filas por streaming en lotes (500 filas / 4 MB); JSON como texto UTF-8; sesiones en UTC.
- Confirmación escribiendo el nombre de la base DESTINO (o `--confirmar`); `--solo-limpieza` para la alternativa con DBeaver.
- Limpiezas de staging en `scripts/staging/lib/limpiezas.js`: mantenimiento apagado y `sesiones_activas` vacía.
- Credenciales solo en `scripts/staging/.env.refresco` (ignorado por git), cargadas con dotenv y `--archivo`.
- Sin dependencias nuevas.

## Tareas
- [x] T1 lib (config, conexiones) y `probar-conexion.js`
- [x] T2 `refrescar.js`, motor de copia y limpiezas
- [x] T3 gitignore, plantilla de configuración y comandos npm
- [x] T4 documentación (`reglas_refresco_staging.md`, CLAUDE.md, README, reglas_entornos.md) y este plan

## Comprobaciones (todas en Docker local, munditrofeos -> retencion_test)
- [x] Prueba de conexión sin escribir nada; errores de configuración; ORIGEN = DESTINO rechazado; confirmación errónea aborta.
- [x] Refresco completo: 44 tablas, 6373 filas, COUNT(*) y CHECKSUM TABLE iguales, 70 FK y motor InnoDB conservados.
- [x] ORIGEN rechaza INSERT/DELETE (`ER_CANT_EXECUTE_IN_READ_ONLY_TRANSACTION`); munditrofeos sin cambios.
- [x] Limpiezas con `--solo-limpieza` y dentro del refresco completo; segunda ejecución idempotente.
- [x] `npm run ci:sintaxis`.
- [ ] Pendiente en servidores reales: conexión remota a Hostinger, MariaDB, privilegios y tiempos.

## Progreso
- T1 `d8218e9`
- T2 `11e2008`
- T3 `3ca1f53`
- T4 (ver el historial de la rama)
