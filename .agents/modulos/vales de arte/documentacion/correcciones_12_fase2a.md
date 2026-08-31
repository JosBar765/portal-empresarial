# Trazabilidad de cambios — `analisis_correcciones_12.md`, Fase 2a

Este documento registra la **Fase 2a** del punto 10 de `analisis_correcciones_12.md`:
la jerarquía organizacional (departamentos → subdivisiones → tiendas) y la
relación supervisor↔tienda(s) rotativa. Es la base de datos/dominio sobre la
que se apoyan las fases siguientes:

- **Fase 2b** (pendiente): talleres Protextil + Diseño Local por tienda, rol
  genérico "Encargado de Taller", permisos atómicos, eliminación real del rol
  Encargado General (punto 11), fusión del buzón de fusión dentro del buzón
  del Encargado de Diseño (punto 6), nuevo formato de correlativo (punto 13).
- **Fase 2c** (pendiente): rediseño del dashboard de Gerencia/Supervisor.
- **Fase 2d** (pendiente): sesión interactiva de normalización de BD (punto 12).

---

## 1. Jerarquía organizacional: `departamentos` → `subdivisiones` → `tiendas`

**Archivos:** `database/schema.sql`, `src/config/database.js`

Se agregaron dos tablas nuevas (`departamentos`, `subdivisiones`) y se renombró
`localidades` a `tiendas`, agregándole `departamento_id` (NOT NULL) y
`subdivision_id` (NULL-able — no todo departamento tiene subdivisiones, ej.
Premia Z13). La tienda `id = 1` (código `MTC`) hereda el rol de la vieja fila
placeholder `GUA` para no romper los `tienda_id = 1` que ya traía toda la
semilla de vales/usuarios de demostración.

Se sembraron las 27 tiendas reales de la organización que dio el usuario en el
punto 10, con sus 5 departamentos y 26 subdivisiones. Un detalle del documento
fuente que hubo que resolver por inconsistencia interna: la fila de la tienda
`SJO` (San José) venía con solo 4 columnas en vez de 5 (le faltaba el campo
PAÍS, y "Costa Rica" ocupaba el lugar de SUBDIVISIÓN), pero la propia tabla de
supervisores sí nombra una subdivisión "Ventas San Jose" para esa tienda — se
creó esa subdivisión para que ambas tablas casen, interpretando "Costa Rica"
como el país faltante de esa fila.

## 2. `usuarios.localidad_id` → `tienda_id`; `encargado_id` deja de ser "supervisor"

**Archivos:** `database/schema.sql`, `src/config/database.js`

`usuarios.encargado_id` pasa a significar EXCLUSIVAMENTE "encargado de taller
de este técnico" — la relación asesor→supervisor de `correcciones_10.md #11`
(1:1 vía `encargado_id`) queda reemplazada por la resolución dinámica del
punto 3. Se limpió el `encargado_id` del asesor de la semilla (quedó `NULL`,
ya no se usa) y se actualizó el comentario de la columna.

## 3. `supervisor_asignaciones`: cobertura rotativa supervisor↔tienda

**Archivos:** `database/schema.sql`, `src/config/database.js`,
`src/modules/vales/repositories/usuarioValeRepository.js`

Tabla pivote `supervisor_asignaciones (usuario_id, departamento_id,
subdivision_id NULL)` — `subdivision_id NULL` significa "cubre TODAS las
subdivisiones de ese departamento" (coincide literalmente con las anotaciones
"&lt;- Todas las subdivisiones" del documento). Se eligió esta forma en vez de
expandir a una fila por tienda, siguiendo 1:1 la tabla que dio el usuario.

**Un asesor puede tener MÁS de un supervisor simultáneo** — el documento
muestra dos personas cubriendo "Ventas Centroamérica, todas las subdivisiones"
a la vez (supervisores rotativos). Se sembraron los supervisores/gerentes
reales del documento (usuarios 13-24, todos rol 4), colapsando los pocos
registros que el propio documento repetía de forma idéntica (ej. "Pablo
Orellana" listado dos veces igual). La cuenta de prueba original
(`supervisor@munditrofeos.com`, id 4) se dejó cubriendo todo el departamento
Munditrofeos para seguir supervisando al asesor de demostración.

Dos consultas nuevas en `usuarioValeRepository.js`:

- **`obtenerSupervisoresDeAsesor(asesorId)`** — todos los supervisores que
  cubren la tienda de un asesor (puede devolver más de uno).
- **`listarAsesoresPorSupervisor(supervisorId)`** — reemplaza la
  implementación anterior (filtraba por `encargado_id` directo): ahora
  resuelve qué tiendas caen bajo la cobertura del supervisor y devuelve los
  asesores de esas tiendas.

Todos los sitios de `valeService.js` que asumían "el supervisor" del asesor
pasan a operar sobre el conjunto que devuelve `obtenerSupervisoresDeAsesor`:
`crearVale` y `confirmarRecibido`/`solicitarModificacion` notifican a TODAS
las salas `supervisor:<id>` correspondientes; `autorizarCreacion` valida
pertenencia con `supervisores.some(s => s.id === usuario.id)` en vez de
comparar `encargado_id`. `atrasoWatcher.js` (`salasParaVale`) recibió el mismo
cambio. El cupo colectivo diario (`obtenerLimiteColectivoSupervisor`,
`correcciones_10.md #11`) no cambió de criterio — sigue siendo el conteo
propio del supervisor vs. la cantidad de asesores que cubre — solo cambió la
fuente de esa relación.

## 4. Supervisor y Gerente comparten el dashboard de gerencia

**Archivos:** `database/schema.sql`, `src/config/database.js`

Se agregó el permiso `vales.ver_gerencia` (id 17) al rol 4 (Supervisor de
Ventas), además del rol 10 (Gerente) que ya lo tenía. Con esto el Supervisor
ya puede entrar a `GET /api/vales/dashboard-gerencia` — la UI todavía no lo
expone para ese rol (`wireToolbar` sigue gateado a `rolId === 10`) porque el
rediseño real del dashboard (contadores nuevos, listas de drill-down, quitar
gráficas, filtro por tienda para todo) es la Fase 2c; hacerlo ahora habría
significado construir la UI vieja para el Supervisor y volver a tirarla en la
fase siguiente.

## 5. Renombrado `localidad` → `tienda` en todo el stack

**Archivos:** `src/modules/vales/repositories/catalogoRepository.js`,
`src/modules/vales/repositories/valeRepository.js`,
`src/modules/vales/services/valeService.js`,
`src/modules/vales/controllers/valeController.js`,
`public/modules/vales/{js/app.js,index.html,css/styles.css}`

Renombrado mecánico de identificadores, sin cambiar comportamiento:
`listarLocalidades`/`obtenerLocalidadPorId` → `listarTiendas`/`obtenerTiendaPorId`;
tag del mock `catalog:localidades` → `catalog:tiendas`; `vales.localidad_id` →
`tienda_id` (columna, INSERT, FK); `filtros.localidadId` → `tiendaId` en
`obtenerBuzon`/`obtenerDashboardGerencia`/`valeController`;
`state.localidadId` → `tiendaId`, `state.catalogos.localidades` → `.tiendas`,
`#filtro-localidad`/`.filtro-localidad` → `#filtro-tienda`/`.filtro-tienda`,
`data.porLocalidad` → `porTienda` y `chartsGerencia.localidad` → `.tienda` en
el frontend (las 3 líneas de Chart.js que los leen se actualizaron al mismo
nombre, sin tocar su lógica — el rediseño real del dashboard es 2c).

---

## Verificación general

- `node --check` sobre todos los `.js` tocados.
- **Smoke test backend** dedicado (`smoke-correcciones12-fase2a.js`, fuera del
  repo, contra el mock en memoria):
  - el asesor de MTC (departamento Munditrofeos, subdivisión Comercialización)
    está cubierto por 2 supervisores a la vez (ambos con cobertura de
    departamento completo), y NO por un tercero que solo cubre otra
    subdivisión del mismo departamento;
  - un vale nuevo nace con el `tienda_id` correcto y su correlativo usa el
    código de tienda real (`MTC-...`), no el placeholder viejo;
  - `autorizarCreacion` rechaza al supervisor que no cubre la subdivisión del
    asesor, y acepta al que sí la cubre;
  - `obtenerLimiteColectivoSupervisor` devuelve el denominador correcto tanto
    para un supervisor con asesores bajo su cobertura como para uno sin
    ninguno;
  - `obtenerDetalle` conserva `tienda_id` end-to-end.
- **`npm run dev` + navegador** (Claude in Chrome), como Supervisor de Ventas:
  `GET /api/vales/catalogos` devuelve `tiendas` (27 filas, con
  `departamento_id`/`subdivision_id`); `GET /api/vales/dashboard-gerencia`
  responde `200` (antes `403`) con `porTienda` de 27 filas; el buzón carga
  igual que antes, sin errores de consola.
- Sin commit ni push — pendiente de solicitud explícita del usuario.
