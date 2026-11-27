// Venta de un vale recibido por su orden de venta (OV): la registra el dueño y la confirma o rechaza el supervisor del asesor.
// No es un estado del vale: `vales` nunca se modifica aquí.
const ventaRepository = require('../repositories/valeVentaRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const valeEvents = require('../events');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const valeMutex = require('./valeMutex');
const { ESTADOS_VENTA, normalizarNumeroOv } = require('./valeVentaReglas');
const { ESTADOS, ROL, esAdministrador, esSupervisor, hoyISO, horaActual, requerirVale } = require('./valeHelpers');

// `codigo` y `datos` viajan en la respuesta para que la pantalla sepa qué cambió.
class ErrorDeVenta extends ErrorDeNegocio {
  constructor(mensaje, codigo, datos = {}) {
    super(mensaje, 409);
    this.codigo = codigo;
    this.datos = datos;
  }
}

const ahora = () => `${hoyISO()} ${horaActual()}`;

const mensajeResuelta = () => new ErrorDeVenta('Esta OV ya fue resuelta. Se actualizó la lista.', 'OV_RESUELTA');

function mensajeDuplicada(numero, otra) {
  const salida = otra.estado === ESTADOS_VENTA.CONFIRMADA
    ? 'Esa venta ya está confirmada: revisa el número en la otra plataforma.'
    : `Revisa el número. Si el equivocado es el de ${otra.correlativo}, su asesor debe corregirlo o borrarlo, o su supervisor rechazarlo.`;
  return `La OV ${numero} ya está registrada en el vale ${otra.correlativo}. Una OV solo puede usarse en un vale. ${salida}`;
}

class ValeVentaService {
  async registrar(usuario, valeId, numeroCrudo) {
    const numero = normalizarNumeroOv(numeroCrudo);
    return valeMutex.conLockDeVale(valeId, async () => {
      const vale = await this._valeDelDueno(usuario, valeId);
      if (vale.estado !== ESTADOS.RECIBIDO) {
        throw new ErrorDeNegocio('Solo se puede registrar la venta de un vale recibido. Confirma primero el recibido de este vale.', 409);
      }
      const actual = await ventaRepository.obtenerActivaPorVale(valeId);
      if (actual) {
        throw new ErrorDeVenta(actual.estado === ESTADOS_VENTA.CONFIRMADA
          ? `Este vale ya está vendido con la OV ${actual.numero_ov}.`
          : `Este vale ya tiene la OV ${actual.numero_ov} por confirmar. Cámbiala desde «Administrar OV».`, 'OV_EXISTENTE');
      }
      await this._sinDuplicar(usuario, vale, numero, () => ventaRepository.registrar({
        ...this._base(usuario, vale, numero), accion: `Venta: se registró la OV ${numero}, por confirmar`
      }));
      const { salas } = await this._supervisores(vale);
      valeEvents.notificar({
        vale, tipo: 'VENTA_POR_CONFIRMAR', actorId: usuario.id, salas,
        texto: `tiene una venta por confirmar: ${usuario.nombre} registró la OV ${numero}`
      });
      return this._resultado(usuario, vale, salas, numero, ESTADOS_VENTA.POR_CONFIRMAR);
    });
  }

  async corregir(usuario, valeId, numeroCrudo) {
    const numero = normalizarNumeroOv(numeroCrudo);
    return valeMutex.conLockDeVale(valeId, async () => {
      const vale = await this._valeDelDueno(usuario, valeId);
      const actual = await this._pendienteDelDueno(valeId);
      if (actual.numero_ov === numero) return { venta: { numero, estado: actual.estado } };
      const anterior = actual.numero_ov;
      await this._sinDuplicar(usuario, vale, numero, async () => {
        const cambiado = await ventaRepository.corregir({
          ...this._base(usuario, vale, numero), ventaId: actual.id, numeroAnterior: anterior,
          accion: `Venta: se cambió la OV ${anterior} por ${numero}`
        });
        if (!cambiado) throw mensajeResuelta();
      });
      const { salas } = await this._supervisores(vale);
      valeEvents.notificar({
        vale, tipo: 'VENTA_CORREGIDA', actorId: usuario.id, salas,
        texto: `cambió su OV por confirmar de ${anterior} a ${numero}, por ${usuario.nombre}`
      });
      return this._resultado(usuario, vale, salas, numero, ESTADOS_VENTA.POR_CONFIRMAR);
    });
  }

  async borrar(usuario, valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const vale = await this._valeDelDueno(usuario, valeId);
      const actual = await this._pendienteDelDueno(valeId);
      const numero = actual.numero_ov;
      const borrado = await ventaRepository.cerrar({
        ...this._base(usuario, vale, numero), ventaId: actual.id, estado: ESTADOS_VENTA.BORRADA, accion: `Venta: se borró la OV ${numero}`
      });
      if (!borrado) throw mensajeResuelta();
      const { salas } = await this._supervisores(vale);
      valeEvents.notificar({
        vale, tipo: 'VENTA_RETIRADA', actorId: usuario.id, salas,
        texto: `ya no tiene la OV ${numero} por confirmar: la borró ${usuario.nombre}`
      });
      return this._resultado(usuario, vale, salas, numero, ESTADOS_VENTA.BORRADA);
    });
  }

  confirmar(usuario, valeId, numeroCrudo) {
    return this._decidir(usuario, valeId, numeroCrudo, ESTADOS_VENTA.CONFIRMADA);
  }

  rechazar(usuario, valeId, numeroCrudo) {
    return this._decidir(usuario, valeId, numeroCrudo, ESTADOS_VENTA.RECHAZADA);
  }

  // `numeroCrudo` es el número que vio el supervisor: si ya no es el vigente, no se hace nada.
  async _decidir(usuario, valeId, numeroCrudo, estado) {
    const numero = normalizarNumeroOv(numeroCrudo);
    return valeMutex.conLockDeVale(valeId, async () => {
      const vale = await requerirVale(valeId);
      const { lista, salas } = await this._supervisores(vale);
      const soloLee = esAdministrador(usuario) || usuario.rolId === ROL.GERENTE;
      if (soloLee || !esSupervisor(usuario) || !lista.some(s => s.id === usuario.id)) {
        throw new ErrorDeNegocio('Solo el supervisor de este asesor puede confirmar o rechazar la venta.', 403);
      }
      const actual = await ventaRepository.obtenerActivaPorVale(valeId);
      if (!actual || actual.estado !== ESTADOS_VENTA.POR_CONFIRMAR) throw await this._yaNoEstaPendiente(valeId);
      if (actual.numero_ov !== numero) {
        throw new ErrorDeVenta('El asesor cambió el número de OV. Revisa el nuevo antes de decidir.', 'OV_CAMBIO', { numeroActual: actual.numero_ov });
      }
      const confirma = estado === ESTADOS_VENTA.CONFIRMADA;
      const resuelto = await ventaRepository.cerrar({
        ...this._base(usuario, vale, numero), ventaId: actual.id, estado,
        accion: confirma ? `Venta: se confirmó con la OV ${numero}` : `Venta: se rechazó la OV ${numero}`
      });
      if (!resuelto) throw mensajeResuelta();
      const dueno = [`asesor:${vale.asesor_id}`];
      if (confirma) {
        valeEvents.notificar({
          vale, tipo: 'VENTA_CONFIRMADA', actorId: usuario.id, salas: dueno,
          texto: `quedó vendido: ${usuario.nombre} confirmó la OV ${numero}`
        });
      } else {
        valeEvents.notificar({
          vale, tipo: 'VENTA_RECHAZADA', actorId: usuario.id, salas: dueno,
          texto: `tiene rechazada la OV ${numero} por ${usuario.nombre}. Puedes registrar otra`
        });
      }
      return this._resultado(usuario, vale, salas, numero, estado);
    });
  }

  // El dueño estricto: el administrador no pasa.
  async _valeDelDueno(usuario, valeId) {
    const vale = await requerirVale(valeId);
    if (vale.asesor_id !== usuario.id) throw new ErrorDeNegocio('Solo el asesor dueño del vale puede registrar o cambiar su venta.', 403);
    return vale;
  }

  async _pendienteDelDueno(valeId) {
    const actual = await ventaRepository.obtenerActivaPorVale(valeId);
    if (actual && actual.estado === ESTADOS_VENTA.POR_CONFIRMAR) return actual;
    if (actual) throw new ErrorDeVenta('La venta ya fue confirmada: no se puede cambiar ni borrar.', 'OV_RESUELTA');
    throw new ErrorDeVenta('Este vale ya no tiene una OV por confirmar (tu supervisor la rechazó o ya se borró). Se actualizó la lista.', 'OV_RESUELTA');
  }

  async _yaNoEstaPendiente(valeId) {
    const ultima = await ventaRepository.obtenerUltimaPorVale(valeId);
    if (!ultima) return new ErrorDeVenta('Este vale no tiene una OV por confirmar.', 'OV_RESUELTA');
    if (ultima.estado === ESTADOS_VENTA.BORRADA) {
      return new ErrorDeVenta(`El asesor borró la OV ${ultima.numero_ov}. Ya no hay nada que decidir.`, 'OV_RETIRADA');
    }
    return mensajeResuelta();
  }

  _base(usuario, vale, numero) {
    return { valeId: vale.id, numero, usuarioId: usuario.id, estadoVale: vale.estado, fecha: ahora() };
  }

  // El índice único decide quién se queda con la OV, aun con dos vales a la vez; el intento bloqueado queda anotado.
  async _sinDuplicar(usuario, vale, numero, guardar) {
    try {
      await guardar();
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
      const otra = await ventaRepository.obtenerActivaPorNumero(numero);
      if (!otra || otra.vale_id === vale.id) {
        throw new ErrorDeVenta('La venta de este vale cambió mientras la guardabas. Revisa la lista e inténtalo de nuevo.', 'OV_EXISTENTE');
      }
      await ventaRepository.registrarEvento({ valeId: vale.id, evento: 'DUPLICADO_BLOQUEADO', numero, usuarioId: usuario.id, fecha: ahora() });
      throw new ErrorDeVenta(mensajeDuplicada(numero, otra), 'OV_DUPLICADA');
    }
  }

  async _supervisores(vale) {
    const lista = await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
    return { lista, salas: lista.map(s => `supervisor:${s.id}`) };
  }

  // Refresco silencioso con el número vigente: un modal abierto con otro número se entera.
  _resultado(usuario, vale, salasSupervisores, numero, estado) {
    valeEvents.refrescar({ vale, salas: [`asesor:${vale.asesor_id}`, ...salasSupervisores], venta: { numero, estado }, actorId: usuario.id });
    return { venta: { numero, estado } };
  }
}

module.exports = new ValeVentaService();
