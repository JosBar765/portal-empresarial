// scripts/proyectos/verificar-metas-rondas.js
// Verifica la fase 9f, por HTTP contra las rutas reales: las metas de ventas por asesor y tienda (reparto en partes iguales, ajuste del
// supervisor, avance por moneda, lo de otras tiendas enmascarado) y las rondas de reparto de la reserva (apagadas, umbral de avance, vista
// previa, reparto, solo asesores de las tiendas del supervisor, idempotencia y avisos).
//
// Uso (base DESECHABLE con las migraciones aplicadas; crea datos de prueba y los borra al terminar):
//   node scripts/proyectos/verificar-metas-rondas.js
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/proyectos/routes');
const { calcular } = require('../../src/modules/proyectos/metas');

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};

const PERM_ADMIN = ['proyectos.ver', 'proyectos.administrar', 'proyectos.activar', 'proyectos.ver_reportes'];
const PERM_SUPERVISOR = ['proyectos.ver', 'proyectos.activar', 'proyectos.supervisar', 'proyectos.reasignar', 'proyectos.corregir'];
const PERM_SUPERVISOR_SOLO_VER = ['proyectos.ver', 'proyectos.supervisar'];
const PERM_GERENTE = ['proyectos.ver', 'proyectos.ver_gerencia'];
const PERM_ASESOR = ['proyectos.ver', 'proyectos.gestionar'];

async function levantar() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: Number(req.headers['x-usuario']), nombre: 'Prueba', permissions: (req.headers['x-permisos'] || '').split(',').filter(Boolean) };
    next();
  });
  app.use('/api/proyectos', requirePermission('proyectos.ver'), rutas);
  return new Promise(resolver => { const s = app.listen(0, '127.0.0.1', () => resolver(s)); });
}

async function verificar() {
  const configService = require('../../src/modules/proyectos/services/configService');
  const inicio = (await db.query('SELECT NOW() - INTERVAL 2 SECOND AS t', [], 'met:inicio'))[0].t;
  const ajustesAntes = await db.query('SELECT clave, valor FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'met:ajustes_antes');
  const [{ id: nichoId }] = await db.query("SELECT id FROM proy_nichos WHERE nombre = 'Hospitales'", [], 'met:nicho');
  const [{ id: estructuraId }] = await db.query('SELECT id FROM proy_estructuras ORDER BY id LIMIT 1', [], 'met:estructura');
  const [{ id: paisGT }] = await db.query("SELECT id FROM paises WHERE codigo = 'GT'", [], 'met:pais_gt');
  const [{ id: admin }] = await db.query('SELECT id FROM usuarios WHERE rol_id = 1 ORDER BY id LIMIT 1', [], 'met:admin');
  const [{ id: gerente }] = await db.query("SELECT id FROM usuarios WHERE email = 'gerente@grupopremia.com'", [], 'met:gerente');
  const [{ id: articulo }] = await db.query('SELECT id FROM proy_articulos WHERE activo = 1 ORDER BY id LIMIT 1', [], 'met:articulo');
  const SUP = 13; // supervisa las tiendas 1 y 2
  const SUP_OTRO = 14; // supervisa la tienda 2: no está en el proyecto

  const filas = Array.from({ length: 80 }, (_, i) => [`MET Empresa ${i}`, `met empresa ${i}`, nichoId, paisGT, estructuraId, 'activa', admin, 'Guatemala']);
  await db.query('INSERT INTO proy_clientes (nombre, nombre_normalizado, nicho_id, pais_id, estructura_id, estado, creado_por, ciudad) VALUES ?', [filas], 'met:empresas');

  const servidor = await levantar();
  const base = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;
  const llamar = async (metodo, ruta, { usuario, permisos, cuerpo }) => {
    const res = await fetch(base + ruta, { method: metodo, headers: { 'content-type': 'application/json', 'x-usuario': String(usuario), 'x-permisos': permisos.join(',') }, body: cuerpo === undefined || metodo === 'GET' ? undefined : JSON.stringify(cuerpo) });
    const texto = await res.text();
    let datos = null;
    try { datos = JSON.parse(texto); } catch { /* no es JSON */ }
    return { status: res.status, datos };
  };
  const adm = (m, r, c) => llamar(m, r, { usuario: admin, permisos: PERM_ADMIN, cuerpo: c });
  const sup = (m, r, c) => llamar(m, r, { usuario: SUP, permisos: PERM_SUPERVISOR, cuerpo: c });
  const ger = (m, r, c) => llamar(m, r, { usuario: gerente, permisos: PERM_GERENTE, cuerpo: c });
  const asesor = (u, m, r, c) => llamar(m, r, { usuario: u, permisos: PERM_ASESOR, cuerpo: c });
  const clave = () => `met-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const notificaciones = async (tipo) => (await db.query('SELECT COUNT(*) AS n FROM notificaciones WHERE modulo = ? AND tipo = ? AND creado_en >= ?', ['proyectos', tipo, inicio], 'met:notif'))[0].n;
  let proyectoId = null;

  try {
    console.log('Reglas puras de las metas');
    const c = calcular({ metaTotal: 1000, asesores: [{ id: 1, tiendaId: 10 }, { id: 2, tiendaId: 10 }, { id: 3, tiendaId: 20 }], ajustadas: new Map([[2, 500]]), vendido: new Map([[1, 400], [3, 250]]) });
    prueba('la meta se reparte en partes iguales (333.33) y una ajustada no cambia las demás', c.parte === 333.33 && c.filas[0].meta === 333.33 && c.filas[1].meta === 500 && c.filas[1].ajustada === true && c.filas[2].meta === 333.33);
    prueba('el avance es lo vendido sobre la meta y «falta» no baja de cero', c.filas[0].avance === 120 && c.filas[0].falta === 0 && c.filas[0].enMeta === true && c.filas[2].avance === 75 && c.filas[2].falta === 83.33);
    prueba('la meta de la tienda es la suma de sus asesores', c.tiendas.find(t => t.tiendaId === 10).meta === 833.33 && c.tiendas.find(t => t.tiendaId === 10).vendido === 400 && c.tiendas.find(t => t.tiendaId === 20).meta === 333.33);
    prueba('totales: vendido, avance, falta, asesores y tiendas en meta', c.total.vendido === 650 && c.total.avance === 65 && c.total.falta === 350 && c.asesoresEnMeta === 1 && c.tiendasEnMeta === 0);
    prueba('sin asesores o con meta 0 no se rompe', calcular({ metaTotal: 500, asesores: [] }).filas.length === 0 && calcular({ metaTotal: 0, asesores: [{ id: 1, tiendaId: 1 }], vendido: new Map([[1, 10]]) }).filas[0].enMeta === false);

    console.log('Preparación: un proyecto con meta, tope por asesor de 5 y por eso con empresas en reserva');
    let r = await adm('POST', '/proyectos', { nichoId, anio: 2026, mes: 11, tiendaIds: [1, 3], fechaInicio: '2026-11-02', fechaFin: '2026-11-27', articuloId: articulo, existenciaMuestras: 50, topePorAsesor: 5, metaMonto: 100000, metaMoneda: 'GTQ' });
    proyectoId = r.datos.id;
    r = await adm('POST', `/proyectos/${proyectoId}/activar`, { idempotencyKey: clave() });
    const partes = await db.query('SELECT p.id, p.asesor_id, p.tienda_id, p.cliente_id FROM proy_participaciones p WHERE p.proyecto_id = ? ORDER BY p.id', [proyectoId], 'met:partes');
    const conAsesor = partes.filter(p => p.asesor_id);
    const reserva0 = partes.filter(p => !p.asesor_id).length;
    const asesoresT1 = [...new Set(conAsesor.filter(p => p.tienda_id === 1).map(p => p.asesor_id))];
    const asesoresT3 = [...new Set(conAsesor.filter(p => p.tienda_id === 3).map(p => p.asesor_id))];
    const todos = [...new Set(conAsesor.map(p => p.asesor_id))];
    prueba('el proyecto se activa con asesores en las dos tiendas y empresas en reserva', r.status === 200 && asesoresT1.length >= 1 && asesoresT3.length >= 1 && reserva0 > 0, `${r.status} t1=${asesoresT1.length} t3=${asesoresT3.length} reserva=${reserva0}`);
    const A = asesoresT1[0];
    const B = asesoresT3[0];
    const delAsesor = (u) => conAsesor.filter(p => p.asesor_id === u);

    console.log('Metas: ver');
    prueba('un asesor no ve las metas del seguimiento (403)', (await asesor(A, 'GET', `/proyectos/${proyectoId}/metas`)).status === 403);
    r = await sup('GET', `/proyectos/${proyectoId}/metas`);
    const parte = Math.round((100000 / todos.length) * 100) / 100;
    prueba('el supervisor ve las metas: cada asesor con la parte igual de los 100,000', r.status === 200 && r.datos.habilitada === true && r.datos.moneda === 'GTQ' && r.datos.asesores.length === todos.length && r.datos.asesores.filter(a => !a.otraTienda).every(a => a.meta === parte && a.ajustada === false), JSON.stringify(r.datos).slice(0, 300));
    prueba('los asesores de otra tienda salen sin montos y sin acciones', r.datos.asesores.filter(a => a.otraTienda).length === asesoresT3.length && r.datos.asesores.filter(a => a.otraTienda).every(a => a.meta === null && a.vendido === null && a.puedeAjustar === false));
    prueba('el total del proyecto es la meta, con vendido en cero al empezar', r.datos.total.meta === 100000 && r.datos.total.vendido === 0 && r.datos.total.avance === 0 && r.datos.total.falta === 100000);
    prueba('gerencia ve el detalle de todas las tiendas pero no ajusta', (await ger('GET', `/proyectos/${proyectoId}/metas`)).datos.asesores.every(a => a.otraTienda === false && a.puedeAjustar === false));
    prueba('un supervisor ajeno al proyecto recibe 404', (await llamar('GET', `/proyectos/${proyectoId}/metas`, { usuario: SUP_OTRO, permisos: PERM_SUPERVISOR })).status === 404);

    console.log('Metas: avance con ventas');
    const pa = delAsesor(A);
    await asesor(A, 'POST', `/participaciones/${pa[0].id}/ventas`, { monto: 1500.5, moneda: 'GTQ', referencia: 'MET-A1', idempotencyKey: clave() });
    await asesor(A, 'POST', `/participaciones/${pa[1].id}/ventas`, { monto: 100, moneda: 'USD', referencia: 'MET-A2', idempotencyKey: clave() });
    await asesor(A, 'POST', `/participaciones/${pa[2].id}/ventas`, { monto: 999, moneda: 'GTQ', referencia: 'MET-MALA', idempotencyKey: clave() });
    await db.query("UPDATE proy_ventas SET anulada_en = NOW(), anulada_por = ?, anulacion_motivo = 'prueba' WHERE referencia = 'MET-MALA'", [admin], 'met:anular');
    r = await sup('GET', `/proyectos/${proyectoId}/metas`);
    const filaA = r.datos.asesores.find(a => a.asesorId === A);
    prueba('lo vendido (GTQ, vigente) cuenta para el avance; lo anulado no', filaA.vendido === 1500.5 && filaA.avance === Math.round((1500.5 / parte) * 100) && filaA.falta === Math.round((parte - 1500.5) * 100) / 100, JSON.stringify(filaA));
    prueba('las ventas en otra moneda se muestran aparte, sin mezclar', r.datos.otrasMonedas.length === 1 && r.datos.otrasMonedas[0].moneda === 'USD' && r.datos.otrasMonedas[0].monto === 100 && r.datos.total.vendido === 1500.5);
    r = await asesor(A, 'GET', '/mi-proyecto');
    prueba('el asesor ve su meta en Mi proyecto (la parte igual y lo que lleva)', r.status === 200 && r.datos.meta.meta === parte && r.datos.meta.vendido === 1500.5 && r.datos.meta.moneda === 'GTQ' && r.datos.meta.ajustada === false, JSON.stringify(r.datos.meta));

    console.log('Metas: ajustar');
    prueba('sin permiso de reasignar no se ajusta (403)', (await llamar('PUT', `/proyectos/${proyectoId}/metas/asesores/${A}`, { usuario: SUP, permisos: PERM_SUPERVISOR_SOLO_VER, cuerpo: { monto: 10 } })).status === 403);
    prueba('un monto inválido → 400', (await sup('PUT', `/proyectos/${proyectoId}/metas/asesores/${A}`, { monto: -5 })).status === 400 && (await sup('PUT', `/proyectos/${proyectoId}/metas/asesores/${A}`, { monto: 'abc' })).status === 400);
    prueba('no se ajusta a un asesor de otra tienda (403) ni a uno que no está en el proyecto (404)', (await sup('PUT', `/proyectos/${proyectoId}/metas/asesores/${B}`, { monto: 1000 })).status === 403 && (await sup('PUT', `/proyectos/${proyectoId}/metas/asesores/${admin}`, { monto: 1000 })).status === 404);
    const avisosAntes = await notificaciones('meta_ajustada');
    r = await sup('PUT', `/proyectos/${proyectoId}/metas/asesores/${A}`, { monto: 20000 });
    prueba('el supervisor ajusta la meta de un asesor de su tienda', r.status === 200 && r.datos.meta === 20000 && r.datos.ajustada === true && r.datos.avance === Math.round((1500.5 / 20000) * 100), JSON.stringify(r.datos));
    prueba('queda en el historial del proyecto y se le avisa al asesor', (await db.query("SELECT COUNT(*) AS n FROM proy_historial WHERE proyecto_id = ? AND accion = 'ajustar_meta'", [proyectoId], 'met:hist'))[0].n === 1 && (await notificaciones('meta_ajustada')) === avisosAntes + 1);
    r = await sup('GET', `/proyectos/${proyectoId}/metas`);
    prueba('las demás metas no cambian al ajustar una (la suma puede pasar de la meta)', r.datos.asesores.filter(a => !a.otraTienda && a.asesorId !== A).every(a => a.meta === parte) && r.datos.total.meta === 100000);
    r = await asesor(A, 'GET', '/mi-proyecto');
    prueba('el asesor ve su meta ajustada', r.datos.meta.meta === 20000 && r.datos.meta.ajustada === true);
    r = await sup('PUT', `/proyectos/${proyectoId}/metas/asesores/${A}`, { monto: null });
    prueba('quitar el ajuste vuelve a la parte igual', r.status === 200 && r.datos.meta === parte && r.datos.ajustada === false);
    prueba('una meta de 0 no rompe el avance', (await sup('PUT', `/proyectos/${proyectoId}/metas/asesores/${A}`, { monto: 0 })).datos.avance === 0);
    await sup('PUT', `/proyectos/${proyectoId}/metas/asesores/${A}`, { monto: '' });

    console.log('Metas: quedarse sin empresas no cambia la meta de nadie');
    const sinEmpresas = asesoresT1[1];
    const suyas = delAsesor(sinEmpresas).map(p => p.id);
    await db.query('UPDATE proy_participaciones SET asesor_id = ? WHERE id IN (?)', [A, suyas], 'met:vaciar');
    r = await sup('GET', `/proyectos/${proyectoId}/metas`);
    prueba('si un asesor queda sin empresas, la meta de los demás sigue siendo la parte igual', r.status === 200 && r.datos.asesores.length === todos.length && r.datos.asesores.filter(a => !a.otraTienda).every(a => a.meta === parte), JSON.stringify(r.datos));
    r = await sup('GET', `/proyectos/${proyectoId}/seguimiento/asesores`);
    const filaVacia = (r.datos.asesores || []).find(f => f.asesorId === sinEmpresas);
    prueba('…y sigue en Seguimiento con 0 asignadas', r.status === 200 && !!filaVacia && filaVacia.asignadas === 0 && r.datos.asesores.length === todos.length, JSON.stringify(r.datos));
    await db.query('UPDATE proy_participaciones SET asesor_id = ? WHERE id IN (?)', [sinEmpresas, suyas], 'met:devolver');

    console.log('Rondas: apagadas y umbral');
    r = await sup('GET', `/proyectos/${proyectoId}/reserva`);
    prueba('las rondas vienen apagadas: la pantalla lo sabe y no ofrece repartir', r.status === 200 && r.datos.habilitada === false && r.datos.puedeRepartir === false && r.datos.enReserva === reserva0 && r.datos.umbral === 80, JSON.stringify(r.datos).slice(0, 200));
    prueba('repartir con las rondas apagadas → 409', (await sup('POST', `/proyectos/${proyectoId}/reserva/repartir`, { tanda: 3, soloVistaPrevia: true })).status === 409);
    prueba('el administrador enciende las rondas desde Parámetros', (await adm('PUT', '/config/parametros', { cambios: { 'reparto.rondas': true } })).status === 200);
    r = await sup('GET', `/proyectos/${proyectoId}/reserva`);
    prueba('la lista solo trae asesores de las tiendas del supervisor y nadie llegó al 80 % todavía', r.datos.habilitada === true && r.datos.puedeRepartir === true && r.datos.asesores.length === asesoresT1.length && r.datos.elegibles === 0 && r.datos.asesores.every(a => a.porcentaje < 80), JSON.stringify(r.datos.asesores));
    r = await sup('POST', `/proyectos/${proyectoId}/reserva/repartir`, { tanda: 3, soloVistaPrevia: true });
    prueba('si nadie llegó al umbral: no se reparte y se explica (409)', r.status === 409 && /80 %/.test(r.datos.error), JSON.stringify(r.datos));
    prueba('una tanda inválida → 400', (await sup('POST', `/proyectos/${proyectoId}/reserva/repartir`, { tanda: 0, soloVistaPrevia: true })).status === 400 && (await sup('POST', `/proyectos/${proyectoId}/reserva/repartir`, { tanda: 'x', soloVistaPrevia: true })).status === 400 && (await sup('POST', `/proyectos/${proyectoId}/reserva/repartir`, { tanda: 101, soloVistaPrevia: true })).status === 400);
    prueba('sin permiso de reasignar → 403', (await llamar('POST', `/proyectos/${proyectoId}/reserva/repartir`, { usuario: SUP, permisos: PERM_SUPERVISOR_SOLO_VER, cuerpo: { tanda: 3, soloVistaPrevia: true } })).status === 403);
    // A gestionó todas las suyas; B (otra tienda) también, pero el supervisor no puede darle nada.
    await db.query("UPDATE proy_participaciones SET estado = 'en_gestion' WHERE proyecto_id = ? AND asesor_id IN (?)", [proyectoId, [A, B]], 'met:avance');
    r = await sup('GET', `/proyectos/${proyectoId}/reserva`);
    prueba('con el avance, los de su tienda con 80 % o más pasan a ser elegibles', r.datos.elegibles >= 1 && r.datos.asesores.find(a => a.asesorId === A).elegible === true && r.datos.asesores.find(a => a.asesorId === A).porcentaje === 100, JSON.stringify(r.datos.asesores));

    console.log('Rondas: repartir');
    const antesA = (await db.query('SELECT COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id = ?', [proyectoId, A], 'met:antesA'))[0].n;
    const avisosReparto = await notificaciones('reparto_recibido');
    r = await sup('POST', `/proyectos/${proyectoId}/reserva/repartir`, { tanda: 3, soloVistaPrevia: true });
    const previa = r.datos;
    prueba('la vista previa dice cuántas recibe cada asesor (hasta la tanda) y cuántas quedarían en reserva, sin cambiar nada', r.status === 200 && previa.vistaPrevia === true && previa.total > 0 && previa.porAsesor.every(x => x.recibe <= 3) && previa.porAsesor.every(x => asesoresT1.includes(x.asesorId)) && previa.enReservaDespues === reserva0 - previa.total
      && (await db.query('SELECT COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id IS NULL', [proyectoId], 'met:reserva_igual'))[0].n === reserva0, JSON.stringify(previa));
    prueba('la vista previa respeta la equidad: entre elegibles la diferencia no pasa de una empresa', Math.max(...previa.porAsesor.map(x => x.recibe)) - Math.min(...previa.porAsesor.map(x => x.recibe)) <= 1 || previa.porAsesor.length === 1);
    const k = clave();
    r = await sup('POST', `/proyectos/${proyectoId}/reserva/repartir`, { tanda: 3, idempotencyKey: k });
    prueba('repartir mueve las empresas de la reserva a los asesores (y lo dicho en la vista previa se cumple)', r.status === 200 && r.datos.repartidas === previa.total && r.datos.enReserva === previa.enReservaDespues && !r.datos.repetida, JSON.stringify(r.datos));
    const despuesA = (await db.query('SELECT COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id = ?', [proyectoId, A], 'met:despuesA'))[0].n;
    prueba('el asesor elegible recibió su parte, con su tienda y quién se la dio', despuesA - antesA === previa.porAsesor.find(x => x.asesorId === A).recibe && (await db.query('SELECT COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id = ? AND tienda_id = 1 AND asignada_por = ?', [proyectoId, A, SUP], 'met:entregadas'))[0].n >= 1);
    prueba('nadie de la otra tienda recibió nada (aunque había avanzado)', (await db.query('SELECT COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id IN (?) AND asignada_por IS NOT NULL', [proyectoId, asesoresT3], 'met:t3'))[0].n === 0);
    prueba('queda en el historial y se avisa a cada asesor que recibió', (await db.query("SELECT COUNT(*) AS n FROM proy_historial WHERE proyecto_id = ? AND accion = 'repartir_reserva'", [proyectoId], 'met:hist2'))[0].n === 1 && (await notificaciones('reparto_recibido')) === avisosReparto + previa.porAsesor.filter(x => x.asesorId !== SUP).length);
    r = await sup('POST', `/proyectos/${proyectoId}/reserva/repartir`, { tanda: 3, idempotencyKey: k });
    prueba('repetir la misma operación responde lo mismo y no reparte otra vez', r.status === 200 && r.datos.repetida === true && (await db.query('SELECT COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id IS NULL', [proyectoId], 'met:reserva_final'))[0].n === previa.enReservaDespues);
    r = await asesor(A, 'GET', '/mi-proyecto');
    prueba('el asesor ve sus empresas nuevas en Mi proyecto', r.datos.cifras.asignadas === despuesA, JSON.stringify(r.datos.cifras));
    // Otra tanda hasta vaciar la reserva (o hasta que ya nadie pueda recibir).
    let vueltas = 0;
    let ultimo = null;
    while (vueltas < 30) {
      vueltas += 1;
      await db.query("UPDATE proy_participaciones SET estado = 'en_gestion' WHERE proyecto_id = ? AND asesor_id IN (?)", [proyectoId, asesoresT1], 'met:avance2');
      ultimo = await sup('POST', `/proyectos/${proyectoId}/reserva/repartir`, { tanda: 50, idempotencyKey: clave() });
      if (ultimo.status !== 200) break;
    }
    prueba('al final la reserva se agota o el sistema dice por qué ya no se puede', ultimo.status === 409 && /(No hay empresas en reserva|Ninguna empresa)/.test(ultimo.datos.error), JSON.stringify(ultimo.datos));

    console.log('Proyecto cerrado');
    await db.query("UPDATE proy_proyectos SET estado = 'cerrado', cerrado_en = NOW() WHERE id = ?", [proyectoId], 'met:cerrar');
    await db.query('UPDATE proy_participaciones SET abierta = 0 WHERE proyecto_id = ?', [proyectoId], 'met:cerrar_partes');
    r = await sup('GET', `/proyectos/${proyectoId}/metas`);
    prueba('con el proyecto cerrado se ven las metas pero ya no se puede ajustar ni repartir (409)', r.status === 200 && r.datos.asesores.every(a => a.puedeAjustar === false)
      && (await sup('PUT', `/proyectos/${proyectoId}/metas/asesores/${A}`, { monto: 5 })).status === 409 && (await sup('POST', `/proyectos/${proyectoId}/reserva/repartir`, { tanda: 1, soloVistaPrevia: true })).status === 409);
  } finally {
    // Limpieza, pase lo que pase: nada de esta prueba debe quedar en la base.
    for (const id of [proyectoId].filter(Boolean)) {
      const part = '(SELECT id FROM proy_participaciones WHERE proyecto_id = ?)';
      for (const tabla of ['proy_gestiones', 'proy_entregas_muestra', 'proy_cotizaciones', 'proy_ventas', 'proy_reasignaciones']) {
        await db.query(`DELETE FROM ${tabla} WHERE participacion_id IN ${part}`, [id], `met:limpiar_${tabla}`);
      }
    }
    await db.query('DELETE FROM proy_proyectos WHERE creado_en >= ? AND creado_por = ?', [inicio, admin], 'met:limpiar_proyectos');
    await db.query("DELETE FROM proy_clientes WHERE nombre LIKE 'MET %'", [], 'met:limpiar_clientes');
    await db.query("DELETE FROM notificaciones WHERE modulo = 'proyectos' AND creado_en >= ?", [inicio], 'met:limpiar_notificaciones');
    await db.query("DELETE FROM idempotency_keys WHERE idempotency_key LIKE 'proy-%' AND creado_en >= ?", [inicio], 'met:limpiar_claves');
    await db.query('DELETE FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'met:limpiar_ajustes');
    for (const { clave: k, valor } of ajustesAntes) await db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?)', [k, valor], 'met:restaurar_ajuste');
    await db.query('DELETE FROM proy_config_historial WHERE creado_en >= ?', [inicio], 'met:limpiar_historial');
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
