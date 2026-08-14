// src/core/auth/authController.js
const authService = require('./authService');

class AuthController {
  async handleQueryAction(req, res) {
    const action = req.query.action;
    
    switch (action) {
      case 'session_check':
        return this.sessionCheck(req, res);
      case 'csrf':
        return this.getCsrfToken(req, res);
      case 'login':
        // Si el cliente envía POST a api/auth.php?action=login
        return this.loginPost(req, res);
      case 'logout':
        return this.logout(req, res);
      default:
        return res.status(400).json({ error: 'Acción no válida o no especificada.' });
    }
  }

  async sessionCheck(req, res) {
    if (req.session && req.session.user) {
      return res.json({
        autenticado: true,
        user: req.session.user
      });
    }
    return res.json({ autenticado: false });
  }

  async getCsrfToken(req, res) {
    // Generar un token CSRF simulado para cumplir con el contrato de la interfaz original
    if (!req.session.csrfToken) {
      req.session.csrfToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    return res.json({ csrf_token: req.session.csrfToken });
  }

  async loginPost(req, res) {
    const { email, password, csrf_token } = req.body;

    // Si viene por query action login, también se captura aquí
    if (req.session.csrfToken && csrf_token !== req.session.csrfToken) {
      // Omitir validación estricta de CSRF en desarrollo si no está inicializada la sesión de token
      if (req.session.csrfToken) {
        return res.status(400).json({ error: 'Token de seguridad inválido. Recarga la página.' });
      }
    }

    try {
      const authData = await authService.authenticate(email, password);
      
      // Guardar en sesión de Express
      req.session.user = authData.user;
      req.session.permissions = authData.permissions;
      
      return res.json({
        ok: true,
        message: 'Autenticación exitosa',
        user: authData.user
      });
    } catch (error) {
      return res.status(401).json({
        ok: false,
        error: error.message || 'Credenciales incorrectas.'
      });
    }
  }

  async logout(req, res) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'No se pudo cerrar la sesión.' });
      }
      res.clearCookie('connect.sid');
      return res.json({ ok: true, message: 'Sesión cerrada correctamente.' });
    });
  }
}

module.exports = new AuthController();
