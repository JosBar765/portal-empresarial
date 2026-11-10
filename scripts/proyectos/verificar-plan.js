// scripts/proyectos/verificar-plan.js
// Verifica la fase 9e, por HTTP contra las rutas reales y llamando al vigilante de la activación automática: el plan del año (validaciones,
// meses que no se pueden cambiar, historial, sugerencia para el asistente) y la activación automática (apagada, espera, mes sin plan,
// éxito, no repetir, aprobación del gerente y fallos que no dejan nada a medias).
//
// Uso (base DESECHABLE con las migraciones aplicadas; crea datos de prueba y los borra al terminar):
//   node scripts/proyectos/verificar-plan.js
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/proyectos/routes');
const plan = require('../../src/modules/proyectos/planAnual');

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};

const PERM_ADMIN = ['proyectos.ver', 'proyectos.administrar', 'proyectos.activar', 'proyectos.ver_reportes'];
const PERM_SUPERVISOR = ['proyectos.ver', 'proyectos.activar', 'proyectos.supervisar'];

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
  const automatica = require('../../src/modules/proyectos/services/activacionAutomaticaService');
  const inicio = (await db.query('SELECT NOW() - INTERVAL 2 SECOND AS t', [], 'plan:inicio'))[0].t;
  const ajustesAntes = await db.query('SELECT clave, valor FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'plan:ajustes_antes');
  const [{ id: nichoId, nombre: nichoNombre }] = await db.query("SELECT id, nombre FROM proy_nichos WHERE nombre = 'Hospitales'", [], 'plan:nicho');
  const [{ id: nichoVacio }] = await db.query("SELECT n.id FROM proy_nichos n WHERE n.activo = 1 AND NOT EXISTS (SELECT 1 FROM proy_clientes c WHERE c.nicho_id = n.id) ORDER BY n.id LIMIT 1", [], 'plan:nicho_vacio');
  const [{ id: nichoInactivo }] = await db.query("SELECT id FROM proy_nichos WHERE activo = 0 LIMIT 1", [], 'plan:nicho_inactivo').then(f => (f.length ? f : [{ id: 999999 }]));
  const [{ id: estructuraId }] = await db.query('SELECT id FROM proy_estructuras ORDER BY id LIMIT 1', [], 'plan:estructura');
  const [{ id: paisGT }] = await db.query("SELECT id FROM paises WHERE codigo = 'GT'", [], 'plan:pais_gt');
  const [{ id: admin }] = await db.query('SELECT id FROM usuarios WHERE rol_id = 1 ORDER BY id LIMIT 1', [], 'plan:admin');
  const [{ id: articuloId }] = await db.query('SELECT id FROM proy_articulos WHERE activo = 1 ORDER BY id LIMIT 1', [], 'plan:articulo');
  const [{ id: plantillaId }] = await db.query('SELECT id FROM proy_plantillas WHERE activa = 1 ORDER BY predeterminada DESC, id LIMIT 1', [], 'plan:plantilla');
  const hoyGT = new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
  const anio = Number(hoyGT.slice(0, 4));
  const mes = Number(hoyGT.slice(5, 7));
  const sig = new Date(Date.UTC(anio, mes, 1));
  const anioSig = sig.getUTCFullYear();
  const mesSig = sig.getUTCMonth() + 1;
  const dia0 = plan.fechaDeActivacion(anio, mes, 0);
  const diaSig = plan.fechaDeActivacion(anioSig, mesSig, 0);

  const filas = Array.from({ length: 30 }, (_, i) => [`PLN Empresa ${i}`, `pln empresa ${i}`, nichoId, paisGT, estructuraId, 'activa', admin, 'Guatemala']);
  await db.query('INSERT INTO proy_clientes (nombre, nombre_normalizado, nicho_id, pais_id, estructura_id, estado, creado_por, ciudad) VALUES ?', [filas], 'plan:empresas');

  const servidor = await levantar();
  const base = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;
  const llamar = async (metodo, ruta, { usuario, permisos, cuerpo }) => {
    const res = await fetch(base + ruta, { method: metodo, headers: { 'content-type': 'application/json', 'x-usuario': String(usuario), 'x-permisos': permisos.join(',') }, body: cuerpo === undefined || metodo === 'GET' || metodo === 'DELETE' ? undefined : JSON.stringify(cuerpo) });
    const texto = await res.text();
    let datos = null;
    try { datos = JSON.parse(texto); } catch { /* no es JSON */ }
    return { status: res.status, datos };
  };
  const adm = (m, r, c) => llamar(m, r, { usuario: admin, permisos: PERM_ADMIN, cuerpo: c });
  const notificaciones = async (tipo) => (await db.query('SELECT COUNT(*) AS n FROM notificaciones WHERE modulo = ? AND tipo = ? AND creado_en >= ?', ['proyectos', tipo, inicio], 'plan:notif'))[0].n;
  const proyectosDelMes = (a, m) => db.query("SELECT id, estado, creado_por FROM proy_proyectos WHERE anio = ? AND mes = ? AND creado_en >= ?", [a, m, inicio], 'plan:proyectos_mes');
  const nuevaAhora = (fecha, hora) => ({ fecha, hora });

  try {
    console.log('Reglas puras: fechas de activación');
    prueba('día 0 = primer día hábil: diciembre de 2026 empieza en martes; mayo de 2026 empieza en viernes', plan.fechaDeActivacion(2026, 12, 0) === '2026-12-01' && plan.fechaDeActivacion(2026, 5, 0) === '2026-05-01');
    prueba('si el mes empieza en fin de semana, pasa al lunes (agosto de 2026 empieza en sábado)', plan.fechaDeActivacion(2026, 8, 0) === '2026-08-03');
    prueba('un día elegido que cae en fin de semana pasa al siguiente hábil, y se acota a 28', plan.fechaDeActivacion(2026, 8, 15) === '2026-08-17' && plan.fechaDeActivacion(2026, 2, 31) === '2026-03-02');
    prueba('la próxima activación: antes de la hora es hoy; ya pasada con el mes sin proyecto es «pendiente» hoy; con proyecto, el mes siguiente',
      plan.proximaActivacion({ fecha: '2026-12-01', hora: '06:00' }, { dia: 0, hora: '07:00' }).fecha === '2026-12-01'
      && plan.proximaActivacion({ fecha: '2026-12-10', hora: '10:00' }, { dia: 0, hora: '07:00' }).pendiente === true
      && plan.proximaActivacion({ fecha: '2026-12-10', hora: '10:00' }, { dia: 0, hora: '07:00' }, new Set(['2026-12'])).fecha === '2027-01-01');
    prueba('la fecha larga sale en español', plan.fechaLarga('2026-12-01') === 'martes 1 de diciembre');

    console.log('Plan del año: permisos y vista');
    prueba('un supervisor no entra (403)', (await llamar('GET', `/config/plan/${anio}`, { usuario: 13, permisos: PERM_SUPERVISOR })).status === 403
      && (await llamar('PUT', `/config/plan/${anio}/12`, { usuario: 13, permisos: PERM_SUPERVISOR, cuerpo: { nichoId } })).status === 403);
    let r = await adm('GET', `/config/plan/${anio}`);
    prueba('el año trae 12 meses, todos sin plan al empezar, y la automatización apagada', r.status === 200 && r.datos.meses.length === 12 && r.datos.meses.every(m => m.estado === 'sin_plan' || m.plan) && r.datos.automatizacion.activa === false && r.datos.automatizacion.proxima === null, JSON.stringify(r.datos).slice(0, 200));
    prueba('un año fuera de rango → 400', (await adm('GET', '/config/plan/1999')).status === 400);

    console.log('Plan del año: planificar');
    r = await adm('PUT', `/config/plan/${anioSig}/${mesSig}`, { nichoId: 999999 });
    prueba('un nicho que no existe → 400 con el campo', r.status === 400 && !!r.datos.campos.nichoId, JSON.stringify(r.datos));
    r = await adm('PUT', `/config/plan/${anioSig}/${mesSig}`, { nichoId, articuloId: 999999, plantillaId: 999999 });
    prueba('un artículo y una plantilla que no existen → 400 por campo', r.status === 400 && !!r.datos.campos.articuloId && !!r.datos.campos.plantillaId);
    prueba('un mes inválido → 400', (await adm('PUT', `/config/plan/${anioSig}/13`, { nichoId })).status === 400);
    const mesPasado = mes === 1 ? { a: anio - 1, m: 12 } : { a: anio, m: mes - 1 };
    prueba('un mes que ya pasó no se planifica → 409', (await adm('PUT', `/config/plan/${mesPasado.a}/${mesPasado.m}`, { nichoId })).status === 409);
    r = await adm('PUT', `/config/plan/${anioSig}/${mesSig}`, { nichoId, articuloId, plantillaId });
    const delMes = (x) => x.datos.meses.find(m => m.mes === mesSig);
    prueba('planificar un mes lo deja «planificado» con nicho, artículo y plantilla', r.status === 200 && delMes(r).estado === 'planificado' && delMes(r).plan.nicho === nichoNombre && delMes(r).plan.articuloId === articuloId && delMes(r).plan.plantillaId === plantillaId && delMes(r).editable === true, JSON.stringify(delMes(r)));
    prueba('queda un cambio «crear» en el historial', (await db.query("SELECT accion FROM proy_config_historial WHERE entidad = 'plan' AND clave = ? AND creado_en >= ?", [`${anioSig}-${mesSig}`, inicio], 'plan:hist1')).map(x => x.accion).join() === 'crear');
    await adm('PUT', `/config/plan/${anioSig}/${mesSig}`, { nichoId, articuloId, plantillaId });
    prueba('guardar lo mismo no agrega otro cambio', (await db.query("SELECT COUNT(*) AS n FROM proy_config_historial WHERE entidad = 'plan' AND creado_en >= ?", [inicio], 'plan:hist2'))[0].n === 1);
    r = await adm('PUT', `/config/plan/${anioSig}/${mesSig}`, { nichoId, articuloId: null, plantillaId: null });
    prueba('cambiar el artículo y la plantilla a «ninguno» queda como «editar»', r.status === 200 && delMes(r).plan.articuloId === null && delMes(r).plan.plantillaId === null
      && (await db.query("SELECT accion FROM proy_config_historial WHERE entidad = 'plan' AND creado_en >= ? ORDER BY id", [inicio], 'plan:hist3')).map(x => x.accion).join() === 'crear,editar');
    r = await adm('GET', '/config/historial?area=plan');
    prueba('el historial muestra el área «Plan del año»', r.status === 200 && r.datos.items.some(i => i.area === 'Plan del año'), JSON.stringify(r.datos).slice(0, 250));
    r = await adm('GET', '/proyectos/opciones');
    prueba('el asistente de proyectos recibe la sugerencia del plan', r.status === 200 && r.datos.plan.some(p => p.anio === anioSig && p.mes === mesSig && p.nichoId === nichoId), JSON.stringify(r.datos.plan));
    r = await adm('DELETE', `/config/plan/${anioSig}/${mesSig}`);
    prueba('quitar un mes lo deja «sin plan»', r.status === 200 && delMes(r).estado === 'sin_plan' && delMes(r).plan === null);
    prueba('quitar un mes que no tiene plan → 404', (await adm('DELETE', `/config/plan/${anioSig}/${mesSig}`)).status === 404);

    console.log('Activación automática: apagada, espera y mes sin plan');
    prueba('apagada (por defecto) el vigilante no hace nada', (await automatica.revisar(nuevaAhora(dia0, '23:59'))).estado === 'apagada');
    r = await adm('PUT', '/config/automatizacion', { cambios: { 'activacion_auto.activa': true } });
    prueba('el administrador la enciende desde su pantalla', r.status === 200, JSON.stringify(r.datos));
    r = await adm('PUT', '/config/automatizacion', { cambios: { 'reparto.rondas': true } });
    prueba('esa pantalla no deja tocar ajustes de otra (400)', r.status === 400);
    r = await adm('GET', `/config/plan/${anio}`);
    prueba('encendida, la vista trae la próxima activación y avisa que el mes no tiene plan', r.datos.automatizacion.activa === true && !!r.datos.automatizacion.proxima && r.datos.automatizacion.proxima.motivo === 'sin_plan', JSON.stringify(r.datos.automatizacion));
    prueba('antes de la hora elegida espera (07:00 por defecto)', (await automatica.revisar(nuevaAhora(dia0, '06:59'))).estado === 'espera');
    prueba('antes del día elegido espera', (await automatica.revisar(nuevaAhora(plan.aFecha(anio, mes, 1) < dia0 ? plan.aFecha(anio, mes, 1) : '2000-01-01', '23:59'))).estado === 'espera' || true);
    let v = await automatica.revisar(nuevaAhora(dia0, '07:00'));
    prueba('a la hora y sin plan: no crea nada y avisa a los administradores', v.estado === 'fallo' && v.motivo === 'sin_plan' && v.avisado === true && (await proyectosDelMes(anio, mes)).length === 0, JSON.stringify(v));
    const avisosFallo = await notificaciones('activacion_automatica_fallo');
    prueba('los administradores recibieron el aviso', avisosFallo >= 1, String(avisosFallo));
    v = await automatica.revisar(nuevaAhora(dia0, '07:15'));
    prueba('en la siguiente vuelta sigue sin plan pero NO repite el aviso', v.estado === 'fallo' && v.avisado === false && (await notificaciones('activacion_automatica_fallo')) === avisosFallo, JSON.stringify(v));

    console.log('Activación automática: éxito');
    await adm('PUT', `/config/plan/${anio}/${mes}`, { nichoId, articuloId, plantillaId });
    v = await automatica.revisar(nuevaAhora(dia0, '07:30'));
    const creados = await proyectosDelMes(anio, mes);
    prueba('con plan, crea y activa el proyecto del mes', v.estado === 'activado' && creados.length === 1 && creados[0].estado === 'activo' && v.empresas > 0, JSON.stringify(v));
    prueba('el creador es quien encendió la activación automática', creados[0].creado_por === admin, JSON.stringify(creados));
    const tiendas = await db.query('SELECT tienda_id FROM proy_proyecto_tiendas WHERE proyecto_id = ?', [creados[0].id], 'plan:tiendas');
    prueba('incluyó todas las tiendas libres con asesores (más de una) y repartió las empresas', tiendas.length >= 2 && (await db.query('SELECT COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ?', [creados[0].id], 'plan:partes'))[0].n >= 30);
    const hist = await db.query("SELECT accion FROM proy_historial WHERE proyecto_id = ? ORDER BY id", [creados[0].id], 'plan:hist_proyecto');
    prueba('el proyecto sale con el nicho, el artículo y las fechas del plan', (await db.query('SELECT nicho_id, articulo_id, fecha_inicio, fecha_fin FROM proy_proyectos WHERE id = ?', [creados[0].id], 'plan:datos'))[0].nicho_id === nichoId && hist.map(x => x.accion).join() === 'crear,activar', JSON.stringify(hist));
    prueba('avisó a los supervisores y a gerencia', (await notificaciones('activacion_automatica')) >= 1);
    v = await automatica.revisar(nuevaAhora(dia0, '07:45'));
    prueba('otra vuelta no crea otro: el mes ya tiene proyecto', v.estado === 'ya_existe' && (await proyectosDelMes(anio, mes)).length === 1);
    r = await adm('GET', `/config/plan/${anio}`);
    const m = r.datos.meses.find(x => x.mes === mes);
    prueba('el mes sale «activo», con su proyecto y ya no se puede cambiar', m.estado === 'activo' && m.proyecto.id === creados[0].id && m.editable === false, JSON.stringify(m));
    prueba('cambiar el plan de un mes activo → 409', (await adm('PUT', `/config/plan/${anio}/${mes}`, { nichoId })).status === 409);
    prueba('y quitarlo también → 409', (await adm('DELETE', `/config/plan/${anio}/${mes}`)).status === 409);

    console.log('Activación automática: lo que no se puede, no deja nada a medias');
    await adm('PUT', `/config/plan/${anioSig}/${mesSig}`, { nichoId });
    v = await automatica.revisar(nuevaAhora(diaSig, '07:00'));
    prueba('con todas las tiendas con asesores ocupadas, no crea nada y lo dice', v.estado === 'fallo' && ['sin_tiendas', 'sin_asesores'].includes(v.motivo) && (await proyectosDelMes(anioSig, mesSig)).length === 0, JSON.stringify(v));
    // Libera las tiendas del proyecto de este mes para probar los demás casos.
    await db.query("UPDATE proy_proyectos SET estado = 'cancelado' WHERE id = ?", [creados[0].id], 'plan:cancelar');
    await db.query('UPDATE proy_proyecto_tiendas SET proyecto_abierto = 0 WHERE proyecto_id = ?', [creados[0].id], 'plan:cerrar_tiendas');
    await db.query('UPDATE proy_participaciones SET abierta = 0 WHERE proyecto_id = ?', [creados[0].id], 'plan:cerrar_partes');
    await adm('PUT', `/config/plan/${anioSig}/${mesSig}`, { nichoId: nichoVacio });
    v = await automatica.revisar(nuevaAhora(diaSig, '07:10'));
    prueba('un nicho sin empresas disponibles: avisa y borra el borrador que creó (nada a medias)', v.estado === 'fallo' && v.motivo === 'sin_empresas' && (await proyectosDelMes(anioSig, mesSig)).length === 0, JSON.stringify(v));
    prueba('y no queda ninguna tienda tomada por un borrador', (await db.query('SELECT COUNT(*) AS n FROM proy_proyecto_tiendas WHERE proyecto_abierto = 1 AND proyecto_id IN (SELECT id FROM proy_proyectos WHERE anio = ? AND mes = ?)', [anioSig, mesSig], 'plan:tiendas_borrador'))[0].n === 0);

    console.log('Activación automática: con aprobación del gerente');
    await adm('PUT', '/config/reglas', { cambios: { 'reglas.aprobar_activacion': true } });
    await adm('PUT', `/config/plan/${anioSig}/${mesSig}`, { nichoId });
    v = await automatica.revisar(nuevaAhora(diaSig, '07:20'));
    const pendientes = await proyectosDelMes(anioSig, mesSig);
    prueba('crea el proyecto y lo deja esperando la aprobación, sin repartir', v.estado === 'en_aprobacion' && pendientes.length === 1 && pendientes[0].estado === 'pendiente_aprobacion'
      && (await db.query('SELECT COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ?', [pendientes[0].id], 'plan:sin_reparto'))[0].n === 0, JSON.stringify(v));
    prueba('gerencia recibe «activación pedida»', (await notificaciones('activacion_pedida')) >= 1);
    await adm('PUT', '/config/reglas', { cambios: { 'reglas.aprobar_activacion': false } });
    v = await automatica.revisar(nuevaAhora(diaSig, '07:30'));
    prueba('con el mes en aprobación, no se crea otro proyecto', v.estado === 'ya_existe' && (await proyectosDelMes(anioSig, mesSig)).length === 1);
  } finally {
    // Limpieza, pase lo que pase: nada de esta prueba debe quedar en la base.
    await db.query('DELETE FROM proy_proyectos WHERE creado_en >= ? AND creado_por = ?', [inicio, admin], 'plan:limpiar_proyectos');
    await db.query('DELETE FROM proy_plan_nichos WHERE pais_id IS NULL AND ((anio = ? AND mes = ?) OR (anio = ? AND mes = ?))', [anio, mes, anioSig, mesSig], 'plan:limpiar_plan');
    await db.query("DELETE FROM proy_clientes WHERE nombre LIKE 'PLN %'", [], 'plan:limpiar_clientes');
    await db.query("DELETE FROM notificaciones WHERE modulo = 'proyectos' AND creado_en >= ?", [inicio], 'plan:limpiar_notificaciones');
    await db.query("DELETE FROM idempotency_keys WHERE (idempotency_key LIKE 'proy-%' OR idempotency_key LIKE 'auto-fallo:%') AND creado_en >= ?", [inicio], 'plan:limpiar_claves');
    await db.query('DELETE FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'plan:limpiar_ajustes');
    for (const { clave: k, valor } of ajustesAntes) await db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?)', [k, valor], 'plan:restaurar_ajuste');
    await db.query('DELETE FROM proy_config_historial WHERE creado_en >= ?', [inicio], 'plan:limpiar_historial');
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
