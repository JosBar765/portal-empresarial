// Lógica pura (sin DOM) de la pantalla de ajustes: texto <-> valor y mensajes explicativos.
import { t } from '../../textos.js';

// Un ajuste de texto se edita tal cual; los demás son objetos y se editan como JSON.
export const esTextoPlano = (valor) => typeof valor === 'string';

export const textoDeValor = (valor) => (esTextoPlano(valor) ? valor : JSON.stringify(valor, null, 2));

// Ubica el fallo de sintaxis por línea y columna cuando el motor da la posición.
function detalleSintaxis(texto, error) {
  const m = /position (\d+)/.exec(error.message);
  if (!m) return t('admin.ajustes.detalleGenerico');
  const antes = texto.slice(0, Number(m[1]));
  return t('admin.ajustes.detalleSintaxis', { linea: antes.split('\n').length, columna: antes.length - antes.lastIndexOf('\n') });
}

// Devuelve { valor } listo para enviar o { error } con el motivo explicado.
export function leerAjuste(clave, texto, original) {
  if (esTextoPlano(original)) return { valor: texto };
  let valor;
  try {
    valor = JSON.parse(texto);
  } catch (e) {
    return { error: t('admin.errores.ajusteJsonInvalido', { clave, detalle: detalleSintaxis(texto, e) }) };
  }
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return { error: t('admin.errores.ajusteNoObjeto', { clave }) };
  return { valor };
}

// Mensaje del servidor más el detalle por campo, sin repetir.
export function mensajesDeAjuste(error) {
  const campos = error.campos && typeof error.campos === 'object' ? Object.values(error.campos).map(String) : [];
  return [...new Set([error.message, ...campos])];
}
