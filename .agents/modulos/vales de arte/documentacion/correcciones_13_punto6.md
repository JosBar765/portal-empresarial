# Trazabilidad de cambios — `analisis_correcciones_13.md`, punto 6

Vista de Administrador: un panel nuevo que reemplaza al dashboard de módulos
**solo para el rol Administrador** (rol_id 1). Los puntos 1-5 del mismo
documento ya estaban implementados, commiteados y subidos (`667c2c5`) antes
de empezar este punto, tal como el propio documento lo pedía.

Son 5 pestañas (el documento original decía 6 e incluía "Gestionar
Categorías", pero el usuario confirmó que fue un error suyo — esa pestaña no
existe): Gestionar Usuarios, Roles y Permisos, Actividad de Usuarios,
Gestionar Tiendas, Modo Mantenimiento.

## Decisión de arquitectura: modelo organizacional

El documento describía tiendas planas (código/nombre/país) y supervisores
asignados directo a "varias tiendas supervisadas". El sistema real, desde la
Fase 2a de correcciones #12, ya tenía `departamentos → subdivisiones →
tiendas` con la cobertura de un supervisor resuelta vía
`supervisor_asignaciones` (por departamento o subdivisión, nunca por tienda
suelta). Se le presentó el conflicto al usuario, que eligió **extender la
jerarquía existente** en vez de aplanarla:

- "Gestionar Tiendas" también gestiona departamento/subdivisión de cada
  tienda (además de código/nombre/país).
- El selector de "tiendas supervisadas" en Gestionar Usuarios se ve como una
  selección de tiendas puntuales, respaldada por una columna nueva
  `supervisor_asignaciones.tienda_id` (opcional) — da 3 niveles de cobertura
  (departamento entero, una subdivisión, o una tienda puntual) sin romper
  ninguna fila ni consulta ya existente.

## Cambios de base de datos

En `database/schema.sql` y replicados en el mock de `src/config/database.js`
(semillas + `taggedHandlers`), que es la ruta que se ejercita en este
entorno.

- `usuarios`: se agregan `sesion_iniciada_en`, `ultima_actividad_en`,
  `ultima_ip`, `ultima_ciudad` para la pestaña de Actividad.
- `tiendas`: se agrega `orden` (INT), para el catálogo reordenable.
- `supervisor_asignaciones`: `departamento_id` pasa a NULL-able, se agrega
  `tienda_id` (NULL-able) — una fila cubre **o** departamento/subdivisión
  **o** una tienda puntual, nunca ambas. Las dos consultas de resolución de
  cobertura en `usuarioValeRepository.js`
  (`listarAsesoresPorSupervisor`/`obtenerSupervisoresDeAsesor`) se
  actualizaron para matchear también la variante directa por tienda.
- Tabla nueva `mantenimiento_config`: fila única (id=1) con
  `activo`/`mensaje`/`activado_por`/`activado_en`.
- Se reusa el permiso `admin.ver` (ya existía, asignado solo al rol 1) — no
  se agregó ningún permiso nuevo.

## Routing: cómo "reemplaza" al dashboard

En `src/app.js`: el redirect por JWT en `GET /` y en el middleware de
`/login` ahora manda a `/modules/admin/` en vez de `/dashboard/` cuando
`decoded.rolId === 1`. Un middleware nuevo antes de
`app.use('/dashboard', express.static(...))` redirige también al panel si el
admin escribe `/dashboard/` a mano — salvo que la URL traiga
`?vista=modulos` (el enlace "Volver al inicio"/header-back del panel usa
justo ese query param para que el admin sí pueda ver el dashboard de módulos
si lo pide explícitamente). El resto de roles no cambia en nada.

## Modo Mantenimiento (gate global)

`src/core/permissions/maintenanceMiddleware.js`, montado justo después de
`authenticateJWT`. Estado en caché de memoria del proceso (cero consultas
por request), refrescado al arrancar (esperando a que `database.js` decida
MySQL real vs. mock — ver `database.js: listo`, agregado para evitar un
ECONNREFUSED ruidoso por una carrera de arranque) y cada vez que el panel
cambia el estado. Bloquea con 503 (JSON para `/api`, página HTML para el
resto) a cualquier request de un usuario que no sea rol 1. Activarlo exige
reverificar la contraseña del propio admin, reusando
`authService.authenticate()` ya existente — no se agregó ningún helper de
password nuevo.

## Backend: módulo nuevo `src/modules/admin/`

Sigue el patrón de `src/modules/vales/` (controller fino, un solo
`adminService.js` con las reglas de negocio de las 5 pestañas, repositorios
por dominio con todo el SQL, cada query con su `tag`). Montado en
`app.use('/api/admin', requireAuth, require('./modules/admin/routes'))`,
cada ruta con `requirePermission('admin.ver')`.

Reglas de negocio relevantes:
- **Usuarios**: no se puede desactivar la cuenta propia; contraseña
  obligatoria al crear, opcional al editar; para rol Supervisor (4) el
  formulario ofrece tiendas puntuales en vez de una sola tienda.
- **Roles**: Administrador (1) y Asesor de Ventas (3) son roles base — no se
  pueden renombrar ni eliminar (sus permisos sí se editan); no se puede
  eliminar un rol con usuarios asignados.
- **Tiendas**: código único; "Personal" de una tienda = usuarios con esa
  `tienda_id` directa + supervisores que la cubren (por cualquiera de los 3
  niveles); agregar un supervisor crea una fila `tienda_id`-puntual en
  `supervisor_asignaciones`, agregar cualquier otro rol solo cambia su
  `tienda_id`.
- **Mantenimiento**: activar exige contraseña, desactivar no.

## Frontend: `public/modules/admin/`

Mismo patrón que Vales de Arte: sidebar/topbar/modal genérico calcados de
`public/modules/vales/js/app.js` (no hay sistema de módulos JS/CSS
compartido en este proyecto), aquí con 5 pestañas fijas en vez de vistas por
rol. `css/styles.css` importa `/css/dashboard.css` igual que el resto de
módulos.

## Errores encontrados y corregidos durante la verificación en navegador

1. **Orden de parámetros invertido en el mock**: `presenciaTracker.sellarLogin()`
   arma los params en el mismo orden que la SQL real
   (`ultima_ip, ultima_ciudad, id`), pero el handler tagueado
   `usuario:sellar_login` los destructuraba como `[usuarioId, ip, ciudad]` —
   el login nunca sellaba `sesion_iniciada_en` de verdad (silencioso, sin
   error). Se detectó viendo la pestaña de Actividad en vivo: el admin
   aparecía con "Última actividad: Justo ahora" pero "Conectado desde: -" y
   estado "Sin datos", una combinación imposible si el sellado hubiera
   funcionado. Corregido el orden en el handler del mock.
2. **El buscador de Gestionar Usuarios perdía el foco en cada tecla**:
   `renderUsuarios()` reconstruía TODO `#panel-content` (incluido un
   `<input>` nuevo) en cada evento `input` — el campo de búsqueda se
   desmontaba a media escritura y solo el primer carácter quedaba visible.
   Se separó en `renderUsuarios()` (cascarón, una sola vez) +
   `renderFilasUsuarios()` (solo repinta el `<tbody>`, en cada tecla).

Ninguno de los dos apareció en los smoke tests de backend (ambos son
puramente de integración: el primero solo se dispara desde el flujo real de
login vía `authController`, no desde llamar a los servicios directo; el
segundo es puramente de UI) — quedan como la razón concreta por la que el
plan exige la verificación en navegador además de los smoke tests.

## Verificación

- `node --check` sobre todos los `.js` nuevos/tocados.
- Regresión completa: se re-corrieron todos los smoke tests de fases
  anteriores (2a-2d de correcciones #12, puntos 1-5 de correcciones #13) —
  todos siguen pasando, confirmando que el cambio de
  `supervisor_asignaciones` no rompió la resolución asesor↔supervisor que ya
  usaban el buzón y el dashboard de Vales de Arte.
- **Smoke test nuevo** (`smoke-correcciones13-punto6.js`, 27 aserciones):
  CRUD de usuarios (incl. rechazo de correo duplicado, protección de la
  cuenta propia), CRUD de roles (protección de roles base, bloqueo de borrar
  un rol con usuarios), asignación de un supervisor a una tienda puntual y
  su efecto en `obtenerSupervisoresDeAsesor`/`listarAsesoresPorSupervisor`
  sin romper la cobertura por departamento ya existente, reordenar tiendas,
  código de tienda duplicado, activar/desactivar mantenimiento con
  contraseña correcta/incorrecta, listado de actividad.
- **`npm run dev` + navegador** (Claude in Chrome, login por fetch directo
  como `admin@munditrofeos.com`): confirmado que el admin cae directo en el
  panel (no en el dashboard de módulos); recorridas las 5 pestañas
  ejercitando sus acciones principales — crear un usuario Supervisor con
  tiendas puntuales (y ver el swap dinámico de tienda-única↔checklist según
  el rol elegido), editar ese mismo usuario y confirmar que las tiendas
  quedan pre-marcadas, ver/editar permisos de un rol agrupados por módulo,
  agregar un supervisor directo al personal de una tienda y verlo reflejado
  de inmediato en la cobertura de Vales de Arte, reordenar el catálogo de
  tiendas con las flechas y confirmar que persiste, crear una tienda nueva
  con departamento/subdivisión, y el ciclo completo de Modo Mantenimiento
  (contraseña incorrecta rechazada, activación bloquea a un Asesor de Ventas
  tanto en HTML como en `/api`, el admin sigue trabajando durante el
  bloqueo, desactivar restaura el acceso normal). Los dos hallazgos de la
  sección anterior se detectaron y corrigieron en este paso.

## No incluido en este alcance

- No se agregaron permisos nuevos — todo el panel se gatea con el
  `admin.ver` que ya existía.
- No se tocó `vale_documentos.es_modificacion` (finding pendiente de
  correcciones #12, sigue documentado-pero-sin-tocar).
- El commit/push de este trabajo se hace por separado, cuando el usuario lo
  pida explícitamente (no está incluido en la instrucción de "commitea antes
  del punto 6" del documento, que ya se cumplió para los puntos 1-5).
