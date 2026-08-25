# Trazabilidad de cambios — `analisis_correcciones_7.md`

Este documento registra, punto por punto, qué se implementó a partir de
`analisis_correcciones_7.md` (carpeta `.agents/vales de arte/correcciones/`) y
en qué archivos. Sirve como bitácora, no como especificación (la
especificación funcional sigue siendo `analisis_modulo.md` + los
`analisis_correcciones_N.md`).

---

## 1. Contador "Vales Modificados" para el Encargado General

**Archivo:** `src/modules/vales/services/valeService.js` → `_buzonEncargadoGeneral`

El buzón del Encargado General ya mostraba en la tabla los vales `MODIFICADO`
pendientes de reenvío a un taller (desde `analisis_correcciones_5.md #6`),
pero sin tarjeta/contador propio — `analisis_correcciones_6.md #3` incluso
había quitado a propósito el contador equivalente que existía antes
(`pendientesReenvio`). Este punto pide traerlo de vuelta con otro nombre y
como filtro:

```js
const contadores = {
  pendientesFusion: enVentana.filter(v => v.estado === ESTADOS.APROBADO_DEPARTAMENTO).length,
  valesModificados: enVentana.filter(v => v.estado === ESTADOS.MODIFICADO).length,
  atrasados: enVentana.filter(v => v.atrasado).length
};
const predicados = {
  pendientesFusion: v => v.estado === ESTADOS.APROBADO_DEPARTAMENTO,
  valesModificados: v => v.estado === ESTADOS.MODIFICADO
};
```

**Frontend** (`public/modules/vales/js/app.js`, `CONTADORES_CONFIG[8]`): nueva
tarjeta `{ key: 'valesModificados', label: 'Vales Modificados', filtro:
'valesModificados' }`, mutuamente excluyente con el resto (no combinable como
"Atrasados"). `CONTADORES_CONFIG[9]` la hereda automáticamente (ya es un
alias de `CONTADORES_CONFIG[8]`).

## 2. Un vale ya modificado se ve como MODIFICADO, no CONFIRMADO

**Archivo:** `src/modules/vales/services/valeService.js` →
`esValeDeModificacion`, `estadoVisibleAsesor`, `_trabajoSupervisor`

Cuando se aprueba una solicitud de modificación, el vale **original** queda
con `estado = RECIBIDO` y `modificado = 1` (`aprobarModificacion`, sin
cambios). El problema: `esValeDeModificacion(vale)` solo miraba
`vale.estado === MODIFICADO` o `vale.vale_original_id` — ninguno de los dos
es cierto para el vale ORIGINAL (que se queda en `RECIBIDO`, no en
`MODIFICADO`, y no tiene `vale_original_id` porque no es él el vale hijo).
Por eso `estadoVisibleAsesor` caía en la rama "normal" y devolvía
`'CONFIRMADO'` para su `RECIBIDO`, cuando en realidad ya no es un vale
simplemente confirmado: a partir de él se creó un vale nuevo.

Corrección — se añade `!!vale.modificado` a la condición:

```js
function esValeDeModificacion(vale) {
  return vale.estado === ESTADOS.MODIFICADO || !!vale.vale_original_id || !!vale.modificado;
}
```

y dentro de `estadoVisibleAsesor`, la rama de modificación ahora mapea su
propio `RECIBIDO` a `'MODIFICADO'` en vez de heredar el `'CONFIRMADO'` de la
rama normal.

Este cambio arregla el asesor automáticamente (`_trabajoAsesor` ya llamaba a
`estadoVisibleAsesor`), pero el supervisor necesitó un cambio adicional:
`_trabajoSupervisor` no calculaba `estado_visible` en absoluto — mostraba el
`estado` real (`RECIBIDO` → "Recibido"). Se le agregó el mismo mapeo:

```js
_trabajoSupervisor(todos, ventana, filtroContador) {
  const cerrados = todos.filter(v => ESTADOS_CONFIRMADOS.includes(v.estado)).map(v => ({ ...v, estado_visible: estadoVisibleAsesor(v) }));
  ...
```

**Frontend** (`app.js`, `usaEstadosVisibles`): se amplió para que el
supervisor use `estado_visible` (y por lo tanto `ESTADOS_VISIBLES_LABEL`)
**solo** en su vista "Trabajo realizado", no en su buzón (que sigue
mostrando el estado real sin cambios — ahí nunca aparece `RECIBIDO`):

```js
function usaEstadosVisibles() {
  return state.user.rolId === 3 || (state.user.rolId === 4 && state.vista === 'trabajo');
}
```

## 3. El asesor ya no elige taller al solicitar una modificación

**Archivos:** `src/modules/vales/services/valeService.js` →
`_validarDatosVale`; `public/modules/vales/js/app.js` →
`abrirModalSolicitarModificacion`

Desde `analisis_correcciones_5.md #6`, quien decide a qué taller va una
modificación es el Encargado General (`reenviarModificacion`), no el asesor
al solicitarla — pero el formulario de solicitud seguía mostrando el
selector de talleres (y `talleres_ids` de la solicitud nunca se volvía a
leer en ningún lado: era dato muerto). Se quitó la sección completa:

- **Frontend**: se eliminó el bloque "Información de Taller"
  (`htmlSelectorTalleres()`), su wiring (`wireSelectorTalleres`), la
  validación de "al menos un taller" y el fetch de `detalle.talleres` que
  solo servía para precargar esa sección (ya no tenía otro uso, así que se
  quitó también).
- **Backend**: `_validarDatosVale(payload, { requiereTalleres = true } = {})`
  gana un segundo parámetro — `crearVale()` lo sigue llamando sin opciones
  (talleres siguen siendo obligatorios ahí), `solicitarModificacion()` ahora
  llama `_validarDatosVale(payload, { requiereTalleres: false })`, que salta
  `_validarTalleresIds` y devuelve `talleresIds: []`.

## 4. El documento de corrección del Encargado General ya no se fusiona en el PDF de una modificación

**Archivo:** `src/modules/vales/services/valeService.js` → `aprobarGeneral`

`aprobarGeneral` guarda el archivo que sube el Encargado General y lo pasa
como segundo argumento a `_regenerarPdf(valeId, [saved.path])`, que copia sus
páginas (`copyPages`, vía `valePdfService`) dentro del PDF oficial del vale
— correcto para un vale multi-taller normal (es la fusión real de varias
propuestas), pero redundante para un vale de **modificación**: su PDF ya es
la corrección en sí, y el vale original ya guarda su propia propuesta previa
como documento adjunto (`aprobarModificacion`, "Propuesta original - ...").
Fusionar además el archivo de `aprobarGeneral` duplicaba contenido dentro
del PDF de la modificación.

```js
const propuestasParaFusionar = esValeDeModificacion(vale) ? [] : [saved.path];
await this._regenerarPdf(valeId, propuestasParaFusionar);
await valeRepository.actualizarPropuestaGeneral(valeId, saved.path);
```

El archivo se sigue guardando y sigue quedando disponible como
`propuesta_general_url` (enlace "Ver propuesta"); lo único que cambia es que
ya no se copian sus páginas dentro del PDF cuando el vale es de modificación.

## 5. PDF — cotización + firma en una sola fila

**Archivo:** `src/modules/vales/services/valePdfService.js`

Se fusionaron `_dibujarCajaDestacada` (COTIZACIÓN) y `_dibujarLineaFirma`
(FIRMA AUTORIZACIÓN, antes en su propia línea debajo) en una única función
`_dibujarFilaCotizacionYFirma(ctx, valorCotizacion, etiquetaFirma)`:

- La caja de COTIZACIÓN pasa de ocupar el 100% del ancho de contenido a 4/5
  (mismo alto de `17`, mismo tratamiento visual).
- El 1/5 restante es una caja nueva, mismo alto y mismo borde, con la
  etiqueta "FIRMA Y AUTORIZACIÓN" centrada (usa `wrapText` por si no entra
  en una sola línea a 6pt).
- Al vivir en la misma fila que la cotización, todo el espacio vertical que
  antes ocupaba la línea de firma independiente (~48pt: línea + etiqueta
  debajo) queda libre para BOCETO Y DESCRIPCIÓN, que es el efecto pedido.

Verificado generando un vale nuevo real y revisando el PDF resultante en el
navegador: ambas cajas quedan en la misma línea, "FIRMA Y AUTORIZACIÓN" se
lee completa dentro de su columna, y hay más espacio antes de "BOCETO Y
DESCRIPCIÓN".

---

## Vista Gerencia (sección no numerada del archivo, "para una vista de gerencia")

**Archivos nuevos/tocados:** `database/schema.sql`, `src/config/database.js`,
`src/modules/vales/services/valeService.js`, `valeController.js`,
`routes.js`, `public/modules/vales/index.html`, `public/modules/vales/css/styles.css`,
`public/modules/vales/js/app.js`

### Rol y permisos

- Rol nuevo `10 = 'Gerente'` (solo lectura, sin ninguna acción sobre los
  vales). Permiso nuevo `17 = 'vales.ver_gerencia'`, asignado a Administrador
  y a Gerente; Gerente también recibe `vales.ver` (para poder listar el
  buzón como cualquier otro rol de solo consulta).
- Usuario semilla: `gerente@munditrofeos.com` / `gerente123`, con acceso a
  todos los países (igual que Administrador), reflejado tanto en
  `schema.sql` como en el mock de `src/config/database.js` (el camino
  realmente ejercitado en este entorno, sin MySQL).

### Backend

- `obtenerBuzon`: nuevo filtro `filtros.localidadId` (solo lo usa el
  frontend de Gerencia) que acota `todosConTaller` por tienda ANTES del
  `switch` por rol; nuevo `case 10` que reusa `_buzonAdministrador` tal
  cual — Gerencia ve exactamente la misma jerarquía/contadores que ya ve
  Administrador, de solo lectura (el frontend no le ofrece ninguna acción,
  ver más abajo).
- Método nuevo `obtenerDashboardGerencia(usuario, filtros)`: aplica la misma
  ventana de tiempo y el mismo filtro de tienda, y devuelve `total`,
  `atrasados` (+ `porcentajeAtrasados`), `entregadosATiempo` /
  `entregadosAtrasados` (medido solo sobre vales ya `RECIBIDO`, porque el
  atraso de uno en curso todavía no es un resultado final), `porEstado`
  (conteo por `vales.estado`) y `porLocalidad` (conteo + atrasados por cada
  tienda de `catalogoRepository.listarLocalidades()`).
- Ruta nueva `GET /api/vales/dashboard-gerencia`, permiso
  `vales.ver_gerencia`.

### Frontend

- `ROLES_CON_SIDEBAR` incluye a `10`; `wireSidebar()` detecta el rol y
  **reescribe** los dos botones existentes del sidebar (mismo par
  Buzón/Trabajo realizado que usan los demás roles) para que digan
  "Dashboard" (`data-vista='dashboard'`) y "Vales de Arte"
  (`data-vista='vales'`) en vez de duplicar el markup del sidebar por rol.
- `cargarBuzon()` intercepta `rolId === 10 && vista === 'dashboard'` y
  delega a `cargarDashboardGerencia()` en vez de pedir el listado; las
  secciones `#contadores-grid` / `.buzon-section` / `#dashboard-gerencia` se
  muestran/ocultan según la vista activa (`actualizarTituloYSeccionesVista`).
- `renderDashboardGerencia`: tarjetas KPI (reusan `.contador-card`) + dos
  gráficas de barra con **Chart.js** (cargado por CDN, `unpkg`/`jsdelivr`,
  mismo patrón que Ionicons) — "Vales por estado" (colores tomados de los
  tokens `--vale-estado-*-bg/fg` ya existentes en `global.css`, para que la
  paleta coincida con las píldoras de estado del resto del módulo) y "Vales
  por tienda" (Total vs. Atrasados).
- Nuevo `<select id="filtro-localidad">` en el toolbar, oculto por defecto y
  mostrado solo para `rolId === 10`, poblado desde
  `state.catalogos.localidades` (catálogo que el módulo ya cargaba, sin
  necesidad de un endpoint nuevo).
- `CONTADORES_CONFIG[10] = CONTADORES_CONFIG[1]` (mismas 4 tarjetas que ve
  Administrador en su vista "Vales de Arte").
- Ninguna acción nueva en `puede()`: Gerencia no coincide con ningún caso, así
  que `construirAcciones()` solo le deja "Ver vale de arte (PDF)" y "Ver
  historial" — de solo lectura por construcción, no por una lista de
  exclusiones.

### Decisión de alcance (explícita)

El archivo de correcciones menciona, como contexto narrativo (no como un
punto numerado), que Guatemala tiene 3 talleres reales
("diseño, diseño 3d y protextil") y que las tiendas internacionales deberían
tener su propio "taller local", y pide "hagamos esa modificación a la base
de datos desde ya". Se decidió **no** construir esa parte:
`vales.localidad_id` + `localidades.pais_id` ya existen y ya son suficientes
para que Gerencia filtre/reporte por tienda y por país (es justo lo que usa
`obtenerDashboardGerencia`); armar talleres reales por sede (con sus propios
encargados y usuarios) es una pieza organizacional nueva que no estaba en la
lista de correcciones y que requiere decisiones que el archivo no da
(quién es el encargado de cada taller nuevo, qué credenciales, etc.). Queda
pendiente para cuando se pida explícitamente.

---

## Verificación general

- `node --check` sobre los 5 archivos de backend tocados (`valeService.js`,
  `valePdfService.js`, `valeController.js`, `routes.js`,
  `src/config/database.js`) y sobre `app.js`.
- Smoke test backend dedicado (`smoke-correcciones7.js`, fuera del repo)
  contra `valeService` directamente: vale normal a `RECIBIDO` →
  `solicitarModificacion` sin `talleresIds` en el payload (punto 3) →
  `aprobarModificacion` → el vale original aparece en "Trabajo realizado"
  del asesor y del supervisor con `estado_visible === 'MODIFICADO'` (punto
  2) → el contador `valesModificados` del Encargado General cuenta y filtra
  correctamente (punto 1) → se reenvía, se aprueba en el taller y
  `aprobarGeneral` deja `propuesta_general_url` sin lanzar error (punto 4) →
  dashboard y buzón de Gerencia devuelven datos coherentes, incluido el
  filtro por `localidadId`.
- Recorrido en el navegador: Asesor (formulario de modificación sin
  selector de talleres, vale nuevo con PDF de cotización+firma en una
  fila), Encargado General (tarjeta y filtro "Vales Modificados"), Gerente
  (login, Dashboard con KPIs y gráficas, filtro de tienda, vista "Vales de
  Arte" de solo lectura). Sin errores en consola del navegador en ningún
  rol probado.
