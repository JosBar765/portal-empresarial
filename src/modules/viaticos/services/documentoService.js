// src/modules/viaticos/services/documentoService.js
// Documentos de una solicitud: el PDF y las fotos de defectos que alimentan el visor.
const supabaseStorage = require('../../../core/files/supabaseStorage');
const nombreArchivo = require('../../../core/files/nombreArchivo');
const solicitudRepo = require('../repositories/solicitudRepository');
const escrituraRepo = require('../repositories/solicitudEscrituraRepository');
const solicitudService = require('./solicitudService');
const archivosService = require('./archivosViaticoService');
const { generarPdfSolicitud } = require('./pdf/solicitudPdfService');
const { msg } = require('../mensajes');
const { ETAPAS_DOCUMENTO } = require('../constantes');

const TIPO_PDF = 'application/pdf';

// Nombre del PDF según la etapa, como en Vales: <CORR>_CREACION, <CORR>_CORRECCION_PRE_AUTORIZACION_X y <CORR>_AUTORIZACION.
function nombreDelPdf(correlativo, etapa, anterior) {
  if (etapa === ETAPAS_DOCUMENTO.AUTORIZACION) return nombreArchivo.pdfAutorizacion(correlativo);
  if (etapa === ETAPAS_DOCUMENTO.CORRECCION) {
    const contador = nombreArchivo.siguienteContador([anterior], nombreArchivo.prefijoCorreccionPreAutorizacion(correlativo));
    return nombreArchivo.pdfCorreccionPreAutorizacion(correlativo, contador);
  }
  return nombreArchivo.pdfCreacion(correlativo);
}

// Nombre del objeto en Storage sin carpeta, extensión ni querystring: es el correlativo de la imagen.
const nombreDeObjeto = ruta => String(ruta).split(/[?#]/)[0].split('/').pop().replace(/\.[A-Za-z0-9]+$/, '');

class DocumentoService {
  // Genera el PDF con el estado actual de la solicitud, lo sube y guarda su URL; después borra el anterior.
  async regenerarPdf(solicitudId, { etapa = ETAPAS_DOCUMENTO.CREACION } = {}) {
    const encabezado = await solicitudRepo.obtenerEncabezado(solicitudId);
    if (!encabezado) return null;
    const [detalle, extra, archivos] = await Promise.all([
      solicitudService.obtener({ id: encabezado.solicitanteId }, solicitudId),
      solicitudRepo.obtenerDatosDocumento(solicitudId),
      solicitudRepo.listarArchivosDefectos(solicitudId)
    ]);
    const archivoDe = new Map(archivos.map(a => [a.id, a]));
    const imagenes = [];
    const completo = {
      ...detalle,
      solicitante: { ...detalle.solicitante, puesto: extra.puesto, licenciaNumero: extra.licenciaNumero, licenciaTipo: extra.licenciaTipo },
      vehiculo: { ...detalle.vehiculo, polizaNumero: extra.polizaNumero, combustible: extra.combustible },
      inspeccion: detalle.inspeccion && {
        ...detalle.inspeccion,
        defectos: detalle.inspeccion.defectos.map(d => ({ ...d, correlativoImagen: nombreDeObjeto(archivoDe.get(d.id).ruta) }))
      }
    };
    for (const defecto of completo.inspeccion ? completo.inspeccion.defectos : []) {
      try {
        imagenes.push({ defectoId: defecto.id, mimeType: defecto.mimeType, buffer: await supabaseStorage.viaticos.descargar(archivoDe.get(defecto.id).ruta) });
      } catch (error) {
        console.error(`[Viáticos] No se pudo bajar la imagen ${defecto.correlativoImagen} para el PDF:`, error.message);
      }
    }

    const pdf = await generarPdfSolicitud(completo, { imagenes });
    // Storage no sobrescribe: cada etapa tiene su nombre y la versión anterior se borra al final.
    const anterior = encabezado.pdfRuta;
    const subida = await supabaseStorage.viaticos.subir(pdf, `${encabezado.correlativo}.pdf`, TIPO_PDF, nombreDelPdf(encabezado.correlativo, etapa, anterior));
    try {
      await escrituraRepo.guardarPdfRuta(solicitudId, subida.url);
    } catch (error) {
      await archivosService.eliminarArchivos([subida.url]);
      throw error;
    }
    if (anterior) await archivosService.eliminarArchivos([anterior]);
    return subida.url;
  }

  // Las rutas guardadas ya son las URLs públicas de Storage. El PDF va primero y las fotos de defectos después.
  async listar(usuario, idCrudo) {
    const fila = await solicitudService.obtenerPropia(usuario, idCrudo);
    const defectos = await solicitudRepo.listarArchivosDefectos(fila.id);
    const documentos = [];
    if (fila.pdfRuta) documentos.push({ titulo: msg('documento.tituloPdf', { correlativo: fila.correlativo }), tipo: 'pdf', url: fila.pdfRuta });
    defectos.forEach((d, i) => documentos.push({
      titulo: msg('documento.tituloDefecto', { numero: i + 1, tipo: d.tipoDefectoNombre }),
      tipo: d.mimeType === TIPO_PDF ? 'pdf' : 'imagen',
      url: d.ruta
    }));
    return documentos;
  }
}

module.exports = new DocumentoService();
