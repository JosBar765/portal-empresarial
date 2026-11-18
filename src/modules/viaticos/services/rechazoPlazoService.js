// src/modules/viaticos/services/rechazoPlazoService.js
// Plazo de una solicitud rechazada antes de pasar a borrador: el ajuste en horas corridas y el tiempo que le queda a cada una.
// No depende de las demás services para que las listas y el detalle puedan usarlo sin ciclos.
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');
const ajusteRepo = require('../repositories/ajusteRepository');
const rechazoRepo = require('../repositories/rechazoRepository');
const { RECHAZO } = require('../constantes');
const { parsearJson } = require('../utilidades');
const { msg } = require('../mensajes');

const SEGUNDOS_POR_HORA = 3600;

// Un ajuste ausente o dañado es un error del despliegue (falta la migración), no del usuario.
async function horasDeVigencia() {
  const fila = await ajusteRepo.obtener(RECHAZO.AJUSTE_VIGENCIA_HORAS);
  const horas = fila ? aEntero(parsearJson(fila.valor)) : null;
  if (horas === null || horas < 1) throw new ErrorDeNegocio(msg('rechazo.ajusteFaltante', { clave: RECHAZO.AJUSTE_VIGENCIA_HORAS }), 500);
  return horas;
}

// { id -> { venceEn, minutosRestantes } } solo de las solicitudes rechazadas con plazo; el reloj es el de MySQL.
async function vencimientosDe(ids, ejecutor) {
  const unicos = [...new Set(ids.map(Number))];
  if (unicos.length === 0) return new Map();
  const segundos = await horasDeVigencia() * SEGUNDOS_POR_HORA;
  const filas = await rechazoRepo.vencimientos(unicos, segundos, ejecutor);
  return new Map(filas.map(f => [Number(f.id), { venceEn: f.venceEn, minutosRestantes: Number(f.minutosRestantes) }]));
}

module.exports = { horasDeVigencia, vencimientosDe, SEGUNDOS_POR_HORA };
