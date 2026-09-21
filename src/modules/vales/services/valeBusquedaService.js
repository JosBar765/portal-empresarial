// src/modules/vales/services/valeBusquedaService.js
// "Encontrar vale" (solo Gerente): búsqueda de UN vale de arte por su
// correlativo exacto. Devuelve únicamente lo que la vista muestra, no la fila
// completa (datos del cliente, cotización, etc.).
const valeRepository = require('../repositories/valeRepository');
const valeTallerRepository = require('../repositories/valeTallerRepository');
const tallerRepository = require('../repositories/tallerRepository');
const { enriquecer } = require('./valeHelpers');

const CORRELATIVO_VALIDO = /^[A-Za-z0-9-]{3,60}$/;
const MAX_SUGERENCIAS = 5;

class ValeBusquedaService {
  async buscarPorCorrelativo(texto) {
    const correlativo = String(texto || '').trim().toUpperCase();
    if (!CORRELATIVO_VALIDO.test(correlativo)) {
      throw new Error('Escribe un correlativo válido (al menos 3 caracteres: letras, números y guiones), por ejemplo MTC-AL-1023.');
    }
    const vale = await valeRepository.obtenerPorCorrelativo(correlativo);
    if (!vale) {
      const similares = await valeRepository.buscarCorrelativosSimilares(correlativo, MAX_SUGERENCIAS);
      return { vale: null, sugerencias: similares.map(s => s.correlativo) };
    }
    return { vale: await this._paraLaVista(vale), sugerencias: [] };
  }

  async _paraLaVista(vale) {
    const v = enriquecer(vale);
    const filas = await valeTallerRepository.listarPorVale(vale.id);
    // Un vale ESPERANDO_AUTORIZACION aún no tiene filas en vale_talleres:
    // se muestran los talleres que pidió el asesor, igual que en el buzón.
    const idsTaller = filas.length > 0
      ? filas.map(f => f.taller_id)
      : String(vale.talleres_solicitados || '').split(',').map(Number).filter(Number.isFinite);
    const talleres = await tallerRepository.listarActivos();
    const nombre = (id) => (talleres.find(t => t.id === id) || {}).nombre || `#${id}`;
    return {
      id: v.id,
      correlativo: v.correlativo,
      urgente: v.urgente,
      creado_en: v.creado_en,
      fecha_creacion: v.fecha_creacion,
      hora_creacion: v.hora_creacion,
      fecha_entrega: v.fecha_entrega,
      fecha_evento: v.fecha_evento,
      atrasado: v.atrasado,
      diasAtraso: v.diasAtraso,
      venceHoy: v.venceHoy,
      estado: v.estado,
      taller: [...new Set(idsTaller)].map(nombre).join(', '),
      propuesta_general_url: v.propuesta_general_url
    };
  }
}

module.exports = new ValeBusquedaService();
