# Propuestas de otros talleres: visor con pestañas

La acción «Propuestas de otros talleres» (icono de documentos, para encargados, asistentes y diseñadores) y el signo rojo «?» del Buzón ya no abren un modal intermedio con una lista de talleres. Abren directamente el visor de documentos que usan el asesor y el supervisor, con pestañas.

## Qué muestra
- Pestaña **«Vale de arte»** (el PDF del vale).
- Una pestaña **«Propuesta <Taller>»** por cada taller hermano con propuesta **aprobada** (la última, con su nota y enlaces si los tiene). Solo cuentan los talleres que comparten propuestas (`talleres.comparte_propuestas`).
- Se abre en la primera propuesta que el usuario aún no había visto; si ya las vio todas, en la primera.
- Si ningún otro taller tiene una propuesta aprobada, no se abre el visor: aparece un aviso («Sin propuestas aprobadas»).

## «Nueva» y el signo «?»
La propuesta se da por vista cuando su pestaña se muestra (antes, al pulsar «Ver propuesta» en el modal). Al marcarse como vista, el Buzón se actualiza y el signo «?» desaparece. Si falla el registro, la propuesta igual se ve y se reintenta la próxima vez que se muestre la pestaña.

## Qué se quitó
- El modal con la lista de talleres, con su chip «Aprobada» / «En trabajo», la marca «Nueva» y la fecha de cada propuesta. Los talleres que aún están trabajando ya no aparecen.
- Las reglas CSS de esa lista (`.pn-lista`, `.pn-item`, `.pn-info`, `.pn-fecha`, `.pn-nueva`, `.pn-punto`, `.pn-vacio`).
- Se conservan el signo «?» y su aviso emergente.

## Archivos
- `public/modules/vales/js/actions/propuestasOtros.js`: `abrirVisorPropuestasOtros` (antes `abrirModalPropuestasOtros`).
- `public/modules/vales/js/views/buzon.js`: la acción de la fila y el clic del signo «?» llaman a esa función.
- `public/modules/vales/css/propuestasOtros.css`.

El visor sigue usando `detalle.propuestasOtrosTalleres` de `GET /api/vales/:id`.

## El API aplica la misma regla
`GET /api/vales/:id/propuesta` (`tipo=taller`, `ultima` y el respaldo de `general`) también la aplica a encargados, asistentes y diseñadores: ven las propuestas de su propio taller en cualquier estado y las de otro taller solo si es hermano (ambos comparten, filas activas) y su fila está `APROBADO`; si no, responde 403 («No tienes acceso a la propuesta de ese taller.»). Con `tipo=ultima` no falla: devuelve la última de las permitidas, o `origen: 'ninguna'`. Quien tiene `vales.aprobar_general` (fusión), el asesor, el supervisor, el Administrador y el Gerente no cambian.
