// src/app.js
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config/env');
const authRoutes = require('./core/auth/authRoutes');
const jwtHelper = require('./core/auth/jwtHelper');
const { authenticateJWT, requireAuth } = require('./core/permissions/permissionMiddleware');
const maintenanceGate = require('./core/permissions/maintenanceMiddleware');
const valeRoutes = require('./modules/vales/routes');
const atrasoWatcher = require('./modules/vales/atrasoWatcher');
const adminRoutes = require('./modules/admin/routes');

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

// Si ya hay una sesión válida, /login redirige al dashboard en vez de
// mostrar el formulario — corre antes del estático para cubrir también
// /login/index.html servido directo (mismo patrón que GET '/' más abajo).
// El Administrador cae al panel en vez del dashboard de módulos — es su
// "inicio".
app.use('/login', (req, res, next) => {
  const token = req.cookies ? req.cookies.token : null;
  const decoded = token ? jwtHelper.verifyToken(token) : null;
  if (decoded) {
    return res.redirect(decoded.rolId === 1 ? '/modules/admin/' : '/dashboard/');
  }
  next();
});
app.use('/login', express.static(path.join(__dirname, '../public/login')));

// Rutas de API de autenticación (los endpoints internos deciden si requieren token)
app.use('/api/auth.php', authRoutes);
app.use('/api/auth', authRoutes);

// Redireccionar raíz del portal a la página de login o al dashboard según corresponda
app.get('/', (req, res) => {
  const token = req.cookies ? req.cookies.token : null;
  const decoded = token ? jwtHelper.verifyToken(token) : null;

  if (decoded) {
    return res.redirect(decoded.rolId === 1 ? '/modules/admin/' : '/dashboard/');
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

// Gate de Modo Mantenimiento — corre justo después de establecerse req.user,
// antes de cualquier recurso protegido.
app.use(maintenanceGate);

// -------------------------------------------------------------------------
// 3. Recursos Protegidos (Requieren JWT válido, interceptados por authenticateJWT)
// -------------------------------------------------------------------------
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// El Administrador tiene su propio panel en vez del dashboard de módulos —
// si escribe /dashboard/ a mano, se le redirige al panel salvo que pida
// explícitamente ver los módulos.
app.use('/dashboard', (req, res, next) => {
  if (req.user.rolId === 1 && req.query.vista !== 'modulos') {
    return res.redirect('/modules/admin/');
  }
  next();
});

// Servir la carpeta de vistas protegidas del dashboard
app.use('/dashboard', express.static(path.join(__dirname, '../public/dashboard')));

// Servir la carpeta de vistas protegidas de cada módulo
app.use('/modules', express.static(path.join(__dirname, '../public/modules')));

// Rutas de API del módulo Vales de Arte
app.use('/api/vales', requireAuth, valeRoutes);

// Rutas de API del panel de Administrador
app.use('/api/admin', requireAuth, adminRoutes);

// Vigilante de atraso — corre en el mismo proceso (monolito modular), revisa
// cada 60s qué vales acaban de cruzar su fecha_entrega y dispara la alerta
// roja una sola vez por vale.
atrasoWatcher.iniciar();

// Endpoint dinámico de Módulos del Dashboard
app.get('/api/modules', requireAuth, (req, res) => {
  const user = req.user;
  const permissions = req.user.permissions || [];

  // Catálogo completo de módulos empresariales definidos en el portal.
  const catalog = [
    {
      id: 'vales',
      nombre: 'Vales de Arte',
      descripcion: 'Gestión, creación y control de vales artísticos y órdenes de diseño.',
      icono: 'color-palette-outline',
      path: '/modules/vales',
      permission: 'vales.ver',
      color: '#3B4C8C'
    },
    {
      id: 'admin',
      nombre: 'Administración Central',
      descripcion: 'Gestión de roles, permisos, usuarios y reportería del portal.',
      icono: 'settings-outline',
      path: '/modules/admin',
      permission: 'admin.ver',
      color: '#52525B'
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
