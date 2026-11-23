// Prueba de los diseñadores que se ofrecen según los talleres elegidos en el reporte de diseñadores. Sin BD ni servidor:
//   node scripts/reportes/probarDisenadoresDeTaller.mjs
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const raiz = fileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const { disenadoresDeLosTalleres } = await import(pathToFileURL(`${raiz}/public/modules/vales/js/views/reportes2/disenadoresDeTaller.js`).href);

const d = [
  { id: 1, nombre: 'A', tallerIds: [1] },
  { id: 2, nombre: 'B', tallerIds: [2] },
  { id: 3, nombre: 'C', tallerIds: [1, 3] },
  { id: 4, nombre: 'D', tallerIds: [] },
  { id: 5, nombre: 'E' }
];
const ids = (lista) => lista.map(x => x.id);

assert.deepEqual(ids(disenadoresDeLosTalleres(d, [])), [1, 2, 3, 4, 5], 'sin talleres elegidos no se filtra');
assert.equal(disenadoresDeLosTalleres(d), d, 'sin segundo argumento devuelve la misma lista');
assert.deepEqual(ids(disenadoresDeLosTalleres(d, [1])), [1, 3], 'un taller: sus diseñadores (incluido quien trabaja en dos)');
assert.deepEqual(ids(disenadoresDeLosTalleres(d, [1, 2])), [1, 2, 3], 'varios talleres: la unión, sin repetir');
assert.deepEqual(ids(disenadoresDeLosTalleres(d, ['3'])), [3], 'los ids como texto o número dan lo mismo');
assert.deepEqual(ids(disenadoresDeLosTalleres(d, [99])), [], 'un taller sin diseñadores no ofrece a nadie');
assert.deepEqual(disenadoresDeLosTalleres([], [1]), [], 'lista vacía');
assert.deepEqual(d.map(x => x.id), [1, 2, 3, 4, 5], 'no modifica la lista original');
console.log('OK   disenadoresDeLosTalleres: sin filtro, uno, varios, texto/número, taller sin gente, sin tallerIds');
