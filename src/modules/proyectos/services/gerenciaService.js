// src/modules/proyectos/services/gerenciaService.js
// Panel gerencial (solo lectura) y la lista de cierres por dar visto bueno. Para gerencia y administración.
const gerenciaRepository = require('../repositories/gerenciaRepository');
const proyectoRepository = require('../repositories/proyectoRepository');
const proyectoService = require('./proyectoService');
const configService = require('./configService');
const { semaforo, porcentaje } = require('../alcanceSeguimiento');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');

const tiene = (usuario, permiso) => (usuario.permissions || []).includes(permiso);
const objeto = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const anioActual = () => new Date(Date.now() - 6 * 3600 * 1000).getUTCFullYear();

class GerenciaService {
  _exigir(usuario) {
    if (!tiene(usuario, 'proyectos.ver_gerencia') && !tiene(usuario, 'proyectos.administrar')) throw new ErrorDeNegocio('No tienes permiso para ver el panel gerencial.', 403);
  }

  async panel(usuario, consulta = {}) {
    this._exigir(usuario);
    const anio = aEntero(consulta.anio) || anioActual();
    const paisId = aEntero(consulta.paisId) || null;
    const ajustes = await configService.valores();
    const verde = ajustes['semaforo.efectividad_verde'];
    const ambar = ajustes['semaforo.efectividad_ambar'];
    const [proyectos, vendido, total, porPais, nichos, cierres, activaciones] = await Promise.all([
      proyectoRepository.listar({ anio, alcance: { todos: true } }), gerenciaRepository.vendidoPorMoneda(anio, paisId), gerenciaRepository.efectividadTotal(anio, paisId),
      gerenciaRepository.efectividadPorPais(anio), gerenciaRepository.nichos(anio, paisId), gerenciaRepository.cierresPorVistoBueno(), gerenciaRepository.activacionesPendientes()
    ]);
    const marcados = await proyectoService._marcarVencidos(proyectos);
    const monedaPrincipal = consulta.moneda || (vendido[0] && vendido[0].moneda) || 'GTQ';
    const porMes = await gerenciaRepository.vendidoPorMes(anio, monedaPrincipal, paisId);
    const efectividad = porcentaje(total.interesadas, total.asignadas);
    const clasificar = (filas) => filas.map(f => ({ ...f, efectividad: porcentaje(f.interesadas, f.asignadas), semaforo: semaforo(porcentaje(f.interesadas, f.asignadas), verde, ambar) }));
    return {
      anio, paisId,
      proyectos: { activos: marcados.filter(p => p.estado === 'activo' && !p.vencido).length, vencidos: marcados.filter(p => p.vencido).length, porVistoBueno: cierres.length },
      vendido, efectividad: { porcentaje: efectividad, semaforo: semaforo(efectividad, verde, ambar) },
      porMes: { moneda: monedaPrincipal, monedas: vendido.map(v => v.moneda), meses: porMes },
      porPais: clasificar(porPais).map(f => ({ paisId: f.paisId, pais: f.pais, efectividad: f.efectividad, semaforo: f.semaforo })),
      nichos: clasificar(nichos),
      porDarVistoBueno: cierres.slice(0, 5).map(c => this._cierre(c)),
      activacionesPendientes: activaciones
    };
  }

  _cierre(c) {
    const informe = c.resumen_cierre ? objeto(c.resumen_cierre) : null;
    return {
      id: c.id, nombre: c.nombre, anio: c.anio, mes: c.mes, cerradoEn: c.cerrado_en, cerradoPor: c.cerrado_por,
      asignadas: informe ? informe.cifras.asignadas : 0, vendidas: informe ? informe.cifras.vendidas : 0, efectividad: informe ? informe.efectividad.porcentaje : 0, vendido: informe ? informe.montos.vendido : []
    };
  }

  // G4: cierres que esperan el visto bueno y la cantidad de activaciones por aprobar.
  async porDarVistoBueno(usuario) {
    this._exigir(usuario);
    const [cierres, activaciones] = await Promise.all([gerenciaRepository.cierresPorVistoBueno(), gerenciaRepository.activacionesPendientes()]);
    return { cierres: cierres.map(c => this._cierre(c)), activaciones };
  }
}

module.exports = new GerenciaService();
