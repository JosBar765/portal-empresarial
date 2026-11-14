# Borradores de solicitudes de viáticos

Rama: `module/viaticos` (el dueño trabaja el módulo ahí). Estado: en curso (2026-11-14). Estrategia de entrega: `ask-on-risk`.

## Objetivo
Que quien solicita viáticos pueda guardar a medias el formulario «Nueva solicitud de viáticos» y retomarlo después, como los borradores de Vales de Arte.

## Decisiones del dueño (2026-11-14)
- El borrador recuerda solo los **campos del formulario**; **no guarda las fotos** de los defectos (el viaje de 1 día o menos las vuelve a pedir al abrirlo).
- Vigencia **30 días** desde la creación (no se renueva al editar) y tope de **15 borradores por usuario**, igual que en Vales.
- Ambas modalidades llevan borrador (recomendación aceptada por omisión: el dueño pidió que recuerde los campos del formulario).

## Diseño
- Tabla nueva `viaticos_borradores` con el estado del formulario como JSON (`datos`); no se mezcla con `viaticos_solicitudes` (casi todo `NOT NULL`, correlativo único; rompería listados, gestiones, PDF y notificaciones).
- Privado del dueño; el permiso es `viaticos.ver` (el de montaje). Un borrador ajeno responde 404.
- Vigencia y tope salen de `viaticos_ajustes` (no hardcodeados); mensajes y errores centralizados y explicativos (qué falló, la regla con números, cómo corregirlo).
- API bajo `/api/viaticos`: `GET /borradores`, `GET /borradores/:id`, `POST /borradores`, `PUT /borradores/:id`, `DELETE /borradores/:id`.
- Guardar un borrador solo valida forma y tamaño (modalidad válida, `datos` objeto razonable, no vacío); la validación estricta de la solicitud no se relaja.
- Enviar desde un borrador: el cliente manda `borradorId` dentro de `datos`; si la solicitud se crea, el servidor borra ese borrador (solo si es del usuario) en la misma transacción. Sin fotos no hay archivos huérfanos ni `enviado_en`.
- Vencimiento: vigilante horario que borra los vencidos; el listado no devuelve vencidos.
- Front: botón «Guardar borrador» en el modal, abrir un borrador con el mismo formulario (`detalleAEstado`/`reconciliarEstado`), botón «Borradores (n)» junto a «Nueva solicitud» con lista (abrir, eliminar, «Vence en N días», rojo con 3 o menos).

## Tareas
- [x] T1. Migración `NN_viaticos_borradores.sql` (siguiente número libre; aditiva, idempotente): tabla y ajustes de vigencia y tope.
- [x] T2. Backend: repositorio, servicio, controlador, rutas, textos y vigilante de vencimiento (arranque en `app.js`).
- [x] T3. Enviar desde un borrador: `borradorId` en `solicitudGuardadoService` borra el borrador del dueño dentro de la transacción de crear.
- [ ] T4. Front: API (`viaticosApi.js`) y conversión estado ↔ borrador sin fotos (conserva `comidasAutoMarcar` y `comidasDesmarcadas`).
- [ ] T5. Front: botón «Guardar borrador», abrir un borrador y enviarlo con `borradorId` en el modal.
- [ ] T6. Front: botón «Borradores (n)», lista (abrir, eliminar) y refresco del contador.
- [ ] T7. Docs del módulo (`README.md`, `contrato_api.md`, `modelo_datos.md`, `plano_frontend.md`).
- [ ] T8. Prueba: API (crear, listar, actualizar, borrar, ajeno 404, tope, vacío, vencido, enviar borra el borrador) y navegador con las dos modalidades.

## Rutas
Delegado (un escritor por bloque): T1-T3 backend; T4-T6 frontend. T7 y T8 los coordina el padre. El servidor y la BD local los levanta el dueño; `npm run migrate` lo corre el dueño (`! npm run migrate`).

## Pruebas
Sin runner automatizado en el proyecto; RED/GREEN no aplica (excepción registrada). Verificación por API HTTP y navegador con el usuario de prueba local (`sup.prueba.viaticos@grupopremia.com`, rol de prueba con `viaticos.ver` y país Guatemala).

## Evidencia
- T1-T3 (servidor) hechas por un escritor delegado: migración `38_viaticos_borradores.sql` (tabla y ajustes `borrador_vigencia_dias` = 30 y `borrador_max_por_usuario` = 15), repositorio, servicio, controlador, rutas, mensajes, vigilante horario y `borradorId` al crear una solicitud; la documentación de la API y del modelo de datos ya quedó actualizada. `node --check` OK; revisado por el padre (tipos de la migración contra `usuarios.id` INT y el patrón de siembra de `37_viaticos_semilla.sql`). Sin probar contra BD ni HTTP: la migración la aplica el dueño con `npm run migrate`.
- Análisis previo (2026-11-14): borradores de Vales (`vale_borradores`, `borradorService`, `forms/borradores.js`, vigilante horario) y modal de Viáticos (`solicitudForm.js`, `datos.js`, `datosCorto.js`, `armarPayload`).
