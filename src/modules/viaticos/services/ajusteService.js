// src/modules/viaticos/services/ajusteService.js
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const repo = require('../repositories/ajusteRepository');
const { AJUSTES } = require('../constantes');
const { cuerpoObjeto, mostrar } = require('../validacion');
const { errorDeValidacion } = require('../errores');
const { parsearJson } = require('../utilidades');
const { msg } = require('../mensajes');

function aAjuste(fila) {
  return { clave: fila.clave, valor: parsearJson(fila.valor), descripcion: fila.descripcion };
}

// Devuelve el valor ya normalizado o lanza el error por campo «valor».
function validarValor(clave, def, valor) {
  const falla = mensaje => errorDeValidacion(msg('validacion.revisar'), { valor: mensaje });
  if (def.tipo === 'lista') {
    const valida = Array.isArray(valor) && valor.length > 0 && new Set(valor).size === valor.length
      && valor.every(tipo => def.permitidos.includes(tipo));
    if (!valida) throw falla(msg('ajuste.lista', { clave, permitidos: def.permitidos.join(', ') }));
    return valor;
  }
  const esEntero = (typeof valor === 'number' && Number.isInteger(valor)) || (typeof valor === 'string' && /^\d{1,10}$/.test(valor.trim()));
  const numero = esEntero ? Number(valor) : NaN;
  if (!(numero >= def.min && numero <= def.max)) {
    throw falla(msg('ajuste.entero', { clave, min: def.min, max: def.max, valor: mostrar(valor) }));
  }
  return numero;
}

class AjusteService {
  async listar() {
    return (await repo.listar()).map(aAjuste);
  }

  async guardar(clave, cuerpo) {
    if (!Object.prototype.hasOwnProperty.call(AJUSTES, clave)) {
      throw new ErrorDeNegocio(msg('ajuste.noExiste', { clave, disponibles: Object.keys(AJUSTES).join(', ') }), 404);
    }
    const datos = cuerpoObjeto(cuerpo);
    if (datos.valor === undefined) throw new ErrorDeNegocio(msg('ajuste.sinValor', { clave }), 400);
    const valor = validarValor(clave, AJUSTES[clave], datos.valor);
    if (!(await repo.obtener(clave))) throw new ErrorDeNegocio(msg('ajuste.faltante', { clave }), 500);
    await repo.guardar(clave, JSON.stringify(valor));
    return aAjuste(await repo.obtener(clave));
  }
}

module.exports = new AjusteService();
