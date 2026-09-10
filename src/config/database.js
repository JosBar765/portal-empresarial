// src/config/database.js
const mysql = require('mysql2/promise');
const config = require('./env');

let pool = null;

async function initializeDatabase() {
  try {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true
    });

    // Fija la sesión de cada conexión del pool a UTC-6, sin importar qué
    // time_zone tenga configurado el servidor MySQL — necesario para que
    // CURRENT_TIMESTAMP/NOW() den la hora de Guatemala igual en XAMPP local
    // que en un host administrado (Hostinger) donde no se controla la
    // configuración global de MySQL.
    pool.on('connection', (conn) => {
      conn.query("SET time_zone = '-06:00'");
    });

    // Probar conexión rápida
    const conn = await pool.getConnection();
    console.log(`[Database] Conectado exitosamente a la base de datos MySQL en ${config.db.host}:${config.db.port}`);
    conn.release();
  } catch (error) {
    console.error(`[Database] [FATAL] No se pudo conectar a la base de datos MySQL en ${config.db.host}:${config.db.port}/${config.db.database}: ${error.message}`);
    console.error('[Database] [FATAL] El servidor requiere una conexión a MySQL para funcionar — no hay fallback. Deteniendo el proceso.');
    process.exit(1);
  }
}

async function query(sql, params = [], tag = null) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.error(`[Database] Error ejecutando consulta SQL: ${sql}`, error);
    throw error;
  }
}

const listo = initializeDatabase();

module.exports = {
  query,
  isReady: () => pool !== null,
  listo
};
