// El Buzón recuerda solo los períodos futuros. Sin base de datos ni red.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// El módulo es del navegador (ESM) y no importa nada: se carga desde su texto.
const fuente = fs.readFileSync(path.join(__dirname, '..', '..', 'public/modules/vales/js/utils/periodoRecordado.js'), 'utf8');
const cargar = () => import(`data:text/javascript,${encodeURIComponent(fuente)}`);

const HOY = '2026-11-26'; // jueves
const periodo = (tipo, fecha = HOY, desde = '', hasta = '') => ({ tipo, fecha, desde, hasta });

async function abrir(guardado) {
  const { periodoAlAbrir } = await cargar();
  return periodoAlAbrir(guardado, HOY);
}

test('a future period is kept', async () => {
  for (const p of [periodo('mes', '2026-12-01'), periodo('mes', '2027-01-15'), periodo('dia', '2026-11-27'), periodo('semana', '2026-11-30')]) {
    assert.deepStrictEqual(await abrir(p), p);
  }
});

test('a past or current period follows today, keeping its type', async () => {
  assert.deepStrictEqual(await abrir(periodo('mes', '2026-10-05')), periodo('mes'));
  assert.deepStrictEqual(await abrir(periodo('mes', '2026-11-01')), periodo('mes'));
  assert.deepStrictEqual(await abrir(periodo('dia', '2026-11-20')), periodo('dia'));
  // Sunday of the current week is still the current week.
  assert.deepStrictEqual(await abrir(periodo('semana', '2026-11-29')), periodo('semana'));
  assert.deepStrictEqual(await abrir(periodo('semana', '2026-11-02')), periodo('semana'));
  assert.deepStrictEqual(await abrir(periodo('hoy', '2026-11-01')), periodo('hoy'));
});

test('a range is kept while it has not ended', async () => {
  const vigente = periodo('rango', HOY, '2026-11-01', HOY);
  assert.deepStrictEqual(await abrir(vigente), vigente);
  assert.deepStrictEqual(await abrir(periodo('rango', HOY, '2026-10-01', '2026-10-31')), periodo('mes'));
  assert.deepStrictEqual(await abrir(periodo('rango', HOY, '2026-12-01', '')), periodo('mes'));
});

test('nothing saved or broken data opens the current month', async () => {
  for (const roto of [null, undefined, 'x', {}, { tipo: 'anio', fecha: HOY, desde: '', hasta: '' }, periodo('mes', 'ayer')]) {
    assert.deepStrictEqual(await abrir(roto), periodo('mes'));
  }
});
