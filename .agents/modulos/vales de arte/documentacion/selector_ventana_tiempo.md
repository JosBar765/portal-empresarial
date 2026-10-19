# Selector de ventana de tiempo único

Buzón y Trabajo realizado usan la misma barra de período que la pestaña Reportes (`crearBarraPeriodo`). Solo frontend: el backend no cambia.

## Qué cambió para el usuario
- Tipos: Hoy · Día · Semana (lunes a domingo) · Mes · Desde – Hasta. Desaparece «Todo».
- Se abre en «Hoy» (antes en «Todo»).
- Desde – Hasta exige las dos fechas; al elegirlo se precarga los últimos 7 días.
- Semana es nueva en Buzón y Trabajo realizado.
- Se conservan en el calendario del modo «Día»: el mapa de calor del cupo de talleres (Supervisor, `vales.ver_cupo`), el conteo de vales por día (Diseñador y Encargado/Asistente) y las acciones «Ver vales de este día» y «Ver reporte de este día» (esta, con `vales.ver_reportes`).
- Se pierde el pie «Todo <mes>»: el mes completo se elige con el tipo «Mes».
- Buzón y Trabajo comparten la barra (`state.ventana`); Reportes mantiene la suya (`state.reporte.ventana`), sin cambios.
- El Buzón sigue mostrando los vales anteriores aún abiertos (arrastrados); Trabajo realizado, ventana estricta.

## Cómo viaja al servidor
`js/utils/ventana.js` (`aplicarVentanaAQuery`) manda solo lo que acepta `_resolverVentana` (`mes` y `rango`):

| Tipo | Parámetros |
|---|---|
| Hoy / Día | `ventana=rango&desde=F&hasta=F` (F = hoy o el día elegido) |
| Semana | `ventana=rango&desde=<lunes>&hasta=<domingo>` |
| Mes | `ventana=mes&fecha=<primer día del mes>` |
| Desde – Hasta | `ventana=rango&desde&hasta` |

## Archivos
- `js/components/barraPeriodoReportes.js`: `crearBarraPeriodo` admite `prefijo` (ids y nombres de campo únicos; sin él, los de Reportes: `rp-navegador`, `rp-etiqueta`, `rp-rango`, `rep-desde`, `rep-hasta`) y los ganchos opcionales `cargarInfoMes`, `alVerVales` y `alVerReporte` (solo calendario del modo Día). Aloja ahora `etiquetaDia` y `etiquetaMes`.
- `js/layout/toolbar.js`: crea la barra con prefijo `vt` en `#ventana-barra`; el permiso de la información por día se decide aquí.
- `js/state.js`, `js/utils/ventana.js`, `index.html`, `css/reportes.css`.
- Retirados: `js/components/selectorPeriodo.js` y las reglas `.chip`, `.mes-nav*`, `.ventana-*` de `css/styles.css`.
- Intactos: `#filtro-tienda`, `#btn-nuevo-vale`, `verReporteDelDia`.
