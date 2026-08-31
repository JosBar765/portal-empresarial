# Trazabilidad de cambios — `analisis_correcciones_12.md`, Fase 2c

Esta fase implementa la parte de UI que quedaba pendiente del punto **10**:
el rediseño completo del dashboard de Gerencia, y su extensión al Supervisor
de Ventas (que desde la Fase 2a ya tenía el permiso `vales.ver_gerencia` en
el backend, pero la UI seguía gateada solo a `rolId === 10`).

El dashboard anterior (`analisis_correcciones_7.md`) mostraba 4 tarjetas fijas
(total, atrasados, entregados a tiempo, % a tiempo) + 2 gráficas de Chart.js
(por estado, por tienda). Se reemplaza por completo.

---

## 1. Backend: `obtenerDashboardGerencia` reescrito

**Archivo:** `src/modules/vales/services/valeService.js`

Nuevos 4 contadores con drill-down (Modificados/Recibidos/En Progreso, más
Atrasados combinable con cualquiera de los otros tres — mismo mecanismo que
`soloAtrasados` ya usaba en `obtenerBuzon`) + Total sin función de lista:

- **Clasificación lógica** (`clasificar(v)`): `esValeDeModificacion(v)` manda
  sobre "recibido" — un vale que ya usó su modificación se cuenta como
  Modificado aunque su estado real en base de datos siga siendo `RECIBIDO`
  (es el original que quedó congelado tras crear su vale `MOD-`). El resto:
  `RECIBIDO` puro → Recibidos; cualquier otra cosa (`ESPERANDO_AUTORIZACION`,
  `CREADO`, `APROBADO_DEPARTAMENTO`, `PENDIENTE_CONFIRMACION`,
  `SOLICITANDO_MODIFICACION`) → En Progreso.
- **Supervisor**: el dashboard se acota a los mismos asesores que ya cubre su
  buzón (`usuarioValeRepository.listarAsesoresPorSupervisor`) — nunca ve la
  organización completa, igual criterio que `_buzonSupervisor`.
- **Drill-down**: la lista (`data.vales`) solo se arma si hay un
  `filtroContador`, `soloAtrasados` o `busqueda` activos — vacía por defecto.
  Se removieron `porEstado`/`porTienda`/`terminados`/`entregadosATiempo`
  (ligados a las gráficas eliminadas).
- Se extrajo `_enriquecerConTaller(vales)` (antes duplicado al inicio de
  `obtenerBuzon`) como helper compartido — ambos métodos lo usan ahora.
- **Decisión de diseño no pedida explícitamente pero razonable**: el
  buscador de la lista funciona también SIN un contador activo (basta con
  escribir) — el documento solo ejemplifica "contador → lista", pero no
  prohíbe buscar directo.

## 2. Backend: catálogo de tiendas filtrables por Supervisor

**Archivos:** `src/modules/vales/services/valeService.js`,
`src/modules/vales/repositories/usuarioValeRepository.js`

`obtenerCatalogos(usuario)` agrega `tiendasGerencia`: el catálogo completo
para Administrador/Gerente; solo las tiendas de los asesores que cubre para
el Supervisor. `listarAsesoresPorSupervisor` ganó `u.tienda_id` en su SELECT
para poder resolverlo sin consultas extra. Reusa el endpoint `/catalogos`
existente (mismo patrón que `miTiendaId` de la Fase 2b) en vez de un
endpoint nuevo.

## 3. Backend: controller

**Archivo:** `src/modules/vales/controllers/valeController.js`

`dashboardGerencia` agrega `filtroContador`, `soloAtrasados`, `busqueda` a
los filtros — mismo patrón que `buzon()`. Sin cambios de ruta/permiso.

## 4. Frontend: sidebar del Supervisor gana "Dashboard"

**Archivos:** `public/modules/vales/index.html`,
`public/modules/vales/js/app.js`

Tercer botón estático (`#sidebar-item-terciario`, oculto por defecto) entre
"Trabajo realizado" y el botón de colapsar — el loop genérico de
`wireSidebar()` ya maneja cualquier `.sidebar-item` por `data-vista` sin
cambios de código, solo se muestra (`style.display=''`) para `rolId===4`. A
diferencia del Gerente (que reemplaza sus 2 botones por Dashboard/Vales de
Arte), el Supervisor CONSERVA sus dos vistas normales y gana esta como
tercera opción. `actualizarTituloYSeccionesVista`/`cargarBuzon` amplían su
condición de `rolId===10` a `[4, 10].includes(rolId)`.

## 5. Frontend: dashboard sin gráficas, con drill-down

**Archivo:** `public/modules/vales/js/app.js`

- `renderDashboardGerencia`: el esqueleto (grid de contadores + sección de
  lista con su buscador) se construye UNA sola vez (`cont.dataset.wired`) —
  reconstruirlo en cada recarga destruiría el `<input>` de búsqueda y le
  haría perder el foco a cada tecleo (bug evitado desde el diseño, no
  encontrado en pruebas). Los re-renders posteriores solo tocan
  `#dashboard-contadores` y el `<tbody>` de la lista.
- `renderTablaDashboard`: reusa las mismas celdas que la tabla del buzón
  normal (`celdaTaller`, `formatearFecha(Hora)`, `claseEstado`/
  `etiquetaEstado` — ya devuelven el estado GENERAL para `rolId` 4/10 fuera
  de la vista "trabajo", sin cambios) pero con un set de acciones FIJO (ver
  vale PDF, ver propuesta si `propuesta_general_url`, ver historial —
  reusando `abrirModalHistorial`, ya genérico), no `construirAcciones`.
- `Chart.js` se quitó del `<script>` de `index.html` y de `styles.css`
  (`.dashboard-charts`/`.chart-card` reemplazadas por un `.dashboard-lista`
  mínimo que reusa `.buzon-toolbar`/`.buzon-table`/`.tabla-wrapper` tal cual).
- **Sin tiempo real**: en `initSocket`, la llamada a `cargarBuzon()` tras un
  `vale_evento` se salta cuando el usuario está parado en la vista dashboard
  — el toast/beep se sigue mostrando, solo se omite el refresco de datos.
- `wireToolbar`'s filtro de tienda se amplía de `rolId===10` a
  `[4, 10].includes(rolId)`, poblado desde `state.catalogos.tiendasGerencia`
  — y como consecuencia natural (el documento pide que TODO sea filtrable
  por tienda, no solo el dashboard), el Supervisor también ve este filtro en
  sus vistas normales de Buzón/Trabajo realizado, no solo en Dashboard.

---

## Verificación

- `node --check` sobre todos los `.js` tocados.
- **Smoke test backend** (`smoke-correcciones12-fase2c.js`, contra el mock):
  16 aserciones — un vale RECIBIDO que ya usó su modificación (seed id 8)
  cuenta como "modificados", nunca "recibidos"; el propio vale `MOD-` (id 12)
  también; `modificados+recibidos+enProgreso === total`; sin filtro activo la
  lista viene vacía; `soloAtrasados` combinado con un `filtroContador` filtra
  correctamente; la búsqueda funciona sin contador activo; el Supervisor de
  MTC ve exactamente el mismo total que el Gerente en esta semilla (todos los
  vales son de su único asesor cubierto); `tiendasGerencia` del Supervisor
  queda acotado a su departamento, la de Gerente/Administrador es el catálogo
  completo; filtrar por una tienda sin vales da total 0.
- **`npm run dev` + navegador** (Claude in Chrome): login como Gerente — 5
  tarjetas sin gráficas, clic en "Modificados" muestra la lista (2 filas,
  `GUA-3-0008` y `MOD-GUA-3-0008`, con sus 2 acciones cada una — sin "ver
  propuesta" porque ninguna tiene documento adjunto), clic en "Ver historial"
  abre el modal correctamente, deseleccionar vacía la lista, combinar
  "Atrasados" + "En progreso" filtra correctamente (11 vales, todos con badge
  de atraso rojo); login como Supervisor — nueva entrada "Dashboard" en su
  sidebar (además de Buzón/Trabajo realizado, que siguen intactos), filtro de
  tienda acotado a "Munditrofeos, S.A." (su única tienda con asesores), el
  buscador de la lista funciona de forma independiente (sin contador activo).
  Sin errores en consola.
- Sin commit ni push — pendiente de solicitud explícita del usuario (las
  fases 1/2a/2b ya se subieron a `vales-de-arte` en este mismo hilo, a
  pedido explícito).

## Siguiente paso

Queda solo la **Fase 2d**: sesión interactiva de normalización de BD (punto
12), sobre el esquema ya completo.
