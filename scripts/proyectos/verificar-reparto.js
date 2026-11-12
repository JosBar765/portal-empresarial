// scripts/proyectos/verificar-reparto.js
// Verifica el reparto equitativo y los proyectos (fase 3a): pruebas puras del cálculo (equidad con datos aleatorios,
// determinismo, afinidad, tope y reserva) y, por HTTP, las rutas reales: crear el borrador, vista previa igual al resultado,
// activar, tienda ocupada, empresa en otro proyecto, descanso, dos activaciones a la vez (un solo ganador), idempotencia,
// cancelar y alcance del supervisor.
//
// Uso (base DESECHABLE con las migraciones aplicadas; crea datos de prueba y los borra al terminar):
//   node scripts/proyectos/verificar-reparto.js
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/proyectos/routes');
const reparto = require('../../src/modules/proyectos/repartoService');
const { sumarDiasHabiles } = require('../../src/modules/proyectos/services/proyectoService');

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};

const PERM_ASESOR = ['proyectos.ver', 'proyectos.clientes.registrar'];
const PERM_SUPERVISOR = ['proyectos.ver', 'proyectos.activar'];
const PERM_ADMIN = ['proyectos.ver', 'proyectos.administrar', 'proyectos.activar'];

// Generador pseudoaleatorio con semilla: las pruebas aleatorias se pueden repetir igual.
function aleatorio(semilla) {
  let s = semilla;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

function verificarPuras() {
  console.log('Reparto (puro)');
  const asesores = [
    { id: 1, paisId: 1, tiendaId: 10 }, { id: 2, paisId: 1, tiendaId: 10 }, { id: 3, paisId: 1, tiendaId: 11 }, { id: 4, paisId: 2, tiendaId: 20 }, { id: 5, paisId: 2, tiendaId: 20 }
  ];
  const empresas = Array.from({ length: 23 }, (_, i) => ({ id: i + 1, paisId: i % 3 === 0 ? 2 : 1, tiendaOrigenId: i % 2 ? 11 : 10 }));
  let r = reparto.calcular({ empresas, asesores, afinidad: true });
  prueba('cada empresa queda en una sola lista (asignada, reserva o sin asesor)', r.asignaciones.length + r.reserva.length + r.sinAsesor.length === empresas.length && new Set(r.asignaciones.map(a => a.clienteId)).size === r.asignaciones.length);
  prueba('la diferencia entre asesores del mismo país nunca pasa de una empresa', reparto.diferenciaMaxima(asesores, r.porAsesor) <= 1, JSON.stringify([...r.porAsesor]));
  prueba('cada asesor solo recibe empresas de su país', r.asignaciones.every(a => empresas.find(e => e.id === a.clienteId).paisId === asesores.find(x => x.id === a.asesorId).paisId));
  prueba('el resultado es determinista (dos cálculos iguales)', JSON.stringify(reparto.calcular({ empresas, asesores, afinidad: true })) === JSON.stringify(r) && JSON.stringify(reparto.calcular({ empresas: [...empresas].reverse(), asesores: [...asesores].reverse(), afinidad: true }).asignaciones) === JSON.stringify(r.asignaciones));
  r = reparto.calcular({ empresas: [{ id: 1, paisId: 1, tiendaOrigenId: 11 }], asesores, afinidad: true });
  prueba('si todos empatan, la afinidad prefiere al asesor de la tienda que registró la empresa', r.asignaciones[0].asesorId === 3);
  r = reparto.calcular({ empresas: [{ id: 1, paisId: 1, tiendaOrigenId: 11 }], asesores, afinidad: false });
  prueba('con la afinidad apagada gana el de menor identificador', r.asignaciones[0].asesorId === 1);
  const dosEmpresasMismaTienda = reparto.calcular({ empresas: [{ id: 1, paisId: 1, tiendaOrigenId: 11 }, { id: 2, paisId: 1, tiendaOrigenId: 11 }], asesores: asesores.filter(a => a.paisId === 1), afinidad: true });
  prueba('la afinidad nunca rompe la equidad: la segunda empresa de la misma tienda va a otro asesor', new Set(dosEmpresasMismaTienda.asignaciones.map(a => a.asesorId)).size === 2);
  r = reparto.calcular({ empresas: [{ id: 1, paisId: 9, tiendaOrigenId: null }, { id: 2, paisId: 1, tiendaOrigenId: null }], asesores, afinidad: true });
  prueba('un país sin asesores deja sus empresas «sin asesor»', r.sinAsesor.join() === '1' && r.asignaciones.length === 1);
  r = reparto.calcular({ empresas: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, paisId: 1, tiendaOrigenId: null })), asesores: asesores.filter(a => a.paisId === 1), tope: 2, afinidad: true });
  prueba('con tope, nadie pasa del tope y lo que sobra queda en reserva', r.asignaciones.length === 6 && r.reserva.length === 4 && [...r.porAsesor.values()].every(n => n <= 2));
  r = reparto.calcular({ empresas: Array.from({ length: 4 }, (_, i) => ({ id: i + 1, paisId: 1, tiendaOrigenId: null })), asesores: asesores.filter(a => a.paisId === 1), tope: 2, afinidad: true, cargaInicial: new Map([[1, 2], [2, 2]]) });
  prueba('en una segunda ronda cuenta lo que cada asesor ya tiene', r.asignaciones.length === 2 && r.asignaciones.every(a => a.asesorId === 3) && r.reserva.length === 2);
  prueba('sin empresas o sin asesores no falla', reparto.calcular({ empresas: [], asesores, afinidad: true }).asignaciones.length === 0 && reparto.calcular({ empresas, asesores: [], afinidad: true }).sinAsesor.length === empresas.length);

  const azar = aleatorio(20261109);
  let fallos = 0;
  for (let vuelta = 0; vuelta < 300; vuelta += 1) {
    const paises = 1 + Math.floor(azar() * 3);
    const ases = Array.from({ length: 1 + Math.floor(azar() * 9) }, (_, i) => ({ id: i + 1, paisId: 1 + Math.floor(azar() * paises), tiendaId: 100 + Math.floor(azar() * 4) }));
    const emp = Array.from({ length: Math.floor(azar() * 80) }, (_, i) => ({ id: i + 1, paisId: 1 + Math.floor(azar() * paises), tiendaOrigenId: azar() < 0.7 ? 100 + Math.floor(azar() * 4) : null }));
    const tope = azar() < 0.4 ? 1 + Math.floor(azar() * 8) : null;
    const res = reparto.calcular({ empresas: emp, asesores: ases, tope, afinidad: azar() < 0.5 });
    const completo = res.asignaciones.length + res.reserva.length + res.sinAsesor.length === emp.length;
    const parejo = reparto.diferenciaMaxima(ases, res.porAsesor) <= 1;
    const bajoTope = tope === null || [...res.porAsesor.values()].every(n => n <= tope);
    if (!completo || !parejo || !bajoTope) fallos += 1;
  }
  prueba('300 repartos al azar (países, asesores, topes y afinidad): todos completos, parejos (≤ 1) y bajo el tope', fallos === 0, `${fallos} fallaron`);
  prueba('sumar días hábiles se salta los fines de semana', sumarDiasHabiles('2026-10-30', 3) === '2026-11-04' && sumarDiasHabiles('2026-11-06', 1) === '2026-11-09' && sumarDiasHabiles('2026-11-06', 0) === '2026-11-06');
}

async function levantar() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: Number(req.headers['x-usuario']), permissions: (req.headers['x-permisos'] || '').split(',').filter(Boolean) };
    next();
  });
  app.use('/api/proyectos', requirePermission('proyectos.ver'), rutas);
  return new Promise(resolver => { const s = app.listen(0, '127.0.0.1', () => resolver(s)); });
}

async function verificarServicio() {
  const configService = require('../../src/modules/proyectos/services/configService');
  const inicio = (await db.query('SELECT NOW() - INTERVAL 2 SECOND AS t', [], 'rep:inicio'))[0].t;
  const ajustesAntes = await db.query('SELECT clave, valor FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'rep:ajustes_antes');
  const nicho = async (n) => (await db.query('SELECT id FROM proy_nichos WHERE nombre = ?', [n], 'rep:nicho'))[0].id;
  const nichoBancos = await nicho('Bancos y cooperativas');
  const nichoHospitales = await nicho('Hospitales');
  const [{ id: estructuraId }] = await db.query('SELECT id FROM proy_estructuras ORDER BY id LIMIT 1', [], 'rep:estructura');
  const [{ id: paisGT }] = await db.query("SELECT id FROM paises WHERE codigo = 'GT'", [], 'rep:pais');
  const [{ id: admin }] = await db.query('SELECT id FROM usuarios WHERE rol_id = 1 ORDER BY id LIMIT 1', [], 'rep:admin');
  // Datos del seed: el supervisor 13 cubre las tiendas 1 y 2 de Guatemala (6 y 5 asesores); el 15, la tienda 3.
  const SUP = 13;
  const SUP_OTRO = 15;
  const [T1, T2, T3] = [1, 2, 3];
  const asesorDe = async (tiendaId, saltar) => (await db.query('SELECT usuario_id AS id FROM asesores WHERE tienda_id = ? ORDER BY usuario_id LIMIT 1 OFFSET ?', [tiendaId, saltar], 'rep:asesor'))[0].id;

  const servidor = await levantar();
  const base = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;
  const llamar = async (metodo, ruta, { usuario = SUP, permisos = PERM_SUPERVISOR, cuerpo } = {}) => {
    const res = await fetch(base + ruta, { method: metodo, headers: { 'content-type': 'application/json', 'x-usuario': String(usuario), 'x-permisos': permisos.join(',') }, body: cuerpo === undefined || metodo === 'GET' ? undefined : JSON.stringify(cuerpo) });
    return { status: res.status, datos: await res.json().catch(() => null) };
  };
  const clave = () => `rep-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const cuantas = async (patron) => Number((await db.query('SELECT COUNT(*) AS n FROM proy_clientes WHERE nombre LIKE ?', [patron], 'rep:cuantas'))[0].n);
  const crearEmpresas = async (prefijo, n, { nichoId = nichoBancos, estado = 'activa', tiendaOrigenId = null } = {}) => {
    const filas = Array.from({ length: n }, (_, i) => [`${prefijo} ${String(i).padStart(2, '0')}`, `${prefijo.toLowerCase()} ${i}`, nichoId, paisGT, estructuraId, estado, tiendaOrigenId, admin]);
    await db.query('INSERT INTO proy_clientes (nombre, nombre_normalizado, nicho_id, pais_id, estructura_id, estado, tienda_origen_id, creado_por) VALUES ?', [filas], 'rep:empresas');
  };
  const borrador = (extra = {}) => ({ nichoId: nichoBancos, anio: 2026, mes: 11, tiendaIds: [T1], fechaInicio: '2026-11-02', fechaFin: '2026-11-27', ...extra });

  try {
    console.log('Permisos y opciones');
    prueba('un asesor no puede crear proyectos (403)', (await llamar('POST', '/proyectos', { usuario: 49, permisos: PERM_ASESOR, cuerpo: borrador() })).status === 403);
    prueba('ni ver las opciones (403)', (await llamar('GET', '/proyectos/opciones', { usuario: 49, permisos: PERM_ASESOR })).status === 403);
    let r = await llamar('GET', '/proyectos/opciones');
    prueba('el supervisor solo ve las tiendas que supervisa', r.status === 200 && r.datos.tiendas.map(t => t.id).sort().join() === `${T1},${T2}` && r.datos.todasLasTiendas === false, JSON.stringify(r.datos.tiendas && r.datos.tiendas.map(t => t.id)));
    r = await llamar('GET', '/proyectos/opciones', { usuario: admin, permisos: PERM_ADMIN });
    prueba('el administrador ve todas las tiendas', r.datos.tiendas.length > 10 && r.datos.todasLasTiendas === true && r.datos.nichos.length >= 17);
    r = await llamar('POST', '/proyectos/candidatos', { cuerpo: { tiendaIds: [T1, T2] } });
    prueba('los candidatos son los asesores de las tiendas elegidas (no los supervisores por defecto)', r.status === 200 && r.datos.candidatos.length === 11 && r.datos.candidatos.every(c => c.tipo === 'asesor'), JSON.stringify(r.datos.candidatos && r.datos.candidatos.length));
    prueba('pedir candidatos de una tienda que no supervisa → 400', (await llamar('POST', '/proyectos/candidatos', { cuerpo: { tiendaIds: [T3] } })).status === 400);

    console.log('Borrador');
    r = await llamar('POST', '/proyectos', { cuerpo: { anio: 2026, mes: 13, tiendaIds: [T3] } });
    prueba('datos inválidos → 400 con cada campo marcado', r.status === 400 && r.datos.campos.nichoId && r.datos.campos.mes && r.datos.campos.tiendaIds, JSON.stringify(r.datos));
    r = await llamar('POST', '/proyectos', { cuerpo: borrador({ tiendaIds: [T3] }) });
    prueba('una tienda que no supervisa no se puede incluir', r.status === 400 && /supervisas/.test(r.datos.campos.tiendaIds), JSON.stringify(r.datos));
    r = await llamar('POST', '/proyectos', { cuerpo: borrador({ fechaInicio: '2026-11-20', fechaFin: '2026-11-02' }) });
    prueba('una fecha de fin anterior a la de inicio → 400', r.status === 400 && !!r.datos.campos.fechaFin);
    for (const [campo, valor] of [['fechaInicio', '2026-02-31'], ['fechaFin', '2027-02-29']]) {
      r = await llamar('POST', '/proyectos', { cuerpo: borrador({ [campo]: valor }) });
      prueba(`una fecha que no existe en el calendario (${valor}) → 400, no 500`, r.status === 400 && !!r.datos.campos[campo], JSON.stringify(r.datos));
    }
    r = await llamar('POST', '/proyectos', { cuerpo: borrador({ metaMonto: 5000 }) });
    prueba('una meta sin moneda → 400', r.status === 400 && !!r.datos.campos.metaMoneda);
    r = await llamar('POST', '/proyectos', { cuerpo: borrador() });
    const p1 = r.datos;
    prueba('crea el borrador con su código, nombre, tienda y todos los asesores como participantes',
      r.status === 201 && p1.estado === 'borrador' && /^PRY-2026-11-BAN/.test(p1.codigo) && /Bancos/.test(p1.nombre) && p1.tiendas.length === 1 && p1.participantes.length === 6 && p1.participantes.every(x => x.estado === 'activo'), JSON.stringify(r.datos));
    r = await llamar('GET', `/proyectos/${p1.id}`, {});
    prueba('antes de activar, la ficha del borrador ya trae el nombre de su plantilla (no solo el id)', r.status === 200 && (r.datos.plantillaId === null || (typeof r.datos.plantillaNombre === 'string' && r.datos.plantillaNombre.length > 0)), JSON.stringify({ id: r.datos.plantillaId, nombre: r.datos.plantillaNombre }));
    r = await llamar('POST', '/proyectos', { cuerpo: borrador({ tiendaIds: [T2] }) });
    prueba('un segundo proyecto del mismo nicho y mes recibe otro código', r.status === 201 && r.datos.codigo !== p1.codigo, JSON.stringify(r.datos));
    const p2Id = r.datos.id;
    const ajeno = await asesorDe(T1, 0);
    r = await llamar('PUT', `/proyectos/${p1.id}`, { cuerpo: { excluidos: [{ usuarioId: ajeno, motivo: 'De vacaciones' }], metaMonto: 8000, metaMoneda: 'GTQ' } });
    prueba('editar: excluir a un asesor con motivo y fijar la meta', r.status === 200 && r.datos.participantes.find(x => x.usuarioId === ajeno).estado === 'excluido' && r.datos.participantes.find(x => x.usuarioId === ajeno).motivo === 'De vacaciones' && r.datos.metaMonto === 8000 && r.datos.metaMoneda === 'GTQ', JSON.stringify(r.datos));
    r = await llamar('PUT', `/proyectos/${p1.id}`, { cuerpo: { mes: 12 } });
    prueba('cambiar el mes regenera el código', r.status === 200 && r.datos.codigo !== p1.codigo && /-12-/.test(r.datos.codigo), r.datos && r.datos.codigo);
    await llamar('PUT', `/proyectos/${p1.id}`, { cuerpo: { mes: 11 } });
    r = await llamar('PUT', `/proyectos/${p1.id}`, { cuerpo: { excluidos: [{ usuarioId: ajeno, motivo: 'De vacaciones' }] } });
    prueba('los excluidos se conservan al volver a guardar', r.datos.participantes.filter(x => x.estado === 'excluido').length === 1);
    r = await llamar('GET', `/proyectos/${p1.id}`, { usuario: SUP_OTRO });
    prueba('un supervisor de otras tiendas no ve el proyecto (404)', r.status === 404);
    r = await llamar('GET', `/proyectos/${p1.id}`, { usuario: admin, permisos: PERM_ADMIN });
    prueba('el administrador sí lo ve', r.status === 200);
    r = await llamar('GET', '/proyectos?estado=borradores');
    prueba('la lista de borradores trae los dos y los conteos por pestaña', r.status === 200 && r.datos.items.length === 2 && r.datos.conteos.borradores === 2 && r.datos.conteos.todos === 2, JSON.stringify(r.datos.conteos));
    prueba('el otro supervisor no ve esos borradores en su lista', (await llamar('GET', '/proyectos', { usuario: SUP_OTRO })).datos.items.length === 0);

    console.log('Vista previa y activación');
    await crearEmpresas('REP Banco', 25);
    await crearEmpresas('REP NoContactar', 3, { estado: 'no_contactar' });
    await crearEmpresas('REP Inactiva', 2, { estado: 'inactiva' });
    await crearEmpresas('REP Hospital', 8, { nichoId: nichoHospitales });
    r = await llamar('POST', `/proyectos/${p1.id}/vista-previa`);
    const previa = r.datos;
    prueba('la vista previa cuenta solo empresas activas del nicho (sin «no contactar» ni inactivas)', r.status === 200 && previa.totalEmpresas === 25 && previa.asignadas === 25 && previa.reserva === 0 && previa.sinAsesor === 0, JSON.stringify(previa));
    prueba('reparte entre los 5 asesores que participan (uno excluido), con diferencia máxima de una empresa', previa.porAsesor.filter(a => a.empresas > 0).length === 5 && previa.porAsesor.every(a => a.empresas === 5) && previa.diferenciaMaxima === 0 && previa.excluidos.length === 1 && previa.excluidos[0].motivo === 'De vacaciones', JSON.stringify(previa.porAsesor.map(a => a.empresas)));
    r = await llamar('POST', `/proyectos/${p1.id}/activar`, { cuerpo: {} });
    prueba('activar sin clave de operación → 400', r.status === 400);
    const claveUno = clave();
    await llamar('PUT', `/proyectos/${p1.id}`, { cuerpo: { fechaInicio: null, fechaFin: null } });
    r = await llamar('POST', `/proyectos/${p1.id}/activar`, { cuerpo: { idempotencyKey: claveUno } });
    prueba('sin fechas no se activa (400, con los campos marcados)', r.status === 400 && r.datos.campos.fechaInicio && r.datos.campos.fechaFin, JSON.stringify(r.datos));
    await llamar('PUT', `/proyectos/${p1.id}`, { cuerpo: { fechaInicio: '2026-11-02', fechaFin: '2026-11-27' } });
    r = await llamar('POST', `/proyectos/${p1.id}/activar`, { usuario: SUP_OTRO, cuerpo: { idempotencyKey: clave() } });
    prueba('un supervisor ajeno no puede activarlo (404)', r.status === 404);
    r = await llamar('POST', `/proyectos/${p1.id}/activar`, { cuerpo: { idempotencyKey: claveUno } });
    const activo = r.datos;
    prueba('activar deja el proyecto activo y repartido', r.status === 200 && activo.estado === 'activo' && activo.empresas === 25 && activo.repetida === false, JSON.stringify(r.datos && { e: r.datos.estado, n: r.datos.empresas }));
    prueba('lo repartido es lo que mostró la vista previa (mismas empresas por asesor)',
      previa.porAsesor.every(a => (activo.reparto.find(x => x.asesorId === a.usuarioId) || { empresas: 0 }).empresas === a.empresas), JSON.stringify(activo.reparto));
    const filas = await db.query('SELECT COUNT(*) AS n, SUM(abierta) AS abiertas, SUM(asesor_id IS NULL) AS sin FROM proy_participaciones WHERE proyecto_id = ?', [p1.id], 'rep:filas');
    prueba('quedan 25 participaciones abiertas, todas con asesor y estado «pendiente»', Number(filas[0].n) === 25 && Number(filas[0].abiertas) === 25 && Number(filas[0].sin) === 0 && Number((await db.query("SELECT COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND estado = 'pendiente'", [p1.id], 'rep:pend'))[0].n) === 25);
    const tiendaAbierta = await db.query('SELECT proyecto_abierto FROM proy_proyecto_tiendas WHERE proyecto_id = ?', [p1.id], 'rep:tienda_abierta');
    prueba('la tienda queda ocupada por el proyecto', tiendaAbierta.every(t => t.proyecto_abierto === 1));
    r = await llamar('POST', `/proyectos/${p1.id}/activar`, { cuerpo: { idempotencyKey: claveUno } });
    prueba('repetir la misma clave devuelve el mismo proyecto sin repartir otra vez', r.status === 200 && r.datos.repetida === true && Number((await db.query('SELECT COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ?', [p1.id], 'rep:n2'))[0].n) === 25);
    r = await llamar('POST', `/proyectos/${p1.id}/activar`, { cuerpo: { idempotencyKey: clave() } });
    prueba('con otra clave, un proyecto ya activo responde 409', r.status === 409 && /ya no está en borrador/.test(r.datos.error), JSON.stringify(r.datos));
    r = await llamar('POST', `/proyectos/${p1.id}/vista-previa`);
    prueba('la vista previa de un proyecto ya repartido responde 409', r.status === 409);
    r = await llamar('PUT', `/proyectos/${p1.id}`, { cuerpo: { metaMonto: 1 } });
    prueba('un proyecto activo ya no se edita (409)', r.status === 409);

    console.log('Tienda ocupada y empresa en otro proyecto');
    r = await llamar('POST', '/proyectos', { cuerpo: borrador({ nichoId: nichoHospitales, tiendaIds: [T1] }) });
    prueba('una tienda ocupada no se puede incluir: dice en qué proyecto está y hasta cuándo', r.status === 400 && /ya está en/.test(r.datos.campos.tiendaIds) && /27 nov/.test(r.datos.campos.tiendaIds), JSON.stringify(r.datos));
    r = await llamar('GET', '/proyectos/opciones');
    prueba('las opciones marcan la tienda como ocupada', r.datos.tiendas.find(t => t.id === T1).ocupada && r.datos.tiendas.find(t => t.id === T1).ocupada.proyectoId === p1.id);
    r = await llamar('POST', `/proyectos/${p2Id}/vista-previa`);
    prueba('una empresa que ya está en un proyecto activo no entra a otro del mismo nicho', r.status === 200 && r.datos.totalEmpresas === 0 && r.datos.asignadas === 0, JSON.stringify(r.datos));
    r = await llamar('GET', '/proyectos?estado=activos');
    prueba('la lista de activos trae el proyecto con sus conteos', r.datos.items.length === 1 && r.datos.items[0].id === p1.id && r.datos.items[0].empresas === 25 && r.datos.items[0].asesores === 5 && r.datos.conteos.activos === 1);

    console.log('Cancelar');
    r = await llamar('POST', `/proyectos/${p1.id}/cancelar`, { cuerpo: {} });
    prueba('cancelar un proyecto activo exige el motivo (400)', r.status === 400 && !!r.datos.campos.motivo);
    r = await llamar('POST', `/proyectos/${p1.id}/cancelar`, { cuerpo: { motivo: 'Cambió el plan del mes' } });
    prueba('al cancelarlo queda «cancelado»', r.status === 200 && r.datos.estado === 'cancelado');
    const libres = await db.query('SELECT COALESCE(SUM(abierta), 0) AS abiertas FROM proy_participaciones WHERE proyecto_id = ?', [p1.id], 'rep:libres');
    const tiendaLibre = await db.query('SELECT proyecto_abierto FROM proy_proyecto_tiendas WHERE proyecto_id = ?', [p1.id], 'rep:tienda_libre');
    prueba('libera las empresas y la tienda', Number(libres[0].abiertas) === 0 && tiendaLibre.every(t => t.proyecto_abierto === 0));
    prueba('queda en el historial con su motivo', Number((await db.query("SELECT COUNT(*) AS n FROM proy_historial WHERE proyecto_id = ? AND accion = 'cancelar' AND JSON_EXTRACT(detalle, '$.motivo') IS NOT NULL", [p1.id], 'rep:hist'))[0].n) === 1);
    prueba('un proyecto cancelado no se cancela otra vez (409)', (await llamar('POST', `/proyectos/${p1.id}/cancelar`, { cuerpo: { motivo: 'otra vez' } })).status === 409);
    r = await llamar('POST', `/proyectos/${p2Id}/vista-previa`);
    prueba('con la tienda y las empresas libres, otro proyecto vuelve a repartirlas', r.datos.totalEmpresas === 25 && r.datos.porAsesor.length === 5, JSON.stringify(r.datos));
    await llamar('POST', `/proyectos/${p2Id}/cancelar`, { cuerpo: {} });

    console.log('Dos activaciones a la vez');
    const a = (await llamar('POST', '/proyectos', { cuerpo: borrador({ tiendaIds: [T1] }) })).datos;
    const b = (await llamar('POST', '/proyectos', { cuerpo: borrador({ nichoId: nichoHospitales, tiendaIds: [T1] }) })).datos;
    prueba('dos borradores pueden compartir tienda mientras ninguno esté activo', a && b && a.id !== b.id);
    const segundo = await Promise.all([
      llamar('POST', `/proyectos/${a.id}/activar`, { cuerpo: { idempotencyKey: clave() } }),
      llamar('POST', `/proyectos/${b.id}/activar`, { cuerpo: { idempotencyKey: clave() } })
    ]);
    const estados = segundo.map(x => x.status).sort();
    const activos = await db.query("SELECT id FROM proy_proyectos WHERE id IN (?, ?) AND estado = 'activo'", [a.id, b.id], 'rep:activos');
    prueba('dos activaciones a la vez sobre la misma tienda dejan un solo ganador', activos.length === 1 && estados.filter(s => s === 200).length >= 1 && Number((await db.query('SELECT COUNT(*) AS n FROM proy_proyecto_tiendas WHERE tienda_id = ? AND proyecto_abierto = 1', [T1], 'rep:n_abiertas'))[0].n) === 1, JSON.stringify(estados));
    const perdedor = segundo.find(x => x.status !== 200);
    prueba('el perdedor recibe un 409 que dice qué tienda y qué proyecto la bloquean', !perdedor || (perdedor.status === 409 && /ya está en|ya no está en borrador/.test(perdedor.datos.error)), JSON.stringify(perdedor && perdedor.datos));
    const ganador = activos[0].id;
    const repartidas = Number((await db.query('SELECT COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id IN (?, ?)', [a.id, b.id], 'rep:rep'))[0].n);
    prueba('solo el ganador repartió empresas (las del perdedor no existen)', repartidas === (ganador === a.id ? 25 : 8), String(repartidas));
    await llamar('POST', `/proyectos/${ganador}/cancelar`, { cuerpo: { motivo: 'Fin de la prueba' } });

    console.log('Empresa nueva del nicho del proyecto activo');
    const f = (await llamar('POST', '/proyectos', { cuerpo: borrador({ tiendaIds: [T2] }) })).datos;
    await llamar('POST', `/proyectos/${f.id}/activar`, { cuerpo: { idempotencyKey: clave() } });
    const asesorQueParticipa = await asesorDe(T2, 0);
    const asesorSinProyecto = await asesorDe(T3, 0);
    const registrar = (usuario, nombre, nichoId) => llamar('POST', '/clientes', { usuario, permisos: PERM_ASESOR, cuerpo: { nombre, nichoId, paisId: paisGT, ciudad: 'Cobán', telefono: `7${String(Math.floor(Math.random() * 9000000) + 1000000)}`.slice(0, 8), contacto: { nombre: 'Ana', areaId } } });
    const [{ id: areaId }] = await db.query("SELECT id FROM proy_areas_contacto WHERE nombre = 'Compras'", [], 'rep:area');
    r = await registrar(asesorQueParticipa, 'REP Nueva Aurora', nichoBancos);
    let part = await db.query('SELECT asesor_id, tienda_id, asignada_por, abierta FROM proy_participaciones WHERE proyecto_id = ? AND cliente_id = ?', [f.id, r.datos && r.datos.id], 'rep:regla16');
    prueba('si un asesor que participa registra una empresa del nicho del proyecto activo, queda asignada a él', r.status === 201 && part.length === 1 && part[0].asesor_id === asesorQueParticipa && part[0].tienda_id === T2 && part[0].asignada_por === asesorQueParticipa && part[0].abierta === 1, JSON.stringify([r.status, part]));
    r = await registrar(asesorQueParticipa, 'REP Nueva Bosque', nichoHospitales);
    part = await db.query('SELECT 1 FROM proy_participaciones WHERE cliente_id = ?', [r.datos && r.datos.id], 'rep:regla16b');
    prueba('si es de otro nicho, queda disponible (sin participación)', r.status === 201 && part.length === 0);
    r = await registrar(asesorSinProyecto, 'REP Nueva Cumbre', nichoBancos);
    part = await db.query('SELECT 1 FROM proy_participaciones WHERE cliente_id = ?', [r.datos && r.datos.id], 'rep:regla16c');
    prueba('si quien la registra no participa en el proyecto, queda disponible para que el supervisor la incorpore', r.status === 201 && part.length === 0, JSON.stringify([r.status, part]));
    await llamar('POST', `/proyectos/${f.id}/cancelar`, { cuerpo: { motivo: 'Fin de la prueba' } });
    // Las empresas nuevas de esta prueba se quitan para que las demás pruebas sigan contando las 25 de siempre.
    await db.query("DELETE FROM proy_participaciones WHERE cliente_id IN (SELECT id FROM proy_clientes WHERE nombre LIKE 'REP Nueva%')", [], 'rep:quitar_part');
    await db.query("DELETE FROM proy_contactos WHERE cliente_id IN (SELECT id FROM proy_clientes WHERE nombre LIKE 'REP Nueva%')", [], 'rep:quitar_cont');
    await db.query("DELETE FROM proy_clientes WHERE nombre LIKE 'REP Nueva%'", [], 'rep:quitar_cli');

    console.log('Misma clave a la vez');
    const c = (await llamar('POST', '/proyectos', { cuerpo: borrador({ tiendaIds: [T2] }) })).datos;
    const claveC = clave();
    const triples = await Promise.all([1, 2, 3].map(() => llamar('POST', `/proyectos/${c.id}/activar`, { cuerpo: { idempotencyKey: claveC } })));
    prueba('tres activaciones simultáneas con la misma clave reparten una sola vez', triples.every(x => x.status === 200) && Number((await db.query('SELECT COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ?', [c.id], 'rep:triples'))[0].n) === 25 && triples.filter(x => x.datos.repetida === false).length === 1, JSON.stringify(triples.map(x => [x.status, x.datos && x.datos.repetida])));
    await llamar('POST', `/proyectos/${c.id}/cancelar`, { cuerpo: { motivo: 'Fin de la prueba' } });

    console.log('Tope, reserva y descanso');
    const d = (await llamar('POST', '/proyectos', { cuerpo: borrador({ tiendaIds: [T1], topePorAsesor: 3 }) })).datos;
    r = await llamar('POST', `/proyectos/${d.id}/vista-previa`);
    prueba('con tope de 3 por asesor, 6 asesores reciben 18 y 7 quedan en reserva', r.datos.asignadas === 18 && r.datos.reserva === 7 && r.datos.porAsesor.every(x => x.empresas === 3) && r.datos.topeAplicado === 3, JSON.stringify(r.datos));
    r = await llamar('POST', `/proyectos/${d.id}/activar`, { cuerpo: { idempotencyKey: clave() } });
    const reserva = await db.query('SELECT COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id IS NULL AND abierta = 1', [d.id], 'rep:reserva');
    prueba('las de reserva quedan abiertas y sin asesor', r.status === 200 && Number(reserva[0].n) === 7, JSON.stringify(r.datos && r.datos.estado));
    await llamar('POST', `/proyectos/${d.id}/cancelar`, { cuerpo: { motivo: 'Fin de la prueba' } });
    // Descanso: una empresa con venta reciente en un proyecto cerrado del mismo nicho no entra.
    const [{ id: vendida }] = await db.query("SELECT id FROM proy_clientes WHERE nombre = 'REP Banco 00'", [], 'rep:vendida');
    const cerrado = (await db.query(
      `INSERT INTO proy_proyectos (codigo, nombre, nicho_id, anio, mes, estado, fecha_inicio, fecha_fin, cerrado_en, creado_por) VALUES ('REP-CERRADO', 'REP cerrado', ?, 2026, 10, 'cerrado', '2026-10-01', '2026-10-30', NOW(), ?)`, [nichoBancos, admin], 'rep:cerrado')).insertId;
    await db.query("INSERT INTO proy_participaciones (proyecto_id, cliente_id, asesor_id, tienda_id, estado, abierta) VALUES (?, ?, ?, ?, 'vendida', 0)", [cerrado, vendida, await asesorDe(T1, 1), T1], 'rep:part_vendida');
    const e = (await llamar('POST', '/proyectos', { cuerpo: borrador({ tiendaIds: [T1] }) })).datos;
    r = await llamar('POST', `/proyectos/${e.id}/vista-previa`);
    prueba('una empresa con venta reciente descansa: no entra al reparto del mismo nicho', r.datos.totalEmpresas === 24, JSON.stringify(r.datos.totalEmpresas));
    await configService.guardar({ 'reparto.descanso_meses': 0 }, admin);
    r = await llamar('POST', `/proyectos/${e.id}/vista-previa`);
    prueba('con el descanso apagado (0 meses) vuelve a entrar', r.datos.totalEmpresas === 25, JSON.stringify(r.datos.totalEmpresas));
    await configService.guardar({ 'reparto.descanso_meses': 3 }, admin);

    console.log('Aprobación y vencido');
    await configService.guardar({ 'reglas.aprobar_activacion': true }, admin);
    r = await llamar('POST', `/proyectos/${e.id}/activar`, { cuerpo: { idempotencyKey: clave() } });
    prueba('con la aprobación del gerente encendida, activar directo responde 409', r.status === 409 && /aprobación del gerente/.test(r.datos.error), JSON.stringify(r.datos));
    await configService.guardar({ 'reglas.aprobar_activacion': false }, admin);
    await llamar('POST', `/proyectos/${e.id}/cancelar`, { cuerpo: {} });
    const vencido = (await db.query(
      `INSERT INTO proy_proyectos (codigo, nombre, nicho_id, anio, mes, estado, fecha_inicio, fecha_fin, activado_en, creado_por) VALUES ('REP-VENCIDO', 'REP vencido', ?, 2026, 9, 'activo', '2026-09-01', '2026-09-30', NOW(), ?)`, [nichoHospitales, SUP], 'rep:vencido')).insertId;
    const reciente = (await db.query(
      `INSERT INTO proy_proyectos (codigo, nombre, nicho_id, anio, mes, estado, fecha_inicio, fecha_fin, activado_en, creado_por) VALUES ('REP-RECIENTE', 'REP reciente', ?, 2099, 1, 'activo', '2099-01-01', '2099-01-30', NOW(), ?)`, [nichoHospitales, SUP], 'rep:reciente')).insertId;
    r = await llamar('GET', '/proyectos?estado=vencidos');
    prueba('un proyecto activo cuyo fin ya pasó (más la gracia) sale como vencido; uno vigente no',
      r.datos.items.some(x => x.id === vencido && x.vencido) && !r.datos.items.some(x => x.id === reciente) && r.datos.vencidos.some(x => x.id === vencido), JSON.stringify(r.datos.items.map(x => [x.codigo, x.vencido])));
    r = await llamar('GET', '/proyectos?estado=cancelados');
    prueba('los cancelados se listan aparte y no cuentan en «Todos»', r.datos.items.length >= 3 && r.datos.conteos.todos === (await llamar('GET', '/proyectos')).datos.items.length);
  } finally {
    // Limpieza, pase lo que pase: nada de esta prueba debe quedar en la base.
    await db.query("DELETE FROM proy_proyectos WHERE creado_en >= ? AND (creado_por IN (?) OR codigo LIKE 'REP-%')", [inicio, [13, 14, 15, admin]], 'rep:limpiar_proyectos');
    await db.query("DELETE FROM proy_proyectos WHERE codigo LIKE 'REP-%'", [], 'rep:limpiar_rep');
    await db.query("DELETE FROM proy_clientes WHERE nombre LIKE 'REP %'", [], 'rep:limpiar_clientes');
    await db.query("DELETE FROM idempotency_keys WHERE idempotency_key LIKE 'proy-activar:%' AND creado_en >= ?", [inicio], 'rep:limpiar_claves');
    await db.query('DELETE FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'rep:limpiar_ajustes');
    for (const { clave: c, valor } of ajustesAntes) await db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?)', [c, valor], 'rep:restaurar_ajuste');
    await db.query('DELETE FROM proy_config_historial WHERE creado_en >= ?', [inicio], 'rep:limpiar_historial');
    configService.invalidar();
    servidor.close();
    void cuantas;
  }
}

(async () => {
  verificarPuras();
  await db.listo;
  await verificarServicio();
  console.log(malas ? `\n${malas} verificación(es) fallaron (${buenas} correctas).` : `\nTodo correcto (${buenas} verificaciones).`);
  process.exit(malas ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
