// src/modules/viaticos/repositories/personaRepository.js
// Usuarios con su licencia (viaticos_licencias) y sus países (viaticos_usuario_paises).
const db = require('../../../config/database');
const { filasACamel } = require('../utilidades');

const SELECT_LICENCIA = `SELECT l.usuario_id, l.tipo_licencia_id, tl.codigo AS tipo_licencia_codigo,
       tl.nombre AS tipo_licencia_nombre, l.numero, l.vence_el
  FROM viaticos_licencias l
  JOIN viaticos_tipos_licencia tl ON tl.id = l.tipo_licencia_id`;

const SELECT_PAISES = `SELECT up.usuario_id, p.id, p.codigo, p.nombre
  FROM viaticos_usuario_paises up
  JOIN paises p ON p.id = up.pais_id`;

class PersonaRepository {
  async listarUsuariosActivos() {
    return filasACamel(await db.query(
      `SELECT u.id, u.nombre, u.email, r.nombre AS rol
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
       WHERE u.activo = 1 ORDER BY u.nombre`,
      [], 'viaticos:listarPersonas'
    ));
  }

  async obtenerUsuarioActivo(id, ejecutor = db) {
    const filas = await ejecutor.query(
      `SELECT u.id, u.nombre, u.email, r.nombre AS rol
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
       WHERE u.id = ? AND u.activo = 1`,
      [id], 'viaticos:obtenerPersona'
    );
    return filas[0] ? filasACamel(filas)[0] : null;
  }

  async listarLicencias() {
    return filasACamel(await db.query(SELECT_LICENCIA, [], 'viaticos:listarLicencias'));
  }

  async obtenerLicencia(usuarioId, ejecutor = db) {
    const filas = await ejecutor.query(`${SELECT_LICENCIA} WHERE l.usuario_id = ?`, [usuarioId], 'viaticos:obtenerLicencia');
    return filas[0] ? filasACamel(filas)[0] : null;
  }

  async listarPaisesDeTodos() {
    return filasACamel(await db.query(`${SELECT_PAISES} ORDER BY p.nombre`, [], 'viaticos:listarPaisesPersonas'));
  }

  async listarPaisesDe(usuarioId, ejecutor = db) {
    return filasACamel(await ejecutor.query(`${SELECT_PAISES} WHERE up.usuario_id = ? ORDER BY p.nombre`, [usuarioId], 'viaticos:paisesDeUsuario'));
  }

  async guardarLicencia(usuarioId, { tipoLicenciaId, numero, venceEl }, tx) {
    await tx.query(
      `INSERT INTO viaticos_licencias (usuario_id, tipo_licencia_id, numero, vence_el) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE tipo_licencia_id = VALUES(tipo_licencia_id), numero = VALUES(numero), vence_el = VALUES(vence_el)`,
      [usuarioId, tipoLicenciaId, numero, venceEl], 'viaticos:guardarLicencia'
    );
  }

  async quitarLicencia(usuarioId, tx) {
    await tx.query('DELETE FROM viaticos_licencias WHERE usuario_id = ?', [usuarioId], 'viaticos:quitarLicencia');
  }

  // Reemplazo completo de la lista de países del usuario.
  async reemplazarPaises(usuarioId, paisIds, tx) {
    await tx.query('DELETE FROM viaticos_usuario_paises WHERE usuario_id = ?', [usuarioId], 'viaticos:quitarPaises');
    if (paisIds.length === 0) return;
    await tx.query(
      'INSERT INTO viaticos_usuario_paises (usuario_id, pais_id) VALUES ?',
      [paisIds.map(paisId => [usuarioId, paisId])], 'viaticos:guardarPaises'
    );
  }
}

module.exports = new PersonaRepository();
