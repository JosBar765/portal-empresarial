# Correcciones #37

Base: `.agents/modulos/vales de arte/correcciones/analisis_correcciones_37.md`. Rama: `fix/correcciones-32`. Un commit por punto, en este orden (por dependencias):

| # | Punto del análisis | Estado |
|---|---|---|
| 8 | Cupo del taller solo al autorizar | **hecho** |
| 10 | Centro de notificaciones | pendiente |
| 5 | Obligatorio ver el vale antes de autorizar | pendiente |
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
