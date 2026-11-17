// src/modules/viaticos/services/movimientoService.js
// Arma la frase de cada movimiento y lo registra en el historial permanente, dentro de la transacción del cambio.
const movimientoRepo = require('../repositories/movimientoRepository');
const { SISTEMA } = require('../constantes');
const { msg } = require('../mensajes');
const { aCentavos, formatear } = require('../dinero');

// «Q1,234.50»: el símbolo de la moneda de la solicitud y el monto con miles y dos decimales.
const monto = (simbolo, valor) => `${simbolo || ''}${formatear(aCentavos(valor))}`;

class MovimientoService {
  // `tipo`: clave de MOVIMIENTOS; `solicitud`: { id, correlativo }; `actor`: { id, nombre } o null si lo hizo el sistema;
  // `datos`: los marcadores de la frase.
  async registrar(tipo, solicitud, actor, datos, ejecutor) {
    const usuarioId = actor ? actor.id : SISTEMA.USUARIO_ID;
    const usuarioNombre = actor
      ? (actor.nombre || await movimientoRepo.nombreDeUsuario(actor.id, ejecutor) || String(actor.id))
      : msg(SISTEMA.MENSAJE_NOMBRE);
    await movimientoRepo.registrar({
      solicitudId: solicitud.id, correlativo: solicitud.correlativo, tipo, usuarioId, usuarioNombre, accion: msg(`movimiento.${tipo}`, datos)
    }, ejecutor);
  }
}

module.exports = new MovimientoService();
module.exports.monto = monto;
