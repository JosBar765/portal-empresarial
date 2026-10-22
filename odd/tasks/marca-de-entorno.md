# Marca de entorno en la base (staging vs producción)

## Objetivo
Impedir que alguien (o un script) cruce ORIGEN y DESTINO en el refresco de staging, y que un servidor corra contra la base de otro entorno.

## Decisiones
- La marca vive en la propia base: `parametros_sistema`, `clave = 'entorno'`, `valor = 'staging'`. Solo la base de staging la lleva.
- Producción nunca tiene marca y estas herramientas nunca la escriben; se reconoce por la ausencia de la marca staging.
- `refrescar`: DESTINO debe tener la marca, ORIGEN no; lo comprueba antes de borrar nada y muestra un resumen previo del DESTINO. `--solo-limpieza` también exige la marca. Tras copiar y limpiar, la reescribe.
- `marcar`: guardias (sin «prod» en el nombre, nombre escrito, tabla existente), escritura idempotente, nunca toca ORIGEN.
- Servidor (`verificarMarca`, antes de migrar): staging exige la marca; producción falla si la ve; development y test no comprueban. Staging falla cerrado ante cualquier error de lectura; producción solo avisa.
- Lógica compartida en `src/core/entorno/verificarMarca.js` (sin dependencias, con función de consulta inyectada); sin dependencias nuevas.

## Tareas
- [x] T1 módulo `verificarMarca`, `lib/marca.js`, `marcar.js`, cambios en `refrescar.js` y `probar-conexion.js`
- [x] T2 gancho en `src/server.js`
- [x] T3 documentación (reglas_refresco_staging, reglas_entornos, CLAUDE.md, README) y este plan

## Comprobaciones (Docker local: munditrofeos -> retencion_test)
- [x] Refresco sin marca en DESTINO aborta sin tocar nada (también con `--solo-limpieza`).
- [x] `staging:marcar`: confirmación errónea aborta; la correcta escribe; repetirlo es inofensivo; rechaza «prod»; rechaza una base sin `parametros_sistema`.
- [x] Refresco completo con marca: resumen previo, 44 tablas / 6373 filas verificadas, marca restablecida; munditrofeos sin cambios.
- [x] Pruebas unitarias con funciones falsas: cruces de marca del refresco y todas las reglas de `verificarMarca`; la lectura SQL real contra retencion_test (marcada, sin fila, sin tabla).
- [x] `npm run ci:sintaxis`. El humo de CI arranca con `NODE_ENV=test`: no se comprueba la marca.
- [ ] Pendiente en servidores reales: primer arranque de staging y de producción con el gancho.

## Orden de salida
1. Merge a `dev`.
2. Desde el PC del dueño: `npm run staging:marcar` contra la base de staging.
3. Solo entonces desplegar `dev` a staging (si no, staging se niega a arrancar, por diseño).
4. Producción no requiere acción; su primer arranque registra «sin marca: producción».

## Progreso
- T1 `d1de25b` (módulo) y `323b143` (herramientas de staging)
- T2 `85016db`
- T3 (ver el commit de documentación)
