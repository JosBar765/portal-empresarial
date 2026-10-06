# Correcciones #37

Base: `.agents/modulos/vales de arte/correcciones/analisis_correcciones_37.md`. Rama: `fix/correcciones-32`. Un commit por punto, en este orden (por dependencias):

| # | Punto del análisis | Estado |
|---|---|---|
| 8 | Cupo del taller solo al autorizar | pendiente |
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
