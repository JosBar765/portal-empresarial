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

## Ajuste posterior: la modificación básica se puede pedir con el vale ya confirmado

- **Cuándo:** en el paso 5 (`PENDIENTE_CONFIRMACION`) y también con el vale `RECIBIDO`, siempre que el taller tenga su propuesta aprobada y el vale no tenga un MOD hijo (`modificado = 1`) ni uno en trámite. El selector ofrece la Básica en ambos casos.
- **Si el taller acepta un vale `RECIBIDO`:** su fila vuelve a `ASIGNADO`, el vale pasa a `CREADO` con la entrega al siguiente día hábil, se borran `atraso_congelado_en` y `confirmado_en`, y queda una fila en el historial. Al aprobarse la nueva propuesta vuelve al paso 5 y el asesor lo confirma otra vez.
- **Rechazo:** el aviso al asesor (marca y chat) también aplica a vales `RECIBIDO`.
- **Archivos:** `valeModificacionBasicaService.js`, `valeModificacionBasicaRepository.js`, `valeBuzonService.js`, `actions/modificacionTipo.js` y `views/buzon.js` (en «Trabajo realizado» el taller también ve el botón de chat).
- **Verificación local:** vale recibido `GT-MTC-1026-14`: el asesor la pide, el encargado de Diseño la acepta y el vale vuelve a «En proceso» con la entrega al 19/10.

## Ajuste posterior: reglas de la modificación básica (fecha, estado 2, chat persistente y un trámite por vale)

- **Un trámite por vale:** con una básica en curso (en conversación o aceptada) no se manda otra a ningún taller del vale. La solicitud inicial sí puede elegir varios talleres. Mensaje: «Ya hay una modificación en curso. Espera su resultado.»
- **Fecha del evento:** deja de restringir la básica; es solo de referencia.
- **Fecha de entrega fijada al pedir:** siguiente día que recibe vales desde la solicitud, con la hora de corte del taller (pedida después de la hora máxima cuenta desde el día siguiente); con varios talleres rige el más tardío; nunca adelanta la fecha anterior. Al aceptar se usa la fecha fijada (`calendarioLaboral.fechaMinimaModificacionBasica`). Ejemplo local: pedida el sábado 17/10 → miércoles 21/10 (el 20/10 es feriado).
- **Al aceptar, estado 2:** la fila vuelve a `PENDIENTE_ASIGNACION` sin diseñador y el vale a `CREADO`, con atraso y confirmación limpios; el encargado asigna de nuevo (puede ser otro diseñador). El diseñador anterior solo recibe un refresco.
- **Chat persistente y etiquetas:** `modificaciones_basicas` (todas, con estado) en el payload del buzón. Botón de chat siempre en la fila para el asesor dueño y el equipo del taller; etiqueta «Básica en chat» / «Básica en proceso» durante el trámite y «Básica rechazada» (ámbar) hasta que el asesor la lee. El estilo con borde distingue la básica de las etiquetas MOD.
- **Vale que ya es MOD:** admite básica; el original con `modificado = 1` sigue bloqueado («Pídela sobre el más reciente»).
- **Archivos:** `valeModificacionBasicaService.js`, `valeModificacionBasicaRepository.js`, `valeBuzonService.js`, `core/calendario/calendarioLaboral.js` y `calendarioService.js`; cliente: `views/buzon.js`, `actions/modificacionBasica.js`, `css/styles.css`. Sin migración nueva.
- **Verificación local:** vales 42 (recibido → aceptada → por asignar → asignado a otro diseñador), 44 (multi-taller), 14 (recibido) y `MOD-GT-MTS-0926-7`. Resultados de la fecha con hora de corte simulados contra el calendario real.
