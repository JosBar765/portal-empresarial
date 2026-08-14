// src/app.js
const express = require('express');
const session = require('express-session');
const path = require('path');
const config = require('./config/env');
const authRoutes = require('./core/auth/authRoutes');
const { requireAuth } = require('./core/permissions/permissionMiddleware');

const app = express();

// Middlewares para parsear cuerpos de solicitudes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de Sesiones en memoria (desarrollo/hosting administrado sin Redis)
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.nodeEnv === 'production',
    maxAge: 1000 * 60 * 60 * 24 // 1 día
  }
}));

// Servir archivos estáticos del Frontend
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rutas de Autenticación (con soporte PHP-Legacy para compatibilidad)
app.use('/api/auth.php', authRoutes);
app.use('/api/auth', authRoutes);

// Endpoint dinámico de Módulos del Dashboard
app.get('/api/modules', requireAuth, (req, res) => {
  const user = req.session.user;
  const permissions = req.session.permissions || [];

  // Catálogo completo de módulos empresariales definidos en el portal
  const catalog = [
    {
      id: 'vales',
      nombre: 'Vales de Arte',
      descripcion: 'Gestión, creación y control de vales artísticos y órdenes de diseño.',
      icono: 'color-palette-outline',
      path: '/modules/vales',
      permission: 'vales.ver',
      color: '#1E3A5F'
    },
    {
      id: 'prompts',
      nombre: 'Generador de Prompts',
      descripcion: 'Creación y optimización de prompts estructurados para modelos de IA.',
      icono: 'chatbubbles-outline',
      path: '/modules/prompts',
      permission: 'prompts.ver',
      color: '#503300'
    },
    {
      id: 'eventos',
      nombre: 'Eventos y Carreras',
      descripcion: 'Logística, asignación y seguimiento de carreras deportivas en Centroamérica.',
      icono: 'flag-outline',
      path: '/modules/eventos',
      permission: 'eventos.ver',
      color: '#E85D04'
    },
    {
      id: 'admin',
      nombre: 'Administración Central',
      descripcion: 'Gestión de roles, permisos, usuarios y reportería del portal.',
      icono: 'settings-outline',
      path: '/modules/admin',
      permission: 'admin.ver',
      color: '#575E73'
    }
  ];

  // Filtrar módulos en base a los permisos del usuario
  // El Administrador (rol_id = 1) tiene acceso a todos los módulos automáticamente
  const userModules = catalog.filter(modulo => {
    return user.rolId === 1 || permissions.includes(modulo.permission);
  });

  return res.json(userModules);
});

// Redireccionar raíz del portal a la página de login o al dashboard según corresponda
app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard/');
  }
  return res.redirect('/login/');
});

// Rutas comodín de vistas de cliente estáticas
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login/index.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard/index.html'));
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('[Global Error Handler]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Ocurrió un error interno en el servidor.'
  });
});

module.exports = app;
