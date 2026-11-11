// src/modules/viaticos/services/documentoService.js
// Documentos de una solicitud: el PDF y las fotos de defectos que alimentan el visor.
const solicitudRepo = require('../repositories/solicitudRepository');
const solicitudService = require('./solicitudService');
const { msg } = require('../mensajes');

const TIPO_PDF = 'application/pdf';

class DocumentoService {
  // Lo implementa la generación del PDF; hasta entonces no hace nada y devuelve null.
  async regenerarPdf(solicitudId) {
    return null;
  }

  // Las rutas guardadas ya son las URLs públicas de Storage.
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
