#!/usr/bin/env node
// scripts/vales/verificar-asignacion-concurrente.js
// Comprueba que un vale en PENDIENTE_ASIGNACION nunca queda asignado a dos personas aunque varias intenten
// asignárselo (o asignarlo) en el mismo instante: el encargado a sí mismo, un asistente a sí mismo y el encargado
// a un diseñador.
//
// Escenarios: (1) un proceso con el mutex en memoria; (2) varios procesos simulados (mutex apagado), que es
// lo que ve la base cuando hay más de un proceso Node; (3) dos procesos Node reales con una barrera de tiempo
// común; (4) la regla condicional del repositorio.
//
// Uso (base DESECHABLE; crea vales de prueba y los borra al terminar):
//   node --require ./scripts/security/stub-storage.js scripts/vales/verificar-asignacion-concurrente.js
const path = require('path');
const { fork } = require('child_process');

const RAIZ = path.join(__dirname, '..', '..');
const PERMISOS_TALLER = ['vales.gestionar_taller'];
const ESPERA_BARRERA_MS = 1500;

const esperarHasta = (momento) => new Promise(r => setTimeout(r, Math.max(0, momento - Date.now())));
const esPerdedorValido = (r) => r.status === 409 || /ya tiene un diseñador|ya fue asignado|se está procesando/i.test(r.mensaje || '');

// --- Modo hijo: un proceso Node real que intenta asignar cuando llega la hora de la barrera ---
if (process.argv[2] === '--hijo') {
  (async () => {
    const [, , , valeId, actorJson, objetivoId, tallerId, barrera] = process.argv;
    const db = require(path.join(RAIZ, 'src', 'config', 'database'));
    await db.listo;
    const servicio = require(path.join(RAIZ, 'src', 'modules', 'vales', 'services', 'valeTallerService'));
    await esperarHasta(Number(barrera));
    try {
      await servicio.asignar(JSON.parse(actorJson), Number(valeId), Number(objetivoId), Number(tallerId));
      process.send({ ok: true });
    } catch (e) {
      process.send({ ok: false, status: e.status || null, mensaje: e.message });
    }
    process.exit(0);
  })().catch((e) => { process.send({ ok: false, mensaje: `ERROR ${e.message}` }); process.exit(1); });
  return;
}

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};

async function main() {
  const db = require(path.join(RAIZ, 'src', 'config', 'database'));
  await db.listo;
  const valeTallerService = require(path.join(RAIZ, 'src', 'modules', 'vales', 'services', 'valeTallerService'));
  const valeTallerRepository = require(path.join(RAIZ, 'src', 'modules', 'vales', 'repositories', 'valeTallerRepository'));
  const valeMutex = require(path.join(RAIZ, 'src', 'modules', 'vales', 'services', 'valeMutex'));

  // Personas del escenario: el encargado de un taller, un asistente (se vincula al taller solo para la prueba) y un diseñador.
  const [taller] = await db.query(
    `SELECT t.id, t.encargado_id FROM talleres t
     WHERE t.activo = 1 AND t.encargado_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM taller_disenadores td JOIN usuarios u ON u.id = td.usuario_id WHERE td.taller_id = t.id AND u.rol_id = 6)
     ORDER BY t.id LIMIT 1`, [], 'asig:taller'
  );
  const [encargado] = await db.query('SELECT id, nombre, rol_id FROM usuarios WHERE id = ?', [taller.encargado_id], 'asig:encargado');
  const [asistente] = await db.query('SELECT id, nombre, rol_id FROM usuarios WHERE rol_id = 7 AND activo = 1 ORDER BY id LIMIT 1', [], 'asig:asistente');
  const [disenador] = await db.query(
    'SELECT u.id, u.nombre, u.rol_id FROM usuarios u JOIN taller_disenadores td ON td.usuario_id = u.id WHERE td.taller_id = ? AND u.rol_id = 6 ORDER BY u.id LIMIT 1',
    [taller.id], 'asig:disenador'
  );
  const [asesor] = await db.query('SELECT usuario_id AS id, tienda_id FROM asesores ORDER BY usuario_id LIMIT 1', [], 'asig:asesor');
  const yaVinculado = (await db.query('SELECT 1 FROM taller_disenadores WHERE usuario_id = ?', [asistente.id], 'asig:vinculo')).length > 0;
  if (!yaVinculado) await db.query('INSERT INTO taller_disenadores (usuario_id, taller_id) VALUES (?, ?)', [asistente.id, taller.id], 'asig:vincular');

  const actor = (u) => ({ id: u.id, nombre: u.nombre, rolId: u.rol_id, permissions: PERMISOS_TALLER });
  const intentos = [
    { etiqueta: 'encargado se asigna a sí mismo', actor: actor(encargado), objetivo: encargado.id },
    { etiqueta: 'asistente se asigna a sí mismo', actor: actor(asistente), objetivo: asistente.id },
    { etiqueta: 'encargado asigna a un diseñador', actor: actor(encargado), objetivo: disenador.id }
  ];

  const valesCreados = [];
  let contador = 0;
  async function crearVale() {
    const res = await db.query(
      `INSERT INTO vales (correlativo, asesor_id, tienda_id, fecha_creacion, hora_creacion, fecha_entrega, fecha_evento,
         cliente_nombre, cliente_telefono, cliente_correo, producto, material, cantidad, cotizacion, estado_id)
       VALUES (?, ?, ?, CURDATE(), CURTIME(), DATE_ADD(NOW(), INTERVAL 10 DAY), DATE_ADD(NOW(), INTERVAL 12 DAY),
         'Cliente de prueba', '+502 12345678', 'prueba@example.com', 'Medalla', 'Metal', 10, 100,
         (SELECT id FROM estados_vale WHERE nombre = 'CREADO'))`,
      [`PRUEBA-ASIG-${Date.now()}-${++contador}`, asesor.id, asesor.tienda_id], 'asig:vale'
    );
    valesCreados.push(res.insertId);
    const fila = await db.query(
      "INSERT INTO vale_talleres (vale_id, taller_id, estado_id, activo) VALUES (?, ?, (SELECT id FROM estados_taller WHERE nombre = 'PENDIENTE_ASIGNACION'), 1)",
      [res.insertId, taller.id], 'asig:fila'
    );
    return { valeId: res.insertId, filaId: fila.insertId };
  }

  // Un solo ganador, quedó asignado a quien ganó, un solo registro de asignación y los demás recibieron un rechazo claro.
  async function evaluar(nombre, valeId, resultados) {
    const ganadores = resultados.map((r, i) => ({ ...r, i })).filter(r => r.ok);
    const [fila] = await db.query(
      'SELECT vt.disenador_id, et.nombre AS estado FROM vale_talleres vt JOIN estados_taller et ON et.id = vt.estado_id WHERE vt.vale_id = ?', [valeId], 'asig:fila_final'
    );
    const [{ n: asignaciones }] = await db.query("SELECT COUNT(*) AS n FROM vale_historial WHERE vale_id = ? AND accion LIKE 'Asignado al diseñador%'", [valeId], 'asig:historial');
    const perdedores = resultados.filter(r => !r.ok);
    const bien = ganadores.length === 1
      && fila.estado === 'ASIGNADO' && fila.disenador_id === intentos[ganadores[0].i].objetivo
      && Number(asignaciones) === 1 && perdedores.every(esPerdedorValido);
    prueba(nombre, bien,
      `ganadores=${ganadores.length}, asignaciones en el historial=${asignaciones}, disenador_id=${fila.disenador_id}, estado=${fila.estado}, perdedores=${JSON.stringify(perdedores.map(p => p.mensaje))}`);
  }

  async function intentarEnParalelo(valeId, quienes) {
    const resultados = await Promise.allSettled(
      quienes.map(q => valeTallerService.asignar(q.actor, valeId, q.objetivo, taller.id))
    );
    return resultados.map(r => (r.status === 'fulfilled' ? { ok: true } : { ok: false, status: r.reason.status || null, mensaje: r.reason.message }));
  }

  try {
    console.log('1. Un proceso, con el mutex en memoria');
    for (let ronda = 1; ronda <= 8; ronda++) {
      const { valeId } = await crearVale();
      await evaluar(`ronda ${ronda}: tres intentos a la vez`, valeId, await intentarEnParalelo(valeId, intentos));
    }

    console.log('2. Varios procesos simulados (mutex apagado: lo que ve la base con más de un proceso)');
    const bloqueoReal = valeMutex.conLockDeVale;
    valeMutex.conLockDeVale = (id, fn) => fn();
    try {
      for (let ronda = 1; ronda <= 8; ronda++) {
        const { valeId } = await crearVale();
        await evaluar(`ronda ${ronda}: tres intentos a la vez`, valeId, await intentarEnParalelo(valeId, intentos));
      }
    } finally {
      valeMutex.conLockDeVale = bloqueoReal;
    }

    console.log('3. Dos procesos Node reales con una barrera de tiempo común');
    for (let ronda = 1; ronda <= 4; ronda++) {
      const { valeId } = await crearVale();
      const barrera = Date.now() + ESPERA_BARRERA_MS;
      const quienes = [intentos[0], intentos[1]];
      const resultados = await Promise.all(quienes.map(q => new Promise((resolver) => {
        // Sin --require: el sustituto de Storage abre un puerto fijo y dos procesos no pueden compartirlo.
        const hijo = fork(__filename, ['--hijo', String(valeId), JSON.stringify(q.actor), String(q.objetivo), String(taller.id), String(barrera)], { execArgv: [] });
        hijo.once('message', resolver);
        hijo.once('exit', (codigo) => { if (codigo) resolver({ ok: false, mensaje: `el proceso hijo terminó con código ${codigo}` }); });
      })));
      await evaluar(`ronda ${ronda}: dos procesos a la vez`, valeId, resultados);
    }

    console.log('4. Regla condicional del repositorio');
    const { valeId: valeRegla, filaId } = await crearVale();
    const ahora = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const primero = await valeTallerRepository.asignar(filaId, encargado.id, ahora, ['PENDIENTE_ASIGNACION']);
    const segundo = await valeTallerRepository.asignar(filaId, disenador.id, ahora, ['PENDIENTE_ASIGNACION']);
    const [tras] = await db.query('SELECT disenador_id FROM vale_talleres WHERE id = ?', [filaId], 'asig:regla_fila');
    prueba('el primero que escribe gana (1 fila) y el segundo no cambia nada (0 filas)', primero === 1 && segundo === 0 && tras.disenador_id === encargado.id,
      `primero=${primero}, segundo=${segundo}, disenador_id=${tras.disenador_id}`);
    await db.query("UPDATE vale_talleres SET estado_id = (SELECT id FROM estados_taller WHERE nombre = 'EN_REVISION') WHERE id = ?", [filaId], 'asig:a_revision');
    const reasignado = await valeTallerRepository.asignar(filaId, disenador.id, ahora, ['EN_REVISION']);
    prueba('la reasignación tras desaprobar solo vale desde EN_REVISION', reasignado === 1, `afectadas=${reasignado}`);
    void valeRegla;
  } finally {
    // Limpieza, pase lo que pase: nada de esta prueba debe quedar en la base.
    if (valesCreados.length) {
      await db.query('DELETE FROM notificaciones WHERE vale_id IN (?)', [valesCreados], 'asig:limpiar_notificaciones');
      await db.query('DELETE FROM vales WHERE id IN (?)', [valesCreados], 'asig:limpiar_vales');
    }
    if (!yaVinculado) await db.query('DELETE FROM taller_disenadores WHERE usuario_id = ?', [asistente.id], 'asig:desvincular');
  }

  console.log(malas ? `\n${malas} verificación(es) fallaron (${buenas} correctas).` : `\nTodo correcto (${buenas} verificaciones).`);
  process.exit(malas ? 1 : 0);
}

main().catch((e) => { console.error('ERROR', e); process.exit(1); });
