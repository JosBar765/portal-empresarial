// src/config/env.js
const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Sin JWT_SECRET no hay forma segura de firmar/verificar tokens — un
// fallback hardcodeado en el código (visible en el repositorio) permitiría
// forjar un JWT válido de cualquier usuario si esta variable llegara a
// faltar en producción. Mismo criterio fail-fast que ya usa database.js
// con la conexión a MySQL: mejor no arrancar que arrancar inseguro.
if (!process.env.JWT_SECRET) {
  console.error('[FATAL] Falta la variable de entorno JWT_SECRET — no se puede arrancar el servidor sin ella.');
  process.exit(1);
}

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  db: {
    host: process.env.DB_HOST || '',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || ''
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    secretKey: process.env.SUPABASE_SECRET_KEY || '',
    bucket: process.env.SUPABASE_STORAGE_BUCKET || ''
  }
};

module.exports = config;
