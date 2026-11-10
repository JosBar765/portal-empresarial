// src/modules/proyectos/services/metasCalculoService.js
// El cálculo de las metas de un proyecto con los datos de la base (sin permisos ni alcance): lo usan el seguimiento del supervisor
// (`metasService`) y Mi proyecto del asesor (`gestionService`). Está aparte para no crear un ciclo entre servicios.
const metasRepository = require('../repositories/metasRepository');
const { calcular } = require('../metas');

class MetasCalculoService {
  // `proyecto`: la fila de `participacionRepository.proyecto`. `null` si el proyecto no tiene meta de monto.
  async datos(proyecto) {
    const metaTotal = proyecto.meta_monto === null || proyecto.meta_monto === undefined ? null : Number(proyecto.meta_monto);
    if (!metaTotal) return null;
    const [asesores, vendido, ajustadas] = await Promise.all([metasRepository.asesores(proyecto.id), metasRepository.vendido(proyecto.id), metasRepository.ajustadas(proyecto.id)]);
    const moneda = proyecto.meta_moneda;
    const enMoneda = new Map(vendido.filter(v => v.moneda === moneda).map(v => [v.asesor_id, Number(v.total)]));
    const otras = new Map();
    for (const v of vendido.filter(x => x.moneda !== moneda)) otras.set(v.moneda, (otras.get(v.moneda) || 0) + Number(v.total));
    const calculo = calcular({ metaTotal, asesores: asesores.map(a => ({ id: a.asesor_id, tiendaId: a.tienda_id })), ajustadas, vendido: enMoneda });
    return { moneda, metaTotal, asesores, calculo, otrasMonedas: [...otras].map(([m, monto]) => ({ moneda: m, monto: Math.round(monto * 100) / 100 })).sort((a, b) => a.moneda.localeCompare(b.moneda)) };
  }

  // La meta de una persona en su proyecto (Mi proyecto): `null` si el proyecto no tiene meta o la persona no tiene empresas.
  async deAsesor(proyecto, asesorId) {
    const datos = await this.datos(proyecto);
    if (!datos) return null;
    const f = datos.calculo.filas.find(x => x.asesorId === asesorId);
    if (!f) return null;
    return { moneda: datos.moneda, meta: f.meta, vendido: f.vendido, avance: f.avance, falta: f.falta, enMeta: f.enMeta, ajustada: f.ajustada };
  }
}

module.exports = new MetasCalculoService();
