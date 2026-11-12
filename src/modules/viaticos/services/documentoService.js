// src/modules/viaticos/services/documentoService.js
// Documentos de una solicitud: el PDF, las fotos de defectos y, ya liquidada, sus comprobantes; alimentan el visor.
const supabaseStorage = require('../../../core/files/supabaseStorage');
const nombreArchivo = require('../../../core/files/nombreArchivo');
const solicitudRepo = require('../repositories/solicitudRepository');
const escrituraRepo = require('../repositories/solicitudEscrituraRepository');
const comprobanteRepo = require('../repositories/comprobanteRepository');
const solicitudService = require('./solicitudService');
const archivosService = require('./archivosViaticoService');
const { generarPdfSolicitud } = require('./pdf/solicitudPdfService');
const { msg } = require('../mensajes');
const { ETAPAS_DOCUMENTO, ESTADOS } = require('../constantes');
const { aCentavos, formatear } = require('../dinero');

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
      solicitudService.leerDetalle(solicitudId),
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

  async listar(usuario, idCrudo) {
    return this.documentosDe(await solicitudService.obtenerPropia(usuario, idCrudo));
  }

  // Igual que `listar` pero de cualquier solicitud: lo usa Gestiones.
  async listarDeGestion(idCrudo) {
    return this.documentosDe(await solicitudService.leerEncabezado(idCrudo));
  }

  // Las rutas guardadas ya son las URLs públicas de Storage. El PDF va primero, luego las fotos de defectos y al final los comprobantes (solo liquidada).
  async documentosDe(fila) {
    const defectos = await solicitudRepo.listarArchivosDefectos(fila.id);
    const documentos = [];
    if (fila.pdfRuta) documentos.push({ titulo: msg('documento.tituloPdf', { correlativo: fila.correlativo }), tipo: 'pdf', url: fila.pdfRuta });
    defectos.forEach((d, i) => documentos.push({
      titulo: msg('documento.tituloDefecto', { numero: i + 1, tipo: d.tipoDefectoNombre }),
      tipo: d.mimeType === TIPO_PDF ? 'pdf' : 'imagen',
      url: d.ruta
    }));
    if (fila.estado === ESTADOS.LIQUIDADA) documentos.push(...await this.comprobantesComoDocumentos(fila));
    return documentos;
  }

  async comprobantesComoDocumentos(fila) {
    const comprobantes = await comprobanteRepo.listar(fila.id);
    return comprobantes.map((c, i) => {
      const datos = { numero: i + 1, rubro: c.tipoGastoNombre, moneda: fila.monedaSimbolo, monto: formatear(aCentavos(c.monto)) };
      return {
        titulo: c.descripcion ? msg('documento.tituloComprobanteDescrito', { ...datos, descripcion: c.descripcion }) : msg('documento.tituloComprobante', datos),
        tipo: c.mimeType === TIPO_PDF ? 'pdf' : 'imagen',
        url: c.ruta
      };
    });
  }
}

module.exports = new DocumentoService();
