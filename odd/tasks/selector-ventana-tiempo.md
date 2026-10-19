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
- [ ] T1 Parametrizar con un prefijo las ids de `crearBarraPeriodo` y sumarle los ganchos del calendario del modo «Día» (info por día, «Ver vales de este día», «Ver reporte de este día») portados de `selectorPeriodo.js`, sin cambiar la barra de Reportes.
- [ ] T2 Estado y consulta: `state.ventana` con la forma de Reportes y `aplicarVentanaAQuery` para hoy, día, semana, mes y rango (ambas fechas).
- [ ] T3 Reemplazar el bloque de ventana de la barra de Buzón y Trabajo (`index.html`, `toolbar.js`) por la barra compartida, conservando el filtro de tienda y el botón de nuevo vale.
- [ ] T4 Retirar el código y el CSS que quede sin uso y revisar el diseño móvil.
- [ ] T5 Verificación visual en el navegador por rol (supervisor, diseñador, encargado, asesor) y en Reportes (debe verse igual).
- [ ] T6 Documentación en `.agents/modulos/vales de arte/documentacion/selector_ventana_tiempo.md`.

## Rutas
Un writer delegado para T1-T4 y T6; T5 verificación visual aparte.

## Progreso
Plan creado, sin código todavía.
