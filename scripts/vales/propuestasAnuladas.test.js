// node --test scripts/vales/propuestasAnuladas.test.js (sin base de datos ni red).
// Las propuestas anuladas no cuentan como vigentes; numeración, retención y archivos las siguen viendo.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src');
let consultas = [];
const query = async (sql, params, tag) => { consultas.push({ sql: sql.replace(/\s+/g, ' '), params, tag }); return []; };
const id = require.resolve(path.join(SRC, 'config/database'));
require.cache[id] = { id, filename: id, loaded: true, exports: { query, transaccion: async (fn) => fn({ query }) } };

const repo = require(path.join(SRC, 'modules/vales/repositories/propuestaRepository'));
const compartidas = require(path.join(SRC, 'modules/vales/repositories/propuestaCompartidaRepository'));

async function sqlDe(tarea) {
  consultas = [];
  await tarea();
  return consultas.map(c => c.sql);
}

test('every current-proposal read ignores void proposals', async () => {
  const lecturas = [
    () => repo.listarVigentesPorVale(1),
    () => repo.obtenerUltimaPorVale(1),
    () => repo.obtenerUltimaPorValeYDisenador(1, 2),
    () => repo.obtenerUltimasPorValesYDisenadores([1]),
    () => repo.listarUltimasPorVales([1]),
    () => compartidas.listarValesConPropuestaNueva(1, 2, null, [3])
  ];
  for (const leer of lecturas) {
    const [sql] = await sqlDe(leer);
    assert.match(sql, /anulada_en IS NULL/, sql);
  }
});

test('the extras lookup ignores notes and links of void proposals', async () => {
  const [, propuestas] = await sqlDe(() => repo.listarValesConExtra([1]));
  assert.strictEqual(propuestas.match(/anulada_en IS NULL/g).length, 2, propuestas);
});

test('file numbering still reads every proposal', async () => {
  const [sql] = await sqlDe(() => repo.listarPorVale(1));
  assert.doesNotMatch(sql, /anulada_en/);
});

test('voiding drops the single-workshop copy and then marks the proposals', async () => {
  const [copia, anular] = await sqlDe(() => repo.anularDeDisenador(5, 9));
  assert.match(copia, /UPDATE vales SET propuesta_general_url = NULL/);
  assert.match(anular, /UPDATE vale_propuestas SET anulada_en = NOW\(\)/);
  assert.deepStrictEqual(consultas[1].params, [5, 9]);
});
