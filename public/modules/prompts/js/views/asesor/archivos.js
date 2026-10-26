// Reglas puras (sin DOM) de las imágenes del asesor; formatos y límites salen de /config.
import { t } from '../../textos.js';

const BYTES_POR_MB = 1024 * 1024;

// Extensiones por nombre de formato y el mapa MIME -> extensión principal.
export const extensionesDeFormato = (formatosImagen, formato) => (formatosImagen[formato] && formatosImagen[formato].extensiones) || [formato];

export function mimeAExtension(formatosImagen) {
  const mapa = {};
  for (const f of Object.values(formatosImagen)) mapa[f.mime] = f.extensiones[0];
  return mapa;
}

export const listaConO = (items) => (items.length > 1
  ? `${items.slice(0, -1).join(', ')}${t('asesor.campos.formatosUnion')}${items[items.length - 1]}`
  : items.join(''));

// Reglas efectivas de un parámetro de imágenes (las del esquema o los valores por defecto del servidor).
export function reglasImagenes(p, config) {
  const { limites, formatosImagen } = config;
  const formatos = p.formatos && p.formatos.length ? p.formatos : Object.keys(formatosImagen);
  return {
    max: p.max || limites.imagenes_max_defecto,
    maxMb: p.max_mb || limites.imagenes_mb_defecto,
    maxNombre: limites.imagen_nombre_max,
    maxDescripcion: limites.imagen_descripcion_max,
    formatos: formatos.map(f => f.toUpperCase()),
    extensiones: formatos.flatMap(f => extensionesDeFormato(formatosImagen, f))
  };
}

// Mensaje de la primera imagen sin descripción cuando el parámetro la exige, o ''.
export function validarDescripciones(p, archivos) {
  if (!p.descripcion_requerida) return '';
  const sin = archivos.find(a => !String(a.descripcion || '').trim());
  return sin ? t('asesor.errores.descripcionFalta', { archivo: sin.file.name, etiqueta: p.etiqueta }) : '';
}

// Devuelve '' si el archivo se puede agregar, o el motivo explicado; `cantidad` = imágenes ya subidas.
export function validarArchivo(file, p, config, cantidad) {
  const r = reglasImagenes(p, config);
  const base = { archivo: file.name, etiqueta: p.etiqueta };
  if (cantidad >= r.max) return t('asesor.errores.archivoLimite', { ...base, max: r.max });
  const punto = file.name.lastIndexOf('.');
  const ext = punto >= 0 ? file.name.slice(punto + 1).toLowerCase() : '';
  const formatos = listaConO(r.formatos);
  if (!ext) return t('asesor.errores.archivoSinExtension', { ...base, formatos: listaConO(r.extensiones.map(e => e.toUpperCase())) });
  if (!r.extensiones.includes(ext)) return t('asesor.errores.archivoFormato', { ...base, extension: ext.toUpperCase(), formatos });
  if (file.size > r.maxMb * BYTES_POR_MB) {
    return t('asesor.errores.archivoPesado', { ...base, mb: (file.size / BYTES_POR_MB).toFixed(1), maxMb: r.maxMb });
  }
  if (file.name.length > r.maxNombre) return t('asesor.errores.archivoNombreLargo', { ...base, largo: file.name.length, max: r.maxNombre });
  return '';
}
