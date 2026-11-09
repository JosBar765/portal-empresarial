// scripts/proyectos/verificar-gestion.js
// Verifica el trabajo del asesor (fase 4a), por HTTP contra las rutas reales: estado derivado que solo sube, gestiones con
// próxima fecha, muestras con existencias (incluidas dos entregas a la vez), cotizaciones y ventas con referencia y moneda por
// país, OV repetida, venta por confirmar, perdida y descartada, «Para hoy», listas de 50 en 50 y que nadie lea ni escriba
// participaciones ajenas ni de proyectos cerrados.
//
// Uso (base DESECHABLE con las migraciones aplicadas; crea datos de prueba y los borra al terminar):
//   node scripts/proyectos/verificar-gestion.js
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/proyectos/routes');
const { derivar } = require('../../src/modules/proyectos/estadoParticipacion');

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};

const PERM_SUPERVISOR = ['proyectos.ver', 'proyectos.activar'];
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

const dia = (desfase) => new Date(Date.now() - 6 * 3600 * 1000 + desfase * 86400000).toISOString().slice(0, 10);

async function verificar() {
  const configService = require('../../src/modules/proyectos/services/configService');
  const inicio = (await db.query('SELECT NOW() - INTERVAL 2 SECOND AS t', [], 'ges:inicio'))[0].t;
  const ajustesAntes = await db.query('SELECT clave, valor FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'ges:ajustes_antes');
  const [{ id: nichoId }] = await db.query("SELECT id FROM proy_nichos WHERE nombre = 'Hospitales'", [], 'ges:nicho');
  const [{ id: estructuraId }] = await db.query('SELECT id FROM proy_estructuras ORDER BY id LIMIT 1', [], 'ges:estructura');
  const [{ id: paisGT }] = await db.query("SELECT id FROM paises WHERE codigo = 'GT'", [], 'ges:pais');
  const [{ id: admin }] = await db.query('SELECT id FROM usuarios WHERE rol_id = 1 ORDER BY id LIMIT 1', [], 'ges:admin');
  const [{ id: articulo }] = await db.query('SELECT id FROM proy_articulos WHERE activo = 1 ORDER BY id LIMIT 1', [], 'ges:articulo');
  const paisAntes = (await db.query('SELECT moneda_codigo, referencia_obligatoria, confirmacion_ventas FROM proy_pais_config WHERE pais_id = ?', [paisGT], 'ges:pais_antes'))[0];
  const resultado = async (nombre) => (await db.query('SELECT id FROM proy_resultados_gestion WHERE nombre = ?', [nombre], 'ges:resultado'))[0].id;
  const rSinRespuesta = await resultado('Sin respuesta');
  const rPideCotizacion = await resultado('Pide cotización');
  const rNoInteresa = await resultado('No le interesa por ahora');
  const [{ id: canal }] = await db.query("SELECT id FROM proy_canales WHERE nombre = 'Llamada'", [], 'ges:canal');
  const [{ id: motivo }] = await db.query('SELECT id FROM proy_motivos_perdida WHERE activo = 1 ORDER BY id LIMIT 1', [], 'ges:motivo');
  const [{ id: area }] = await db.query('SELECT id FROM proy_areas_contacto WHERE activo = 1 ORDER BY id LIMIT 1', [], 'ges:area');
  const SUP = 13;

  console.log('Estado derivado (función pura)');
  prueba('sin nada registrado: pendiente', derivar({}) === 'pendiente');
  prueba('una gestión: en gestión', derivar({ gestiones: 1 }) === 'en_gestion');
  prueba('un resultado de interés: interesada', derivar({ gestiones: 1, interesadas: 1 }) === 'interesada');
  prueba('una cotización: cotizada, aunque no haya gestiones', derivar({ cotizaciones: 1 }) === 'cotizada');
  prueba('una venta confirmada: vendida', derivar({ gestiones: 3, cotizaciones: 1, ventasConfirmadas: 1 }) === 'vendida');
  prueba('perdida y descartada mandan sobre lo derivado', derivar({ ventasConfirmadas: 1 }, 'perdida') === 'perdida' && derivar({ gestiones: 2 }, 'descartada') === 'descartada');
  prueba('lo anulado no cuenta: sin cotizaciones vigentes vuelve a interesada', derivar({ gestiones: 2, interesadas: 1, cotizaciones: 0 }) === 'interesada');

  await db.query('INSERT INTO proy_clientes (nombre, nombre_normalizado, nicho_id, pais_id, estructura_id, estado, creado_por) VALUES ?',
    [Array.from({ length: 60 }, (_, i) => [`GES Hospital ${i}`, `ges hospital ${i}`, nichoId, paisGT, estructuraId, 'activa', admin])], 'ges:empresas');

  const servidor = await levantar();
  const base = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;
  const llamar = async (metodo, ruta, { usuario, permisos, cuerpo }) => {
    const res = await fetch(base + ruta, { method: metodo, headers: { 'content-type': 'application/json', 'x-usuario': String(usuario), 'x-permisos': permisos.join(',') }, body: cuerpo === undefined || metodo === 'GET' ? undefined : JSON.stringify(cuerpo) });
    return { status: res.status, datos: await res.json().catch(() => null) };
  };
  const sup = (metodo, ruta, cuerpo) => llamar(metodo, ruta, { usuario: SUP, permisos: PERM_SUPERVISOR, cuerpo });
  const clave = () => `ges-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  let proyectoId = null;

  try {
    console.log('Preparación: un proyecto activo con 60 empresas');
    let r = await sup('POST', '/proyectos', { nichoId, anio: 2026, mes: 11, tiendaIds: [1], fechaInicio: '2026-11-02', fechaFin: '2026-11-27', articuloId: articulo, existenciaMuestras: 5, topePorAsesor: 100 });
    proyectoId = r.datos && r.datos.id;
    r = await sup('POST', `/proyectos/${proyectoId}/activar`, { idempotencyKey: clave() });
    prueba('el proyecto se activa y reparte las 60 empresas', r.status === 200 && r.datos.estado === 'activo' && r.datos.empresas === 60, JSON.stringify(r.datos));
    const asesores = (await db.query('SELECT asesor_id, COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id IS NOT NULL GROUP BY asesor_id ORDER BY asesor_id', [proyectoId], 'ges:asesores'));
    const A = asesores[0].asesor_id; const B = asesores[1].asesor_id;
    const propias = async (u) => (await db.query('SELECT id FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id = ? ORDER BY id', [proyectoId, u], 'ges:propias')).map(x => x.id);
    const [a1, a2, a3, a4, a5, a6, a7, a8, a9, a10] = await propias(A);
    const [b1] = await propias(B);
    const asesor = (metodo, ruta, cuerpo, usuario = A) => llamar(metodo, ruta, { usuario, permisos: PERM_ASESOR, cuerpo });
    const filaDe = async (id) => (await db.query('SELECT * FROM proy_participaciones WHERE id = ?', [id], 'ges:fila'))[0];
    const cuenta = async (tabla, id) => Number((await db.query(`SELECT COUNT(*) AS n FROM ${tabla} WHERE participacion_id = ?`, [id], 'ges:cuenta'))[0].n);
    const existencia = async () => (await db.query('SELECT existencia_muestras AS n FROM proy_proyectos WHERE id = ?', [proyectoId], 'ges:existencia'))[0].n;

    console.log('Permisos y alcance');
    prueba('sin proyectos.gestionar no se abre Mi proyecto (403)', (await llamar('GET', '/mi-proyecto', { usuario: SUP, permisos: PERM_SUPERVISOR })).status === 403);
    r = await asesor('GET', '/mi-proyecto');
    prueba('el asesor ve su proyecto con SUS cifras', r.status === 200 && r.datos.proyecto.id === proyectoId && r.datos.cifras.asignadas === asesores[0].n && r.datos.cifras.gestionadas === 0 && r.datos.cifras.efectividad === 0, JSON.stringify(r.datos));
    prueba('Mi proyecto trae la muestra restante', r.datos.muestra && r.datos.muestra.quedan === 5 && r.datos.muestra.total === 5 && Array.isArray(r.datos.etapas), JSON.stringify(r.datos.muestra));
    r = await asesor('GET', '/participaciones');
    prueba('su lista trae solo sus empresas', r.status === 200 && r.datos.total === asesores[0].n && r.datos.empresas.every(e => !e.id || !([b1].includes(e.id))), JSON.stringify(r.datos.total));
    r = await asesor('GET', `/participaciones/${b1}`);
    prueba('la ficha de una empresa de OTRO asesor responde 404', r.status === 404);
    r = await asesor('POST', `/participaciones/${b1}/gestiones`, { canalId: canal, resultadoId: rPideCotizacion, idempotencyKey: clave() });
    prueba('registrar una gestión en la empresa de otro asesor responde 404 y no escribe nada', r.status === 404 && (await cuenta('proy_gestiones', b1)) === 0);
    prueba('cotizar, vender, perder y descartar lo ajeno también responde 404', (await Promise.all([
      asesor('POST', `/participaciones/${b1}/cotizaciones`, { monto: 100, referencia: 'COT-1', idempotencyKey: clave() }),
      asesor('POST', `/participaciones/${b1}/ventas`, { monto: 100, referencia: 'OV-1', idempotencyKey: clave() }),
      asesor('POST', `/participaciones/${b1}/perdida`, { motivoId: motivo, idempotencyKey: clave() }),
      asesor('POST', `/participaciones/${b1}/descartar`, { motivo: 'x', idempotencyKey: clave() })
    ])).every(x => x.status === 404));
    prueba('una empresa que no existe responde 404', (await asesor('GET', '/participaciones/99999999')).status === 404);
    r = await asesor('GET', '/participaciones/opciones');
    prueba('las opciones traen canales, resultados, motivos y monedas', r.status === 200 && r.datos.canales.length >= 4 && r.datos.resultados.length >= 8 && r.datos.motivos.length >= 1 && r.datos.monedas.some(m => m.codigo === 'USD'));

    console.log('Gestiones y estado');
    r = await asesor('POST', `/participaciones/${a1}/gestiones`, { canalId: canal, resultadoId: rSinRespuesta });
    prueba('sin clave de operación → 400', r.status === 400);
    r = await asesor('POST', `/participaciones/${a1}/gestiones`, { resultadoId: 0, idempotencyKey: clave() });
    prueba('sin canal ni resultado → 400 con los campos marcados', r.status === 400 && r.datos.campos.canalId && r.datos.campos.resultadoId, JSON.stringify(r.datos));
    r = await asesor('POST', `/participaciones/${a1}/gestiones`, { canalId: canal, resultadoId: rSinRespuesta, idempotencyKey: clave() });
    prueba('un resultado que exige próximo seguimiento no se guarda sin fecha → 400', r.status === 400 && !!r.datos.campos.proximaEn && (await cuenta('proy_gestiones', a1)) === 0, JSON.stringify(r.datos));
    r = await asesor('POST', `/participaciones/${a1}/gestiones`, { canalId: canal, resultadoId: rSinRespuesta, proximaEn: dia(-1), idempotencyKey: clave() });
    prueba('el seguimiento en una fecha pasada → 400', r.status === 400 && !!r.datos.campos.proximaEn);
    r = await asesor('POST', `/participaciones/${a1}/gestiones`, { canalId: canal, resultadoId: rSinRespuesta, contactoId: 99999999, proximaEn: dia(1), idempotencyKey: clave() });
    prueba('un contacto que no es de la empresa → 400', r.status === 400 && !!r.datos.campos.contactoId);
    const k1 = clave();
    r = await asesor('POST', `/participaciones/${a1}/gestiones`, { canalId: canal, resultadoId: rSinRespuesta, nota: 'No contestó', proximaEn: dia(1), idempotencyKey: k1 });
    prueba('la primera gestión pasa la empresa a «en gestión» y fija el seguimiento', r.status === 201 && r.datos.estado === 'en_gestion' && String(r.datos.proximaGestion).startsWith(dia(1)) && r.datos.repetida === false && r.datos.historial[0].tipo === 'gestion', JSON.stringify(r.datos));
    r = await asesor('POST', `/participaciones/${a1}/gestiones`, { canalId: canal, resultadoId: rSinRespuesta, nota: 'No contestó', proximaEn: dia(1), idempotencyKey: k1 });
    prueba('repetir la misma clave no duplica la gestión', r.status === 201 && r.datos.repetida === true && (await cuenta('proy_gestiones', a1)) === 1);
    r = await asesor('POST', `/participaciones/${a1}/gestiones`, { canalId: canal, resultadoId: rPideCotizacion, idempotencyKey: clave() });
    prueba('un resultado de interés → «interesada»; sin fecha nueva se despeja el seguimiento', r.datos.estado === 'interesada' && r.datos.proximaGestion === null, JSON.stringify(r.datos));
    r = await asesor('POST', `/participaciones/${a1}/gestiones`, { canalId: canal, resultadoId: rNoInteresa, idempotencyKey: clave() });
    prueba('una gestión posterior sin interés NO baja el estado', r.datos.estado === 'interesada');

    console.log('Muestras y existencias');
    r = await asesor('POST', `/participaciones/${a2}/gestiones`, { canalId: canal, resultadoId: rPideCotizacion, muestra: { cantidad: 3, areaId: area }, idempotencyKey: clave() });
    prueba('entregar 3 muestras baja la existencia de 5 a 2 y deja la entrega registrada', r.status === 201 && (await existencia()) === 2 && (await cuenta('proy_entregas_muestra', a2)) === 1 && r.datos.historial.some(h => h.tipo === 'muestra' && h.cantidad === 3), JSON.stringify(r.datos));
    r = await asesor('POST', `/participaciones/${a3}/gestiones`, { canalId: canal, resultadoId: rPideCotizacion, muestra: { cantidad: 10 }, idempotencyKey: clave() });
    prueba('entregar más de las que quedan → 409 claro, sin tocar la existencia ni guardar la gestión', r.status === 409 && /Solo quedan 2/.test(r.datos.error) && (await existencia()) === 2 && (await cuenta('proy_gestiones', a3)) === 0, JSON.stringify(r.datos));
    r = await Promise.all([
      asesor('POST', `/participaciones/${a3}/gestiones`, { canalId: canal, resultadoId: rPideCotizacion, muestra: { cantidad: 2 }, idempotencyKey: clave() }),
      asesor('POST', `/participaciones/${a4}/gestiones`, { canalId: canal, resultadoId: rPideCotizacion, muestra: { cantidad: 2 }, idempotencyKey: clave() })
    ]);
    prueba('dos entregas a la vez de las últimas 2: una pasa y la otra se rechaza (nunca negativo)', r.map(x => x.status).sort().join() === '201,409' && (await existencia()) === 0, r.map(x => x.status).join());
    r = await asesor('GET', '/mi-proyecto');
    prueba('Mi proyecto muestra «quedan 0 de 5»', r.datos.muestra.quedan === 0 && r.datos.muestra.total === 5);

    console.log('Cotizaciones y ventas');
    r = await asesor('POST', `/participaciones/${a1}/cotizaciones`, { monto: 12500, idempotencyKey: clave() });
    prueba('sin referencia no se guarda la cotización (obligatoria por país) → 400', r.status === 400 && !!r.datos.campos.referencia && (await cuenta('proy_cotizaciones', a1)) === 0);
    r = await asesor('POST', `/participaciones/${a1}/cotizaciones`, { monto: 0, referencia: 'COT-1', idempotencyKey: clave() });
    prueba('un monto de cero → 400', r.status === 400 && !!r.datos.campos.monto);
    r = await asesor('POST', `/participaciones/${a1}/cotizaciones`, { monto: 100.555, referencia: 'COT-1', idempotencyKey: clave() });
    prueba('más de dos decimales → 400', r.status === 400 && !!r.datos.campos.monto);
    r = await asesor('POST', `/participaciones/${a1}/cotizaciones`, { monto: 100, moneda: 'EUR', referencia: 'COT-1', idempotencyKey: clave() });
    prueba('una moneda que no es la local ni dólares → 400', r.status === 400 && !!r.datos.campos.moneda);
    r = await asesor('POST', `/participaciones/${a1}/cotizaciones`, { monto: 12500, referencia: 'COT-1180', idempotencyKey: clave() });
    prueba('la cotización queda en la moneda local (GTQ) y la empresa pasa a «cotizada»', r.status === 201 && r.datos.estado === 'cotizada' && r.datos.historial[0].moneda === 'GTQ' && r.datos.historial[0].monto === 12500, JSON.stringify(r.datos.historial[0]));
    const kv = clave();
    r = await asesor('POST', `/participaciones/${a1}/ventas`, { monto: 11800, referencia: 'OV-5231', idempotencyKey: kv });
    prueba('la venta confirmada pasa la empresa a «vendida»', r.status === 201 && r.datos.estado === 'vendida' && r.datos.historial[0].estadoVenta === 'confirmada', JSON.stringify(r.datos));
    r = await asesor('POST', `/participaciones/${a1}/ventas`, { monto: 11800, referencia: 'OV-5231', idempotencyKey: kv });
    prueba('repetir la clave de la venta no duplica nada', r.datos.repetida === true && (await cuenta('proy_ventas', a1)) === 1);
    r = await asesor('POST', `/participaciones/${a5}/ventas`, { monto: 500, idempotencyKey: clave() });
    prueba('una venta sin número de orden no se guarda → 400', r.status === 400 && !!r.datos.campos.referencia && (await cuenta('proy_ventas', a5)) === 0);
    r = await asesor('POST', `/participaciones/${a5}/ventas`, { monto: 500, referencia: 'OV-5231', idempotencyKey: clave() });
    prueba('una OV ya usada en otra venta avisa (409 REFERENCIA_REPETIDA) con la empresa que la tiene y no guarda', r.status === 409 && r.datos.codigo === 'REFERENCIA_REPETIDA' && r.datos.detalle.cliente.startsWith('GES Hospital') && (await cuenta('proy_ventas', a5)) === 0, JSON.stringify(r.datos));
    r = await asesor('POST', `/participaciones/${a5}/ventas`, { monto: 500, referencia: 'OV-5231', confirmarReferenciaRepetida: true, idempotencyKey: clave() });
    prueba('con la casilla «es la misma orden para varias empresas» sí se guarda', r.status === 201 && r.datos.estado === 'vendida');
    r = await asesor('GET', '/mi-proyecto');
    prueba('las cifras suman lo acumulado: cotizadas 1 o más y 2 vendidas', r.datos.cifras.vendidas === 2 && r.datos.cifras.cotizadas >= 2 && r.datos.cifras.interesadas >= 2, JSON.stringify(r.datos.cifras));

    console.log('Moneda y referencia por país, venta por confirmar');
    await db.query('UPDATE proy_pais_config SET moneda_codigo = NULL WHERE pais_id = ?', [paisGT], 'ges:sin_moneda');
    r = await asesor('POST', `/participaciones/${a6}/cotizaciones`, { monto: 900, referencia: 'COT-9', idempotencyKey: clave() });
    prueba('un país sin moneda local cotiza en dólares por defecto', r.status === 201 && r.datos.historial[0].moneda === 'USD', JSON.stringify(r.datos.historial[0]));
    r = await asesor('POST', `/participaciones/${a6}/cotizaciones`, { monto: 900, moneda: 'GTQ', referencia: 'COT-10', idempotencyKey: clave() });
    prueba('…y no acepta una moneda local que no tiene', r.status === 400 && !!r.datos.campos.moneda);
    r = await asesor('GET', `/participaciones/${a6}`);
    prueba('la ficha dice qué moneda usar por defecto', r.datos.registro.monedaPorDefecto === 'USD' && r.datos.registro.monedaLocal === null);
    await db.query('UPDATE proy_pais_config SET moneda_codigo = ?, referencia_obligatoria = 0 WHERE pais_id = ?', [paisAntes.moneda_codigo, paisGT], 'ges:referencia_opcional');
    r = await asesor('POST', `/participaciones/${a7}/cotizaciones`, { monto: 300, idempotencyKey: clave() });
    prueba('con la referencia opcional en el país, la cotización se guarda sin número', r.status === 201 && r.datos.historial[0].referencia === null);
    await db.query('UPDATE proy_pais_config SET referencia_obligatoria = 1 WHERE pais_id = ?', [paisGT], 'ges:referencia_obligatoria');
    await configService.guardar({ 'reglas.confirmar_ventas': true }, admin);
    r = await asesor('POST', `/participaciones/${a7}/ventas`, { monto: 300, referencia: 'OV-7000', idempotencyKey: clave() });
    prueba('con la confirmación de ventas encendida la venta queda «por confirmar» y la empresa NO pasa a vendida', r.status === 201 && r.datos.historial[0].estadoVenta === 'por_confirmar' && r.datos.estado === 'cotizada', JSON.stringify(r.datos));
    r = await asesor('GET', '/mi-proyecto');
    prueba('esa venta no cuenta en las cifras todavía', r.datos.cifras.vendidas === 2);
    await configService.guardar({ 'reglas.confirmar_ventas': false }, admin);

    console.log('Perdida y descartada');
    r = await asesor('POST', `/participaciones/${a8}/perdida`, { idempotencyKey: clave() });
    prueba('marcar como perdida sin motivo → 400', r.status === 400 && !!r.datos.campos.motivoId);
    r = await asesor('POST', `/participaciones/${a8}/perdida`, { motivoId: motivo, idempotencyKey: clave() });
    prueba('perdida con motivo: queda «perdida», sin seguimiento y con el motivo guardado', r.status === 200 && r.datos.estado === 'perdida' && (await filaDe(a8)).motivo_perdida_id === motivo && (await filaDe(a8)).proxima_gestion_en === null);
    r = await asesor('POST', `/participaciones/${a8}/gestiones`, { canalId: canal, resultadoId: rNoInteresa, idempotencyKey: clave() });
    prueba('una gestión nueva reabre la perdida (vuelve a «en gestión» y se limpia el motivo)', r.datos.estado === 'en_gestion' && (await filaDe(a8)).motivo_perdida_id === null, JSON.stringify(r.datos));
    r = await asesor('POST', `/participaciones/${a1}/perdida`, { motivoId: motivo, idempotencyKey: clave() });
    prueba('una empresa que ya compró no se marca perdida (409)', r.status === 409);
    r = await asesor('POST', `/participaciones/${a9}/descartar`, { idempotencyKey: clave() });
    prueba('descartar sin motivo → 400', r.status === 400 && !!r.datos.campos.motivo);
    r = await asesor('POST', `/participaciones/${a9}/descartar`, { motivo: 'Cerró el negocio', idempotencyKey: clave() });
    prueba('descartar deja la empresa «descartada»', r.status === 200 && r.datos.estado === 'descartada');
    r = await asesor('POST', `/participaciones/${a9}/gestiones`, { canalId: canal, resultadoId: rNoInteresa, idempotencyKey: clave() });
    prueba('una empresa descartada ya no recibe registros (409)', r.status === 409);
    const acc = (await db.query("SELECT accion FROM proy_historial WHERE proyecto_id = ? AND accion IN ('marcar_perdida', 'descartar_empresa') ORDER BY id", [proyectoId], 'ges:historial')).map(x => x.accion);
    prueba('perder y descartar quedan en el historial del proyecto', acc.join() === 'marcar_perdida,descartar_empresa', acc.join());

    console.log('Listas, orden y «Para hoy»');
    await db.query('UPDATE proy_participaciones SET proxima_gestion_en = ?, ultima_gestion_en = ? WHERE id = ?', [`${dia(-3)} 10:00:00`, `${dia(-6)} 10:00:00`, a10], 'ges:vencida');
    await db.query('UPDATE proy_participaciones SET proxima_gestion_en = ?, estado = ? WHERE id = ?', [`${dia(0)} 15:00:00`, 'en_gestion', a8], 'ges:hoy');
    await db.query("UPDATE proy_participaciones SET asignada_en = ?, ultima_gestion_en = NULL, proxima_gestion_en = NULL, estado = 'pendiente' WHERE id = ?", [`${dia(-12)} 08:00:00`, a4], 'ges:sin_tocar');
    r = await asesor('GET', '/mi-proyecto/para-hoy');
    const ids = (g) => g.map(x => x.id);
    prueba('«Vencidos» trae la que tenía seguimiento pasado', ids(r.datos.vencidos).includes(a10), JSON.stringify(r.datos.vencidos));
    prueba('«Hoy» trae la que vence hoy', ids(r.datos.hoy).includes(a8));
    prueba('«Sin tocar» trae las que llevan días sin gestión', ids(r.datos.sinTocar).includes(a4) && r.datos.sinTocar.every(x => x.diasSinGestion >= r.datos.limiteDias));
    const todas = [...ids(r.datos.vencidos), ...ids(r.datos.hoy), ...ids(r.datos.sinTocar)];
    prueba('ninguna empresa aparece dos veces', new Set(todas).size === todas.length && r.datos.total === todas.length);
    prueba('las vendidas, perdidas y descartadas no están en «Para hoy»', !todas.includes(a1) && !todas.includes(a5) && !todas.includes(a9));
    r = await asesor('GET', '/participaciones');
    const orden = r.datos.empresas;
    const finales = ['vendida', 'perdida', 'descartada'];
    const primerFinal = orden.findIndex(e => finales.includes(e.estado));
    prueba('en la lista las cerradas van al final', primerFinal === -1 || orden.slice(primerFinal).every(e => finales.includes(e.estado)));
    prueba('…y las vencidas primero', orden[0].id === a10 && orden[0].seguimientoVencido === true, JSON.stringify(orden[0]));
    r = await asesor('GET', '/participaciones?estado=vendida');
    prueba('el filtro por estado funciona', r.datos.total === 2 && r.datos.empresas.every(e => e.estado === 'vendida'));
    r = await asesor('GET', '/participaciones?q=Hospital%205');
    prueba('la búsqueda por nombre funciona', r.datos.empresas.every(e => /Hospital 5/.test(e.nombre)));
    await db.query(
      'INSERT INTO proy_clientes (nombre, nombre_normalizado, nicho_id, pais_id, estructura_id, estado, creado_por) VALUES ?',
      [Array.from({ length: 55 }, (_, i) => [`GES Extra ${i}`, `ges extra ${i}`, nichoId, paisGT, estructuraId, 'activa', admin])], 'ges:extras');
    await db.query(
      `INSERT INTO proy_participaciones (proyecto_id, cliente_id, asesor_id, tienda_id, estado, abierta) SELECT ?, id, ?, 1, 'pendiente', 0 FROM proy_clientes WHERE nombre LIKE 'GES Extra %'`,
      [proyectoId, A], 'ges:participaciones_extra');
    r = await asesor('GET', '/participaciones');
    const pagina2 = await asesor('GET', '/participaciones?pagina=2');
    prueba('las listas van de 50 en 50', r.datos.empresas.length === 50 && r.datos.porPagina === 50 && r.datos.total === asesores[0].n + 55 && pagina2.datos.empresas.length === r.datos.total - 50 && !pagina2.datos.empresas.some(e => r.datos.empresas.some(x => x.id === e.id)), `${r.datos.empresas.length}/${pagina2.datos.empresas.length}`);

    console.log('Ficha');
    r = await asesor('GET', `/participaciones/${a1}`);
    prueba('la ficha trae la empresa, el proyecto y la línea de tiempo ordenada (lo más nuevo primero)', r.status === 200 && r.datos.empresa.nombre.startsWith('GES Hospital') && r.datos.proyecto.id === proyectoId && r.datos.historial.length >= 5 && r.datos.historial.every((h, i, l) => i === 0 || String(l[i - 1].fecha) >= String(h.fecha)), JSON.stringify(r.datos.historial.length));
    prueba('lleva lo que necesitan las hojas: moneda local, referencia obligatoria y muestra', r.datos.registro.monedaPorDefecto === 'GTQ' && r.datos.registro.referenciaObligatoria === true && r.datos.registro.ventaPorConfirmar === false && r.datos.registro.muestra.articulo, JSON.stringify(r.datos.registro));

    console.log('Proyecto cerrado: solo lectura');
    await db.query("UPDATE proy_proyectos SET estado = 'cerrado', cerrado_en = NOW() WHERE id = ?", [proyectoId], 'ges:cerrar');
    await db.query('UPDATE proy_participaciones SET abierta = 0 WHERE proyecto_id = ?', [proyectoId], 'ges:cerrar_participaciones');
    r = await asesor('POST', `/participaciones/${a2}/gestiones`, { canalId: canal, resultadoId: rNoInteresa, idempotencyKey: clave() });
    prueba('un proyecto cerrado no recibe registros (409)', r.status === 409 && /ya no está activo/.test(r.datos.error), JSON.stringify(r.datos));
    r = await asesor('GET', `/participaciones/${a2}`);
    prueba('la ficha sigue abierta para consulta y dice que ya no admite registros', r.status === 200 && r.datos.abierta === false);
    r = await asesor('GET', '/mi-proyecto');
    prueba('sin proyecto activo, Mi proyecto responde «proyecto: null»', r.status === 200 && r.datos.proyecto === null);
    r = await asesor('GET', '/mis-proyectos-anteriores');
    const anterior = r.datos.proyectos.find(p => p.id === proyectoId);
    prueba('Mis proyectos anteriores lo lista con sus cifras', r.status === 200 && anterior && anterior.vendidas === 2 && anterior.asignadas >= asesores[0].n, JSON.stringify(anterior));
    r = await asesor('GET', '/mis-proyectos-anteriores', undefined, B);
    prueba('otro asesor solo ve los suyos: sus cifras no incluyen las de A', r.datos.proyectos.find(p => p.id === proyectoId).vendidas === 0);
  } finally {
    // Limpieza, pase lo que pase: nada de esta prueba debe quedar en la base.
    if (proyectoId) {
      const part = '(SELECT id FROM proy_participaciones WHERE proyecto_id = ?)';
      for (const tabla of ['proy_gestiones', 'proy_entregas_muestra', 'proy_cotizaciones', 'proy_ventas', 'proy_reasignaciones']) {
        await db.query(`DELETE FROM ${tabla} WHERE participacion_id IN ${part}`, [proyectoId], `ges:limpiar_${tabla}`);
      }
    }
    await db.query("DELETE FROM proy_proyectos WHERE creado_en >= ? AND creado_por = ?", [inicio, SUP], 'ges:limpiar_proyectos');
    await db.query("DELETE FROM proy_clientes WHERE nombre LIKE 'GES %'", [], 'ges:limpiar_clientes');
    await db.query("DELETE FROM idempotency_keys WHERE idempotency_key LIKE 'proy-%' AND creado_en >= ?", [inicio], 'ges:limpiar_claves');
    await db.query('UPDATE proy_pais_config SET moneda_codigo = ?, referencia_obligatoria = ?, confirmacion_ventas = ? WHERE pais_id = ?', [paisAntes.moneda_codigo, paisAntes.referencia_obligatoria, paisAntes.confirmacion_ventas, paisGT], 'ges:restaurar_pais');
    await db.query('DELETE FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'ges:limpiar_ajustes');
    for (const { clave: c, valor } of ajustesAntes) await db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?)', [c, valor], 'ges:restaurar_ajuste');
    await db.query('DELETE FROM proy_config_historial WHERE creado_en >= ?', [inicio], 'ges:limpiar_historial');
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
