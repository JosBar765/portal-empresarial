# Correcciones 41 — Filtro por período (Hoy, mes y día) y fuera el filtro por estados

Se trabajó sobre la rama `feature/contadores-por-paso` (los cambios de las correcciones 40 aún sin commit tocan los mismos archivos).

## 1. Se quita el desplegable de estados

Se eliminó el desplegable «Todos los estados» del Buzón, junto con `poblarFiltroEstado`, `state.estadoFiltro`, las constantes `CLAVES_ESTADOS_*` de `config/estados.js`, el parámetro `estado` de la API y el filtro de estado de `valeBuzonService.obtenerBuzon`. Se conservan la búsqueda, los contadores y el combobox de diseñadores del encargado.

## 2. Selector de período

Barra: `[Todo] [Hoy] [‹ Octubre 2026 ▾ ›] [Desde — Hasta]`.

- **Hoy:** chip nuevo; filtra las entregas del día actual y se resalta mientras ese día esté elegido.
- **Selector de mes:** ahora es un botón que abre un panel de dos niveles (`components/selectorPeriodo.js`, con el aspecto del calendario de los formularios): calendario del mes (un día filtra solo ese día, atajo «Todo octubre») y, al pulsar el título del mes, cuadrícula de 12 meses con flechas de año (un mes filtra todo ese mes). Se cierra al elegir, con Esc (devuelve el foco al botón) o con clic fuera; solo un panel de fecha abierto a la vez; el foco inicial cae en el día elegido, en hoy o en el primero.
- **Etiqueta y flechas:** mes → «Octubre 2026» y las flechas avanzan de mes en mes; día → «mié 7 oct 2026» y avanzan de día en día. Con «Todo» o con un rango las flechas quedan deshabilitadas.
- **Rango:** Desde/Hasta no cambian; elegir un mes o un día vacía el rango y viceversa. El selector ya no se desactiva mientras hay un rango, para poder cambiar de modo directamente.
- **Servidor:** sin cambios. Un día viaja como `ventana=rango&desde=F&hasta=F` (`utils/ventana.js`, `aplicarVentanaAQuery`, usado por el Buzón y por Rendimiento). Se sigue filtrando por la fecha de entrega.

## Archivos

`index.html`, `css/styles.css`, `js/layout/toolbar.js`, `js/layout/sidebar.js`, `js/components/selectorPeriodo.js` (nuevo), `js/components/datepicker.js` (exports), `js/utils/ventana.js` (nuevo), `js/views/buzon.js`, `js/views/rendimientoGerencia.js`, `js/state.js`, `js/config/estados.js`, `valeController.js` y `valeBuzonService.js`.

## Verificación

Con 7 vales de ejemplo con fechas de entrega distintas (hoy, mañana, +5 días, septiembre, noviembre y diciembre de 2025): el desplegable de estados ya no existe; Hoy, un día del panel, las flechas de día, la cuadrícula de meses, el cambio de año, «Todo el mes», un mes con flechas de mes, el rango, Todo, Esc y clic fuera dan los resultados esperados; Rendimiento acepta un día y un mes. Sin errores de consola. No se pudo revisar la vista móvil.
