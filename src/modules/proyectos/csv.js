// src/modules/proyectos/csv.js
// Lector de CSV propio y puro (sin dependencias): quita el BOM, detecta el delimitador (coma, punto y coma o
// tabulador: Excel en español guarda con «;»), respeta comillas y saltos de línea dentro de comillas, y acota
// columnas y largo de celda. Nada se interpreta como fórmula: solo se leen textos.

const MAX_COLUMNAS = 30;
const MAX_LARGO_CELDA = 1000;

// UTF-8 con o sin BOM; si el archivo no es UTF-8 válido (Excel de Windows) se lee como Windows-1252.
function decodificar(buffer) {
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  const texto = utf8.includes('�') ? new TextDecoder('windows-1252').decode(buffer) : utf8;
  return texto.charCodeAt(0) === 0xFEFF ? texto.slice(1) : texto;
}

// El delimitador es el más frecuente en la primera línea (fuera de comillas).
function detectarDelimitador(texto) {
  const conteo = { ',': 0, ';': 0, '\t': 0 };
  let comillas = false;
  for (const c of texto) {
    if (c === '"') comillas = !comillas;
    else if (!comillas && (c === '\n' || c === '\r')) break;
    else if (!comillas && c in conteo) conteo[c] += 1;
  }
  return Object.entries(conteo).sort((a, b) => b[1] - a[1])[0][0];
}

// Devuelve { filas: string[][] } o { error } (columnas de más o comillas sin cerrar).
function leer(texto) {
  const delimitador = detectarDelimitador(texto);
  const filas = [];
  let fila = [];
  let celda = '';
  let comillas = false;
  let hayContenido = false;

  const cerrarCelda = () => { fila.push(celda); celda = ''; };
  const cerrarFila = () => {
    cerrarCelda();
    if (fila.some(c => c.trim() !== '')) filas.push(fila); // las líneas en blanco no cuentan
    fila = [];
    hayContenido = false;
  };

  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (comillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { celda += '"'; i += 1; } else comillas = false;
      } else celda += c;
    } else if (c === '"' && celda === '') {
      comillas = true;
      hayContenido = true;
    } else if (c === delimitador) {
      cerrarCelda();
      hayContenido = true;
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i += 1;
      cerrarFila();
    } else {
      celda += c;
      hayContenido = true;
    }
    if (celda.length > MAX_LARGO_CELDA) return { error: `Una celda tiene más de ${MAX_LARGO_CELDA} caracteres. Revisa el archivo.` };
    if (fila.length > MAX_COLUMNAS) return { error: `El archivo tiene más de ${MAX_COLUMNAS} columnas. Revisa que sea la plantilla.` };
  }
  if (comillas) return { error: 'Hay unas comillas sin cerrar. Revisa el archivo.' };
  if (hayContenido || celda !== '' || fila.length) cerrarFila();
  return { filas };
}

// Nombre de columna comparable: sin acentos, en minúsculas y con guiones bajos.
const clave = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Escapa una celda para escribir un CSV; las que parecen fórmula se neutralizan con un apóstrofo.
function escapar(valor) {
  let texto = String(valor == null ? '' : valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[",\n\r;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

module.exports = { decodificar, leer, clave, escapar, MAX_COLUMNAS, MAX_LARGO_CELDA };
