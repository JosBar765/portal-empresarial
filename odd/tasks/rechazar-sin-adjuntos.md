# rechazar-sin-adjuntos

Rama: `feature/rechazar-sin-adjuntos` · Estrategia de entrega: `ask-on-risk` · Estado: planificado, sin código escrito.

## Objetivo
El encargado de taller verifica que recibió por correo los adjuntos (vectores, fuentes…) de un vale autorizado. Si no llegaron, rechaza ese taller y el asesor tiene 24 h para avisar que los envió. La detección de si llegaron queda fuera del módulo.

## Reglas acordadas con el usuario
- **Verificación obligatoria** en todo taller que recibe un vale, incluidas las modificaciones `MOD-`. No se puede asignar hasta marcar «recibí los adjuntos».
- **Permiso nuevo** `vales.verificar_adjuntos` para roles 4, 5, 9 y 7 (asistente, solo Diseño, igual que hoy vía `idEncargadoEfectivo`).
- **Rechazo por taller**, sin mensaje. Los demás talleres del vale siguen normal.
- **Respuesta del asesor** por taller: botón «Adjuntos enviados al correo», mensaje editable ≤ 200 palabras, prellenado con «Adjuntos enviados al correo».
- Tras la respuesta el vale vuelve al encargado, que ve el mensaje y puede **marcar recibido** (habilita asignar) o **rechazar otra vez** (loop). Mientras el asesor no responda, el encargado no tiene acciones.
- **Plazo único de 24 h** desde el primer rechazo, no se reinicia. Aviso al asesor a las 6 h restantes.
- **Vencimiento**: se borra el vale COMPLETO (todos sus talleres, aunque otros ya estén trabajando) y se libera el cupo del supervisor. Si era `MOD-`, el original queda como está. Se avisa al asesor, a los encargados y a los diseñadores de cada taller, como en la baja. (Corregido: antes decía «se quita solo ese taller», que no fue lo que eligió el usuario.)
- **Dar de baja** (asesor): permitido sobre un vale ya autorizado mientras algún taller tenga adjuntos pendientes; cancela el vale completo. Los talleres que ya trabajaban reciben aviso (encargado + diseñador asignado) y el vale desaparece de su vista.
- **Supervisor**: ve el vale en su Buzón con marca de solo lectura. **Encargado**: lo ve en su Buzón con etiqueta «Esperando adjuntos» / «Adjuntos enviados, verificar».
- **Avisos**: al rechazar (asesor), al responder (encargado), recordatorio 6 h antes, borrado/quitado por vencimiento, baja con talleres trabajando.

## Diseño técnico propuesto
- Se **altera la máquina de estados del taller** (decisión del usuario, sin producción): tres estados nuevos en `estados_taller` — `VERIFICANDO_ADJUNTOS` (inicial de todo taller), `ADJUNTOS_RECHAZADOS` (espera al asesor), `ADJUNTOS_RESPONDIDOS` (vuelve al encargado). Al verificar pasa a `PENDIENTE_ASIGNACION` y sigue el flujo actual.
- Columnas de apoyo en `vale_talleres` para lo que un estado no guarda: `adjuntos_vence_en` (se fija solo en el primer rechazo), `adjuntos_aviso_en`, `adjuntos_mensaje`, `adjuntos_respondido_en`.
- Punto de inicialización único: `valeCreacionService.fanOutTalleres` → `valeTallerRepository.crear`.
- Watcher nuevo calcado de `vigenciaWatcher.js`, registrado en `src/app.js` junto a los otros.
- No hay carpeta de migraciones: se edita `schema.sql`/`seed.sql` y se aplica a mano en la BD de desarrollo.

## Tareas
- [x] T1 · Esquema y permiso: 4 columnas `adjuntos_*` en `vale_talleres`, 3 estados nuevos en `estados_taller` (7–9), permiso `vales.verificar_adjuntos` (id 26) y `rol_permisos` 4/5/7/9 en `seed.sql`; aplicado a la BD de desarrollo y verificado por consulta. Ruta: inline (edición mecánica de SQL). El rol 10 (encargado de diseño local) también recibe el permiso.
- [x] T2 · Backend del flujo: inicializar en `fanOutTalleres`; servicios verificar / rechazar / responder; bloquear `asignar` hasta `VERIFICADO`; rutas con el permiso nuevo. Ruta: escritor delegado (varios archivos). Verificado: 41/41 checks contra el servidor de desarrollo (script propio); no se probaron por HTTP las acciones del supervisor ni los actores admin y asistente.
- [x] T3 · Dar de baja ampliado: permitir con adjuntos pendientes, avisar a talleres trabajando y borrar el vale. Ruta: escritor delegado. Verificado: 26/26 checks (script propio); el cupo del supervisor se libera al borrar; la entrega de sockets y el tope por taller no se probaron en vivo.
- [x] T4 · Watcher de plazo: aviso al asesor 6 h antes y, a las 24 h del primer rechazo sin responder, borrado del vale completo (`MOD-` deja el original). Ruta: escritor delegado. Verificado: 32/32 checks en proceso simulando el tiempo con la BD (aviso único, borrado completo, no borra si ya respondió, MOD-, cupo); la entrega por sockets no se probó en vivo.
- [ ] T5 · Buzón y notificaciones: etiquetas y contadores para encargado, asesor y supervisor; eventos y avisos nuevos.
- [ ] T6 · Frontend: acciones del encargado (verificar / rechazar), modal de respuesta del asesor, etiquetas, avisos.
- [ ] T7 · Documentación (`flujo_vale_de_arte.md`, `CLAUDE.md`) y verificación de punta a punta.

## Verificación y evidencia
Sin suite de tests en el proyecto: se verifica con scripts propios contra la BD de desarrollo y la interfaz.
(pendiente)

## Ruta por tarea
(pendiente: se registra al ejecutar cada una)

## Siguiente paso
Confirmar la política de commits y arrancar T1.
