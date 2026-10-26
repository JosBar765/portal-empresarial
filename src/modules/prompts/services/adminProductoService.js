// src/modules/prompts/services/adminProductoService.js
// Administración de productos: un borrador y una versión publicada por producto.
const db = require('../../../config/database');
const productoRepository = require('../repositories/productoRepository');
const versionRepository = require('../repositories/versionRepository');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { idObligatorio } = require('../../../core/utils/validar');
const { validarEsquema, validarValores, parametrosPlanos } = require('./esquemaService');
const { validarPlantilla, renderizar, parametrosSinUsar } = require('./plantillaService');
const { leerJson } = require('./documento');
const ajustesService = require('./ajustesService');
const { ESTADOS_PRODUCTO, ESTADOS_VERSION, CODIGO_PRODUCTO_RE } = require('../constantes');
const { errorDeValidacion } = require('../errores');
const { msg } = require('../mensajes');

const ESQUEMA_VACIO = Object.freeze({ esquema_version: 1, grupos: [] });

const aProducto = p => ({
  id: p.id, codigo: p.codigo, nombre: p.nombre, descripcion: p.descripcion,
  estado: p.estado, creadoEn: p.creado_en, actualizadoEn: p.actualizado_en
});

const aVersion = v => (v ? {
  id: v.id, numero: v.numero, estado: v.estado, esquema: leerJson(v.esquema), plantilla: v.plantilla,
  publicadoEn: v.publicado_en, actualizadoEn: v.actualizado_en
} : null);

// Agrupa los errores de esquema por clave y los de plantilla bajo «plantilla».
function aCampos(erroresEsquema, erroresPlantilla) {
  const campos = {};
  const sumar = (campo, mensaje) => { campos[campo] = campos[campo] ? `${campos[campo]} ${mensaje}` : mensaje; };
  erroresEsquema.forEach(e => sumar(e.clave || 'esquema', e.mensaje));
  erroresPlantilla.forEach(e => sumar('plantilla', e.mensaje));
  return campos;
}

const errorDeLargo = (plantilla, ajustes) => (typeof plantilla === 'string' && plantilla.length > ajustes.limites.plantilla_max_largo
  ? [{ mensaje: msg('plantilla.larga', { max: ajustes.limites.plantilla_max_largo, largo: plantilla.length }) }]
  : []);

function exigirContenido(esquema, plantilla, ajustes, { alMenosUnParametro }) {
  const erroresEsquema = validarEsquema(esquema, ajustes);
  if (alMenosUnParametro && !erroresEsquema.length && !parametrosPlanos(esquema).length) {
    erroresEsquema.push({ mensaje: 'Agrega al menos un parámetro.' });
  }
  const largo = errorDeLargo(plantilla, ajustes);
  const erroresPlantilla = largo.length ? largo : (erroresEsquema.length ? [] : validarPlantilla(plantilla, esquema));
  return { erroresEsquema, erroresPlantilla };
}

class AdminProductoService {
  async listar() {
    const filas = await productoRepository.listarConResumen();
    return filas.map(f => ({
      id: f.id,
      codigo: f.codigo,
      nombre: f.nombre,
      estado: f.estado,
      numeroVigente: f.numero_vigente === null ? null : Number(f.numero_vigente),
      tieneBorrador: Boolean(Number(f.tiene_borrador)),
      totalParametros: f.esquema ? parametrosPlanos(leerJson(f.esquema)).length : 0,
      actualizadoEn: f.actualizado_en
    }));
  }

  async crear({ codigo, nombre, descripcion } = {}, usuarioId) {
    const { limites } = await ajustesService.obtenerTodos();
    const campos = {};
    const codigoLimpio = typeof codigo === 'string' ? codigo.trim() : '';
    const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
    const descripcionLimpia = typeof descripcion === 'string' ? descripcion.trim() : '';
    if (!CODIGO_PRODUCTO_RE.test(codigoLimpio)) campos.codigo = 'Usa minúsculas, números y guion bajo (2 a 50 caracteres), empezando con letra.';
    if (!nombreLimpio || nombreLimpio.length > limites.producto_nombre_max) {
      campos.nombre = msg('producto.nombre', { max: limites.producto_nombre_max, largo: nombreLimpio.length });
    }
    if (descripcionLimpia.length > limites.producto_descripcion_max) {
      campos.descripcion = msg('producto.descripcion', { max: limites.producto_descripcion_max, largo: descripcionLimpia.length });
    }
    if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos del producto.', campos);

    const id = await db.transaccion(async tx => {
      if (await productoRepository.existeCodigo(codigoLimpio, tx)) throw new ErrorDeNegocio('Ya existe un producto con ese código.', 409);
      const productoId = await productoRepository.crear({
        codigo: codigoLimpio, nombre: nombreLimpio, descripcion: descripcionLimpia || null, creadoPor: usuarioId
      }, tx);
      await versionRepository.crearBorrador({
        productoId, numero: 1, esquema: ESQUEMA_VACIO, plantilla: '', creadoPor: usuarioId
      }, tx);
      return productoId;
    });
    return this.obtener(id);
  }

  async obtener(idCrudo) {
    const id = idObligatorio(idCrudo, 'Producto');
    const producto = await this._exigirProducto(id);
    const [borrador, publicada] = await Promise.all([
      versionRepository.obtenerPorEstado(id, ESTADOS_VERSION.BORRADOR),
      versionRepository.obtenerPorEstado(id, ESTADOS_VERSION.PUBLICADA)
    ]);
    return { producto: aProducto(producto), borrador: aVersion(borrador), publicada: aVersion(publicada) };
  }

  async crearBorrador(idCrudo, usuarioId) {
    const id = idObligatorio(idCrudo, 'Producto');
    await db.transaccion(async tx => {
      if (!await productoRepository.obtenerBloqueado(id, tx)) throw new ErrorDeNegocio('Producto no encontrado.', 404);
      if (await versionRepository.obtenerPorEstado(id, ESTADOS_VERSION.BORRADOR, tx)) throw new ErrorDeNegocio('El producto ya tiene un borrador.', 409);
      const publicada = await versionRepository.obtenerPorEstado(id, ESTADOS_VERSION.PUBLICADA, tx);
      if (!publicada) throw new ErrorDeNegocio('El producto no tiene una versión publicada para copiar.', 409);
      await versionRepository.crearBorrador({
        productoId: id,
        numero: await versionRepository.siguienteNumero(id, tx),
        esquema: leerJson(publicada.esquema),
        plantilla: publicada.plantilla,
        creadoPor: usuarioId
      }, tx);
    });
    return this.obtener(id);
  }

  async guardarBorrador(idCrudo, { esquema, plantilla } = {}) {
    const id = idObligatorio(idCrudo, 'Producto');
    await this._exigirProducto(id);
    const borrador = await this._exigirBorrador(id);
    if (typeof plantilla !== 'string') throw errorDeValidacion('Revisa el borrador.', { plantilla: 'La plantilla debe ser texto.' });

    // Guardar solo exige un esquema bien formado; la plantilla se valida completa al publicar.
    const ajustes = await ajustesService.obtenerTodos();
    const erroresEsquema = validarEsquema(esquema, ajustes);
    const largo = errorDeLargo(plantilla, ajustes);
    if (erroresEsquema.length || largo.length) throw errorDeValidacion('Revisa el borrador.', aCampos(erroresEsquema, largo));

    if (!await versionRepository.guardarBorrador(borrador.id, esquema, plantilla)) {
      throw new ErrorDeNegocio('El borrador ya no existe. Recarga la página.', 409);
    }
    return this.obtener(id);
  }

  async descartarBorrador(idCrudo) {
    const id = idObligatorio(idCrudo, 'Producto');
    await this._exigirProducto(id);
    const borrador = await this._exigirBorrador(id);
    if (await versionRepository.contarPorProducto(id) <= 1) {
      throw new ErrorDeNegocio('No se puede descartar el borrador: es la única versión del producto.', 409);
    }
    await versionRepository.eliminarBorrador(borrador.id);
    return this.obtener(id);
  }

  async publicar(idCrudo) {
    const id = idObligatorio(idCrudo, 'Producto');
    const ajustes = await ajustesService.obtenerTodos();
    await db.transaccion(async tx => {
      const producto = await productoRepository.obtenerBloqueado(id, tx);
      if (!producto) throw new ErrorDeNegocio('Producto no encontrado.', 404);
      const borrador = await versionRepository.obtenerPorEstado(id, ESTADOS_VERSION.BORRADOR, tx);
      if (!borrador) throw new ErrorDeNegocio('El producto no tiene un borrador para publicar.', 409);

      const esquema = leerJson(borrador.esquema);
      const { erroresEsquema, erroresPlantilla } = exigirContenido(esquema, borrador.plantilla, ajustes, { alMenosUnParametro: true });
      if (erroresEsquema.length || erroresPlantilla.length) {
        throw errorDeValidacion('El borrador tiene errores y no se puede publicar.', aCampos(erroresEsquema, erroresPlantilla));
      }

      const anterior = await versionRepository.obtenerPorEstado(id, ESTADOS_VERSION.PUBLICADA, tx);
      if (anterior) await versionRepository.archivar(anterior.id, tx);
      await versionRepository.publicar(borrador.id, tx);
      if (producto.estado === ESTADOS_PRODUCTO.BORRADOR) await productoRepository.actualizarEstado(id, ESTADOS_PRODUCTO.ACTIVO, tx);
    });
    return this.obtener(id);
  }

  async cambiarEstado(idCrudo, estado) {
    const id = idObligatorio(idCrudo, 'Producto');
    if (estado !== ESTADOS_PRODUCTO.ACTIVO && estado !== ESTADOS_PRODUCTO.INACTIVO) {
      throw errorDeValidacion('Estado no válido.', { estado: 'Usa «activo» o «inactivo».' });
    }
    await this._exigirProducto(id);
    if (estado === ESTADOS_PRODUCTO.ACTIVO && !await versionRepository.obtenerPorEstado(id, ESTADOS_VERSION.PUBLICADA)) {
      throw new ErrorDeNegocio('Para activar el producto primero publica una versión.', 409);
    }
    await productoRepository.actualizarEstado(id, estado);
    return this.obtener(id);
  }

  // Sin persistir nada: renderiza con los valores enviados (o los defectos) y el contacto de ejemplo de los ajustes.
  async previsualizar({ esquema, plantilla, valores, imagenes } = {}) {
    const ajustes = await ajustesService.obtenerTodos();
    const erroresEsquema = validarEsquema(esquema, ajustes);
    const erroresPlantilla = erroresEsquema.length ? [] : validarPlantilla(plantilla, esquema);
    const errores = [...erroresEsquema, ...erroresPlantilla];
    if (errores.length) {
      return { prompt: '', imagenes: [], totalImagenes: 0, sinUsar: erroresEsquema.length ? [] : parametrosSinUsar(esquema, plantilla), errores };
    }

    const validado = validarValores(esquema, valores, imagenes, ajustes);
    const erroresValores = Object.entries(validado.errores).map(([clave, mensaje]) => ({ clave, mensaje }));
    const { nombre, correo, telefono } = ajustes.contacto_ejemplo;
    const resultado = renderizar({
      plantilla, esquema, valores: validado.valores, imagenes: validado.imagenes, contacto: { nombre, email: correo, telefono }, ajustes
    });
    return { ...resultado, sinUsar: parametrosSinUsar(esquema, plantilla), errores: erroresValores };
  }

  async _exigirProducto(id) {
    const producto = await productoRepository.obtenerPorId(id);
    if (!producto) throw new ErrorDeNegocio('Producto no encontrado.', 404);
    return producto;
  }

  async _exigirBorrador(productoId) {
    const borrador = await versionRepository.obtenerPorEstado(productoId, ESTADOS_VERSION.BORRADOR);
    if (!borrador) throw new ErrorDeNegocio('El producto no tiene borrador.', 409);
    return borrador;
  }
}

module.exports = new AdminProductoService();
