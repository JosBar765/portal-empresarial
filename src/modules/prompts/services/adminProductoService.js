// src/modules/prompts/services/adminProductoService.js
// Administración de productos: un borrador y una versión publicada por producto.
const db = require('../../../config/database');
const productoRepository = require('../repositories/productoRepository');
const versionRepository = require('../repositories/versionRepository');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { idObligatorio } = require('../../../core/utils/validar');
const { validarEsquema, validarValores, parametrosPlanos } = require('./esquemaService');
const { validarTextosDeReglas, renderizar } = require('./plantillaService');
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
  id: v.id, numero: v.numero, estado: v.estado, esquema: leerJson(v.esquema), plantilla: '', // plantilla: deprecado, sin uso desde que el prompt se autogenera
  publicadoEn: v.publicado_en, actualizadoEn: v.actualizado_en
} : null);

// Agrupa los errores por clave del esquema (las reglas bajo «reglas», los recursos bajo «recursos»).
function aCampos(errores) {
  const campos = {};
  errores.forEach(e => {
    const campo = e.clave || 'esquema';
    campos[campo] = campos[campo] ? `${campos[campo]} ${e.mensaje}` : e.mensaje;
  });
  return campos;
}

// Esquema bien formado y reglas con sintaxis válida; al publicar, además al menos un parámetro.
function exigirContenido(esquema, ajustes, { paraPublicar }) {
  const errores = validarEsquema(esquema, ajustes);
  if (errores.length) return errores;
  if (paraPublicar) {
    if (!parametrosPlanos(esquema).length) errores.push({ mensaje: msg('version.sinParametros') });
  }
  return [...errores, ...validarTextosDeReglas(esquema)];
}

// Limpia y valida código, nombre y descripción de un producto nuevo (alta y duplicado) con los límites de los ajustes.
function validarDatosDeProducto({ codigo, nombre, descripcion } = {}, limites) {
  const campos = {};
  const codigoLimpio = typeof codigo === 'string' ? codigo.trim() : '';
  const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
  const descripcionLimpia = typeof descripcion === 'string' ? descripcion.trim() : '';
  if (!CODIGO_PRODUCTO_RE.test(codigoLimpio)) campos.codigo = msg('producto.codigo', { valor: JSON.stringify(codigoLimpio) });
  if (!nombreLimpio || nombreLimpio.length > limites.producto_nombre_max) {
    campos.nombre = msg('producto.nombre', { max: limites.producto_nombre_max, largo: nombreLimpio.length });
  }
  if (descripcionLimpia.length > limites.producto_descripcion_max) {
    campos.descripcion = msg('producto.descripcion', { max: limites.producto_descripcion_max, largo: descripcionLimpia.length });
  }
  if (Object.keys(campos).length) throw errorDeValidacion(msg('producto.revisar'), campos);
  return { codigo: codigoLimpio, nombre: nombreLimpio, descripcion: descripcionLimpia || null };
}

// Producto en «borrador» con su versión 1 en borrador, dentro de la transacción del llamador.
async function insertarProductoConBorrador(datos, esquema, usuarioId, tx) {
  if (await productoRepository.existeCodigo(datos.codigo, tx)) throw new ErrorDeNegocio(msg('producto.codigoRepetido', { codigo: datos.codigo }), 409);
  const productoId = await productoRepository.crear({ ...datos, creadoPor: usuarioId }, tx);
  await versionRepository.crearBorrador({ productoId, numero: 1, esquema, creadoPor: usuarioId }, tx);
  return productoId;
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

  async crear(datos, usuarioId) {
    const { limites } = await ajustesService.obtenerTodos();
    const validos = validarDatosDeProducto(datos, limites);
    const id = await db.transaccion(tx => insertarProductoConBorrador(validos, ESQUEMA_VACIO, usuarioId, tx));
    return this.obtener(id);
  }

  // Producto nuevo con una copia del esquema del origen (publicada, o el borrador si no hay) como borrador v1; nunca queda publicado.
  async duplicar(idCrudo, datos, usuarioId) {
    const origenId = idObligatorio(idCrudo, 'Producto');
    const { limites } = await ajustesService.obtenerTodos();
    const validos = validarDatosDeProducto(datos, limites);
    const id = await db.transaccion(async tx => {
      if (!await productoRepository.obtenerBloqueado(origenId, tx)) throw new ErrorDeNegocio(msg('producto.noEncontrado'), 404);
      const origen = await versionRepository.obtenerPorEstado(origenId, ESTADOS_VERSION.PUBLICADA, tx)
        || await versionRepository.obtenerPorEstado(origenId, ESTADOS_VERSION.BORRADOR, tx);
      if (!origen) throw new ErrorDeNegocio(msg('producto.duplicarSinVersion'), 409);
      return insertarProductoConBorrador(validos, leerJson(origen.esquema), usuarioId, tx); // leerJson parsea de nuevo: la copia no comparte referencias
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
      if (!await productoRepository.obtenerBloqueado(id, tx)) throw new ErrorDeNegocio(msg('producto.noEncontrado'), 404);
      if (await versionRepository.obtenerPorEstado(id, ESTADOS_VERSION.BORRADOR, tx)) throw new ErrorDeNegocio(msg('producto.yaTieneBorrador'), 409);
      const publicada = await versionRepository.obtenerPorEstado(id, ESTADOS_VERSION.PUBLICADA, tx);
      if (!publicada) throw new ErrorDeNegocio(msg('producto.sinPublicada'), 409);
      await versionRepository.crearBorrador({
        productoId: id,
        numero: await versionRepository.siguienteNumero(id, tx),
        esquema: leerJson(publicada.esquema),
        creadoPor: usuarioId
      }, tx);
    });
    return this.obtener(id);
  }

  async guardarBorrador(idCrudo, { esquema } = {}) {
    const id = idObligatorio(idCrudo, 'Producto');
    await this._exigirProducto(id);
    const borrador = await this._exigirBorrador(id);

    // Guardar exige un esquema bien formado y reglas con sintaxis válida; publicar suma los mínimos de contenido.
    const ajustes = await ajustesService.obtenerTodos();
    const errores = exigirContenido(esquema, ajustes, { paraPublicar: false });
    if (errores.length) throw errorDeValidacion(msg('version.revisarBorrador'), aCampos(errores));

    if (!await versionRepository.guardarBorrador(borrador.id, esquema)) {
      throw new ErrorDeNegocio(msg('version.borradorDesaparecido'), 409);
    }
    return this.obtener(id);
  }

  async descartarBorrador(idCrudo) {
    const id = idObligatorio(idCrudo, 'Producto');
    await this._exigirProducto(id);
    const borrador = await this._exigirBorrador(id);
    if (await versionRepository.contarPorProducto(id) <= 1) {
      throw new ErrorDeNegocio(msg('version.unicaVersion'), 409);
    }
    await versionRepository.eliminarBorrador(borrador.id);
    return this.obtener(id);
  }

  async publicar(idCrudo) {
    const id = idObligatorio(idCrudo, 'Producto');
    const ajustes = await ajustesService.obtenerTodos();
    await db.transaccion(async tx => {
      const producto = await productoRepository.obtenerBloqueado(id, tx);
      if (!producto) throw new ErrorDeNegocio(msg('producto.noEncontrado'), 404);
      const borrador = await versionRepository.obtenerPorEstado(id, ESTADOS_VERSION.BORRADOR, tx);
      if (!borrador) throw new ErrorDeNegocio(msg('version.sinBorradorParaPublicar'), 409);

      const esquema = leerJson(borrador.esquema);
      const errores = exigirContenido(esquema, ajustes, { paraPublicar: true });
      if (errores.length) throw errorDeValidacion(msg('version.errores'), aCampos(errores));

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
      const texto = msg('producto.estadoInvalido', { valor: JSON.stringify(estado) ?? 'ninguno' });
      throw errorDeValidacion(texto, { estado: texto });
    }
    await this._exigirProducto(id);
    if (estado === ESTADOS_PRODUCTO.ACTIVO && !await versionRepository.obtenerPorEstado(id, ESTADOS_VERSION.PUBLICADA)) {
      throw new ErrorDeNegocio(msg('producto.activarSinPublicada'), 409);
    }
    await productoRepository.actualizarEstado(id, estado);
    return this.obtener(id);
  }

  // Borrado real de inactivos o de borradores nunca publicados; la fila bloqueada impide que alguien lo reactive mientras se borra.
  async borrar(idCrudo) {
    const id = idObligatorio(idCrudo, 'Producto');
    await db.transaccion(async tx => {
      const producto = await productoRepository.obtenerBloqueado(id, tx);
      if (!producto) throw new ErrorDeNegocio(msg('producto.noEncontrado'), 404);
      if (producto.estado !== ESTADOS_PRODUCTO.INACTIVO && producto.estado !== ESTADOS_PRODUCTO.BORRADOR) {
        throw new ErrorDeNegocio(msg('producto.borrarNoInactivo', { nombre: producto.nombre, estado: producto.estado }), 409);
      }
      await versionRepository.eliminarPorProducto(id, tx); // la FK de versiones no tiene ON DELETE CASCADE: van primero
      await productoRepository.eliminar(id, tx);
    });
    return { ok: true };
  }

  // Sin persistir nada: autogenera el prompt completo del esquema del borrador con los valores enviados (o los defectos) y el contacto de ejemplo.
  // `sinUsar` ya no existe como concepto (todo parámetro con valor sale en el prompt) y se devuelve vacío por compatibilidad.
  async previsualizar({ esquema, valores, imagenes } = {}) {
    const ajustes = await ajustesService.obtenerTodos();
    const errores = exigirContenido(esquema, ajustes, { paraPublicar: false });
    if (errores.length) return { prompt: '', imagenes: [], totalImagenes: 0, reglas: [], sinUsar: [], errores };

    const validado = validarValores(esquema, valores, imagenes, ajustes);
    const erroresValores = Object.entries(validado.errores).map(([clave, mensaje]) => ({ clave, mensaje }));
    const { nombre, correo, telefono } = ajustes.contacto_ejemplo;
    const resultado = renderizar({
      esquema, valores: validado.valores, imagenes: validado.imagenes, contacto: { nombre, email: correo, telefono }, ajustes
    });
    return { ...resultado, sinUsar: [], errores: erroresValores };
  }

  async _exigirProducto(id) {
    const producto = await productoRepository.obtenerPorId(id);
    if (!producto) throw new ErrorDeNegocio(msg('producto.noEncontrado'), 404);
    return producto;
  }

  async _exigirBorrador(productoId) {
    const borrador = await versionRepository.obtenerPorEstado(productoId, ESTADOS_VERSION.BORRADOR);
    if (!borrador) throw new ErrorDeNegocio(msg('version.sinBorrador'), 409);
    return borrador;
  }
}

module.exports = new AdminProductoService();
