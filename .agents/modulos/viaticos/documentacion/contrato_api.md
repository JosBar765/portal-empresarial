# Contrato de la API — Calculadora de Viáticos

Montaje: `app.use('/api/viaticos', requireAuth, requirePermission('viaticos.ver'), routes)` después de `authenticateJWT`. `viaticos.ver` es el permiso que muestra el módulo en el dashboard y abre `/modules/viaticos` (catálogo `MODULOS`), así que quien use `gestionar`, `autorizar`, `liquidar` o `configurar` necesita también `viaticos.ver`. Cada endpoint declara además su permiso de acción. La identidad sale siempre de `req.user.id`. Errores con `responderError`; ids con `idObligatorio`/`idOpcional`; mensajes y límites en `mensajes.js`, `constantes.js` y `viaticos_ajustes` (nada hardcodeado). 403 para errores de permiso o negocio, nunca 401.

## Reglas del servidor (las aplica el service, nunca se confía en el cliente)
- El servidor recalcula todos los importes (km, galones, combustible, depreciación, hospedaje, comidas, otros gastos y total); ignora los calculados que mande el cliente.
- El país de la solicitud debe estar en `viaticos_usuario_paises` del solicitante; la moneda existe y está activa (solo viajes de más de 1 día).
- El solicitante tiene licencia registrada y vigente (`vence_el >= hoy`); si no, error explicativo. La regla de `viaticos_reglas_licencia` del país de la solicitud decide si el tipo de licencia sirve para el tipo de placa del vehículo (y su tonelaje y pasajeros, si la regla los limita).
- No se crea para fechas pasadas; no se traslapa con otra solicitud activa del mismo solicitante (cualquier estado menos rechazada); un viaje corto no admite auto con tarjeta de circulación vencida.
- Más de 1 día: tramos encadenados (cada origen es el destino del anterior) y cada par existe en `viaticos_tramos`; km y horas se copian al renglón. Advertencias (no bloquean y se guardan como salvedades): licencia, tarjeta de circulación o seguro que vencen dentro de la ventana del viaje (o seguro vencido).
- Vehículo propio: solo el del solicitante; con depreciación. Vehículo de la empresa: sin depreciación (`depreciacion_por_km` NULL). Viaje corto: solo vehículos de la empresa.
- Correlativo `VIA-<código país>-<n de 6 dígitos>`: `viaticos_secuencias` incrementada dentro de la transacción con `FOR UPDATE`.
- «En curso», «Terminado» y «Vencida» se calculan con las fechas y la hora de Guatemala (`calendarioLaboral.ahoraUTC6`). `modificar` y `dar de baja` solo en esperando autorización, rechazada o vencida; modificar regenera el PDF y vuelve a esperando autorización. Autorizar solo si está esperando autorización y no está vencida.
- Liquidar: solo más de 1 día, autorizada y terminado el viaje; cada rubro admite como máximo los comprobantes solicitados (noches de hotel, combustible, y cada gasto por tipo); comidas y depreciación no se liquidan; «Liquidar» solo cuando falta por liquidar es cero.
- Borrar archivos en Storage solo en producción (`supabaseStorage.eliminar`). Creación y subidas aceptan `idempotencyKey`.
- Notificaciones (`modulo = 'viaticos'`, `vale_id` NULL, el correlativo va en el mensaje): al crear o modificar, a los usuarios con `viaticos.autorizar`; al autorizar o rechazar, al solicitante. Tiempo real: eventos por `sendToUsers` y la sala `viaticos:gestion` (validada con `viaticos.gestionar`).

## Endpoints (prefijo `/api/viaticos`)

| Método y ruta | Permiso | Descripción |
|---|---|---|
| `GET /contexto` | ver | Usuario, permisos `viaticos.*`, países del usuario, licencia y ajustes de archivo |
| `GET /catalogos/solicitud?paisId=` | ver | Motivos, vehículos disponibles (empresa del país y propios del solicitante), ubicaciones, tramos, monedas, valores de comida, tipos de gasto y de defecto, fluidos, niveles y kit |
| `POST /solicitudes/calcular` | ver | Valida y calcula sin guardar: importes, totales, advertencias y errores bloqueantes |
| `GET /solicitudes?desde=&hasta=&q=` | ver | Mis solicitudes con pipeline y acciones disponibles |
| `GET /solicitudes/:id` | ver | Detalle (propio) |
| `POST /solicitudes` | ver | Crea (multipart: campo `datos` JSON y campo `defectos` para las fotos del viaje corto) |
| `PUT /solicitudes/:id` | ver | Modifica (mismo formato) |
| `DELETE /solicitudes/:id` | ver | Da de baja (borra registro y archivos) |
| `GET /solicitudes/:id/documentos` | ver | Lista para el visor: PDF y fotos de defectos |
| `GET /solicitudes/:id/liquidacion` | ver | Resumen, pendientes por rubro y comprobantes |
| `POST /solicitudes/:id/comprobantes` | ver | Agrega un comprobante (multipart: `archivo`, `tipoGastoId`, `monto`, `descripcion`) |
| `DELETE /solicitudes/:id/comprobantes/:comprobanteId` | ver | Quita un comprobante |
| `POST /solicitudes/:id/liquidar` | ver | Liquida |
| `GET /gestiones?desde=&hasta=&q=` | gestionar | Todas las solicitudes, con solicitante y país |
| `GET /gestiones/:id` y `/gestiones/:id/documentos` | gestionar | Detalle y documentos |
| `POST /gestiones/:id/autorizar` | autorizar | Autoriza |
| `POST /gestiones/:id/rechazar` | autorizar | Rechaza con `{ motivo }` libre y obligatorio |
| `GET /gestiones/:id/liquidacion` | liquidar | Vista de solo lectura para contabilidad |
| `GET /config/<recurso>` | configurar | Lista |
| `POST /config/<recurso>` | configurar | Crea |
| `PUT /config/<recurso>/:id` | configurar | Edita |
| `PATCH /config/<recurso>/:id/activo` | configurar | Activa o desactiva |

Recursos de `/config`: `paises` (solo lectura), `monedas`, `valores-comida` (matriz moneda × comida, `PUT` completo), `ubicaciones`, `tramos`, `motivos`, `tipos-gasto`, `tipos-defecto`, `tipos-licencia`, `tipos-placa`, `reglas-licencia`, `vehiculos`, `personas` (lista de usuarios con licencia y países; `PUT /config/personas/:usuarioId`) y `ajustes` (`GET` y `PUT /config/ajustes/:clave`). Fluidos, niveles, kit, combustibles, estados y salvedades no se editan desde la interfaz.

## Ajustes de implementación de `/config` (F3.2)

- Entradas y salidas en camelCase; `activo` y las marcas son booleanos reales.
- Los valores de comida son mayores que cero (la tabla lo exige); una celda vacía significa «sin configurar» y se borra al guardar la matriz.
- `reglas-licencia` no tiene id: `PUT` y `DELETE /config/reglas-licencia/:paisId/:tipoLicenciaId/:tipoPlacaId`; el `POST` recibe `paisId`, `tipoLicenciaId`, `tipoPlacaId`, `tonelajeMax` y `pasajerosMax`, y el tipo de placa debe ser del país de la regla.
- `tramos`: el `POST` recibe `origenId` y `destinoId` y guarda el par ordenado; el `PUT` solo edita `km` y `horas`.
- No se pueden cambiar al editar: `paisId` (ubicaciones y tipos de placa), `esOtros` y `seleccionableEnGastos`.
- `personas`: `PUT /config/personas/:usuarioId` recibe `{ licencia: { tipoLicenciaId, numero, venceEl } | null, paisIds: [] }`; `paisIds` es obligatorio.
