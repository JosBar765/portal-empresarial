// src/modules/viaticos/services/tramoService.js
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const repo = require('../repositories/tramoRepository');
const referencias = require('../repositories/referenciaRepository');
const { Validador, cuerpoObjeto, validarActivo } = require('../validacion');
const { errorDeValidacion, esDuplicado } = require('../errores');
const { LIMITES } = require('../constantes');
const { msg } = require('../mensajes');

function validarMedidas(datos, v) {
  return {
    km: v.decimal(datos, 'km', 'Kilómetros', { min: 0, minExclusivo: true, max: LIMITES.KM_MAX }),
    horas: v.decimal(datos, 'horas', 'Horas', { min: 0, minExclusivo: true, max: LIMITES.HORAS_MAX })
  };
}

async function leer(id) {
  const fila = await repo.obtenerPorId(id);
  if (!fila) throw new ErrorDeNegocio(msg('tramo.noExiste', { id }), 404);
  return fila;
}

class TramoService {
  listar() {
    return repo.listar();
  }

  async crear(cuerpo) {
    const datos = cuerpoObjeto(cuerpo);
    const v = new Validador();
    const origenId = v.id(datos, 'origenId', 'Origen');
    const destinoId = v.id(datos, 'destinoId', 'Destino');
    const { km, horas } = validarMedidas(datos, v);
    v.lanzar();

    const ubicaciones = await referencias.ubicacionesPorIds([...new Set([origenId, destinoId])]);
    const nombres = new Map(ubicaciones.map(u => [u.id, u.nombre]));
    const faltantes = {};
    if (!nombres.has(origenId)) faltantes.origenId = msg('tramo.ubicacionNoExiste', { rol: 'origen' });
    if (!nombres.has(destinoId)) faltantes.destinoId = msg('tramo.ubicacionNoExiste', { rol: 'destino' });
    if (Object.keys(faltantes).length > 0) throw errorDeValidacion(msg('validacion.revisar'), faltantes);
    if (origenId === destinoId) throw new ErrorDeNegocio(msg('tramo.mismoLugar', { nombre: nombres.get(origenId) }), 400);

    // Un tramo sirve en ambos sentidos: se guarda una sola vez, con el id menor primero.
    const [ubicacionAId, ubicacionBId] = origenId < destinoId ? [origenId, destinoId] : [destinoId, origenId];
    const duplicado = new ErrorDeNegocio(msg('tramo.duplicado', { origen: nombres.get(origenId), destino: nombres.get(destinoId) }), 409);
    if (await repo.existePar(ubicacionAId, ubicacionBId)) throw duplicado;
    try {
      return await leer(await repo.insertar({ ubicacionAId, ubicacionBId, km, horas }));
    } catch (error) {
      throw esDuplicado(error) ? duplicado : error;
    }
  }

  // El par origen-destino identifica al tramo y no cambia; se editan solo sus medidas.
  async editar(id, cuerpo) {
    await leer(id);
    const v = new Validador();
    const { km, horas } = validarMedidas(cuerpoObjeto(cuerpo), v);
    v.lanzar();
    await repo.actualizar(id, { km, horas });
    return leer(id);
  }

  async cambiarActivo(id, cuerpo) {
    const activo = validarActivo(cuerpo);
    await leer(id);
    await repo.cambiarActivo(id, activo);
    return leer(id);
  }
}

module.exports = new TramoService();
