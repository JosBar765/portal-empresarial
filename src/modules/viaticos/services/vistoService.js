// src/modules/viaticos/services/vistoService.js
// Quien autoriza o rechaza una solicitud debe haber abierto antes su documento (como en Vales de Arte).
const db = require('../../../config/database');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { idObligatorio } = require('../../../core/utils/validar');
const escrituraRepo = require('../repositories/solicitudEscrituraRepository');
const vistoRepo = require('../repositories/vistoRepository');
const { FASES, ROL_ADMINISTRADOR_ID, MOVIMIENTOS } = require('../constantes');
const { msg } = require('../mensajes');
const solicitudService = require('./solicitudService');
const movimientoService = require('./movimientoService');

const esAdministrador = usuario => usuario.rolId === ROL_ADMINISTRADOR_ID;

class VistoService {
  // Solo cuenta con la solicitud esperando autorización; la fila bloqueada evita registrarlo a mitad de una modificación.
  async marcarVisto(usuario, idCrudo) {
    const id = idObligatorio(idCrudo, 'Identificador de la solicitud');
    return db.transaccion(async tx => {
      const fila = await escrituraRepo.bloquearParaDecidir(id, tx);
      if (!fila) throw new ErrorDeNegocio(msg('solicitud.noExiste', { id }), 404);
      const pipeline = solicitudService.pipelineDe(fila, solicitudService.instante().hoy);
      if (pipeline.fase !== FASES.ESPERANDO) return { visto: false };
      // Solo la primera vez de cada persona deja movimiento; con la fila bloqueada, la comprobación previa no corre carrera.
      const primeraVez = !(await vistoRepo.existe(id, usuario.id, tx));
      await vistoRepo.registrar(id, usuario.id, tx);
      if (primeraVez) await movimientoService.registrar(MOVIMIENTOS.REVISADA, fila, usuario, {}, tx);
      return { visto: true };
    });
  }

  // Se llama con la fila ya bloqueada y dentro de la transacción de la decisión.
  async exigirVisto(usuario, id, correlativo, tx) {
    if (esAdministrador(usuario)) return;
    if (!(await vistoRepo.existe(id, usuario.id, tx))) {
      throw new ErrorDeNegocio(msg('gestion.debesVer', { correlativo }), 400);
    }
  }

  // Bandera `visto` de cada solicitud para quien consulta; el Administrador siempre cuenta como que ya la vio.
  async idsVistos(usuario, ids) {
    if (esAdministrador(usuario)) return new Set(ids.map(Number));
    return vistoRepo.idsVistos(usuario.id, ids.map(Number));
  }
}

module.exports = new VistoService();
