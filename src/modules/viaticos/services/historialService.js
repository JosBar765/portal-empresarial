// src/modules/viaticos/services/historialService.js
// Lectura del historial de movimientos de una solicitud que todavía existe (la ya borrada se consulta directo en la base).
const { idObligatorio } = require('../../../core/utils/validar');
const movimientoRepo = require('../repositories/movimientoRepository');
const solicitudService = require('./solicitudService');

class HistorialService {
  // 404 si la solicitud no existe: no se sirven los movimientos de una solicitud borrada.
  async listar(idCrudo) {
    const id = idObligatorio(idCrudo, 'Identificador de la solicitud');
    const solicitud = await solicitudService.leerEncabezado(id);
    const movimientos = await movimientoRepo.listarPorSolicitud(id);
    return {
      correlativo: solicitud.correlativo,
      movimientos: movimientos.map(m => ({ id: m.id, tipo: m.tipo, usuarioNombre: m.usuarioNombre, accion: m.accion, creadoEn: m.creadoEn }))
    };
  }
}

module.exports = new HistorialService();
