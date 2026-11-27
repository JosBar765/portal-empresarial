// node --test scripts/vales/cancelarProceso.test.js (sin base de datos ni red).
// El diseñador cancela aunque ya haya entregado; sus propuestas se anulan antes de cambiar el estado.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src');
const sustituir = (relativo, exports) => {
  const id = require.resolve(path.join(SRC, relativo));
  require.cache[id] = { id, filename: id, loaded: true, exports };
};

let pasos = [];
let fallaAlAnular = false;
let estado = 'EN_PROCESO';
sustituir('config/env', { nodeEnv: 'test', push: { habilitado: false } });
sustituir('config/database', { query: async () => [], transaccion: async (fn) => fn({ query: async () => [] }) });
sustituir('modules/vales/repositories/valeRepository', { obtenerPorId: async () => ({ id: 5, correlativo: 'V-5', asesor_id: 7 }) });
sustituir('modules/vales/repositories/valeTallerRepository', {
  listarPorVale: async () => [{ id: 3, taller_id: 1, disenador_id: 9, estado }],
  actualizarEstado: async (id, nuevo) => { pasos.push(`estado:${nuevo}`); }
});
sustituir('modules/vales/repositories/propuestaRepository', {
  obtenerUltimaPorValeYDisenador: async () => ({ id: 1, url: 'x' }),
  anularDeDisenador: async (valeId, disenadorId) => {
    if (fallaAlAnular) throw new Error('sin base');
    pasos.push(`anular:${valeId}:${disenadorId}`);
  }
});
sustituir('modules/vales/events', { notificar() {}, refrescar() {} });
sustituir('core/files/subirYRegistrarArchivo', async () => {});
const helpers = require(path.join(SRC, 'modules/vales/services/valeHelpers'));
Object.assign(helpers, {
  requerirVale: async () => ({ id: 5 }), registrarHistorial: async () => {}, enriquecer: (v) => v, etiquetaActorTaller: () => 'Diseñador'
});

const servicio = require(path.join(SRC, 'modules/vales/services/valeTallerService'));
const disenador = { id: 9, nombre: 'D', rolId: 6, permissions: ['vales.trabajar'] };
const cancelar = () => servicio.cancelarProcesoDisenador(disenador, 5);
const reiniciar = () => { pasos = []; fallaAlAnular = false; estado = 'EN_PROCESO'; servicio._filaDelDisenador = async () => ({ id: 3, taller_id: 1, disenador_id: 9, estado }); };

test('cancels after an earlier delivery and voids it first', async () => {
  reiniciar();
  await cancelar();
  assert.deepStrictEqual(pasos, ['anular:5:9', 'estado:EN_REVISION']);
});

test('if voiding fails the process is not cancelled', async () => {
  reiniciar();
  fallaAlAnular = true;
  await assert.rejects(cancelar, /sin base/);
  assert.deepStrictEqual(pasos, []);
});

test('only a voucher in process can be cancelled', async () => {
  reiniciar();
  estado = 'EN_REVISION';
  await assert.rejects(cancelar, /en proceso/);
  assert.deepStrictEqual(pasos, []);
});
