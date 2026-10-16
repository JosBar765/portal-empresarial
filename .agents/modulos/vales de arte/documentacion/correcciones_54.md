# Correcciones 54 — Modificaciones por tipo (básica, media y avanzada) y botón único del paso 5

Rama: `feature/modificaciones-por-tipo` (desde `dev`). Pedido: `correcciones/analisis_correcciones_54.md`.

## Qué cambia

- **Botón único en el paso 5.** En `PENDIENTE_CONFIRMACION` el «ojo» y el botón de confirmar/solicitar modificación son uno solo (ícono de documento). Abre el visor con las pestañas «Vale de arte» y «Propuesta» y, **abajo a la derecha**, «Solicitar modificación» y «Confirmar recibido». El visor acepta ahora un parámetro `acciones` (`visorDocumento.js`, pie con botones). Se eliminó el modal `abrirModalDecisionAsesor`.
- **Selector del tipo de modificación** (`actions/modificacionTipo.js`): tres tarjetas seleccionables (Básica +1, Media +2, Avanzada +3 días hábiles), cada una con sus datos clave y el código MOD que se crearía, y un panel plegable «¿Qué es cada modificación?». Con el vale `RECIBIDO` solo se ofrecen Media y Avanzada (el botón «Solicitar modificación» de los vales recibidos se mantiene y abre el mismo selector).
- **Media y Avanzada (vale MOD):** el formulario recibe el tipo, muestra la fecha mínima en días hábiles (consulta `fechas-entrega?modificacion=`), no tiene casilla «urgente» y el servidor la ignora. Los MOD son **acumulables** (`MOD-X`, `MOD2-X`, `MOD3-X`, con `X` el correlativo raíz) y se piden sobre el último vale vigente; `vale_original_id` apunta al vale modificado. Se guardan `modificacion_tipo` y `modificacion_numero`.
- **Básica (sin vale MOD):** el asesor elige taller(es) con propuesta aprobada y escribe el primer mensaje; el vale sigue en el paso 5 y no se puede confirmar ni pedir otra modificación. Chat de 200 caracteres (modal reutiliza el hilo del chat de adjuntos). El taller acepta (su fila vuelve a `ASIGNADO`, el vale pasa a `CREADO`, la entrega pasa al siguiente día hábil y el atraso se recalcula) o rechaza; el asesor puede cancelar. Al aprobarse la nueva propuesta la modificación queda `ENTREGADA` y el vale vuelve al paso 5.
- **Buzón:** marca «Modificación básica» en la fila, botón de conversación para el asesor y para el taller involucrado, y el buzón del encargado muestra primero estas solicitudes aunque su fila ya esté aprobada.
- **Calendario:** `fechaMinimaEntrega`/`validarFechaEntrega` aceptan `diasHabiles` (día que recibe vales contado desde hoy; hoy no cuenta). Con 2 talleres rige el más tardío.
- **Código MOD en listas y reportes:** una sola expresión `/^MOD\d*-/` (`PREFIJO_MOD`, `esCorrelativoMod`, `correlativoBase`, `armarCorrelativoMod`) en `valeHelpers.js` y `utils/formato.js`; el Buzón ordena el original antes que MOD, MOD2, MOD3…

## Migración (importar ANTES de desplegar)

`database/modificaciones_por_tipo.sql` (idempotente): columnas `vales.modificacion_tipo` y `vales.modificacion_numero` (los MOD existentes quedan `MEDIA` número 1), tablas `vale_modificaciones_basicas` y `vale_modificacion_mensajes`, y el permiso `vales.responder_modificacion_basica` para los mismos roles que ya tienen `vales.verificar_adjuntos`. Los usuarios del taller deben cerrar sesión e iniciar de nuevo.

## Archivos

Servidor: `services/valeModificacionBasicaService.js` y `repositories/valeModificacionBasicaRepository.js` (nuevos), `services/valeModificacionService.js`, `valeCreacionService.js` (`validarDatosVale` con `modificacionTipo`), `valeCorreccionService.js`, `valeConfirmacionService.js` y `valeTallerService.js` (bloqueo y cierre), `valeBuzonService.js`, `fechasEntregaService.js`, `valeHelpers.js`, `valeReportePdfService.js`, `controllers/valeController.js`, `routes.js` y `core/calendario/calendarioLaboral.js` / `calendarioService.js`.
Cliente: `actions/modificacionTipo.js` y `actions/modificacionBasica.js` (nuevos), `actions/asesor.js`, `adjuntos.js` (exporta el hilo y el contador), `supervisor.js`, `components/visorDocumento.js`, `forms/valeForm.js`, `views/buzon.js`, `api/valesApi.js`, `permisos.js`, `socket.js`, `utils/formato.js` y los CSS `styles.css` / `visor.css`.

## Verificación

Con la base local y el servidor en el puerto 3031:

- **Básica (API, 20 comprobaciones):** crear con un solo taller de un vale de 2; el otro taller no la ve; confirmar queda bloqueado; el asesor no puede aceptar; chat en ambos sentidos con límite de 200 caracteres; otro taller no lee la conversación; aceptar → vale `CREADO`, fila `ASIGNADO`, nueva fecha; rechazar y cancelar no cambian el vale; no se puede pedir sobre un vale ajeno; Media sin tipo se rechaza.
- **Ciclo completo:** aceptar → el diseñador comienza y entrega la nueva propuesta → el vale vuelve a `PENDIENTE_CONFIRMACION` y la modificación queda `ENTREGADA`.
- **Media y Avanzada:** fecha por debajo del mínimo rechazada con su mensaje (viernes 16/10 +2 → 21/10 porque el 20/10 es feriado; +3 → 22/10); `urgente=on` guardado como 0; `MOD-GT-MTC-1026-51` (Media, número 1) y luego `MOD2-GT-MTC-1026-51` (Avanzada, número 2, apunta al MOD); el original ya modificado se rechaza.
- **Navegador:** botón único y visor con los dos botones abajo a la derecha; selector con su panel informativo; formulario sin «urgente» y con «Entrega mínima»; chat del asesor (solo «Cancelar solicitud») y del taller (solo «Rechazar» y «Aceptar»); toast y fila actualizada tras aceptar.
- No cubierto: autorizar un MOD con el supervisor desde la interfaz (se simuló el estado autorizado en la base) y las vistas móviles del selector y del chat.

## Ajuste posterior: visor con pestañas en los modales de decisión

- **Visor:** las pestañas pueden ser de datos (`{ etiqueta, html }`, sin archivo) además de PDF y propuesta; `abrirVisorDocumentos` arma pestañas a medida. Un modal abierto desde el visor (p. ej. el rechazo) queda por encima de él.
- **Supervisor, autorizar modificación:** ya no es un modal con enlaces que abrían pestañas del navegador. Es un visor con **Datos** (justificación y datos del vale), **Vale nuevo**, el vale que modifica y **Propuesta** (solo si existe), con **Rechazar** y **Autorizar** abajo a la derecha. Abrirlo cuenta como haber visto el vale nuevo.
- **Encargado, revisar propuesta y aprobar/fusionar:** el modal conserva su formulario y los botones sueltos pasan a un solo botón **Ver documentos** que abre el visor con el vale y la propuesta de cada taller.
- **Cliente:** `components/visorDocumento.js`, `css/visor.css`, `actions/supervisor.js` y `actions/encargado.js`. Sin cambios de servidor ni de base de datos.
- **Verificación:** supervisor (4 pestañas, Datos, rechazo encima del visor), encargado de Diseño (fusión con pestañas «Vale de arte» y «Propuesta Diseño»; revisión abriendo en Propuesta). No se ejecutó Autorizar para no consumir los datos de prueba.

## Ajuste posterior: aviso al asesor cuando el taller rechaza una modificación básica

- **Antes:** solo el cartel en vivo y la campana. Al cerrarse la solicitud desaparecían la marca y el chat del buzón, así que quien no vio el cartel no se enteraba.
- **Ahora, mientras el vale sigue en el paso 5 y el asesor no abra el rechazo:** la fila muestra la marca roja **Mod. rechazada** (con el nombre del taller al pasar el cursor) y un botón rojo de chat; el visor del paso 5 muestra una franja «<Taller> rechazó tu modificación. El vale sigue igual.» con el botón **Ver chat**. El chat cerrado dice «El vale sigue igual: puedes confirmarlo o pedir otra modificación.»
- **Se quita cuando:** el asesor abre la conversación, el taller recibe una solicitud nueva o el vale sale del paso 5.
- **Servidor:** `valeBuzonService` agrega `modificaciones_basicas_rechazadas` (último rechazo de cada taller, solo con el vale en `PENDIENTE_CONFIRMACION`) con `listarRechazadasRecientesPorVales`. Sin cambios de base de datos.
- **Cliente:** lo «leído» se guarda por usuario en el navegador (`utils/modificacionesVistas.js`); en otro navegador la marca reaparece. El visor acepta una franja de `aviso`.
