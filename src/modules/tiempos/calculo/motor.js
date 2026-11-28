// src/modules/tiempos/calculo/motor.js
// Motor de la Calculadora de Tiempos: funciones puras (sin base de datos ni red) sobre una `tabla` ya cargada.
//  - Pieza: días por etapa del rango de su cantidad + extras elegidos + margen = días al cliente.
//  - Extras: los define el administrador (ver calculo/extras.js); cada uno suma según su tipo (sí/no, por cantidad, por unidades).
//  - Pedido: las piezas se hacen a la vez, así que la entrega es la de la pieza más larga (no se suman entre sí).
//  - Si una pieza no tiene tiempo en la tabla (cantidad «a convenir»), todo el pedido queda a convenir.
//  - Urgente no acorta nada: solo se marca para avisar que lo autoriza el gerente.
const { esFechaISO, hacerDiaHabil, sumarDiasHabiles, primerDiaHabil } = require('./fechas');
const { aplica, diasPorUnidades } = require('./extras');

const AVISO_URGENTE = 'Pedido urgente: necesita autorización del gerente. Aquí ves los tiempos normales.';

const cantidadValida = (c) => typeof c === 'number' && Number.isInteger(c) && c >= 1;
const enRango = (r, cantidad) => cantidad >= r.desde && (r.hasta === null || cantidad <= r.hasta);
const buscarRango = (rangos, cantidad) => rangos.find(r => enRango(r, cantidad)) || null;
const parametro = (tabla, clave, defecto) => (tabla.parametros && tabla.parametros[clave] !== undefined && tabla.parametros[clave] !== null ? tabla.parametros[clave] : defecto);
const nombreEtapa = (tabla, clave) => (tabla.etapas[clave] ? tabla.etapas[clave].nombre : clave);
const minuscula = (t) => t.charAt(0).toLowerCase() + t.slice(1);

function invalida(errores) { return { estado: 'invalida', errores }; }

// Revisa lo que eligió el usuario para cada extra y lo deja listo: Map clave → valor (true, clave de opción o número).
function elegidos(tabla, producto, pedidos, errores) {
  const listo = new Map();
  for (const [clave, valor] of Object.entries(pedidos || {})) {
    const e = tabla.extras.find(x => x.clave === clave);
    const campo = `extras.${clave}`;
    if (!e) { errores[campo] = 'Ese extra no existe. Recarga la página.'; continue; }
    if (valor === false || valor === null || valor === undefined || valor === '') continue;
    if (e.activo === false) { errores[campo] = `«${e.nombre}» ya no está disponible. Recarga la página.`; continue; }
    if (producto && !aplica(e, producto)) { errores[campo] = `Este producto no lleva «${minuscula(e.nombre)}».`; continue; }
    if (e.tipo === 'si_no') {
      if (valor !== true) errores[campo] = `Marca o desmarca «${e.etiqueta}».`; else listo.set(clave, true);
    } else if (e.tipo === 'por_unidades') {
      if (!Number.isInteger(valor) || valor < 1 || valor > e.unidades.max) errores[campo] = `Escribe la cantidad de ${minuscula(e.nombre)}, de 1 a ${e.unidades.max}.`;
      else listo.set(clave, valor);
    } else {
      const opcion = valor === true && e.opciones.length === 1 ? e.opciones[0] : e.opciones.find(o => o.clave === valor);
      if (!opcion) errores[campo] = e.opciones.length > 1 ? `Elige un tipo de ${minuscula(e.nombre)} de la lista.` : `Marca o desmarca «${e.etiqueta}».`;
      else listo.set(clave, opcion);
    }
  }
  return listo;
}

// Los campos de antes (colores, moldesGrande, lanyard, uv) siguen valiendo: se pasan a `extras` con las claves de la carga inicial,
// y sus errores se devuelven con el nombre del campo que se mandó.
const CAMPOS_ANTERIORES = [['colores', 'colores'], ['moldesGrande', 'moldes'], ['lanyard', 'costura'], ['uv', 'uv']];
function extrasPedidos(pieza) {
  const extras = { ...(pieza.extras && typeof pieza.extras === 'object' && !Array.isArray(pieza.extras) ? pieza.extras : {}) };
  const origen = {};
  for (const [campo, clave] of CAMPOS_ANTERIORES) {
    const v = pieza[campo];
    if (v === undefined || v === null || v === false || v === '' || extras[clave] !== undefined) continue;
    extras[clave] = v; origen[`extras.${clave}`] = campo;
  }
  return { extras, origen };
}

// Calcula una pieza: { productoClave, cantidad, extras?: { clave: true | claveDeOpcion | número }, urgente? }
function calcularPieza(tabla, pieza) {
  const errores = {};
  const producto = tabla.productos[pieza.productoClave];
  if (!producto || producto.activo === false) errores.productoClave = 'Elige un producto de la lista.';
  if (!cantidadValida(pieza.cantidad)) errores.cantidad = 'Escribe la cantidad de piezas como un número entero, de 1 en adelante.';
  const pedidos = extrasPedidos(pieza);
  const errExtras = {};
  const listo = elegidos(tabla, producto && producto.activo !== false ? producto : null, pedidos.extras, errExtras);
  for (const [k, m] of Object.entries(errExtras)) errores[pedidos.origen[k] || k] = m;
  if (Object.keys(errores).length) return invalida(errores);

  const base = { productoClave: producto.clave, producto: producto.nombre, cantidad: pieza.cantidad, urgente: Boolean(pieza.urgente) };
  const avisos = [...(producto.avisos || [])];
  const primero = producto.rangos[0];
  if (pieza.cantidad < primero.desde) return { ...base, estado: 'bajo_minimo', minimo: primero.desde, mensaje: `Este producto se trabaja desde ${primero.desde} piezas.`, avisos };
  const rango = buscarRango(producto.rangos, pieza.cantidad);
  if (!rango || rango.aConvenir) return { ...base, estado: 'a_convenir', rango: rango ? { desde: rango.desde, hasta: rango.hasta } : null, mensaje: `Esta cantidad (${rango ? rango.desde : pieza.cantidad} piezas o más) no está en la tabla: el tiempo se acuerda con producción.`, avisos };

  const etapas = producto.etapas.map(clave => ({ clave, nombre: nombreEtapa(tabla, clave), dias: rango.dias[clave] }));
  const extras = [];
  const aConvenirPor = (nombre) => ({ ...base, estado: 'a_convenir', rango: { desde: rango.desde, hasta: rango.hasta }, mensaje: `${nombre}: esta cantidad no está en la tabla, el tiempo se acuerda con producción.`, avisos });

  // En el orden de la tabla; los de unidades cuentan siempre (si no se eligen, valen lo incluido).
  for (const e of tabla.extras) {
    if (e.tipo === 'por_unidades') {
      if (e.activo === false || !aplica(e, producto)) continue;
      const n = listo.has(e.clave) ? listo.get(e.clave) : e.unidades.incluidas;
      const d = diasPorUnidades(e.unidades, n);
      if (d > 0) extras.push({ clave: e.clave, nombre: `${e.nombre} extra (${n - e.unidades.incluidas})`, dias: d });
      continue;
    }
    if (!listo.has(e.clave)) continue;
    if (e.tipo === 'si_no') extras.push({ clave: e.clave, nombre: e.nombre, dias: e.diasFijos });
    else {
      const o = listo.get(e.clave);
      const nombre = e.opciones.length > 1 ? o.nombre : e.nombre;
      if (pieza.cantidad < o.rangos[0].desde) return { ...base, estado: 'bajo_minimo', minimo: o.rangos[0].desde, mensaje: `${nombre} se trabaja desde ${o.rangos[0].desde} piezas.`, avisos };
      const r = buscarRango(o.rangos, pieza.cantidad);
      if (!r || r.aConvenir) return aConvenirPor(nombre);
      extras.push({ clave: e.clave, opcion: o.clave, nombre, dias: r.dias });
      if (o.aviso) avisos.push(o.aviso);
    }
    if (e.aviso) avisos.push(e.aviso);
  }
  if (pieza.urgente) avisos.push(parametro(tabla, 'aviso_urgente', AVISO_URGENTE));

  const margen = parametro(tabla, 'margen_dias', 1);
  const diasEtapas = etapas.reduce((s, e) => s + e.dias, 0);
  const diasExtras = extras.reduce((s, e) => s + e.dias, 0);
  return { ...base, estado: 'ok', rango: { desde: rango.desde, hasta: rango.hasta }, etapas, extras, margen, total: diasEtapas + diasExtras + margen, avisos };
}

// Calcula un pedido: { fechaOrden: 'AAAA-MM-DD', piezas: [...] } con `opciones.esHabil(iso)` para festivos.
function calcularPedido(tabla, pedido, opciones = {}) {
  const esHabil = opciones.esHabil || hacerDiaHabil();
  const errores = {};
  if (!esFechaISO(pedido.fechaOrden)) errores.fechaOrden = 'Elige la fecha de la orden.';
  if (!Array.isArray(pedido.piezas) || !pedido.piezas.length) errores.piezas = 'Agrega al menos una pieza.';
  if (Object.keys(errores).length) return invalida(errores);

  const piezas = pedido.piezas.map(p => calcularPieza(tabla, p));
  const hayInvalida = piezas.some(p => p.estado === 'invalida');
  const hayBajoMinimo = piezas.some(p => p.estado === 'bajo_minimo');
  const hayAConvenir = piezas.some(p => p.estado === 'a_convenir');
  const urgente = piezas.some(p => p.urgente);
  const avisosGenerales = tabla.avisosGenerales || [];
  const comun = { piezas, urgente, avisoUrgente: parametro(tabla, 'aviso_urgente', AVISO_URGENTE), avisosGenerales, version: tabla.version || null };
  if (hayInvalida) return { ...comun, estado: 'invalida' };
  if (hayBajoMinimo) return { ...comun, estado: 'bajo_minimo' };
  if (hayAConvenir) return { ...comun, estado: 'a_convenir' };

  let masLarga = 0;
  piezas.forEach((p, i) => { if (p.total > piezas[masLarga].total) masLarga = i; });
  const dias = piezas[masLarga].total;
  return {
    ...comun, estado: 'ok', dias, piezaMasLarga: masLarga,
    desde: primerDiaHabil(pedido.fechaOrden, esHabil), fechaOrden: pedido.fechaOrden, fechaEntrega: sumarDiasHabiles(pedido.fechaOrden, dias, esHabil)
  };
}

module.exports = { calcularPieza, calcularPedido, buscarRango, AVISO_URGENTE };
