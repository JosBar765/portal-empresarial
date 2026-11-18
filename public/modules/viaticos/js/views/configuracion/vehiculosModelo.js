// Reglas puras de la subpestaña «Vehículos» (sin DOM): filtros, nombre, tipos de placa por país, validación del cliente y payload.
import { t } from '../../textos.js';
import { esIsoValido } from '../../utils/fechas.js';
import { normalizarDecimal } from '../../utils/numero.js';
import { filtrarFilas, validarDecimalPositivo } from './modelo.js';

export const FILTROS_VEHICULO = Object.freeze({ TODOS: 'todos', EMPRESA: 'empresa', PROPIOS: 'propios' });

// Mismos topes que LIMITES del servidor (constantes.js).
export const LIMITES_VEHICULO = Object.freeze({ ANIO_MIN: 1950, TEXTO: 50, PLACA: 20, TONELAJE_MAX: 99999999.99, ENTERO_MAX: 2147483647 });

const vacio = (v) => v === null || v === undefined || String(v).trim() === '';

export const esDeLaEmpresa = (vehiculo) => vehiculo.propietarioId === null || vehiculo.propietarioId === undefined;

const cumpleFiltro = (vehiculo, filtro) => {
  if (filtro === FILTROS_VEHICULO.EMPRESA) return esDeLaEmpresa(vehiculo);
  if (filtro === FILTROS_VEHICULO.PROPIOS) return !esDeLaEmpresa(vehiculo);
  return true;
};

export const propietarioTexto = (v) => (esDeLaEmpresa(v) ? t('config.vehiculos.empresa') : (v.propietarioNombre || ''));

export function filtrarVehiculos(vehiculos, { filtro = FILTROS_VEHICULO.TODOS, busqueda = '' } = {}) {
  return filtrarFilas(vehiculos.filter(v => cumpleFiltro(v, filtro)), busqueda, (v) => [v.placa, v.marca, v.modelo, propietarioTexto(v)]);
}

export const contarVehiculos = (vehiculos, filtro) => vehiculos.filter(v => cumpleFiltro(v, filtro)).length;

export const nombreVehiculo = (v) => `${v.marca} ${v.modelo} ${v.anio}`;

// Tipos de placa que se pueden elegir para un país: activos, más el que el vehículo ya tiene (aunque se haya desactivado).
export function tiposPlacaDelPais(tipos, paisId, { incluirId = null } = {}) {
  return tipos.filter(tp => Number(tp.paisId) === Number(paisId) && (tp.activo || (incluirId !== null && Number(tp.id) === Number(incluirId))));
}

// Personas que pueden ser propietarias en un país: las que lo tienen asignado, más el propietario actual.
export function propietariosDelPais(personas, paisId, { incluirId = null } = {}) {
  return personas.filter(p => (p.paises || []).some(pa => Number(pa.id) === Number(paisId)) || (incluirId !== null && Number(p.id) === Number(incluirId)));
}

// Errores del cliente como { campo: mensaje } con los nombres del servidor. `anioActual` se inyecta en las pruebas; `tiposPlaca` es la lista completa.
export function validarVehiculo(valores, { anioActual = new Date().getFullYear(), tiposPlaca = [] } = {}) {
  const errores = {};
  const obligatorioLista = (campo) => t('config.error.obligatorioLista', { campo: t(`config.vehiculos.campo.${campo}`) });
  if (vacio(valores.paisId)) errores.paisId = obligatorioLista('paisId');
  for (const campo of ['marca', 'modelo', 'placa']) {
    const texto = vacio(valores[campo]) ? '' : String(valores[campo]).trim();
    const max = campo === 'placa' ? LIMITES_VEHICULO.PLACA : LIMITES_VEHICULO.TEXTO;
    const etiqueta = t(`config.vehiculos.campo.${campo}`);
    if (texto === '') errores[campo] = t('config.error.obligatorio', { campo: etiqueta });
    else if (texto.length > max) errores[campo] = t('config.error.largo', { campo: etiqueta, largo: texto.length, max });
  }
  const anioMax = anioActual + 1;
  const anio = String(valores.anio ?? '').trim();
  if (anio === '') errores.anio = t('config.vehiculos.error.anioFalta', { min: LIMITES_VEHICULO.ANIO_MIN, max: anioMax });
  else if (!/^\d{1,4}$/.test(anio) || Number(anio) < LIMITES_VEHICULO.ANIO_MIN || Number(anio) > anioMax) errores.anio = t('config.vehiculos.error.anioRango', { min: LIMITES_VEHICULO.ANIO_MIN, max: anioMax });
  if (vacio(valores.tipoPlacaId)) errores.tipoPlacaId = obligatorioLista('tipoPlacaId');
  else if (!vacio(valores.paisId) && tiposPlaca.length) {
    const tipo = tiposPlaca.find(tp => Number(tp.id) === Number(valores.tipoPlacaId));
    if (!tipo || Number(tipo.paisId) !== Number(valores.paisId)) errores.tipoPlacaId = t('config.vehiculos.error.placaOtroPais');
  }
  if (vacio(valores.combustibleId)) errores.combustibleId = obligatorioLista('combustibleId');
  if (!vacio(valores.tonelaje)) {
    const { error } = validarDecimalPositivo(valores.tonelaje, { campo: t('config.vehiculos.campo.tonelaje'), max: LIMITES_VEHICULO.TONELAJE_MAX, ejemplo: '3.5' });
    if (error) errores.tonelaje = error;
  }
  if (!vacio(valores.pasajeros)) {
    const texto = String(valores.pasajeros).trim();
    if (!/^\d+$/.test(texto) || Number(texto) < 1 || Number(texto) > LIMITES_VEHICULO.ENTERO_MAX) errores.pasajeros = t('config.vehiculos.error.pasajeros');
  }
  // La póliza es opcional, pero número y vencimiento van juntos.
  if (vacio(valores.polizaNumero) !== vacio(valores.polizaVenceEl)) {
    if (vacio(valores.polizaNumero)) errores.polizaNumero = t('config.vehiculos.error.polizaSinNumero');
    else errores.polizaVenceEl = t('config.vehiculos.error.polizaSinFecha');
  } else if (!vacio(valores.polizaNumero) && String(valores.polizaNumero).trim().length > LIMITES_VEHICULO.TEXTO) {
    errores.polizaNumero = t('config.error.largo', { campo: t('config.vehiculos.campo.polizaNumero'), largo: String(valores.polizaNumero).trim().length, max: LIMITES_VEHICULO.TEXTO });
  }
  if (!vacio(valores.polizaVenceEl) && !esIsoValido(String(valores.polizaVenceEl))) errores.polizaVenceEl = t('config.vehiculos.error.fechaInvalida', { campo: t('config.vehiculos.campo.polizaVenceEl') });
  if (vacio(valores.tarjetaVenceEl)) errores.tarjetaVenceEl = t('config.vehiculos.error.tarjetaFalta');
  else if (!esIsoValido(String(valores.tarjetaVenceEl))) errores.tarjetaVenceEl = t('config.vehiculos.error.fechaInvalida', { campo: t('config.vehiculos.campo.tarjetaVenceEl') });
  return errores;
}

// Lo opcional vacío viaja como null; la placa se normaliza a mayúsculas para que una misma placa no se registre dos veces.
export function armarPayloadVehiculo(valores) {
  const texto = (v) => (vacio(v) ? null : String(v).trim());
  return {
    paisId: Number(valores.paisId),
    propietarioId: vacio(valores.propietarioId) ? null : Number(valores.propietarioId),
    marca: String(valores.marca).trim(),
    modelo: String(valores.modelo).trim(),
    anio: Number(String(valores.anio).trim()),
    placa: String(valores.placa).trim().toUpperCase(),
    tipoPlacaId: Number(valores.tipoPlacaId),
    combustibleId: Number(valores.combustibleId),
    tonelaje: vacio(valores.tonelaje) ? null : Number(normalizarDecimal(valores.tonelaje)),
    pasajeros: vacio(valores.pasajeros) ? null : Number(String(valores.pasajeros).trim()),
    polizaNumero: texto(valores.polizaNumero),
    polizaVenceEl: texto(valores.polizaVenceEl),
    tarjetaVenceEl: texto(valores.tarjetaVenceEl)
  };
}
