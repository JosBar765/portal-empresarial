// src/modules/incidencias/parametros.js
// Registro de parámetros del módulo: la pantalla «Parámetros» se dibuja desde aquí y todo valor se valida contra él.
// Un parámetro nuevo es una línea más. Los valores viven en `parametros_sistema` con el prefijo `incidencias.`; si falta
// la fila, manda `defecto`.
const parametroRepository = require('./repositories/parametroRepository');

const PREFIJO = 'incidencias.';

const PARAMETROS = [
  { clave: 'fotos_por_reporte', tipo: 'entero', defecto: 5, min: 1, max: 10, unidad: 'fotos',
    etiqueta: 'Fotos por reporte', ayuda: 'Máximo de fotos al reportar una incidencia.' },
  { clave: 'fotos_por_avance', tipo: 'entero', defecto: 3, min: 1, max: 5, unidad: 'fotos',
    etiqueta: 'Fotos por avance', ayuda: 'Máximo de fotos al publicar un avance o al enviar a verificación.' },
  { clave: 'reportes_por_usuario', tipo: 'entero', defecto: 30, min: 1, max: 200, unidad: 'por día',
    etiqueta: 'Reportes por usuario', ayuda: 'Máximo de incidencias que una persona puede reportar en 24 horas.' },
  { clave: 'ventana_duplicados_dias', tipo: 'entero', defecto: 14, min: 0, max: 90, unidad: 'días',
    etiqueta: 'Aviso de reportes repetidos', ayuda: 'Busca reportes parecidos de la misma tienda de los últimos días. 0 apaga el aviso.' },
  { clave: 'dias_sin_avance', tipo: 'entero', defecto: 7, min: 1, max: 60, unidad: 'días',
    etiqueta: 'Días sin avance', ayuda: 'Desde cuántos días se resalta una incidencia que no avanza.' },
  { clave: 'subir_nivel_reincidencia', tipo: 'booleano', defecto: true,
    etiqueta: 'Subir de prioridad si se repite', ayuda: 'Si en la misma tienda y zona hubo otra incidencia reciente, la prioridad sube un nivel.' }
];

function convertir(def, texto) {
  if (texto === undefined || texto === null) return def.defecto;
  if (def.tipo === 'booleano') return texto === '1' || texto === 'true';
  const n = Number(texto);
  return Number.isInteger(n) && n >= def.min && n <= def.max ? n : def.defecto;
}

// { fotos_por_reporte: 5, … } con lo guardado y, donde falte, el valor por defecto.
async function valores() {
  const filas = await parametroRepository.leerTodos();
  const guardados = new Map(filas.map(f => [f.clave.slice(PREFIJO.length), f.valor]));
  return Object.fromEntries(PARAMETROS.map(def => [def.clave, convertir(def, guardados.get(def.clave))]));
}

module.exports = { PREFIJO, PARAMETROS, convertir, valores };
