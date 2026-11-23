// src/modules/proyectos/services/informeService.js
// El informe de un proyecto: UNA sola función de cálculo (`calcular`) que usan la pantalla, el PDF y las exportaciones, para que nunca
// digan cosas distintas. Las tasas son acumulativas, lo anulado / rechazado / «por confirmar» no cuenta y las monedas no se mezclan.
// Mientras el proyecto está activo se calcula al vuelo; al cerrar queda congelado en `resumen_cierre`.
const informeRepository = require('../repositories/informeRepository');
const seguimientoRepository = require('../repositories/seguimientoRepository');
const configService = require('./configService');
const seguimientoService = require('./seguimientoService');
const { semaforo, porcentaje, diasDeReaccion } = require('../alcanceSeguimiento');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');

const tiene = (usuario, permiso) => (usuario.permissions || []).includes(permiso);
const objeto = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const redondear = (n) => Math.round(n * 10) / 10;

// Une «cotizado por tienda» y «vendido por tienda» a las filas de tiendas.
const montosDeTienda = (filas, tiendaId) => filas.filter(f => f.tienda_id === tiendaId).map(f => ({ moneda: f.moneda, monto: Number(f.total) })).sort((a, b) => a.moneda.localeCompare(b.moneda));

class InformeService {
  // Calcula el informe de un proyecto con los datos de ahora. No mira permisos: quien llama ya los resolvió.
  async calcular(proyectoId) {
    const proyecto = await informeRepository.proyecto(proyectoId);
    if (!proyecto) throw new ErrorDeNegocio('Ese proyecto no existe.', 404);
    const foto = proyecto.config_snapshot ? objeto(proyecto.config_snapshot) : null;
    const parametros = (foto && foto.parametros) || await configService.valores();
    const [cifras, contactadas, estados, perdidas, montos, canales, muestras, primeraGestion, sinGestionar, porAsesor, porTienda, montosTienda] = await Promise.all([
      seguimientoRepository.cifras(proyecto.id), informeRepository.contactadas(proyecto.id), informeRepository.conteoPorEstado(proyecto.id), informeRepository.perdidasPorMotivo(proyecto.id),
      informeRepository.montos(proyecto.id), informeRepository.canales(proyecto.id), informeRepository.muestrasPorArea(proyecto.id), informeRepository.primeraGestion(proyecto.id),
      informeRepository.sinGestionar(proyecto.id), seguimientoRepository.porAsesor(proyecto.id), seguimientoRepository.porTienda(proyecto.id), informeRepository.montosPorTienda(proyecto.id)
    ]);
    const verde = parametros['semaforo.efectividad_verde'];
    const ambar = parametros['semaforo.efectividad_ambar'];
    const { asignadas } = cifras;
    const efectividad = porcentaje(cifras.interesadas, asignadas);
    const gestionesTotales = canales.presencial + canales.remoto;
    const entregadas = muestras.reduce((a, m) => a + m.cantidad, 0);
    return {
      version: 1,
      cifras: {
        asignadas, gestionadas: cifras.gestionadas, contactadas, interesadas: cifras.interesadas, cotizadas: cifras.cotizadas, vendidas: cifras.vendidas,
        perdidas: estados.perdida || 0, descartadas: estados.descartada || 0, sinGestionar,
        porcentajes: { gestionadas: porcentaje(cifras.gestionadas, asignadas), contactadas: porcentaje(contactadas, asignadas), interesadas: efectividad, cotizadas: porcentaje(cifras.cotizadas, asignadas), vendidas: porcentaje(cifras.vendidas, asignadas) }
      },
      efectividad: { porcentaje: efectividad, semaforo: semaforo(efectividad, verde, ambar) },
      montos,
      perdidasPorMotivo: perdidas,
      canales: { ...canales, total: gestionesTotales, porcentajePresencial: porcentaje(canales.presencial, gestionesTotales), porcentajeRemoto: porcentaje(canales.remoto, gestionesTotales) },
      muestras: { porArea: muestras, entregadas, existencia: proyecto.articulo_id ? proyecto.existencia_muestras : null, total: proyecto.articulo_id && proyecto.existencia_muestras !== null ? proyecto.existencia_muestras + entregadas : null, articulo: proyecto.articulo || null },
      porAsesor: porAsesor.map(a => ({
        asesorId: a.asesorId, nombre: a.nombre, tienda: a.tienda, empresa: a.empresa, asignadas: a.asignadas, gestionadas: a.gestionadas, interesadas: a.interesadas, cotizadas: a.cotizadas, vendidas: a.vendidas,
        reaccionDias: diasDeReaccion(a.minutosReaccion), yaGestiono: a.yaGestiono, semaforo: semaforo(porcentaje(a.interesadas, a.asignadas), verde, ambar)
      })),
      porTienda: porTienda.map(t => ({
        tiendaId: t.tiendaId, tienda: t.tienda, empresa: t.empresa, asesores: t.asesores, asignadas: t.asignadas, gestionadas: t.gestionadas, interesadas: t.interesadas, cotizadas: t.cotizadas, vendidas: t.vendidas,
        cotizado: montosDeTienda(montosTienda.cotizado, t.tiendaId), vendido: montosDeTienda(montosTienda.vendido, t.tiendaId), semaforo: semaforo(porcentaje(t.interesadas, t.asignadas), verde, ambar)
      })),
      fechas: { inicio: proyecto.fecha_inicio, primeraGestion, cierre: proyecto.cerrado_en || null },
      reaccionPromedioDias: porAsesor.length ? redondear(porAsesor.reduce((a, x) => a + diasDeReaccion(x.minutosReaccion), 0) / porAsesor.length) : 0
    };
  }

  // El informe de un proyecto para una persona: congelado si ya cerró, «al momento» si sigue activo; con lo que necesita la pantalla.
  async obtener(usuario, proyectoId) {
    if (!['proyectos.supervisar', 'proyectos.ver_gerencia', 'proyectos.administrar', 'proyectos.ver_reportes'].some(p => tiene(usuario, p))) {
      throw new ErrorDeNegocio('No tienes permiso para ver el informe.', 403);
    }
    const { niveles } = await seguimientoService._acceso(usuario, proyectoId);
    const proyecto = await informeRepository.proyecto(Number(proyectoId));
    const congelado = proyecto.estado === 'cerrado' && proyecto.resumen_cierre;
    const informe = congelado ? objeto(proyecto.resumen_cierre) : await this.calcular(proyecto.id);
    const vistoBuenoActivo = Boolean(await configService.obtener('reglas.visto_bueno_cierre'));
    const [historial, sinGestionar] = await Promise.all([informeRepository.historial(proyecto.id), proyecto.estado === 'activo' ? informeRepository.sinGestionar(proyecto.id) : Promise.resolve(informe.cifras.sinGestionar)]);
    return {
      proyecto: {
        id: proyecto.id, codigo: proyecto.codigo, nombre: proyecto.nombre, nicho: proyecto.nicho, anio: proyecto.anio, mes: proyecto.mes, estado: proyecto.estado, tiendas: Number(proyecto.tiendas), paises: proyecto.paises,
        fechaInicio: proyecto.fecha_inicio, fechaFin: proyecto.fecha_fin
      },
      informe: { ...informe, cifras: { ...informe.cifras, sinGestionar } },
      congelado: Boolean(congelado),
      conclusiones: proyecto.conclusiones || '',
      cierre: proyecto.estado === 'cerrado' ? { por: proyecto.cerrado_por, en: proyecto.cerrado_en } : null,
      vistoBueno: proyecto.visto_bueno_estado ? { estado: proyecto.visto_bueno_estado, por: proyecto.visto_bueno_por, en: proyecto.visto_bueno_en, comentario: proyecto.visto_bueno_comentario } : null,
      historial: historial.map(h => ({ accion: h.accion, en: h.creado_en, usuario: h.usuario })),
      reglas: { vistoBueno: vistoBuenoActivo },
      permisos: {
        cerrar: proyecto.estado === 'activo' && tiene(usuario, 'proyectos.activar'),
        reenviar: proyecto.estado === 'cerrado' && proyecto.visto_bueno_estado === 'devuelto' && tiene(usuario, 'proyectos.activar'),
        vistoBueno: proyecto.estado === 'cerrado' && proyecto.visto_bueno_estado === 'pendiente' && tiene(usuario, 'proyectos.dar_visto_bueno'),
        gerencia: niveles.gerencia
      }
    };
  }
}

module.exports = new InformeService();
