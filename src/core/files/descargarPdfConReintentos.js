// src/core/files/descargarPdfConReintentos.js
// Descarga un PDF por URL con hasta 3 intentos y distingue la causa del fallo.
const { PDFDocument } = require('pdf-lib');

// Mutable para poder acortarlo en pruebas.
const config = { pausasMs: [300, 800], timeoutMs: 15000 };

const CAUSAS = {
  NO_EXISTE: 'el archivo ya no existe en el almacenamiento (HTTP 404)',
  SIN_PERMISO: 'sin permiso para leer el archivo (HTTP 401/403)',
  ERROR_SERVIDOR: 'el servidor de archivos respondió con error (HTTP 5xx)',
  SIN_CONEXION: 'sin conexión con el almacenamiento o tiempo agotado',
  NO_ES_PDF: 'el contenido descargado no es un PDF',
  PDF_DANADO: 'el PDF está dañado o protegido y no se puede leer'
};

class ErrorDescargaPdf extends Error {
  constructor(causa, detalle, intento, maxIntentos, reintentable) {
    super(detalle);
    this.name = 'ErrorDescargaPdf';
    this.causa = causa;
    this.intento = intento;
    this.maxIntentos = maxIntentos;
    this.reintentable = reintentable;
  }
}

const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Un intento: devuelve { bytes, pdf } o lanza ErrorDescargaPdf.
async function _intentar(url, intento, max) {
  const falla = (causa, detalle, reintentable) => new ErrorDescargaPdf(causa, detalle, intento, max, reintentable);
  const controlador = new AbortController();
  let temporizador;
  const limite = new Promise((_, reject) => {
    temporizador = setTimeout(() => {
      controlador.abort();
      reject(falla(CAUSAS.SIN_CONEXION, `tiempo agotado (${config.timeoutMs} ms)`, true));
    }, config.timeoutMs);
  });

  let bytes;
  try {
    bytes = await Promise.race([
      (async () => {
        let respuesta;
        try {
          respuesta = await fetch(url, { signal: controlador.signal });
        } catch (error) {
          throw falla(CAUSAS.SIN_CONEXION, error.message, true);
        }
        if (!respuesta.ok) {
          const s = respuesta.status;
          if (s === 404) throw falla(CAUSAS.NO_EXISTE, 'HTTP 404', false);
          if (s === 401 || s === 403) throw falla(CAUSAS.SIN_PERMISO, `HTTP ${s}`, false);
          if (s >= 500 || s === 429) throw falla(CAUSAS.ERROR_SERVIDOR, `HTTP ${s}`, true);
          throw falla(CAUSAS.NO_ES_PDF, `HTTP ${s}`, false);
        }
        try {
          return Buffer.from(await respuesta.arrayBuffer());
        } catch (error) {
          throw falla(CAUSAS.SIN_CONEXION, error.message, true);
        }
      })(),
      limite
    ]);
  } finally {
    clearTimeout(temporizador);
  }

  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw falla(CAUSAS.NO_ES_PDF, 'no empieza con %PDF-', false);
  }
  try {
    const pdf = await PDFDocument.load(bytes);
    // pdf-lib tolera basura tras la cabecera: sin páginas legibles se trata como dañado.
    if (!pdf.getPageIndices().length) throw new Error('el PDF no tiene páginas');
    return pdf;
  } catch (error) {
    throw falla(CAUSAS.PDF_DANADO, error.message, false);
  }
}

/**
 * Descarga y parsea un PDF. Hasta 3 intentos; solo reintenta red, timeout, 5xx y 429.
 * @param {string} url
 * @param {(error: ErrorDescargaPdf) => void} [alReintentar] se llama antes de cada pausa
 * @returns {Promise<PDFDocument>}
 * @throws {ErrorDescargaPdf}
 */
async function descargarPdfConReintentos(url, alReintentar) {
  const max = config.pausasMs.length + 1;
  for (let intento = 1; ; intento++) {
    try {
      return await _intentar(url, intento, max);
    } catch (error) {
      if (!(error instanceof ErrorDescargaPdf)) throw error;
      if (!error.reintentable || intento >= max) {
        error.maxIntentos = intento; // intentos realmente hechos
        throw error;
      }
      if (alReintentar) alReintentar(error);
      await esperar(config.pausasMs[intento - 1]);
    }
  }
}

module.exports = { descargarPdfConReintentos, ErrorDescargaPdf, CAUSAS, config };
