# Correcciones #37

Base: `.agents/modulos/vales de arte/correcciones/analisis_correcciones_37.md`. Rama: `fix/correcciones-32`. Un commit por punto, en este orden (por dependencias):

| # | Punto del análisis | Estado |
|---|---|---|
| 8 | Cupo del taller solo al autorizar | **hecho** |
| 10 | Centro de notificaciones | **hecho** |
| 5 | Obligatorio ver el vale antes de autorizar | **hecho** |
| 6 | Rechazo de creación devuelve el vale con justificación | pendiente |
| 7 | Vigencia de 24 h con avisos | pendiente |
| 4 | Modificación igual al formulario de corregir | pendiente |
| 9 | Rendimiento: vales por asesor | pendiente |
| 2 y 3 | Filtros por fecha de entrega y navegador de mes | pendiente |
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

Verificación: como supervisor en el navegador, una asesora creó dos vales y la campana subió a 2 en vivo en el dashboard; el panel los listó con fecha y hora; marcar una dejó el contador en 1 y se conservó al recargar; en el módulo de Vales aparece la misma campana y "Marcar todas" dejó 0 sin borrar las 2. La campana de Administración usa el mismo código y marcado pero no se probó en pantalla (no se dispone de una sesión de Administrador).

## Punto 5 — El supervisor debe ver el vale antes de autorizarlo

- **Tabla nueva `vale_vistos`** (`vale_id`, `usuario_id`, `visto_en`): qué supervisor ya vio cada vale. Se crea con el `CREATE TABLE` de `schema.sql` en bases existentes.
- **Qué cuenta como "ver":** elegir "Ver info" o "Ver vale" en el botón "Ver" del supervisor (`POST /api/vales/:id/visto`), o abrir el PDF del vale por cualquier vía (`GET /:id/pdf` lo registra en el servidor). Solo cuenta si quien lo abre es supervisor del asesor y el vale está pendiente (esperando autorización o solicitando modificación).
- **Exigencia:** `autorizarCreacion` y `aprobarModificacion` rechazan con "Debes revisar este vale con el botón "Ver" antes de autorizarlo." si ese supervisor no lo vio (`valeVistoService.exigirVisto`); se exige en el servidor, no solo en pantalla. El Administrador queda fuera de la regla.
- **Reinicio:** cuando el asesor corrige el vale se borran sus marcas (`valeCorreccionRepository`), así que hay que volver a verlo.
- **Pantalla:** los modales "Autorizar creación" y "Autorizar modificación" muestran un aviso ("Es de suma importancia que hayas visto este vale antes de autorizarlo…") y el botón "Autorizar" queda deshabilitado hasta que el supervisor lo vea; con el vale ya visto muestran "Ya revisaste este vale." El buzón del supervisor trae un campo `visto` por fila.
- **Pendiente para el punto 4:** la solicitud de modificación se revisa hoy sobre el vale original; al pasar a un vale `MOD-` pendiente, la marca de "visto" se aplicará a ese vale.

Verificación: por API, autorizar sin ver da 400; abrir el PDF (302) o "Ver info" lo habilita; una corrección del asesor reinicia la marca y vuelve a exigirla; un asesor no puede marcar vistos (403). En el navegador, como supervisor: el modal sin ver muestra el aviso con el botón deshabilitado; tras "Ver info" muestra "Ya revisaste este vale." con el botón activo. La ruta de modificación se probará en el punto 4, cuando cambie su flujo.
