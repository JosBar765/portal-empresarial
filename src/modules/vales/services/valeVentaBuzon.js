// Venta de los vales en «Trabajo realizado»: dato de cada fila, pendientes siempre a la vista, su orden y su contador.
const ventaRepository = require('../repositories/valeVentaRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const { ROL, esAdministrador, esSupervisor, estadoVisibleAsesor } = require('./valeHelpers');
const { ESTADOS_VENTA, admiteVenta, veVenta, porConfirmar, ordenarConVentas } = require('./valeVentaReglas');

const FILTRO = 'porConfirmarOv';

// De esos asesores, los que supervisa quien mira; el administrador y el gerente solo leen.
async function supervisadosDe(usuario, asesorIds) {
  if (!esSupervisor(usuario) || esAdministrador(usuario) || usuario.rolId === ROL.GERENTE) return new Set();
  const propios = await Promise.all([...new Set(asesorIds)].map(async (id) => (
    (await usuarioValeRepository.obtenerSupervisoresDeAsesor(id)).some(s => s.id === usuario.id) ? id : null
  )));
  return new Set(propios.filter(id => id !== null));
}

// `filas`: las que armó el rol. `cargarVales(ids)` trae los pendientes que faltan (fuera del período); `enTiendas` aplica el filtro
// de tiendas; `comoPropias`: en las vistas de taller y diseñador el vale se presenta como propio.
async function aplicarVentas({ usuario, filas, filtroContador, enTiendas, cargarVales, comoPropias }) {
  const pendientes = await ventaRepository.listarPorConfirmar();
  const activas = await ventaRepository.listarActivasPorVales([...new Set(filas.filter(admiteVenta).map(f => f.id))]);
  const supervisados = await supervisadosDe(usuario, [...pendientes, ...activas].map(v => v.asesor_id));
  const visibles = new Map([...activas, ...pendientes]
    .filter(v => veVenta(usuario, v.asesor_id, supervisados))
    .map(v => [v.vale_id, v]));
  const datosVenta = (v) => ({
    id: v.id, numero: v.numero_ov, estado: v.estado, registrada_en: v.registrada_en,
    puede_decidir: v.estado === ESTADOS_VENTA.POR_CONFIRMAR && supervisados.has(v.asesor_id)
  });

  const conVenta = filas.map(f => (admiteVenta(f) && visibles.has(f.id) ? { ...f, venta: datosVenta(visibles.get(f.id)) } : f));

  const presentes = new Set(filas.filter(admiteVenta).map(f => f.id));
  const faltan = [...visibles.values()].filter(v => v.estado === ESTADOS_VENTA.POR_CONFIRMAR && !presentes.has(v.vale_id)).map(v => v.vale_id);
  const extras = (faltan.length ? await cargarVales(faltan) : []).filter(enTiendas).map(v => ({
    ...v, estado_visible: estadoVisibleAsesor(v), venta: datosVenta(visibles.get(v.id)),
    ...(comoPropias ? { _propio: true, aprobado_en: v.actualizado_en, _rowKey: `${v.id}-O` } : {})
  }));
  const porConfirmarOv = conVenta.filter(porConfirmar).length + extras.length;

  // Con otra tarjeta activa manda su filtro: no se agregan vales ajenos a él.
  const agregar = !filtroContador || filtroContador === FILTRO;
  const todas = agregar ? [...conVenta, ...extras] : conVenta;
  return {
    vales: ordenarConVentas(filtroContador === FILTRO ? todas.filter(porConfirmar) : todas),
    porConfirmarOv
  };
}

module.exports = { aplicarVentas };
