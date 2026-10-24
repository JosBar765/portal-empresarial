# Selector de tienda en cascada de 3 niveles

Rama: `feat/selector-tiendas-cascada` (desde `dev` 2acc3d5).

## Objetivo
Reemplazar TODOS los desplegables «Todas las tiendas» por un menú en cascada de tres niveles: Nivel 1 = países, Nivel 2 = tiendas del país (más los grupos Trofex R1 y Trofex R2), Nivel 3 = tiendas individuales de Trofex Ruta 1 y Ruta 2. En celular (< 640 px) pasa a una hoja inferior con navegación por pasos.

## Diseño aprobado (fuente de verdad)
Maqueta en Figma, aprobada por el dueño: archivo «Portal · Selector de tiendas», fileKey `0yHoIqZK990tprP6M0D1Jd` (https://www.figma.com/design/0yHoIqZK990tprP6M0D1Jd). Secciones: Componentes (2:2), Escritorio (3:2), Estados (4:76), Especificaciones (4:135), Celular (7:108). Las medidas y reglas están resumidas abajo.

### Medidas y tokens (de `public/css/global.css`)
- Disparador: ancho 260 (mínimo 200), alto 38, borde 1 px `--color-border`, radio `--radius-sm`, Inter 13; hover y abierto: borde `--color-primary`; abierto: anillo de 3 px (`rgba(var(--color-primary-rgb), .1)`) y flecha hacia arriba.
- Paneles: fondo `--color-surface`, borde 1 px `--color-border`, radio `--radius-md`, sombra `--shadow-lg`, relleno 6 px, separación entre paneles 4 px. Anchos: nivel 1 = 260, nivel 2 = 380, nivel 3 = 340. Alto máximo 360 con scroll vertical.
- Fila: relleno 8 × 10, radio `--radius-sm`, 13 px. Hover: fondo `--color-surface-muted` y texto `--color-primary`. Activa o ruta abierta: fondo `--color-primary-light`, texto `--color-primary`, negrita 700; chevron de 16 px (`--color-text-muted`, en ruta abierta `--color-primary`).
- Encabezado de panel (nombre del país o del grupo): 11 px, 700, mayúsculas, espaciado 3 %, `--color-text-muted`, relleno 10 / 12 / 4. Divisor: 1 px `--color-border`, margen 4. «Todas las tiendas» va primero, separado del resto por el divisor, con encabezado «País» antes de los países.
- Celular: hoja inferior de ancho completo, radio `--radius-lg` arriba, asa de 40 × 4, cabecera con flecha de volver, título (Outfit 17 SemiBold) y × de cerrar; ruta/migas en 12 px (`Guatemala › Trofex R2`); filas de 49 px mínimo con texto de 15 px y chevron de 20 px; la tienda elegida en azul y negrita con ✓; fondo atenuado (`--color-text` al 50 %) que cierra al tocarlo.
- Estados: cargando = filas de esqueleto (solo se anima la opacidad; respeta `prefers-reduced-motion`); vacío = «Este país no tiene tiendas activas.» (y «No hay tiendas activas.» si todo el árbol está vacío); error = ícono de alerta, «No se pudieron cargar las tiendas.», «Inténtalo de nuevo.» y botón «Reintentar» (`btn btn--ghost btn--sm`); opción deshabilitada = texto atenuado (`opacity .6`) con el motivo en el `title`.
- Comportamiento: clic (o pasar el mouse con una pequeña espera) abre el nivel siguiente alineado con su fila; abrir uno cierra los demás desplegables; clic en una tienda la selecciona y cierra todo; «Todas las tiendas» quita el filtro; Esc o clic fuera cierra; teclado: ↑ ↓ recorren, → abre el submenú, ← vuelve un nivel, Enter selecciona; si un panel no cabe a la derecha se abre hacia la izquierda.

## Hallazgos del código (mapa de solo lectura)
- Hoy: `public/modules/admin/js/components/menuCascada.js` (motor, `crearMenuCascada`, `construirArbolTiendas` con países como encabezados fijos y solo Trofex con un segundo nivel, `construirArbolRoles`) y su CSS en `public/modules/admin/css/styles.css:482-640` + regla móvil ~903. Lo usan `tiendas.js:43`, `usuarios.js:60` (tienda) y `usuarios.js:66`/`forms/usuarioForm.js:97` (ROLES: no romperlos).
- Buzón: `public/modules/vales/index.html:94-96` `<select id="filtro-tienda">` lo llena `js/layout/toolbar.js:58-75` (`state.catalogos.tiendasGerencia || tiendas`; al cambiar: `state.tiendaId = valor || null; cargarBuzon()`); CSS `.filtro-tienda` y `#filtro-tienda` en `css/styles.css:407-432, 1945, 1972`.
- Reportes: `js/views/reportes.js:~441` select `#rep-f-tienda` (`aria-label="Filtrar por tienda"`), handler ~460-475 (`r.tiendaId = valor`, depura `tallerId`, `asesorIds` y `disenadorIds` que no pertenecen a la tienda nueva, `r.expandidos.clear(); cargarReportes()`); el bloque se recrea con `cont.innerHTML` en cada render; «Limpiar filtros» ~500-505.
- Datos: Admin ya trae `codigo`, `nombre`, `pais_nombre`, `departamento_nombre` (`tiendaAdminRepository.listarConDetalle`). Buzón (`catalogoRepository.listarTiendas`) y Reportes (`reporteRepository.listarTiendas` y `listarTiendasPorSupervisor`) solo traen `id`/`nombre` (y ids): hay que sumar `codigo`, `pais_nombre`, `departamento_nombre` (aditivo; `id` y `nombre` no cambian).
- No hay módulo ES compartido en `/js`, pero `/js` y `/css` se sirven como estáticos públicos (`src/app.js:52-53`); vales y admin pueden importar `/js/...` y enlazar `/css/...`.
- Docs a actualizar: `.agents/modulos/admin/documentacion/refactor_app_js.md`, `.agents/modulos/vales de arte/documentacion/` (correcciones_20, 23, 12_fase2c, 53, 57 mencionan el menú/los filtros) y el flujo.

## Arquitectura
- Componente compartido ES autocontenido: `public/js/menuCascada.js` (sin dependencias de módulo: su propio `escapeHtml` y selectores) y estilos `public/css/menu-cascada.css` (enlazado en los `index.html` de vales y admin). Exporta: `crearMenuCascada`, `construirArbolTiendas`, `construirArbolRoles`, `limpiarMenusCascadaHuerfanos`, `menusCascadaAbiertos`. API de `crearMenuCascada({ arbol, valorActual, etiquetaVacio, deshabilitar, onSeleccionar, ariaLabel })` → `{ elemento, actualizar(valor), establecerArbol(arbol), mostrarCargando(), mostrarError(mensaje, onReintentar), cerrar() }`. Tipos de nodo: `hoja`, `grupo` (flyout, a cualquier profundidad), `seccion` (se conserva por compatibilidad).
- `public/modules/admin/js/components/menuCascada.js` pasa a re-exportar el módulo compartido (los imports del admin no cambian) y se retiran las reglas `.menu-cascada-*` de `admin/css/styles.css` (el CSS compartido las reemplaza).
- `construirArbolTiendas` nuevo: cada país es un `grupo` (nivel 1) con las tiendas sueltas (`CÓDIGO - nombre`, ordenadas) y los grupos Trofex (departamento que contiene «Trofex», sin prefijo «Ventas») como `grupo` de nivel 3; sin país: «Sin país».
- Vales: el `<select id="filtro-tienda">` pasa a un contenedor con el MISMO id y el menú dentro; en Reportes el contenedor conserva `id="rep-f-tienda"`; se conservan `aria-label`, `data-*` y el comportamiento de los handlers (`onSeleccionar` reemplaza al `change`). El valor se convierte a string y `''` = todas.

## Restricciones
- Conventional Commits en español; sin atribución de IA; CRLF; comentarios de una línea; ids, clases y `data-*` estables; no agregar frameworks.
- No editar `schema.sql`/`seed.sql`; sin migraciones (solo SQL de lectura en repositorios, parametrizado).
- Cambios de backend → hay que reiniciar el servidor; el frontend se recarga solo.
- Las listas de roles del admin (selector de rol en Usuarios y en el modal) deben seguir funcionando igual.

## Tareas
- [ ] T1 · Componente compartido (`menuCascada.js` + `menu-cascada.css`): tres niveles, hoja inferior en celular, teclado, estados; Admin lo usa (tiendas y roles) sin regresiones.
- [ ] T2 · Datos de tiendas con país, código y departamento en Buzón y Reportes (3 consultas) sin romper a sus otros consumidores.
- [ ] T3 · Integrar en el filtro del Buzón y en el de Reportes.
- [ ] T4 · Documentación y verificación (incluida la vista en navegador de escritorio y celular).

## Rutas
Delegated direct, un escritor por vez: W1 = T1, W2 = T2 + T3 + docs.

## Verificación
`node --check`; prueba de la función `construirArbolTiendas` con datos de ejemplo (países, Trofex R1/R2, sin país); consultas nuevas contra la BD de desarrollo; revisión en el navegador (escritorio y celular) por el parent.

## Progreso
Plan creado.
- T1 (W1, ruta: delegated direct): escrito `public/js/menuCascada.js` y `public/css/menu-cascada.css`; admin re-exporta el módulo, enlaza el CSS y se retiraron las reglas `.menu-cascada-*` de `admin/css/styles.css`. Verificado: `node --check` de los .js y prueba de `construirArbolTiendas`/`construirArbolRoles` en Node (OK), CRLF sin LF sueltos. PENDIENTE: revisión en navegador (escritorio y celular) por el parent; T1 sigue sin marcar hasta verla.
- T2 (W2, ruta: delegated direct): `catalogoRepository.listarTiendas`, `reporteRepository.listarTiendas` y `listarTiendasPorSupervisor` suman `codigo`, `pais_nombre`, `departamento_nombre` (LEFT JOIN, sin perder filas); `_opcionesDeFiltro` mapea `id`, `nombre` y los campos nuevos. Verificado contra BD de desarrollo: 27/27/14 filas, id, nombre y orden idénticos a la consulta anterior, sin duplicados ni campos vacíos; el árbol da Costa Rica, El Salvador, Guatemala (Trofex R1 7, R2 7), Honduras, Nicaragua. Requiere reiniciar el servidor (el del usuario con `node --watch` lo hace solo).
- T3 (W2): Buzón (`#filtro-tienda` pasa a `<div>` sin la clase `.filtro-tienda`, menú montado en `toolbar.js`) y Reportes (`#rep-f-tienda` `<div>`, `onSeleccionar` → `cambiarTienda`) usan el menú compartido. PENDIENTE: revisión en navegador por el parent.
- T4 (docs Vales, W2): `correcciones_59.md`, `flujo_vale_de_arte.md` y `refactor_app_js.md` actualizados. PENDIENTE: vista en navegador; T2-T4 sin marcar hasta verla.
