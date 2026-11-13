// Reglas puras de la subpestaña «Archivos» (sin DOM): ajustes de adjuntos, detección de cambios, validación y payloads.
import { t } from '../../textos.js';

export const CLAVES_AJUSTE = Object.freeze({ TIPOS: 'tipos_archivo_permitidos', MAX_MB: 'max_archivo_mb' });

// Mismos valores que MIME_PERMITIDOS y AJUSTES.max_archivo_mb del servidor (constantes.js); `etiqueta` es la clave de su texto.
export const TIPOS_ARCHIVO = Object.freeze([
  { mime: 'image/jpeg', etiqueta: 'config.archivos.tipo.jpeg' },
  { mime: 'image/png', etiqueta: 'config.archivos.tipo.png' },
  { mime: 'image/webp', etiqueta: 'config.archivos.tipo.webp' },
  { mime: 'application/pdf', etiqueta: 'config.archivos.tipo.pdf' }
]);
export const MB_MIN = 1;
export const MB_MAX = 25;

// GET /config/ajustes -> { tipos: [mime], maxMb: 'texto' }; un ajuste ausente queda sin valor.
export function ajustesIniciales(lista) {
  const valorDe = (clave) => (Array.isArray(lista) ? lista.find(a => a.clave === clave) : null);
  const tipos = valorDe(CLAVES_AJUSTE.TIPOS);
  const mb = valorDe(CLAVES_AJUSTE.MAX_MB);
  return {
    tipos: tipos && Array.isArray(tipos.valor) ? [...tipos.valor] : [],
    maxMb: mb && mb.valor !== null && mb.valor !== undefined ? String(mb.valor) : ''
  };
}

const ordenados = (tipos) => TIPOS_ARCHIVO.map(x => x.mime).filter(m => tipos.includes(m));

// Claves de ajuste cuyo valor cambió (los tipos se comparan sin importar el orden).
export function ajustesCambiados(iniciales, actuales) {
  const cambiados = [];
  if (ordenados(iniciales.tipos).join() !== ordenados(actuales.tipos).join()) cambiados.push(CLAVES_AJUSTE.TIPOS);
  if (String(iniciales.maxMb).trim() !== String(actuales.maxMb).trim()) cambiados.push(CLAVES_AJUSTE.MAX_MB);
  return cambiados;
}

// Errores del cliente como { clave: mensaje }, con la clave del ajuste.
export function validarAjustes({ tipos, maxMb }) {
  const errores = {};
  if (!tipos.length || !tipos.every(m => TIPOS_ARCHIVO.some(x => x.mime === m))) errores[CLAVES_AJUSTE.TIPOS] = t('config.archivos.error.tipos');
  const texto = String(maxMb ?? '').trim();
  if (texto === '') errores[CLAVES_AJUSTE.MAX_MB] = t('config.archivos.error.mbFalta', { min: MB_MIN, max: MB_MAX });
  else if (!/^\d{1,3}$/.test(texto) || Number(texto) < MB_MIN || Number(texto) > MB_MAX) errores[CLAVES_AJUSTE.MAX_MB] = t('config.archivos.error.mbRango', { min: MB_MIN, max: MB_MAX });
  return errores;
}

// Valor que viaja en PUT /config/ajustes/:clave.
export function valorDeAjuste(clave, { tipos, maxMb }) {
  return clave === CLAVES_AJUSTE.TIPOS ? ordenados(tipos) : Number(String(maxMb).trim());
}
