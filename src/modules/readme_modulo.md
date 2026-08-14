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

// Validar permisos a nivel de ruta de la API
router.get('/', requirePermission('inventario.ver'), (req, res) => inventarioController.listar(req, res));
router.post('/', requirePermission('inventario.crear'), (req, res) => inventarioController.crear(req, res));

module.exports = router;
```

#### 2. Controlador (`controllers/inventarioController.js`)
```javascript
const inventarioService = require('../services/inventarioService');

class InventarioController {
  async listar(req, res) {
    try {
      const items = await inventarioService.obtenerTodo();
      return res.json(items);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async crear(req, res) {
    try {
      const nuevoItem = await inventarioService.crearItem(req.body);
      return res.status(201).json(nuevoItem);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new InventarioController();
```

#### 3. Servicio (`services/inventarioService.js`)
```javascript
const inventarioRepository = require('../repositories/inventarioRepository');
const socketManager = require('../../core/websocket/socketManager');

class InventarioService {
  async obtenerTodo() {
    return await inventarioRepository.obtenerTodosLosProductos();
  }

  async crearItem(datos) {
    // Regla de negocio: Validar campos
    if (!datos.nombre || datos.stock < 0) {
      throw new Error('Datos de inventario inválidos.');
    }
    
    const productoCreado = await inventarioRepository.insertarProducto(datos);

    // Tiempo real: Emitir actualización a los clientes del módulo a través de WebSocket central
    socketManager.sendToModule('inventario', 'producto_agregado', productoCreado);

    return productoCreado;
  }
}

module.exports = new InventarioService();
```

#### 4. Repositorio (`repositories/inventarioRepository.js`)
```javascript
const db = require('../../config/database');

class InventarioRepository {
  async obtenerTodosLosProductos() {
    return await db.query('SELECT * FROM inventario ORDER BY id DESC');
  }

  async insertarProducto(producto) {
    const res = await db.query(
      'INSERT INTO inventario (nombre, stock, precio) VALUES (?, ?, ?)',
      [producto.nombre, producto.stock, producto.precio]
    );
    return { id: res.insertId, ...producto };
  }
}

module.exports = new InventarioRepository();
```

---

## Registro del Módulo en el Sistema Central

Una vez creado tu módulo en backend, debes conectarlo en los siguientes dos puntos:

1. **Enrutado Global (`src/app.js`)**:
   Importa e inicializa las rutas del módulo:
   ```javascript
   const inventarioRoutes = require('./modules/inventario/routes');
   // ...
   app.use('/api/inventario', requireAuth, inventarioRoutes);
   ```

2. **Menú Dinámico del Dashboard (`src/app.js`)**:
   Agrega el módulo al catálogo dentro de la API `/api/modules` para que el frontend lo liste automáticamente:
   ```javascript
   {
     id: 'inventario',
     nombre: 'Gestión de Inventario',
     descripcion: 'Control de stocks, alertas de existencias y catálogo de productos.',
     icono: 'cube-outline',
     path: '/modules/inventario',
     permission: 'inventario.ver',
     color: '#BA1A1A'
   }
   ```

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
