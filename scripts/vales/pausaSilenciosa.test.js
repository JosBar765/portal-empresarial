// Pausar y reanudar no avisan a nadie ni se muestran en el historial. Sin base de datos ni red.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src');
const sustituir = (relativo, exports) => {
  const id = require.resolve(path.join(SRC, relativo));
  require.cache[id] = { id, filename: id, loaded: true, exports };
};
const cargado = (relativo) => require.cache[require.resolve(path.join(SRC, relativo))];
if (!cargado('config/env')) sustituir('config/env', { nodeEnv: 'test', push: { habilitado: false }, supabase: {} });
if (!cargado('core/files/supabaseStorage')) sustituir('core/files/supabaseStorage', {});
if (!cargado('config/database')) sustituir('config/database', { query: async () => [], transaccion: async (fn) => fn({ query: async () => [] }) });

const historialRepository = require(path.join(SRC, 'modules/vales/repositories/historialRepository'));
const valeRepository = require(path.join(SRC, 'modules/vales/repositories/valeRepository'));
const valeTallerRepository = require(path.join(SRC, 'modules/vales/repositories/valeTallerRepository'));
const valeEvents = require(path.join(SRC, 'modules/vales/events'));
const valeTallerService = require(path.join(SRC, 'modules/vales/services/valeTallerService'));
const valeDetalleService = require(path.join(SRC, 'modules/vales/services/valeDetalleService'));
const categorias = require(path.join(SRC, 'core/notifications/categorias'));
const { ROL } = require(path.join(SRC, 'modules/vales/services/valeHelpers'));

async function conDobles(dobles, tarea) {
  const originales = dobles.map(([objeto, metodo]) => objeto[metodo]);
  dobles.forEach(([objeto, metodo, falso]) => { objeto[metodo] = falso; });
  try { await tarea(); } finally { dobles.forEach(([objeto, metodo], i) => { objeto[metodo] = originales[i]; }); }
}

for (const [accion, estado] of [['pausarProceso', 'EN_PROCESO'], ['reanudarProceso', 'EN_PAUSA']]) {
  test(`${accion} refreshes screens without notifying`, async () => {
    const llamadas = { notificar: 0, refrescar: [], historial: 0 };
    await conDobles([
      [valeRepository, 'obtenerPorId', async () => ({ id: 7, correlativo: 'X-7', estado: 'CREADO', asesor_id: 3 })],
      [valeTallerRepository, 'listarActivasPorDisenador', async () => [{ id: 1, vale_id: 7, taller_id: 1, estado, disenador_id: 5 }]],
      [valeTallerRepository, 'actualizarEstado', async () => {}],
      [historialRepository, 'registrar', async () => { llamadas.historial++; }],
      [valeEvents, 'notificar', () => { llamadas.notificar++; }],
      [valeEvents, 'refrescar', (datos) => llamadas.refrescar.push(datos.salas)]
    ], () => valeTallerService[accion]({ id: 5, rolId: ROL.DISENADOR, nombre: 'D', permissions: [] }, 7)
      // Lo que sigue al aviso (armar la respuesta) no se simula.
      .catch((e) => { if (!llamadas.refrescar.length && !llamadas.notificar) throw e; }));
    assert.strictEqual(llamadas.notificar, 0);
    assert.strictEqual(llamadas.historial, 1);
    assert.deepStrictEqual(llamadas.refrescar, [['taller:1', 'disenador:5', 'vales:admin']]);
  });
}

test('the history hides pauses and resumes for every role, including the administrator', async () => {
  const fila = (estado_anterior, estado_nuevo) => ({ estado_anterior, estado_nuevo, taller_id: 1, usuario_id: 5, accion: 'x' });
  const historial = [fila('ASIGNADO', 'EN_PROCESO'), fila('EN_PROCESO', 'EN_PAUSA'), fila('EN_PAUSA', 'EN_PROCESO'), fila('EN_PROCESO', 'EN_REVISION')];
  const visible = await valeDetalleService._filtrarHistorialPorRol({ id: 1, rolId: ROL.ADMINISTRADOR }, historial);
  assert.deepStrictEqual(visible.map(h => h.estado_nuevo), ['EN_PROCESO', 'EN_REVISION']);
});

test('pause and resume are no longer notification types', () => {
  for (const tipo of ['PAUSADO', 'REANUDADO']) assert.ok(!categorias.SOLO_CAMPANA.vales.includes(tipo));
});
