// Funciones puras del formulario de solicitud (sin DOM): estado -> payload `datos` del contrato y cálculos que NO son dinero.
// El dinero (combustible, depreciación, hospedaje, comidas, otros, total) lo calcula siempre el servidor.
import { MODALIDADES, LIMITES_SOLICITUD } from '../config/constantes.js';
import { diasEntre } from '../utils/fechas.js';
import { normalizarDecimal } from '../utils/numero.js';

// Los ids del estado son número o '' (sin elegir); un <select> entrega texto.
export function aId(valor) {
  if (valor === '' || valor === null || valor === undefined) return '';
  const n = Number(valor);
  return Number.isInteger(n) ? n : '';
}

export function estadoInicial({ paises = [] } = {}) {
  return {
    paisId: paises.length === 1 ? aId(paises[0].id) : '',
    modalidad: MODALIDADES.MAS_DE_UN_DIA,
    monedaId: '',
    vehiculoId: '',
    rendimiento: '',
    precioGalon: '',
    depreciacion: '',
    fechaSalida: '',
    fechaRegreso: '',
    motivoId: '',
    // El origen de cada tramo se deduce: el primero es este y los demás son el destino del tramo anterior.
    origenInicialId: '',
    tramos: [{ destinoId: '' }],
    hospedajes: [],
    // { 'AAAA-MM-DD': { [tipoComidaId]: true } }
    comidas: {},
    gastos: []
  };
}

// ---------- Ruta ----------
export function buscarTramo(a, b, tramos) {
  return tramos.find(t => (t.ubicacionAId === a && t.ubicacionBId === b) || (t.ubicacionAId === b && t.ubicacionBId === a)) || null;
}

export function ubicacionesConTramo(tramos) {
  return [...new Set(tramos.flatMap(t => [t.ubicacionAId, t.ubicacionBId]))];
}

// Destinos con tramo registrado hacia o desde el origen, en cualquier sentido.
export function destinosPermitidos(origenId, tramos) {
  if (origenId === '' || origenId === null || origenId === undefined) return [];
  const ids = tramos.flatMap(t => (t.ubicacionAId === origenId ? [t.ubicacionBId] : t.ubicacionBId === origenId ? [t.ubicacionAId] : []));
  return [...new Set(ids)].filter(id => id !== origenId);
}

export function origenDelTramo(estado, indice) {
  return indice === 0 ? estado.origenInicialId : estado.tramos[indice - 1].destinoId;
}

// Deja la ruta coherente con el catálogo: un destino sin tramo desde su origen se vacía y se quitan los tramos siguientes (dependían de él).
export function normalizarRuta({ origenInicialId, tramos }, catalogoTramos) {
  const origenValido = ubicacionesConTramo(catalogoTramos).includes(origenInicialId) ? origenInicialId : '';
  let origen = origenValido;
  const filas = [];
  for (const fila of tramos) {
    if (origen !== '' && fila.destinoId !== '' && destinosPermitidos(origen, catalogoTramos).includes(fila.destinoId)) {
      filas.push({ destinoId: fila.destinoId });
      origen = fila.destinoId;
    } else {
      filas.push({ destinoId: '' });
      break;
    }
  }
  if (filas.length === 0) filas.push({ destinoId: '' });
  return { origenInicialId: origenValido, tramos: filas };
}

const redondear2 = (n) => Math.round(n * 100) / 100;

// Km y horas de cada renglón con destino; es un respaldo mientras llega el cálculo del servidor.
export function distanciaDelTramo(estado, indice, catalogoTramos) {
  const origen = origenDelTramo(estado, indice);
  const destino = estado.tramos[indice].destinoId;
  const tramo = origen === '' || destino === '' ? null : buscarTramo(origen, destino, catalogoTramos);
  return tramo ? { km: Number(tramo.km), horas: Number(tramo.horas) } : null;
}

export function rutaLocal(estado, catalogoTramos) {
  let km = 0;
  let horas = 0;
  estado.tramos.forEach((_, i) => {
    const d = distanciaDelTramo(estado, i, catalogoTramos);
    if (d) { km += d.km; horas += d.horas; }
  });
  return { km: redondear2(km), horas: redondear2(horas) };
}

export function totalNochesLocal(hospedajes) {
  return hospedajes.reduce((suma, fila) => {
    const n = Number(normalizarDecimal(fila.noches));
    return suma + (Number.isInteger(n) && n > 0 ? n : 0);
  }, 0);
}

// ---------- Comidas ----------
export function conservarMarcas(marcas, dias) {
  const vigentes = new Set(dias);
  const resultado = {};
  for (const [dia, tipos] of Object.entries(marcas || {})) {
    const activos = Object.fromEntries(Object.entries(tipos).filter(([, marcado]) => marcado));
    if (vigentes.has(dia) && Object.keys(activos).length) resultado[dia] = activos;
  }
  return resultado;
}

export function alternarMarca(marcas, dia, tipoComidaId, marcado) {
  const tipos = { ...(marcas[dia] || {}) };
  if (marcado) tipos[tipoComidaId] = true; else delete tipos[tipoComidaId];
  const resultado = { ...marcas };
  if (Object.keys(tipos).length) resultado[dia] = tipos; else delete resultado[dia];
  return resultado;
}

// { [tipoComidaId]: valor } de la moneda; una comida sin valor configurado no aparece.
export function valoresComidaDeMoneda(valoresComida, monedaId) {
  const valores = {};
  for (const v of valoresComida || []) {
    if (v.monedaId === monedaId && v.valor !== null && v.valor !== undefined && Number(v.valor) > 0) valores[v.tipoComidaId] = v.valor;
  }
  return valores;
}

// ---------- Coherencia con el catálogo ----------
// Quita las marcas de días que ya no están en el viaje y las de comidas sin valor configurado en la moneda.
export function depurarMarcas(marcas, dias, valores) {
  const resultado = {};
  for (const [dia, tipos] of Object.entries(conservarMarcas(marcas, dias))) {
    const vigentes = Object.fromEntries(Object.entries(tipos).filter(([tipo]) => valores[tipo]));
    if (Object.keys(vigentes).length) resultado[dia] = vigentes;
  }
  return resultado;
}

const existe = (lista, id) => id !== '' && lista.some(x => x.id === id);

// Descarta lo elegido que ya no existe en el catálogo (p. ej. al cambiar de país) y preselecciona lo único posible.
export function reconciliarEstado(estado, cat) {
  const vehiculo = cat.vehiculos.find(v => v.id === estado.vehiculoId);
  const monedaId = existe(cat.monedas, estado.monedaId) ? estado.monedaId : (cat.monedas.length === 1 ? cat.monedas[0].id : '');
  const dias = diasEntre(estado.fechaSalida, estado.fechaRegreso);
  const valores = valoresComidaDeMoneda(cat.valoresComida, monedaId);
  const comidas = depurarMarcas(estado.comidas, dias, valores);
  return {
    ...estado,
    monedaId,
    vehiculoId: vehiculo && !vehiculo.bloqueo ? estado.vehiculoId : '',
    motivoId: existe(cat.motivos, estado.motivoId) ? estado.motivoId : '',
    ...normalizarRuta(estado, cat.tramos),
    comidas,
    gastos: estado.gastos.map(g => ({ ...g, tipoGastoId: existe(cat.tiposGasto, g.tipoGastoId) ? g.tipoGastoId : '' }))
  };
}

// ---------- Estado -> payload `datos` ----------
export const vehiculoDelEstado = (estado, cat) => (cat ? cat.vehiculos.find(v => v.id === estado.vehiculoId) || null : null);

function poner(datos, clave, valor) {
  if (valor !== '' && valor !== null && valor !== undefined) datos[clave] = valor;
}

// Importe como texto canónico; un texto que no es número viaja tal cual para que el servidor lo rechace con su regla.
function importe(texto) {
  const canonico = normalizarDecimal(texto);
  return canonico === null ? String(texto).trim() : canonico;
}

function entero(texto) {
  const valor = importe(texto);
  return /^\d+$/.test(valor) ? Number(valor) : valor;
}

const vacio = (texto) => normalizarDecimal(texto) === '';
const sinTexto = (texto) => String(texto ?? '').trim() === '';

// Devuelve { datos, indices } (indices: posición del renglón de la pantalla de cada elemento enviado) o null si no hay cálculo.
// Solo viajan los renglones completos: uno a medias se pide completar o quitar, no se manda a medias.
export function armarPayload(estado, cat, { idempotencyKey } = {}) {
  if (estado.modalidad !== MODALIDADES.MAS_DE_UN_DIA) return null;
  const veh = vehiculoDelEstado(estado, cat);
  const datos = { modalidad: estado.modalidad };
  poner(datos, 'paisId', estado.paisId);
  poner(datos, 'vehiculoId', estado.vehiculoId);
  poner(datos, 'motivoId', estado.motivoId);
  poner(datos, 'monedaId', estado.monedaId);
  poner(datos, 'fechaSalida', estado.fechaSalida);
  poner(datos, 'fechaRegreso', estado.fechaRegreso);
  if (!vacio(estado.rendimiento)) datos.rendimientoKmGalon = importe(estado.rendimiento);
  if (!vacio(estado.precioGalon)) datos.precioGalon = importe(estado.precioGalon);
  if (veh && veh.esPropio && !vacio(estado.depreciacion)) datos.depreciacionPorKm = importe(estado.depreciacion);

  const indices = { tramos: [], hospedajes: [], gastos: [] };
  datos.tramos = [];
  estado.tramos.forEach((fila, i) => {
    const origenId = origenDelTramo(estado, i);
    if (origenId === '' || fila.destinoId === '') return;
    datos.tramos.push({ origenId, destinoId: fila.destinoId });
    indices.tramos.push(i);
  });

  datos.hospedajes = [];
  estado.hospedajes.forEach((fila, i) => {
    if (sinTexto(fila.hotel) || sinTexto(fila.lugar) || vacio(fila.noches) || vacio(fila.valorNoche)) return;
    datos.hospedajes.push({ hotel: fila.hotel.trim(), lugar: fila.lugar.trim(), noches: entero(fila.noches), valorNoche: importe(fila.valorNoche) });
    indices.hospedajes.push(i);
  });

  datos.comidas = [];
  const valores = valoresComidaDeMoneda(cat ? cat.valoresComida : [], estado.monedaId);
  const tipos = cat ? [...cat.tiposComida].sort((a, b) => a.orden - b.orden) : [];
  for (const dia of diasEntre(estado.fechaSalida, estado.fechaRegreso)) {
    for (const tipo of tipos) {
      if (estado.comidas[dia] && estado.comidas[dia][tipo.id] && valores[tipo.id]) datos.comidas.push({ fecha: dia, tipoComidaId: tipo.id });
    }
  }

  datos.gastos = [];
  estado.gastos.forEach((fila, i) => {
    if (fila.tipoGastoId === '' || sinTexto(fila.descripcion) || vacio(fila.monto)) return;
    datos.gastos.push({ tipoGastoId: fila.tipoGastoId, descripcion: fila.descripcion.trim(), monto: importe(fila.monto) });
    indices.gastos.push(i);
  });

  if (idempotencyKey) datos.idempotencyKey = idempotencyKey;
  return { datos, indices };
}

// ---------- Errores ----------
// Lo que falta o está a medias en la pantalla; el texto lo pone quien lo pinta (`clave` de textos.js).
export function erroresLocales(estado, cat) {
  if (!cat || estado.modalidad !== MODALIDADES.MAS_DE_UN_DIA) return [];
  const errores = [];
  const nombre = (id) => (cat.ubicaciones.find(u => u.id === id) || {}).nombre || '';
  if (estado.origenInicialId === '') errores.push({ campo: 'origenInicialId', clave: 'formulario.error.origen' });
  estado.tramos.forEach((fila, i) => {
    const origen = origenDelTramo(estado, i);
    if (origen !== '' && fila.destinoId === '') errores.push({ campo: `tramos[${i}].destinoId`, clave: 'formulario.error.destino', params: { origen: nombre(origen) } });
  });
  estado.hospedajes.forEach((fila, i) => {
    if (sinTexto(fila.hotel)) errores.push({ campo: `hospedajes[${i}].hotel`, clave: 'formulario.error.hotel', params: { max: LIMITES_SOLICITUD.HOTEL } });
    if (sinTexto(fila.lugar)) errores.push({ campo: `hospedajes[${i}].lugar`, clave: 'formulario.error.lugar', params: { max: LIMITES_SOLICITUD.LUGAR } });
    if (vacio(fila.noches)) errores.push({ campo: `hospedajes[${i}].noches`, clave: 'formulario.error.noches' });
    if (vacio(fila.valorNoche)) errores.push({ campo: `hospedajes[${i}].valorNoche`, clave: 'formulario.error.valorNoche' });
  });
  estado.gastos.forEach((fila, i) => {
    if (fila.tipoGastoId === '') errores.push({ campo: `gastos[${i}].tipoGastoId`, clave: 'formulario.error.tipoGasto' });
    if (sinTexto(fila.descripcion)) errores.push({ campo: `gastos[${i}].descripcion`, clave: 'formulario.error.descripcion', params: { max: LIMITES_SOLICITUD.DESCRIPCION } });
    if (vacio(fila.monto)) errores.push({ campo: `gastos[${i}].monto`, clave: 'formulario.error.monto' });
  });
  return errores;
}

// «tramos[1]» del servidor apunta a la posición dentro de lo enviado; aquí se traduce a la del renglón de la pantalla.
export function remapearCampo(campo, indices) {
  const m = /^(tramos|hospedajes|gastos)\[(\d+)\](.*)$/.exec(campo);
  if (m) {
    const posicion = Number(m[2]);
    const fila = indices && indices[m[1]] && indices[m[1]][posicion] !== undefined ? indices[m[1]][posicion] : posicion;
    return `${m[1]}[${fila}]${m[3]}`;
  }
  if (/^comidas(\[|$)/.test(campo)) return 'comidas';
  return campo;
}

export function raizDeCampo(campo) {
  return String(campo).split(/[.[]/)[0];
}
