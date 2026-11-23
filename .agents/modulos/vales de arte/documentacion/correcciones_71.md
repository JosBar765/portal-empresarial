# Correcciones 71: selector de asesores acotado a la tienda elegida

Fecha: 2026-11-20. Rama `feat/vales-reportes-2`. Pedido del dueño sobre el reporte de actividad de asesores. Referencia: `reporte_actividad_asesores.md`.

## Cambios

1. **Sin ícono.** El selector de asesores ya no lleva el ícono de personas. `crearSelectorMultiple` (`components/selectorMultiple.js`) trata `icono` como opcional; los demás selectores (p. ej. el de diseñadores) conservan el suyo.
2. **Solo los asesores de la tienda elegida.** Antes el selector mostraba a todos los asesores sin importar la tienda. Ahora, al elegir una tienda, un país o un grupo, ofrece solo a quienes pertenecen a esas tiendas; sin tienda, todos.
   - El servidor manda la tienda de cada asesor en las opciones (`tiendaId`, de `asesores.tienda_id`; `valeReporteEquiposService._opciones`), y el frontend filtra con `views/reportes2/asesoresDeTienda.js` (puro) y `resolverTiendaIds`. No se agrega ninguna consulta.
   - Al cambiar la tienda, la lista se vuelve a pintar y quien ya no está en ella sale de la selección; el cambio marca el resultado como desactualizado como cualquier otro filtro.
   - «Seleccionar todos» con una tienda elegida equivale a «todos los de la tienda» (el filtro de tienda ya acota la consulta).
   - El supervisor como «(yo)» no trae tienda y se ofrece siempre.

3. **«Generar» y el PDF son idempotentes (opción B).** Mientras una consulta está en curso, pedir lo mismo (mismo reporte, filtros y ventana) devuelve esa misma consulta y no lanza otra; antes, «Reintentar», «Ver el mes completo» y el salto de tiendas a asesores llamaban a `generar()` sin comprobarlo y dos clics rápidos mandaban dos consultas pesadas. Lo mismo para el PDF (mismo reporte y resultado generado). Una vez terminada la operación, volver a pedirla sí consulta de nuevo, así que se puede refrescar. Pieza pura: `utils/unaALaVez.js` (`crearUnaALaVez`).
   - **Cuándo NO se fusiona:** con claves distintas (otro reporte o filtros) ni con una generación vencida (se cambió de reporte: su resultado ya no se pinta; fusionarse con ella dejaría la pantalla sin resultado). La clave incluye el reporte porque dos reportes pueden tener la misma consulta de filtros.
   - El botón del PDF queda deshabilitado mientras se prepara (incluido el modal «¿incluir el desglose?»).
   - Solo es del lado del navegador: dos pestañas o dispositivos siguen consultando por separado. Se descartó reutilizar el resultado por un tiempo (opción C) para no servir datos con minutos de antigüedad.
   - Las opciones de filtros no se fusionan a propósito: cambiar de reporte invalida la petición anterior de opciones y fusionarse con ella dejaría los filtros sin montar.

## Notas

- Idempotencia: probada con un script (doble clic, ráfaga de 5 pulsaciones, claves distintas, generación vencida, fallo que no bloquea la clave, tarea que sube la época al empezar); no probada en el navegador.
- Probado con un script de datos de prueba: sin tienda, una tienda (con id como texto o número), país, grupo, otra tienda, lista vacía y poda de la selección. No probado en el navegador.
