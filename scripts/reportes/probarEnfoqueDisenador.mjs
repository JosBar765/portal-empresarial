// Prueba del enfoque del reporte de diseñadores: formato de porcentajes, `enfocarPayload` por modo, parámetros del PDF y CRUCE frontend/servidor.
// Solo módulos puros (sin base de datos ni servidor). Sale con error (código distinto de 0) si algo falla:  node scripts/reportes/probarEnfoqueDisenador.mjs
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const raiz = fileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const require = createRequire(raiz + '/package.json');
const imp = (r) => import(pathToFileURL(raiz + r).href);
const { formatearPorcentaje, conSimboloPorcentaje } = await imp('/public/modules/vales/js/utils/formatoPorcentaje.js');
const { enfocarPayload, ESTADO_DE_MODO } = await imp('/public/modules/vales/js/views/reportes2/enfoque.js');
const { paramsDesglosePdf } = await imp('/public/modules/vales/js/views/reportes2/paramsPdf.js');
const B = require(raiz + '/src/modules/vales/services/valeReporteFiltroDesglose.js');

let checks = 0;
const ok = (nombre, fn) => { fn(); checks++; console.log('OK  ', nombre); };

// (a) porcentajes
ok('formatearPorcentaje / conSimboloPorcentaje', () => {
  const casos = [[50, '50', '50 %'], [33.333, '33.33', '33.33 %'], [66.6666, '66.67', '66.67 %'], [0, '0', '0 %'], [100, '100', '100 %'], [12.5, '12.5', '12.5 %'], [null, '—', '—'], [undefined, '—', '—'], [NaN, '—', '—']];
  for (const [n, t, s] of casos) {
    assert.equal(formatearPorcentaje(n), t, `formatear ${n}`);
    assert.equal(conSimboloPorcentaje(n), s, `símbolo ${n}`);
  }
});

// (a2) cruce: el formato del servidor (PDF) y el del frontend dan lo mismo
ok('formatearPorcentaje frontend = servidor', () => {
  const S = require(raiz + '/src/modules/vales/services/valeReporteContadores.js');
  for (const x of [0, 100, 12.5, 33.333, 66.6666, 99.999, 0.004, -0.004, 1e-7, 50, '12.345', '', null, undefined, NaN, Infinity]) {
    assert.equal(S.formatearPorcentaje(x), formatearPorcentaje(x), `formatear ${String(x)}`);
    assert.equal(S.conSimboloPorcentaje(x), conSimboloPorcentaje(x), `símbolo ${String(x)}`);
  }
});

// (b) datos: diseñadores 1, 2 y 0 («Sin diseñador»); el vale 100 es compartido (aparece en el grupo 1 y en el 2).
const v = (id, extra) => ({ id, correlativo: `V-${id}`, urgente: false, autorizado: true, atrasado: false, ...extra });
const g = (id, nombre, vales, total = vales.length) => ({ id, nombre, total, vales });
const sec = (grupos) => ({ total: grupos.reduce((s, x) => s + x.total, 0), grupos });
const compartido = v(100, { urgente: true, diasTarde: 2 });
const data = {
  contadores: {
    ingresados: 9, efectividad: 55.56,
    porGrupo: {
      1: { todos: { ingresados: 5 }, urgentes: { ingresados: 2 }, entregados: { ingresados: 3 }, tarde: { ingresados: 1 } },
      2: { todos: { ingresados: 3 }, urgentes: { ingresados: 1 }, entregados: { ingresados: 1 }, tarde: { ingresados: 1 } },
      0: { todos: { ingresados: 1 }, urgentes: { ingresados: 0 }, entregados: { ingresados: 0 }, tarde: { ingresados: 0 } }
    }
  },
  grupos: {
    agruparPor: 'disenador',
    secciones: {
      noEntregados: sec([g(1, 'Ana', [v(1, { urgente: true })]), g(0, 'Sin diseñador', [v(9)])]),
      atrasados: sec([g(2, 'Beto', [v(3, { atrasado: true })])]),
      entregados: sec([g(1, 'Ana', [compartido, v(4, { diasTarde: 0 }), v(5, { diasTarde: 0, urgente: true })]), g(2, 'Beto', [compartido, v(6, { diasTarde: 0 })])])
    }
  },
  atrasadosVigentes: sec([g(1, 'Ana', [v(7, { atrasado: true })]), g(2, 'Beto', [v(8, { atrasado: true })])])
};
const copia = JSON.stringify(data);
const idsEn = (vista, clave) => (vista.grupos.secciones[clave]?.grupos || []).flatMap(x => x.vales.map(y => y.id));

ok('enfocarPayload: todos (id 1)', () => {
  const r = enfocarPayload(data, { id: 1, modo: 'todos' });
  assert.equal(r.contadores.ingresados, 5);
  assert.equal(r.contadores.efectividad, 55.56, 'conserva contadores del taller');
  assert.deepEqual(idsEn(r, 'entregados'), [100, 4, 5]);
  assert.deepEqual(idsEn(r, 'noEntregados'), [1]);
  assert.equal(r.grupos.secciones.entregados.total, 3);
  assert.equal(r.atrasadosVigentes.grupos.length, 1);
});
ok('enfocarPayload: urgentes (id 1)', () => {
  const r = enfocarPayload(data, { id: 1, modo: 'urgentes' });
  assert.equal(r.contadores.ingresados, 2);
  assert.deepEqual(idsEn(r, 'entregados'), [100, 5]);
  assert.deepEqual(idsEn(r, 'noEntregados'), [1]);
  assert.equal(r.atrasadosVigentes.total, 0);
  assert.deepEqual(enfocarPayload(data, { id: 1, urgentes: true }), r, 'estilo asesor igual a modo urgentes');
});
ok('enfocarPayload: entregados (id 1)', () => {
  const r = enfocarPayload(data, { id: 1, modo: 'entregados' });
  assert.equal(r.contadores.ingresados, 3);
  assert.deepEqual(idsEn(r, 'entregados'), [100, 4, 5]);
  assert.deepEqual(idsEn(r, 'noEntregados'), []);
  assert.equal(r.grupos.secciones.noEntregados.total, 0);
  assert.equal(r.atrasadosVigentes.total, 0);
});
ok('enfocarPayload: tarde (id 2, vale compartido)', () => {
  const r = enfocarPayload(data, { id: 2, modo: 'tarde' });
  assert.equal(r.contadores.ingresados, 1);
  assert.deepEqual(idsEn(r, 'entregados'), [100]);
  assert.equal(r.grupos.secciones.entregados.total, 1);
  assert.deepEqual(idsEn(r, 'atrasados'), []);
});
ok('enfocarPayload: id 0 válido y modo con grupo vacío', () => {
  const r = enfocarPayload(data, { id: 0, modo: 'todos' });
  assert.deepEqual(idsEn(r, 'noEntregados'), [9]);
  const t = enfocarPayload(data, { id: 0, modo: 'tarde' });
  assert.equal(t.grupos.secciones.entregados.total, 0);
});
ok('enfocarPayload: id desconocido devuelve el mismo objeto; no muta la entrada', () => {
  assert.equal(enfocarPayload(data, { id: 99, modo: 'tarde' }), data);
  assert.equal(enfocarPayload(data, { id: null }), data);
  assert.equal(JSON.stringify(data), copia);
});
ok('enfocarPayload: modo manda sobre urgentes', () => {
  assert.deepEqual(enfocarPayload(data, { id: 1, urgentes: true, modo: 'todos' }), enfocarPayload(data, { id: 1, modo: 'todos' }));
});

// (c) parámetros del PDF
ok('paramsDesglosePdf: modos del diseñador', () => {
  const p = (enfoque, contador) => paramsDesglosePdf({ modo: 'filtrado', enfoque, contador });
  const E = (modo) => ({ id: 2, parametro: 'disenadorDesglose', modo });
  assert.deepEqual(p(E('todos')), { disenadorDesglose: '2' });
  assert.deepEqual(p(E('entregados')), { disenadorDesglose: '2', disenadorModo: 'entregados' });
  assert.deepEqual(p(E('tarde')), { disenadorDesglose: '2', disenadorModo: 'tarde' });
  assert.deepEqual(p(E('tarde'), { estado: 'entregados', urgente: true }), { disenadorDesglose: '2', disenadorModo: 'tarde', desgloseEstado: 'entregados', desgloseUrgentes: '1' });
  assert.deepEqual(p({ id: 0, parametro: 'disenadorDesglose', modo: 'todos' }, { estado: null, urgente: false }), { disenadorDesglose: '0' });
  assert.deepEqual(p(null, { estado: 'sinEntregar' }), { desgloseEstado: 'sinEntregar' });
  for (const params of [p(E('todos')), p(E('tarde'), { estado: null, urgente: false })]) for (const val of Object.values(params)) assert.ok(val !== '' && val !== false && val != null);
  assert.deepEqual(p({ id: 5, parametro: 'asesorDesglose', urgentes: true }), { asesorDesglose: '5', soloUrgentes: '1' }, 'asesor ámbar igual');
  assert.deepEqual(p({ id: 5, parametro: 'asesorDesglose', urgentes: false }), { asesorDesglose: '5' });
  assert.deepEqual(paramsDesglosePdf({ modo: 'sin' }), { desglose: '0' });
  assert.deepEqual(paramsDesglosePdf({ modo: 'completo', enfoque: E('tarde') }), {});
});

// (d) cruce con el servidor
ok('ESTADO_DE_MODO frontend = servidor', () => assert.deepEqual(ESTADO_DE_MODO, B.ESTADO_DE_MODO));
ok('cruce enfocarPayload (modo) vs servidor (soloGrupoDesglose + filtrarDesglose), todos los grupos', () => {
  for (const id of [1, 2, 0]) {
    for (const modo of ['todos', 'entregados', 'tarde']) {
      const f = enfocarPayload(data, { id, modo });
      let s = B.soloGrupoDesglose(data, id);
      if (modo !== 'todos') s = B.filtrarDesglose(s, { estado: B.ESTADO_DE_MODO[modo] });
      assert.deepEqual(s.grupos.secciones, f.grupos.secciones, `secciones id ${id} ${modo}`);
      assert.deepEqual(s.atrasadosVigentes.grupos, f.atrasadosVigentes.grupos, `vigentes id ${id} ${modo}`);
      assert.equal(s.atrasadosVigentes.total, f.atrasadosVigentes.total, `vigentes total id ${id} ${modo}`);
    }
  }
});
assert.equal(JSON.stringify(data), copia, 'los datos de prueba no se mutan');
console.log(`\nTODO OK (${checks} bloques)`);
