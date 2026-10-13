// src/modules/vales/services/propuestaAdjuntos.js
// Nota y enlaces que acompañan a una propuesta (entrega del Diseñador) o a la fusión de un vale de varios talleres.
// Una propuesta es válida con un archivo o con al menos un enlace; la nota sola no basta (es un comentario).
const MAX_NOTA = 500;
const MAX_ENLACES = 5;
const MAX_URL = 500;
const MAX_NOMBRE = 80;

// Quita caracteres de control (conserva saltos de línea en la nota) y recorta espacios.
const limpiar = (texto, { saltos = false } = {}) => String(texto ?? '')
  .replace(saltos ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '')
  .trim();

function normalizarNota(valor) {
  const nota = limpiar(valor, { saltos: true });
  if (!nota) return null;
  if (nota.length > MAX_NOTA) throw new Error(`La nota admite hasta ${MAX_NOTA} caracteres.`);
  return nota;
}

function normalizarEnlace(crudo, indice) {
  const numero = indice + 1;
  const entrada = typeof crudo === 'string' ? { url: crudo } : (crudo || {});
  const texto = limpiar(entrada.url);
  if (!texto) throw new Error(`El enlace ${numero} está vacío.`);
  if (texto.length > MAX_URL) throw new Error(`El enlace ${numero} es demasiado largo (máximo ${MAX_URL} caracteres).`);
  let url;
  try { url = new URL(texto); } catch { throw new Error(`El enlace ${numero} no es una dirección válida.`); }
  if (url.protocol !== 'https:') throw new Error(`El enlace ${numero} debe empezar con https://.`);
  if (url.username || url.password) throw new Error(`El enlace ${numero} no puede incluir usuario ni contraseña.`);
  if (!url.hostname.includes('.')) throw new Error(`El enlace ${numero} no es una dirección válida.`);
  const nombre = limpiar(entrada.nombre);
  if (nombre.length > MAX_NOMBRE) throw new Error(`El nombre del enlace ${numero} admite hasta ${MAX_NOMBRE} caracteres.`);
  return { url: url.href, nombre: nombre || null };
}

function normalizarEnlaces(valor) {
  let lista = valor;
  if (typeof valor === 'string') {
    if (!valor.trim()) return [];
    try { lista = JSON.parse(valor); } catch { throw new Error('Los enlaces no tienen un formato válido.'); }
  }
  if (lista == null) return [];
  if (!Array.isArray(lista)) throw new Error('Los enlaces no tienen un formato válido.');
  if (lista.length > MAX_ENLACES) throw new Error(`Puedes agregar hasta ${MAX_ENLACES} enlaces.`);
  const vistos = new Set();
  return lista.map(normalizarEnlace).filter(e => (vistos.has(e.url) ? false : vistos.add(e.url)));
}

// `cuerpo`: req.body del formulario (`nota` y `enlaces`, este último como JSON).
function leerAdjuntos(cuerpo = {}) {
  return { nota: normalizarNota(cuerpo.nota), enlaces: normalizarEnlaces(cuerpo.enlaces) };
}

// «archivo, 2 enlaces y nota» para el historial; vacío si no hay nada.
function describirAdjuntos({ archivo = false, enlaces = 0, nota = false }) {
  const partes = [];
  if (archivo) partes.push('archivo');
  if (enlaces) partes.push(`${enlaces} ${enlaces === 1 ? 'enlace' : 'enlaces'}`);
  if (nota) partes.push('nota');
  if (partes.length < 2) return partes[0] || '';
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

module.exports = { leerAdjuntos, describirAdjuntos, MAX_NOTA, MAX_ENLACES };
