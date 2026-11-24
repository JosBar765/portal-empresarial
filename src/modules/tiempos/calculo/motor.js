// src/modules/tiempos/calculo/motor.js
// Motor de la Calculadora de Tiempos: funciones puras (sin base de datos ni red) sobre una `tabla` ya cargada.
//  - Pieza: días por etapa del rango de su cantidad + extras (colores, moldes, costura de lanyard, UV) + margen = días al cliente.
//  - Pedido: las piezas se hacen a la vez, así que la entrega es la de la pieza más larga (no se suman entre sí).
//  - Si una pieza no tiene tiempo en la tabla (cantidad «a convenir»), todo el pedido queda a convenir.
//  - Urgente no acorta nada: solo se marca para avisar que lo autoriza el gerente.
const { esFechaISO, hacerDiaHabil, sumarDiasHabiles, primerDiaHabil } = require('./fechas');

const PRODUCTO_COSTURA = 'protextil-lanyard';
const ETAPA_COSTURA = 'costura';

const cantidadValida = (c) => typeof c === 'number' && Number.isInteger(c) && c >= 1;
const enRango = (r, cantidad) => cantidad >= r.desde && (r.hasta === null || cantidad <= r.hasta);
const buscarRango = (rangos, cantidad) => rangos.find(r => enRango(r, cantidad)) || null;
const parametro = (tabla, clave, defecto) => (tabla.parametros && tabla.parametros[clave] !== undefined ? tabla.parametros[clave] : defecto);
const nombreEtapa = (tabla, clave) => (tabla.etapas[clave] ? tabla.etapas[clave].nombre : clave);

function invalida(errores) { return { estado: 'invalida', errores }; }

// Calcula una pieza: { productoClave, cantidad, colores?, moldesGrande?, lanyard?, uv?: claveDeUv|null, urgente? }
function calcularPieza(tabla, pieza) {
  const errores = {};
  const producto = tabla.productos[pieza.productoClave];
  if (!producto || producto.activo === false) errores.productoClave = 'Elige un producto de la lista.';
  if (!cantidadValida(pieza.cantidad)) errores.cantidad = 'Escribe la cantidad de piezas como un número entero, de 1 en adelante.';
  const incluidos = parametro(tabla, 'colores_incluidos', 2);
  const colores = pieza.colores === undefined || pieza.colores === null ? incluidos : pieza.colores;
  if (!Number.isInteger(colores) || colores < 1 || colores > 12) errores.colores = 'Escribe la cantidad de colores, de 1 a 12.';
  if (pieza.moldesGrande && producto && !producto.permiteMoldes) errores.moldesGrande = 'Este producto no lleva moldes.';
  if (pieza.lanyard && producto && !producto.permiteLanyard) errores.lanyard = 'Este producto no lleva listón o lanyard cosido.';
  if (pieza.uv && !(tabla.extras && tabla.extras[pieza.uv])) errores.uv = 'Elige un tipo de impresión UV de la lista.';
  if (Object.keys(errores).length) return invalida(errores);

  const base = { productoClave: producto.clave, producto: producto.nombre, cantidad: pieza.cantidad, colores, urgente: Boolean(pieza.urgente) };
  const avisos = [...(producto.avisos || [])];
  const primero = producto.rangos[0];
  if (pieza.cantidad < primero.desde) return { ...base, estado: 'bajo_minimo', minimo: primero.desde, mensaje: `Este producto se trabaja desde ${primero.desde} piezas.`, avisos };
  const rango = buscarRango(producto.rangos, pieza.cantidad);
  if (!rango || rango.aConvenir) return { ...base, estado: 'a_convenir', rango: rango ? { desde: rango.desde, hasta: rango.hasta } : null, mensaje: `Esta cantidad (${rango ? rango.desde : pieza.cantidad} o más) no está en la tabla: el tiempo se acuerda con producción.`, avisos };

  const etapas = producto.etapas.map(clave => ({ clave, nombre: nombreEtapa(tabla, clave), dias: rango.dias[clave] }));
  const extras = [];
  const aConvenirPor = (nombre) => ({ ...base, estado: 'a_convenir', rango: { desde: rango.desde, hasta: rango.hasta }, mensaje: `${nombre}: esta cantidad no está en la tabla, el tiempo se acuerda con producción.`, avisos });

  // Colores: la tabla incluye `colores_incluidos`; por cada `colores_cada` colores extra se suman `colores_dias` días.
  const extra = Math.max(0, colores - incluidos);
  if (extra > 0) {
    const grupos = Math.ceil(extra / parametro(tabla, 'colores_cada', 2));
    extras.push({ clave: 'colores', nombre: `Colores extra (${extra})`, dias: grupos * parametro(tabla, 'colores_dias', 1) });
  }
  if (pieza.moldesGrande) extras.push({ clave: 'moldes', nombre: 'Moldes (más de 3.5 pulgadas)', dias: parametro(tabla, 'moldes_dias', 2) });
  if (pieza.lanyard) {
    const costura = tabla.productos[PRODUCTO_COSTURA];
    const rc = costura ? buscarRango(costura.rangos, pieza.cantidad) : null;
    if (!costura) return invalida({ lanyard: 'No está cargado el tiempo de costura del lanyard.' });
    if (pieza.cantidad < costura.rangos[0].desde) return { ...base, estado: 'bajo_minimo', minimo: costura.rangos[0].desde, mensaje: `La costura del lanyard se trabaja desde ${costura.rangos[0].desde} piezas.`, avisos };
    if (!rc || rc.aConvenir) return aConvenirPor('Costura del lanyard');
    extras.push({ clave: 'costura', nombre: 'Costura del lanyard', dias: rc.dias[ETAPA_COSTURA] });
  }
  if (pieza.uv) {
    const uv = tabla.extras[pieza.uv];
    const ru = buscarRango(uv.rangos, pieza.cantidad);
    if (pieza.cantidad < uv.rangos[0].desde) return { ...base, estado: 'bajo_minimo', minimo: uv.rangos[0].desde, mensaje: `${uv.nombre} se trabaja desde ${uv.rangos[0].desde} piezas.`, avisos };
    if (!ru || ru.aConvenir) return aConvenirPor(uv.nombre);
    extras.push({ clave: uv.clave, nombre: uv.nombre, dias: ru.dias });
    if (uv.aviso) avisos.push(uv.aviso);
  }
  if (pieza.urgente) avisos.push('Pedido urgente: necesita autorización del gerente. Aquí ves los tiempos normales.');

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
  const comun = { piezas, urgente, avisosGenerales, version: tabla.version || null };
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

module.exports = { calcularPieza, calcularPedido, buscarRango, PRODUCTO_COSTURA };
