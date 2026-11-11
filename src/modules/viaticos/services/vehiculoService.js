// src/modules/viaticos/services/vehiculoService.js
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const repo = require('../repositories/vehiculoRepository');
const referencias = require('../repositories/referenciaRepository');
const { Validador, cuerpoObjeto, validarActivo } = require('../validacion');
const { errorDeValidacion, esDuplicado } = require('../errores');
const { LIMITES } = require('../constantes');
const { msg } = require('../mensajes');

function validar(cuerpo) {
  const datos = cuerpoObjeto(cuerpo);
  const v = new Validador();
  const anioMax = new Date().getFullYear() + 1; // los modelos del año siguiente ya se venden
  const valores = {
    pais_id: v.id(datos, 'paisId', 'País'),
    propietario_id: v.id(datos, 'propietarioId', 'Propietario', { requerido: false }),
    marca: v.texto(datos, 'marca', 'Marca', { max: 50 }),
    modelo: v.texto(datos, 'modelo', 'Modelo', { max: 50 }),
    placa: v.texto(datos, 'placa', 'Placa', { max: 20 }),
    tipo_placa_id: v.id(datos, 'tipoPlacaId', 'Tipo de placa'),
    combustible_id: v.id(datos, 'combustibleId', 'Combustible'),
    tonelaje: v.decimal(datos, 'tonelaje', 'Tonelaje', { min: 0, minExclusivo: true, max: LIMITES.TONELAJE_MAX, requerido: false }),
    pasajeros: v.entero(datos, 'pasajeros', 'Pasajeros', { min: 1, max: LIMITES.ENTERO_MAX, requerido: false }),
    poliza_numero: v.texto(datos, 'polizaNumero', 'Número de póliza', { max: 50, requerido: false }),
    poliza_vence_el: v.fecha(datos, 'polizaVenceEl', 'Vencimiento de la póliza', { requerido: false }),
    tarjeta_vence_el: v.fecha(datos, 'tarjetaVenceEl', 'Vencimiento de la tarjeta de circulación')
  };
  valores.anio = v.entero(datos, 'anio', 'Año', { min: LIMITES.ANIO_MIN, max: anioMax });
  // La póliza es opcional, pero número y vencimiento van juntos.
  if ((valores.poliza_numero === null) !== (valores.poliza_vence_el === null) && !v.campos.polizaNumero && !v.campos.polizaVenceEl) {
    v.falla('polizaNumero', msg('vehiculo.polizaIncompleta'));
  }
  v.lanzar();
  return valores;
}

async function verificarReferencias(valores) {
  const campos = {};
  if (!(await referencias.paisExiste(valores.pais_id))) campos.paisId = msg('pais.noExiste');
  if (valores.propietario_id !== null && !(await referencias.usuarioExiste(valores.propietario_id))) {
    campos.propietarioId = msg('vehiculo.propietarioNoExiste');
  }
  if (!(await referencias.combustibleExiste(valores.combustible_id))) campos.combustibleId = msg('vehiculo.combustibleNoExiste');
  const placa = await referencias.tipoPlacaPorId(valores.tipo_placa_id);
  if (!placa) campos.tipoPlacaId = msg('vehiculo.tipoPlacaNoExiste');
  else if (!campos.paisId && placa.paisId !== valores.pais_id) campos.tipoPlacaId = msg('vehiculo.placaOtroPais');
  if (Object.keys(campos).length > 0) throw errorDeValidacion(msg('validacion.revisar'), campos);
}

async function leer(id) {
  const fila = await repo.obtenerPorId(id);
  if (!fila) throw new ErrorDeNegocio(msg('vehiculo.noExiste', { id }), 404);
  return fila;
}

async function guardar(valores, accion) {
  try {
    return await accion();
  } catch (error) {
    if (esDuplicado(error)) throw new ErrorDeNegocio(msg('vehiculo.duplicado', { placa: valores.placa }), 409);
    throw error;
  }
}

class VehiculoService {
  listar() {
    return repo.listar();
  }

  async crear(cuerpo) {
    const valores = validar(cuerpo);
    await verificarReferencias(valores);
    return leer(await guardar(valores, () => repo.insertar(valores)));
  }

  async editar(id, cuerpo) {
    await leer(id);
    const valores = validar(cuerpo);
    await verificarReferencias(valores);
    await guardar(valores, () => repo.actualizar(id, valores));
    return leer(id);
  }

  async cambiarActivo(id, cuerpo) {
    const activo = validarActivo(cuerpo);
    await leer(id);
    await repo.cambiarActivo(id, activo);
    return leer(id);
  }
}

module.exports = new VehiculoService();
