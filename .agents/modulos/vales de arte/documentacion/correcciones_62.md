# Correcciones 62 — Pestaña «Reportes 2» (contenedor de reportes)

Rama: `feat/vales-reportes-2` (desde `dev`). Sin mockup de Figma (decisión del dueño).

## Problema

Cada reporte nuevo exigía una pestaña propia con su barra de período y sus botones. Hace falta un lugar único donde los reportes futuros se enchufen.

## Qué cambia

- **Pestaña «Reportes 2»** en la barra lateral, con el permiso `vales.ver_reportes` (el mismo de «Reportes»); al elegirla se oculta el buzón, igual que en Reportes.
- **Controles globales:** combo de reporte («Selecciona un reporte» por defecto), la barra de período de Reportes (Hoy · Día · Semana · Mes · Desde–Hasta) y los botones «Actualizar» y «Descargar PDF». El período y «Actualizar» valen para el reporte elegido; el PDF es el suyo y se deshabilita si no define `pdf`.
- **Catálogo vacío:** `reportes2/catalogo.js` exporta `CATALOGO = []` con entradas `{ id, etiqueta, render(contenedor, periodo), pdf?(periodo) }`. Mientras no haya reportes, la pestaña muestra «Aún no hay reportes disponibles en esta pestaña.».
- **Errores:** si `render` falla, el cuerpo dice qué falló y ofrece «Reintentar»; sin conexión, el texto indica revisar la red. Una respuesta vieja no pisa a la última.
- **Sin cambios en tiempo real:** `socket.js` no recarga esta vista (solo «Actualizar»).

## Archivos

- `public/modules/vales/index.html`: botón `#sidebar-item-reportes2` y sección `#reportes2-vista`.
- `js/layout/sidebar.js`, `js/views/buzon.js`, `js/socket.js`, `js/state.js` (`state.reporte2`): vista, despacho y exclusión del refresco en vivo.
- `js/views/reportes2.js`, `js/views/reportes2/catalogo.js`, `js/views/reportes2/textos.js`: pestaña, catálogo y textos.
- `css/reportes2.css` (importado desde `styles.css`): combo y controles.
- `components/barraPeriodoReportes.js` se reutiliza tal cual con `prefijo: 'rp2'`; Reportes no cambia.

Solo frontend: sin base de datos, API ni permisos nuevos.
