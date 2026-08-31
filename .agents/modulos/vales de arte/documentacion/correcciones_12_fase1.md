# Trazabilidad de cambios — `analisis_correcciones_12.md`, Fase 1

Este documento registra qué se implementó de `analisis_correcciones_12.md`
(carpeta `.agents/modulos/vales de arte/correcciones/`) en su **primera fase**:
los 8 puntos acotados — 1, 2, 3, 4, 5, 6, 7, 8 y 9. Por decisión del usuario, los
puntos **6 (en su parte de máquina de estados), 10, 11, 12 y 13** — el rediseño
de la jerarquía tienda/departamento/subdivisión, la eliminación del rol
Encargado General, la normalización interactiva de la base de datos y el nuevo
formato de correlativo — quedan para una fase 2 aparte, ya que son cambios
arquitectónicos grandes e interdependientes entre sí. La sesión interactiva de
normalización del punto 12 se hará al final de la fase 2, sobre el esquema ya
completo, para no repetir el análisis dos veces.

Dos de los ocho puntos de esta fase eran bugs reales confirmados leyendo el
código, no supuestos — ver sus secciones (2 y 4).

---

## 1 + 7. El atraso empieza en 1 día completo; "Hoy" en amarillo para el día 0

**Archivos:** `src/modules/vales/services/valeService.js` (`calcularAtraso`,
`enriquecer`), `src/modules/vales/repositories/valeRepository.js`
(`listarAtrasadosSinNotificar`), `src/config/database.js` (handler
`vale:list_atrasados_sin_notificar`), `public/modules/vales/js/app.js`
(`renderTabla`), `public/modules/vales/css/styles.css`

Causa raíz común de ambos puntos: `fecha_entrega` se normaliza a fin del día, y
`calcularAtraso` marcaba `atrasado = diffMs > 0` — así que durante todo el día
siguiente a la fecha de entrega el vale figuraba como atrasado con
`diasAtraso === 0`. De ahí salía tanto el "atraso 0 días" que el punto 7 llama
mentira como la alerta roja prematura del vigilante del punto 1.

`calcularAtraso` sigue devolviendo `atrasado` con el mismo significado de
siempre ("pasó la fecha de entrega", usado por varios contadores/filtros
existentes) y suma un tercer campo:

```js
const dias = atrasado ? Math.floor(diffMs / (1000 * 60 * 60 * 24)) : 0;
return { atrasado, diasAtraso: dias, venceHoy: atrasado && dias === 0 };
```

El vigilante de atraso (`atrasoWatcher.js`, sin cambios en sí — sigue sellando
`atraso_notificado_en`) ahora depende de una condición con umbral real de 1 día
tanto en la consulta SQL real como en su handler del mock:

```sql
... AND fecha_entrega < NOW() - INTERVAL 1 DAY
```

En la tabla del frontend, la celda de "Atraso" pasa de dos estados a tres:
`venceHoy` → badge amarillo `Hoy` (token `--color-warning`, mismo patrón que
`.badge-atraso` con los tokens `danger`); `diasAtraso >= 1` → el badge rojo `Nd`
de siempre; si no → `Al día`.

## 2. Una sola notificación por acción

**Archivos:** `src/modules/vales/events.js`,
`src/modules/vales/services/valeService.js` (call-sites de `notificar`),
`public/modules/vales/js/app.js` (handler de `vale_evento` y textos de toasts)

**Bug confirmado.** Cada acción producía dos mensajes para quien la ejecutaba:
el toast verde optimista local (`window.toast.success(...)` en el handler del
modal, al recibir la respuesta del `fetch`) y el toast azul que llega por
WebSocket — porque las salas objetivo incluyen a propósito la sala del propio
actor (auto-broadcast introducido en `analisis_correcciones_10.md #10`, para que
el buzón se refresque solo). Los cuatro casos que reportaba el usuario eran
instancias del mismo patrón.

En vez de parchar caso por caso, `notificar()` ahora acepta un `actorId` y lo
incluye en el payload del evento; todos los call-sites de `valeService.js` que
pasan `actor: usuario.nombre` pasan también `actorId: usuario.id` (el vigilante
de atraso no tiene actor humano, así que viaja `null`). En el cliente, el
handler de `vale_evento` compara `data.actorId` contra `state.user.id`: si
coinciden, se omiten el toast y el beep — pero el refetch del buzón (que no es
la parte duplicada) sigue corriendo igual:

```js
const esPropiaAccion = data.actorId != null && data.actorId === state.user.id;
if (!esPropiaAccion) {
  const esAlerta = data.nivel === 'alerta';
  window.toast[esAlerta ? 'error' : 'info'](esAlerta ? 'Atención' : 'Vale de arte', data.mensaje);
  if (data.beep !== false) reproducirBeep();
}
cargarBuzon();
```

Esto resuelve de raíz los cuatro duplicados reportados y cualquier otro caso
futuro con el mismo patrón. Los toasts locales que sobreviven se reescribieron
a la letra de lo pedido: creación → *"se creó correctamente, en espera de
autorización"*; autorizar creación → *"se creó correctamente, enviado al
taller(es) seleccionado(s)"*; asignar → *"Se asignó correctamente al técnico
{nombre}"*; entregar propuesta se dejó igual (ya decía "Propuesta entregada").

**Verificado en vivo** (`npm run dev`, Claude in Chrome): como Supervisor de
Ventas, autorizar la creación de `GUA-3-0012` mostró **un solo** toast
("Creación autorizada — GUA-3-0012 se creó correctamente, enviado al taller
seleccionado."), sin un segundo toast tras esperar 2s adicionales.

## 3. Descripciones de roles independientes del módulo

**Archivos:** `database/schema.sql` (seed de `roles`), `src/config/database.js`
(`mockDatabase.roles`)

Cambio de datos: las descripciones narraban el flujo de Vales de Arte
("Asigna vales de arte a técnicos y revisa sus propuestas"), lo que envejece
mal al sumar más módulos al portal. Se reescribieron en términos de la
**función** de la persona (ej. Asesor de Ventas → "Asesor de ventas, encargado
de atender clientes y gestionar ventas"; Técnico de Diseño → "Técnico de
diseño, encargado de ejecutar el trabajo de diseño y producción asignado").
Ambos seeds (schema real y mock) quedaron idénticos entre sí.

## 4. El encargado veía la propuesta de otro técnico (bug)

**Archivo:** `public/modules/vales/js/app.js` (`abrirModalRevisar`)

**Bug confirmado y localizado.** El modal de "Revisar propuesta" tomaba la
última propuesta de **todo** el vale, sin filtrar por técnico:

```js
const ultima = (detalle.propuestas || [])[detalle.propuestas.length - 1];
```

En un vale multi-taller, `vale_propuestas` acumula una fila por técnico; el
último en subir "ganaba" para todos los encargados que abrieran el modal,
exactamente el bug reportado. `abrirModalAprobarGeneral` (la vista del
Encargado General) ya filtraba correctamente por `tecnico_id`, y el backend
tampoco tenía el bug (`valeService.revisarPropuesta` usa
`obtenerUltimaPorValeYTecnico`) — el problema era puntual de este modal.

Fix, mismo criterio que ya usaba `abrirModalAprobarGeneral`:

```js
const propias = (detalle.propuestas || []).filter(p => p.tecnico_id === vale.tecnico_id);
const ultima = propias[propias.length - 1];
```

`vale.tecnico_id` ya venía adjunto en cada fila del buzón desde
`_buzonEncargado`, así que no hizo falta ninguna consulta nueva.

## 5. El técnico solo ve sus cuatro estados, y ve la propuesta que entregó

**Archivos:** `public/modules/vales/js/app.js` (`poblarFiltroEstado`,
`construirAcciones`), `src/modules/vales/services/valeService.js`
(`obtenerTrabajoTecnico`)

El buzón del técnico ya estaba bien acotado desde antes
(`obtenerBuzonTecnico` solo trae `ASIGNADO`/`EN_PROCESO`/`EN_REVISION`, y los
`APROBADO` ya vivían solo en Trabajo Realizado). Lo que sí ofrecía estados de
más era el desplegable "Todos los estados": usaba `CLAVES_ESTADOS_TALLER`
completo, que incluye `PENDIENTE_ASIGNACION` — un estado que el técnico nunca
puede ver, porque un vale sin asignar no está en su buzón. Se agregó
`CLAVES_ESTADOS_TECNICO` (sin ese estado) y `poblarFiltroEstado` lo usa
específicamente para el rol 7.

**Ver propuesta en Trabajo Realizado**: `obtenerTrabajoTecnico` ahora adjunta
`propuesta_taller_url` con la propuesta que el propio técnico entregó
(`propuestaRepository.obtenerUltimaPorValeYTecnico`, descartando cancelaciones)
— calcado de `_trabajoEncargadoTaller` (`correcciones_11.md #2`). En
`construirAcciones`, la rama existente que muestra esa acción pasó de
`[5, 6]` a `[5, 6, 7]`, sin necesidad de una rama nueva.

**Verificado en vivo**: como Técnico Diseño A, el desplegable de estados trae
exactamente `Asignado / En Proceso / En Revisión / Aprobado` (sin "Pendiente
Asignación"), y "Trabajo Realizado" carga sin error.

## 6. El Encargado General: buzón/filtro acotados y sus fusiones reales

**Archivos:** `src/modules/vales/services/valeService.js`
(`_trabajoEncargadoGeneral`), `public/modules/vales/js/app.js`
(`poblarFiltroEstado`, `construirAcciones`)

> Nota: esta sección cubre solo la parte de **visibilidad** del punto 6. La
> desaparición del rol Encargado General como tal es del punto 11, en la fase 2.

El buzón (`_buzonEncargadoGeneral`) ya traía exactamente lo pedido
(`APROBADO_DEPARTAMENTO` + `MODIFICADO` sin filas de taller); lo que sobraba
era, otra vez, el desplegable de estados completo (`CLAVES_ESTADOS_GENERAL`,
7 estados, cuando el Encargado General solo puede llegar a ver 2 en el buzón y
3 en Trabajo Realizado, sin superposición). Se agregó
`CLAVES_ESTADOS_ENCARGADO_GENERAL = { buzon: [...], trabajo: [...] }` y
`poblarFiltroEstado` lo resuelve por rol **y** vista.

**"Sus fusiones" reales**: `_trabajoEncargadoGeneral` filtraba por
`_filasTaller.length > 1`, un proxy de "multi-taller" que dejaba fuera los
vales MOD- de un solo taller — que **siempre** pasan por su fusión
(`_recalcularEstadoVale` manda cualquier vale de modificación a
`APROBADO_DEPARTAMENTO` sin importar cuántos talleres tenga). El criterio pasó
al hecho real:

```js
const visibles = todos.filter(v =>
  v.propuesta_general_url &&
  (v._filasTaller.length > 1 || esValeDeModificacion(v)) &&
  [ESTADOS.PENDIENTE_CONFIRMACION, ESTADOS.RECIBIDO, ESTADOS.SOLICITANDO_MODIFICACION].includes(v.estado)
);
```

`propuesta_general_url` es la firma de que él subió el documento de fusión
(`aprobarGeneral` lo escribe); la segunda condición excluye el camino feliz de
un solo taller sin modificación, donde ese mismo campo lo llena
`_recalcularEstadoVale` con la propuesta del técnico, sin que el Encargado
General haya intervenido nunca.

**Acción "Ver propuesta"**: se agregó a la condición existente de
`construirAcciones` para los roles 8/9 cuando la fila trae
`propuesta_general_url`.

**Verificado con smoke test** (ver sección de Verificación general): un vale
MOD- de un solo taller (`MOD-GUA-3-0008` de la semilla) llevado hasta
`aprobarGeneral` aparece en su Trabajo Realizado con `propuesta_general_url`
poblado; un vale normal de un solo taller que nunca pasó por él, no.

## 8 + 9. Enlace "Ver vale de arte" en los modales del Encargado General

**Archivo:** `public/modules/vales/js/app.js` (`abrirModalReenviarModificacion`,
`abrirModalAprobarGeneral`)

Ambos modales abren ahora con el mismo bloque de enlace que ya usa
`abrirModalAprobarModificacion` del supervisor:

```html
<a href="/api/vales/${vale.id}/pdf" target="_blank" class="btn btn--ghost" ...>Ver vale de arte (PDF)</a>
```

En "Reenviar" apunta al propio `vale.id` del modal, que YA es el nuevo vale
MOD-, y **no** lleva "Ver propuesta" (punto 8): para un vale MOD- la propuesta
del original ya va adjunta dentro del propio PDF (`aprobarModificacion` la
registra en `vale_documentos` y `_regenerarPdf` la fusiona), así que un enlace
aparte sería redundante. En "Aprobar y fusionar" se sumó al listado de
propuestas por taller que ese modal ya arma (punto 9).

---

## Verificación general

- `node --check` sobre todos los `.js` tocados: `valeService.js`,
  `valeRepository.js`, `events.js`, `database.js`, `public/modules/vales/js/app.js`.
- **Smoke test backend** dedicado (`smoke-correcciones12-fase1.js`, fuera del
  repo, mismo patrón que `smoke-correcciones11.js`, contra el mock en memoria):
  - vale de la semilla con 6 días de atraso real → `atrasado:true`,
    `diasAtraso:6`, `venceHoy:false`; `listarAtrasadosSinNotificar()` lo incluye
    (el umbral de 1 día no lo excluye) — puntos 1/7. El caso "0 días" se validó
    con la fórmula aislada (`crearVale` no permite fechas pasadas, así que no se
    puede fabricar ese estado end-to-end sin tocar el reloj o la BD).
  - vale de dos talleres con dos técnicos entregando propuesta → cada
    propuesta se filtra correctamente por su propio `tecnico_id`, con URLs
    distintas entre sí — punto 4.
  - `obtenerTrabajoTecnico` del técnico A devuelve exactamente su propia
    `propuesta_taller_url` — punto 5.
  - el MOD- de un solo taller de la semilla (`MOD-GUA-3-0008`), llevado hasta
    `aprobarGeneral`, aparece en el Trabajo Realizado del Encargado General con
    su documento de fusión; un vale normal de un solo taller (camino feliz, sin
    pasar por él) no aparece — punto 6.
- **`npm run dev` + navegador** (Claude in Chrome): verificado en vivo el toast
  único al autorizar una creación (punto 2, con espera de 2s adicionales sin
  segundo toast), el badge de atraso con datos reales de la semilla (puntos 1/7),
  y el desplegable de estados acotado del Técnico de Diseño (punto 5).
- Sin commit ni push — pendiente de solicitud explícita del usuario.
