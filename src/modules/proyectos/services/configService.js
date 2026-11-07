// src/modules/proyectos/services/configService.js
// Lee y guarda la configuración del módulo. Cada cambio queda en proy_config_historial dentro de la misma
// transacción. Los valores se guardan con caché; cada proyecto copia lo que usa en su `config_snapshot` al activarse.
const db = require('../../../config/database');
const configRepository = require('../repositories/configRepository');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { errorDeValidacion } = require('../errores');
const P = require('../parametros');

const VIGENCIA_CACHE_MS = 60 * 1000;

const copiar = valor => (Array.isArray(valor) ? [...valor] : valor);
const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const PREFIJO_TELEFONO = /^\+\d{1,4}$/;
const FORMATO_TELEFONO = /^[#0-9 ()-]{1,30}$/;

const paraApi = fila => ({
  paisId: fila.pais_id,
  codigo: fila.codigo,
  nombre: fila.nombre,
  monedaCodigo: fila.moneda_codigo || null,
  prefijoTelefono: fila.prefijo_telefono || null,
  formatoTelefono: fila.formato_telefono || null,
  // Sin fila de configuración manda el valor de siempre: la referencia es obligatoria.
  referenciaObligatoria: fila.referencia_obligatoria === null || fila.referencia_obligatoria === undefined ? true : !!fila.referencia_obligatoria,
  confirmacionVentas: fila.confirmacion_ventas === null || fila.confirmacion_ventas === undefined ? null : !!fila.confirmacion_ventas
});

class ConfigService {
  constructor() {
    this.cache = null;
    this.cargadoEn = 0;
  }

  invalidar() {
    this.cache = null;
  }

  // Todos los valores vigentes ya tipados: el de la base o, si falta, el valor por defecto del registro.
  async valores() {
    if (!this.cache || Date.now() - this.cargadoEn > VIGENCIA_CACHE_MS) {
      const valores = P.valoresPorDefecto();
      for (const fila of await configRepository.listarParametros()) {
        const clave = fila.clave.slice(P.PREFIJO.length);
        const def = P.definicion(clave);
        if (def) valores[clave] = P.deserializar(def, fila.valor);
      }
      this.cache = valores;
      this.cargadoEn = Date.now();
    }
    return Object.fromEntries(Object.entries(this.cache).map(([clave, valor]) => [clave, copiar(valor)]));
  }

  async obtener(clave) {
    if (!P.definicion(clave)) throw new Error(`Parámetro de Proyectos desconocido: ${clave}`);
    return (await this.valores())[clave];
  }

  // Lo que dibuja la pantalla del administrador: grupos con cada ajuste, su valor vigente y su valor por defecto.
  async describir(pantalla = 'parametros') {
    const valores = await this.valores();
    return P.GRUPOS
      .map(grupo => ({
        id: grupo.id,
        nombre: grupo.nombre,
        descripcion: grupo.descripcion,
        parametros: P.PARAMETROS
          .filter(p => p.grupo === grupo.id && (p.pantalla || 'parametros') === pantalla)
          .map(p => ({
            clave: p.clave, tipo: p.tipo, etiqueta: p.etiqueta, ayuda: p.ayuda, nota: p.nota || null, permiso: p.permiso || null, unidad: p.unidad || null,
            min: p.min ?? null, max: p.max ?? null, opciones: p.opciones || null, longitudMax: p.longitudMax || null,
            valor: valores[p.clave], defecto: copiar(p.defecto), esDefecto: iguales(valores[p.clave], p.defecto)
          }))
      }))
      .filter(grupo => grupo.parametros.length);
  }

  // Guarda solo lo que cambió. Devuelve las claves modificadas. Con `pantalla` rechaza los ajustes de otra pantalla
  // (los parámetros se editan en A3 y las reglas en A5).
  async guardar(cambios, usuarioId, pantalla = null) {
    if (pantalla) {
      const ajenos = Object.keys(cambios || {}).filter(clave => {
        const def = P.definicion(clave);
        return def && (def.pantalla || 'parametros') !== pantalla;
      });
      if (ajenos.length) {
        throw errorDeValidacion('Revisa los ajustes marcados.', Object.fromEntries(ajenos.map(clave => [clave, 'Este ajuste no se edita en esta pantalla.'])));
      }
    }
    this.invalidar();
    const actuales = await this.valores();
    const nuevos = P.validarCambios(cambios, actuales);
    const modificados = Object.keys(nuevos).filter(clave => !iguales(nuevos[clave], actuales[clave]));
    if (!modificados.length) return [];
    await db.transaccion(async tx => {
      for (const clave of modificados) {
        const def = P.definicion(clave);
        await configRepository.guardarParametro(tx, P.claveCompleta(clave), P.serializar(def, nuevos[clave]));
        await configRepository.registrarHistorial(tx, {
          usuarioId, entidad: 'parametro', clave, accion: 'cambiar', antes: { valor: actuales[clave] }, despues: { valor: nuevos[clave] }
        });
      }
    });
    this.invalidar();
    return modificados;
  }

  // Quita la fila: el ajuste vuelve al valor por defecto del registro.
  async restaurar(clave, usuarioId) {
    const def = P.definicion(clave);
    if (!def) throw errorDeValidacion('Este ajuste no existe.', { [clave]: 'Este ajuste no existe.' });
    this.invalidar();
    const actual = (await this.valores())[clave];
    await db.transaccion(async tx => {
      await configRepository.borrarParametro(tx, P.claveCompleta(clave));
      if (!iguales(actual, def.defecto)) {
        await configRepository.registrarHistorial(tx, {
          usuarioId, entidad: 'parametro', clave, accion: 'restaurar', antes: { valor: actual }, despues: { valor: copiar(def.defecto) }
        });
      }
    });
    this.invalidar();
    return copiar(def.defecto);
  }

  // --- Configuración por país ---

  async paises() {
    return (await configRepository.listarPaises()).map(paraApi);
  }

  async pais(paisId) {
    const fila = await configRepository.obtenerPais(paisId);
    return fila ? paraApi(fila) : null;
  }

  // `datos` puede traer solo lo que cambia; lo demás se conserva.
  async guardarPais(paisId, datos, usuarioId) {
    const actual = await this.pais(paisId);
    if (!actual) throw new ErrorDeNegocio('El país no existe.', 404);
    const nuevo = { ...actual, ...pick(datos) };
    const campos = {};

    if (nuevo.monedaCodigo !== null && !(await configRepository.monedaActiva(nuevo.monedaCodigo))) campos.monedaCodigo = 'Elige una moneda activa.';
    if (nuevo.prefijoTelefono !== null && !PREFIJO_TELEFONO.test(nuevo.prefijoTelefono)) campos.prefijoTelefono = 'Escribe el prefijo como +502.';
    if (nuevo.formatoTelefono !== null && !FORMATO_TELEFONO.test(nuevo.formatoTelefono)) campos.formatoTelefono = 'Usa # para cada dígito, por ejemplo #### ####.';
    if (typeof nuevo.referenciaObligatoria !== 'boolean') campos.referenciaObligatoria = 'Elige sí o no.';
    if (nuevo.confirmacionVentas !== null && typeof nuevo.confirmacionVentas !== 'boolean') campos.confirmacionVentas = 'Elige heredar, sí o no.';
    if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos del país.', campos);

    const { paisId: _a, codigo: _b, nombre: _c, ...antes } = actual;
    const { paisId: _d, codigo: _e, nombre: _f, ...despues } = nuevo;
    if (iguales(antes, despues)) return false;
    await db.transaccion(async tx => {
      await configRepository.guardarPais(tx, paisId, nuevo);
      await configRepository.registrarHistorial(tx, { usuarioId, entidad: 'pais', clave: actual.codigo, accion: 'cambiar', antes, despues });
    });
    return true;
  }

  // ¿La referencia (cotización u orden de venta) es obligatoria en este país?
  async referenciaObligatoria(paisId) {
    const pais = await this.pais(paisId);
    return pais ? pais.referenciaObligatoria : true;
  }

  // La confirmación de ventas del país, o la regla global si el país hereda.
  async confirmacionVentas(paisId) {
    const pais = await this.pais(paisId);
    if (pais && pais.confirmacionVentas !== null) return pais.confirmacionVentas;
    return this.obtener('reglas.confirmar_ventas');
  }
}

const CAMPOS_PAIS = ['monedaCodigo', 'prefijoTelefono', 'formatoTelefono', 'referenciaObligatoria', 'confirmacionVentas'];
const pick = datos => Object.fromEntries(
  Object.entries(datos || {}).filter(([clave]) => CAMPOS_PAIS.includes(clave)).map(([clave, valor]) => [clave, valor === '' ? null : valor])
);

module.exports = new ConfigService();
