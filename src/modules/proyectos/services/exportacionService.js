// src/modules/proyectos/services/exportacionService.js
// Exportación a CSV (UTF-8 con BOM, para que Excel lea bien los acentos) de la cartera, los resultados de un proyecto y las tablas del
// informe. Las cifras salen de las mismas funciones que la pantalla y el PDF; aquí solo se dan forma de tabla. Una celda que parece
// fórmula se neutraliza (`csv.escapar`). Exige `proyectos.ver_reportes` y respeta el alcance de cada persona: lo de otras tiendas sale
// sin contactos ni montos, como en el seguimiento.
const exportacionRepository = require('../repositories/exportacionRepository');
const clienteService = require('./clienteService');
const informeService = require('./informeService');
const seguimientoService = require('./seguimientoService');
const ganadosService = require('./ganadosService');
const { armar } = require('../csv');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { errorDeValidacion } = require('../errores');

const tiene = (usuario, permiso) => (usuario.permissions || []).includes(permiso);
const hoy = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
const TABLAS_INFORME = ['resumen', 'asesores', 'tiendas'];
const ETIQUETA_GESTION = { pendiente: 'Pendiente', en_gestion: 'En gestión', interesada: 'Interesada', cotizada: 'Cotizada', vendida: 'Vendida', perdida: 'Perdida', descartada: 'Descartada' };

// Monto con dos decimales y punto decimal (sin separador de miles): así Excel lo toma como número.
const monto = (n) => (Number.isFinite(Number(n)) ? Number(n).toFixed(2) : '');
const porMoneda = (lista) => lista.map(m => `${m.moneda} ${monto(m.monto)}`).join(' · ');

class ExportacionService {
  _exigir(usuario) {
    if (!tiene(usuario, 'proyectos.ver_reportes')) throw new ErrorDeNegocio('No tienes permiso para exportar.', 403);
  }

  // La base de empresas, con los mismos filtros y el mismo alcance por país que la lista.
  async cartera(usuario, consulta = {}) {
    this._exigir(usuario);
    const { encabezados, filas, truncado } = await clienteService.paraExportar(usuario, consulta);
    return { nombre: `cartera-${hoy()}.csv`, contenido: armar([encabezados, ...filas]), truncado };
  }

  // Clientes ganados con los filtros de la pantalla; el total vendido sale por moneda, sin mezclarlas.
  async ganados(usuario, consulta = {}) {
    this._exigir(usuario);
    const empresas = await ganadosService.paraExportar(usuario, consulta);
    const etiqueta = { vencida: 'Vencida', proxima: 'Próxima', lejana: 'Lejana' };
    const filas = empresas.map(e => [e.nombre, e.nicho, e.pais, e.ciudad || '', e.telefono || '', e.asesor || '', e.ultimaVenta.fecha, `${e.ultimaVenta.moneda} ${monto(e.ultimaVenta.monto)}`,
      e.ultimaVenta.referencia || '', e.ventas, porMoneda(e.totales), e.recompra.fecha, etiqueta[e.recompra.estado]]);
    return { nombre: `clientes-ganados-${hoy()}.csv`, contenido: armar([['Empresa', 'Nicho', 'País', 'Ciudad', 'Teléfono', 'Asesor de la última venta', 'Última venta', 'Monto de la última venta', 'Referencia', 'Ventas', 'Total por moneda', 'Recompra sugerida', 'Estado de la recompra'], ...filas]) };
  }

  // Una fila por empresa asignada del proyecto. Las de tiendas que la persona no puede ver salen sin contactos ni montos.
  async resultados(usuario, proyectoId) {
    this._exigir(usuario);
    const { proyecto, niveles } = await seguimientoService._acceso(usuario, proyectoId);
    const [filas, dinero] = await Promise.all([exportacionRepository.participaciones(proyecto.id), exportacionRepository.montos(proyecto.id)]);
    const monedas = [...new Set(dinero.map(d => d.moneda))].sort();
    const por = new Map(dinero.map(d => [`${d.participacion_id}:${d.tipo}:${d.moneda}`, d]));
    const referencias = (id, tipo) => dinero.filter(d => d.participacion_id === id && d.tipo === tipo).map(d => d.referencias).filter(Boolean).join(' | ');
    const encabezados = ['Empresa', 'País', 'Ciudad', 'Asesor', 'Tienda', 'Estado', 'Motivo de pérdida', 'Gestiones', 'Muestras entregadas', 'Última gestión', 'Próxima gestión',
      ...monedas.flatMap(m => [`Cotizado ${m}`, `Vendido ${m}`]), 'Referencias de cotización', 'Referencias de venta'];
    const salida = filas.map((f) => {
      const base = [f.empresa, f.pais];
      if (!niveles.veDetalleEn(f.tienda_id)) {
        // Otra tienda: solo empresa, país, asesor, tienda y etapa; el resto va vacío.
        return [...base, '', f.asesor, f.tienda, ETIQUETA_GESTION[f.estado] || f.estado, ...Array(encabezados.length - 6).fill('')];
      }
      return [...base, f.ciudad, f.asesor, f.tienda, ETIQUETA_GESTION[f.estado] || f.estado, f.motivo_perdida || '', f.gestiones, f.muestras, f.ultima_gestion_en || '', f.proxima_gestion_en || '',
        ...monedas.flatMap(m => [monto((por.get(`${f.id}:cotizado:${m}`) || {}).total || 0), monto((por.get(`${f.id}:vendido:${m}`) || {}).total || 0)]),
        referencias(f.id, 'cotizado'), referencias(f.id, 'vendido')];
    });
    return { nombre: `resultados-${proyecto.codigo || proyecto.id}.csv`, contenido: armar([encabezados, ...salida]) };
  }

  // Una tabla del informe: `resumen` (cifras y montos), `asesores` o `tiendas`.
  async informe(usuario, proyectoId, tabla = 'resumen') {
    this._exigir(usuario);
    if (!TABLAS_INFORME.includes(tabla)) throw errorDeValidacion('Revisa los datos.', { tabla: 'Elige resumen, asesores o tiendas.' });
    const datos = await informeService.obtener(usuario, proyectoId);
    const { informe, proyecto } = datos;
    const c = informe.cifras;
    let filas;
    if (tabla === 'resumen') {
      filas = [['Indicador', 'Valor', 'Porcentaje de las asignadas'],
        ['Asignadas', c.asignadas, ''], ['Gestionadas', c.gestionadas, c.porcentajes.gestionadas], ['Contactadas', c.contactadas, c.porcentajes.contactadas],
        ['Interesadas', c.interesadas, c.porcentajes.interesadas], ['Cotizadas', c.cotizadas, c.porcentajes.cotizadas], ['Vendidas', c.vendidas, c.porcentajes.vendidas],
        ['Perdidas', c.perdidas, ''], ['Descartadas', c.descartadas, ''], ['Sin gestionar', c.sinGestionar, ''],
        ['Efectividad', `${informe.efectividad.porcentaje}%`, ''],
        ...informe.montos.cotizado.map(m => [`Cotizado ${m.moneda}`, monto(m.monto), '']), ...informe.montos.vendido.map(m => [`Vendido ${m.moneda}`, monto(m.monto), '']),
        ['Gestiones presenciales', informe.canales.presencial, informe.canales.porcentajePresencial], ['Gestiones remotas', informe.canales.remoto, informe.canales.porcentajeRemoto],
        ['Muestras entregadas', informe.muestras.entregadas, ''], ...informe.muestras.porArea.map(m => [`Muestras · ${m.area}`, m.cantidad, '']),
        ...informe.perdidasPorMotivo.map(p => [`Perdidas · ${p.motivo}`, p.n, ''])];
    } else if (tabla === 'asesores') {
      filas = [['Asesor', 'Tienda', 'Asignadas', 'Gestionadas', 'Interesadas', 'Cotizadas', 'Vendidas', 'Reacción (días)', 'Semáforo'],
        ...informe.porAsesor.map(a => [a.nombre, a.tienda, a.asignadas, a.gestionadas, a.interesadas, a.cotizadas, a.vendidas, a.reaccionDias, a.semaforo])];
    } else {
      filas = [['Tienda', 'Asesores', 'Asignadas', 'Gestionadas', 'Interesadas', 'Cotizadas', 'Vendidas', 'Cotizado', 'Vendido', 'Semáforo'],
        ...informe.porTienda.map(t => [t.empresa, t.asesores, t.asignadas, t.gestionadas, t.interesadas, t.cotizadas, t.vendidas, porMoneda(t.cotizado), porMoneda(t.vendido), t.semaforo])];
    }
    return { nombre: `informe-${proyecto.codigo || proyecto.id}-${tabla}.csv`, contenido: armar(filas) };
  }
}

module.exports = new ExportacionService();
