// Funciones puras del viaje de 1 día o menos (sin DOM): estado <-> payload `inspeccion`, fotos de defectos y errores locales.
// Un defecto vive en el estado como { tipoDefectoId, descripcion, foto (File nueva), defectoId (existente), url (miniatura existente), errorFoto }.
import { MODALIDADES, LIMITES_SOLICITUD } from '../config/constantes.js';
import { aId } from '../utils/ids.js';
import { normalizarDecimal, numeroATexto } from '../utils/numero.js';
import { formatearTamano } from '../utils/formato.js';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const ETIQUETA_TIPO = { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WEBP' };
const porOrden = (lista) => [...(lista || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
const sinTexto = (texto) => String(texto ?? '').trim() === '';

export function estadoCortoInicial() {
  return { horaSalida: '', odometro: '', fluidos: {}, kit: {}, defectos: [] };
}

export const defectoNuevo = () => ({ tipoDefectoId: '', descripcion: '', foto: null, defectoId: null, url: '', errorFoto: null });

export function defectoDeDetalle(d) {
  return { tipoDefectoId: aId(d.tipoDefectoId), descripcion: d.descripcion || '', foto: null, defectoId: aId(d.id) === '' ? null : aId(d.id), url: d.url || '', errorFoto: null };
}

// «AAAA-MM-DD HH:mm[:ss]» -> { fecha, hora }; lo que no encaja queda vacío.
export function separarFechaHora(texto) {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/.exec(String(texto || ''));
  return { fecha: m ? m[1] : '', hora: m && m[2] ? m[2] : '' };
}

export const horaValida = (hora) => HORA.test(String(hora || ''));

// Fecha y hora juntas como las pide el contrato; '' mientras falte alguna o la hora sea inválida.
export function fechaHoraSalida(estado) {
  return estado.fechaSalida && horaValida(estado.horaSalida) ? `${estado.fechaSalida} ${estado.horaSalida}` : '';
}

// ---------- Fotos ----------
// Solo cuentan los tipos de imagen de `tipos_archivo_permitidos`; sin ajustes el cliente no opina y decide el servidor.
export function limitesDeFoto(ajustes) {
  const tipos = Array.isArray(ajustes && ajustes.tiposArchivoPermitidos) ? ajustes.tiposArchivoPermitidos.filter(t => /^image\//.test(t)) : [];
  const mb = Number(ajustes && ajustes.maxArchivoMb);
  return { tipos, maxMb: Number.isFinite(mb) && mb > 0 ? mb : null };
}

export const etiquetaTipoImagen = (tipo) => ETIQUETA_TIPO[tipo] || String(tipo);

// null si la foto sirve; si no, { clave, params } del texto explicativo (el texto lo pone quien lo pinta).
export function validarFoto(archivo, ajustes) {
  const { tipos, maxMb } = limitesDeFoto(ajustes);
  const nombre = archivo.name || '';
  if (!archivo.size) return { clave: 'formulario.foto.vacia', params: { nombre } };
  if (!/^image\//.test(archivo.type || '')) return { clave: 'formulario.foto.noEsImagen', params: { nombre, tipo: archivo.type || 'desconocido' } };
  if (tipos.length && !tipos.includes(archivo.type)) {
    return { clave: 'formulario.foto.tipoNoPermitido', params: { nombre, tipo: etiquetaTipoImagen(archivo.type), permitidos: tipos.map(etiquetaTipoImagen).join(', ') } };
  }
  if (maxMb && archivo.size > maxMb * 1024 * 1024) return { clave: 'formulario.foto.demasiadoGrande', params: { nombre, tamano: formatearTamano(archivo.size), max: maxMb } };
  return null;
}

// ---------- Fluidos ----------
// Fluidos cuyo nivel elegido queda por debajo de la mitad (`bajoLaMitad` del nivel): el PDF los registra.
export function nivelesBajos(estado, cat) {
  const bajos = [];
  for (const fluido of porOrden(cat ? cat.fluidos : [])) {
    const nivel = fluido.niveles.find(n => n.id === estado.fluidos[fluido.id]);
    if (nivel && nivel.bajoLaMitad) bajos.push({ fluidoId: fluido.id, fluido: fluido.nombre, nivel: nivel.nombre });
  }
  return bajos;
}

// ---------- Estado -> payload ----------
const tipoDe = (cat, id) => (cat ? (cat.tiposDefecto || []).find(t => t.id === id) || null : null);

function odometroDePayload(texto) {
  const canonico = normalizarDecimal(texto);
  if (canonico === null) return String(texto).trim();
  return /^\d+(\.\d+)?$/.test(canonico) && Number.isFinite(Number(canonico)) ? Number(canonico) : canonico;
}

// Devuelve { inspeccion, indices, fotos }: `fotos` va en el orden de `archivoIndice` y `indices` traduce la posición enviada a la de la pantalla.
// Solo viajan los renglones completos (el resto se pide completar o quitar en pantalla).
export function armarInspeccion(estado, cat) {
  const indices = { fluidos: [], kit: [], defectos: [] };
  const fotos = [];
  const inspeccion = {};
  if (normalizarDecimal(estado.odometro) !== '') inspeccion.odometro = odometroDePayload(estado.odometro);

  inspeccion.fluidos = [];
  porOrden(cat ? cat.fluidos : []).forEach((fluido, k) => {
    const nivelId = estado.fluidos[fluido.id];
    if (!fluido.niveles.some(n => n.id === nivelId)) return;
    inspeccion.fluidos.push({ fluidoId: fluido.id, nivelId });
    indices.fluidos.push(k);
  });

  inspeccion.kit = [];
  porOrden(cat ? cat.kit : []).forEach((item, k) => {
    if (typeof estado.kit[item.id] !== 'boolean') return;
    inspeccion.kit.push({ kitItemId: item.id, presente: estado.kit[item.id] });
    indices.kit.push(k);
  });

  inspeccion.defectos = [];
  estado.defectos.forEach((fila, i) => {
    const tipo = tipoDe(cat, fila.tipoDefectoId);
    const tieneFoto = !!fila.foto || fila.defectoId !== null;
    if (!tipo || !tieneFoto || (tipo.esOtros && sinTexto(fila.descripcion))) return;
    const defecto = { tipoDefectoId: tipo.id };
    if (tipo.esOtros) defecto.descripcion = fila.descripcion.trim();
    if (fila.foto) { defecto.archivoIndice = fotos.length; fotos.push(fila.foto); } else defecto.defectoId = fila.defectoId;
    inspeccion.defectos.push(defecto);
    indices.defectos.push(i);
  });
  return { inspeccion, indices, fotos };
}

function poner(datos, clave, valor) {
  if (valor !== '' && valor !== null && valor !== undefined) datos[clave] = valor;
}

// Payload completo del viaje corto; sin importes ni tramos (el contrato no los admite).
export function armarPayloadCorto(estado, cat, { idempotencyKey } = {}) {
  const datos = { modalidad: MODALIDADES.HASTA_UN_DIA };
  poner(datos, 'paisId', estado.paisId);
  poner(datos, 'vehiculoId', estado.vehiculoId);
  poner(datos, 'motivoId', estado.motivoId);
  poner(datos, 'fechaSalida', fechaHoraSalida(estado));
  const { inspeccion, indices, fotos } = armarInspeccion(estado, cat);
  datos.inspeccion = inspeccion;
  if (idempotencyKey) datos.idempotencyKey = idempotencyKey;
  return { datos, indices, fotos };
}

// ---------- Coherencia con el catálogo ----------
export function reconciliarCorto(estado, cat) {
  const fluidos = {};
  for (const fluido of cat.fluidos || []) {
    const nivelId = estado.fluidos[fluido.id];
    if (fluido.niveles.some(n => n.id === nivelId)) fluidos[fluido.id] = nivelId;
  }
  const kit = {};
  for (const item of cat.kit || []) if (typeof estado.kit[item.id] === 'boolean') kit[item.id] = estado.kit[item.id];
  const defectos = estado.defectos.map(d => (tipoDe(cat, d.tipoDefectoId) ? d : { ...d, tipoDefectoId: '' }));
  return { fluidos, kit, defectos };
}

// ---------- Errores locales ----------
export function erroresLocalesCorto(estado, cat) {
  if (!cat) return [];
  const errores = [];
  if (estado.fechaSalida && !horaValida(estado.horaSalida)) errores.push({ campo: 'horaSalida', clave: 'formulario.error.hora' });
  const odometro = Number(normalizarDecimal(estado.odometro));
  if (normalizarDecimal(estado.odometro) === '' || !(odometro > 0)) errores.push({ campo: 'inspeccion.odometro', clave: 'formulario.error.odometro' });
  porOrden(cat.fluidos).forEach((fluido, k) => {
    if (!fluido.niveles.some(n => n.id === estado.fluidos[fluido.id])) {
      errores.push({ campo: `inspeccion.fluidos[${k}]`, clave: 'formulario.error.fluido', params: { fluido: fluido.nombre.toLowerCase() } });
    }
  });
  porOrden(cat.kit).forEach((item, k) => {
    if (typeof estado.kit[item.id] !== 'boolean') errores.push({ campo: `inspeccion.kit[${k}]`, clave: 'formulario.error.kit', params: { item: item.nombre.toLowerCase() } });
  });
  estado.defectos.forEach((fila, i) => {
    const tipo = tipoDe(cat, fila.tipoDefectoId);
    if (!tipo) errores.push({ campo: `inspeccion.defectos[${i}].tipoDefectoId`, clave: 'formulario.error.defectoTipo', params: { n: i + 1 } });
    else if (tipo.esOtros && sinTexto(fila.descripcion)) {
      errores.push({ campo: `inspeccion.defectos[${i}].descripcion`, clave: 'formulario.error.defectoDescripcion', params: { max: LIMITES_SOLICITUD.DESCRIPCION, tipo: tipo.nombre } });
    }
    if (fila.errorFoto) errores.push({ campo: `inspeccion.defectos[${i}]`, clave: fila.errorFoto.clave, params: fila.errorFoto.params });
    else if (!fila.foto && fila.defectoId === null) errores.push({ campo: `inspeccion.defectos[${i}]`, clave: 'formulario.error.defectoFoto', params: { n: i + 1 } });
  });
  return errores;
}

// ---------- Detalle del servidor -> estado ----------
const presente = (valor) => valor === true || valor === 1 || valor === '1';

export function estadoCortoDeDetalle(detalle) {
  const { fecha, hora } = separarFechaHora(detalle.fechaSalida);
  const insp = detalle.inspeccion || {};
  const fluidos = {};
  for (const f of insp.fluidos || []) fluidos[f.fluidoId] = aId(f.nivelId);
  const kit = {};
  for (const k of insp.kit || []) kit[k.kitItemId] = presente(k.presente);
  return {
    fechaSalida: fecha,
    horaSalida: hora,
    odometro: numeroATexto(insp.odometro ?? detalle.odometro),
    fluidos,
    kit,
    defectos: (insp.defectos || []).map(defectoDeDetalle)
  };
}
