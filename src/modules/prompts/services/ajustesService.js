// src/modules/prompts/services/ajustesService.js
// Ajustes globales del módulo (contenido y límites editables). Se leen en cada petición: la tabla es diminuta.
const ajustesRepository = require('../repositories/ajustesRepository');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const config = require('../../../config/env');
const { CLAVES, validarAjuste, migracionDe } = require('./ajustesEsquema');
const { msg } = require('../mensajes');
const { errorDeValidacion } = require('../errores');

// mysql2 ya entrega el JSON parseado (un texto llega como texto plano) y MariaDB lo entrega como texto JSON: se acepta ambos.
function leerValor(valor) {
  if (typeof valor !== 'string') return valor;
  try {
    const leido = JSON.parse(valor);
    return typeof leido === 'string' || typeof leido === 'object' ? leido : valor;
  } catch {
    return valor;
  }
}

const aFila = f => ({ clave: f.clave, descripcion: f.descripcion, valor: leerValor(f.valor), actualizadoEn: f.actualizado_en });

class AjustesService {
  // Sin valores por defecto en el código: si falta un ajuste, la migración no se aplicó.
  async obtenerTodos() {
    const filas = await ajustesRepository.listar();
    const ajustes = {};
    filas.forEach(f => { ajustes[f.clave] = leerValor(f.valor); });
    const falta = CLAVES.find(clave => !Object.prototype.hasOwnProperty.call(ajustes, clave));
    if (falta) throw new ErrorDeNegocio(msg('ajuste.faltante', { clave: falta, migracion: migracionDe(falta) }), 500);
    return ajustes;
  }

  async listar() {
    const filas = (await ajustesRepository.listar()).map(aFila);
    return CLAVES.map(clave => filas.find(f => f.clave === clave)).filter(Boolean);
  }

  async guardar(clave, valor) {
    if (!CLAVES.includes(clave)) throw new ErrorDeNegocio(msg('ajuste.noExiste', { clave, disponibles: CLAVES.join(', ') }), 404);
    if (valor === undefined) throw errorDeValidacion(msg('ajuste.sinValor', { clave }), { [clave]: msg('ajuste.sinValor', { clave }) });
    const errores = validarAjuste(clave, valor, { urlSupabase: config.supabase.url });
    if (errores.length) throw errorDeValidacion(errores.join(' '), { [clave]: errores.join(' ') });
    if (!await ajustesRepository.obtenerPorClave(clave)) throw new ErrorDeNegocio(msg('ajuste.faltante', { clave, migracion: migracionDe(clave) }), 500);
    await ajustesRepository.guardarValor(clave, valor);
    return aFila(await ajustesRepository.obtenerPorClave(clave));
  }
}

module.exports = new AjustesService();
