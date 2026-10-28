# Correcciones 57 — Reportes: asesores, diseñadores y talleres siguen la tienda elegida

Rama: `fix/reportes-filtros-por-tienda` (desde `dev`). Sin cambio visual: no lleva mockup.

## Problema

En Reportes (Administrador, Gerente y Supervisor) el filtro de tienda no afectaba a los desplegables de asesores, diseñadores ni talleres: seguían listando a todo el mundo.

## Qué cambia

- **Asesores:** con una tienda elegida solo salen los asesores de esa tienda (`asesores.tienda_id`).
- **Talleres:** solo los ligados a la tienda (`taller_tiendas`, más `talleres.tienda_id` de los Diseño Local).
- **Diseñadores:** los de los talleres de esa tienda; si además hay un taller elegido, solo los de ese taller (intersección). No depende de que ya haya vales.
- **Al cambiar de tienda** se quitan de la selección el taller, los asesores y los diseñadores que ya no pertenecen. Sin tienda elegida todo queda como antes.
- **Supervisor:** su desplegable de asesores también se acota por la tienda que elija entre las suyas.
- **Corrección de paso:** los ids marcados en los selectores múltiples son texto y la poda de la selección al cambiar de taller los comparaba como números, así que nunca quitaba nada; ahora se comparan como número (`Number(id)`).

## Casos borde

- Asesor sin tienda: solo aparece sin tienda elegida.
- Tienda sin talleres ligados: talleres y diseñadores quedan vacíos y su desplegable se oculta.
- Una persona de talleres de varias tiendas aparece en cada una.

## Archivos

- `src/modules/vales/repositories/reporteRepository.js`: `listarAsesores` devuelve `tienda_id`; nueva `listarTiendasPorTaller`.
- `src/modules/vales/services/valeReporteService.js`: `_opcionesDeFiltro` entrega `asesores[].tiendaId` y `talleres[].tiendaIds`; el supervisor lleva `tiendaId` en sus `personas`.
- `public/modules/vales/js/views/reportes.js`: `renderFiltros` acota las listas y el cambio de tienda poda la selección.

Sin cambios en el cálculo de los reportes, el PDF, la base de datos ni los permisos (solo crece el payload de `filtros`).

## Verificación

Local, como Gerente: sin tienda, 48 asesores y los 11 talleres; tienda 1 → 6 asesores, talleres Diseño, UV/3D y Protextil y 17 diseñadores; tienda de un Diseño Local → solo su taller y su encargado; tienda 1 + Protextil → 3 diseñadores; con un asesor y un diseñador elegidos, cambiar de tienda los devuelve a «Todos». Como Supervisor (14 tiendas): de 15 asesores a 1 al elegir una tienda. `npm run ci:sintaxis` correcto.
