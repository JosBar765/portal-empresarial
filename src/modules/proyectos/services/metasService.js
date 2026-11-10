// src/modules/proyectos/services/metasService.js
// Metas de ventas por asesor y tienda (S20 y M16). La meta de monto del proyecto se reparte en partes iguales; el supervisor ajusta la de cada
// asesor de sus tiendas. El avance es lo vendido (confirmado y vigente) en la moneda de la meta; otras monedas se muestran aparte, sin mezclar.
// Un proyecto sin meta de monto no tiene metas. Lo de otras tiendas sale enmascarado, como en el resto del seguimiento.
const metasRepository = require('../repositories/metasRepository');
const proyectoRepository = require('../repositories/proyectoRepository');
const seguimientoService = require('./seguimientoService');
const participacionRepository = require('../repositories/participacionRepository');
const metasCalculoService = require('./metasCalculoService');
const db = require('../../../config/database');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');
const { errorDeValidacion } = require('../errores');

const tiene = (usuario, permiso) => (usuario.permissions || []).includes(permiso);
const MAXIMO = 1e10;

class MetasService {
  // La pestaña «Metas» del seguimiento.
  async ver(usuario, proyectoId) {
    seguimientoService._exigirVer(usuario);
    const { proyecto, niveles } = await seguimientoService._acceso(usuario, proyectoId);
    const datos = await metasCalculoService.datos(await participacionRepository.proyecto(proyecto.id));
    if (!datos) return { habilitada: false };
    const { calculo, asesores } = datos;
    const nombre = new Map(asesores.map(a => [a.asesor_id, a]));
    return {
      habilitada: true, moneda: datos.moneda, activo: proyecto.estado === 'activo', total: calculo.total, otrasMonedas: datos.otrasMonedas,
      asesoresEnMeta: { n: calculo.asesoresEnMeta, de: calculo.filas.length }, tiendasEnMeta: { n: calculo.tiendasEnMeta, de: calculo.tiendas.length },
      asesores: calculo.filas.map((f) => {
        const a = nombre.get(f.asesorId);
        const base = { asesorId: f.asesorId, nombre: a.nombre, tienda: a.tienda, empresa: a.empresa };
        // Otra tienda: solo se sabe que está en el proyecto; nada de montos y sin acciones.
        if (!niveles.veDetalleEn(f.tiendaId)) return { ...base, otraTienda: true, meta: null, vendido: null, avance: null, falta: null, ajustada: false, puedeAjustar: false };
        return { ...base, otraTienda: false, meta: f.meta, vendido: f.vendido, avance: f.avance, falta: f.falta, ajustada: f.ajustada, enMeta: f.enMeta,
          puedeAjustar: proyecto.estado === 'activo' && niveles.puedeActuarEn(f.tiendaId) && (tiene(usuario, 'proyectos.reasignar')) };
      })
    };
  }

  // Ajusta la meta de un asesor de las tiendas del supervisor. `monto` null o vacío vuelve a la parte igual.
  async ajustar(usuario, proyectoId, asesorId, datos = {}) {
    if (!tiene(usuario, 'proyectos.reasignar')) throw new ErrorDeNegocio('No tienes permiso para ajustar metas.', 403);
    const { proyecto, niveles } = await seguimientoService._acceso(usuario, proyectoId);
    if (proyecto.estado !== 'activo') throw new ErrorDeNegocio('Este proyecto ya no está activo: no se pueden ajustar metas.', 409);
    const fila = await participacionRepository.proyecto(proyecto.id);
    if (!fila.meta_monto) throw new ErrorDeNegocio('Este proyecto no tiene meta de monto.', 409);
    const id = aEntero(asesorId);
    const asesor = id === null ? null : (await metasRepository.asesores(proyecto.id)).find(a => a.asesor_id === id);
    if (!asesor) throw new ErrorDeNegocio('Ese asesor no tiene empresas en este proyecto.', 404);
    if (!niveles.puedeActuarEn(asesor.tienda_id)) throw new ErrorDeNegocio('Solo puedes ajustar la meta de asesores de tus tiendas.', 403);
    let monto = null;
    if (datos.monto !== null && datos.monto !== undefined && datos.monto !== '') {
      monto = Number(String(datos.monto).replace(',', '.'));
      if (!Number.isFinite(monto) || monto < 0 || monto > MAXIMO) throw errorDeValidacion('Revisa los datos.', { monto: 'Escribe un monto válido (0 o más).' });
      monto = Math.round(monto * 100) / 100;
    }
    const antes = (await metasRepository.ajustadas(proyecto.id)).get(id);
    await db.transaccion(async (tx) => {
      if (monto === null) await metasRepository.quitar(tx, proyecto.id, id); else await metasRepository.fijar(tx, proyecto.id, id, monto, usuario.id);
      await proyectoRepository.registrarHistorial(tx, { proyectoId: proyecto.id, usuarioId: usuario.id, accion: 'ajustar_meta', detalle: { asesorId: id, antes: antes === undefined ? null : antes, despues: monto } });
    });
    const despues = (await this.ver(usuario, proyecto.id)).asesores.find(a => a.asesorId === id);
    if (id !== usuario.id) {
      await seguimientoService._avisar('meta_ajustada', {
        proyectoId: proyecto.id, autorId: usuario.id, explicitos: { asesor: [id] }, referenciaTipo: 'proyecto', referenciaId: proyecto.id,
        mensaje: monto === null ? 'Tu meta de ventas volvió a la parte igual del proyecto.' : `Tu supervisor ajustó tu meta de ventas: ${fila.meta_moneda} ${monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
      });
    }
    return despues;
  }
}

module.exports = new MetasService();
