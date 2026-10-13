// src/modules/vales/services/capacidadEntregaService.js
// Límite diario OPCIONAL por taller sobre la fecha de ENTREGA (nunca la de
// evento) — analisis_correcciones_28.md. Un taller sin `limite_diario`
// (NULL) nunca restringe ni aparece en el detalle de capacidad. Esta es la
// validación real e inapelable: el calendario del frontend (datepicker.js)
// solo la anticipa para UX, nunca reemplaza esta verificación.
const tallerRepository = require('../repositories/tallerRepository');
const capacidadRepository = require('../repositories/capacidadRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const valeCatalogoService = require('./valeCatalogoService');
const { ROL, ROLES_ENCARGADO_TALLER } = require('./valeHelpers');

const idsDe = (texto) => String(texto || '').split(',').map(Number).filter(Number.isInteger);

class CapacidadEntregaService {
  async _talleresConLimite(talleresIds) {
    const talleres = await tallerRepository.listarActivos();
    const idsSet = new Set(talleresIds);
    return talleres.filter(t => idsSet.has(t.id) && t.limite_diario != null);
  }

  // conteos[fechaISO][tallerId] = vales ya AUTORIZADOS que entran ese día; uno pendiente no ocupa cupo.
  async _contarPorTallerYFecha(talleresIds, fechaDesde, fechaHasta) {
    const fanOut = await capacidadRepository.listarFanOutEnRango(talleresIds, fechaDesde, fechaHasta);
    const conteos = {};
    for (const row of fanOut) {
      const fechaISO = String(row.fecha_entrega).slice(0, 10);
      conteos[fechaISO] = conteos[fechaISO] || {};
      conteos[fechaISO][row.taller_id] = (conteos[fechaISO][row.taller_id] || 0) + 1;
    }
    return conteos;
  }

  // Capacidad día por día de un mes completo, para el calendario del
  // formulario de creación/modificación. Solo incluye los talleres del
  // subconjunto pedido que sí tienen límite configurado.
  async obtenerCapacidadMes(talleresIds, anio, mes) {
    const conLimite = await this._talleresConLimite(talleresIds);
    if (conLimite.length === 0) return {};

    const mesStr = String(mes).padStart(2, '0');
    const ultimoDia = new Date(anio, mes, 0).getDate();
    const desde = `${anio}-${mesStr}-01`;
    const hasta = `${anio}-${mesStr}-${String(ultimoDia).padStart(2, '0')}`;
    const conteos = await this._contarPorTallerYFecha(conLimite.map(t => t.id), desde, hasta);

    const resultado = {};
    for (let dia = 1; dia <= ultimoDia; dia++) {
      const fechaISO = `${anio}-${mesStr}-${String(dia).padStart(2, '0')}`;
      const porTaller = conteos[fechaISO] || {};
      const detalle = conLimite.map(t => {
        const programados = porTaller[t.id] || 0;
        return {
          tallerId: t.id,
          tallerNombre: t.nombre,
          programados,
          limite: t.limite_diario,
          restantes: Math.max(0, t.limite_diario - programados)
        };
      });
      resultado[fechaISO] = { bloqueado: detalle.some(d => d.restantes <= 0), detalle };
    }
    return resultado;
  }

  // Alcance del calendario «Cupo de talleres»: el Supervisor ve los talleres de sus tiendas y los vales por autorizar de
  // su equipo; quien tenga el permiso sin tiendas propias ve todos los talleres con límite y todos los vales.
  async _alcanceCupo(usuario) {
    if (usuario.rolId === ROL.SUPERVISOR) {
      const talleresIds = (await tallerRepository.listarIdsPorSupervisor(usuario.id)).map(t => t.id);
      const asesores = await usuarioValeRepository.listarAsesoresPorSupervisor(usuario.id);
      return { conLimite: await this._talleresConLimite(talleresIds), asesorIds: [...new Set([...asesores.map(a => a.id), usuario.id])] };
    }
    const todos = (await tallerRepository.listarActivos()).map(t => t.id);
    return { conLimite: await this._talleresConLimite(todos), asesorIds: null };
  }

  // Cupo de un mes: por día y taller con límite, los vales autorizados (`programados`) y los que esperan autorización
  // (`pendientes`). El semáforo de la pantalla solo usa los autorizados.
  async obtenerCupoMes(usuario, anio, mes) {
    const { conLimite, asesorIds } = await this._alcanceCupo(usuario);
    const talleres = conLimite.map(t => ({ id: t.id, nombre: t.nombre, limite: t.limite_diario }));
    if (!talleres.length) return { anio, mes, talleres, dias: {} };

    const ids = talleres.map(t => t.id);
    const capacidad = await this.obtenerCapacidadMes(ids, anio, mes);
    const mesStr = String(mes).padStart(2, '0');
    const desde = `${anio}-${mesStr}-01`;
    const hasta = `${anio}-${mesStr}-${String(new Date(anio, mes, 0).getDate()).padStart(2, '0')}`;
    const pendientes = {};
    for (const v of await capacidadRepository.listarPendientesEnRango(asesorIds, desde, hasta)) {
      const fecha = String(v.fecha_entrega).slice(0, 10);
      for (const tallerId of idsDe(v.talleres_solicitados).filter(id => ids.includes(id))) {
        pendientes[fecha] = pendientes[fecha] || {};
        pendientes[fecha][tallerId] = (pendientes[fecha][tallerId] || 0) + 1;
      }
    }
    const dias = {};
    for (const [fecha, dia] of Object.entries(capacidad)) {
      dias[fecha] = {
        bloqueado: dia.bloqueado,
        talleres: dia.detalle.map(d => ({ tallerId: d.tallerId, programados: d.programados, limite: d.limite, pendientes: (pendientes[fecha] || {})[d.tallerId] || 0 }))
      };
    }
    return { anio, mes, talleres, dias };
  }

  // Información por día del calendario desplegable del Buzón, según el rol:
  //  - con `vales.ver_cupo` (Supervisor): el cupo de los talleres con límite (ver obtenerCupoMes);
  //  - Diseñador y Encargado/Asistente de taller: cuántos vales entran cada día (por fecha de entrega);
  //  - cualquier otro: nada (el calendario queda como siempre).
  async obtenerCalendarioBuzon(usuario, anio, mes) {
    if ((usuario.permissions || []).includes('vales.ver_cupo')) return { tipo: 'cupo', ...(await this.obtenerCupoMes(usuario, anio, mes)) };
    const mesStr = String(mes).padStart(2, '0');
    const rango = { fechaDesde: `${anio}-${mesStr}-01`, fechaHasta: `${anio}-${mesStr}-${String(new Date(anio, mes, 0).getDate()).padStart(2, '0')}` };
    if (usuario.rolId === ROL.DISENADOR) return { tipo: 'conteo', dias: await capacidadRepository.contarPorDia({ ...rango, disenadorId: usuario.id }) };
    if (ROLES_ENCARGADO_TALLER.includes(usuario.rolId)) {
      const idEfectivo = await valeCatalogoService.idEncargadoEfectivo(usuario);
      const talleresIds = (await tallerRepository.listarActivos()).filter(t => t.encargado_id === idEfectivo).map(t => t.id);
      return { tipo: 'conteo', dias: await capacidadRepository.contarPorDia({ ...rango, talleresIds }) };
    }
    return { tipo: null };
  }

  // Validación real de backend — usada por crearVale, solicitarModificacion
  // y aprobarModificacion, siempre dentro de valeMutex.conColaDeCapacidad
  // en los dos primeros (ver esos archivos) para que el check y el
  // consumo del cupo sean atómicos entre asesores distintos. El mensaje es
  // deliberadamente amigable/no técnico: a quien pierde la carrera por el
  // último cupo (o simplemente llega tarde a un día ya lleno) le llega
  // igual, y no tiene por qué distinguirse de un error de validación común.
  // `paraSupervisor`: el mensaje se redacta para quien autoriza, no para quien captura el vale.
  async validarLimiteDiario(talleresIds, fechaEntregaISO, { paraSupervisor = false } = {}) {
    const conLimite = await this._talleresConLimite(talleresIds);
    if (conLimite.length === 0) return;
    const conteos = await this._contarPorTallerYFecha(conLimite.map(t => t.id), fechaEntregaISO, fechaEntregaISO);
    const porTaller = conteos[fechaEntregaISO] || {};
    const fechaLegible = fechaEntregaISO.split('-').reverse().join('/');
    for (const t of conLimite) {
      const programados = porTaller[t.id] || 0;
      if (programados >= t.limite_diario) {
        if (paraSupervisor) {
          throw new Error(`El taller "${t.nombre}" ya no tiene cupo para la fecha de entrega ${fechaLegible}. Puedes rechazar el vale indicándole al asesor que elija otra fecha.`);
        }
        throw new Error(`El taller "${t.nombre}" ya alcanzó su límite diario para el ${fechaLegible}. Selecciona otra fecha de entrega e intenta de nuevo.`);
      }
    }
  }
}

module.exports = new CapacidadEntregaService();
