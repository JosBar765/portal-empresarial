// src/modules/viaticos/services/idempotenciaService.js
// Reintentos seguros de las operaciones que suben archivos: la misma llave devuelve el resultado ya guardado.
const crypto = require('crypto');
const idempotencyRepository = require('../../../core/idempotency/idempotencyRepository');
const { IDEMPOTENCIA } = require('../constantes');
const { errorDeValidacion } = require('../errores');
const { msg } = require('../mensajes');

// Cola por llave: dos envíos simultáneos con la misma llave se ejecutan uno tras otro para que el segundo vea el resultado del primero.
const colasPorLlave = new Map();
function conColaDeLlave(llave, fn) {
  const anterior = colasPorLlave.get(llave) || Promise.resolve();
  const actual = anterior.then(fn, fn);
  const cola = actual.catch(() => {});
  colasPorLlave.set(llave, cola);
  cola.then(() => { if (colasPorLlave.get(llave) === cola) colasPorLlave.delete(llave); });
  return actual;
}

// La llave se prefija con el usuario: la misma llave de otra persona nunca devuelve un resultado ajeno.
function llaveDeIdempotencia(bruta, usuarioId) {
  let llave = crypto.randomUUID();
  if (bruta !== undefined && bruta !== null && bruta !== '') {
    if (typeof bruta !== 'string' || bruta.trim().length === 0 || bruta.trim().length > IDEMPOTENCIA.MAX_LLAVE) {
      throw errorDeValidacion(msg('validacion.revisar'), { idempotencyKey: msg('solicitud.llaveIdempotencia', { max: IDEMPOTENCIA.MAX_LLAVE }) });
    }
    llave = bruta.trim();
  }
  return `viaticos:${usuarioId}:${llave}`;
}

// Ejecuta `accion` una sola vez por llave y operación; una llave usada en otra operación se rechaza para no devolver un resultado que no corresponde.
async function ejecutarUnaVez({ llave, endpoint, accion }) {
  return conColaDeLlave(llave, async () => {
    const previo = await idempotencyRepository.buscar(llave);
    if (previo) {
      if (previo.endpoint !== endpoint) throw errorDeValidacion(msg('validacion.revisar'), { idempotencyKey: msg('liquidacion.llaveOtraOperacion') });
      return previo.resultado;
    }
    const resultado = await accion();
    try {
      await idempotencyRepository.registrar(llave, endpoint, resultado);
    } catch (error) {
      console.error('[Viáticos] No se pudo registrar la llave de idempotencia:', error.message);
    }
    return resultado;
  });
}

module.exports = { conColaDeLlave, llaveDeIdempotencia, ejecutarUnaVez };
