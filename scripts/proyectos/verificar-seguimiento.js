// scripts/proyectos/verificar-seguimiento.js
// Verifica el seguimiento del supervisor (fase 5a), por HTTP contra las rutas reales: los tres niveles de alcance y la fila
// «Otra tienda» sin datos sensibles, cifras y semáforo, estancados, reasignación (una, varias, masiva y equitativa), anulaciones
// con recálculo del estado y la cola de ventas por confirmar, con sus avisos.
//
// Uso (base DESECHABLE con las migraciones aplicadas; crea datos de prueba y los borra al terminar):
//   node scripts/proyectos/verificar-seguimiento.js
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/proyectos/routes');
const { nivelesDe, enmascararFila, semaforo, diasDeReaccion } = require('../../src/modules/proyectos/alcanceSeguimiento');

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};

const PERM_ADMIN = ['proyectos.ver', 'proyectos.administrar', 'proyectos.activar', 'proyectos.supervisar', 'proyectos.reasignar', 'proyectos.corregir', 'proyectos.confirmar_ventas'];
const PERM_SUPERVISOR = ['proyectos.ver', 'proyectos.activar', 'proyectos.supervisar', 'proyectos.reasignar', 'proyectos.corregir', 'proyectos.confirmar_ventas'];
const PERM_SUPERVISOR_SOLO_VER = ['proyectos.ver', 'proyectos.supervisar'];
const PERM_GERENTE = ['proyectos.ver', 'proyectos.ver_gerencia'];
const PERM_ASESOR = ['proyectos.ver', 'proyectos.gestionar'];

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

async function verificar() {
  const configService = require('../../src/modules/proyectos/services/configService');
  const inicio = (await db.query('SELECT NOW() - INTERVAL 2 SECOND AS t', [], 'seg:inicio'))[0].t;
  const ajustesAntes = await db.query('SELECT clave, valor FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'seg:ajustes_antes');
  const [{ id: nichoId }] = await db.query("SELECT id FROM proy_nichos WHERE nombre = 'Hospitales'", [], 'seg:nicho');
  const [{ id: estructuraId }] = await db.query('SELECT id FROM proy_estructuras ORDER BY id LIMIT 1', [], 'seg:estructura');
  const [{ id: paisGT }] = await db.query("SELECT id FROM paises WHERE codigo = 'GT'", [], 'seg:pais');
  const [{ id: admin }] = await db.query('SELECT id FROM usuarios WHERE rol_id = 1 ORDER BY id LIMIT 1', [], 'seg:admin');
  const [{ id: gerente }] = await db.query("SELECT id FROM usuarios WHERE email = 'gerente@grupopremia.com'", [], 'seg:gerente');
  const [{ id: articulo }] = await db.query('SELECT id FROM proy_articulos WHERE activo = 1 ORDER BY id LIMIT 1', [], 'seg:articulo');
  const paisAntes = (await db.query('SELECT moneda_codigo, referencia_obligatoria, confirmacion_ventas FROM proy_pais_config WHERE pais_id = ?', [paisGT], 'seg:pais_antes'))[0];
  const resultado = async (nombre) => (await db.query('SELECT id FROM proy_resultados_gestion WHERE nombre = ?', [nombre], 'seg:resultado'))[0].id;
  const rPideCotizacion = await resultado('Pide cotización');
  const [{ id: canal }] = await db.query("SELECT id FROM proy_canales WHERE nombre = 'Llamada'", [], 'seg:canal');
  const SUP1 = 13; // supervisa las tiendas 1 y 2
  const SUP2 = 15; // supervisa la tienda 3
  const SUP_SIN = 14; // supervisa la tienda 2: no está en el proyecto

  console.log('Reglas puras');
  const n13 = nivelesDe({ permissions: PERM_SUPERVISOR }, [1, 2], [1, 3]);
  prueba('un supervisor lee un proyecto si una de sus tiendas está en él', n13.lee === true && nivelesDe({ permissions: PERM_SUPERVISOR }, [2], [1, 3]).lee === false);
  prueba('actúa solo en sus tiendas; ver no da poder de actuar', n13.puedeActuarEn(1) === true && n13.puedeActuarEn(3) === false && n13.veDetalleEn(3) === false);
  const nGer = nivelesDe({ permissions: PERM_GERENTE }, [], [1, 3]);
  prueba('gerencia lee y ve el detalle de todo, pero no actúa', nGer.lee && nGer.veDetalleEn(3) && !nGer.puedeActuarEn(1));
  prueba('administración actúa en todo', nivelesDe({ permissions: PERM_ADMIN }, [], [1, 3]).puedeActuarEn(99) === true);
  const masc = enmascararFila({ id: 5, empresa: 'X', estado: 'cotizada', asesor: 'A', tienda: 'T', contacto: 'C', telefono: '1', monto: 9, referencia: 'R', extra: 'z' }, false);
  prueba('«Otra tienda» conserva empresa, estado y asesor y vacía contactos, montos y referencias', masc.otraTienda === true && masc.empresa === 'X' && masc.estado === 'cotizada' && masc.contacto === null && masc.telefono === null && masc.monto === null && masc.referencia === null && !('extra' in masc));
  prueba('semáforo: verde desde 75, ámbar desde 50, rojo debajo', semaforo(75, 75, 50) === 'verde' && semaforo(74, 75, 50) === 'ambar' && semaforo(50, 75, 50) === 'ambar' && semaforo(49, 75, 50) === 'rojo');
  prueba('el tiempo de reacción sale en días con un decimal', diasDeReaccion(1728) === 1.2 && diasDeReaccion(0) === 0);

  await db.query('INSERT INTO proy_clientes (nombre, nombre_normalizado, nicho_id, pais_id, estructura_id, estado, creado_por) VALUES ?',
    [Array.from({ length: 60 }, (_, i) => [`SEG Hospital ${i}`, `seg hospital ${i}`, nichoId, paisGT, estructuraId, 'activa', admin])], 'seg:empresas');

  const servidor = await levantar();
  const base = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;
  const llamar = async (metodo, ruta, { usuario, permisos, cuerpo }) => {
    const res = await fetch(base + ruta, { method: metodo, headers: { 'content-type': 'application/json', 'x-usuario': String(usuario), 'x-permisos': permisos.join(',') }, body: cuerpo === undefined || metodo === 'GET' ? undefined : JSON.stringify(cuerpo) });
    return { status: res.status, datos: await res.json().catch(() => null) };
  };
  const adm = (m, r, c) => llamar(m, r, { usuario: admin, permisos: PERM_ADMIN, cuerpo: c });
  const sup1 = (m, r, c) => llamar(m, r, { usuario: SUP1, permisos: PERM_SUPERVISOR, cuerpo: c });
  const sup2 = (m, r, c) => llamar(m, r, { usuario: SUP2, permisos: PERM_SUPERVISOR, cuerpo: c });
  const supSin = (m, r, c) => llamar(m, r, { usuario: SUP_SIN, permisos: PERM_SUPERVISOR, cuerpo: c });
  const ger = (m, r, c) => llamar(m, r, { usuario: gerente, permisos: PERM_GERENTE, cuerpo: c });
  const clave = () => `seg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  let proyectoId = null;

  try {
    console.log('Preparación: un proyecto activo en las tiendas 1 y 3 (dos supervisores distintos)');
    let r = await adm('POST', '/proyectos', { nichoId, anio: 2026, mes: 11, tiendaIds: [1, 3], fechaInicio: '2026-11-02', fechaFin: '2026-11-27', articuloId: articulo, existenciaMuestras: 50, topePorAsesor: 100 });
    proyectoId = r.datos && r.datos.id;
    r = await adm('POST', `/proyectos/${proyectoId}/activar`, { idempotencyKey: clave() });
    prueba('el proyecto se activa y reparte las 60 empresas', r.status === 200 && r.datos.estado === 'activo' && r.datos.empresas === 60, JSON.stringify(r.datos));
    const delaTienda = async (t) => (await db.query('SELECT asesor_id, COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND tienda_id = ? GROUP BY asesor_id ORDER BY asesor_id', [proyectoId, t], 'seg:asesores_tienda'));
    const t1 = await delaTienda(1);
    const t3 = await delaTienda(3);
    const A1 = t1[0].asesor_id; const A2 = t1[1].asesor_id; const B1 = t3[0].asesor_id;
    const propias = async (u) => (await db.query('SELECT id FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id = ? ORDER BY id', [proyectoId, u], 'seg:propias')).map(x => x.id);
    const [a1, a2, a3, a4] = await propias(A1);
    const mias2 = await propias(A2);
    const [b1] = await propias(B1);
    const asesor = (m, r, c, u) => llamar(m, r, { usuario: u, permisos: PERM_ASESOR, cuerpo: c });
    const filaDe = async (id) => (await db.query('SELECT * FROM proy_participaciones WHERE id = ?', [id], 'seg:fila'))[0];
    const avisos = async (tipoLike) => Number((await db.query("SELECT COUNT(*) AS n FROM notificaciones WHERE modulo = 'proyectos' AND tipo LIKE ? AND creado_en >= ?", [tipoLike, inicio], 'seg:avisos'))[0].n);

    console.log('Alcance');
    prueba('un supervisor del proyecto abre el seguimiento', (await sup1('GET', `/proyectos/${proyectoId}/seguimiento`)).status === 200);
    prueba('el otro supervisor también (su tienda 3 está en el proyecto)', (await sup2('GET', `/proyectos/${proyectoId}/seguimiento`)).status === 200);
    prueba('un supervisor sin tiendas en el proyecto recibe 404', (await supSin('GET', `/proyectos/${proyectoId}/seguimiento`)).status === 404);
    prueba('quien no supervisa ni es gerencia recibe 403', (await llamar('GET', `/proyectos/${proyectoId}/seguimiento`, { usuario: A1, permisos: PERM_ASESOR })).status === 403);
    prueba('gerencia lo ve', (await ger('GET', `/proyectos/${proyectoId}/seguimiento`)).status === 200);
    r = await sup1('GET', '/seguimiento/proyectos');
    prueba('la lista de proyectos activos trae el suyo', r.status === 200 && r.datos.proyectos.some(p => p.id === proyectoId));
    r = await supSin('GET', '/seguimiento/proyectos');
    prueba('…y al supervisor ajeno no le trae este', r.status === 200 && !r.datos.proyectos.some(p => p.id === proyectoId));

    console.log('Trabajo de los asesores (para tener qué medir)');
    for (const id of [a1, a2, a3]) await asesor('POST', `/participaciones/${id}/gestiones`, { canalId: canal, resultadoId: rPideCotizacion, idempotencyKey: clave() }, A1);
    await asesor('POST', `/participaciones/${a1}/cotizaciones`, { monto: 12500, referencia: 'COT-1', idempotencyKey: clave() }, A1);
    r = await asesor('POST', `/participaciones/${a1}/ventas`, { monto: 11800, referencia: 'OV-SEG-1', idempotencyKey: clave() }, A1);
    prueba('el asesor 1 llega a «vendida» en su primera empresa', r.status === 201 && r.datos.estado === 'vendida');
    await asesor('POST', `/participaciones/${b1}/gestiones`, { canalId: canal, resultadoId: rPideCotizacion, idempotencyKey: clave() }, B1);
    const ventaA1 = r.datos.historial.find(h => h.tipo === 'venta').id;
    const cotA1 = r.datos.historial.find(h => h.tipo === 'cotizacion').id;

    console.log('Avance');
    r = await sup1('GET', `/proyectos/${proyectoId}/seguimiento`);
    prueba('el resumen trae cifras acumulativas, efectividad y semáforo de cobertura', r.datos.cifras.asignadas === 60 && r.datos.cifras.gestionadas === 4 && r.datos.cifras.vendidas === 1 && r.datos.cifras.cotizadas === 1 && r.datos.cobertura.semaforo === 'rojo' && r.datos.conteos.tiendas === 2, JSON.stringify(r.datos));
    prueba('el resumen dice qué puede hacer cada quien', r.datos.permisos.reasignar === true && r.datos.permisos.corregir === true);
    prueba('un supervisor sin permisos de acción ve el seguimiento pero sin acciones', (await llamar('GET', `/proyectos/${proyectoId}/seguimiento`, { usuario: SUP1, permisos: PERM_SUPERVISOR_SOLO_VER })).datos.permisos.reasignar === false);
    r = await sup1('GET', `/proyectos/${proyectoId}/seguimiento/asesores`);
    const filaA1 = r.datos.asesores.find(a => a.asesorId === A1);
    const filaB1 = r.datos.asesores.find(a => a.asesorId === B1);
    prueba('por asesor: sus asesores con cifras, tiempo de reacción y semáforo', filaA1 && filaA1.asignadas === t1[0].n && filaA1.gestionadas === 3 && filaA1.vendidas === 1 && typeof filaA1.reaccionDias === 'number' && ['verde', 'ambar', 'rojo'].includes(filaA1.semaforo) && filaA1.otraTienda === false, JSON.stringify(filaA1));
    prueba('por asesor: los de otra tienda salen enmascarados desde el servidor', filaB1 && filaB1.otraTienda === true && filaB1.interesadas === null && filaB1.vendidas === null && filaB1.reaccionDias === null && filaB1.semaforo === null && filaB1.gestionadas === 1, JSON.stringify(filaB1));
    r = await ger('GET', `/proyectos/${proyectoId}/seguimiento/asesores`);
    prueba('gerencia ve el detalle de todas las tiendas', r.datos.asesores.every(a => a.otraTienda === false && a.vendidas !== null));
    r = await sup1('GET', `/proyectos/${proyectoId}/seguimiento/tiendas`);
    prueba('por tienda: las dos tiendas con asesores y semáforo', r.status === 200 && r.datos.tiendas.length === 2 && r.datos.tiendas.every(t => t.asesores >= 1 && ['verde', 'ambar', 'rojo'].includes(t.semaforo)), JSON.stringify(r.datos));

    console.log('Estancados');
    await db.query("UPDATE proy_participaciones SET asignada_en = DATE_SUB(NOW(), INTERVAL 12 DAY) WHERE id IN (?)", [[mias2[0], mias2[1], b1 === undefined ? 0 : (await propias(B1))[1]]], 'seg:envejecer');
    r = await sup1('GET', `/proyectos/${proyectoId}/seguimiento/estancados`);
    const idsEst = r.datos.empresas.map(e => e.id);
    prueba('los estancados llevan 7 días o más sin gestión, de la más antigua a la más reciente', r.status === 200 && r.datos.total >= 3 && idsEst.includes(mias2[0]) && r.datos.empresas.every((e, i, l) => i === 0 || l[i - 1].diasSinGestion >= e.diasSinGestion), JSON.stringify(r.datos));
    const deOtra = r.datos.empresas.find(e => e.asesor && e.otraTienda);
    prueba('las de otra tienda llegan sin contacto ni montos', deOtra && deOtra.contacto === null && deOtra.telefono === null && deOtra.monto === null, JSON.stringify(r.datos.empresas));
    prueba('las que ya tienen resultado no son estancadas', !idsEst.includes(a1));
    r = await sup1('GET', `/proyectos/${proyectoId}/seguimiento/estancados`);
    const mostradas = r.datos.mostrando;
    prueba('por defecto muestra pocas y «Ver las N» trae todas', mostradas <= 7 && (await sup1('GET', `/proyectos/${proyectoId}/seguimiento/estancados?todos=1`)).datos.mostrando === r.datos.total);

    console.log('Una empresa vista por el supervisor');
    r = await sup1('GET', `/participaciones/${a1}/supervision`);
    prueba('de sus tiendas: ficha completa con contactos, historial y permisos', r.status === 200 && r.datos.otraTienda === false && r.datos.historial.length >= 3 && r.datos.permisos.anular === true && r.datos.permisos.reasignar === false /* vendida */, JSON.stringify(r.datos.permisos));
    r = await sup1('GET', `/participaciones/${b1}/supervision`);
    prueba('de otra tienda: «Otra tienda» sin contactos, historial ni acciones', r.status === 200 && r.datos.otraTienda === true && r.datos.historial.length === 0 && r.datos.contactos.length === 0 && r.datos.telefono === null && r.datos.permisos.anular === false && r.datos.permisos.reasignar === false && typeof r.datos.empresa === 'string', JSON.stringify(r.datos));
    prueba('el supervisor ajeno al proyecto recibe 404', (await supSin('GET', `/participaciones/${a1}/supervision`)).status === 404);
    r = await ger('GET', `/participaciones/${b1}/supervision`);
    prueba('gerencia ve el detalle pero sin acciones', r.status === 200 && r.datos.otraTienda === false && r.datos.permisos.reasignar === false && r.datos.permisos.anular === false);

    console.log('Reasignación');
    const idsAnt = mias2.slice(2, 4);
    r = await supSin('POST', `/proyectos/${proyectoId}/reasignar`, { empresaIds: [mias2[2]], aAsesorId: A1, motivo: 'x', idempotencyKey: clave() });
    prueba('un supervisor ajeno al proyecto recibe 404', r.status === 404);
    r = await llamar('POST', `/proyectos/${proyectoId}/reasignar`, { usuario: SUP1, permisos: PERM_SUPERVISOR_SOLO_VER, cuerpo: { empresaIds: [mias2[2]], aAsesorId: A1, motivo: 'x', idempotencyKey: clave() } });
    prueba('sin proyectos.reasignar → 403', r.status === 403);
    r = await sup1('POST', `/proyectos/${proyectoId}/reasignar`, { empresaIds: [mias2[2]], aAsesorId: A1, idempotencyKey: clave() });
    prueba('sin motivo → 400', r.status === 400 && !!r.datos.campos.motivo, JSON.stringify(r.datos));
    r = await sup1('POST', `/proyectos/${proyectoId}/reasignar`, { empresaIds: [mias2[2]], motivo: 'Vacaciones', idempotencyKey: clave() });
    prueba('sin destino → 400', r.status === 400 && !!r.datos.campos.aAsesorId);
    r = await sup1('POST', `/proyectos/${proyectoId}/reasignar`, { empresaIds: [b1], aAsesorId: A1, motivo: 'Prueba', idempotencyKey: clave() });
    prueba('reasignar una empresa de OTRA tienda → 403 y no cambia nada', r.status === 403 && (await filaDe(b1)).asesor_id === B1, JSON.stringify(r.datos));
    r = await sup1('POST', `/proyectos/${proyectoId}/reasignar`, { empresaIds: [mias2[2]], aAsesorId: B1, motivo: 'Prueba', idempotencyKey: clave() });
    prueba('el destino debe ser un participante de SUS tiendas → 400', r.status === 400 && !!r.datos.campos.aAsesorId, JSON.stringify(r.datos));
    r = await sup1('POST', `/proyectos/${proyectoId}/reasignar`, { empresaIds: [a1], aAsesorId: A2, motivo: 'Prueba', idempotencyKey: clave() });
    prueba('una empresa ya vendida no se reasigna (409)', r.status === 409);
    r = await sup1('POST', `/proyectos/${proyectoId}/reasignar`, { empresaIds: [a2], aAsesorId: A1, motivo: 'Prueba', idempotencyKey: clave() });
    prueba('el destino no puede ser quien ya la tiene → 400', r.status === 400);
    r = await sup1('POST', `/proyectos/${proyectoId}/reasignar`, { empresaIds: [mias2[2]], aAsesorId: A1, soloVistaPrevia: true });
    prueba('la vista previa dice cuántas recibe cada uno sin escribir nada', r.status === 200 && r.datos.vistaPrevia === true && r.datos.total === 1 && r.datos.porAsesor[0].recibe === 1 && (await filaDe(mias2[2])).asesor_id === A2, JSON.stringify(r.datos));
    const k1 = clave();
    r = await sup1('POST', `/proyectos/${proyectoId}/reasignar`, { empresaIds: [mias2[2]], aAsesorId: A1, motivo: 'De vacaciones hasta el 20 nov', idempotencyKey: k1 });
    const despues = await filaDe(mias2[2]);
    prueba('reasignar una empresa: cambia de asesor, conserva su estado y queda en el historial', r.status === 200 && r.datos.reasignadas === 1 && despues.asesor_id === A1 && despues.estado === 'pendiente' && Number((await db.query('SELECT COUNT(*) AS n FROM proy_reasignaciones WHERE participacion_id = ? AND de_usuario_id = ? AND a_usuario_id = ? AND por_usuario_id = ?', [mias2[2], A2, A1, SUP1], 'seg:hist'))[0].n) === 1, JSON.stringify(r.datos));
    r = await sup1('POST', `/proyectos/${proyectoId}/reasignar`, { empresaIds: [mias2[2]], aAsesorId: A1, motivo: 'De vacaciones hasta el 20 nov', idempotencyKey: k1 });
    prueba('repetir la clave no reasigna otra vez', r.status === 200 && r.datos.repetida === true && Number((await db.query('SELECT COUNT(*) AS n FROM proy_reasignaciones WHERE participacion_id = ?', [mias2[2]], 'seg:hist2'))[0].n) === 1);
    prueba('se avisó a quien recibe y a quien cede', (await avisos('reasignacion_recibida')) >= 1 && (await avisos('reasignacion_cedida')) >= 1);
    const antesA2 = (await propias(A2)).length;
    r = await sup1('POST', `/proyectos/${proyectoId}/reasignar`, { deAsesorId: A2, todasLasPendientes: true, aAsesorId: 'equitativo', motivo: 'Ausente', idempotencyKey: clave() });
    const cargaTienda1 = (await db.query('SELECT asesor_id, COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND tienda_id = 1 AND asesor_id <> ? GROUP BY asesor_id', [proyectoId, A2], 'seg:carga')).map(x => Number(x.n));
    prueba('masiva y equitativa: todas las pendientes de un asesor se reparten entre los demás de su tienda', r.status === 200 && r.datos.reasignadas >= 1 && (await propias(A2)).every(id => id) && (await db.query("SELECT COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id = ? AND estado = 'pendiente'", [proyectoId, A2], 'seg:pend'))[0].n === 0 && Math.max(...cargaTienda1) - Math.min(...cargaTienda1) <= 2, JSON.stringify({ r: r.datos, antesA2, cargaTienda1 }));
    prueba('…y nadie recibe la de un asesor de otra tienda', (await db.query('SELECT COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND tienda_id = 3 AND asesor_id NOT IN (SELECT usuario_id FROM proy_participantes WHERE proyecto_id = ? AND tienda_id = 3)', [proyectoId, proyectoId], 'seg:otra'))[0].n === 0);
    const [c1, c2] = [a4, (await propias(A1)).find(id => id !== a1 && id !== a2 && id !== a3 && id !== a4 && id !== mias2[2])];
    r = await Promise.all([
      sup1('POST', `/proyectos/${proyectoId}/reasignar`, { empresaIds: [c1], aAsesorId: A2, motivo: 'Carrera 1', idempotencyKey: clave() }),
      sup1('POST', `/proyectos/${proyectoId}/reasignar`, { empresaIds: [c1], aAsesorId: A2, motivo: 'Carrera 2', idempotencyKey: clave() })
    ]);
    const cadena = await db.query('SELECT de_usuario_id, a_usuario_id FROM proy_reasignaciones WHERE participacion_id = ? ORDER BY id', [c1], 'seg:cadena');
    prueba('dos reasignaciones a la vez de la misma empresa: una pasa y la otra se rechaza sin dejar datos a medias', r.map(x => x.status).sort().join() === '200,400' && cadena.length === 1 && (await filaDe(c1)).asesor_id === A2, `${r.map(x => x.status)} ${JSON.stringify(cadena)}`);
    void c2;
    const acciones = (await db.query("SELECT accion FROM proy_historial WHERE proyecto_id = ? AND accion = 'reasignar'", [proyectoId], 'seg:acciones')).length;
    prueba('cada reasignación queda en el historial del proyecto', acciones >= 3, String(acciones));

    console.log('Anulaciones');
    r = await sup1('POST', `/participaciones/${a1}/ventas/${ventaA1}/anular`, { idempotencyKey: clave() });
    prueba('anular sin motivo → 400', r.status === 400 && !!r.datos.campos.motivo);
    r = await llamar('POST', `/participaciones/${a1}/ventas/${ventaA1}/anular`, { usuario: SUP1, permisos: PERM_SUPERVISOR_SOLO_VER, cuerpo: { motivo: 'x', idempotencyKey: clave() } });
    prueba('sin proyectos.corregir → 403', r.status === 403);
    r = await sup2('POST', `/participaciones/${a1}/ventas/${ventaA1}/anular`, { motivo: 'No es mi tienda', idempotencyKey: clave() });
    prueba('anular algo de una tienda que no es la suya → 403', r.status === 403);
    const kA = clave();
    r = await sup1('POST', `/participaciones/${a1}/ventas/${ventaA1}/anular`, { motivo: 'Se registró con un monto equivocado', idempotencyKey: kA });
    prueba('anular la venta devuelve la empresa a «cotizada» y la venta ya no cuenta', r.status === 200 && r.datos.estado === 'cotizada' && r.datos.historial.find(h => h.tipo === 'venta').anulada === true && (await sup1('GET', `/proyectos/${proyectoId}/seguimiento`)).datos.cifras.vendidas === 0, JSON.stringify(r.datos));
    prueba('la venta guarda quién, cuándo y por qué', (await db.query('SELECT anulada_por, anulada_en, anulacion_motivo FROM proy_ventas WHERE id = ?', [ventaA1], 'seg:anulada'))[0].anulada_por === SUP1);
    r = await sup1('POST', `/participaciones/${a1}/ventas/${ventaA1}/anular`, { motivo: 'otra vez', idempotencyKey: clave() });
    prueba('anular dos veces → 409', r.status === 409);
    r = await sup1('POST', `/participaciones/${a1}/ventas/${ventaA1}/anular`, { motivo: 'Se registró con un monto equivocado', idempotencyKey: kA });
    prueba('repetir la clave devuelve el mismo resultado', r.status === 200 && r.datos.repetida === true);
    r = await sup1('POST', `/participaciones/${a1}/cotizaciones/${cotA1}/anular`, { motivo: 'Cotización equivocada', idempotencyKey: clave() });
    prueba('anular la cotización devuelve la empresa a «interesada»', r.status === 200 && r.datos.estado === 'interesada', JSON.stringify(r.datos.estado));
    prueba('se avisó al asesor de las anulaciones', (await avisos('anulacion_%')) >= 2);

    console.log('Ventas por confirmar');
    prueba('sin proyectos.confirmar_ventas → 403', (await llamar('GET', '/ventas', { usuario: SUP1, permisos: PERM_SUPERVISOR_SOLO_VER })).status === 403);
    await configService.guardar({ 'reglas.confirmar_ventas': true }, admin);
    r = await asesor('POST', `/participaciones/${a2}/ventas`, { monto: 8200, referencia: 'OV-SEG-2', idempotencyKey: clave() }, (await filaDe(a2)).asesor_id);
    prueba('con la regla encendida la venta nace «por confirmar»', r.status === 201 && r.datos.historial[0].estadoVenta === 'por_confirmar' && r.datos.estado !== 'vendida', JSON.stringify(r.datos.estado));
    const ventaPendiente = r.datos.historial[0].id;
    await asesor('POST', `/participaciones/${b1}/ventas`, { monto: 100, referencia: 'OV-SEG-3', idempotencyKey: clave() }, B1);
    r = await sup1('GET', '/ventas');
    prueba('el supervisor ve las por confirmar de SUS tiendas (no las de la tienda 3)', r.status === 200 && r.datos.ventas.some(v => v.id === ventaPendiente) && r.datos.ventas.every(v => v.referencia !== 'OV-SEG-3') && r.datos.activa === true && r.datos.conteos.por_confirmar >= 1, JSON.stringify(r.datos));
    r = await sup1('POST', `/ventas/${ventaPendiente}/rechazar`, { idempotencyKey: clave() });
    prueba('rechazar sin motivo → 400', r.status === 400 && !!r.datos.campos.motivo);
    const ventaOtra = (await db.query("SELECT id FROM proy_ventas WHERE referencia = 'OV-SEG-3'", [], 'seg:otra_venta'))[0].id;
    r = await sup1('POST', `/ventas/${ventaOtra}/confirmar`, { idempotencyKey: clave() });
    prueba('confirmar la venta de otra tienda → 403', r.status === 403);
    const kC = clave();
    r = await sup1('POST', `/ventas/${ventaPendiente}/confirmar`, { idempotencyKey: kC });
    prueba('confirmar pasa la venta a «confirmada» y la empresa a «vendida»', r.status === 200 && r.datos.estado === 'vendida' && (await filaDe(a2)).estado === 'vendida' && (await sup1('GET', `/proyectos/${proyectoId}/seguimiento`)).datos.cifras.vendidas === 1, JSON.stringify(r.datos));
    r = await sup1('POST', `/ventas/${ventaPendiente}/confirmar`, { idempotencyKey: kC });
    prueba('repetir la clave no confirma otra vez', r.status === 200 && r.datos.repetida === true);
    prueba('confirmar una venta ya revisada → 409', (await sup1('POST', `/ventas/${ventaPendiente}/confirmar`, { idempotencyKey: clave() })).status === 409);
    await asesor('POST', `/participaciones/${a3}/ventas`, { monto: 700, referencia: 'OV-SEG-4', idempotencyKey: clave() }, (await filaDe(a3)).asesor_id);
    const ventaMala = (await db.query("SELECT id FROM proy_ventas WHERE referencia = 'OV-SEG-4'", [], 'seg:mala'))[0].id;
    r = await sup1('POST', `/ventas/${ventaMala}/rechazar`, { motivo: 'La OV no existe en el sistema contable', idempotencyKey: clave() });
    prueba('rechazar con motivo: la venta queda «rechazada», no cuenta y la empresa no pasa a vendida', r.status === 200 && (await filaDe(a3)).estado !== 'vendida' && (await db.query('SELECT estado, revision_motivo FROM proy_ventas WHERE id = ?', [ventaMala], 'seg:rechazada'))[0].estado === 'rechazada', JSON.stringify(r.datos));
    r = await sup1('GET', '/ventas?estado=rechazada');
    prueba('la pestaña «Rechazadas» la lista', r.datos.ventas.some(v => v.id === ventaMala) && r.datos.conteos.rechazada >= 1);
    prueba('se avisó al asesor de la confirmación y del rechazo', (await avisos('venta_confirmada')) >= 1 && (await avisos('venta_rechazada')) >= 1);
    await configService.guardar({ 'reglas.confirmar_ventas': false }, admin);

    console.log('Proyecto cerrado: solo lectura');
    await db.query("UPDATE proy_proyectos SET estado = 'cerrado', cerrado_en = NOW() WHERE id = ?", [proyectoId], 'seg:cerrar');
    r = await sup1('POST', `/proyectos/${proyectoId}/reasignar`, { empresaIds: [a4], aAsesorId: A2, motivo: 'x', idempotencyKey: clave() });
    prueba('un proyecto cerrado no admite reasignaciones (409)', r.status === 409);
    r = await sup1('POST', `/participaciones/${a1}/cotizaciones/${cotA1}/anular`, { motivo: 'x', idempotencyKey: clave() });
    prueba('ni anulaciones (409)', r.status === 409);
  } finally {
    // Limpieza, pase lo que pase: nada de esta prueba debe quedar en la base.
    if (proyectoId) {
      const part = '(SELECT id FROM proy_participaciones WHERE proyecto_id = ?)';
      for (const tabla of ['proy_gestiones', 'proy_entregas_muestra', 'proy_cotizaciones', 'proy_ventas', 'proy_reasignaciones']) {
        await db.query(`DELETE FROM ${tabla} WHERE participacion_id IN ${part}`, [proyectoId], `seg:limpiar_${tabla}`);
      }
    }
    await db.query('DELETE FROM proy_proyectos WHERE creado_en >= ? AND creado_por = ?', [inicio, admin], 'seg:limpiar_proyectos');
    await db.query("DELETE FROM proy_clientes WHERE nombre LIKE 'SEG %'", [], 'seg:limpiar_clientes');
    await db.query("DELETE FROM notificaciones WHERE modulo = 'proyectos' AND creado_en >= ?", [inicio], 'seg:limpiar_notificaciones');
    await db.query("DELETE FROM idempotency_keys WHERE idempotency_key LIKE 'proy-%' AND creado_en >= ?", [inicio], 'seg:limpiar_claves');
    await db.query('UPDATE proy_pais_config SET moneda_codigo = ?, referencia_obligatoria = ?, confirmacion_ventas = ? WHERE pais_id = ?', [paisAntes.moneda_codigo, paisAntes.referencia_obligatoria, paisAntes.confirmacion_ventas, paisGT], 'seg:restaurar_pais');
    await db.query('DELETE FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'seg:limpiar_ajustes');
    for (const { clave: c, valor } of ajustesAntes) await db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?)', [c, valor], 'seg:restaurar_ajuste');
    await db.query('DELETE FROM proy_config_historial WHERE creado_en >= ?', [inicio], 'seg:limpiar_historial');
    configService.invalidar();
    servidor.close();
  }
}

(async () => {
  await db.listo;
  await verificar();
  console.log(malas ? `\n${malas} verificación(es) fallaron (${buenas} correctas).` : `\nTodo correcto (${buenas} verificaciones).`);
  process.exit(malas ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
