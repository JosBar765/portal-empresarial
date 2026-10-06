# Correcciones #37

Base: `.agents/modulos/vales de arte/correcciones/analisis_correcciones_37.md`. Rama: `fix/correcciones-32`. Un commit por punto, en este orden (por dependencias):

| # | Punto del análisis | Estado |
|---|---|---|
| 8 | Cupo del taller solo al autorizar | **hecho** |
| 10 | Centro de notificaciones | **hecho** |
| 5 | Obligatorio ver el vale antes de autorizar | **hecho** |
| 6 | Rechazo de creación devuelve el vale con justificación | **hecho** |
| 7 | Vigencia de 24 h con avisos | **hecho** |
| 4 | Modificación igual al formulario de corregir | **hecho** |
| 9 | Rendimiento: vales por asesor | **hecho** |
| 2 y 3 | Filtros por fecha de entrega y navegador de mes | **hecho** |
| 1 | Supervisor creando vales | **omitido por ahora** (decisión del usuario) |

## Decisiones acordadas

- **Filtros (2):** el filtro de tiempo usa la fecha de entrega en Buzón, Trabajo realizado y Rendimiento.
- **Ventana (3):** queda `Todo`, `< mes >` y rango de fechas; `< mes >` arranca en el mes actual (al retroceder de enero se pasa a diciembre del año anterior) y se desactiva mientras haya un rango elegido, hasta limpiarlo.
- **Modificación (4):** mismo formulario que "Corregir" (archivos actuales precargados, quitar o agregar); datos del original precargados y talleres fijos (todos los del original); la justificación sigue siendo la descripción del vale `MOD-`. Si se rechaza la solicitud, se borra el vale `MOD-` generado (con sus archivos) y el original queda intacto.
- **Ver antes de autorizar (5):** debe abrir "Ver" cada vale pendiente (creación o modificación); se exige también en el servidor; si el asesor corrige el vale, la marca de "visto" se reinicia.
- **Rechazo (6):** el rechazo de una creación no borra el vale: pasa a un estado `RECHAZADO` y vuelve al asesor con una justificación (máx. 50 palabras) y una notificación. El asesor puede corregirlo y reenviarlo con un botón, o darlo de baja. El rechazo de una modificación borra el vale `MOD-`.
- **Vigencia (7):** 24 h desde la creación para ser autorizado, sin reiniciarse por corregir ni reenviar; solo creaciones (no modificaciones); aviso 6 h antes y aviso al expirar, al asesor y a sus supervisores; aplica solo a vales creados después del cambio.
- **Cupo (8):** un vale pendiente no ocupa cupo; se valida (como aviso) al crear, corregir o solicitar modificación, y de forma definitiva al autorizar, en una cola para que solo gane uno. Si ya no hay cupo, el supervisor recibe el error y es él quien rechaza con justificación; no se rechaza solo.
- **Rendimiento (9):** cantidad de vales por asesor, separando autorizados y pendientes, a partir de las columnas ya existentes de `vales`.
- **Notificaciones (10):** se guardan por usuario las mismas notificaciones que hoy salen como aviso, con fecha y hora, marcar como leída (una o todas) y conservación permanente; la campana aparece en todas las pantallas.

## Punto 8 — El cupo del taller solo se ocupa al autorizar

- `capacidadEntregaService` ya no cuenta los vales pendientes: solo cuentan los autorizados (los que tienen filas en `vale_talleres`). Se eliminó `capacidadRepository.listarSolicitadosEnRango` y el parámetro `excluirValeId` (creado para "Corregir"), que ya no hace falta: un vale pendiente no se cuenta a sí mismo ni a otros.
- Crear, corregir y solicitar una modificación siguen validando el cupo como aviso (con el mensaje "¡Uy! El taller… ya no tiene cupo…"), y el calendario del formulario muestra solo los cupos ya autorizados.
- `autorizarCreacion` valida el cupo y reparte el vale a los talleres en el mismo turno de la cola de capacidad (`conColaDeCapacidad`): si varios supervisores autorizan a la vez el último cupo, gana uno solo. A los demás les llega "El taller "X" ya no tiene cupo para la fecha de entrega AAAA-MM-DD. Puedes rechazar el vale indicándole al asesor que elija otra fecha." (`validarLimiteDiario(..., { paraSupervisor: true })`). El vale queda pendiente: rechazarlo y justificarlo es decisión del supervisor, no es automático.
- La aprobación de una modificación ya validaba el cupo dentro de esa cola; no cambió.

Verificación: taller UV/3D (límite 4). Se crearon 6 vales pendientes para el mismo día (todos se aceptaron; capacidad del día 0/4). Se autorizaron 3 (3/4); dos autorizaciones simultáneas con un solo cupo dieron 200 y 400 (4/4, día bloqueado); autorizar uno más dio el error de cupo y el vale siguió pendiente. En el navegador, como supervisor, el modal "Autorizar creación" mostró el mensaje en rojo.

## Punto 10 — Centro de notificaciones

- **Tabla nueva `notificaciones`** (`schema.sql`): `usuario_id`, `vale_id` (se pone en NULL si el vale se borra, la notificación se conserva), `tipo`, `nivel`, `mensaje`, `creado_en`, `leida_en`. Nunca se borran: solo se marcan como leídas. En una base existente hay que crearla (el `CREATE TABLE` está en `schema.sql`).
- **Qué se guarda:** todo lo que sale por `valeEvents.notificar` (mismos avisos que ya salían como toast, incluidas las alertas de atraso), una fila por usuario destinatario. `events.js` convierte las salas de tiempo real en usuarios: `asesor:`, `supervisor:` y `tecnico:` (el id del usuario), `taller:` (encargado del taller y su Asistente de Diseño) y `vales:fusion` (quien tiene `vales.aprobar_general`). El Administrador (sala `vales:admin`) no recibe notificaciones guardadas porque vería toda la actividad de la empresa, y quien ejecuta la acción tampoco recibe la suya.
- **API** (`/api/notificaciones`, cualquier usuario autenticado, sin permiso de módulo): `GET /` (paginado de 20 en 20, con `noLeidas`), `POST /:id/leer` y `POST /leer-todas`. Código en `src/core/notifications/`.
- **Tiempo real:** cada socket entra automáticamente a su sala personal `usuario:<id>` (decisión del servidor) y recibe `notificacion_nueva`.
- **Interfaz:** campana con contador de no leídas en el encabezado del dashboard, de Vales y de Administración (`public/js/notificaciones.js`, estilos en `dashboard.css`). El panel muestra el contenido y la fecha y hora; pulsar una la marca como leída; "Marcar todas como leídas"; "Cargar más". Las leídas se conservan en la lista.
- **Retención de 60 días:** las notificaciones **leídas** con más de 60 días se borran solas (`notificacionLimpieza.js`, al arrancar el servidor y cada 6 horas; `notificacionRepository.purgarLeidasAntiguas`). Las **no leídas nunca se borran**, por antiguas que sean.
- **Lista fluida:** marcar una como leída, marcar todas y «Cargar más» conservan el desplazamiento de la lista (ya no vuelve arriba).

Verificación: como supervisor en el navegador, una asesora creó dos vales y la campana subió a 2 en vivo en el dashboard; el panel los listó con fecha y hora; marcar una dejó el contador en 1 y se conservó al recargar; en el módulo de Vales aparece la misma campana y "Marcar todas" dejó 0 sin borrar las 2. La campana de Administración usa el mismo código y marcado pero no se probó en pantalla (no se dispone de una sesión de Administrador).

## Punto 5 — El supervisor debe ver el vale antes de autorizarlo

- **Tabla nueva `vale_vistos`** (`vale_id`, `usuario_id`, `visto_en`): qué supervisor ya vio cada vale. Se crea con el `CREATE TABLE` de `schema.sql` en bases existentes.
- **Qué cuenta como "ver":** elegir "Ver info" o "Ver vale" en el botón "Ver" del supervisor (`POST /api/vales/:id/visto`), o abrir el PDF del vale por cualquier vía (`GET /:id/pdf` lo registra en el servidor). Solo cuenta si quien lo abre es supervisor del asesor y el vale está pendiente (esperando autorización o solicitando modificación).
- **Exigencia:** `autorizarCreacion` y `aprobarModificacion` rechazan con "Debes revisar este vale con el botón "Ver" antes de autorizarlo." si ese supervisor no lo vio (`valeVistoService.exigirVisto`); se exige en el servidor, no solo en pantalla. El Administrador queda fuera de la regla.
- **Reinicio:** cuando el asesor corrige el vale se borran sus marcas (`valeCorreccionRepository`), así que hay que volver a verlo.
- **Pantalla:** los modales "Autorizar creación" y "Autorizar modificación" muestran un aviso ("Es de suma importancia que hayas visto este vale antes de autorizarlo…") y el botón "Autorizar" queda deshabilitado hasta que el supervisor lo vea; con el vale ya visto muestran "Ya revisaste este vale." El buzón del supervisor trae un campo `visto` por fila.
- **Pendiente para el punto 4:** la solicitud de modificación se revisa hoy sobre el vale original; al pasar a un vale `MOD-` pendiente, la marca de "visto" se aplicará a ese vale.

Verificación: por API, autorizar sin ver da 400; abrir el PDF (302) o "Ver info" lo habilita; una corrección del asesor reinicia la marca y vuelve a exigirla; un asesor no puede marcar vistos (403). En el navegador, como supervisor: el modal sin ver muestra el aviso con el botón deshabilitado; tras "Ver info" muestra "Ya revisaste este vale." con el botón activo. La ruta de modificación se probará en el punto 4, cuando cambie su flujo.

## Punto 6 — El rechazo de creación devuelve el vale al asesor

- **Estado nuevo `RECHAZADO`** (`estados_vale` id 9) y tres columnas en `vales`: `rechazo_motivo`, `rechazado_por`, `rechazado_en`. Además, `vale_historial.accion` pasó de 150 a 500 caracteres para poder guardar el motivo. En una base existente: `ALTER TABLE vales ADD COLUMN …`, `INSERT INTO estados_vale (id, nombre) VALUES (9, 'RECHAZADO')` y `ALTER TABLE vale_historial MODIFY accion VARCHAR(500) NOT NULL` (ver `schema.sql` y `seed.sql`).
- **Rechazar (supervisor):** el botón "Rechazar" del modal "Autorizar creación" abre un modal con la justificación, obligatoria y de máximo 50 palabras (contador en vivo; el servidor valida lo mismo). El vale no se borra: pasa a `RECHAZADO` y queda con el asesor. Estado, motivo e historial cambian en una sola transacción (`valeRechazoRepository.rechazar`). El vale sale del buzón del supervisor.
- **Aviso al asesor:** notificación (en la campana, con franja de alerta) y aviso en vivo con el motivo: "Vale: X fue rechazado por … Motivo: …". El buzón del asesor gana el contador "Rechazados" (arriba) y el estado "Rechazado" en rojo.
- **Qué puede hacer el asesor con un vale rechazado:** "Ver motivo del rechazo", "Corregir" (el formulario muestra el motivo; el vale sigue rechazado hasta reenviarlo), "Reenviar a autorización" (`POST /api/vales/:id/reenviar`, permiso `vales.corregir`; valida que la fecha de entrega no haya pasado y avisa si el taller ya no tiene cupo; reinicia las marcas de "visto"; avisa a los supervisores) y "Dar de baja" (se borra como antes).
- **Historial:** nuevas categorías `RECHAZO_CREACION` y `REENVIO_AUTORIZACION`, visibles para asesor, supervisor y gerente; las correcciones de un vale rechazado también se registran.
- **Corrección en el camino:** las notificaciones de un vale que se borra (dar de baja) ya no fallaban en silencio: se guardan sin referenciar el vale (`valeBorrado` en `valeEvents.notificar`).
- El rechazo de una **modificación** no cambia en este punto: se resuelve en el punto 4 (se borrará el vale `MOD-`).

Verificación: por API, rechazar sin motivo (400), con 51 palabras (400) y con motivo válido (200, estado `RECHAZADO`, motivo visible para el asesor, notificación guardada); autorizar un vale rechazado da error; reenviar lo devuelve a "esperando autorización" y limpia el motivo; reenviar un vale no rechazado da error; corregir y dar de baja un vale rechazado funcionan. En el navegador, como supervisor, el modal con contador de palabras rechazó el vale con aviso de éxito; como asesora, aparecieron el contador "Rechazados", el estado en rojo, el modal del motivo, la notificación con el motivo, el aviso en "Corregir" y "Reenviar a autorización" dejó el vale otra vez en espera. Una primera prueba falló por el límite de 150 caracteres del historial y dejó un vale a medias (rechazado sin historial); eso motivó la transacción y el ensanche de la columna.

## Punto 7 — Vigencia de 24 horas para ser autorizado

- **Columnas nuevas en `vales`:** `vigencia_hasta` (creación + 24 h, solo para vales creados desde ahora) y `vigencia_aviso_en` (marca el aviso ya enviado). Los vales pendientes que ya existían tienen `vigencia_hasta` NULL y no se tocan (decisión acordada). En una base existente: `ALTER TABLE vales ADD COLUMN vigencia_hasta DATETIME DEFAULT NULL, ADD COLUMN vigencia_aviso_en DATETIME DEFAULT NULL`.
- **Alcance:** solo la creación de vales (`crearVale` fija `conVigencia`); las solicitudes de modificación no expiran. El plazo cuenta desde la creación y **no se reinicia** al corregir, rechazar ni reenviar. Aplica a vales en `ESPERANDO_AUTORIZACION` y `RECHAZADO`.
- **Vigilante** (`vigenciaWatcher.js`, cada 60 s, mismo proceso que `atrasoWatcher`):
  - 6 horas antes del final avisa una sola vez: "Vale: X está por expirar: se eliminará automáticamente en menos de 6 horas si no es autorizado" (al asesor y a sus supervisores; si el vale está rechazado, solo al asesor).
  - Al vencer, `valeCreacionService.expirarVale` (dentro del lock del vale, comprobando de nuevo el estado) elimina el vale con sus archivos de Storage y avisa al asesor y a sus supervisores: "Vale: X fue eliminado automáticamente: venció su vigencia de 24 horas sin ser autorizado".
- Ambos avisos son notificaciones de alerta guardadas en el centro de notificaciones (tipos `POR_EXPIRAR` y `EXPIRADO`); la de un vale eliminado se guarda sin referenciar el vale. `valeEvents.notificar` gana el parámetro `texto` para frases que no empiezan por "fue …".

Verificación (la hora del servidor es UTC-6; las pruebas deben usar la misma zona): un vale nuevo queda con 24 h de vigencia; uno con 5 h restantes recibe el aviso una sola vez (una segunda revisión no lo repite); uno vencido en espera de autorización se elimina junto con su imagen en Storage; uno vencido y rechazado también; uno con 24 h completas y los 22 vales viejos sin vigencia no se tocan. En el navegador, como asesora, el vigilante del servidor entregó en vivo a la campana el aviso de "por expirar" y el de "eliminado automáticamente", y el vale vencido desapareció del buzón.

## Punto 4 — Modificación igual al formulario de corregir

**Cambio de diseño:** antes la solicitud guardaba los datos en `vale_solicitudes_modificacion` y el vale `MOD-` solo se creaba al aprobarla. Ahora **el vale `MOD-` nace al solicitar la modificación**, con sus datos, archivos y PDF, en estado `ESPERANDO_AUTORIZACION` y enlazado a su original (`vale_original_id`). Mientras espera, el vale `MOD-` está oculto (`valeRepository.listarTodos` lo excluye): el asesor y los demás roles ven solo el original en "Solicitando modificación".

- **Formulario del asesor:** es el mismo de crear y corregir (`abrirModalFormularioVale`, modo `modificar`): datos y fechas precargados, archivos del original precargados para quitarlos o reemplazarlos, y subida de archivos nuevos. Los talleres quedan fijos (todos los del original, sin selector) y la descripción es la **justificación de la modificación**, obligatoria, que pasa a ser la descripción del vale `MOD-` (no hay una segunda descripción). `POST /api/vales/:id/solicitar-modificacion` ahora es multipart (`valeModificacionService.solicitarModificacion`).
- **Archivos y transacciones:** igual que "Corregir": se suben primero los archivos nuevos y el PDF del vale `MOD-`; una transacción (`valeModificacionRepository.crear`) crea el vale `MOD-`, copia las referencias de los archivos conservados, marca el original como "solicitando modificación" y registra ambos historiales; si algo falla antes del commit se borra lo recién subido. Los archivos conservados **comparten** el mismo archivo de Storage con el original, por eso `eliminarValeConArchivos` y el rechazo solo borran de Storage lo que ningún otro vale referencia (`documentoRepository.contarReferenciasEnOtrosVales`).
- **Supervisor:** el botón "Ver" de una solicitud abre el vale `MOD-` (info o PDF), y es ese el que cuenta como "visto". El modal "Autorizar modificación" muestra la justificación, enlaces al PDF modificado, al original y a la propuesta; el botón queda desactivado hasta verlo (abrir el PDF desde el modal también cuenta).
- **Aprobar** (`valeModificacionService.aprobarModificacion`): exige haberlo visto y que el asesor esté a cargo del supervisor (antes no se validaba), valida y consume el cupo en la cola de capacidad, reparte el vale `MOD-` a los talleres, sella la autorización (`MODIFICACION`), le agrega la propuesta del original (el PDF la pone antes de los demás adjuntos: vale `MOD-`, propuesta original, documentos adjuntos), regenera su PDF con la firma, deja el original en `RECIBIDO` con `modificado = 1`, y notifica.
- **Rechazar:** el supervisor confirma en un modal; se borra el vale `MOD-` (documentos e historial caen en cascada) y los archivos de Storage que nadie más usa, y el original vuelve exactamente al estado en que estaba (recuperado del historial). Todo en una transacción (`valeModificacionRepository.rechazar`).
- **Eliminado:** `solicitudModificacionRepository` (las tablas `vale_solicitudes_modificacion` y `estados_solicitud_modificacion` quedan sin uso en la base y pueden retirarse más adelante). Las solicitudes pendientes que existían antes del cambio no tienen vale `MOD-` y se devolvieron a su estado anterior en la base de desarrollo (3 vales); en otra base con solicitudes pendientes hay que hacer lo mismo.
- **Historial:** la autorización de una modificación (`ESPERANDO_AUTORIZACION → MODIFICADO`) se clasifica como autorización, igual que la de una creación.

Verificación: por API, solicitar sin justificación (400); solicitar con un archivo quitado y uno nuevo (200; el `MOD-` no aparece en el buzón del asesor y sí como `mod_pendiente` en el del supervisor); aprobar sin ver (400) y tras ver el PDF (200: vale `MOD-` `MODIFICADO` con el taller en `PENDIENTE_ASIGNACION` y la propuesta original adjunta, original `RECIBIDO` modificado); rechazar (200: `MOD-` borrado, original intacto con sus archivos, la imagen nueva y el PDF del `MOD-` borrados de Storage y la imagen del original conservada); rechazar de nuevo (400); nueva solicitud tras el rechazo (200). En el navegador, como asesora: el formulario precargado, talleres fijos, justificación obligatoria, archivos actuales/nuevos y el aviso de éxito; como supervisor: aviso y botón desactivado antes de ver, "Ver" apuntando al `MOD-`, autorización con aviso de éxito, y el rechazo con su modal de confirmación y el original de vuelta en "pendiente de confirmación".

## Punto 9 — Rendimiento: vales por asesor

- **Sin tablas ni columnas nuevas:** el conteo sale de las columnas ya existentes de `vales` (`asesor_id`, `tienda_id`, `autorizado_por`) sobre los mismos vales de la ventana de tiempo del resto de la pantalla. `valeRendimientoService._porAsesor` agrupa los vales **originales** (no cuenta los `MOD-`, igual que las demás métricas) y devuelve, por asesor, `total` (ingresados), `autorizados` (los que ya pasaron por la autorización del supervisor, `autorizado_por` no nulo) y `sinAutorizar` (los que siguen esperándola o fueron rechazados). Ordenado por ingresados.
- **Pantalla:** nuevo panel "Vales por asesor" al final de Rendimiento (Gerente y Supervisor): asesor, tienda, ingresados, autorizados y sin autorizar (en rojo si hay), con una fila de total. El Supervisor ve solo a sus asesores, como en el resto de la vista. Se agregó la explicación en "Cómo se calculan estas métricas".
- Los vales que se borran (dados de baja o vencidos) dejan de contarse, porque ya no existen en la tabla.

Verificación: Karla Ordoñez figura con 40 ingresados y 26 autorizados, igual que el conteo directo en la base; la suma del Gerente es 207 (181 autorizados, 26 sin autorizar) y el Supervisor ve solo sus 11 asesores. En el navegador, como Gerente, aparece el panel con el total.

## Puntos 2 y 3 — Filtros por fecha de entrega y navegador de mes

- **Fecha de entrega:** `dentroDeVentana` (Buzón y Trabajo realizado) y la ventana de Rendimiento filtran ahora por `fecha_entrega`, no por la de creación. El rango "Desde" sin "Hasta" queda abierto hacia adelante (ya no se corta en hoy), porque las entregas son futuras.
- **Navegador de mes:** reemplaza a Día, Semana y Mes. Quedan `Todo`, `< mes año >` y el rango Desde/Hasta; arranca en el mes actual, las flechas pasan de enero al diciembre del año anterior y viceversa, y pulsar el nombre del mes vuelve al actual.
- **Exclusión:** con un rango elegido el selector de mes se desactiva; con `Todo` se desactivan las flechas. Limpiar el rango vuelve al mes actual.
- **Aplica a:** Buzón, Trabajo realizado y Rendimiento (la ventana anterior de comparación y la tendencia usan la fecha de entrega; ya no existen las ventanas día/semana).

Verificación en pantalla (Gerente y Supervisor de Ventas): arranca en Octubre 2026 (16 vales en Rendimiento, 9 en el Buzón); la flecha lleva a Septiembre (66 vales; 2 en el Buzón del supervisor); `Todo` da 220 y desactiva las flechas; elegir "Desde 06/10/2026" desactiva el mes y por API devuelve 42 vales con el rango abierto.

Verificación de la retención: con tres filas de prueba (leída hace 61 días, leída hace 59 días y no leída de 90 días) la purga borró solo la primera.
