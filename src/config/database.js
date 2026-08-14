// src/config/database.js
const mysql = require('mysql2/promise');
const config = require('./env');

let pool = null;
let useMock = false;

// Mock de base de datos en memoria si la conexión física falla
const mockDatabase = {
  usuarios: [
    {
      id: 1,
      nombre: 'Administrador General',
      email: 'admin@munditrofeos.com',
      password_hash: '$2a$10$P2N5e.5WlqL3Upt5C10Qe.R7tLdK.dGgX62G4x3T/j5gq.hR0yCme', // admin123
      rol_id: 1,
      activo: 1
    },
    {
      id: 2,
      nombre: 'Diseñador Creativo',
      email: 'diseno@munditrofeos.com',
      password_hash: '$2a$10$Uv0LqfEa2W2a3/ZgC3R7GOmB9wO3j2T.mUuUuFv3gq.hR0yCme', // diseno123
      rol_id: 2,
      activo: 1
    },
    {
      id: 3,
      nombre: 'Asesor Comercial',
      email: 'ventas@munditrofeos.com',
      password_hash: '$2a$10$c7CgqEa2W2a3/ZgC3R7GOmB9wO3j2T.mUuUuFv3gq.hR0yCme', // ventas123
      rol_id: 3,
      activo: 1
    }
  ],
  roles: [
    { id: 1, nombre: 'Administrador', descripcion: 'Acceso total a todos los módulos' },
    { id: 2, nombre: 'Diseñador', descripcion: 'Acceso a vales de arte y generador de prompts' },
    { id: 3, nombre: 'Asesor de Ventas', descripcion: 'Acceso a eventos y vales de arte' }
  ],
  permisos: [
    { id: 1, codigo: 'vales.ver', nombre: 'Ver Vales', modulo: 'vales' },
    { id: 2, codigo: 'vales.crear', nombre: 'Crear Vales', modulo: 'vales' },
    { id: 3, codigo: 'vales.editar', nombre: 'Editar Vales', modulo: 'vales' },
    { id: 4, codigo: 'prompts.ver', nombre: 'Ver Prompts', modulo: 'prompts' },
    { id: 5, codigo: 'prompts.crear', nombre: 'Crear Prompts', modulo: 'prompts' },
    { id: 6, codigo: 'eventos.ver', nombre: 'Ver Eventos', modulo: 'eventos' },
    { id: 7, codigo: 'eventos.crear', nombre: 'Crear Eventos', modulo: 'eventos' },
    { id: 8, codigo: 'admin.ver', nombre: 'Ver Admin', modulo: 'admin' }
  ],
  rol_permisos: [
    // Admin: todo
    { rol_id: 1, permiso_id: 1 }, { rol_id: 1, permiso_id: 2 }, { rol_id: 1, permiso_id: 3 },
    { rol_id: 1, permiso_id: 4 }, { rol_id: 1, permiso_id: 5 }, { rol_id: 1, permiso_id: 6 },
    { rol_id: 1, permiso_id: 7 }, { rol_id: 1, permiso_id: 8 },
    // Diseñador
    { rol_id: 2, permiso_id: 1 }, { rol_id: 2, permiso_id: 3 }, { rol_id: 2, permiso_id: 4 }, { rol_id: 2, permiso_id: 5 },
    // Ventas
    { rol_id: 3, permiso_id: 1 }, { rol_id: 3, permiso_id: 2 }, { rol_id: 3, permiso_id: 6 }, { rol_id: 3, permiso_id: 7 }
  ]
};

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
      queueLimit: 0
    });

    // Probar conexión rápida
    const conn = await pool.getConnection();
    console.log(`[Database] Conectado exitosamente a la base de datos MySQL en ${config.db.host}:${config.db.port}`);
    conn.release();
  } catch (error) {
    console.warn(`[Database] [WARNING] No se pudo conectar a la base de datos física: ${error.message}`);
    console.warn('[Database] [INFO] Activando fallback de base de datos en memoria (Modo Mock).');
    useMock = true;
  }
}

// Métodos de consulta compatibles para abstraer consultas SQL o Mock
async function query(sql, params = []) {
  if (useMock) {
    return handleMockQuery(sql, params);
  }
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.error(`[Database] Error ejecutando consulta SQL: ${sql}`, error);
    throw error;
  }
}

// Simulador rudimentario de consultas SQL necesarias para la autenticación y permisos
function handleMockQuery(sql, params) {
  const sqlNormalized = sql.toLowerCase().replace(/\s+/g, ' ');
  
  // Buscar usuario por email: SELECT * FROM usuarios WHERE email = ?
  if (sqlNormalized.includes('from usuarios') && sqlNormalized.includes('email =')) {
    const email = params[0];
    const user = mockDatabase.usuarios.find(u => u.email === email);
    return user ? [user] : [];
  }

  // Obtener permisos de rol: SELECT p.codigo, p.modulo FROM permisos p ... JOIN rol_permisos rp ... WHERE rp.rol_id = ?
  if (sqlNormalized.includes('rol_permisos') && sqlNormalized.includes('rol_id =')) {
    const rolId = params[0];
    const rpList = mockDatabase.rol_permisos.filter(rp => rp.rol_id === Number(rolId));
    const permissionIds = rpList.map(rp => rp.permiso_id);
    const matchedPerms = mockDatabase.permisos.filter(p => permissionIds.includes(p.id));
    return matchedPerms.map(p => ({ codigo: p.codigo, modulo: p.modulo }));
  }

  // Obtener rol por id
  if (sqlNormalized.includes('from roles') && sqlNormalized.includes('id =')) {
    const id = params[0];
    const rol = mockDatabase.roles.find(r => r.id === Number(id));
    return rol ? [rol] : [];
  }

  console.warn(`[Database Mock] Consulta no mapeada: "${sql}". Devolviendo array vacío.`);
  return [];
}

initializeDatabase();

module.exports = {
  query,
  getUseMock: () => useMock,
  isReady: () => pool !== null || useMock
};
