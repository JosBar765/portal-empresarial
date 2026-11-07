// src/modules/proyectos/duplicados.js
// Detección de posibles duplicados de empresas. Funciones puras: el servicio trae los candidatos de la base y aquí
// se decide cuáles se parecen. Solo advierte; nunca bloquea (la persona puede decir «es otra empresa»).

// Términos legales que no distinguen a una empresa de otra («Cooperativa Guayacán» = «Cooperativa Guayacán R.L.»).
const TERMINOS_LEGALES = new Set(['sa', 'srl', 'rl', 'ltda', 'cia', 'inc', 'llc', 'spa', 'sociedad', 'anonima', 'limitada']);

function sinAcentos(texto) {
  return String(texto == null ? '' : texto).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// minúsculas, sin acentos, sin puntuación y sin términos legales: «Banco G&T, S.A.» -> «banco g y t».
function normalizarNombre(nombre) {
  const base = sinAcentos(nombre).toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/\./g, '')                 // «S.A.» -> «sa», «R.L.» -> «rl»
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();
  return base.split(/\s+/).filter(t => t && !TERMINOS_LEGALES.has(t)).join(' ');
}

const normalizarCiudad = (ciudad) => normalizarNombre(ciudad);

function bigramas(texto) {
  const mapa = new Map();
  for (let i = 0; i < texto.length - 1; i++) {
    const par = texto.slice(i, i + 2);
    mapa.set(par, (mapa.get(par) || 0) + 1);
  }
  return mapa;
}

// Parecido de dos nombres ya normalizados, de 0 a 100 (coeficiente de Dice sobre pares de letras). Si todas las
// palabras del nombre más corto están en el otro (y son al menos dos), se considera al menos 90.
function similitud(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 100;
  const A = bigramas(a);
  const B = bigramas(b);
  let comunes = 0;
  for (const [par, n] of A) comunes += Math.min(n, B.get(par) || 0);
  const total = Math.max(a.length - 1, 0) + Math.max(b.length - 1, 0);
  let puntaje = total ? Math.round((2 * comunes * 100) / total) : 0;
  const ta = a.split(' ');
  const tb = b.split(' ');
  const [corto, largo] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (corto.length >= 2 && corto.every(t => largo.includes(t))) puntaje = Math.max(puntaje, 90);
  return puntaje;
}

// `nuevo`: { nombre, ciudad, telefono (canónico), paisId }.
// `candidatos`: filas de `proy_clientes` (nombre_normalizado, ciudad, telefono, pais_id…).
// `criterios`: { similitudMinima, porNombreCiudad, porTelefono } (ajustes `empresas.*`).
// Devuelve [{ cliente, razones: ['telefono' | 'nombre_ciudad'], similitud }], las más parecidas primero.
function coincidencias(nuevo, candidatos, { similitudMinima = 85, porNombreCiudad = true, porTelefono = true } = {}) {
  const nombre = normalizarNombre(nuevo.nombre);
  const ciudad = normalizarCiudad(nuevo.ciudad);
  const resultado = [];
  for (const c of candidatos) {
    const razones = [];
    let parecido = 0;
    if (porTelefono && nuevo.telefono && c.telefono && c.telefono === nuevo.telefono) razones.push('telefono');
    if (porNombreCiudad && Number(c.pais_id) === Number(nuevo.paisId)) {
      parecido = similitud(nombre, c.nombre_normalizado || normalizarNombre(c.nombre));
      const ciudadCandidato = normalizarCiudad(c.ciudad);
      // Si ambas ciudades existen y son distintas, son empresas distintas; si falta alguna, no se descarta.
      const mismaCiudad = !ciudad || !ciudadCandidato || ciudad === ciudadCandidato;
      if (parecido >= similitudMinima && mismaCiudad) razones.push('nombre_ciudad');
    }
    if (razones.length) resultado.push({ cliente: c, razones, similitud: parecido });
  }
  return resultado.sort((x, y) => (y.razones.includes('telefono') - x.razones.includes('telefono')) || (y.similitud - x.similitud));
}

module.exports = { normalizarNombre, normalizarCiudad, similitud, coincidencias, TERMINOS_LEGALES };
