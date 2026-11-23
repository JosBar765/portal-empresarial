// src/modules/proyectos/repositories/aprobadorRepository.js
// SQL de quién aprueba la activación y quién da el visto bueno (`proy_aprobadores`).
const db = require('../../../config/database');

class AprobadorRepository {
  // Los pasos en los que una persona es aprobadora.
  async pasosDe(usuarioId) {
    const filas = await db.query('SELECT paso FROM proy_aprobadores WHERE usuario_id = ?', [usuarioId], 'proyectos_aprobadores:pasos');
    return filas.map(f => f.paso);
  }

  // Las personas activas asignadas a un paso (o a todos si no se indica).
  listar(paso = null) {
    return db.query(
      `SELECT a.paso, u.id, u.nombre, r.nombre AS rol FROM proy_aprobadores a
       JOIN usuarios u ON u.id = a.usuario_id AND u.activo = 1 LEFT JOIN roles r ON r.id = u.rol_id
       ${paso ? 'WHERE a.paso = ?' : ''} ORDER BY u.nombre`, paso ? [paso] : [], 'proyectos_aprobadores:listar'
    );
  }

  // Quienes pueden ser elegidos: personas activas con acceso al módulo.
  candidatos() {
    return db.query(
      `SELECT DISTINCT u.id, u.nombre, r.nombre AS rol FROM usuarios u
       JOIN rol_permisos rp ON rp.rol_id = u.rol_id JOIN permisos p ON p.id = rp.permiso_id AND p.codigo = 'proyectos.ver'
       LEFT JOIN roles r ON r.id = u.rol_id WHERE u.activo = 1 ORDER BY u.nombre`, [], 'proyectos_aprobadores:candidatos'
    );
  }

  async idsDe(paso) {
    return (await this.listar(paso)).map(f => f.id);
  }

  // Deja exactamente `usuarioIds` en el paso (dentro de la transacción `tx`).
  async reemplazar(tx, paso, usuarioIds, creadoPor) {
    await tx.query('DELETE FROM proy_aprobadores WHERE paso = ?', [paso], 'proyectos_aprobadores:borrar');
    for (const id of usuarioIds) {
      await tx.query('INSERT INTO proy_aprobadores (usuario_id, paso, creado_por) VALUES (?, ?, ?)', [id, paso, creadoPor], 'proyectos_aprobadores:agregar');
    }
  }
}

module.exports = new AprobadorRepository();
