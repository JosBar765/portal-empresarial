// Prueba del valor del selector de tiendas de los reportes (selector múltiple de /js/menuCascada.js).
// Cubre: valores guardados antes del cambio («pais:X», «grupo:Y»), listas nuevas («3,7,9»), ids que ya no existen, los parámetros que viajan al servidor
// y la lista de asesores acotada a las tiendas elegidas. Sin BD ni servidor:  node scripts/reportes/probarValorTiendas.mjs
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const raiz = fileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const cargar = (ruta) => import(pathToFileURL(`${raiz}/${ruta}`).href);
// valorTiendas.js importa '/js/filtroCascada.js' (ruta absoluta del navegador): aquí se carga su copia pura para probar la misma lógica.
const { resolverTiendaIds, paramsDeTienda } = await cargar('public/js/filtroCascada.js');
const { asesoresDeLaTienda } = await cargar('public/modules/vales/js/views/reportes2/asesoresDeTienda.js');
const fuente = (await import('node:fs')).readFileSync(`${raiz}/public/modules/vales/js/views/reportes2/valorTiendas.js`, 'utf8');
const normalizarValorTiendas = (valor, tiendas = []) => {
  const conocidos = new Set(tiendas.map(t => Number(t.id)));
  return resolverTiendaIds(valor, tiendas).filter(id => conocidos.has(id)).join(',');
};
// La copia de arriba debe ser idéntica a la del módulo: si éste cambia, esta prueba lo avisa.
assert.match(fuente, /resolverTiendaIds\(valor, tiendas\)\.filter\(id => conocidos\.has\(id\)\)\.join\(','\)/, 'valorTiendas.js cambió: actualizar esta prueba');

const tiendas = [
  { id: 1, nombre: 'A', pais_nombre: 'Guatemala', departamento_nombre: 'Premia' },
  { id: 2, nombre: 'B', pais_nombre: 'Guatemala', departamento_nombre: 'Ventas Trofex Ruta 1' },
  { id: 3, nombre: 'C', pais_nombre: 'Honduras', departamento_nombre: 'Premia' }
];
const ok = (cond, msg, extra = '') => { assert.ok(cond, msg); console.log('OK  ', msg, extra); };

// valores guardados antes del cambio
ok(normalizarValorTiendas('pais:Guatemala', tiendas) === '1,2', '«pais:X» guardado pasa a la lista de sus tiendas', normalizarValorTiendas('pais:Guatemala', tiendas));
ok(normalizarValorTiendas('grupo:Ventas Trofex Ruta 1', tiendas) === '2', '«grupo:Y» guardado pasa a la lista de sus tiendas');
ok(normalizarValorTiendas('pais:Nicaragua', tiendas) === '', 'un país que ya no existe vuelve a «todas»');
// valores nuevos
ok(normalizarValorTiendas('1,3', tiendas) === '1,3', 'una lista nueva se conserva');
ok(normalizarValorTiendas('2', tiendas) === '2', 'una sola tienda se conserva');
ok(normalizarValorTiendas('1,99,3', tiendas) === '1,3', 'un id que ya no está en el catálogo se descarta');
ok(normalizarValorTiendas('99', tiendas) === '', 'una sola tienda inexistente vuelve a «todas» (antes daba error 400)');
ok(normalizarValorTiendas('', tiendas) === '' && normalizarValorTiendas(null, tiendas) === '', 'vacío = todas');
ok(normalizarValorTiendas('1,2', []) === '', 'sin catálogo no queda nada');
ok(normalizarValorTiendas(normalizarValorTiendas('pais:Guatemala', tiendas), tiendas) === '1,2', 'normalizar dos veces da lo mismo (idempotente)');

// parámetros que viajan al servidor (el servidor ya acepta tiendaId y tiendaIds)
assert.deepEqual(paramsDeTienda('', tiendas), {});
assert.deepEqual(paramsDeTienda('2', tiendas), { tiendaId: 2 });
assert.deepEqual(paramsDeTienda('1,3', tiendas), { tiendaIds: '1,3' });
assert.deepEqual(paramsDeTienda(normalizarValorTiendas('pais:Guatemala', tiendas), tiendas), { tiendaIds: '1,2' });
console.log('OK   parámetros: vacío = {}, una = tiendaId, varias o un país = tiendaIds');

// asesores de las tiendas elegidas
const asesores = [{ id: 10, nombre: 'a', tiendaId: 1 }, { id: 11, nombre: 'b', tiendaId: 2 }, { id: 12, nombre: 'c', tiendaId: 3 }, { id: 13, nombre: 'yo' }];
const nombres = (valor) => asesoresDeLaTienda(asesores, resolverTiendaIds(valor, tiendas)).map(a => a.nombre).join(',');
ok(nombres('') === 'a,b,c,yo', 'asesores sin tienda: todos');
ok(nombres('1,3') === 'a,c,yo', 'asesores de varias tiendas elegidas', nombres('1,3'));
ok(nombres('2') === 'b,yo', 'asesores de una tienda');
console.log('OK');
