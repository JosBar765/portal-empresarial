// src/core/permissions/permissionMiddleware.js
const jwtHelper = require('../auth/jwtHelper');

/**
 * Middleware global para interceptar y verificar el token JWT.
 * El token es la única fuente de verdad para identificar al usuario.
 */
function authenticateJWT(req, res, next) {
  // Evitar almacenamiento en caché para prevenir "Sesión Cómplice" (Go Back en navegador)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  // Extraer token de las cookies o del encabezado de Autorización (Bearer)
  let token = req.cookies ? req.cookies.token : null;
  
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return handleUnauthorized(req, res);
  }

  const decoded = jwtHelper.verifyToken(token);
  if (!decoded) {
    // Si el token es inválido o expiró, limpiar la cookie y denegar
    res.clearCookie('token');
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
      error: `Acceso denegado. Se requiere el permiso: ${permissionCode}`
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

    // Permitir acceso directo si es Administrador (rol 1) o tiene asignado el módulo
    if (userModules.includes(moduleName) || req.user.rolId === 1) {
      return next();
    }

    return res.status(403).json({
      error: `Acceso denegado. No tienes acceso autorizado al módulo: ${moduleName}`
    });
  };
}

module.exports = {
  authenticateJWT,
  requireAuth,
  requirePermission,
  requireModule
};
