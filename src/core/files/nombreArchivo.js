// src/core/files/nombreArchivo.js
// Nombres de los objetos en Supabase Storage (sin extensión: la agrega supabaseStorage.subir).
// Esquema: ver odd/tasks/correlativo-documentos-supabase.md

function sinAcentos(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Deja solo [A-Za-z0-9-]; el nombre del objeto debe ser seguro en una URL.
function sanitizarCorrelativo(correlativo) {
  return sinAcentos(correlativo).replace(/[^A-Za-z0-9-]/g, '-');
}

// Parte de un nombre de taller o código de tienda apta para el nombre del objeto.
function segmento(texto) {
  return sinAcentos(texto).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
}

// Un taller nuevo debe agregarse aquí; si no, entregar una propuesta con archivo falla.
// `taller`: { nombre, tienda_codigo? }. Diseño Local usa el código de su tienda; si no viene,
// se toma del nombre ('Diseño Local - ECL' -> ECL), que coincide con tiendas.codigo.
function codigoTaller(taller) {
  const nombre = String((taller && taller.nombre) || '').trim();
  const base = segmento(nombre);
  if (base === 'DISENO') return 'DISENIO';
  if (/^DISENO_UV_?3D$/.test(base)) return 'DISENIO_UV3D';
  if (base === 'PROTEXTIL') return 'PROTEXTIL';
  if (/^DISENO_LOCAL/.test(base)) {
    const tienda = segmento((taller && taller.tienda_codigo) || nombre.split(' - ').slice(1).join(' ') || '');
    if (!tienda) throw new Error(`No se pudo determinar el código de tienda del taller "${nombre}".`);
    return `DISENIO_${tienda}`;
  }
  throw new Error(`El taller "${nombre}" no tiene código para nombrar archivos en Storage. Agrégalo en codigoTaller (src/core/files/nombreArchivo.js).`);
}

function pdfCreacion(correlativo) {
  return `${sanitizarCorrelativo(correlativo)}_CREACION`;
}

function pdfAutorizacion(correlativo) {
  return `${sanitizarCorrelativo(correlativo)}_AUTORIZACION`;
}

function prefijoCorreccionPreAutorizacion(correlativo) {
  return `${sanitizarCorrelativo(correlativo)}_CORRECCION_PRE_AUTORIZACION`;
}

function pdfCorreccionPreAutorizacion(correlativo, contador) {
  return `${prefijoCorreccionPreAutorizacion(correlativo)}_${contador}`;
}

// Adjuntos: tipo 'IMAGEN'|'PDF', etapa 'CREACION'|'CORRECCION'.
function adjunto(correlativo, tipo, etapa, contador) {
  return `${sanitizarCorrelativo(correlativo)}_${tipo}_${etapa}_${contador}`;
}

function prefijoAdjunto(correlativo, tipo, etapa) {
  return `${sanitizarCorrelativo(correlativo)}_${tipo}_${etapa}`;
}

// Borradores (bucket aparte): tipo 'IMAGEN'|'PDF'; el id es el del borrador, no hay correlativo todavía.
function prefijoBorrador(borradorId, tipo) {
  return `BORRADOR-${Number(borradorId)}_${tipo}`;
}

function borrador(borradorId, tipo, contador) {
  return `${prefijoBorrador(borradorId, tipo)}_${contador}`;
}

// Herramienta admin: tipo 'CREACION'|'AUTORIZACION'.
function prefijoCorreccionAdmin(correlativo, tipo) {
  return `${sanitizarCorrelativo(correlativo)}_CORRECCION_${tipo}_ADMIN`;
}

function correccionAdmin(correlativo, tipo, contador) {
  return `${prefijoCorreccionAdmin(correlativo, tipo)}_${contador}`;
}

function propuesta(correlativo, taller, contador) {
  return `${prefijoPropuesta(correlativo, taller)}_${contador}`;
}

function prefijoPropuesta(correlativo, taller) {
  return `${sanitizarCorrelativo(correlativo)}_PROPUESTA_${codigoTaller(taller)}`;
}

function prefijoPropuestaFusion(correlativo) {
  return `${sanitizarCorrelativo(correlativo)}_PROPUESTA_FUSION`;
}

function propuestaFusion(correlativo, contador) {
  return `${prefijoPropuestaFusion(correlativo)}_${contador}`;
}

// Máximo X + 1 entre las URLs/nombres que empiezan por `${prefijo}_` seguido solo de dígitos
// (se ignoran carpeta, extensión y querystring); 1 si no hay ninguno.
function siguienteContador(urlsExistentes, prefijo) {
  let max = 0;
  for (const valor of urlsExistentes || []) {
    if (!valor) continue;
    const nombre = String(valor).split(/[?#]/)[0].split('/').pop().replace(/\.[A-Za-z0-9]+$/, '');
    if (!nombre.startsWith(`${prefijo}_`)) continue;
    const resto = nombre.slice(prefijo.length + 1);
    if (/^\d+$/.test(resto)) max = Math.max(max, Number(resto));
  }
  return max + 1;
}

module.exports = {
  sanitizarCorrelativo, codigoTaller, siguienteContador,
  pdfCreacion, pdfAutorizacion, prefijoCorreccionPreAutorizacion, pdfCorreccionPreAutorizacion,
  adjunto, prefijoAdjunto, borrador, prefijoBorrador, propuesta, prefijoPropuesta, prefijoPropuestaFusion, propuestaFusion,
  prefijoCorreccionAdmin, correccionAdmin
};
