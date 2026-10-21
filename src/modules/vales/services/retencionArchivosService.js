// src/modules/vales/services/retencionArchivosService.js
// Borra de Storage los archivos de los vales confirmados: PDF y adjuntos y luego propuestas,
// según los días de parametros_sistema (por defecto 30 y 60). Primero Storage y luego la BD; si Storage falla, la BD queda
// intacta y el siguiente ciclo reintenta.
const supabaseStorage = require('../../../core/files/supabaseStorage');
const retencionRepository = require('../repositories/retencionArchivosRepository');
const documentoRepository = require('../repositories/documentoRepository');

const CLAVE_DIAS_ARCHIVOS = 'dias_retencion_pdf_adjuntos';
const CLAVE_DIAS_PROPUESTAS = 'dias_retencion_propuestas';
const DIAS_ARCHIVOS_POR_DEFECTO = 30;
const DIAS_PROPUESTAS_POR_DEFECTO = 60;
const LOTE = 50;

async function leerDias(clave, porDefecto) {
  const dias = Number(await retencionRepository.obtenerParametro(clave));
  return Number.isInteger(dias) && dias > 0 ? dias : porDefecto;
}

// Un objeto compartido con otro vale solo se desreferencia; se borra cuando nadie más lo usa.
async function borrarSiNadieMasLoUsa(url, valeId, yaBorradas) {
  if (!url || yaBorradas.has(url)) return;
  if (await documentoRepository.contarReferenciasEnOtrosVales(url, valeId) === 0) {
    await supabaseStorage.eliminar(url);
  }
  yaBorradas.add(url);
}

async function purgarArchivos() {
  const vales = await retencionRepository.listarConArchivosVencidos(await leerDias(CLAVE_DIAS_ARCHIVOS, DIAS_ARCHIVOS_POR_DEFECTO), LOTE);
  let purgados = 0;
  for (const vale of vales) {
    try {
      const yaBorradas = new Set();
      await borrarSiNadieMasLoUsa(vale.pdf_url, vale.id, yaBorradas);
      for (const doc of await retencionRepository.listarRutasDocumentos(vale.id)) {
        await borrarSiNadieMasLoUsa(doc.ruta, vale.id, yaBorradas);
      }
      await retencionRepository.marcarArchivosPurgados(vale.id);
      purgados++;
    } catch (error) {
      console.error(`[RetencionArchivos] Vale ${vale.id}: no se pudieron purgar PDF/adjuntos, se reintenta: ${error.message}`);
    }
  }
  return purgados;
}

async function purgarPropuestas() {
  const vales = await retencionRepository.listarConPropuestasVencidas(await leerDias(CLAVE_DIAS_PROPUESTAS, DIAS_PROPUESTAS_POR_DEFECTO), LOTE);
  let purgados = 0;
  for (const vale of vales) {
    try {
      const yaBorradas = new Set();
      for (const p of await retencionRepository.listarUrlsPropuestas(vale.id)) {
        await borrarSiNadieMasLoUsa(p.url, vale.id, yaBorradas);
      }
      await borrarSiNadieMasLoUsa(vale.propuesta_general_url, vale.id, yaBorradas);
      await retencionRepository.marcarPropuestasPurgadas(vale.id);
      purgados++;
    } catch (error) {
      console.error(`[RetencionArchivos] Vale ${vale.id}: no se pudieron purgar las propuestas, se reintenta: ${error.message}`);
    }
  }
  return purgados;
}

async function ejecutar() {
  const archivos = await purgarArchivos();
  const propuestas = await purgarPropuestas();
  return { archivos, propuestas };
}

module.exports = { ejecutar, purgarArchivos, purgarPropuestas, LOTE };
