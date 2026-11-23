# Correcciones 75 — Asesores con supervisión especial en el selector de tienda

Rama: `feat/vales-filtro-tiendas-multiple` (misma del selector múltiple, correcciones 73).

## Qué cambia

- **Asesores en el selector:** el Supervisor ve, en el primer nivel del selector de tienda del Buzón y de Trabajo realizado, junto a los países y bajo «Supervisión especial», a sus asesores con supervisión especial (p. ej. Julio Barahona). Cada uno tiene su casilla y se agrega o quita de la vista cuando se quiera.
- **Regla nueva:** sin selección se ve todo. Con selección se ven los vales de las tiendas marcadas más los de los asesores marcados; un asesor especial sin marcar queda oculto.
- **Regla retirada:** antes los vales de los asesores con supervisión especial nunca se ocultaban por el filtro de tienda, porque solo se podía filtrar por una tienda. Con el selector múltiple ya no hace falta forzarlo.
- **Alcance:** solo el rol Supervisor y solo sus propios asesores asignados. Administrador, Gerente, Reportes y los demás selectores no cambian.
- **Servidor:** el catálogo agrega `asesoresEspeciales` (`[{ id, nombre }]`, solo para el Supervisor). El Buzón acepta `asesorIds` (mismo tope y validación que `tiendaIds`) y lo restringe a los asesores especiales de ese supervisor; el resto se ignora. Se quitó el bypass de `valeBuzonService`.
- **Cliente:** el valor del selector lleva los asesores como `a<id>` («3,7,a12»); los valores guardados antes siguen funcionando y se descartan los ids que ya no corresponden. El botón muestra el nombre si hay un solo elemento, «N tiendas» si son solo tiendas y «N seleccionados» si hay algún asesor.
- **Prueba:** `scripts/vales/probarFiltroTiendasMultiple.js` pasa a 26 casos (lista mixta, asesor suelto, asesor vencido, parámetros y valores anteriores). El Buzón real y el selector están pendientes de probar en el navegador.

## Para tener en cuenta

- Un supervisor con un filtro activo y un especial sin marcar no ve los vales de ese asesor que esperan su autorización; debe marcarlo o limpiar el filtro.
- Si un supervisor manda solo `asesorIds` que no son suyos, no se filtra nada (ve todo lo que ya veía).
