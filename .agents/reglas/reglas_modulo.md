# Guía de Creación de Módulos (Backend & Frontend)

Esta guía explica detalladamente la convención estructural para agregar un nuevo módulo al portal de herramientas empresariales. Cada nueva herramienta debe desarrollarse de forma aislada e independiente en forma de un sub-módulo dentro del monolito modular.

---

## Estructura del Módulo en el Backend

El backend se encuentra dentro de `src/modules/`. Si vas a crear un módulo llamado `inventario`, debes crear la carpeta `src/modules/inventario/` con los siguientes archivos:

```text
src/modules/inventario/
├── controllers/
│   └── inventarioController.js  # Recibe peticiones HTTP, gestiona respuestas (delgado)
├── services/
│   └── inventarioService.js     # Contiene las reglas de negocio (grueso)
├── repositories/
│   └── inventarioRepository.js  # Acceso directo a base de datos (consultas SQL)
├── routes.js                    # Endpoints del módulo (api/inventario/*)
└── events.js                    # Lógica de sockets y eventos de tiempo real
```

### Código Plantilla de Ejemplo

#### 1. Rutas (`routes.js`)
```javascript
const express = require('express');
const router = express.Router();
const inventarioController = require('./controllers/inventarioController');
const { requirePermission } = require('../../core/permissions/permissionMiddleware');

// Montado en /api/inventario detrás de requireAuth e inventario.ver (ver src/app.js).
// Cada endpoint declara además su permiso de acción.
router.get('/', requirePermission('inventario.ver'), (req, res) => inventarioController.listar(req, res));
router.post('/', requirePermission('inventario.crear'), (req, res) => inventarioController.crear(req, res));

module.exports = router;
```

#### 2. Controlador (`controllers/inventarioController.js`)
```javascript
const inventarioService = require('../services/inventarioService');
const { responderError, responderErrorInterno } = require('../../../core/utils/erroresHttp');
const { idObligatorio } = require('../../../core/utils/validar');

class InventarioController {
  async listar(req, res) {
    try {
      const items = await inventarioService.obtenerTodo();
      return res.json(items);
    } catch (error) {
      return responderErrorInterno(res, error);
    }
  }

  async crear(req, res) {
    try {
      // La identidad sale siempre de req.user, nunca del body.
      const nuevoItem = await inventarioService.crearItem(req.body, req.user.id);
      return res.status(201).json(nuevoItem);
    } catch (error) {
      return responderError(res, error, 400);
    }
  }

  async obtener(req, res) {
    try {
      const item = await inventarioService.obtenerPorId(idObligatorio(req.params.id));
      return res.json(item);
    } catch (error) {
      return responderError(res, error, 404);
    }
  }
}

module.exports = new InventarioController();
```

`responderError` devuelve al cliente solo el mensaje de los errores de negocio; los internos (MySQL, Storage, bugs) salen como un 500 genérico y el detalle va al log. Nunca devuelvas `error.message` a mano. Un error de negocio con otro estado HTTP se lanza como `new ErrorDeNegocio(mensaje, status)` (`src/core/utils/erroresHttp.js`). No uses 401 para errores de negocio: `public/js/sessionGuard.js` lo trata como sesión vencida; usa 403.

#### 3. Servicio (`services/inventarioService.js`)
```javascript
const inventarioRepository = require('../repositories/inventarioRepository');
const socketManager = require('../../../core/websocket/socketManager');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');

class InventarioService {
  async obtenerTodo() {
    return await inventarioRepository.obtenerTodosLosProductos();
  }

  async obtenerPorId(id) {
    const producto = await inventarioRepository.obtenerPorId(id);
    if (!producto) throw new ErrorDeNegocio('El producto indicado no existe.', 404);
    return producto;
  }

  async crearItem(datos, usuarioId) {
    // Regla de negocio: Validar campos
    if (!datos.nombre || datos.stock < 0) {
      throw new ErrorDeNegocio('Datos de inventario inválidos.');
    }

    const productoCreado = await inventarioRepository.insertarProducto(datos, usuarioId);

    // Tiempo real: Emitir actualización a los clientes del módulo a través de WebSocket central
    socketManager.sendToModule('inventario', 'producto_agregado', productoCreado);

    return productoCreado;
  }
}

module.exports = new InventarioService();
```

#### 4. Repositorio (`repositories/inventarioRepository.js`)
```javascript
const db = require('../../../config/database');

// db.query(sql, params, tag): consultas parametrizadas; el tag ('modulo:accion') identifica la consulta en el log de errores.
class InventarioRepository {
  async obtenerTodosLosProductos() {
    return await db.query('SELECT * FROM inventario ORDER BY id DESC', [], 'inventario:listar');
  }

  async obtenerPorId(id) {
    const filas = await db.query('SELECT * FROM inventario WHERE id = ?', [id], 'inventario:obtenerPorId');
    return filas[0] || null;
  }

  async insertarProducto(producto, usuarioId) {
    const res = await db.query(
      'INSERT INTO inventario (nombre, stock, precio, creado_por) VALUES (?, ?, ?, ?)',
      [producto.nombre, producto.stock, producto.precio, usuarioId],
      'inventario:insertar'
    );
    return { id: res.insertId, ...producto };
  }
}

module.exports = new InventarioRepository();
```

---

## Registro del Módulo en el Sistema Central

Una vez creado tu módulo en backend, debes conectarlo en los siguientes tres puntos:

1. **Enrutado Global (`src/app.js`)**:
   Importa el router y móntalo **después** de `authenticateJWT` (todo lo que va después es protegido), con el permiso `ver` del módulo:
   ```javascript
   const inventarioRoutes = require('./modules/inventario/routes');
   // ...
   app.use('/api/inventario', requireAuth, requirePermission('inventario.ver'), inventarioRoutes);
   ```

2. **Catálogo de módulos (`src/core/permissions/modulesCatalog.js`)**:
   Agrega el módulo a `MODULOS`. Lo consumen `/api/modules` (el Dashboard lo lista solo, sin tocar su frontend) y el control de acceso a `/modules/<id>`, así que ambos dependen del mismo permiso `ver`:
   ```javascript
   {
     id: 'inventario',
     nombre: 'Gestión de Inventario',
     descripcion: 'Control de stocks, alertas de existencias y catálogo de productos.',
     icono: 'cube-outline',
     path: '/modules/inventario',
     permission: 'inventario.ver',
     color: '#8A4B3C'
   }
   ```
   El color es desaturado, de saturación moderada y distinto al de los demás módulos (ver `reglas_disenoUI.md` §2.6).

3. **Permisos en la base de datos**: los códigos `inventario.ver`, `inventario.crear`, etc. se agregan a `database/seed.sql` (instalaciones nuevas) y a un script idempotente `NN_tema.sql` en `database/migrations/` (bases que ya están en producción). Reglas en `reglas_archivosSQL.md`.

---

## Estructura del Módulo en el Frontend

El frontend de tu módulo debe colocarse bajo `public/modules/inventario/`:

```text
public/modules/inventario/
├── index.html       # Vista HTML del módulo
├── css/
│   └── styles.css   # Estilos CSS específicos (importando global.css)
└── js/
    └── app.js       # Scripts interactivos (integrados con websocket si se requiere)
```

El diseño empieza con un mockup en Figma aprobado por el dueño; no se escribe código de pantalla antes (`reglas_disenoUI.md`). El CSS importa `global.css` y no define colores de marca propios.

Si el JS del módulo se divide en módulos ES (`<script type="module">`, como en `vales` y `admin`), el HTML lleva los marcadores `<!-- importmap:inicio -->` y `<!-- importmap:fin -->`: `scripts/versionarEstaticos.js` (script `postinstall`) rellena entre ellos las versiones de los estáticos en los despliegues. No se quitan. Criterios para dividir el JS: `reglas_implementacion.md`.

En la vista HTML del módulo, puedes cargar `socket.io.js` y conectar con el backend transversal:
```html
<script src="/socket.io/socket.io.js"></script>
<script>
  const socket = io();
  socket.emit('register_module', 'inventario');
  socket.on('producto_agregado', (producto) => {
    console.log('Nuevo producto en tiempo real:', producto);
  });
</script>
```

## Documentación del módulo

Todo módulo nuevo se documenta en `.agents/modulos/<id>/`: un `README.md` (propósito, dependencias, dónde vive el código, reglas clave, índice) y una carpeta `documentacion/` con el detalle técnico. Se agrega una fila a la tabla de módulos de `CLAUDE.md` §9. Las reglas de negocio viven en esa documentación y se actualizan junto con el comportamiento.

## Entornos y acciones críticas

Toda acción del módulo que cambie algo fuera de la base de datos del entorno (borrar o reemplazar archivos, enviar correos o notificaciones, llamar a servicios de terceros, purgas automáticas) debe actuar **solo con `NODE_ENV=production`**. Las reglas, la forma de implementarlo y el inventario están en `.agents/reglas/reglas_entornos.md`.
