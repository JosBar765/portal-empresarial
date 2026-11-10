// src/modules/proyectos/services/rondasService.js
// Rondas de reparto (S21): lo que sobró del reparto inicial (la reserva) se reparte por tandas a los asesores que ya avanzaron. Se enciende con
// `reparto.rondas`; solo reparten supervisores con `proyectos.reasignar`, y solo entre asesores de sus tiendas que ya gestionaron el
// `reparto.ronda_umbral` % o más de sus empresas. Cada asesor recibe hasta `tanda` más, a la equidad de siempre (`repartoService`).
const db = require('../../../config/database');
const metasRepository = require('../repositories/metasRepository');
const seguimientoRepository = require('../repositories/seguimientoRepository');
const proyectoRepository = require('../repositories/proyectoRepository');
const configService = require('./configService');
const seguimientoService = require('./seguimientoService');
const reparto = require('../repartoService');
const socketManager = require('../../../core/websocket/socketManager');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');
const { errorDeValidacion } = require('../errores');

const tiene = (usuario, permiso) => (usuario.permissions || []).includes(permiso);
const MAXIMA_TANDA = 100;
const plural = (n) => `${n} ${n === 1 ? 'empresa' : 'empresas'}`;

class RondasService {
  // Los asesores con su avance y si hoy reciben una tanda (los de otras tiendas no se listan: no se les puede repartir).
  async _asesores(proyecto, niveles, umbral, ejecutor = db) {
    const [filas, participantes] = await Promise.all([seguimientoRepository.porAsesor(proyecto.id), seguimientoRepository.participantes(proyecto.id, ejecutor)]);
    const pais = new Map(participantes.map(p => [p.usuario_id, p.pais_id]));
    return filas.filter(f => niveles.puedeActuarEn(f.tiendaId) && pais.has(f.asesorId)).map(f => {
      const porcentaje = f.asignadas ? Math.floor((f.gestionadas * 100) / f.asignadas) : 0;
      return { asesorId: f.asesorId, nombre: f.nombre, tiendaId: f.tiendaId, tienda: f.tienda, paisId: pais.get(f.asesorId), asignadas: f.asignadas, gestionadas: f.gestionadas, porcentaje, elegible: f.asignadas > 0 && porcentaje >= umbral };
    });
  }

  async ver(usuario, proyectoId) {
    seguimientoService._exigirVer(usuario);
    const { proyecto, niveles } = await seguimientoService._acceso(usuario, proyectoId);
    const ajustes = await configService.valores();
    const umbral = ajustes['reparto.ronda_umbral'];
    const enReserva = (await metasRepository.reserva(proyecto.id)).length;
    const asesores = await this._asesores(proyecto, niveles, umbral);
    return {
      habilitada: Boolean(ajustes['reparto.rondas']), umbral, enReserva, activo: proyecto.estado === 'activo',
      puedeRepartir: Boolean(ajustes['reparto.rondas']) && proyecto.estado === 'activo' && tiene(usuario, 'proyectos.reasignar') && enReserva > 0,
      asesores: asesores.map(({ paisId, ...a }) => a), elegibles: asesores.filter(a => a.elegible).length
    };
  }

  // Calcula la tanda; con `bloquear` (dentro de la transacción) deja la reserva bloqueada.
  async _plan(ejecutor, proyecto, niveles, tanda, bloquear) {
    const ajustes = await configService.valores();
    if (!ajustes['reparto.rondas']) throw new ErrorDeNegocio('Las rondas de reparto están apagadas: el administrador las enciende en Parámetros.', 409);
    const umbral = ajustes['reparto.ronda_umbral'];
    const reserva = await metasRepository.reserva(proyecto.id, ejecutor, bloquear);
    if (!reserva.length) throw new ErrorDeNegocio('No hay empresas en reserva.', 409);
    const asesores = await this._asesores(proyecto, niveles, umbral, ejecutor);
    const elegibles = asesores.filter(a => a.elegible);
    if (!elegibles.length) throw new ErrorDeNegocio(`Todavía ningún asesor de tus tiendas gestionó el ${umbral} % de sus empresas.`, 409);
    const calculo = reparto.calcular({
      empresas: reserva.map(r => ({ id: r.id, paisId: r.pais_id, tiendaOrigenId: r.tienda_origen_id })),
      asesores: elegibles.map(a => ({ id: a.asesorId, paisId: a.paisId, tiendaId: a.tiendaId })), tope: tanda, afinidad: ajustes['reparto.afinidad_tienda']
    });
    if (!calculo.asignaciones.length) throw new ErrorDeNegocio('Ninguna empresa de la reserva es del país de los asesores que pueden recibir.', 409);
    const nombre = new Map(elegibles.map(a => [a.asesorId, a.nombre]));
    return {
      asignaciones: calculo.asignaciones,
      porAsesor: [...calculo.porAsesor].filter(([, n]) => n > 0).map(([asesorId, n]) => ({ asesorId, nombre: nombre.get(asesorId), recibe: n })),
      enReservaDespues: reserva.length - calculo.asignaciones.length
    };
  }

  // `datos`: { tanda, soloVistaPrevia, idempotencyKey }
  async repartir(usuario, proyectoId, datos = {}) {
    if (!tiene(usuario, 'proyectos.reasignar')) throw new ErrorDeNegocio('No tienes permiso para repartir la reserva.', 403);
    const { proyecto, niveles } = await seguimientoService._acceso(usuario, proyectoId);
    if (proyecto.estado !== 'activo') throw new ErrorDeNegocio('Este proyecto ya no está activo: no se puede repartir la reserva.', 409);
    const tanda = aEntero(datos.tanda);
    if (tanda === null || tanda < 1 || tanda > MAXIMA_TANDA) throw errorDeValidacion('Revisa los datos.', { tanda: `Escribe cuántas empresas más recibe cada asesor (de 1 a ${MAXIMA_TANDA}).` });

    if (datos.soloVistaPrevia === true) {
      const { asignaciones, porAsesor, enReservaDespues } = await this._plan(db, proyecto, niveles, tanda, false);
      return { vistaPrevia: true, total: asignaciones.length, porAsesor, enReservaDespues };
    }

    const resultado = await seguimientoService._unaVez(usuario, 'repartir-reserva', proyecto.id, datos.idempotencyKey, async (tx) => {
      await tx.query('SELECT id FROM proy_proyectos WHERE id = ? FOR UPDATE', [proyecto.id], 'proyectos_rondas:bloquear_proyecto');
      const { asignaciones, porAsesor, enReservaDespues } = await this._plan(tx, proyecto, niveles, tanda, true);
      let movidas = 0;
      for (const a of asignaciones) movidas += await metasRepository.entregar(tx, a.clienteId, a.asesorId, a.tiendaId, usuario.id);
      if (movidas !== asignaciones.length) throw new ErrorDeNegocio('Otra persona acaba de repartir la reserva. Vuelve a ver la vista previa.', 409);
      await proyectoRepository.registrarHistorial(tx, { proyectoId: proyecto.id, usuarioId: usuario.id, accion: 'repartir_reserva', detalle: { tanda, repartidas: movidas, recibe: porAsesor, enReserva: enReservaDespues } });
      return { repartidas: movidas, porAsesor, enReserva: enReservaDespues };
    });

    if (!resultado.repetida) {
      for (const r of resultado.porAsesor) {
        if (r.asesorId === usuario.id) continue;
        await seguimientoService._avisar('reparto_recibido', {
          proyectoId: proyecto.id, autorId: usuario.id, explicitos: { asesor: [r.asesorId] }, referenciaTipo: 'proyecto', referenciaId: proyecto.id,
          mensaje: `Te asignaron ${plural(r.recibe)} más de la reserva de «${proyecto.nombre}».`
        });
      }
      socketManager.sendToUsers(resultado.porAsesor.map(r => r.asesorId).filter(id => id !== usuario.id), 'proyectos_reasignacion', { proyectoId: proyecto.id });
    }
    return resultado;
  }
}

module.exports = new RondasService();
