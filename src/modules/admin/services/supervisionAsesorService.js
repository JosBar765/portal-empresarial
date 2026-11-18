// src/modules/admin/services/supervisionAsesorService.js
// Supervisión especial: asignar a un asesor los supervisores que autorizan sus vales EN LUGAR DE los de su tienda.
const repo = require('../repositories/supervisionAsesorRepository');
const usuarioValeRepository = require('../../vales/repositories/usuarioValeRepository');
const valeMutex = require('../../vales/services/valeMutex');
const valeEvents = require('../../vales/events');
const { ESTADOS } = require('../../vales/services/valeHelpers');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { idObligatorio } = require('../../../core/utils/validar');

// Solo estos dos esperan una acción del supervisor (autorizar o rechazar); en los demás estados el vale solo se muestra en su buzón.
const ESTADOS_QUE_ESPERAN_AL_SUPERVISOR = [ESTADOS.ESPERANDO_AUTORIZACION, ESTADOS.SOLICITANDO_MODIFICACION];
const INTENTOS_MAXIMOS = 3;

const MENSAJE_VALE_OCUPADO = 'Un vale de este asesor se está procesando en este momento (alguien lo autoriza, lo rechaza o lo edita). No se cambió nada: espera unos segundos y vuelve a guardar.';
const MENSAJE_VALES_CAMBIARON = 'Mientras se guardaba, este asesor recibió vales nuevos que esperan autorización. No se cambió nada: vuelve a guardar para incluirlos en los avisos.';

const ids = (lista) => lista.map(s => s.id);
const mismoConjunto = (a, b) => a.length === b.length && a.every(id => b.includes(id));

class SupervisionAsesorService {
  async _exigirAsesor(asesorId) {
    const asesor = await repo.obtenerAsesor(asesorId);
    if (!asesor) throw new ErrorDeNegocio('Este usuario no es un asesor, así que no se le puede asignar supervisión. Elige un usuario que figure como asesor.', 404);
    return asesor;
  }

  async obtener(asesorId) {
    const asesor = await this._exigirAsesor(asesorId);
    const [asignados, asignables, supervisoresACargo, supervisoresDeTienda, esperando] = await Promise.all([
      repo.listarAsignados(asesorId),
      repo.listarAsignables(),
      usuarioValeRepository.obtenerSupervisoresDeAsesor(asesorId),
      repo.listarSupervisoresDeTienda(asesorId),
      repo.listarValesEsperando(asesorId, ESTADOS_QUE_ESPERAN_AL_SUPERVISOR)
    ]);
    return {
      asesor: { id: asesor.id, nombre: asesor.nombre, tiendaId: asesor.tienda_id },
      asignados: asignados.map(s => ({ id: s.id, nombre: s.nombre, email: s.email, valido: !!s.activo && !!s.con_permiso })),
      asignables,
      supervisoresACargo,
      supervisoresDeTienda,
      valesEsperando: { total: esperando.length, vales: esperando },
      // Con asignación pero ninguna sirve: los vales no los autoriza nadie hasta corregirla.
      sinSupervisorValido: asignados.length > 0 && supervisoresACargo.length === 0
    };
  }

  async _validarSupervisores(supervisorIds) {
    if (!Array.isArray(supervisorIds)) {
      throw new ErrorDeNegocio('Envía la lista de supervisores como un arreglo en "supervisorIds"; una lista vacía quita la asignación.', 400);
    }
    const lista = supervisorIds.map(id => idObligatorio(id, 'Supervisor'));
    if (new Set(lista).size !== lista.length) {
      throw new ErrorDeNegocio('Hay supervisores repetidos en la lista. Deja cada supervisor una sola vez.', 400);
    }
    const encontrados = new Map((await repo.listarUsuariosPorIds(lista)).map(u => [u.id, u]));
    for (const id of lista) {
      const u = encontrados.get(id);
      if (!u) throw new ErrorDeNegocio(`El supervisor ${id} no existe. Recarga la lista y elige de nuevo.`, 400);
      if (!u.activo) throw new ErrorDeNegocio(`${u.nombre} está inactivo y no puede autorizar vales. Quítalo de la lista o actívalo primero.`, 400);
      if (!u.con_permiso) {
        throw new ErrorDeNegocio(`${u.nombre} no es un supervisor con permiso para autorizar vales. Elige solo supervisores de ventas con ese permiso.`, 400);
      }
    }
    return lista;
  }

  // El cambio y los avisos ocurren con todos los vales pendientes del asesor tomados (nadie los autoriza o rechaza a mitad)
  // y dentro de la cola de creación del asesor (un vale nuevo suyo o otro cambio esperan su turno): se aplica todo o nada.
  async reemplazar(admin, asesorId, supervisorIds) {
    const asesor = await this._exigirAsesor(asesorId);
    const lista = await this._validarSupervisores(supervisorIds);
    return valeMutex.conColaDeCreacion(asesorId, async () => {
      for (let intento = 1; intento <= INTENTOS_MAXIMOS; intento++) {
        const actuales = ids(await repo.listarAsignados(asesorId));
        if (mismoConjunto(actuales, lista)) return { cambio: false };
        const esperando = await repo.listarValesEsperando(asesorId, ESTADOS_QUE_ESPERAN_AL_SUPERVISOR);
        const resultado = await this._aplicarConLocks(admin, asesor, lista, esperando);
        if (resultado) return resultado;
      }
      throw new ErrorDeNegocio(MENSAJE_VALES_CAMBIARON, 409);
    });
  }

  // null = aparecieron vales nuevos tras tomar los locks: se reintenta con la lista completa.
  async _aplicarConLocks(admin, asesor, lista, esperando) {
    try {
      return await valeMutex.conLocksDeVales(ids(esperando), async () => {
        const ahora = await repo.listarValesEsperando(asesor.id, ESTADOS_QUE_ESPERAN_AL_SUPERVISOR);
        if (!mismoConjunto(ids(ahora), ids(esperando))) return null;
        const antes = ids(await usuarioValeRepository.obtenerSupervisoresDeAsesor(asesor.id));
        await repo.reemplazar(asesor.id, lista);
        const despues = await usuarioValeRepository.obtenerSupervisoresDeAsesor(asesor.id);
        const nuevos = despues.filter(s => !antes.includes(s.id));
        const quitados = antes.filter(id => !ids(despues).includes(id));
        this._avisar(admin, asesor, esperando, nuevos, quitados);
        return { cambio: true, supervisoresACargo: despues, valesAvisados: nuevos.length ? esperando.length : 0 };
      });
    } catch (error) {
      if (error instanceof ErrorDeNegocio && error.status === 409) throw new ErrorDeNegocio(MENSAJE_VALE_OCUPADO, 409);
      throw error;
    }
  }

  // Avisa a los supervisores que quedan a cargo (los que ya lo estaban no se repiten) y refresca el buzón de los que lo dejan.
  _avisar(admin, asesor, esperando, nuevos, quitados) {
    for (const v of esperando) {
      const vale = { ...v, asesor_id: asesor.id };
      if (nuevos.length) {
        const prefijo = v.estado === ESTADOS.SOLICITANDO_MODIFICACION ? '(solicitud de modificación) ' : '';
        valeEvents.notificar({
          vale, actor: admin.nombre, actorId: admin.id,
          texto: `${prefijo}pasó a tu autorización: ${admin.nombre} cambió la supervisión del asesor ${asesor.nombre}`,
          salas: nuevos.map(s => `supervisor:${s.id}`)
        });
      }
      if (quitados.length) valeEvents.refrescar({ vale, salas: quitados.map(id => `supervisor:${id}`) });
    }
  }
}

module.exports = new SupervisionAsesorService();
