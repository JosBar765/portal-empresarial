// Limpiezas que se aplican SOLO a DESTINO (staging) tras copiar producción. Para agregar una, suma un objeto a LIMPIEZAS.
// { nombre, sql: string | async (conn) => string, toleraTablaAusente, antes?: async (conn) => string }
const { ident } = require('./conexiones');

async function columnasExistentes(conn, tabla, candidatas) {
  const [rows] = await conn.query(
    'SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [tabla]
  );
  const existentes = new Set(rows.map(r => r.c));
  return candidatas.filter(c => existentes.has(c));
}

const LIMPIEZAS = [
  {
    nombre: 'mantenimiento_config: modo mantenimiento apagado',
    toleraTablaAusente: true,
    // En producción la migración de la cuenta regresiva puede no estar aplicada aún: solo se tocan las columnas que existen.
    sql: async conn => {
      const extra = await columnasExistentes(conn, 'mantenimiento_config', ['inicia_en', 'sesiones_cerradas_en']);
      const sets = ['activo = 0', ...extra.map(c => `${ident(c)} = NULL`)];
      return `UPDATE mantenimiento_config SET ${sets.join(', ')} WHERE id = 1`;
    },
    antes: async conn => {
      const [rows] = await conn.query('SELECT activo FROM mantenimiento_config WHERE id = 1');
      return rows.length ? `estaba ${Number(rows[0].activo) === 1 ? 'ACTIVO' : 'apagado'}` : 'sin fila id=1';
    }
  },
  {
    nombre: 'sesiones_activas: sesiones de producción eliminadas',
    toleraTablaAusente: true,
    sql: 'DELETE FROM sesiones_activas'
  }
];

async function ejecutarLimpiezas(conn) {
  for (const l of LIMPIEZAS) {
    try {
      const antes = l.antes ? await l.antes(conn) : null;
      const sql = typeof l.sql === 'function' ? await l.sql(conn) : l.sql;
      const [r] = await conn.query(sql);
      console.log(`[Refresco] Limpieza «${l.nombre}»: ${r.affectedRows} fila(s) afectada(s)${antes ? ` (${antes})` : ''}.`);
    } catch (error) {
      if (l.toleraTablaAusente && error.code === 'ER_NO_SUCH_TABLE') {
        console.log(`[Refresco] Limpieza «${l.nombre}»: la tabla no existe, se omite.`);
      } else {
        throw new Error(`Limpieza «${l.nombre}»: [${error.code || 'sin código'}] ${error.sqlMessage || error.message}`);
      }
    }
  }
}

module.exports = { LIMPIEZAS, ejecutarLimpiezas };
