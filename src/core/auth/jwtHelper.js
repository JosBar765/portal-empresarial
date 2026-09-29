// src/core/auth/jwtHelper.js
const jwt = require('jsonwebtoken');
const config = require('../../config/env');

/**
 * Genera un token JWT firmado.
 * @param {object} payload - Información de usuario a encapsular
 * @returns {string} Token firmado
 */
function generateToken(payload) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    algorithm: 'HS256'
  });
}

/**
 * Verifica y descodifica un token JWT.
 * @param {string} token - Token JWT a verificar
 * @returns {object|null} Payload decodificado o null si es inválido/expirado
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch (error) {
    // Si expira o la firma es inválida, se captura aquí
    return null;
  }
}

/**
 * Igual que verifyToken pero ignora la expiración: solo confirma que la firma
 * es nuestra. Para cerrar sesión con un access token ya vencido y para el
 * handshake del socket (donde se confirma aparte que la sesión siga viva).
 */
function verifyTokenIgnoreExpiry(token) {
  try {
    return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], ignoreExpiration: true });
  } catch (error) {
    return null;
  }
}

module.exports = {
  generateToken,
  verifyToken,
  verifyTokenIgnoreExpiry
};
