// node --test scripts/vales/avisoAtraso.test.js (sin base de datos ni red).
// El atraso cuenta desde las 00:00; el aviso sale a las 08:00, también de lo entregado en esas horas.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const VALES = path.join(__dirname, '..', '..', 'src', 'modules', 'vales');
const sustituir = (relativo, exports) => {
  const id = require.resolve(path.join(VALES, relativo));
  require.cache[id] = { id, filename: id, loaded: true, exports };
};
const ESTADOS_TALLER = {
  VERIFICANDO_ADJUNTOS: 'VERIFICANDO_ADJUNTOS', ADJUNTOS_RECHAZADOS: 'ADJUNTOS_RECHAZADOS', ADJUNTOS_RESPONDIDOS: 'ADJUNTOS_RESPONDIDOS',
  PENDIENTE_ASIGNACION: 'PENDIENTE_ASIGNACION', ASIGNADO: 'ASIGNADO', EN_PROCESO: 'EN_PROCESO', EN_PAUSA: 'EN_PAUSA', EN_REVISION: 'EN_REVISION', APROBADO: 'APROBADO'
};

let vales = [];
let filas = [];
let consultas = [];
let avisos = [];
let marcados = [];
sustituir('repositories/valeRepository', {
  listarAtrasadosSinNotificar: async (hoy) => { consultas.push(hoy); return vales; },
  marcarAtrasoNotificado: async (id, momento) => { marcados.push([id, momento]); }
});
sustituir('repositories/valeTallerRepository', { listarPorVale: async () => filas });
sustituir('repositories/usuarioValeRepository', { obtenerSupervisoresDeAsesor: async () => [{ id: 13 }] });
sustituir('events', { notificar: (a) => avisos.push(a) });
sustituir('services/valeService', { ESTADOS_TALLER });
sustituir('services/valeHelpers', { SALA_FUSION: 'vales:fusion' });

const { revisarAtrasos } = require(path.join(VALES, 'atrasoWatcher'));
// Hora local del portal (UTC-6) expresada como instante.
const local = (fechaHora) => new Date(`${fechaHora.replace(' ', 'T')}-06:00`);
const reiniciar = () => { consultas = []; avisos = []; marcados = []; filas = []; vales = []; };
const vale = (extra = {}) => ({ id: 5, asesor_id: 7, correlativo: 'V-5', estado: 'CREADO', fecha_entrega: '2026-11-23 23:59:59', atraso_congelado_en: null, ...extra });

test('antes de las 08:00 no consulta ni avisa', async () => {
  reiniciar();
  vales = [vale()];
  for (const hora of ['2026-11-24 00:00:30', '2026-11-24 07:59:59']) await revisarAtrasos(local(hora));
  assert.deepStrictEqual([consultas.length, avisos.length, marcados.length], [0, 0, 0]);
});

test('desde las 08:00 avisa lo pendiente con el texto de siempre', async () => {
  reiniciar();
  vales = [vale()];
  filas = [{ taller_id: 1, estado: 'EN_PROCESO', disenador_id: 99, atraso_congelado_en: null }];
  await revisarAtrasos(local('2026-11-24 08:00:00'));
  assert.deepStrictEqual(consultas, ['2026-11-24']);
  assert.strictEqual(avisos[0].accion, 'marcado como atrasado');
  assert.strictEqual(avisos[0].texto, undefined);
  assert.deepStrictEqual(avisos[0].salas, ['asesor:7', 'supervisor:13', 'taller:1', 'disenador:99']);
  assert.deepStrictEqual(marcados, [[5, '2026-11-24 08:00:00']]);
});

test('entregado antes de las 08:00: avisa, lo dice y alcanza a quien se atrasó', async () => {
  reiniciar();
  vales = [vale({ estado: 'PENDIENTE_CONFIRMACION', atraso_congelado_en: '2026-11-24 07:00:12' })];
  filas = [{ taller_id: 1, estado: 'APROBADO', disenador_id: 99, atraso_congelado_en: '2026-11-24 07:00:12' }];
  await revisarAtrasos(local('2026-11-24 08:00:00'));
  assert.strictEqual(avisos[0].texto, 'quedó atrasado; se entregó hoy a las 07:00');
  assert.strictEqual(avisos[0].tipo, 'ATRASO');
  assert.deepStrictEqual(avisos[0].salas, ['asesor:7', 'supervisor:13', 'taller:1', 'disenador:99']);
});

test('un taller que entregó a tiempo no recibe el aviso; uno que entregó tarde sí', async () => {
  reiniciar();
  vales = [vale()];
  filas = [
    { taller_id: 1, estado: 'APROBADO', disenador_id: 91, atraso_congelado_en: '2026-11-23 17:00:00' },
    { taller_id: 2, estado: 'APROBADO', disenador_id: 92, atraso_congelado_en: '2026-11-24 07:00:00' },
    { taller_id: 3, estado: 'EN_REVISION', disenador_id: 93, atraso_congelado_en: null }
  ];
  await revisarAtrasos(local('2026-11-24 08:00:00'));
  assert.deepStrictEqual(avisos[0].salas, ['asesor:7', 'supervisor:13', 'taller:2', 'disenador:92', 'taller:3', 'disenador:93']);
});
