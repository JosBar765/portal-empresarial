# Correcciones 63 — Reporte de actividad de tienda (Reportes 2)

Rama: `feat/vales-reportes-2` (desde `dev`). Diseño aprobado por el dueño en Figma (escritorio, móvil, estados y PDF).

## Problema

La pestaña «Reportes 2» (correcciones 62) no tenía ningún reporte. El primero es el de actividad enfocado solo en tiendas, para quien necesita ver cómo van los vales por tienda sin los controles de Actividad.

## Qué cambia

- **Reporte de actividad de tienda** en el combo de Reportes 2, con el permiso nuevo `vales.reporte_actividad_tienda` (migración `reporte_actividad_tienda`, concedida solo al Administrador; el resto se asigna desde Administración Central).
- **Reglas:** solo vales autorizados; el período filtra por la fecha de entrega; la única excepción es «Atrasados antes del período» (abiertos y vencidos, también autorizados), que aparece solo si hay alguno. «Entregado» es que el vale ya llegó al asesor.
- **Vista:** encabezado con título, período y hora de actualización; un solo filtro, la tienda, con el selector global de tienda en cascada (país, grupo y tienda, igual que en Reportes; «Todas las tiendas» o «Todas mis tiendas» para quien supervisa); la consulta envía `tiendaId` o `tiendaIds` y el servidor rechaza con 400 un valor mal formado o fuera de las tiendas visibles del usuario; panel «Vales por tienda» con las secciones Atrasados en el período, No entregados y Entregados (plegada), tablas planas con la tienda como columna y el estado en cinco pasos; en móvil las filas pasan a tarjetas. Sin vales se muestra el estado vacío con «Ver el mes completo». Hay esqueleto de carga y error con «Reintentar».
- **Alcance:** quien tiene `vales.supervisar` ve solo las tiendas bajo su supervisión; los demás ven todas.
- **PDF:** mismo formato que el de Actividad, con una barra por tienda y sin cliente.
- **Permiso por reporte:** el catálogo de Reportes 2 acepta `permiso` por entrada y el combo lista solo los reportes que la persona puede ver; sin ninguno se muestra «Aún no hay reportes disponibles en esta pestaña.».

## Archivos

- `js/views/reportes2/actividadTienda.js` (nuevo), `catalogo.js`, `textos.js`: reporte, entrada del catálogo y textos.
- `js/views/reportes2.js`: filtra el catálogo por permiso, esqueleto de carga y contexto `{ recargar, cambiarVentana }` para el reporte.
- `js/views/reportes.js`: exporta funciones ya existentes (tabla y secciones plegables, esqueleto) sin cambiar su comportamiento; `htmlTablaSeccion` recibe `taller` y `htmlSeccion` un `prefijo` de ids opcionales. Son piezas compartidas temporales: Reportes 2 sustituirá a «Reportes» y esa lógica se migrará a `reportes2/` (ver `flujo_vale_de_arte.md` §11.1).
- `js/api/valesApi.js`, `js/state.js` (`state.reporte2.tiendaId`), `css/reportes2.css`.
- Backend: rutas, servicio y PDF de `actividad-tienda` (ver `permisos_por_permiso.md`).
