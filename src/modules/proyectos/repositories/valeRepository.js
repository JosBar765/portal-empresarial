// src/modules/proyectos/repositories/valeRepository.js
// Vínculo entre un vale de arte y la empresa de un asesor. Son las únicas consultas de Proyectos sobre la tabla `vales`
// (solo lectura: de quién es el vale y cuál es su correlativo). Todo el SQL vive aquí.
const db = require('../../../config/database');

class ValeRepository {
  async vale(id) {
    const filas = await db.query('SELECT id, correlativo, asesor_id FROM vales WHERE id = ?', [id], 'proyectos_vales:vale');
    return filas[0] || null;
  }

  async vinculo(valeId) {
    const filas = await db.query('SELECT participacion_id FROM proy_vales WHERE vale_id = ?', [valeId], 'proyectos_vales:vinculo');
    return filas[0] || null;
  }

  async insertar(tx, { participacionId, valeId, usuarioId }) {
    await tx.query('INSERT INTO proy_vales (participacion_id, vale_id, vinculado_por) VALUES (?, ?, ?)', [participacionId, valeId, usuarioId], 'proyectos_vales:insertar');
  }
}

module.exports = new ValeRepository();
