// src/config/env.js
const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'fallback_development_jwt_secret_123456_987654321',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'portal_empresarial'
  },
  // Solo almacenamiento (PDFs/imágenes de Vales de Arte) — la base de datos
  // de negocio del portal sigue siendo MySQL, nunca Supabase/Postgres.
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    bucket: process.env.SUPABASE_STORAGE_BUCKET || 'vales_de-arte'
  }
};

module.exports = config;
