# Trazabilidad de cambios — `analisis_correcciones_8.md`

Este documento registra, punto por punto, qué se implementó a partir de
`analisis_correcciones_8.md` (carpeta `.agents/modulos/vales de arte/correcciones/`)
y en qué archivos. Sirve como bitácora, no como especificación (la
especificación funcional sigue siendo `analisis_modulo.md` + los
`analisis_correcciones_N.md`).

El punto 8 del archivo pide explícitamente **no implementar nada todavía**,
solo documentar soluciones posibles — ver `solucion_paginacion.md` en esta
misma carpeta.

---

## 1. PDF — "FIRMA Y AUTORIZACIÓN" pegado al borde inferior de su caja

**Archivo:** `src/modules/vales/services/valePdfService.js` → `_dibujarFilaCotizacionYFirma`

La etiqueta vivía centrada verticalmente dentro de la caja de firma (misma
altura que la caja de COTIZACIÓN, `alto = 17`), lo que no dejaba espacio
visualmente "vacío" para firmar a mano. Se ancló cerca del borde inferior en
vez de centrarla:

```js
const paddingInferior = 3;
const inicioY = y + paddingInferior + (lineasFirma.length - 1) * altoLinea;
```

Ni `alto` (la caja sigue midiendo lo mismo) ni el `ctx.y` de salida al final
de la función se tocaron — el espacio de BOCETO Y DESCRIPCIÓN no se ve
afectado, tal como pedía el punto. Verificado generando un vale nuevo real y
comparando el PDF resultante contra `Pruebas/MUESTRA PDF.pdf` (la referencia
visual que compartió el usuario): coinciden.

## 2. Modal de "Autorizar modificación" del supervisor con accesos directos

**Archivo:** `public/modules/vales/js/app.js` → `abrirModalAprobarModificacion`

Se agregó el mismo par de hipervínculos que ya usa el modal de decisión del
asesor (`abrirModalDecisionAsesor`) — "Ver vale de arte (PDF)" siempre, y
"Ver propuesta" solo si `vale.propuesta_general_url` existe:

```html
<a href="/api/vales/${vale.id}/pdf" target="_blank" class="btn btn--ghost" ...>Ver vale de arte (PDF)</a>
${vale.propuesta_general_url ? `<a href="/${vale.propuesta_general_url}" ...>Ver propuesta</a>` : ''}
```

Antes el supervisor tenía que cerrar este modal y usar los íconos de acción
de la fila del buzón para revisar el vale antes de decidir si autoriza.
Verificado en el navegador con el rol Supervisor de Ventas: el enlace "Ver
vale de arte (PDF)" aparece en el modal (el vale de prueba usado no tenía
propuesta adjunta todavía, así que el segundo enlace no se renderizó — el
condicional ya estaba probado en el modal del asesor, del que se copió el
patrón).

## 3. Ordenamiento: "más atraso" gana siempre, la urgencia ya no lo tapa

**Archivo:** `src/modules/vales/services/valeService.js` → `ordenarPorGrupos`

Las agrupaciones por estado (jerarquía de negocio) seguían intactas, pero
DENTRO de un grupo de vales atrasados el comparador ordenaba primero por
`urgente` y solo después por `fecha_entrega` — un vale urgente con poco
atraso se colaba delante de uno no urgente con mucho más atraso, violando
"el que más atraso acumule va primero":

```js
const comparador = (a, b) => {
  if (a.atrasado !== b.atrasado) return a.atrasado ? -1 : 1;
  if (a.atrasado) return new Date(a.fecha_entrega) - new Date(b.fecha_entrega);
  if (!!a.urgente !== !!b.urgente) return a.urgente ? -1 : 1;
  return new Date(a.fecha_entrega) - new Date(b.fecha_entrega);
};
```

Entre atrasados ya no se mira `urgente` en absoluto — solo `fecha_entrega`
ascendente (fecha de entrega más antigua = más días de atraso = primero). La
urgencia sigue desempatando, como antes, únicamente entre vales que NO están
atrasados. `ordenarPorGrupos` es la única función de ordenamiento por
jerarquía de todo el módulo (la usan `_buzonAsesor`, `_buzonSupervisor`,
`_buzonEncargado`, `_buzonEncargadoGeneral`, `obtenerBuzonTecnico`, etc.), así
que el arreglo aplica automáticamente a todos los roles sin tocar cada
método.

Verificado con el buzón del Administrador contra los datos de semilla:
`GUA-3-0002` (no urgente, entrega 20/08, más atraso) ahora aparece antes que
`GUA-3-0003` (urgente, entrega 21/08, menos atraso) — antes era al revés.
Confirmado tanto en el smoke test como visualmente en el navegador.

## 4. Contador "Pendiente de confirmación" del asesor

**Verificado, sin cambios de código.** Ya existía desde
`analisis_correcciones_6.md` bajo la clave `valesPorRevisar` (etiqueta "Pend.
confirmación", cuenta `estado_visible === 'PENDIENTE_CONFIRMACION'`) en el
buzón del asesor, y ya funciona como filtro igual que el resto de tarjetas —
se confirmó en el navegador que la tarjeta está presente y es clickeable. No
se encontró ningún hueco que cerrar para este punto.

## 5. Un vale MOD- ya no puede volver a modificarse

**Archivo:** `src/modules/vales/services/valeService.js` → `solicitarModificacion`

Antes solo se bloqueaba la segunda modificación mirando `vale.modificado`
(la bandera que se pone en el vale ORIGINAL). Un vale `MOD-...` que llegaba a
`RECIBIDO` no tenía esa bandera en 1 (es un vale distinto, recién creado), así
que podía encadenar una segunda solicitud de modificación:

```js
if (esValeDeModificacion(vale)) {
  throw new Error('Este vale de arte ya utilizó su única modificación permitida.');
}
```

`esValeDeModificacion` (ya existente, de `analisis_correcciones_6/7.md`) cubre
los tres casos en uno: `vale.modificado` (el original), `vale.vale_original_id`
(el vale es el resultado MOD- de una modificación — lo mismo que decir que su
correlativo lleva el prefijo `MOD-`) y `vale.estado === MODIFICADO`. Con este
único chequeo, ni el original ni el MOD- que lo reemplazó pueden volver a
solicitar una modificación.

## 6. Correlativo generado sin condición de carrera

**Archivos:** `src/modules/vales/services/valeService.js` (constructor,
`_conColaDeCreacion`, `crearVale`), `src/modules/vales/repositories/valeRepository.js`

El correlativo siempre lo calcula el servidor (`contarValesPorAsesor(usuario.id) + 1`,
nunca el cliente), pero el conteo + el insert no eran atómicos: dos creaciones
casi simultáneas del MISMO asesor podían leer el mismo conteo antes de que la
primera terminara de insertar, y generar un correlativo duplicado (que en
MySQL real violaría el `UNIQUE` de `correlativo`, y en el mock simplemente se
duplicaría en silencio).

Se agregó una cola de promesas por asesor (mismo criterio de "un único
proceso Node" que ya justifica `_locksEnVale`, ver el comentario del
constructor), que serializa exactamente el tramo "leer cuántos vales tiene ya
+ calcular correlativo + insertar":

```js
_conColaDeCreacion(asesorId, fn) {
  const key = Number(asesorId);
  const anterior = this._colaCreacionPorAsesor.get(key) || Promise.resolve();
  const actual = anterior.then(fn, fn);
  this._colaCreacionPorAsesor.set(key, actual.catch(() => {}));
  return actual;
}
```

A diferencia de `_conLockDeVale` (que **rechaza** la segunda operación
porque es un conflicto de edición sobre el mismo vale), aquí la segunda
solicitud **espera su turno** — crear dos vales en paralelo para el mismo
asesor es un flujo normal (dos pestañas, doble clic, etc.), no un error.
`crearVale` ahora envuelve el bloque de límite diario + secuencia + `crear()`
dentro de esta cola; el resto (talleres, adjuntos, historial, PDF) sigue
corriendo fuera de la cola porque ya opera sobre un `valeId` específico y no
puede colisionar con otra creación.

Verificado con un smoke test que lanza 5 `crearVale` concurrentes
(`Promise.all`) para el mismo asesor y confirma 5 correlativos únicos.

## 7. El atraso se congela para siempre, no solo mientras el vale sigue RECIBIDO

**Archivos:** `src/modules/vales/services/valeService.js` (`calcularAtraso`,
`confirmarRecibido`, `aprobarModificacion`), `src/modules/vales/repositories/valeRepository.js`
(`congelarAtraso`), `database/schema.sql` (columna `atraso_congelado_en`),
`src/config/database.js` (mock)

Antes, `calcularAtraso` congelaba el atraso usando `actualizado_en` **solo
mientras** `vale.estado === RECIBIDO` (`ESTADOS_TERMINALES`). El problema:
solicitar una modificación sobre un vale ya `RECIBIDO` lo mueve a
`SOLICITANDO_MODIFICACION`, que NO es un estado terminal — el atraso se
"descongelaba" y volvía a calcularse en vivo contra `new Date()`, aunque el
vale ya hubiera sido entregado y confirmado antes de pedir la corrección.

Se agregó una columna nueva, `atraso_congelado_en`, fijada UNA sola vez (con
`WHERE atraso_congelado_en IS NULL`) en los dos puntos exactos donde un vale
queda "entregado":

- `confirmarRecibido()` — el camino normal (asesor confirma recibido).
- `aprobarModificacion()`, al devolver el vale ORIGINAL a `RECIBIDO` — cubre
  también el camino de "rechazo" (`analisis_correcciones_5.md #5`), donde el
  asesor solicita modificación directo desde `PENDIENTE_CONFIRMACION` sin
  haber pasado nunca por `confirmarRecibido()`; ese es su único momento de
  congelamiento.

```js
function calcularAtraso(vale) {
  const congelamiento = vale.atraso_congelado_en
    || (ESTADOS_TERMINALES.includes(vale.estado) ? vale.actualizado_en : null);
  const referencia = congelamiento ? new Date(congelamiento.replace(' ', 'T')) : new Date();
  ...
}
```

El fallback a `ESTADOS_TERMINALES`/`actualizado_en` se conserva para datos de
semilla o filas antiguas que no tengan la columna nueva poblada. Cada vale
`MOD-` congela el suyo propio de forma independiente cuando a su vez llega a
`RECIBIDO`.

Verificado con un smoke test: confirma un vale de recibido → `atraso_congelado_en`
queda fijado → se solicita una modificación sobre él (pasa a
`SOLICITANDO_MODIFICACION`) → `atraso_congelado_en` NO cambia y `diasAtraso`
no crece → se aprueba la modificación → el original conserva su
congelamiento y el nuevo vale `MOD-` congela el suyo al confirmarse recibido
por separado.

---

## Verificación general

- `node --check` sobre los 4 archivos de backend tocados (`valeService.js`,
  `valePdfService.js`, `valeRepository.js`, `src/config/database.js`) y
  sobre `app.js`.
- Smoke test backend dedicado (`smoke-correcciones8.js`, fuera del repo)
  contra `valeService` directamente: ordenamiento por atraso real (punto 3),
  5 creaciones concurrentes del mismo asesor sin correlativos duplicados
  (punto 6), congelamiento de atraso a través de `RECIBIDO →
  SOLICITANDO_MODIFICACION → aprobación → nuevo RECIBIDO` (punto 7), y
  bloqueo de una segunda modificación sobre un vale `MOD-` (punto 5).
- Recorrido en el navegador: Administrador (orden de `GUA-3-0002` antes que
  `GUA-3-0003` en el buzón general), creación de un vale nuevo como
  Administrador y revisión visual del PDF resultante contra
  `Pruebas/MUESTRA PDF.pdf` (punto 1), Supervisor de Ventas (hipervínculo
  "Ver vale de arte (PDF)" en el modal de autorizar modificación, punto 2).
  Sin errores en consola del navegador en ninguno de los roles probados.
