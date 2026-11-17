# Historial de movimientos de las solicitudes de viáticos

Rama: `module/viaticos`. Estado: análisis cerrado con el dueño (2026-11-17), implementación en curso. Estrategia de entrega: la rama es la unidad de PR del dueño (sin cadena).

## Objetivo
Una acción **Historial** en la pestaña `Gestiones`, visible para quien tenga el permiso nuevo `viaticos.ver_historial`, que muestre el registro de los movimientos de una solicitud, como la acción «Ver historial» de Vales de Arte (fecha, quién lo hizo y una frase corta). Solo lleva el registro de las acciones sobre las solicitudes.

## Problema
- `viaticos_historial` solo cubre creada/modificada (indistinguibles), autorizada, rechazada y liquidada; no registra visto, recibos, comprobantes, vencimiento ni baja.
- La baja y el vencimiento tras el rechazo borran la solicitud y su `viaticos_historial` por CASCADE: el rastro se pierde.

## Decisiones del dueño
- Nada de vista ni pestaña extra: el historial de una solicitud YA BORRADA se consulta directo en la base de datos. El botón existe solo en las filas de `Gestiones` (las solicitudes que existen).
- El historial NO se pierde aunque se borre la solicitud: tabla permanente sin cascada.
- Detalle mínimo: una frase corta por movimiento, guiada por Vales (`vale_historial`: fecha, actor, `accion` en texto).
- Permiso `viaticos.ver_historial` separado; se asigna por rol desde Administración. Para ver la pestaña también hace falta `viaticos.gestionar` (consecuencia aceptada).
- Movimientos: creada, modificada, revisada (visto), autorizada, rechazada (con motivo), recibo creado/quitado, comprobante agregado/quitado, liquidada, vencida tras el rechazo, dada de baja.

## Diseño técnico (decidido por el padre tras el mapa del explorador)
- **Migración `42_viaticos_historial.sql`** (idempotente): permiso `viaticos.ver_historial` (+ asignación al Administrador por código, patrón de `37_viaticos_semilla`); tabla `viaticos_movimientos` SIN FK a `viaticos_solicitudes`: `id`, `solicitud_id` INT (referencia sin FK), `correlativo` VARCHAR(30), `tipo` VARCHAR(30) (clave del movimiento, para consultar directo), `usuario_id` INT NULL (sin FK; NULL = el sistema), `usuario_nombre` VARCHAR(100) (copia, para que la fila se entienda sola), `accion` VARCHAR(500) (frase corta, texto centralizado), `creado_en`; índices por `solicitud_id`, `correlativo` y `creado_en`. Relleno inicial desde `viaticos_historial` (primer renglón «esperando autorización» de cada solicitud = creada, los siguientes = modificada; autorizada, rechazada con su motivo, liquidada), sin duplicar si se repite.
- **`viaticos_historial` no cambia** (alimenta el motivo del rechazo y el PDF).
- **Escritura:** un único método `movimientoRepository.registrar(...)` que se llama con la transacción del cambio de negocio (atómico) en: crear y modificar (`solicitudGuardadoService`), visto (solo la primera vez), autorizar/rechazar (`gestionService`), recibo creado/quitado (`reciboService`), comprobante agregado/quitado y liquidar (`liquidacionService`), baja (`solicitudGuardadoService`, antes del DELETE), vencimiento (`rechazoVencimientoService`, antes del DELETE, actor = sistema). Textos de las frases en `mensajes.js`.
- **Lectura:** `GET /gestiones/:id/historial` (requiere `viaticos.gestionar` y `viaticos.ver_historial`) → `{ correlativo, movimientos: [{ id, tipo, usuarioNombre, accion, creadoEn }] }` en orden cronológico; 404 si la solicitud no existe. La acción `historial` entra en `pipeline.acciones` de Gestiones solo con el permiso (`accionesDeGestion`).
- **Frontend:** botón «Historial» (`time-outline`) en `components/filaGestion.js` + modal «Historial — <correlativo>» (lista con fecha, actor y frase; «Sin movimientos registrados.»), como `vales/js/actions/historial.js`; textos en `textos.js`; docs del módulo.

## Tareas
- [x] T1. Migración 42 (permiso, tabla permanente, relleno).
- [x] T2. Servidor: `movimientoRepository`, registro de los 10 movimientos en la misma transacción, endpoint de lectura y acción en el pipeline de Gestiones, constantes y mensajes.
- [ ] T3. Frontend: botón y modal de Historial en Gestiones.
- [ ] T4. Documentación del módulo (README, contrato, modelo de datos, plano del frontend).
- [ ] T5. Pruebas: API (permiso, 404, orden, movimientos de una baja y de un vencimiento conservados en la tabla) y navegador.

## Rutas
T1, T2 y la parte servidor de T4: escritor delegado (2+ archivos no triviales). T3 y su parte de T4: segundo escritor, después de T2 (necesita el contrato). Un solo escritor a la vez.

## Pruebas
Sin runner automatizado; RED/GREEN no aplica (excepción registrada). Verificación por API contra la BD local y por navegador.

## Evidencia T1/T2 (2026-11-17, escritor delegado; revisado por el padre)
- Migración 42 (permiso solo para el Administrador, tabla `viaticos_movimientos` sin FK con `usuario_nombre` de 150 caracteres para coincidir con `usuarios.nombre`, relleno idempotente), repositorio y servicio de movimientos, `GET /gestiones/:id/historial` (dos permisos encadenados), acción `historial` en el pipeline de Gestiones, docs del módulo.
- Los 10 movimientos se registran en la misma transacción: creada/modificada y baja (`solicitudGuardadoService`), visto solo la primera vez (`vistoService`), autorizada/rechazada (`gestionService`), recibo creado/quitado (`reciboService`), comprobante agregado/quitado y liquidada (`liquidacionService`), vencida con el sistema como actor (`rechazoVencimientoService`).
- Escritor: `--check` de 14 archivos y frases de los 12 tipos impresas. Padre: `--check` repetido, migración leída (idempotente, sin FK, relleno sin duplicar).
- Sin probar contra la BD: la migración 42 no está aplicada (T5).

## Próximo paso
T3: escritor del frontend (después del cambio del modal del recibo, que comparte archivos).
