// src/modules/incidencias/services/retencionFotosService.js
// Regla de conservación de las fotos de Incidencias: pasado el plazo (parámetro `meses_retencion_fotos`, 0 = conservar siempre)
// desde que una incidencia se cierra o se descarta, se borran de Storage sus fotos del reporte y de los avances; las del cierre
// se conservan. La incidencia y su historial no se tocan. Primero Storage y luego la base: si Storage falla, la base queda
// intacta y el siguiente ciclo reintenta.
const storage = require('../../../core/files/supabaseStorage');
const incidenciaRepository = require('../repositories/incidenciaRepository');
const parametros = require('../parametros');

const LOTE = 50;

// `almacen` se puede sustituir para probarlo sin tocar Storage.
async function ejecutar({ almacen = storage.incidencias } = {}) {
  const meses = (await parametros.valores()).meses_retencion_fotos;
  if (!meses) return { purgadas: 0, fallidas: 0 };
  const vencidas = await incidenciaRepository.fotosVencidas(meses, LOTE);
  let purgadas = 0;
  let fallidas = 0;
  for (const foto of vencidas) {
    try {
      await almacen.eliminar(foto.url);
      await incidenciaRepository.marcarFotoPurgada(foto.id);
      purgadas++;
    } catch (error) {
      fallidas++;
      console.error(`[RetencionFotosIncidencias] Foto ${foto.id}: no se pudo purgar, se reintenta: ${error.message}`);
    }
  }
  return { purgadas, fallidas };
}

module.exports = { ejecutar, LOTE };
