# Correcciones 64 — Reportes de actividad de talleres, diseñadores y asesores (Reportes 2)

Rama: `feat/vales-reportes-2` (desde `dev`). Sin maqueta en Figma (decisión del dueño): misma vista y comportamiento que el reporte de actividad de tienda (correcciones 63).

## Problema

Reportes 2 solo tenía el reporte por tienda. Faltaban los equivalentes por taller, por diseñador y por asesor, cada uno con su permiso y su alcance.

## Qué cambia

- **Tres reportes nuevos** en el combo de Reportes 2: «Reporte de actividad de talleres» (`vales.reporte_actividad_taller`), «Reporte de actividad de diseñadores» (`vales.reporte_actividad_disenador`) y «Reporte de actividad de asesores» (`vales.reporte_actividad_asesor`). Los permisos los crea la migración `reportes_actividad_equipos` (solo Administrador; el resto se asigna desde Administración Central).
- **Reglas:** solo vales autorizados; el período filtra por la fecha de entrega; la única excepción es «Atrasados antes del período». «Entregado» es que el Encargado del taller ya aprobó la propuesta (talleres y diseñadores; en revisión aún no cuenta) o que el vale ya llegó al asesor (asesores).
- **Filtros:** talleres, el selector global de taller en cascada (`tallerId` o `tallerIds`); diseñadores y asesores, el selector de selección múltiple de Reportes (`disenadorIds`, `asesorIds`) con la fila «Evaluando a:». Una selección fuera del alcance responde 400.
- **Alcance por permiso:** `vales.gestionar_taller` ve solo sus talleres y los diseñadores de esos talleres; `vales.supervisar`, solo sus asesores (y a sí mismo) y su zona; los demás, todo. Con ambos permisos se unen los alcances (en Actividad el Supervisor prevalece). El reporte de asesores responde 403 a quien solo tiene `vales.gestionar_taller`.
- **PDF:** mismo formato que el de tienda, con una barra por taller, diseñador o asesor y sin cliente.
- **Sin contador total de vales:** los cuatro reportes de actividad (tienda, talleres, diseñadores y asesores) ya no muestran bajo «Vales por …» la línea «N vales · M …». Talleres y diseñadores pueden adelantar trabajo, así que su total de vales con entrega en la ventana no representaba su actividad. Quedan los contadores de cada sección. `cabeceraPanel` omite el subtítulo si no se le pasa.

## Archivos

- `js/views/reportes2/actividadReporte.js` (nuevo): render común (cabecera, filtro, fichas, atrasados vigentes, panel, secciones, vacío, notas y PDF); `actividadTienda.js` pasó a usarlo sin cambiar su comportamiento.
- `js/views/reportes2/actividadEquipos.js` (nuevo): los tres reportes y sus filtros; `catalogo.js`, `textos.js`: entradas y textos.
- `js/api/valesApi.js`: `obtenerReporteActividad` y `descargarReporteActividadPdf` reemplazan a las funciones propias de tienda; `js/state.js`: `tallerId`, `disenadorIds` y `asesorIds` en `state.reporte2`.
- Backend: servicio, rutas y PDF de los tres reportes (ver `permisos_por_permiso.md`).
