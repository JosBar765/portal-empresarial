// src/app.js
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config/env');
const authRoutes = require('./core/auth/authRoutes');
const jwtHelper = require('./core/auth/jwtHelper');
const { authenticateJWT, requireAuth } = require('./core/permissions/permissionMiddleware');
const valeRoutes = require('./modules/vales/routes');

const app = express();

// Middlewares para parsear cuerpos de solicitudes y cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// -------------------------------------------------------------------------
// 1. Recursos Públicos (No requieren sesión activa)
// -------------------------------------------------------------------------
app.use('/assets', express.static(path.join(__dirname, '../public/assets')));
app.use('/css', express.static(path.join(__dirname, '../public/css')));
app.use('/js', express.static(path.join(__dirname, '../public/js')));
app.use('/login', express.static(path.join(__dirname, '../public/login')));

// Rutas de API de autenticación (los endpoints internos deciden si requieren token)
app.use('/api/auth.php', authRoutes);
app.use('/api/auth', authRoutes);

// Redireccionar raíz del portal a la página de login o al dashboard según corresponda
app.get('/', (req, res) => {
  const token = req.cookies ? req.cookies.token : null;
  const decoded = token ? jwtHelper.verifyToken(token) : null;
  
  if (decoded) {
    return res.redirect('/dashboard/');
  }
  return res.redirect('/login/');
});

// Redireccionamiento explícito para evitar loops o accesos extraños a la carpeta /login
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login/index.html'));
});

// -------------------------------------------------------------------------
// 2. Interceptor de Seguridad Global (JWT como Única Fuente de Verdad)
// -------------------------------------------------------------------------
app.use(authenticateJWT);

// -------------------------------------------------------------------------
// 3. Recursos Protegidos (Requieren JWT válido, interceptados por authenticateJWT)
// -------------------------------------------------------------------------
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Servir la carpeta de vistas protegidas del dashboard
app.use('/dashboard', express.static(path.join(__dirname, '../public/dashboard')));

// Servir la carpeta de vistas protegidas de cada módulo
app.use('/modules', express.static(path.join(__dirname, '../public/modules')));

// Rutas de API del módulo Vales de Arte
app.use('/api/vales', requireAuth, valeRoutes);

// Endpoint dinámico de Módulos del Dashboard
app.get('/api/modules', requireAuth, (req, res) => {
  const user = req.user;
  const permissions = req.user.permissions || [];

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

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('[Global Error Handler]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Ocurrió un error interno en el servidor.'
  });
});

module.exports = app;
