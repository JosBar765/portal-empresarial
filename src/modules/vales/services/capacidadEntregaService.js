// src/modules/vales/services/capacidadEntregaService.js
// Límite diario OPCIONAL por taller sobre la fecha de ENTREGA (nunca la de
// evento) — analisis_correcciones_28.md. Un taller sin `limite_diario`
// (NULL) nunca restringe ni aparece en el detalle de capacidad. Esta es la
// validación real e inapelable: el calendario del frontend (datepicker.js)
// solo la anticipa para UX, nunca reemplaza esta verificación.
const tallerRepository = require('../repositories/tallerRepository');
const capacidadRepository = require('../repositories/capacidadRepository');

class CapacidadEntregaService {
  async _talleresConLimite(talleresIds) {
    const talleres = await tallerRepository.listarActivos();
    const idsSet = new Set(talleresIds);
    return talleres.filter(t => idsSet.has(t.id) && t.limite_diario != null);
  }

  // conteos[fechaISO][tallerId] = cantidad de vales "entrantes" ese día.
  async _contarPorTallerYFecha(talleresIds, fechaDesde, fechaHasta) {
    const [solicitados, fanOut] = await Promise.all([
      capacidadRepository.listarSolicitadosEnRango(fechaDesde, fechaHasta),
      capacidadRepository.listarFanOutEnRango(talleresIds, fechaDesde, fechaHasta)
    ]);
    const talleresSet = new Set(talleresIds);
    const conteos = {};
    const sumar = (fechaISO, tallerId) => {
      conteos[fechaISO] = conteos[fechaISO] || {};
      conteos[fechaISO][tallerId] = (conteos[fechaISO][tallerId] || 0) + 1;
    };
    for (const row of solicitados) {
      const fechaISO = String(row.fecha_entrega).slice(0, 10);
      const idsFila = (row.talleres_solicitados || '').split(',').map(Number).filter(Number.isFinite);
      for (const id of idsFila) {
        if (talleresSet.has(id)) sumar(fechaISO, id);
      }
    }
    for (const row of fanOut) {
      const fechaISO = String(row.fecha_entrega).slice(0, 10);
      sumar(fechaISO, row.taller_id);
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

  // Validación real de backend — usada por crearVale, solicitarModificacion
  // y aprobarModificacion, siempre dentro de valeMutex.conColaDeCapacidad
  // en los dos primeros (ver esos archivos) para que el check y el
  // consumo del cupo sean atómicos entre asesores distintos. El mensaje es
  // deliberadamente amigable/no técnico: a quien pierde la carrera por el
  // último cupo (o simplemente llega tarde a un día ya lleno) le llega
  // igual, y no tiene por qué distinguirse de un error de validación común.
  async validarLimiteDiario(talleresIds, fechaEntregaISO) {
    const conLimite = await this._talleresConLimite(talleresIds);
    if (conLimite.length === 0) return;
    const conteos = await this._contarPorTallerYFecha(conLimite.map(t => t.id), fechaEntregaISO, fechaEntregaISO);
    const porTaller = conteos[fechaEntregaISO] || {};
    for (const t of conLimite) {
      const programados = porTaller[t.id] || 0;
      if (programados >= t.limite_diario) {
        throw new Error(`¡Uy! El taller "${t.nombre}" ya no tiene cupo para el ${fechaEntregaISO} — alguien más acaba de tomar el último lugar. Selecciona otra fecha de entrega e intenta de nuevo.`);
      }
    }
  }
}

module.exports = new CapacidadEntregaService();
