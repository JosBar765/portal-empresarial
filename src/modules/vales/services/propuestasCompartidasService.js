// src/modules/vales/services/propuestasCompartidasService.js
// Propuestas aprobadas visibles entre talleres de un mismo vale. Regla única (`hermanosDe`): se ve a otro taller solo si
// ambos tienen `talleres.comparte_propuestas = 1`; se evalúa al leer.
const tallerRepository = require('../repositories/tallerRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const propuestaRepository = require('../repositories/propuestaRepository');
const repo = require('../repositories/propuestaCompartidaRepository');
const valeCatalogoService = require('./valeCatalogoService');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { ROL, ESTADOS_TALLER, esDeTaller, esTallerODisenador } = require('./valeHelpers');

// Filas hermanas de `tallerId`: las demás filas que comparten, solo si la propia también comparte.
function hermanosDe(filasQueComparten, tallerId) {
  if (!tallerId || !filasQueComparten.some(f => f.taller_id === tallerId)) return [];
  return filasQueComparten.filter(f => f.taller_id !== tallerId);
}

class PropuestasCompartidasService {
  hermanosDe(filas, tallerId) { return hermanosDe(filas, tallerId); }

  // Taller del usuario: encargado/asistente por el encargado efectivo, diseñador por `taller_disenadores`.
  async tallerIdDe(usuario) {
    if (esDeTaller(usuario)) {
      const talleres = await tallerRepository.listarActivos();
      const idEfectivo = await valeCatalogoService.idEncargadoEfectivo(usuario);
      const propio = talleres.find(t => t.encargado_id === idEfectivo);
      return propio ? propio.id : null;
    }
    if (usuario.rolId === ROL.DISENADOR) {
      const disenador = await usuarioValeRepository.obtenerPorId(usuario.id);
      return disenador && disenador.taller_id ? disenador.taller_id : null;
    }
    return null;
  }

  // Filas hermanas del usuario en el vale (vacío para quien no es de taller/diseñador).
  async _hermanosDelUsuario(usuario, valeId) {
    if (!esTallerODisenador(usuario)) return [];
    const tallerId = await this.tallerIdDe(usuario);
    if (!tallerId) return [];
    return hermanosDe(await repo.listarFilasQueComparten(valeId), tallerId);
  }

  async _ultimaAprobada(valeId, fila) {
    if (fila.estado !== ESTADOS_TALLER.APROBADO || !fila.disenador_id) return null;
    return propuestaRepository.obtenerUltimaPorValeYDisenador(valeId, fila.disenador_id);
  }

  async obtenerParaDetalle(usuario, valeId) {
    const hermanos = await this._hermanosDelUsuario(usuario, valeId);
    if (!hermanos.length) return [];
    const vistos = await repo.listarVistos(usuario.id, valeId);
    const propuestas = await Promise.all(hermanos.map(f => this._ultimaAprobada(valeId, f)));
    const enlaces = await propuestaRepository.listarEnlacesPorPropuestas(propuestas.filter(Boolean).map(p => p.id));
    return hermanos.map((f, i) => {
      const p = propuestas[i];
      const base = { tallerId: f.taller_id, tallerNombre: f.taller_nombre };
      if (!p) return { ...base, estado: 'EN_TRABAJO', propuesta: null, visto: true };
      return {
        ...base, estado: 'APROBADO', visto: vistos.get(f.taller_id) === p.id,
        propuesta: {
          url: p.url || null, nota: p.nota || null, fecha: p.creado_en,
          enlaces: enlaces.filter(e => e.propuesta_id === p.id).map(e => ({ nombre: e.nombre, url: e.url }))
        }
      };
    });
  }

  async marcarVisto(usuario, valeId, tallerOrigenId) {
    const hermanos = await this._hermanosDelUsuario(usuario, valeId);
    const origen = hermanos.find(f => f.taller_id === tallerOrigenId);
    if (!origen) throw new ErrorDeNegocio('No tienes acceso a la propuesta de ese taller.', 403);
    const p = await this._ultimaAprobada(valeId, origen);
    if (!p) throw new ErrorDeNegocio('Ese taller aún no tiene una propuesta aprobada.');
    await repo.registrarVisto(usuario.id, valeId, tallerOrigenId, p.id);
    return { ok: true };
  }

  // Salas a avisar cuando `tallerAprobadoId` aprueba: encargado y asistentes (sala del taller) y el diseñador asignado de cada hermano.
  async salasDeAviso(valeId, tallerAprobadoId) {
    const hermanos = hermanosDe(await repo.listarFilasQueComparten(valeId), tallerAprobadoId);
    return hermanos.flatMap(f => [`taller:${f.taller_id}`, ...(f.disenador_id ? [`disenador:${f.disenador_id}`] : [])]);
  }

  // Ids de vales con propuesta de otro taller sin ver para el usuario (encargado/asistente del taller, o diseñador asignado).
  async valesConPropuestaNueva(usuario, valeIds) {
    if (!valeIds.length || !esTallerODisenador(usuario)) return new Set();
    const tallerId = await this.tallerIdDe(usuario);
    if (!tallerId) return new Set();
    const disenadorId = usuario.rolId === ROL.DISENADOR ? usuario.id : null;
    return repo.listarValesConPropuestaNueva(usuario.id, tallerId, disenadorId, valeIds);
  }
}

module.exports = new PropuestasCompartidasService();
