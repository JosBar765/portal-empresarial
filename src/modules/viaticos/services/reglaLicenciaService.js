// src/modules/viaticos/services/reglaLicenciaService.js
// La regla se identifica por (país, tipo de licencia, tipo de placa); no tiene `activo`: la baja es física.
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const repo = require('../repositories/reglaLicenciaRepository');
const referencias = require('../repositories/referenciaRepository');
const { Validador, cuerpoObjeto } = require('../validacion');
const { errorDeValidacion, esDuplicado } = require('../errores');
const { LIMITES } = require('../constantes');
const { msg } = require('../mensajes');

function validarLimites(datos, v) {
  return {
    tonelajeMax: v.decimal(datos, 'tonelajeMax', 'Tonelaje máximo', { min: 0, minExclusivo: true, max: LIMITES.TONELAJE_MAX, requerido: false }),
    pasajerosMax: v.entero(datos, 'pasajerosMax', 'Pasajeros máximos', { min: 1, max: LIMITES.ENTERO_MAX, requerido: false })
  };
}

async function leer(clave) {
  const fila = await repo.obtener(clave);
  if (!fila) throw new ErrorDeNegocio(msg('regla.noExiste'), 404);
  return fila;
}

class ReglaLicenciaService {
  listar() {
    return repo.listar();
  }

  async crear(cuerpo) {
    const datos = cuerpoObjeto(cuerpo);
    const v = new Validador();
    const paisId = v.id(datos, 'paisId', 'País');
    const tipoLicenciaId = v.id(datos, 'tipoLicenciaId', 'Tipo de licencia');
    const tipoPlacaId = v.id(datos, 'tipoPlacaId', 'Tipo de placa');
    const limites = validarLimites(datos, v);
    v.lanzar();

    const campos = {};
    if (!(await referencias.paisExiste(paisId))) campos.paisId = msg('pais.noExiste');
    if (!(await referencias.tipoLicenciaExiste(tipoLicenciaId))) campos.tipoLicenciaId = msg('regla.tipoLicenciaNoExiste');
    const placa = await referencias.tipoPlacaPorId(tipoPlacaId);
    if (!placa) campos.tipoPlacaId = msg('regla.tipoPlacaNoExiste');
    else if (placa.paisId !== paisId) campos.tipoPlacaId = msg('regla.placaOtroPais');
    if (Object.keys(campos).length > 0) throw errorDeValidacion(msg('validacion.revisar'), campos);

    const clave = { paisId, tipoLicenciaId, tipoPlacaId };
    try {
      await repo.insertar({ ...clave, ...limites });
    } catch (error) {
      if (esDuplicado(error)) throw new ErrorDeNegocio(msg('regla.duplicada'), 409);
      throw error;
    }
    return leer(clave);
  }

  // Solo los límites cambian; la clave identifica a la regla.
  async editar(clave, cuerpo) {
    await leer(clave);
    const v = new Validador();
    const limites = validarLimites(cuerpoObjeto(cuerpo), v);
    v.lanzar();
    await repo.actualizarLimites(clave, limites);
    return leer(clave);
  }

  async eliminar(clave) {
    await leer(clave);
    await repo.eliminar(clave);
    return { eliminada: true };
  }
}

module.exports = new ReglaLicenciaService();
