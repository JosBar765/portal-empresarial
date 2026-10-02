// src/core/permissions/permissionMiddleware.js
const path = require('path');
const jwtHelper = require('../auth/jwtHelper');
const tokenService = require('../auth/tokenService');

/**
 * Middleware global para interceptar y verificar el token JWT.
 * El token es la única fuente de verdad para identificar al usuario.
 */
async function authenticateJWT(req, res, next) {
  // Evitar almacenamiento en caché para prevenir "Sesión Cómplice" (Go Back en navegador)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  // Access token de la cookie; si venció, autenticar() lo renueva solo con el
  // refresh token (y fija las cookies nuevas en esta misma respuesta).
  let decoded = await tokenService.autenticar(req, res);

  // Cabecera Bearer: solo para clientes no-navegador; no se renueva.
  if (!decoded && !(req.cookies && req.cookies[tokenService.REFRESH_COOKIE]) && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      decoded = jwtHelper.verifyToken(parts[1]);
    }
  }

  if (!decoded) {
    tokenService.limpiarCookies(res);
    return handleUnauthorized(req, res);
  }

  // Adjuntar el usuario decodificado al objeto req.
  // Esto es la ÚNICA fuente de verdad, impidiendo suplantación.
  req.user = decoded;

  next();
}

/**
 * Maneja la redirección o respuesta 401 si no hay sesión activa.
 */
function handleUnauthorized(req, res) {
  const isApiRequest = req.originalUrl.startsWith('/api') || req.path.startsWith('/api');
  
  if (isApiRequest) {
    return res.status(401).json({
      error: 'Sesión no válida o expirada. Por favor, inicia sesión de nuevo.'
    });
  }
  
  // Si intenta acceder a una vista/página, redirigir inmediatamente al login (302)
  return res.redirect('/login/?expired=true');
}

/**
 * Middleware para asegurar que el usuario ha pasado por authenticateJWT.
 */
function requireAuth(req, res, next) {
  if (req.user) {
    return next();
  }
  return handleUnauthorized(req, res);
}

/**
 * Middleware para requerir un permiso específico.
 * @param {string} permissionCode 
 */
function requirePermission(permissionCode) {
  return (req, res, next) => {
    if (!req.user) {
      return handleUnauthorized(req, res);
    }

    const userPermissions = req.user.permissions || [];
    
    // Verificar si el usuario cuenta con el permiso requerido
    if (userPermissions.includes(permissionCode)) {
      return next();
    }

    return res.status(403).json({
      error: 'No tienes permiso para realizar esta acción.'
    });
  };
}

/**
 * Middleware para requerir acceso a un módulo específico.
 * @param {string} moduleName 
 */
function requireModule(moduleName) {
  return (req, res, next) => {
    if (!req.user) {
      return handleUnauthorized(req, res);
    }

    const userModules = req.user.modulosPermitidos || [];

    // Permitir si tiene asignado el módulo
    if (userModules.includes(moduleName)) {
      return next();
    }

    return res.status(403).json({
      error: 'No tienes acceso a este módulo.'
    });
  };
}

// Ruta ya decodificada y normalizada, en minúsculas. El servidor de estáticos
// decodifica (%76ales → vales), colapsa ./ // y ../ e ignora mayúsculas según
// el sistema de archivos: si el gate comparara la ruta cruda, /modules/%76ales/,
// /modules/./vales/ o /modules/VALES/ llegarían al módulo sin pasar por él.
// Devuelve null si la ruta no se puede interpretar (se rechaza).
function rutaDeModuloNormalizada(rutaCruda) {
  let ruta;
  try {
    ruta = decodeURIComponent(rutaCruda);
  } catch {
    return null;
  }
  if (ruta.includes('\0')) return null;
  return path.posix.normalize(ruta.replace(/\\/g, '/')).toLowerCase();
}

// Primer segmento de la ruta sin puntos ni espacios finales (Windows los
// ignora al abrir el archivo: "vales." equivale a "vales").
function segmentoDeModulo(rutaNormalizada) {
  const primero = rutaNormalizada.split('/').filter(Boolean)[0] || '';
  return primero.replace(/[. ]+$/, '');
}

/**
 * Gate de acceso a las vistas de cada módulo (/modules/<id>/...). Si el
 * usuario no tiene el permiso "ver" del módulo, la página lo devuelve a su
 * dashboard y cualquier otro recurso del módulo (JS/CSS) responde 403.
 * Rutas que no correspondan a un módulo del catálogo pasan tal cual.
 * @param {Array<{id: string, permission: string}>} catalogo
 */
function requireModuleAccess(catalogo) {
  return (req, res, next) => {
    if (!req.user) {
      return handleUnauthorized(req, res);
    }
    const ruta = rutaDeModuloNormalizada(req.path);
    if (ruta === null) {
      return res.status(400).json({ error: 'Ruta inválida.' });
    }
    const id = segmentoDeModulo(ruta);
    const modulo = catalogo.find(m => m.id === id);
    if (!modulo || (req.user.permissions || []).includes(modulo.permission)) {
      return next();
    }
    const esPagina = !/\.[a-z0-9]+$/i.test(ruta) || ruta.endsWith('.html');
    if (esPagina) {
      // ?vista=modulos evita que el Administrador rebote de vuelta a su panel.
      return res.redirect('/dashboard/?vista=modulos');
    }
    return res.status(403).json({ error: 'No tienes acceso a este módulo.' });
  };
}

module.exports = {
  authenticateJWT,
  requireAuth,
  requirePermission,
  requireModule,
  requireModuleAccess
};
