// src/modules/incidencias/repositories/personalRepository.js
// Quién atiende y quién verifica: técnicos (con las tiendas que cubren) y verificadores (por tienda o por país).
const db = require('../../../config/database');

// Condición «el técnico `?` cubre la tienda `col`». Un `?`: el id del técnico.
const condicionCobertura = (col) => `EXISTS (
  SELECT 1 FROM incidencia_tecnicos tc JOIN usuarios ut ON ut.id = tc.usuario_id AND ut.activo = 1
  WHERE tc.usuario_id = ? AND tc.activo = 1
    AND (tc.todas_las_tiendas = 1 OR EXISTS (SELECT 1 FROM incidencia_tecnico_tiendas tt WHERE tt.usuario_id = tc.usuario_id AND tt.tienda_id = ${col}))
)`;

// Condición «la tienda `col` está bajo la verificación del usuario `?`». Dos `?`: el mismo id dos veces.
// Reglas: el verificador de la tienda manda; sin uno propio vale el del país; y si no hay verificador alguno
// (ni de la tienda ni del país), cualquiera con el permiso puede verificar (la pantalla de Configuración avisa de eso).
const condicionVerificador = (col) => `(
  EXISTS (SELECT 1 FROM incidencia_verificadores v JOIN usuarios uv ON uv.id = v.usuario_id AND uv.activo = 1
          WHERE v.usuario_id = ? AND v.tienda_id = ${col})
  OR (
    NOT EXISTS (SELECT 1 FROM incidencia_verificadores v JOIN usuarios uv ON uv.id = v.usuario_id AND uv.activo = 1
                WHERE v.tienda_id = ${col})
    AND (
      EXISTS (SELECT 1 FROM incidencia_verificadores v JOIN tiendas tt ON tt.id = ${col} JOIN empresas ee ON ee.id = tt.empresa_id
              WHERE v.usuario_id = ? AND v.pais_id = ee.pais_id)
      OR NOT EXISTS (SELECT 1 FROM incidencia_verificadores v JOIN usuarios uv ON uv.id = v.usuario_id AND uv.activo = 1
                     JOIN tiendas tt ON tt.id = ${col} JOIN empresas ee ON ee.id = tt.empresa_id
                     WHERE v.pais_id = ee.pais_id)
    )
  )
)`;

class PersonalRepository {
  condicionCobertura(col) { return condicionCobertura(col); }
  condicionVerificador(col) { return condicionVerificador(col); }

  // ¿El técnico cubre la tienda? (la condición lleva primero el id del técnico y después la tienda)
  async tecnicoCubre(usuarioId, tiendaId, ejecutor = db) {
    const filas = await ejecutor.query(`SELECT 1 AS ok FROM DUAL WHERE ${condicionCobertura('?')}`, [usuarioId, tiendaId], 'incidencias_personal:tecnico_cubre');
    return filas.length > 0;
  }

  // ¿Esta tienda está bajo la verificación del usuario? (con la tienda como parámetro, la condición pide los ids en este orden)
  async verificaTienda(usuarioId, tiendaId, ejecutor = db) {
    const filas = await ejecutor.query(`SELECT 1 AS ok FROM DUAL WHERE ${condicionVerificador('?')}`,
      [usuarioId, tiendaId, tiendaId, tiendaId, usuarioId, tiendaId], 'incidencias_personal:verifica_tienda');
    return filas.length > 0;
  }

  // Técnicos activos que cubren la tienda; con `especialidadId`, solo los que la tienen.
  async tecnicosDeLaTienda(tiendaId, especialidadId = null) {
    const params = [tiendaId];
    let extra = '';
    if (especialidadId) { extra = ' AND EXISTS (SELECT 1 FROM incidencia_tecnico_especialidades te WHERE te.usuario_id = tc.usuario_id AND te.especialidad_id = ?)'; params.push(especialidadId); }
    const filas = await db.query(
      `SELECT tc.usuario_id AS id FROM incidencia_tecnicos tc JOIN usuarios u ON u.id = tc.usuario_id AND u.activo = 1
       WHERE tc.activo = 1 AND (tc.todas_las_tiendas = 1 OR EXISTS (SELECT 1 FROM incidencia_tecnico_tiendas tt WHERE tt.usuario_id = tc.usuario_id AND tt.tienda_id = ?))${extra}`,
      params, 'incidencias_personal:tecnicos_tienda');
    return filas.map(f => f.id);
  }

  // Quién verifica la tienda: los de la tienda; sin ninguno, los del país; sin ninguno, quienes tengan el permiso.
  async verificadoresDe(tiendaId) {
    const propios = await db.query(
      `SELECT DISTINCT u.id, u.nombre FROM incidencia_verificadores v JOIN usuarios u ON u.id = v.usuario_id AND u.activo = 1 WHERE v.tienda_id = ?`,
      [tiendaId], 'incidencias_personal:verificadores_tienda');
    if (propios.length) return { origen: 'tienda', personas: propios };
    const pais = await db.query(
      `SELECT DISTINCT u.id, u.nombre FROM incidencia_verificadores v JOIN usuarios u ON u.id = v.usuario_id AND u.activo = 1
       JOIN tiendas t ON t.id = ? JOIN empresas e ON e.id = t.empresa_id WHERE v.pais_id = e.pais_id`,
      [tiendaId], 'incidencias_personal:verificadores_pais');
    if (pais.length) return { origen: 'pais', personas: pais };
    const conPermiso = await db.query(
      `SELECT DISTINCT u.id, u.nombre FROM usuarios u JOIN rol_permisos rp ON rp.rol_id = u.rol_id
       JOIN permisos p ON p.id = rp.permiso_id AND p.codigo = 'incidencias.verificar' WHERE u.activo = 1`,
      [], 'incidencias_personal:verificadores_permiso');
    return { origen: conPermiso.length ? 'permiso' : null, personas: conPermiso };
  }

  async nombresDeUsuarios(ids) {
    if (!ids.length) return new Map();
    const filas = await db.query('SELECT id, nombre FROM usuarios WHERE id IN (?)', [ids], 'incidencias_personal:nombres');
    return new Map(filas.map(f => [f.id, f.nombre]));
  }

  // Un técnico registrado y activo (para reasignar): devuelve su fila o null.
  async tecnicoActivo(usuarioId, ejecutor = db) {
    const filas = await ejecutor.query(
      `SELECT tc.usuario_id AS id, u.nombre FROM incidencia_tecnicos tc JOIN usuarios u ON u.id = tc.usuario_id AND u.activo = 1
       WHERE tc.usuario_id = ? AND tc.activo = 1`, [usuarioId], 'incidencias_personal:tecnico_activo');
    return filas[0] || null;
  }

  async especialidadesDe(usuarioId) {
    const filas = await db.query('SELECT especialidad_id FROM incidencia_tecnico_especialidades WHERE usuario_id = ?', [usuarioId], 'incidencias_personal:especialidades');
    return filas.map(f => f.especialidad_id);
  }

  // Técnicos que cubren la tienda, para elegir a quién reasignar (con su carga abierta).
  async tecnicosParaReasignar(tiendaId) {
    return db.query(
      `SELECT tc.usuario_id AS id, u.nombre,
              (SELECT COUNT(*) FROM incidencias i WHERE i.tecnico_id = tc.usuario_id AND i.estado IN ('en_proceso','en_espera','correccion_pedida')) AS abiertas,
              (SELECT GROUP_CONCAT(e.nombre ORDER BY e.orden SEPARATOR ', ') FROM incidencia_tecnico_especialidades te JOIN incidencia_especialidades e ON e.id = te.especialidad_id WHERE te.usuario_id = tc.usuario_id) AS especialidades
       FROM incidencia_tecnicos tc JOIN usuarios u ON u.id = tc.usuario_id AND u.activo = 1
       WHERE tc.activo = 1 AND (tc.todas_las_tiendas = 1 OR EXISTS (SELECT 1 FROM incidencia_tecnico_tiendas tt WHERE tt.usuario_id = tc.usuario_id AND tt.tienda_id = ?))
       ORDER BY u.nombre`,
      [tiendaId], 'incidencias_personal:para_reasignar');
  }
}

module.exports = new PersonalRepository();
