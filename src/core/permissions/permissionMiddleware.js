// src/core/permissions/permissionMiddleware.js

/**
 * Middleware para asegurar que el usuario ha iniciado sesión.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({
    error: 'No autorizado. Por favor, inicia sesión.'
  });
}

/**
 * Middleware para requerir un permiso específico.
 * @param {string} permissionCode 
 */
function requirePermission(permissionCode) {
  return (req, res, next) => {
    // Primero validar autenticación
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'No autorizado. Por favor, inicia sesión.' });
    }

    const userPermissions = req.session.permissions || [];
    
    // Verificar si el usuario cuenta con el código de permiso especificado
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
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'No autorizado. Por favor, inicia sesión.' });
    }

    const userModules = req.session.user.modulosPermitidos || [];

    if (userModules.includes(moduleName) || req.session.user.rolId === 1) {
      return next();
    }

    return res.status(403).json({
      error: `Acceso denegado. No tienes acceso asignado al módulo: ${moduleName}`
    });
  };
}

module.exports = {
  requireAuth,
  requirePermission,
  requireModule
};
