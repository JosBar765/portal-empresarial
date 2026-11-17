# Recibos firmados en la liquidación de viáticos

Rama: `module/viaticos`. Estado: análisis cerrado con el dueño (2026-11-17); T0 (mockup) en curso. Estrategia de entrega: `ask-on-risk` (el pronóstico supera las ~400 líneas: antes del primer commit grande se pregunta la estrategia de cadena).

## Objetivo
Las comidas y la depreciación SÍ se liquidan, pero no con un comprobante de un tercero sino con un **recibo** que genera y firma el propio solicitante dentro del sistema (firma dibujada en la pantalla, como medida de seguridad: solo él puede generarlo). El recibo también sirve para respaldar cualquier otra plata recibida.

## Problema
- Hoy `solicitadoALiquidar` excluye comidas y depreciación, y esos rubros no admiten comprobantes (`liquidacionService.js`, `liquidacionCalculoService.js`, contrato «Liquidación (F3.6)»).
- El recibo en papel (formato de Trofex) se llena y firma a mano.

## Decisiones del dueño
- **Monto solicitado a liquidar:** incluye comidas y depreciación (si la hay).
- **Un recibo por rubro:** Alimentación y Depreciación (solo con vehículo propio), como máximo uno cada uno; completan su rubro en «Pendiente por liquidar» (`Alimentación 0 de 1`).
- **Otro:** recibos sin límite, con concepto libre; no cuentan para ningún rubro pero suman en «Liquidado».
- **Datos los ingresa el solicitante;** el modal solo facilita: valores sugeridos editables (monto = total solicitado del rubro, fecha = hoy, concepto = rubro + fechas del viaje).
- **Monto:** sin tope frente a lo solicitado (contabilidad siempre revisa); mismo máximo general 99,999,999.99.
- **Monto en letras:** lo escribe el sistema en el servidor (función pura número → español, «Cuatrocientos cuarenta 00/100», moneda de la solicitud); el modal muestra la vista previa que devuelve el servidor.
- **«Recibí de»:** texto libre, vacío y obligatorio (la empresa que paga varía).
- **Forma de pago:** una sola, obligatoria (Efectivo, Cheque, Transferencia); Cheque exige N° de cheque; Transferencia con N° de cuenta opcional.
- **Corrección:** mientras la solicitud no esté liquidada, el recibo se puede quitar y volver a hacer (como los comprobantes).
- **Recibí conforme:** el nombre del solicitante se imprime solo; firma dibujada (dedo o mouse) obligatoria, con «Limpiar»; la firma vive solo dentro del PDF.
- **Encabezado:** «RECIBO» con el mismo logo (trofeo) del PDF de la solicitud.
- **Número:** correlativo de la solicitud + contador (`VIA-GT-39-R1`).
- **Archivo:** PDF en un bucket propio `SUPABASE_STORAGE_BUCKET_VIATICOS_RECIBOS` (variable nueva, obligatoria, distinta entre staging y producción), nombre `<CORRELATIVO>_LIQUIDACION_RECIBO_<RUBRO>_X`; aparece en «Comprobantes liquidados», el visor y la vista de contabilidad.
- **Seguridad:** solo el solicitante (identidad de `req.user`), solicitud autorizada y viaje terminado, igual que los comprobantes.
- **Mockup obligatorio** (CLAUDE.md): Figma del módulo (https://www.figma.com/design/UxBfvT3cceaLEvnYsnJeZA) para celular, tablet y PC; sin código antes de la aprobación.

## Tareas
- [x] T0. Mockup en Figma del modal del recibo (celular, tablet, PC) y su lugar en el modal de liquidación; aprobación del dueño.
- [x] T1. Diseño técnico: modelo de datos del recibo (tabla propia o comprobante con datos de recibo), migración, ajuste de rubros (Alimentación, Depreciación) y del cálculo.
- [x] T2. Servidor: cálculo de liquidación con comidas y depreciación; endpoints de vista previa, creación y borrado del recibo; número a letras; PDF del recibo con firma; bucket nuevo en `env.js` y `supabaseStorage`.
- [ ] T3. Frontend: modal del recibo con firma dibujada (celular, tablet, PC) e integración en el modal de liquidación.
- [ ] T4. Contabilidad y visor: recibos en la vista de solo lectura y en los documentos.
- [ ] T5. Documentación del módulo (README, contrato, modelo de datos, plano del frontend) y `reglas_entornos.md` si aplica.
- [ ] T6. Pruebas: API y navegador (celular, tablet, PC).

## Rutas
Por definir por tarea (T1–T4 tocan 2+ archivos no triviales: escritor delegado).

## Pruebas
Sin runner automatizado en el proyecto; la función número → letras sí admite verificación determinista con casos (100, 101, 21, 1000, 440.00, 99,999,999.99).

## Evidencia T0 (2026-11-17)
Mockup creado (delegado a un trabajador de diseño; revisado por el padre con una captura del celular): página «Recibo de liquidación», https://www.figma.com/design/UxBfvT3cceaLEvnYsnJeZA?node-id=51-87. Marcos: `51:88` PC liquidación con recibo, `53:109` PC recibo completo, `53:194` tablet, `53:279` celular, `53:363` celular con errores, `54:195` PDF del recibo. Supuestos del diseño por confirmar: en la fila del recibo rubro y monto no se editan (se quita y se rehace); el recibo del PDF ocupa la parte superior de la hoja carta.

**Aprobado por el dueño (2026-11-17)** con dos cambios, sin mockup nuevo: (1) el encabezado del PDF del recibo lleva solo el logo del trofeo, sin nombre de empresa; (2) la firma no se dibuja dentro del modal: un botón «FIRMAR» abre un lienzo a pantalla completa (todo el espacio posible) y, al aceptar, el modal muestra la firma ya hecha (con opción de volver a firmar).

## Diseño técnico (T1, decidido por el padre tras el mapa del explorador)
- **Tabla propia `viaticos_recibos`** (migración `41_viaticos_recibos.sql`), no filas de `viaticos_comprobantes` (allí `tipo_gasto_id` es NOT NULL y «Otro» no tiene rubro): `id`, `solicitud_id` (CASCADE), `contador`, `numero` (`<CORR>-R<contador>`), `rubro` ENUM('alimentacion','depreciacion','otro'), `fecha` DATE, `monto` DECIMAL(10,2) > 0, `monto_letras`, `recibi_de` (100), `concepto` (200), `forma_pago` ENUM('efectivo','cheque','transferencia'), `numero_cheque` NULL, `numero_cuenta` NULL, `ruta`, `tamano`, `creado_en`. UNIQUE (`solicitud_id`, `contador`).
- **Plural de la moneda:** columna `viaticos_monedas.nombre_plural` (misma migración, rellenada por código ISO), con regla de respaldo si está vacía; nada fijo en el código.
- **Cálculo:** `solicitadoALiquidar` suma comidas (Σ `valor_unitario` guardado) y depreciación (km × `depreciacion_por_km`, solo vehículo propio); `liquidado` suma comprobantes + recibos; `pendientes` agrega Alimentación y Depreciación (solicitados = 1 si su importe > 0, sin `tipoGastoId`, con `rubroRecibo`); los recibos «Otro» no cuentan en ningún rubro.
- **Endpoints** (`viaticos.ver`, solo el solicitante): `POST /solicitudes/:id/recibos/letras` (vista previa del monto en letras), `POST /solicitudes/:id/recibos` (multipart: `datos` JSON + archivo `firma` PNG; `idempotencyKey`), `DELETE /solicitudes/:id/recibos/:reciboId`. La liquidación devuelve `recibos` y `sugerenciasRecibo`.
- **PDF:** `services/pdf/reciboPdfService.js` (pdf-lib, carta, recibo arriba, solo el logo del trofeo), bucket `supabaseStorage.viaticosRecibos`, nombre `<CORR>_LIQUIDACION_RECIBO_<RUBRO>_X` con el patrón contador + reintentos.
- **Monto en letras:** función pura nueva en el servidor (no existe en el repo).
- **Firma:** lienzo propio (no hay ninguno en el repo); botón «FIRMAR» a pantalla completa.
- **Commits:** los escritores no commitean; el padre hace los commits por unidad de trabajo, solo con sus archivos.

## Rutas
- T2 servidor + su parte de T5: escritor delegado (dispara el trigger de escritura: 2+ archivos no triviales).
- T3/T4 frontend + su parte de T5: escritor delegado, después de T2 (necesita el contrato).

## Evidencia T2 (2026-11-17, escritor delegado; revisado por el padre)
- Migración 41, `montoEnLetras.js`, `reciboService.js`, `reciboPdfService.js`, `reciboRepository.js`, `reciboController.js`; cálculo con comidas y depreciación; `subirConNombreLibre` compartido por comprobantes y recibos; `eliminarArchivos` recibe el bucket (borrar con el bucket equivocado podía tocar un objeto homónimo). Docs: contrato (sección «Recibos» y arreglo de la línea vieja «con todos los comprobantes completos»), modelo de datos, README, `reglas_entornos.md`.
- Escritor: `node --check` en los 16 archivos; montoEnLetras con 0.5, 1, 15, 21, 100, 101, 440, 1000, 1001, 21000, 100000, 1000000, 2500000.75, 99999999.99 (y 31 000 000, 21 031) correctos; PDF de muestra generado (cheque, transferencia, efectivo); cálculo de ejemplo 650 solicitado / 305 liquidado / 4 faltantes.
- Padre: `node --check` repetido sobre los archivos de `src` cambiados, todos bien; migración leída (idempotente, CASCADE, plural sin pisar valores cambiados).
- Pendiente fuera del alcance de los agentes: `.env.example` (permiso denegado) necesita la línea `SUPABASE_STORAGE_BUCKET_VIATICOS_RECIBOS=`; el dueño debe agregar la variable a su `.env` y correr `npm run migrate` (sin la columna `nombre_plural` falla la lectura de la solicitud).
- Sin probar por HTTP ni contra la BD (T6).
- Entrega: el pronóstico supera ~400 líneas; la rama `module/viaticos` es la unidad de PR del dueño, así que no se encadena (excepción registrada).

## Próximo paso
T3/T4: escritor del frontend.
