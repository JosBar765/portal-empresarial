# Acciones del Administrador y del Gerente: solo lectura, tres acciones

Rama: `fix/acciones-admin-gerente` (desde `dev` 2acc3d5).

## Objetivo
En las filas del Buzón y de «Trabajo realizado», el Administrador (rol 1) y el Gerente (rol 8) tienen SOLO tres acciones, todas de lectura:
1. «Ver»: el vale de arte (PDF) junto con la propuesta que obtuvo ese vale; si el vale es una fusión, la propuesta que ven es la propuesta final.
2. «Propuestas de otros talleres».
3. «Ver historial».

## Decisiones del usuario
- Los dos roles tienen las tres acciones. El Gerente recibe `vales.ver_historial` (migración nueva; revierte la decisión anterior de dejarlo sin historial). En el historial ve también los chats (adjuntos y rechazo de propuesta), en solo lectura.
- «Propuestas de otros talleres» para ellos: solo las propuestas YA APROBADAS de todos los talleres del vale, una pestaña por taller y el PDF del vale; sin la regla de compartir (`talleres.comparte_propuestas`) y sin marcar propuestas como «vistas»; la acción aparece solo en vales con dos o más talleres.

## Evidencia (mapa del código)
- `buzon.js` `construirAcciones` (~323-426): al Administrador le salen hoy unas 12 acciones de escritura por `puede()` (`admin ||` en `permisos.js:9-36`): Ver y decidir, Autorizar creación, Asignar, Revisar, Comenzar/Entregar/Pausar/Cancelar/Reanudar, Aprobar y fusionar, Solicitar modificación, Aprobar modificación. El servidor las rechaza (no tiene esos permisos) pero el botón aparece.
- `propuestaGeneralVisible` (`buzon.js:297-300`): aplica con `usaEstadosVisibles() || Supervisor || puede('aprobarGeneral')`: el Administrador sí (por `admin ||`), el Gerente no. `propuesta_general_url` es la fusión final cuando la hay (`valeTallerService.js` ~412-421) y la del único taller si el vale tiene uno; en `APROBADO_DEPARTAMENTO` sin fusión es null. `obtenerPropuesta` (`valeDetalleService.js:106-130`) devuelve la fusión si existe, o la última propuesta.
- «Propuestas de otros talleres»: `buzon.js:417` solo para roles de taller; backend `propuestasCompartidasService.js` (`obtenerParaDetalle` 57-75, `_hermanosDelUsuario` 49-54, `valesConHermano` ~114, `valesConPropuestaNueva` ~104, `marcarVisto` 77-85) devuelve vacío si el usuario no es de taller; flags `propuestaOtroTallerNueva`/`propuestasOtrosAplica` en `valeBuzonService.js:432-436`.
- Historial: `buzon.js:420` `puede('verHistorial')`; `valeDetalleService.js:87-98` entrega `historial`, `conversaciones` y `conversacionesPropuesta` solo con `vales.ver_historial`; hoy solo el rol 1 (seed.sql 83-84). Modelo de migración: `05_reportes_gerente.sql`.

## Restricciones
- CLAUDE.md §7: no editar `schema.sql` ni `seed.sql` para cambios de producción; el permiso del Gerente va solo por migración nueva aditiva e idempotente (siguiente número libre; hoy la última es la 13).
- No tocar `puede()` en general (otros botones, como «Crear vale» del Administrador, dependen de él): se restringe `construirAcciones` para los roles 1 y 8.
- El Gerente y el Administrador son solo lectura: ninguna acción de escritura, ni «marcar visto».
- Conservar ids DOM, clases y `data-*`; archivos CRLF; comentarios de una línea.

## Tareas
- [x] T1 · Migración `vales.ver_historial` para el Gerente, aplicada en desarrollo.
- [x] T2 · Backend: «Propuestas de otros talleres» para Administrador y Gerente (todos los talleres del vale, solo aprobadas, solo lectura) y flags del buzón.
- [x] T3 · Frontend: `construirAcciones` con las tres acciones para los roles 1 y 8; «Ver» con la propuesta (fusión final si la hay) también para el Gerente; visor de propuestas de otros talleres en solo lectura para ellos.
- [x] T4 · Documentación y verificación.

## Ruta
Delegated direct: un escritor (varios archivos, lectura previa para escribir).

## Verificación
`node --check`; migración aplicada dos veces en desarrollo; scripts de un solo uso con vales de prueba borrados al final: para Administrador y Gerente, detalle de un vale multitaller con propuestas aprobadas (devuelve todos los talleres aprobados, sin `visto`), flags del buzón (`propuestasOtrosAplica` solo con 2+ talleres), historial para el Gerente tras la migración; Encargado/Asistente/Diseñador sin cambios.

## Progreso
Plan creado.
T1-T4 implementados (sin commit). Migración `14_gerente_ver_historial.sql` aplicada en desarrollo (2.ª corrida: 0 aplicadas; `migrate:estado` sin pendientes). Backend: `propuestasCompartidasService` con lectura global (Administrador y Gerente) + 2 consultas nuevas en `propuestaCompartidaRepository`. Frontend: `construirAccionesDeLectura` en `buzon.js`, `propuestasOtros.js` sin «visto». Docs: flujo, README y `correcciones_58.md`. Prueba de un solo uso (`t10_lectura_global.js`): 20/20 correctas, vales de prueba borrados. Pendiente: prueba manual en navegador (Gerente debe reingresar para recibir el permiso).
