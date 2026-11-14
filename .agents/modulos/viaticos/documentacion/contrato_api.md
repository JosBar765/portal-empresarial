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
- Liquidar: solo más de 1 día, autorizada y terminado el viaje; cada rubro admite como máximo los comprobantes solicitados (noches de hotel, combustible, y cada gasto por tipo); comidas y depreciación no se liquidan; «Liquidar» lo marca el solicitante cuando quiere, aunque falten comprobantes (decisión del dueño; ver «Liquidación (F3.6)»).
- Borrar archivos en Storage solo en producción (`supabaseStorage.eliminar`). Creación y subidas aceptan `idempotencyKey`.
- Notificaciones (`modulo = 'viaticos'`, `vale_id` NULL, el correlativo va en el mensaje): al crear o modificar, a los usuarios con `viaticos.autorizar`; al autorizar o rechazar, al solicitante; al liquidar, a los usuarios con `viaticos.liquidar`. Tiempo real: eventos por `sendToUsers` y la sala `viaticos:gestion` (validada con `viaticos.gestionar`).

## Endpoints (prefijo `/api/viaticos`)

| Método y ruta | Permiso | Descripción |
|---|---|---|
| `GET /contexto` | ver | Usuario, permisos `viaticos.*`, países del usuario, licencia y ajustes de archivo |
| `GET /catalogos/solicitud?paisId=` | ver | Motivos, vehículos disponibles (empresa del país y propios del solicitante), ubicaciones, tramos, monedas, valores de comida, tipos de gasto y de defecto, fluidos, niveles y kit |
| `POST /solicitudes/calcular` | ver | Valida y calcula sin guardar: importes, totales, advertencias y errores bloqueantes |
| `GET /borradores` | ver | Mis borradores vigentes, del más nuevo al más viejo (ver «Borradores») |
| `GET /borradores/:id` | ver | Un borrador mío con su `datos` completo |
| `POST /borradores` | ver | Guarda un borrador nuevo (`{ modalidad, datos }`) |
| `PUT /borradores/:id` | ver | Actualiza un borrador mío; no renueva su vencimiento |
| `DELETE /borradores/:id` | ver | Elimina un borrador mío |
| `GET /solicitudes?desde=&hasta=&q=` | ver | Mis solicitudes con pipeline y acciones disponibles |
| `GET /solicitudes/:id` | ver | Detalle (propio) |
| `POST /solicitudes` | ver | Crea (multipart: campo `datos` JSON y campo `defectos` para las fotos del viaje corto) |
| `PUT /solicitudes/:id` | ver | Modifica (mismo formato) |
| `DELETE /solicitudes/:id` | ver | Da de baja (borra registro y archivos) |
| `GET /solicitudes/:id/documentos` | ver | Lista para el visor: PDF, fotos de defectos y, ya liquidada, los comprobantes |
| `GET /solicitudes/:id/liquidacion` | ver | Resumen, pendientes por rubro y comprobantes |
| `POST /solicitudes/:id/comprobantes` | ver | Agrega un comprobante (multipart: `archivo`, `tipoGastoId`, `monto`, `descripcion`) |
| `DELETE /solicitudes/:id/comprobantes/:comprobanteId` | ver | Quita un comprobante |
| `POST /solicitudes/:id/liquidar` | ver | Liquida (con todos los comprobantes completos) |
| `GET /gestiones?desde=&hasta=&q=` | gestionar | Todas las solicitudes, con solicitante y país |
| `GET /gestiones/:id` y `/gestiones/:id/documentos` | gestionar | Detalle y documentos |
| `POST /gestiones/:id/autorizar` | autorizar | Autoriza |
| `POST /gestiones/:id/rechazar` | autorizar | Rechaza con `{ motivo }` libre y obligatorio |
| `GET /gestiones/:id/liquidacion` | liquidar | Vista de solo lectura para contabilidad (cifras, diferencia, comprobantes y PDF) |
| `GET /config/<recurso>` | configurar | Lista |
| `POST /config/<recurso>` | configurar | Crea |
| `PUT /config/<recurso>/:id` | configurar | Edita |
| `PATCH /config/<recurso>/:id/activo` | configurar | Activa o desactiva |

Recursos de `/config`: `paises` y `combustibles` (solo lectura; este último lo necesita el formulario de vehículos), `monedas`, `valores-comida` (matriz moneda × comida, `PUT` completo), `ubicaciones`, `tramos`, `motivos`, `tipos-gasto`, `tipos-defecto`, `tipos-licencia`, `tipos-placa`, `reglas-licencia`, `vehiculos`, `personas` (lista de usuarios con licencia y países; `PUT /config/personas/:usuarioId`) y `ajustes` (`GET` y `PUT /config/ajustes/:clave`). Fluidos, niveles, kit, combustibles, estados y salvedades no se editan desde la interfaz.

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
    "defectos": [{ "tipoDefectoId": 1, "descripcion": "Rayón", "archivoIndice": 0 }, { "tipoDefectoId": 2, "descripcion": "Golpe", "defectoId": 41 }]
  }
}
```

- `modalidad`: `mas_de_un_dia` o `hasta_un_dia`. En más de 1 día: `monedaId`, `fechaSalida` (`AAAA-MM-DD`), `fechaRegreso`, `rendimientoKmGalon`, `precioGalon`, `tramos` (al menos uno) y, si el vehículo es propio, `depreciacionPorKm`; `hospedajes`, `comidas` y `gastos` son opcionales; `inspeccion` no se admite. En 1 día o menos: `fechaSalida` es `AAAA-MM-DD HH:mm` (hora de Guatemala), `inspeccion` es obligatoria y no se admiten tramos, hospedajes, comidas ni gastos; el combustible no se calcula (`rendimientoKmGalon` y `precioGalon` se ignoran).
- Longitudes: hotel y lugar 50, descripciones 100. Noches, montos y valores mayores que cero. Cada fluido debe informarse; el nivel `N/A` solo en los fluidos con `permiteNoAplica`. Cada defecto es de una de dos formas excluyentes: NUEVO, con `archivoIndice` (posición de su foto en el campo `defectos` del multipart), o EXISTENTE, con `defectoId` (id de un defecto de la propia solicitud, solo al modificar) para conservar su foto actual; ver «Conservar la foto de un defecto» (en `calcular` solo se valida el formato).
- Supuesto: «más de 1 día» significa con pernocta; el regreso debe ser posterior a la salida (si regresas el mismo día es «1 día o menos»).
- Las ubicaciones de un tramo se eligen en cualquier sentido: el servidor busca el par ordenado en `viaticos_tramos`. Convención para guardar `viaticos_solicitud_tramos.sentido`: `ida` si el origen es la ubicación A del tramo, `vuelta` si es la B.
- No traslape: se compara por días completos e inclusivos (salida y regreso), contra solicitudes del mismo solicitante en cualquier estado menos rechazada; al modificar se excluye la propia. Un viaje corto ocupa solo su día.

### Respuesta de `POST /solicitudes/calcular`

Siempre 200 si el cuerpo es un objeto (el cliente decide con `valido`). Los errores de formato se acumulan entre sí; si hay alguno, no se evalúan las reglas de negocio (fechas, licencia, traslape…) hasta que el formato sea válido, porque dependen de datos bien formados. Una vez corregido el formato, los errores de negocio también se acumulan.

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

- `multipart/form-data`: campo `datos` (texto con el JSON del payload) y campo de archivos `defectos` (una foto por defecto, hasta 20); cada defecto de `inspeccion.defectos` referencia su foto nueva con `archivoIndice` (posición en `defectos`) o, al modificar, conserva la actual con `defectoId`. Sin archivos también se acepta JSON puro: el payload directo o envuelto en `{ "datos": { … } }`.
- `idempotencyKey` (texto de 1 a 64 caracteres) va dentro de `datos`; si falta, el servidor genera una. La llave se guarda por usuario con el endpoint `viaticos:crear`: repetir un `POST` con la misma llave devuelve el detalle ya creado, sin crear otra solicitud ni subir de nuevo las fotos. Dos envíos simultáneos con la misma llave se serializan.
- El servidor ignora todo importe o total que mande el cliente y recalcula; `estado` siempre es «esperando autorización».
- Archivos: el tope duro de multer es 25 MB por archivo (máximo configurable); el tipo (`tipos_archivo_permitidos`) y el tamaño (`max_archivo_mb`) efectivos salen de `viaticos_ajustes`. Además del tipo declarado se verifica la firma real del contenido y, en imágenes, el tope de megapíxeles.

### Conservar la foto de un defecto

Al modificar una solicitud de 1 día o menos no hay que volver a subir las fotos. Cada elemento de `inspeccion.defectos` es de una de dos formas, nunca ambas ni ninguna:

- Nuevo: lleva `archivoIndice` y no `defectoId`; se sube la foto y se nombra `<CORRELATIVO>_DEFECTO_CORRECCION_<n>` (al crear, `…_CREACION_<n>`).
- Existente (solo en `PUT`): lleva `defectoId` y no `archivoIndice`. Conserva la misma foto (`ruta`, `mime_type` y `tamano`), sin tocar Storage ni renombrarla; `tipoDefectoId` y `descripcion` sí se pueden cambiar.
- `defectoId` debe ser el `id` de un defecto de esta solicitud (el de `GET /solicitudes/:id`), sin repetir; se valida antes de guardar y otra vez dentro de la transacción con la fila bloqueada. Con `POST` se rechaza («solo se puede conservar al modificar»). Un viaje de más de 1 día no lleva inspección, así que no conserva nada.
- Contador de nombres: los nuevos continúan desde todas las fotos actuales de la solicitud (conservadas o no), así que ningún nombre se repite.
- Borrado: tras el commit y solo en producción se borran de Storage únicamente las fotos de los defectos que no se conservaron (reemplazados o quitados). Quitar todos los defectos borra todas sus fotos; reenviar todos los `defectoId` no borra ninguna. Si la transacción falla, solo se deshacen las fotos nuevas.
- Lectura: cada defecto de `inspeccion.defectos` en `GET /solicitudes/:id` (y en el detalle de Gestiones) trae `id`, `tipoDefectoId`, `tipoDefectoNombre`, `descripcion`, `mimeType`, `tamano` y `url` (URL pública de la foto, para la miniatura). Cada guardado reinserta los defectos, por lo que los `id` cambian y hay que usar los del detalle devuelto.

### Respuestas

- `POST`: 201 con el detalle (misma forma que `GET /solicitudes/:id`). `PUT`: 200 con el detalle; conserva el correlativo, reemplaza todas las partes (los defectos se vuelven a insertar, así que sus `id` cambian: el cliente debe releer el detalle), agrega un renglón de historial y vuelve a «esperando autorización». Solo se borran de Storage, después del commit, las fotos de los defectos que ya no están (ver «Conservar la foto de un defecto»); las fotos nuevas se nombran `<CORRELATIVO>_DEFECTO_CREACION_<n>` al crear y `<CORRELATIVO>_DEFECTO_CORRECCION_<n>` al modificar (ver «Archivos en Storage»).
- `DELETE`: 200 con `{ id, correlativo }`; borra el registro (las partes caen por `CASCADE`) y después los archivos de Storage (fotos y PDF).
- `GET /solicitudes/:id/documentos`: lista `[ { titulo, tipo: 'pdf' | 'imagen', url } ]` con el PDF (si existe) y las fotos de defectos, en ese orden; `url` es la URL pública guardada en `ruta`.

### Errores

- 400 `{ error, campos }`: datos inválidos; `campos` acumula los errores de formato, de negocio y de archivos por campo (`inspeccion.defectos[0]`, `defectos`, `idempotencyKey`…). Las advertencias no bloquean y se guardan como salvedades. Archivos: tipo no permitido, contenido que no corresponde al tipo, tamaño sobre `max_archivo_mb`, defecto sin foto ni `defectoId`, con ambos a la vez, foto repetida, fotos sobrantes, fotos en un viaje de más de 1 día y, en `defectoId`, que no sea de la solicitud, esté repetido o se envíe al crear (cada uno con su mensaje explicativo en `inspeccion.defectos[i]`).
- 400 sin `campos`: `datos` ausente o con JSON inválido; ajustes de archivos sin configurar. Multer (global): más de 20 fotos, archivo sobre 25 MB.
- 403: la solicitud es de otra persona o su estado ya no admite modificar ni dar de baja (autorizada, liquidada); 404 si no existe. El estado se revalida dentro de la transacción con la fila bloqueada.

## Borradores

Guardan el formulario «Nueva solicitud» a medias, para ambas modalidades. Solo guardan los campos del formulario: nunca fotos ni archivos. La identidad sale de `req.user`; un borrador ajeno o vencido responde 404 igual que uno inexistente. Todos exigen solo `viaticos.ver`.

- `GET /borradores` → 200 `{ borradores: [ { id, modalidad, paisId, fechaSalida, fechaRegreso, creadoEn, venceEn, diasRestantes } ] }`. Solo los vigentes, del más nuevo al más viejo. `paisId`, `fechaSalida` y `fechaRegreso` se leen de `datos` y son `null` si no están; `creadoEn` y `venceEn` son `AAAA-MM-DD`; `diasRestantes` (entero, 0 el último día) lo calcula MySQL.
- `GET /borradores/:id` → 200 `{ id, modalidad, datos, creadoEn, venceEn, diasRestantes }`.
- `POST /borradores` con `{ modalidad, datos }` → 201 con la misma forma que `GET /borradores/:id`.
- `PUT /borradores/:id` con `{ modalidad, datos }` → 200 con la misma forma. No cambia `creadoEn` ni `venceEn` y no cuenta contra el tope.
- `DELETE /borradores/:id` → 200 `{ ok: true }`.
- Vigencia (`borrador_vigencia_dias`, 30) contada desde la creación, sin renovar al editar; tope por usuario (`borrador_max_por_usuario`, 15) de borradores vigentes. Ambos salen de `viaticos_ajustes`. Un watcher horario borra los vencidos.
- Al guardar solo se valida la forma, no las reglas de la solicitud: `modalidad` válida; `datos` objeto (no lista ni `null`); serializado, de hasta 64 KB (`BORRADORES.MAX_BYTES_DATOS`); no vacío (`''`, `null`, `false`, listas u objetos sin contenido no cuentan, ni `modalidad`, `comidasAutoMarcar` ni `comidasDesmarcadas`). Los ids dentro de `datos` son opacos: el cliente los reconcilia con los catálogos al abrir el borrador.

### Errores de borradores

- 400 `{ error: 'Hay datos que no son válidos…', campos: { modalidad?, datos? } }`: modalidad inválida, `datos` que no es un objeto, demasiado grande (con su tamaño y el máximo) o vacío. Un `:id` que no es entero responde 400 `{ error: 'Borrador inválido.' }`.
- 404 `{ error }`: no existe entre los del usuario o ya venció.
- 409 `{ error }`: `POST` con el usuario ya en el tope («Ya tienes 15 borradores… elimina uno o envía alguno como solicitud»). Nunca 401: `sessionGuard.js` lo trata como sesión vencida. El conteo y el insert van en una transacción que bloquea la fila del usuario, así que dos guardados simultáneos no superan el tope.
- 500 `{ error }`: falta alguno de los dos ajustes (la migración `viaticos_borradores` no se aplicó).

### Enviar desde un borrador

`POST /solicitudes` acepta `borradorId` dentro de `datos` (entero positivo, opcional; otro valor da 400 con el campo `borradorId` en `campos`). Si la solicitud se crea, el servidor borra ese borrador en la misma transacción, solo si es del usuario: uno ajeno o ya borrado se ignora sin fallar. Al modificar (`PUT /solicitudes/:id`) `borradorId` se ignora. Un reintento con la misma `idempotencyKey` devuelve la solicitud ya creada.

### Efectos

- Todo se guarda en una transacción: correlativo (`INSERT … ON DUPLICATE KEY UPDATE ultimo = LAST_INSERT_ID(ultimo + 1)`; la fila del país se crea si no existe y queda bloqueada hasta el commit), solicitud, partes, subida de fotos y historial. Si algo falla se revierte y se intenta borrar lo ya subido (el borrado solo actúa en producción).
- Después del commit: `documentoService.regenerarPdf` (ver «PDF de la solicitud») y notificación `modulo = 'viaticos'`, `nivel = 'info'`, sin `vale_id`, a los usuarios activos con `viaticos.autorizar` (sin el rol Administrador). Un fallo de cualquiera de los dos se registra y no deshace la solicitud.

### PDF de la solicitud

- Lo genera `services/pdf/solicitudPdfService.js` (`pdf-lib`, Carta, estilo «recibo» en blanco y negro como el vale de arte) tras crear o modificar; no se guarda el binario en la base: solo la URL pública en `viaticos_solicitudes.pdf_ruta`.
- Nombre en Storage según la etapa (ver «Archivos en Storage»); cada regeneración actualiza `pdf_ruta` y borra el anterior (el borrado solo actúa en producción).
- Encabezado: título «SOLICITUD DE VIÁTICOS» con la letra calculada para ocupar el mismo ancho que «VALE DE ARTE» a 18 pt, correlativo, «MundiTrofeos S.A. · Generado dd/mm/aaaa» y logo; se repite en cada hoja. Pie de todas las hojas: `n/total`.
- Contenido: información del solicitante (puesto = rol; licencia = tipo · número), del vehículo (póliza vacía si no tiene) y del viaje. Más de 1 día: ruta y kilometraje, combustible, depreciación (solo vehículo propio), hotel y hospedaje, comidas, otros gastos y caja TOTAL SOLICITADO (el total guardado). 1 día o menos: nivel de fluidos (`1/4` amarillo, `E` rojo), odómetro, kit de emergencia (cada «No» en rojo), defectos `SÍ (n)/NO` y, solo si hay defectos, una última hoja con sus fotos (3 por fila con el nombre de su archivo, p. ej. `<CORRELATIVO>_DEFECTO_CREACION_<n>`; una foto que no se pueda bajar o que no sea PNG/JPEG se reemplaza por un recuadro «Imagen no disponible»). Después, SALVEDADES (solo si hay, con `texto_pdf` y «TOMAR EN CUENTA» con doble subrayado) y las firmas: el nombre del solicitante sobre su línea y, al autorizarse la solicitud, el nombre de quien autorizó sobre la línea de Administración (tentativo: gerencia aún no define el proceso).
- Desbordamiento: normalmente una sola hoja. Las listas (tramos, hoteles, comidas, otros gastos, defectos) no tienen límite de filas y siguen en otra hoja con el mismo encabezado; la caja TOTAL SOLICITADO, las salvedades y las firmas van siempre juntas: si no caben en la hoja actual pasan juntas a la siguiente.
- Textos: Helvetica solo dibuja WinAnsi. Al guardar, hotel, lugar y descripciones con caracteres que no se pueden dibujar (emoji, flechas, chino…) se rechazan con 400 por campo; el generador además sustituye cualquier carácter restante por «?» para no fallar.
- Si la regeneración falla, la solicitud queda guardada sin PDF (el error se registra) y `GET /solicitudes/:id/documentos` lista solo las fotos.

## Archivos en Storage

Todo archivo de viáticos va al bucket propio `SUPABASE_STORAGE_BUCKET_VIATICOS` (`supabaseStorage.viaticos`; variable obligatoria, distinta entre staging y producción). Nombres con el mismo esquema que Vales (`src/core/files/nombreArchivo.js`; la extensión sale del tipo verificado del archivo; `X` es un contador que empieza en 1 por etapa y nunca repite un nombre porque Storage no sobrescribe):

| Archivo | Nombre |
|---|---|
| PDF al crear la solicitud | `<CORRELATIVO>_CREACION` |
| PDF al modificarla (siempre antes de autorizar) | `<CORRELATIVO>_CORRECCION_PRE_AUTORIZACION_X` |
| PDF al autorizarla (tentativo) | `<CORRELATIVO>_AUTORIZACION` |
| Foto de defecto al crear | `<CORRELATIVO>_DEFECTO_CREACION_X` |
| Foto de defecto añadida al modificar | `<CORRELATIVO>_DEFECTO_CORRECCION_X` (las fotos conservadas mantienen su nombre) |
| Comprobante de liquidación | `<CORRELATIVO>_LIQUIDACION_<RUBRO>_X` (el rubro sale del nombre del tipo de gasto, sin acentos y en mayúsculas: `HOSPEDAJE`, `COMBUSTIBLE`, `PEAJE`…) |

Limitación conocida (solo staging y desarrollo, donde el borrado de Storage no actúa): si en una modificación se quitan todas las fotos de una etapa y en otra posterior se vuelven a agregar, el contador reinicia y el nombre puede chocar con un archivo que quedó sin borrar. Los comprobantes sí lo resuelven (ver «Nombres ante duplicados» en «Liquidación (F3.6)»).

## Gestiones (F3.5)

Las solicitudes de Gestiones son las de todas las personas y países (no se comprueba propiedad); `GET /solicitudes/*` sigue siendo solo del propio usuario. Los permisos se exigen por ruta: ver con `viaticos.gestionar`, decidir con `viaticos.autorizar` (un usuario puede autorizar su propia solicitud: el análisis no lo prohíbe).

### Lectura

- Cada ítem de las listas (Solicitudes y Gestiones) incluye `moneda` `{ id, codigo, nombre, simbolo }`, o `null` en el viaje de 1 día o menos (no tiene importes), para mostrar `totalSolicitado` con su símbolo.
- `GET /gestiones?desde=&hasta=&q=` (`gestionar`): mismos filtros que `GET /solicitudes` (`desde`/`hasta` sobre la fecha de creación, por defecto la semana actual de Guatemala; `q` hasta 50 caracteres). `q` busca por correlativo parcial, por nombre del solicitante (parcial) o por fecha de viáticos (`AAAA-MM-DD` o `DD/MM/AAAA`). Responde `{ desde, hasta, solicitudes }`; cada ítem trae lo de la lista de Solicitudes (`id`, `correlativo`, `fechaCreacion`, `modalidad`, `fechaSalida`, `fechaRegreso`, `totalSolicitado`, `pipeline`) más `solicitante { id, nombre }` y `pais { codigo, nombre }`.
- Orden «según estados»: primero «Esperando autorización» (la más antigua primero, para atender en orden); luego vencida y rechazada, autorizada, en curso, terminada y liquidada (en cada grupo, la más reciente primero).
- `pipeline.acciones` de Gestiones depende de los permisos de quien consulta (no son las del dueño: aquí no hay `modificar` ni `darDeBaja`): `ver` siempre; `autorizar` y `rechazar` con `viaticos.autorizar` y solo en «esperando autorización» sin vencer; `liquidar` (abrir la vista de solo lectura de contabilidad, ver «Liquidación (F3.6)») con `viaticos.liquidar` solo en viajes de más de 1 día con el viaje ya terminado o ya liquidados.
- `GET /gestiones/:id` (`gestionar`): el mismo detalle que `GET /solicitudes/:id` (incluye `solicitante`, `pais` e `historial` con el usuario de cada paso y el motivo del rechazo) de cualquier solicitud, con las `acciones` de Gestiones; 404 si no existe.
- `GET /gestiones/:id/documentos` (`gestionar`): igual que `GET /solicitudes/:id/documentos` de cualquier solicitud (con los comprobantes si está liquidada).

### Autorizar y rechazar

- `POST /gestiones/:id/autorizar` (`autorizar`, sin cuerpo) y `POST /gestiones/:id/rechazar` (`autorizar`, cuerpo `{ motivo }`). Responden 200 con el detalle de Gestiones ya actualizado (`estado` «autorizada» o «rechazada», `historial` con el renglón nuevo).
- `motivo` es texto libre y obligatorio (no hay motivos predeterminados): se recorta, no puede quedar vacío y admite hasta 300 caracteres (`LIMITES_SOLICITUD.MOTIVO_RECHAZO`). Si falta, queda en blanco o se excede: 400 `{ error, campos: { motivo } }` con la regla y cómo corregirla.
- Condición: la solicitud debe estar «esperando autorización» y no vencida (salida anterior a hoy, hora de Guatemala). Si no, 403 con un mensaje que nombra el estado actual («Vencida», «Rechazada», «Autorizado»…); 404 si no existe.
- Bloqueo transaccional: una sola transacción con `SELECT … FOR UPDATE` sobre la solicitud (sin bloquear la fila compartida de `viaticos_estados`); con la fila bloqueada se vuelve a comprobar el estado y el vencimiento, cambia `estado_id` e inserta el renglón de `viaticos_historial` (estado nuevo, usuario que decide y, al rechazar, el `motivo`). Dos decisiones simultáneas o un doble clic no se aplican dos veces: la segunda recibe el 403.
- Una solicitud rechazada se modifica con `PUT /solicitudes/:id` y vuelve a «esperando autorización»; el motivo queda en el historial y el pipeline solo lo muestra mientras esté rechazada.

### Efectos posteriores al commit

Un fallo de cualquiera se registra con `console.error` y no deshace la decisión.

- Autorizar: se regenera el PDF con la etapa `AUTORIZACION` (`<CORRELATIVO>_AUTORIZACION`); el detalle que recibe el generador ya incluye el renglón «autorizada» del historial y de ahí sale el nombre que se imprime sobre la línea de Administración.
- Notificación al solicitante (`modulo = 'viaticos'`, `vale_id` NULL): «Tu solicitud VIA-GT-000123 fue autorizada.» (`tipo` `solicitud_autorizada`, `nivel` `info`) o «Tu solicitud … fue rechazada. Motivo: …» (`tipo` `solicitud_rechazada`, `nivel` `alerta`).
- Tiempo real: ver abajo.

### Tiempo real

- Sala `viaticos:gestion`: un cliente se une con `register_module('viaticos:gestion')`; el validador de sala (`events.js`, registrado con `registrarValidadorSala`) solo la concede a quien tenga `viaticos.gestionar` en el socket ya autenticado.
- Evento `viaticos_actualizada` con `{ id, correlativo, estado, solicitanteId, actorId, accion }` (el cliente compara `solicitanteId` con su usuario para saber si la solicitud es suya y `actorId` para no avisar a quien hizo la acción); `accion` es `creada`, `modificada`, `dada_de_baja`, `autorizada`, `rechazada` o `liquidada`, y `estado` es el estado guardado (`null` al dar de baja, porque la solicitud ya no existe). Se envía a la sala de gestión (`sendToModule`) y al solicitante (`sendToUsers`) después del commit al crear, modificar, dar de baja, autorizar, rechazar y liquidar; quien está en ambos puede recibirlo dos veces (el cliente solo refresca). Un fallo al emitir se registra y no deshace la operación.

## Liquidación (F3.6)

Los endpoints del solicitante (`/solicitudes/:id/…`) son solo del propio usuario y solo exigen `viaticos.ver`; el de contabilidad (`/gestiones/:id/liquidacion`) exige `viaticos.liquidar`. Código en `services/liquidacionService.js` (casos de uso), `services/liquidacionCalculoService.js` (cálculo puro) y `repositories/comprobanteRepository.js`.

### Qué se liquida

- Solo viajes de más de 1 día, en estado «autorizada» y con el viaje terminado (hoy de Guatemala posterior a la fecha de regreso). Las comidas y la depreciación del vehículo propio no se liquidan ni cuentan en `solicitadoALiquidar`.
- Rubros y cantidad máxima de comprobantes, derivados de la solicitud: Hospedaje = total de noches (uno por noche); Combustible = 1 (si el combustible solicitado es mayor que cero); cada renglón de «otros gastos» = 1 comprobante de su tipo de gasto (dos peajes = dos comprobantes de «Peaje»). Un tipo de gasto que no forma parte de la solicitud no admite comprobantes.
- Hospedaje y Combustible son filas de `viaticos_tipos_gasto` con `seleccionable_en_gastos = 0`; el servidor las identifica por nombre exacto (`RUBROS_FIJOS` en `constantes.js`: «Hospedaje» y «Combustible»). Si faltan: 409 explicativo. Por eso `/config/tipos-gasto` no permite renombrarlas ni desactivarlas (409 con el motivo).
- El importe de combustible se recalcula con los mismos km, rendimiento y precio de la solicitud (misma fórmula que el cálculo).

### Resumen en dinero (en la moneda de la solicitud)

`resumen = { solicitadoALiquidar, liquidado, faltaPorLiquidar }`: solicitado = hospedaje + combustible + otros gastos de la solicitud; liquidado = suma de los montos de los comprobantes; `faltaPorLiquidar` = max(0, solicitado − liquidado). Además `pendientes` (un renglón por rubro, completo o no) `{ tipoGastoId, nombre, esOtros, solicitados, liquidados }` y `faltanComprobantes` (suma de lo que falta de cada rubro). Los montos son informativos: contabilidad hace el cálculo definitivo fuera del sistema.

**Decisión del dueño:** «Liquidar» lo marca el solicitante cuando quiere, aunque falten comprobantes: exigir todos los comprobantes (o un monto exacto) es una limitación demasiado estricta. Lo que sí se mantiene es el tope por rubro (no se pueden cargar más comprobantes de los solicitados). Lo que falte solo se informa (`avisoFaltantes`); contabilidad ve los comprobantes cargados y hace el cálculo definitivo fuera del sistema.

### `GET /solicitudes/:id/liquidacion`

```json
{
  "solicitudId": 12, "correlativo": "VIA-GT-000123", "estado": "autorizada",
  "moneda": { "id": 1, "codigo": "GTQ", "nombre": "Quetzal", "simbolo": "Q" },
  "resumen": { "solicitadoALiquidar": 1439.64, "liquidado": 301, "faltaPorLiquidar": 1138.64 },
  "pendientes": [ { "tipoGastoId": 1, "nombre": "Hospedaje", "esOtros": false, "solicitados": 3, "liquidados": 1 } ],
  "faltanComprobantes": 6,
  "comprobantes": [ { "id": 5, "tipoGastoId": 1, "rubro": "Hospedaje", "descripcion": null, "monto": 301, "nombreArchivo": "hotel.png", "tipoArchivo": "image/png", "tamano": 1024, "url": "https://…/VIA-GT-000123_LIQUIDACION_HOSPEDAJE_1.png", "subidoEn": "2026-11-12 09:30:00" } ],
  "editable": true,
  "puedeLiquidar": true,
  "motivoNoPuedeLiquidar": null,
  "avisoFaltantes": "Aún faltan comprobantes de la solicitud VIA-GT-000123 (Hospedaje: faltan 2 de 3; …). Puedes liquidarla igual; contabilidad verá los que hayas cargado."
}
```

- `editable`: se pueden agregar y quitar comprobantes (autorizada con el viaje terminado). `puedeLiquidar`: igual a `editable` (los comprobantes que falten no lo impiden); si es `false`, `motivoNoPuedeLiquidar` dice por qué (el viaje aún no termina, ya está liquidada…); si es `true`, es `null`. `avisoFaltantes` es un texto informativo (o `null` si no falta ninguno) para que la interfaz advierta antes de confirmar.
- 403 explicativo si la solicitud es ajena, de 1 día o menos o no está autorizada ni liquidada; 404 si no existe. Con el viaje aún en curso responde 200 con `puedeLiquidar: false`.

### `POST /solicitudes/:id/comprobantes`

- `multipart/form-data`: campo de archivo `archivo` (un solo archivo) y campos `tipoGastoId`, `monto`, `descripcion` e `idempotencyKey` (opcional, 1 a 64 caracteres).
- `monto` mayor que cero, con hasta 2 decimales y como máximo 99,999,999.99. `descripcion` es obligatoria solo si el tipo de gasto es «otros» (hasta 100 caracteres); para los demás tipos se ignora y se guarda vacía.
- El archivo se valida contra `viaticos_ajustes` igual que las fotos de defectos: tipo declarado permitido, contenido real que coincide con el tipo, tamaño máximo y, en imágenes, tope de megapíxeles.
- Respuesta 201: `{ comprobante, …liquidacion }`, donde `comprobante` tiene la forma de cada elemento de `comprobantes` y el resto es la misma respuesta que `GET /solicitudes/:id/liquidacion` ya actualizada.
- 400 `{ error, campos }` por campo (`tipoGastoId`, `monto`, `descripcion`, `archivo`, `idempotencyKey`), por ejemplo cuando el rubro ya tiene todos sus comprobantes («solicitaste 3 y llevas 3»). 403 si la solicitud no admite comprobantes (ajena, de 1 día o menos, no autorizada, viaje sin terminar o ya liquidada); 404 si no existe.
- Una sola transacción con la solicitud bloqueada (`SELECT … FOR UPDATE`): el estado, el fin del viaje y la cantidad por rubro se vuelven a comprobar con la fila bloqueada, así dos envíos simultáneos no pasan del máximo.
- Idempotencia: la llave se guarda por usuario como `viaticos:<usuarioId>:<llave>` con el endpoint `viaticos:comprobante`; repetir el `POST` con la misma llave devuelve el resultado ya guardado sin subir de nuevo el archivo, y envíos simultáneos con la misma llave se serializan (misma cola que la creación). Una llave ya usada en otra operación (p. ej. al crear una solicitud) da 400 en `idempotencyKey`.
- Si algo falla después de subir el archivo, se intenta borrarlo de Storage (solo actúa en producción).

### `DELETE /solicitudes/:id/comprobantes/:comprobanteId`

- Solo mientras la solicitud sigue «autorizada»; ya «liquidada» no se agregan ni se quitan comprobantes (403). 404 si el comprobante no existe o es de otra solicitud.
- Responde 200 con la misma forma que `GET /solicitudes/:id/liquidacion`. El archivo se borra de Storage después del commit (solo actúa en producción).

### `POST /solicitudes/:id/liquidar`

- Una transacción con la fila bloqueada (`SELECT … FOR UPDATE`, con el estado en una subconsulta, no en un JOIN): vuelve a comprobar estado y fin del viaje (no exige todos los comprobantes); pasa a «liquidada» e inserta el renglón de `viaticos_historial` (usuario = solicitante, sin motivo). Responde 200 con el detalle de la solicitud (como `GET /solicitudes/:id`).
- 403 explicativo si el viaje aún no termina o si ya está liquidada. Una segunda liquidación o un doble clic no se aplica dos veces.
- Después del commit (un fallo se registra y no deshace la liquidación): notificación `modulo = 'viaticos'`, `tipo` `solicitud_liquidada`, `nivel` `info`, sin `vale_id`, a los usuarios activos con `viaticos.liquidar` (sin el rol Administrador) con el correlativo y el solicitante en el mensaje, y evento `viaticos_actualizada` (`accion` `liquidada`) a la sala `viaticos:gestion` y al solicitante.

### `GET /gestiones/:id/liquidacion` (`viaticos.liquidar`)

Solo lectura para contabilidad; funciona con solicitudes de cualquier persona y también si aún no hay comprobantes.

```json
{
  "solicitudId": 12, "correlativo": "VIA-GT-000123", "estado": "liquidada",
  "pipeline": { "fase": "liquidada", "etiqueta": "Liquidado" },
  "solicitante": { "id": 4, "nombre": "…" }, "pais": { "codigo": "GT", "nombre": "Guatemala" },
  "moneda": { "id": 1, "codigo": "GTQ", "nombre": "Quetzal", "simbolo": "Q" },
  "resumen": { "solicitadoALiquidar": 1439.64, "liquidado": 1747.5, "faltaPorLiquidar": 0 },
  "diferencia": 307.86,
  "pendientes": [ … ], "faltanComprobantes": 0,
  "comprobantes": [ { "id": 5, "rubro": "Hospedaje", "monto": 301, "url": "…", "nombreArchivo": "hotel.png", "tipoArchivo": "image/png", … } ],
  "pdf": { "titulo": "Solicitud VIA-GT-000123", "tipo": "pdf", "url": "https://…" }
}
```

- `diferencia` = `liquidado` − `solicitadoALiquidar` (negativa si se liquidó menos de lo solicitado). `pdf` es `null` si la solicitud no tiene PDF.
- Solo solicitudes de más de 1 día «autorizadas» o «liquidadas»; las demás: 403 explicativo (de 1 día o menos, esperando autorización, rechazada…). 404 si no existe.
- La acción `liquidar` de `pipeline.acciones` en Gestiones (con `viaticos.liquidar`) aparece con el viaje terminado y también ya liquidada, para poder revisar los comprobantes después.

### Documentos

`GET /solicitudes/:id/documentos` y `GET /gestiones/:id/documentos`: si la solicitud está «liquidada», se agregan al final los comprobantes en orden de carga, con título legible `Comprobante <n>: <rubro> · <símbolo> <monto>` (con la descripción entre paréntesis en los de tipo «otros») y `tipo` `pdf` o `imagen`. Antes de liquidar no aparecen ahí.

### Nombres ante duplicados

Los comprobantes se nombran `<CORRELATIVO>_LIQUIDACION_<RUBRO>_X` en el bucket de viáticos; `X` parte de `máximo existente + 1` entre los comprobantes vigentes del rubro. Storage no sobrescribe y fuera de producción el borrado no actúa, así que al quitar un comprobante y agregar otro el nombre puede seguir ocupado. Cuando Storage responde «ya existe» (409), el servidor prueba el contador siguiente, hasta 5 intentos por comprobante (`ARCHIVOS.INTENTOS_NOMBRE`); el nombre que quedó guardado es el de la URL del comprobante. Si se agotan los 5 intentos: 409 explicativo («… después de 5 intentos …») y no se guarda nada. En producción el borrado sí actúa y el contador nunca choca.
