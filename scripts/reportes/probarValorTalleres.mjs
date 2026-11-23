// Prueba del valor del selector de talleres del reporte de talleres (selector múltiple de /js/menuCascada.js).
// Cubre: valores guardados antes del cambio («pais:X»), listas nuevas («3,7,9»), ids que ya no existen, los parámetros que viajan al servidor
// y el árbol de talleres en modo múltiple. Sin BD ni servidor:  node scripts/reportes/probarValorTalleres.mjs
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const raiz = fileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const cargar = (ruta) => import(pathToFileURL(`${raiz}/${ruta}`).href);
// valorTalleres.js importa '/js/filtroCascada.js' (ruta absoluta del navegador): aquí se carga su copia pura para probar la misma lógica.
const { resolverTallerIds, paramsDeTaller, valorVigente } = await cargar('public/js/filtroCascada.js');
const fuente = readFileSync(`${raiz}/public/modules/vales/js/views/reportes2/valorTalleres.js`, 'utf8');
const normalizarValorTalleres = (valor, talleres = []) => {
  const conocidos = new Set(talleres.map(t => Number(t.id)));
  return resolverTallerIds(valor, talleres).filter(id => conocidos.has(id)).join(',');
};
// La copia de arriba debe ser idéntica a la del módulo: si éste cambia, esta prueba lo avisa.
assert.match(fuente, /resolverTallerIds\(valor, talleres\)\.filter\(id => conocidos\.has\(id\)\)\.join\(','\)/, 'valorTalleres.js cambió: actualizar esta prueba');

const talleres = [
  { id: 1, nombre: 'T1', paises: ['Guatemala'] },
  { id: 2, nombre: 'T2', paises: ['Guatemala'] },
  { id: 3, nombre: 'T3', paises: ['Honduras'] },
  { id: 4, nombre: 'T4', paises: ['Guatemala', 'Honduras'] },
  { id: 5, nombre: 'T5', paises: [] }
];
const ok = (cond, msg, extra = '') => { assert.ok(cond, msg); console.log('OK  ', msg, extra); };

// valores guardados antes del cambio
ok(normalizarValorTalleres('pais:Guatemala', talleres) === '1,2,4', '«pais:X» guardado pasa a la lista de sus talleres (con el de dos países)', normalizarValorTalleres('pais:Guatemala', talleres));
ok(normalizarValorTalleres('pais:Sin país', talleres) === '5', '«Sin país» guardado pasa a sus talleres');
ok(normalizarValorTalleres('pais:Nicaragua', talleres) === '', 'un país que ya no existe vuelve a «todos»');
// valores nuevos
ok(normalizarValorTalleres('1,3', talleres) === '1,3', 'una lista nueva se conserva');
ok(normalizarValorTalleres('2', talleres) === '2', 'un solo taller se conserva');
ok(normalizarValorTalleres('1,99,3', talleres) === '1,3', 'un id que ya no está en el catálogo se descarta');
ok(normalizarValorTalleres('99', talleres) === '', 'un solo taller inexistente vuelve a «todos» (antes daba error 400)');
ok(normalizarValorTalleres('99,98', talleres) === '', 'una lista de talleres inexistentes vuelve a «todos»');
ok(normalizarValorTalleres('', talleres) === '' && normalizarValorTalleres(null, talleres) === '', 'vacío = todos');
ok(normalizarValorTalleres('1,2', []) === '', 'sin catálogo no queda nada');
ok(normalizarValorTalleres('3,1,3', talleres) === '3,1', 'sin repetidos y respetando el orden de elección');
ok(normalizarValorTalleres(normalizarValorTalleres('pais:Guatemala', talleres), talleres) === '1,2,4', 'normalizar dos veces da lo mismo (idempotente)');

// resolverTallerIds con listas (sin romper lo anterior)
assert.deepEqual(resolverTallerIds('1,2', talleres), [1, 2]);
assert.deepEqual(resolverTallerIds('1,abc,2', talleres), [1, 2]);
assert.deepEqual(resolverTallerIds('7', talleres), [7]); // un id suelto sigue siendo un valor simple (no se valida contra el catálogo)
assert.deepEqual(resolverTallerIds('pais:Honduras', talleres), [3, 4]);
console.log('OK   resolverTallerIds: lista, descarta lo que no es id, id suelto y país siguen igual');

// parámetros que viajan al servidor (el servidor ya acepta tallerId y tallerIds)
assert.deepEqual(paramsDeTaller('', talleres), {});
assert.deepEqual(paramsDeTaller('2', talleres), { tallerId: 2 });
assert.deepEqual(paramsDeTaller('1,3', talleres), { tallerIds: '1,3' });
assert.deepEqual(paramsDeTaller(normalizarValorTalleres('pais:Guatemala', talleres), talleres), { tallerIds: '1,2,4' });
console.log('OK   parámetros: vacío = {}, uno = tallerId, varios o un país = tallerIds');

// valorVigente (lo usa el resto de los filtros) con una lista de talleres
ok(valorVigente('1,99,3', v => resolverTallerIds(v, talleres)) === '1,3', 'valorVigente poda una lista de talleres');

// el árbol de talleres que arma el componente en modo múltiple: sin filas «Todas — país» y con los ids como hojas
const { construirArbolTalleres } = await cargar('public/js/menuCascada.js');
const hojas = (nodos) => nodos.flatMap(n => (n.tipo === 'hoja' ? [n] : hojas(n.hijos || [])));
const multiple = hojas(construirArbolTalleres(talleres, { conTodas: false }));
ok(!multiple.some(h => String(h.valor).startsWith('pais:')), 'en modo múltiple el árbol no trae filas «Todas — país» (los padres llevan su casilla)');
ok([...new Set(multiple.map(h => String(h.valor)))].sort().join(',') === '1,2,3,4,5', 'todas las hojas del árbol son ids de taller (el de dos países aparece en ambos)');
const simple = hojas(construirArbolTalleres(talleres, { conTodas: true }));
ok(simple.some(h => String(h.valor).startsWith('pais:')), 'el modo simple conserva las filas «Todas — país»');
console.log('OK');
