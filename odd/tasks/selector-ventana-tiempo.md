# Selector de ventana de tiempo único (Buzón y Trabajo realizado)

Rama: `fix/selector-ventana-tiempo`, sale de `origin/dev` (`ab9cef0`, 2026-10-19). Sin upstream a propósito: NO se pushea hasta que lo pida el usuario. Solo frontend: el backend no cambia.

## Objetivo
Que «Buzón» y «Trabajo realizado» usen el mismo selector de período que la pestaña «Reportes» (`crearBarraPeriodo`), conservando las funciones del calendario actual del Buzón.

## Decisiones (usuario)
- Una sola barra compartida por Buzón y Trabajo (`state.ventana`); la de Reportes sigue independiente (`state.reporte.ventana`) y debe quedar exactamente igual.
- Tipos: Hoy, Día, Semana (lunes a domingo), Mes y Desde–Hasta. No existe «Todo»; se abre en «Hoy».
- Rango: se exigen las dos fechas (como Reportes). Antes el Buzón permitía una sola y vaciarlas volvía a «Todo».
- El Buzón sigue incluyendo los vales anteriores aún abiertos (arrastrados); Trabajo realizado, ventana estricta.
- Se conservan, en el calendario del modo «Día»: el mapa de calor del cupo de talleres (supervisor, `vales.ver_cupo`), el conteo de vales por día (diseñador y encargado) y las acciones «Ver vales de este día» y «Ver reporte de este día».
- Ids únicas: la barra de Reportes lleva ids fijas (`#rp-navegador`, `#rp-etiqueta`, `#rp-rango`, `rep-desde`, `rep-hasta`); se parametrizan con un prefijo por instancia para poder usar dos barras en la misma página, con el valor por defecto igual al actual.

## Diseño
- Sin tocar el backend (`_resolverVentana` acepta `todo`, `mes` y `rango`): el frontend manda Hoy y Día como un rango del mismo día, Semana como un rango de lunes a domingo, Mes como `mes` + `fecha` y Rango con `desde` y `hasta`.
- `state.ventana` pasa a la misma forma que `state.reporte.ventana`: `{ tipo, fecha, desde, hasta }`, por defecto `tipo: 'hoy'`.
- La barra de `.vales-toolbar` se reemplaza solo en su bloque de ventana; `#filtro-tienda` y `#btn-nuevo-vale` se quedan.
- `verReporteDelDia` sigue escribiendo `state.reporte.ventana` y abre Reportes.
- Código muerto (cuando nadie más lo use): `selectorPeriodo.js`, el marcado y los listeners del navegador de mes, y las reglas CSS de `.mes-nav*`, `.ventana-*` y `.chip`.

## Reglas
`.agents/reglas/reglas_implementacion.md`: no cambiar endpoints, payloads ni ids/clases/`data-*` que se usen fuera de esta zona; sin abstracciones nuevas; comentarios de una línea; archivos CRLF se editan conservando CRLF. Commits Conventional Commits en español, sin Co-Authored-By.

## Tareas
- [x] T1 (2148c08) Parametrizar con un prefijo las ids de `crearBarraPeriodo` y sumarle los ganchos del calendario del modo «Día» (info por día, «Ver vales de este día», «Ver reporte de este día») portados de `selectorPeriodo.js`, sin cambiar la barra de Reportes.
- [x] T2 (ea3f3bf) Estado y consulta: `state.ventana` con la forma de Reportes y `aplicarVentanaAQuery` para hoy, día, semana, mes y rango (ambas fechas).
- [x] T3 (ea3f3bf) Reemplazar el bloque de ventana de la barra de Buzón y Trabajo (`index.html`, `toolbar.js`) por la barra compartida, conservando el filtro de tienda y el botón de nuevo vale.
- [x] T4 (a34d2da) Retirar el código y el CSS que quede sin uso y revisar el diseño móvil.
- [x] T5 Verificación visual en el navegador (2026-10-19, `127.0.0.1:3000`, BD de pruebas): Supervisor (barra Hoy · Día · Semana · Mes · Desde–Hasta; modo Día con mapa de calor del cupo, detalle por taller y «Ver vales de este día», que cambia la ventana al día elegido; Semana «Semana 42 · 12–18 oct»; Mes; rango con los últimos 7 días y las dos fechas), Trabajo realizado comparte la ventana, Gerente (Reportes se ve y funciona igual; su ventana es independiente: «Semana» en Reportes no cambia el «Hoy» de Trabajo), Encargado de Diseño (conteo de vales por día). Consola sin errores. No se probó: diseño móvil, Diseñador, Asesor ni «Ver reporte de este día» (ningún rol cumple a la vez `vales.ver_reportes` y la info por día, igual que antes).
- [x] T6 (ver commit de docs) Documentación en `.agents/modulos/vales de arte/documentacion/selector_ventana_tiempo.md`.

## Rutas
Un writer delegado para T1-T4 y T6; T5 verificación visual aparte.

## Progreso
T1-T4 y T6 hechos (sin navegador ni servidor: solo `node --check` y lectura). `selectorPeriodo.js` se eliminó; `etiquetaDia`/`etiquetaMes` pasaron a `barraPeriodoReportes.js`. Pendiente T5, verificación visual por rol y en Reportes.
