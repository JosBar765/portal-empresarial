# Refactorización de `public/modules/admin/js/app.js`

Origen: pedido explícito de aplicar `.agents/reglas/reglas_implementacion.md`
al módulo de administración, con el mismo criterio ya usado en
`public/modules/vales/js/app.js` (corrección #21). Refactor puramente
estructural — sin cambios de comportamiento, endpoints, DOM/CSS, permisos ni
UI. El archivo monolítico de 1770 líneas (un solo IIFE) se dividió en 20
módulos ES nativos.

## 1. Archivos nuevos y responsabilidad de cada uno

```
public/modules/admin/js/
├── app.js                     Orquestador: arranque de sesión, wiring, cargarTab inicial
├── state.js                    El objeto `state` (única fuente de estado del módulo)
├── socket.js                   initSocket (permisos_actualizados -> refresh + reload)
├── config/
│   └── roles.js                 ROL_*, ROLES_ENCARGADO_UNICO, TALLERES_CLONABLES_ASISTENTE
├── utils/
│   ├── dom.js                    $ / $$
│   └── formato.js                escapeHtml, inicialesAvatar
├── api/
│   ├── authApi.js                sessionCheck / logout / refreshToken
│   └── adminApi.js               Una función por endpoint de /api/admin
├── components/
│   ├── modal.js                  Modal genérico (abrir/cerrar, backdrop, Escape)
│   └── menuCascada.js             Motor del menú en cascada + construirArbolTiendas/
│                                  construirArbolRoles + limpieza de huérfanos
├── layout/
│   ├── accountMenu.js             Menú desplegable de cuenta
│   └── sidebar.js                 Sidebar de 5 pestañas + cargarTab (dispatcher)
├── views/
│   ├── usuarios.js                Carga/render/filtrado del listado + activar/desactivar
│   ├── roles.js                   Carga/render de roles + modal rol + modal permisos
│   ├── tiendas.js                 Carga/render del listado de tiendas
│   ├── talleres.js                Carga/render del listado de talleres
│   └── mantenimiento.js           Carga/render + modal de activación
├── forms/
│   ├── usuarioForm.js             Crear/editar usuario
│   └── tiendaForm.js              Crear/editar tienda (cascada país/empresa/depto/subdivisión)
└── actions/
    ├── tiendaPersonal.js          Ver / gestionar personal de una tienda
    └── tallerPersonal.js          Ver / gestionar personal (encargado + técnicos) de un taller
```

`views/mantenimiento.js` incluye también el modal de activación
(`abrirModalActivarMantenimiento`) en vez de un `forms/mantenimientoForm.js`
aparte: toda la pestaña son ~90 líneas y ese modal no es un "crear/editar
entidad" compartido — es la única acción de esa vista. Mismo criterio de "no
fragmentar de más" que ya se aplicó a `valeBuzonService.js` en el refactor
de backend de correcciones #22.

## 2. Funciones trasladadas

Las ~46 funciones/constantes de nivel de módulo del `app.js` original se
movieron sin cambios de lógica al módulo cuya responsabilidad coincide con
la tabla de la sección 1. Una reubicación no trivial:

- `rolEsperadoDeTaller` se movió a `actions/tallerPersonal.js` (no a
  `views/talleres.js`) porque su único consumidor es
  `abrirModalPersonalTaller`, que vive ahí.

## 3. La capa `api/adminApi.js` (nueva — el admin original no tenía una)

El archivo monolítico hacía ~25 `fetch('/api/admin/...')` inline, algunos
verificando `res.ok` y lanzando con el mensaje del servidor, otros sin
verificar nada. Cada función nueva reproduce EXACTAMENTE la validación que
tenía su call site original — igual que ya documenta
`public/modules/vales/js/api/valesApi.js`.

Dos endpoints tenían call sites con validación DISTINTA entre sí:

- `GET /api/admin/usuarios`: `cargarUsuarios` verificaba `res.ok` y lanzaba;
  `abrirModalUsuario`/`abrirModalPersonal`/`abrirModalPersonalTaller` no.
- `GET /api/admin/roles`: `cargarRoles` verificaba `res.ok` y lanzaba;
  `asegurarCatalogosFiltro`/`abrirModalUsuario` no.

Para no uniformizar ese comportamiento, `listarUsuariosRaw()` y
`listarRolesRaw()` devuelven `{ res, data }` en vez de decidir ellas mismas
— cada call site sigue validando (o no) exactamente como antes.

## 4. Qué quedó en `app.js` y por qué

Solo el flujo de arranque: `session_check` y sus redirecciones (incluido el
chequeo de `rolId !== 1`, exclusivo de este módulo), llenado de la cabecera
de cuenta, y las llamadas `wireAccountMenu`/`wireSidebar`/`initSocket`/
`cargarTab` en el mismo orden que tenía el original, más el listener de
logout. No contiene lógica de negocio ni de render.

## 5. Dependencias entre módulos

- Todo depende de `state.js` (estado compartido, mismo objeto mutable de
  siempre — sin getters/setters).
- `layout/sidebar.js` posee `cargarTab()` (el dispatcher de las 5 pestañas),
  no `app.js`. El original tenía un ciclo `wireSidebar` ↔ `cargarTab` dentro
  del mismo scope; poner el dispatcher en `sidebar.js` (que ya importa los 5
  `cargarX` de `views/`) evita crear un ciclo de imports `app.js` ⇄
  `sidebar.js` — `app.js` solo importa `cargarTab`, nunca al revés.
- `components/menuCascada.js` agrupa el motor genérico CON sus dos
  adaptadores de datos (`construirArbolTiendas`/`construirArbolRoles`)
  porque ambos son readers puros de catálogo que solo tienen sentido junto a
  la forma de árbol que consume el componente.

### Ciclos de imports intencionales (permitidos por `reglas_implementacion.md`)

Cuatro parejas vista/modal se importan mutuamente, igual que ya ocurría como
"dos funciones en el mismo scope que se llaman entre sí" en el archivo
monolítico original. En los cuatro casos: (1) el ciclo ya existía antes del
refactor, (2) solo se importan declaraciones de función, nunca valores de
top-level, y (3) ninguna de las dos partes se ejecuta durante la carga del
módulo — solo dentro de manejadores de clic o después de un `await` disparado
por el usuario.

- `views/usuarios.js` ⇄ `forms/usuarioForm.js` (`abrirModalUsuario` llama a
  `cargarUsuarios` al guardar; `renderFilasUsuarios`/`renderUsuarios` llaman
  a `abrirModalUsuario`).
- `views/tiendas.js` ⇄ `forms/tiendaForm.js` (mismo patrón con
  `abrirModalTienda`/`cargarTiendas`).
- `views/tiendas.js` ⇄ `actions/tiendaPersonal.js` (mismo patrón con
  `abrirModalVerPersonal`/`abrirModalPersonal`/`cargarTiendas`).
- `views/talleres.js` ⇄ `actions/tallerPersonal.js` (mismo patrón con
  `abrirModalVerPersonalTaller`/`abrirModalPersonalTaller`/`cargarTalleres`).

Los módulos ES nativos del navegador soportan imports circulares de
funciones declaradas (se izan, `hoisting`) sin problema, siempre que no se
invoquen durante la evaluación inicial del módulo — que es justo el caso
aquí.

## 6. Qué cambió fuera de `app.js`

`public/modules/admin/index.html` línea 107: `<script src="...">` pasa a
`<script type="module" src="...">` — un solo cambio de una línea, igual que
ya se hizo para `public/modules/vales/index.html`. `toast.js` y
`socket.io.js` siguen siendo scripts clásicos cargados antes en el `<head>`/
`<body>` (sin `type="module"`), así que `window.toast` e `io` siguen
disponibles cuando el módulo se ejecuta.

## 7. Verificación

### Estática (hecha antes de tener base de datos)

- `node --check` sobre los 20 archivos nuevos: sin errores de sintaxis
  (Node 24 valida sintaxis ES module con `import`/`export` sin problema).
- Script de verificación cruzada import→archivo→export: cada `import { X }
  from '...'` resuelve a un archivo real y `X` existe como `export` en él —
  0 errores tras corregir dos falsos positivos del propio script (los
  nombres `$`/`$$` rompían la expresión regular inicial).
- Revisión manual línea por línea de cada función movida contra el original
  — mismo cuerpo, mismos endpoints/métodos HTTP, misma validación de cada
  `fetch`, mismos ids/clases/`data-*` del DOM, mismos textos.

### En navegador, con base de datos real (hecha después, ver sección 9)

Con MySQL real montado en XAMPP local (`portal_empresarial`, schema + seed
reales) y el servidor corriendo (`npm start`), se inició sesión como
`admin@munditrofeos.com` y se recorrieron las 5 pestañas en Chrome
(`mcp__claude-in-chrome`):

- **Gestionar Usuarios**: listado con 73 usuarios reales, tarjetas de
  resumen correctas. Filtro de tienda (menú cascada, con secciones por país)
  y filtro de rol (con el submenú "Encargados de taller" en cascada nivel 2)
  probados — ambos filtran correctamente y el contador de resultados
  coincide. Editar un usuario existente (cambio de nombre, guardar, revertir)
  funcionó — `PUT /api/admin/usuarios/:id` + refresco de la lista vía el
  ciclo `views/usuarios.js` ⇄ `forms/usuarioForm.js`. Crear un usuario nuevo
  (Asesor de Ventas, con el campo de teléfono apareciendo dinámicamente al
  elegir ese rol) funcionó de punta a punta — `POST /api/admin/usuarios` —
  y se limpió después (usuario de prueba borrado directo de la base, ver
  sección 9).
- **Roles y Permisos**: las 10 tarjetas de rol con conteos reales. Modal de
  permisos abierto para "Asesor de Ventas": checkboxes reflejando sus 5
  permisos actuales, botón "Marcar/Desmarcar todos" probado en ambas
  direcciones (marca y desmarca el grupo completo) y luego cancelado sin
  guardar para no alterar los permisos reales del rol.
- **Gestionar Tiendas**: listado completo. "Ver personal" y "Gestionar
  personal" (agregar/quitar) probados sobre una tienda real — ambos modales
  cargan y muestran el personal agrupado correctamente. "Nueva Tienda"
  abierto: la cascada País → Empresa → Departamento (existente/nuevo) →
  Subdivisión (existente/nueva) se pobló correctamente para el país por
  defecto (Guatemala → Munditrofeos, S.A. → Ventas Munditrofeos), confirmando
  que `empresasDelPais`/`departamentosDelPais`/`subdivisionesDelDepartamento`
  leen bien de `state.organizacion`.
- **Gestionar Talleres**: listado de los 10 talleres. "Ver personal" y
  "Gestionar personal" probados sobre el taller "Diseño" — el encargado y
  los técnicos (incluido el badge "Asistente" para un técnico con
  `rol_id === ROL_ASISTENTE`) se muestran correctamente en ambos modales.
- **Modo Mantenimiento**: ciclo completo probado — activar con mensaje y
  contraseña real del Administrador (`PUT /api/admin/mantenimiento`), banner
  cambia a "Mantenimiento activo" con el mensaje configurado, y desactivar
  restaura el banner "El sistema opera con normalidad". Verificado en ambas
  direcciones.
- **Consola del navegador**: sin errores ni excepciones en ningún momento de
  la sesión (`read_console_messages` con `onlyErrors: true` antes de cerrar
  la pestaña).
- **Log del servidor**: sin errores; solo las líneas normales de conexión/
  desconexión de Socket.IO por cada carga de página.

### Limitación conocida de la prueba automatizada

`toggleActivoUsuario`/`toggleActivoRol` llaman a `confirm()` nativo del
navegador cuando el usuario/rol que se va a DESACTIVAR está actualmente
activo. Un `confirm()` nativo bloquea el hilo de renderizado de forma que
las herramientas de automatización de Chrome no pueden hacer clic en sus
botones (se intentó una vez sobre un usuario de prueba y la pestaña quedó
sin responder hasta navegar fuera de ella, sin que la petición HTTP llegara
a enviarse — no hubo ningún cambio de estado en la base de datos). Por eso
el camino de DESACTIVAR un usuario/rol activo no se ejercitó en vivo — se
verificó por revisión manual de código que `views/usuarios.js` y
`views/roles.js` llaman a `apiToggleActivoUsuario`/`apiToggleActivoRol` con
los mismos parámetros y en el mismo punto que el `app.js` original. El
camino de ACTIVAR (que no muestra `confirm()`) no se pudo probar por
separado porque los 73 usuarios y los 9 roles no-base ya estaban todos
activos en los datos reales de `seed.sql` al momento de la prueba.

## 8. Qué no se tocó

Ninguna regla de negocio, endpoint, método HTTP, id/clase/`data-*` del DOM,
ni texto visible cambió. `public/modules/admin/css/styles.css` no se tocó.

## 9. Base de datos local usada para la prueba (XAMPP)

Para poder ejecutar la prueba en navegador de la sección 7 se montó
`portal_empresarial` en la instancia de MySQL/MariaDB de XAMPP que ya existe
en esta máquina (usada también por otros proyectos ajenos a este —
`eventos_mt`, `fermento_db`, `studio_la_barber`, `test`): se arrancó
`mysql_start.bat`, se confirmó con `SHOW DATABASES` que esas bases seguían
intactas, y se creó `portal_empresarial` como una base nueva y separada, sin
tocar ninguna de las otras. `.env` se generó copiando `.env.example` tal
cual (`DB_HOST=127.0.0.1`, `DB_USER=root`, sin contraseña — coincide con el
root por defecto de XAMPP).

Al importar `database/schema.sql` y `database/seed.sql` aparecieron dos
errores de datos **preexistentes, sin relación con este refactor**:

1. **`database/schema.sql` línea 274** (`vale_historial.tecnico_id`) tenía
   un `COMMENT` sin texto (`INT DEFAULT NULL COMMENT,`), sintácticamente
   inválido — MariaDB rechazaba todo el import ahí. **Se corrigió en el
   archivo del repositorio**, quitando la palabra clave suelta (no había
   ningún texto de comentario que preservar).
2. **`database/seed.sql` líneas 123 y 179**: dos usuarios reales distintos
   — `(24, 'Victor Tobar', ..., rol 3 Supervisor)` y
   `(95, 'Francisco Zamora', ..., rol 2 Asesor)` — comparten literalmente el
   mismo correo `costarica@grupopremia.com`, lo que viola la restricción
   `UNIQUE` de `usuarios.email` e impide importar el archivo tal cual.
   **No se modificó `database/seed.sql`** porque no hay forma de adivinar
   cuál de los dos correos es el correcto sin conocer la organización real
   — en vez de eso, la prueba en navegador se corrió contra una copia local
   del seed con el segundo correo renombrado a un valor de prueba
   (`costarica.asesor.TESTONLY@grupopremia.com`), usada solo en esta base de
   datos local y nunca commiteada. **Pendiente**: alguien con el dato
   correcto debe corregir uno de los dos correos en `database/seed.sql`
   antes de poder importar ese archivo tal cual en cualquier otro entorno.

Al terminar la prueba se borró directamente de la base (`DELETE FROM
usuarios WHERE id = ...`) el único usuario de prueba creado durante la
sesión de navegador (`Usuario Prueba Refactor`); el resto de los 73
usuarios reales del seed no se modificó. El servidor Node (`npm start`) y
MySQL de XAMPP quedaron corriendo al finalizar, por si se quiere seguir
probando manualmente — deben detenerse con `mysql_stop.bat` (XAMPP) y
cerrando el proceso de `node src/server.js` cuando ya no se necesiten.
