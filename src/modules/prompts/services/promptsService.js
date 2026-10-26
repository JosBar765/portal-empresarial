// src/modules/prompts/services/promptsService.js
// Lado del asesor: productos disponibles, contacto y generación del prompt (no escribe en la base).
const productoRepository = require('../repositories/productoRepository');
const versionRepository = require('../repositories/versionRepository');
const contactoRepository = require('../repositories/contactoRepository');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { idObligatorio } = require('../../../core/utils/validar');
const { validarValores } = require('./esquemaService');
const { renderizar } = require('./plantillaService');
const { leerJson } = require('./documento');
const ajustesService = require('./ajustesService');
const { urlParaCliente } = require('./recursos');
const { ESTADOS_VERSION, VARIABLES_AUTOMATICAS } = require('../constantes');
const { errorDeValidacion } = require('../errores');
const { msg } = require('../mensajes');

const telefonoOnull = telefono => (typeof telefono === 'string' && telefono.trim() ? telefono.trim() : null);

class PromptsService {
  async listarProductos() {
    const filas = await productoRepository.listarActivosConPublicada();
    return filas.map(f => ({
      id: f.id,
      codigo: f.codigo,
      nombre: f.nombre,
      descripcion: f.descripcion,
      version: { id: f.version_id, numero: f.numero, esquema: leerJson(f.esquema) }
    }));
  }

  // Todo lo que el formulario necesita saber de los límites y formatos, desde un solo lugar.
  async obtenerConfig() {
    const ajustes = await ajustesService.obtenerTodos();
    return {
      limites: ajustes.limites,
      formatosImagen: ajustes.formatos_imagen,
      textosAsesor: ajustes.textos_asesor,
      variablesAutomaticas: [...VARIABLES_AUTOMATICAS]
    };
  }

  async obtenerContacto(usuarioId) {
    const fila = await contactoRepository.obtenerPorUsuario(usuarioId);
    if (!fila) throw new ErrorDeNegocio(msg('asesor.usuarioNoEncontrado'), 404);
    return { nombre: fila.nombre, email: fila.email, telefono: telefonoOnull(fila.telefono) };
  }

  async generar(usuarioId, { productoId, valores, imagenes, sinTelefono } = {}) {
    const id = idObligatorio(productoId, 'Producto');
    const producto = await productoRepository.obtenerPorId(id);
    const version = producto && producto.estado === 'activo'
      ? await versionRepository.obtenerPorEstado(id, ESTADOS_VERSION.PUBLICADA)
      : null;
    if (!version) throw new ErrorDeNegocio(msg('asesor.productoNoDisponible'), 404);

    const esquema = leerJson(version.esquema);
    const ajustes = await ajustesService.obtenerTodos();
    const validado = validarValores(esquema, valores, imagenes, ajustes);
    if (Object.keys(validado.errores).length) throw errorDeValidacion(msg('asesor.revisarFormulario'), validado.errores);

    const contacto = await this.obtenerContacto(usuarioId);
    if (!contacto.telefono && sinTelefono !== true) {
      const error = new ErrorDeNegocio(msg('asesor.sinTelefono'), 409);
      error.codigo = 'TELEFONO_FALTANTE';
      throw error;
    }

    const resultado = renderizar({
      plantilla: version.plantilla,
      esquema,
      valores: validado.valores,
      imagenes: validado.imagenes,
      contacto,
      ajustes,
      urlRecurso: recurso => urlParaCliente(recurso, id)
    });
    return { ...resultado, contacto };
  }
}

module.exports = new PromptsService();
