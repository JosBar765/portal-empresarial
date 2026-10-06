// src/app.js
const express = require('express');
const multer = require('multer');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config/env');
const authRoutes = require('./core/auth/authRoutes');
const tokenService = require('./core/auth/tokenService');
const { authenticateJWT, requireAuth, requirePermission, requireModuleAccess } = require('./core/permissions/permissionMiddleware');
const { MODULOS } = require('./core/permissions/modulesCatalog');
const maintenanceGate = require('./core/permissions/maintenanceMiddleware');
const valeRoutes = require('./modules/vales/routes');
const atrasoWatcher = require('./modules/vales/atrasoWatcher');
const vigenciaWatcher = require('./modules/vales/vigenciaWatcher');
const notificacionLimpieza = require('./core/notifications/notificacionLimpieza');
const adminRoutes = require('./modules/admin/routes');
const notificacionRoutes = require('./core/notifications/notificacionRoutes');
const { MENSAJE_INTERNO } = require('./core/utils/erroresHttp');

const app = express();

// Detrás del proxy inverso del hosting, req.ip es la IP del proxy salvo que se
// le indique cuántos saltos confiar (TRUST_PROXY; 0 = sin proxy): sin esto
// todos los clientes comparten IP en los limitadores de intentos.
if (config.trustProxy > 0) {
  app.set('trust proxy', config.trustProxy);
}

// Cabeceras de seguridad HTTP (X-Frame-Options, X-Content-Type-Options,
// etc.) — CSP desactivada por ahora: el frontend carga Ionicons y
// Socket.IO client desde rutas propias/CDN sin una política ya definida
// para ellas, y activar CSP con los defaults de Helmet sin esa revisión
// aparte podría bloquearlos.
app.use(helmet({ contentSecurityPolicy: false }));

// Middlewares para parsear cuerpos de solicitudes y cookies. Límite
// explícito de tamaño de body (el default de Express ya es 100kb, esto
// solo lo deja documentado) — los uploads de archivos van aparte, por
// multer, con su propio límite.
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));
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
// tokenService.autenticar cuenta como sesión viva también una que solo tiene
// refresh token válido (access vencido), para no mostrar el login a alguien
// que aún tiene sesión única activa.
app.use('/login', async (req, res, next) => {
  const decoded = await tokenService.autenticar(req, res);
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
app.get('/', async (req, res) => {
  const decoded = await tokenService.autenticar(req, res);

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
// Los adjuntos/PDFs de Vales de Arte ya no se sirven desde aquí — viven en
// Supabase Storage (bucket público), ver src/core/files/supabaseStorage.js.

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
// Cada módulo exige su permiso "ver" (mismo que lo muestra en el dashboard).
app.use('/modules', requireModuleAccess(MODULOS), express.static(path.join(__dirname, '../public/modules')));

// Rutas de API del módulo Vales de Arte
app.use('/api/vales', requireAuth, requirePermission('vales.ver'), valeRoutes);

// Rutas de API del panel de Administrador
app.use('/api/admin', requireAuth, requirePermission('admin.ver'), adminRoutes);

// Centro de notificaciones (de cualquier usuario autenticado, sin permiso de módulo)
app.use('/api/notificaciones', requireAuth, notificacionRoutes);

// Vigilante de atraso — corre en el mismo proceso (monolito modular), revisa
// cada 60s qué vales acaban de cruzar su fecha_entrega y dispara la alerta
// roja una sola vez por vale.
atrasoWatcher.iniciar();
vigenciaWatcher.iniciar();
notificacionLimpieza.iniciar();

// Endpoint dinámico de Módulos del Dashboard
app.get('/api/modules', requireAuth, (req, res) => {
  const user = req.user;
  const permissions = req.user.permissions || [];

  // Filtrar módulos en base a los permisos del usuario
  const userModules = MODULOS.filter(modulo => {
    return permissions.includes(modulo.permission);
  });

  return res.json(userModules);
});

// Manejo de errores con la subida de archivos
const MENSAJES_MULTER = {
  LIMIT_FILE_SIZE: 'El archivo adjunto supera el tamaño máximo permitido (3 MB).',
  LIMIT_FILE_COUNT: 'Se adjuntaron demasiados archivos.',
  LIMIT_UNEXPECTED_FILE: 'Se recibió un archivo en un campo inesperado.'
};
// Multer lanza LIMIT_UNEXPECTED_FILE también al pasar el máximo de un campo: se explica según el campo.
const MENSAJES_EXCESO_POR_CAMPO = {
  imagenes: 'Un vale admite hasta 10 imágenes.',
  documentos: 'Un vale admite hasta 5 documentos.',
  propuesta: 'Adjunta un solo archivo de propuesta.',
  fusion: 'Adjunta un solo documento de fusión.'
};

app.use((err, req, res, next) => {
  // Solo la pila (nombre, mensaje y líneas): el objeto completo de un error de
  // mysql2 incluye el SQL con los valores.
  console.error('[Global Error Handler]', (err && err.stack) || String(err));
  if (err instanceof multer.MulterError) {
    const mensaje = (err.code === 'LIMIT_UNEXPECTED_FILE' && MENSAJES_EXCESO_POR_CAMPO[err.field]) || MENSAJES_MULTER[err.code] || 'No se pudo procesar el archivo adjunto.';
    return res.status(400).json({ error: mensaje });
  }
  // Errores de lectura del cuerpo: mensaje fijo, sin el texto del analizador.
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la solicitud no es un JSON válido.' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'La solicitud es demasiado grande.' });
  }
  const status = err.status || 500;
  const mensaje = status < 500 ? 'No se pudo procesar la solicitud.' : MENSAJE_INTERNO;
  res.status(status).json({ error: mensaje });
});

module.exports = app;
