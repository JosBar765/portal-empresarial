# Correcciones 73 — Filtro de tienda con selección múltiple en Buzón y Trabajo realizado

Rama: `feat/vales-filtro-tiendas-multiple`.

## Qué cambia

- **Selección múltiple de tiendas:** el filtro de tienda del Buzón y de Trabajo realizado (supervisor, gerente y administrador) tiene una casilla por tienda. Los supervisores que rotan de país pueden ver los vales de varias tiendas a la vez.
- **País y grupo con casilla propia:** marca o desmarca todas sus tiendas; queda en estado parcial si solo hay algunas marcadas. El menú sigue abierto mientras se marca; «Todas las tiendas» limpia la selección.
- **Texto del botón:** el nombre de la tienda si hay una, el país si hay exactamente un país completo, «N tiendas» si hay varias.
- **Componente compartido, modo opcional:** `crearFiltroTiendas` recibe `multiple` (desactivado por defecto). Administración (Usuarios y Tiendas) y Reportes siguen con selección única, sin cambios.
- **Valor y consulta:** la selección es una lista de ids («3,7,9») y viaja como `tiendaIds`; un solo id sigue yendo como `tiendaId`. Los valores recordados antes (un id, `pais:X`, `grupo:Y`) se convierten a lista al cargar y se descartan las tiendas que el usuario ya no cubre.
- **Backend sin cambios:** `idsDeFiltro` ya aceptaba listas de ids (tope de 500).
- **Cómo activarlo en otro filtro:** `crearFiltroTiendas({ tiendas, valorActual, multiple: true, onSeleccionar })`. Con `multiple`, `onSeleccionar` recibe la lista de ids («3,7,9»; vacío = ninguna) y `public/js/filtroCascada.js` (`resolverTiendaIds`, `paramsDeTienda`, `valorVigente`) la convierte en `tiendaIds`. Sin `multiple` el menú se comporta como antes. Las casillas se estilan en `public/css/menu-cascada.css` (`.menu-cascada-casilla`, con `data-estado` marcado, vacío o parcial). Los formularios que exigen un solo valor no deben usarlo.
- **Prueba:** `scripts/vales/probarFiltroTiendasMultiple.js` (sin BD ni DOM, 13 casos sobre `filtroCascada.js`; sale con código 1 si algo no coincide). El comportamiento visual está pendiente de probar en el navegador.
