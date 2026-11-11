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

## Solicitudes: payload, cálculo y lectura (F3.3 parte A)

### Payload `datos`

Lo comparten `POST /solicitudes/calcular` (cuerpo JSON, el payload directo, sin envoltura), `crear` y `modificar` (campo `datos` del multipart). camelCase; los importes aceptan número o texto con hasta 2 decimales.

```json
{
  "paisId": 1, "modalidad": "mas_de_un_dia", "vehiculoId": 2, "motivoId": 3,
  "monedaId": 1,
  "fechaSalida": "2026-12-01", "fechaRegreso": "2026-12-04",
  "rendimientoKmGalon": 35, "precioGalon": 32.5, "depreciacionPorKm": 1.25,
  "tramos": [{ "origenId": 1, "destinoId": 2 }],
  "hospedajes": [{ "hotel": "Hotel X", "lugar": "Xela", "noches": 2, "valorNoche": 350 }],
  "comidas": [{ "fecha": "2026-12-01", "tipoComidaId": 1 }],
  "gastos": [{ "tipoGastoId": 3, "descripcion": "Peaje", "monto": 50 }],
  "inspeccion": {
    "odometro": 15000,
    "fluidos": [{ "fluidoId": 1, "nivelId": 2 }],
    "kit": [{ "kitItemId": 1, "presente": true }],
    "defectos": [{ "tipoDefectoId": 1, "descripcion": "Rayón", "archivoIndice": 0 }]
  }
}
```

- `modalidad`: `mas_de_un_dia` o `hasta_un_dia`. En más de 1 día: `monedaId`, `fechaSalida` (`AAAA-MM-DD`), `fechaRegreso`, `rendimientoKmGalon`, `precioGalon`, `tramos` (al menos uno) y, si el vehículo es propio, `depreciacionPorKm`; `hospedajes`, `comidas` y `gastos` son opcionales; `inspeccion` no se admite. En 1 día o menos: `fechaSalida` es `AAAA-MM-DD HH:mm` (hora de Guatemala), `inspeccion` es obligatoria y no se admiten tramos, hospedajes, comidas ni gastos; el combustible no se calcula (`rendimientoKmGalon` y `precioGalon` se ignoran).
- Longitudes: hotel y lugar 50, descripciones 100. Noches, montos y valores mayores que cero. Cada fluido debe informarse; el nivel `N/A` solo en los fluidos con `permiteNoAplica`. `archivoIndice` es la posición de la foto en el campo `defectos` del multipart (en `calcular` solo se valida el formato).
- Supuesto: «más de 1 día» significa con pernocta; el regreso debe ser posterior a la salida (si regresas el mismo día es «1 día o menos»).
- Las ubicaciones de un tramo se eligen en cualquier sentido: el servidor busca el par ordenado en `viaticos_tramos`. Convención para guardar `viaticos_solicitud_tramos.sentido`: `ida` si el origen es la ubicación A del tramo, `vuelta` si es la B.
- No traslape: se compara por días completos e inclusivos (salida y regreso), contra solicitudes del mismo solicitante en cualquier estado menos rechazada; al modificar se excluye la propia. Un viaje corto ocupa solo su día.

### Respuesta de `POST /solicitudes/calcular`

Siempre 200 si el cuerpo es un objeto (el cliente decide con `valido`). Los errores de formato y de negocio se acumulan.

```json
{
  "modalidad": "mas_de_un_dia",
  "valido": true,
  "errores": [{ "campo": "tramos[1]", "mensaje": "…" }],
  "advertencias": [{ "clave": "licencia", "salvedadId": 1, "mensaje": "…" }],
  "salvedadIds": [1],
  "desglose": {
    "ruta": { "tramos": [{ "orden": 1, "tramoId": 7, "origenId": 1, "origenNombre": "…", "destinoId": 2, "destinoNombre": "…", "km": 205, "horas": 8 }], "kmTotal": 660, "horasTotal": 24 },
    "combustible": { "rendimientoKmGalon": 35, "precioGalon": 32.5, "galones": 18.86, "importe": 612.86 },
    "depreciacion": { "depreciacionPorKm": 1.25, "importe": 825 },
    "hospedaje": { "lineas": [{ "hotel": "…", "lugar": "…", "noches": 2, "valorNoche": 350, "total": 700 }], "totalNoches": 3, "importe": 1000 },
    "comidas": { "lineas": [{ "tipoComidaId": 1, "nombre": "desayuno", "cantidad": 3, "valorUnitario": 35, "total": 105 }], "importe": 510 },
    "otrosGastos": { "lineas": [{ "tipoGastoId": 3, "descripcion": "…", "monto": 50 }], "importe": 90 }
  },
  "totales": { "combustible": 612.86, "depreciacion": 0, "hospedaje": 1000, "comidas": 510, "otrosGastos": 90, "totalSolicitado": 2212.86 }
}
```

- `desglose` y `totales` son `null` si el formato del payload es inválido o si hay errores que impiden calcular (tramos, comidas, gastos, depreciación, vehículo o moneda inexistentes). Los demás errores (licencia, fechas, traslape) no impiden mostrar el desglose. En viaje corto: `desglose: null` y `totales: { totalSolicitado: 0 }`.
- `depreciacion` es `null` (y su total 0) con vehículo de la empresa; con vehículo propio es obligatoria y se calcula km totales × depreciación por km.
- Aritmética en centavos enteros, redondeo half-up solo al final de cada importe; los galones se muestran redondeados pero el combustible parte de la razón exacta.
- Advertencias: licencia, tarjeta de circulación o seguro que vencen antes de terminar el viaje (o tarjeta y seguro ya vencidos); el seguro sin póliza no advierte. Una licencia vencida o no registrada es un error, no una advertencia.

### Lectura

- `GET /catalogos/solicitud?paisId=`: 403 si el usuario no tiene países o el país no es suyo. Devuelve `pais`, `motivos`, `vehiculos` (cada uno con `esPropio`, `tarjetaVenceEl`, `polizaVenceEl`, `bloqueo` —motivo por el que su licencia no permite manejarlo, o `null`— y `bloqueoViajeCorto` —vehículo propio o tarjeta vencida, o `null`—), `ubicaciones`, `tramos` (activos), `monedas`, `valoresComida` (`monedaId`, `tipoComidaId`, `valor`), `tiposComida`, `tiposGasto` (seleccionables), `tiposDefecto`, `fluidos` (cada uno con sus `niveles`), `kit` y `ajustesArchivo`.
- `GET /solicitudes?desde=&hasta=&q=`: solo las del usuario. `desde` y `hasta` (`AAAA-MM-DD`) filtran por la fecha de creación y por defecto son la semana actual (lunes a domingo). `q` (hasta 50 caracteres) busca por correlativo parcial o por fecha de viáticos (`AAAA-MM-DD` o `DD/MM/AAAA`: la fecha cae dentro del viaje). Responde `{ desde, hasta, solicitudes }`; cada solicitud trae `pipeline` y se ordena por estados: primero vencida, rechazada y esperando autorización; luego autorizada, en curso, terminada y liquidada; en cada grupo, la más reciente primero.
- `GET /solicitudes/:id`: detalle completo del propio solicitante (tramos con origen y destino, hospedajes, comidas, gastos, salvedades, inspección, historial y `pipeline`); 404 si no existe y 403 si es de otra persona.

### Pipeline derivado

`{ fase, pasos: [{ clave, etiqueta, estado }], etiqueta, detalle, vencida, acciones }`. `fase` es esperando, vencida, rechazada, autorizada, en_curso, terminada o liquidada. Más de 1 día: 4 pasos (Esperando autorización, Autorizado, En curso o Terminado, Liquidado); 1 día o menos: 2. `estado` de cada paso: `pendiente`, `actual`, `completado` o `rechazado` (el paso 1 de una rechazada). Terminado deja el paso 3 completado y el 4 actual. «Vencida»: esperando autorización con salida anterior a hoy (se compara por día). En curso desde la salida hasta el día del regreso inclusive; terminado después. `acciones`: `ver` siempre; `modificar` y `darDeBaja` solo en esperando, vencida y rechazada; `liquidar` solo en más de 1 día, terminada.


## Solicitudes: guardado (F3.3 parte B)

### Formato de `POST /solicitudes` y `PUT /solicitudes/:id`

- `multipart/form-data`: campo `datos` (texto con el JSON del payload) y campo de archivos `defectos` (una foto por defecto, hasta 20); cada defecto de `inspeccion.defectos` referencia su foto con `archivoIndice` (posición en `defectos`). Sin archivos también se acepta JSON puro: el payload directo o envuelto en `{ "datos": { … } }`.
- `idempotencyKey` (texto de 1 a 64 caracteres) va dentro de `datos`; si falta, el servidor genera una. La llave se guarda por usuario con el endpoint `viaticos:crear`: repetir un `POST` con la misma llave devuelve el detalle ya creado, sin crear otra solicitud ni subir de nuevo las fotos. Dos envíos simultáneos con la misma llave se serializan.
- El servidor ignora todo importe o total que mande el cliente y recalcula; `estado` siempre es «esperando autorización».
- Archivos: el tope duro de multer es 25 MB por archivo (máximo configurable); el tipo (`tipos_archivo_permitidos`) y el tamaño (`max_archivo_mb`) efectivos salen de `viaticos_ajustes`. Además del tipo declarado se verifica la firma real del contenido y, en imágenes, el tope de megapíxeles.

### Respuestas

- `POST`: 201 con el detalle (misma forma que `GET /solicitudes/:id`). `PUT`: 200 con el detalle; conserva el correlativo, reemplaza todas las partes, agrega un renglón de historial y vuelve a «esperando autorización». Las fotos anteriores se borran de Storage después del commit y las nuevas siguen el contador `<CORRELATIVO>_DEFECTO_<n>` (nunca repiten un nombre previo).
- `DELETE`: 200 con `{ id, correlativo }`; borra el registro (las partes caen por `CASCADE`) y después los archivos de Storage (fotos y PDF).
- `GET /solicitudes/:id/documentos`: lista `[ { titulo, tipo: 'pdf' | 'imagen', url } ]` con el PDF (si existe) y las fotos de defectos, en ese orden; `url` es la URL pública guardada en `ruta`.

### Errores

- 400 `{ error, campos }`: datos inválidos; `campos` acumula los errores de formato, de negocio y de archivos por campo (`inspeccion.defectos[0]`, `defectos`, `idempotencyKey`…). Las advertencias no bloquean y se guardan como salvedades. Archivos: tipo no permitido, contenido que no corresponde al tipo, tamaño sobre `max_archivo_mb`, defecto sin foto, foto repetida, fotos sobrantes y fotos en un viaje de más de 1 día.
- 400 sin `campos`: `datos` ausente o con JSON inválido; ajustes de archivos sin configurar. Multer (global): más de 20 fotos, archivo sobre 25 MB.
- 403: la solicitud es de otra persona o su estado ya no admite modificar ni dar de baja (autorizada, liquidada); 404 si no existe. El estado se revalida dentro de la transacción con la fila bloqueada.

### Efectos

- Todo se guarda en una transacción: correlativo (`INSERT … ON DUPLICATE KEY UPDATE ultimo = LAST_INSERT_ID(ultimo + 1)`; la fila del país se crea si no existe y queda bloqueada hasta el commit), solicitud, partes, subida de fotos y historial. Si algo falla se revierte y se intenta borrar lo ya subido (el borrado solo actúa en producción).
- Después del commit: `documentoService.regenerarPdf` (por ahora no hace nada) y notificación `modulo = 'viaticos'`, `nivel = 'info'`, sin `vale_id`, a los usuarios activos con `viaticos.autorizar` (sin el rol Administrador). Un fallo de cualquiera de los dos se registra y no deshace la solicitud.
