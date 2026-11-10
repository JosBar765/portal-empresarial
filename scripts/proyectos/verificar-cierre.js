// scripts/proyectos/verificar-cierre.js
// Verifica el informe, el cierre, el visto bueno y el panel gerencial (fase 6a), por HTTP contra las rutas reales.
// El criterio de la fase: el informe coincide con un CONTEO MANUAL de los mismos datos. Aquí el conteo se lleva aparte, en un
// libro de cuentas de JavaScript que se llena a la vez que los asesores registran, y se compara con lo que calcula el servidor.
//
// Uso (base DESECHABLE con las migraciones aplicadas; crea datos de prueba y los borra al terminar):
//   node scripts/proyectos/verificar-cierre.js
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/proyectos/routes');

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};

const PERM_ADMIN = ['proyectos.ver', 'proyectos.administrar', 'proyectos.activar', 'proyectos.supervisar', 'proyectos.reasignar', 'proyectos.corregir', 'proyectos.confirmar_ventas', 'proyectos.dar_visto_bueno'];
const PERM_SUPERVISOR = ['proyectos.ver', 'proyectos.activar', 'proyectos.supervisar', 'proyectos.reasignar', 'proyectos.corregir', 'proyectos.confirmar_ventas'];
const PERM_GERENTE = ['proyectos.ver', 'proyectos.ver_gerencia', 'proyectos.dar_visto_bueno'];
const PERM_GERENTE_SOLO_VER = ['proyectos.ver', 'proyectos.ver_gerencia'];
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
  const inicio = (await db.query('SELECT NOW() - INTERVAL 2 SECOND AS t', [], 'cie:inicio'))[0].t;
  const ajustesAntes = await db.query('SELECT clave, valor FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'cie:ajustes_antes');
  const [{ id: nichoId }] = await db.query("SELECT id FROM proy_nichos WHERE nombre = 'Hospitales'", [], 'cie:nicho');
  const [{ id: estructuraId }] = await db.query('SELECT id FROM proy_estructuras ORDER BY id LIMIT 1', [], 'cie:estructura');
  const [{ id: paisGT }] = await db.query("SELECT id FROM paises WHERE codigo = 'GT'", [], 'cie:pais');
  const [{ id: admin }] = await db.query('SELECT id FROM usuarios WHERE rol_id = 1 ORDER BY id LIMIT 1', [], 'cie:admin');
  const [{ id: gerente }] = await db.query("SELECT id FROM usuarios WHERE email = 'gerente@grupopremia.com'", [], 'cie:gerente');
  const [{ id: articulo }] = await db.query('SELECT id FROM proy_articulos WHERE activo = 1 ORDER BY id LIMIT 1', [], 'cie:articulo');
  const paisAntes = (await db.query('SELECT moneda_codigo, referencia_obligatoria, confirmacion_ventas FROM proy_pais_config WHERE pais_id = ?', [paisGT], 'cie:pais_antes'))[0];
  const resultado = async (nombre) => (await db.query('SELECT id FROM proy_resultados_gestion WHERE nombre = ?', [nombre], 'cie:resultado'))[0].id;
  const rInteresa = await resultado('Pide cotización'); // contacto logrado, interesada
  const rNoInteresa = await resultado('No le interesa por ahora'); // contacto logrado, en gestión
  const rSinRespuesta = await resultado('Sin respuesta'); // sin contacto, pide fecha
  const canalId = async (nombre) => (await db.query('SELECT id FROM proy_canales WHERE nombre = ?', [nombre], 'cie:canal'))[0].id;
  const cLlamada = await canalId('Llamada');
  const cVisita = await canalId('Visita');
  const [{ id: motivo }] = await db.query('SELECT id FROM proy_motivos_perdida WHERE activo = 1 ORDER BY id LIMIT 1', [], 'cie:motivo');
  const [{ id: area }] = await db.query('SELECT id FROM proy_areas_contacto WHERE activo = 1 ORDER BY id LIMIT 1', [], 'cie:area');
  const SUP = 13;
  const SUP_SIN = 14;
  const manana = new Date(Date.now() - 6 * 3600 * 1000 + 86400000).toISOString().slice(0, 10);

  await db.query('INSERT INTO proy_clientes (nombre, nombre_normalizado, nicho_id, pais_id, estructura_id, estado, creado_por) VALUES ?',
    [Array.from({ length: 36 }, (_, i) => [`CIE Hospital ${i}`, `cie hospital ${i}`, nichoId, paisGT, estructuraId, 'activa', admin])], 'cie:empresas');

  const servidor = await levantar();
  const base = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;
  const llamar = async (metodo, ruta, { usuario, permisos, cuerpo, binario }) => {
    const res = await fetch(base + ruta, { method: metodo, headers: { 'content-type': 'application/json', 'x-usuario': String(usuario), 'x-permisos': permisos.join(',') }, body: cuerpo === undefined || metodo === 'GET' ? undefined : JSON.stringify(cuerpo) });
    if (binario) return { status: res.status, tipo: res.headers.get('content-type'), bytes: Buffer.from(await res.arrayBuffer()) };
    return { status: res.status, datos: await res.json().catch(() => null) };
  };
  const adm = (m, r, c) => llamar(m, r, { usuario: admin, permisos: PERM_ADMIN, cuerpo: c });
  const sup = (m, r, c) => llamar(m, r, { usuario: SUP, permisos: PERM_SUPERVISOR, cuerpo: c });
  const supSin = (m, r, c) => llamar(m, r, { usuario: SUP_SIN, permisos: PERM_SUPERVISOR, cuerpo: c });
  const ger = (m, r, c) => llamar(m, r, { usuario: gerente, permisos: PERM_GERENTE, cuerpo: c });
  const asesor = (m, r, c, u) => llamar(m, r, { usuario: u, permisos: PERM_ASESOR, cuerpo: c });
  const clave = () => `cie-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  let proyectoId = null;
  let segundoId = null;

  try {
    console.log('Preparación: un proyecto activo con 36 empresas');
    let r = await adm('POST', '/proyectos', { nichoId, anio: 2026, mes: 11, tiendaIds: [1], fechaInicio: '2026-11-02', fechaFin: '2026-11-27', articuloId: articulo, existenciaMuestras: 50, topePorAsesor: 100 });
    proyectoId = r.datos && r.datos.id;
    r = await adm('POST', `/proyectos/${proyectoId}/activar`, { idempotencyKey: clave() });
    prueba('el proyecto se activa y reparte las 36 empresas', r.status === 200 && r.datos.estado === 'activo' && r.datos.empresas === 36, JSON.stringify(r.datos));
    const filas = await db.query('SELECT id, asesor_id FROM proy_participaciones WHERE proyecto_id = ? ORDER BY id', [proyectoId], 'cie:filas');
    const porAsesor = new Map();
    filas.forEach(f => { if (!porAsesor.has(f.asesor_id)) porAsesor.set(f.asesor_id, []); porAsesor.get(f.asesor_id).push(f.id); });

    // --- Libro de cuentas: el conteo manual, llenado a la vez que los asesores registran ---
    const libro = new Map(filas.map(f => [f.id, { gestion: false, contacto: false, interesada: false, cots: [], ventas: [], perdida: false, descartada: false }]));
    const cuenta = { presencial: 0, remoto: 0, muestras: 0 };
    const anotarGestion = (id, { contacto, interesada, visita }) => { const l = libro.get(id); l.gestion = true; l.contacto = l.contacto || contacto; l.interesada = l.interesada || interesada; if (visita) cuenta.presencial += 1; else cuenta.remoto += 1; };

    console.log('Trabajo de los asesores');
    let primeraCot = null;
    for (const [uid, ids] of porAsesor) {
      const [a, b, c, d, e, f] = ids;
      let x = await asesor('POST', `/participaciones/${a}/gestiones`, { canalId: cVisita, resultadoId: rInteresa, muestra: uid === [...porAsesor.keys()][0] ? { cantidad: 3, areaId: area } : undefined, idempotencyKey: clave() }, uid);
      if (x.status !== 201) prueba(`gestión de ${uid}`, false, JSON.stringify(x.datos));
      anotarGestion(a, { contacto: true, interesada: true, visita: true });
      if (uid === [...porAsesor.keys()][0]) cuenta.muestras += 3;
      await asesor('POST', `/participaciones/${b}/gestiones`, { canalId: cLlamada, resultadoId: rNoInteresa, idempotencyKey: clave() }, uid); anotarGestion(b, { contacto: true, interesada: false, visita: false });
      await asesor('POST', `/participaciones/${c}/gestiones`, { canalId: cLlamada, resultadoId: rSinRespuesta, proximaEn: manana, idempotencyKey: clave() }, uid); anotarGestion(c, { contacto: false, interesada: false, visita: false });
      x = await asesor('POST', `/participaciones/${d}/cotizaciones`, { monto: 100, referencia: `COT-${d}`, idempotencyKey: clave() }, uid); libro.get(d).cots.push({ moneda: 'GTQ', monto: 100, anulada: false });
      if (!primeraCot) primeraCot = { participacion: d, id: x.datos.historial.find(h => h.tipo === 'cotizacion').id };
      await asesor('POST', `/participaciones/${d}/ventas`, { monto: 200, referencia: `OV-${d}`, idempotencyKey: clave() }, uid); libro.get(d).ventas.push({ moneda: 'GTQ', monto: 200, estado: 'confirmada' });
      await asesor('POST', `/participaciones/${e}/gestiones`, { canalId: cLlamada, resultadoId: rNoInteresa, idempotencyKey: clave() }, uid); anotarGestion(e, { contacto: true, interesada: false, visita: false });
      await asesor('POST', `/participaciones/${e}/perdida`, { motivoId: motivo, idempotencyKey: clave() }, uid); libro.get(e).perdida = true;
      await asesor('POST', `/participaciones/${f}/descartar`, { motivo: 'Cerró el negocio', idempotencyKey: clave() }, uid); libro.get(f).descartada = true;
    }
    // Una cotización en dólares y otra anulada (no cuenta); una venta por confirmar y una rechazada (no cuentan).
    const [uid0, ids0] = [...porAsesor][0];
    r = await asesor('POST', `/participaciones/${ids0[0]}/cotizaciones`, { monto: 450.5, moneda: 'USD', referencia: 'COT-USD-1', idempotencyKey: clave() }, uid0); libro.get(ids0[0]).cots.push({ moneda: 'USD', monto: 450.5, anulada: false });
    r = await sup('POST', `/participaciones/${primeraCot.participacion}/cotizaciones/${primeraCot.id}/anular`, { motivo: 'Cotización equivocada', idempotencyKey: clave() });
    prueba('el supervisor anula una cotización', r.status === 200, JSON.stringify(r.datos));
    libro.get(primeraCot.participacion).cots.find(c => c.monto === 100).anulada = true;
    await configService.guardar({ 'reglas.confirmar_ventas': true }, admin);
    await asesor('POST', `/participaciones/${ids0[1]}/ventas`, { monto: 999, referencia: 'OV-PC-1', idempotencyKey: clave() }, uid0); libro.get(ids0[1]).ventas.push({ moneda: 'GTQ', monto: 999, estado: 'por_confirmar' });
    await asesor('POST', `/participaciones/${ids0[2]}/ventas`, { monto: 888, referencia: 'OV-PC-2', idempotencyKey: clave() }, uid0);
    const ventaMala = (await db.query("SELECT id FROM proy_ventas WHERE referencia = 'OV-PC-2'", [], 'cie:venta_mala'))[0].id;
    await sup('POST', `/ventas/${ventaMala}/rechazar`, { motivo: 'OV inexistente', idempotencyKey: clave() }); libro.get(ids0[2]).ventas.push({ moneda: 'GTQ', monto: 888, estado: 'rechazada' });
    await configService.guardar({ 'reglas.confirmar_ventas': false }, admin);
    // Una gestión anulada tampoco cuenta: ni como gestionada, ni como contactada, ni en presencial o remoto.
    const gestionAnulada = (await db.query('SELECT id FROM proy_gestiones WHERE participacion_id = ?', [ids0[1]], 'cie:gestion_a_anular'))[0].id;
    r = await sup('POST', `/participaciones/${ids0[1]}/gestiones/${gestionAnulada}/anular`, { motivo: 'Gestión de otra empresa', idempotencyKey: clave() });
    prueba('el supervisor anula una gestión', r.status === 200, JSON.stringify(r.datos));
    Object.assign(libro.get(ids0[1]), { gestion: false, contacto: false });
    cuenta.remoto -= 1;

    // --- El conteo manual ---
    const todas = [...libro.values()];
    const cotActivas = (l) => l.cots.filter(c => !c.anulada);
    const ventasOk = (l) => l.ventas.filter(v => v.estado === 'confirmada');
    const esperado = {
      asignadas: todas.length,
      gestionadas: todas.filter(l => l.gestion || cotActivas(l).length || ventasOk(l).length || l.perdida || l.descartada).length,
      contactadas: todas.filter(l => l.contacto).length,
      interesadas: todas.filter(l => !l.perdida && !l.descartada && (l.interesada || cotActivas(l).length || ventasOk(l).length)).length,
      cotizadas: todas.filter(l => cotActivas(l).length || ventasOk(l).length).length,
      vendidas: todas.filter(l => ventasOk(l).length).length,
      perdidas: todas.filter(l => l.perdida).length,
      descartadas: todas.filter(l => l.descartada).length
    };
    const sumar = (extraer) => { const t = {}; todas.forEach(l => extraer(l).forEach(x => { t[x.moneda] = Math.round(((t[x.moneda] || 0) + x.monto) * 100) / 100; })); return t; };
    const cotizadoEsperado = sumar(cotActivas);
    const vendidoEsperado = sumar(ventasOk);
    const aMapa = (lista) => Object.fromEntries(lista.map(m => [m.moneda, m.monto]));
    const iguales = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

    console.log('Informe contra el conteo manual');
    r = await sup('GET', `/proyectos/${proyectoId}/informe`);
    const c = r.datos.informe.cifras;
    prueba('el informe al momento responde y no está congelado', r.status === 200 && r.datos.congelado === false && r.datos.permisos.cerrar === true, JSON.stringify(r.datos.permisos));
    for (const k of Object.keys(esperado)) prueba(`${k}: el informe dice ${c[k]} y el conteo manual ${esperado[k]}`, c[k] === esperado[k], `${c[k]} ≠ ${esperado[k]}`);
    prueba('cotizado por moneda coincide (lo anulado no cuenta y las monedas no se mezclan)', iguales(aMapa(r.datos.informe.montos.cotizado), cotizadoEsperado), JSON.stringify([r.datos.informe.montos.cotizado, cotizadoEsperado]));
    prueba('vendido por moneda coincide (lo «por confirmar» y lo rechazado no cuentan)', iguales(aMapa(r.datos.informe.montos.vendido), vendidoEsperado), JSON.stringify([r.datos.informe.montos.vendido, vendidoEsperado]));
    prueba('presencial y remoto coinciden con las gestiones registradas', r.datos.informe.canales.presencial === cuenta.presencial && r.datos.informe.canales.remoto === cuenta.remoto, JSON.stringify([r.datos.informe.canales, cuenta]));
    prueba('las muestras entregadas por área coinciden', r.datos.informe.muestras.entregadas === cuenta.muestras && r.datos.informe.muestras.porArea.length === 1 && r.datos.informe.muestras.existencia === 50 - cuenta.muestras, JSON.stringify(r.datos.informe.muestras));
    prueba('las perdidas salen por motivo', r.datos.informe.perdidasPorMotivo.reduce((a, p) => a + p.n, 0) === esperado.perdidas);
    prueba('el desglose por asesor suma lo mismo que el total', r.datos.informe.porAsesor.reduce((a, x) => a + x.asignadas, 0) === esperado.asignadas && r.datos.informe.porAsesor.reduce((a, x) => a + x.vendidas, 0) === esperado.vendidas);
    prueba('el desglose por tienda suma lo mismo que el total', r.datos.informe.porTienda.reduce((a, x) => a + x.asignadas, 0) === esperado.asignadas && r.datos.informe.porTienda.reduce((a, x) => a + x.vendidas, 0) === esperado.vendidas);
    prueba('trae el semáforo de efectividad y el tiempo de reacción', ['verde', 'ambar', 'rojo'].includes(r.datos.informe.efectividad.semaforo) && typeof r.datos.informe.reaccionPromedioDias === 'number');
    const canon = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v));
    const vivo = canon(r.datos.informe.cifras);
    prueba('el supervisor ajeno al proyecto recibe 404', (await supSin('GET', `/proyectos/${proyectoId}/informe`)).status === 404);
    prueba('quien no supervisa ni es gerencia recibe 403', (await llamar('GET', `/proyectos/${proyectoId}/informe`, { usuario: uid0, permisos: PERM_ASESOR })).status === 403);
    prueba('gerencia lo ve', (await ger('GET', `/proyectos/${proyectoId}/informe`)).status === 200);

    console.log('Cerrar');
    r = await sup('POST', `/proyectos/${proyectoId}/cerrar`, { confirmado: true, idempotencyKey: clave() });
    prueba('sin conclusiones no se cierra → 400', r.status === 400 && !!r.datos.campos.conclusiones, JSON.stringify(r.datos));
    r = await sup('POST', `/proyectos/${proyectoId}/cerrar`, { conclusiones: 'Funcionó la visita.', idempotencyKey: clave() });
    prueba('sin confirmar la revisión no se cierra → 400', r.status === 400 && !!r.datos.campos.confirmado);
    r = await llamar('POST', `/proyectos/${proyectoId}/cerrar`, { usuario: uid0, permisos: PERM_ASESOR, cuerpo: { conclusiones: 'x', confirmado: true, idempotencyKey: clave() } });
    prueba('un asesor no cierra (403)', r.status === 403);
    r = await supSin('POST', `/proyectos/${proyectoId}/cerrar`, { conclusiones: 'x', confirmado: true, idempotencyKey: clave() });
    prueba('un supervisor ajeno al proyecto recibe 404', r.status === 404);
    const kCierre = clave();
    r = await sup('POST', `/proyectos/${proyectoId}/cerrar`, { conclusiones: 'La visita presencial dio el mejor cierre; recomiendo reforzar el seguimiento.', confirmado: true, idempotencyKey: kCierre });
    prueba('cerrar deja el proyecto «cerrado» con el visto bueno pendiente', r.status === 200 && r.datos.proyecto.estado === 'cerrado' && r.datos.vistoBueno.estado === 'pendiente' && r.datos.congelado === true && r.datos.repetida === false, JSON.stringify(r.datos.vistoBueno));
    const fila = (await db.query('SELECT estado, cerrado_por, conclusiones FROM proy_proyectos WHERE id = ?', [proyectoId], 'cie:cerrado'))[0];
    prueba('quedan guardados quién cerró y las conclusiones', fila.estado === 'cerrado' && fila.cerrado_por === SUP && /visita presencial/.test(fila.conclusiones));
    prueba('las tiendas quedan libres', Number((await db.query('SELECT COUNT(*) AS n FROM proy_proyecto_tiendas WHERE proyecto_id = ? AND proyecto_abierto = 1', [proyectoId], 'cie:tiendas'))[0].n) === 0);
    prueba('las empresas quedan libres y conservan su estado', Number((await db.query('SELECT COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND abierta = 1', [proyectoId], 'cie:abiertas'))[0].n) === 0 && Number((await db.query("SELECT COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND estado = 'vendida'", [proyectoId], 'cie:vendidas'))[0].n) === esperado.vendidas);
    r = await sup('POST', `/proyectos/${proyectoId}/cerrar`, { conclusiones: 'x', confirmado: true, idempotencyKey: kCierre });
    prueba('repetir la clave no cierra otra vez', r.status === 200 && r.datos.repetida === true);
    r = await sup('POST', `/proyectos/${proyectoId}/cerrar`, { conclusiones: 'x', confirmado: true, idempotencyKey: clave() });
    prueba('cerrar un proyecto ya cerrado → 409', r.status === 409);
    r = await asesor('POST', `/participaciones/${ids0[3]}/gestiones`, { canalId: cLlamada, resultadoId: rNoInteresa, idempotencyKey: clave() }, uid0);
    prueba('un proyecto cerrado no recibe registros (409)', r.status === 409);
    r = await sup('GET', `/proyectos/${proyectoId}/informe`);
    prueba('el informe queda congelado: idéntico al de antes de cerrar', r.datos.congelado === true && canon(r.datos.informe.cifras) === vivo, `${canon(r.datos.informe.cifras)} vs ${vivo}`);
    await db.query("INSERT INTO proy_cotizaciones (participacion_id, monto, moneda, referencia, creado_por) VALUES (?, 5000, 'GTQ', 'COT-TARDE', ?)", [ids0[4], uid0], 'cie:cotizacion_tardia');
    r = await sup('GET', `/proyectos/${proyectoId}/informe`);
    prueba('un registro posterior no cambia el informe congelado', iguales(aMapa(r.datos.informe.montos.cotizado), cotizadoEsperado));
    prueba('el cierre queda en el historial del proyecto', Number((await db.query("SELECT COUNT(*) AS n FROM proy_historial WHERE proyecto_id = ? AND accion = 'cerrar'", [proyectoId], 'cie:historial'))[0].n) === 1);

    console.log('Visto bueno');
    r = await adm('GET', '/gerencia/visto-bueno');
    prueba('el cierre aparece en «por dar visto bueno»', r.status === 200 && r.datos.cierres.some(x => x.id === proyectoId && x.asignadas === esperado.asignadas && x.vendidas === esperado.vendidas), JSON.stringify(r.datos));
    r = await sup('POST', `/proyectos/${proyectoId}/visto-bueno`, { idempotencyKey: clave() });
    prueba('el supervisor no da el visto bueno (403)', r.status === 403);
    r = await ger('POST', `/proyectos/${proyectoId}/devolver`, { idempotencyKey: clave() });
    prueba('devolver sin comentario → 400', r.status === 400 && !!r.datos.campos.comentario);
    r = await ger('POST', `/proyectos/${proyectoId}/devolver`, { comentario: 'Revisar el monto vendido de la tienda 1.', idempotencyKey: clave() });
    prueba('devolver con comentario deja el cierre «devuelto»', r.status === 200 && r.datos.vistoBueno.estado === 'devuelto' && /monto vendido/.test(r.datos.vistoBueno.comentario) && r.datos.permisos.reenviar === false, JSON.stringify(r.datos.vistoBueno));
    prueba('mientras está devuelto no se puede dar el visto bueno (409)', (await ger('POST', `/proyectos/${proyectoId}/visto-bueno`, { idempotencyKey: clave() })).status === 409);
    r = await llamar('POST', `/proyectos/${proyectoId}/reenviar`, { usuario: uid0, permisos: PERM_ASESOR, cuerpo: { idempotencyKey: clave() } });
    prueba('un asesor no reenvía (403)', r.status === 403);
    r = await sup('POST', `/proyectos/${proyectoId}/reenviar`, { conclusiones: '   ', idempotencyKey: clave() });
    prueba('reenviar con las conclusiones vacías → 400', r.status === 400 && !!r.datos.campos.conclusiones);
    r = await sup('POST', `/proyectos/${proyectoId}/reenviar`, { conclusiones: 'Corregido: el monto de la tienda 1 es el correcto.', idempotencyKey: clave() });
    prueba('reenviar vuelve a «pendiente» con las conclusiones corregidas', r.status === 200 && r.datos.vistoBueno.estado === 'pendiente' && /Corregido/.test(r.datos.conclusiones), JSON.stringify(r.datos.vistoBueno));
    prueba('gerencia sin el permiso de visto bueno no lo da (403)', (await llamar('POST', `/proyectos/${proyectoId}/visto-bueno`, { usuario: gerente, permisos: PERM_GERENTE_SOLO_VER, cuerpo: { idempotencyKey: clave() } })).status === 403);
    const kVB = clave();
    r = await ger('POST', `/proyectos/${proyectoId}/visto-bueno`, { comentario: 'Buen proyecto.', idempotencyKey: kVB });
    prueba('dar el visto bueno guarda quién, cuándo y el comentario', r.status === 200 && r.datos.vistoBueno.estado === 'dado' && !!r.datos.vistoBueno.por && r.datos.vistoBueno.comentario === 'Buen proyecto.', JSON.stringify(r.datos.vistoBueno));
    prueba('repetir la clave no lo da otra vez', (await ger('POST', `/proyectos/${proyectoId}/visto-bueno`, { comentario: 'Buen proyecto.', idempotencyKey: kVB })).datos.repetida === true);
    prueba('darlo dos veces con otra clave → 409', (await ger('POST', `/proyectos/${proyectoId}/visto-bueno`, { idempotencyKey: clave() })).status === 409);
    r = await ger('GET', `/proyectos/${proyectoId}/informe`);
    prueba('el historial del cierre trae cierre, devolución, reenvío y visto bueno', ['cerrar', 'devolver', 'reenviar', 'visto_bueno'].every(a => r.datos.historial.some(h => h.accion === a)), JSON.stringify(r.datos.historial));
    r = await adm('GET', '/gerencia/visto-bueno');
    prueba('ya no aparece entre los pendientes', !r.datos.cierres.some(x => x.id === proyectoId));

    console.log('PDF');
    r = await sup('GET', `/proyectos/${proyectoId}/informe.pdf`, undefined);
    r = await llamar('GET', `/proyectos/${proyectoId}/informe.pdf`, { usuario: SUP, permisos: PERM_SUPERVISOR, binario: true });
    prueba('el PDF se descarga: tipo, cabecera %PDF y un tamaño razonable', r.status === 200 && /application\/pdf/.test(r.tipo) && r.bytes.slice(0, 4).toString() === '%PDF' && r.bytes.length > 2000, `${r.status} ${r.tipo} ${r.bytes && r.bytes.length}`);
    const { PDFDocument } = require('pdf-lib');
    const pdf = await PDFDocument.load(r.bytes);
    prueba('el PDF se puede abrir y tiene al menos una página', pdf.getPageCount() >= 1, String(pdf.getPageCount()));
    r = await llamar('GET', `/proyectos/${proyectoId}/informe.pdf`, { usuario: uid0, permisos: PERM_ASESOR, binario: true });
    prueba('un asesor no descarga el informe (403)', r.status === 403);
    r = await llamar('GET', `/proyectos/${proyectoId}/informe.pdf`, { usuario: SUP_SIN, permisos: PERM_SUPERVISOR, binario: true });
    prueba('un supervisor ajeno al proyecto recibe 404', r.status === 404);

    console.log('Cierre sin visto bueno (interruptor apagado)');
    await configService.guardar({ 'reglas.visto_bueno_cierre': false }, admin);
    r = await adm('POST', '/proyectos', { nichoId, anio: 2026, mes: 12, tiendaIds: [1], fechaInicio: '2026-12-01', fechaFin: '2026-12-18', articuloId: articulo, existenciaMuestras: 5, topePorAsesor: 100 });
    segundoId = r.datos && r.datos.id;
    r = await adm('POST', `/proyectos/${segundoId}/activar`, { idempotencyKey: clave() });
    prueba('un segundo proyecto se activa en la tienda ya liberada', r.status === 200 && r.datos.estado === 'activo', JSON.stringify(r.datos));
    r = await sup('POST', `/proyectos/${segundoId}/cerrar`, { conclusiones: 'Sin novedades.', confirmado: true, idempotencyKey: clave() });
    prueba('con el interruptor apagado el cierre termina sin visto bueno', r.status === 200 && r.datos.proyecto.estado === 'cerrado' && r.datos.vistoBueno === null, JSON.stringify(r.datos.vistoBueno));
    prueba('y no aparece entre los pendientes del gerente', !(await adm('GET', '/gerencia/visto-bueno')).datos.cierres.some(x => x.id === segundoId));
    await configService.guardar({ 'reglas.visto_bueno_cierre': true }, admin);

    console.log('Panel gerencial');
    r = await ger('GET', '/gerencia/panel?anio=2026');
    prueba('el panel responde con proyectos, vendido, efectividad, meses, países y nichos', r.status === 200 && r.datos.anio === 2026 && Array.isArray(r.datos.porMes.meses) && r.datos.porMes.meses.length === 12 && Array.isArray(r.datos.porPais) && Array.isArray(r.datos.nichos), JSON.stringify(r.datos).slice(0, 300));
    const vendidoPanel = aMapa(r.datos.vendido);
    prueba('lo vendido del año por moneda coincide con el conteo manual (no se mezclan monedas)', Object.entries(vendidoEsperado).every(([m, v]) => vendidoPanel[m] === v), JSON.stringify([vendidoPanel, vendidoEsperado]));
    const hospitales = r.datos.nichos.find(n => n.nicho === 'Hospitales');
    prueba('la comparación de nichos trae los proyectos, las cifras y su semáforo', hospitales && hospitales.proyectos >= 2 && hospitales.asignadas >= esperado.asignadas && ['verde', 'ambar', 'rojo'].includes(hospitales.semaforo), JSON.stringify(hospitales));
    prueba('el filtro por país funciona', (await ger('GET', `/gerencia/panel?anio=2026&paisId=${paisGT}`)).status === 200);
    prueba('un supervisor no abre el panel gerencial (403)', (await sup('GET', '/gerencia/panel')).status === 403);
  } finally {
    // Limpieza, pase lo que pase: nada de esta prueba debe quedar en la base.
    for (const id of [proyectoId, segundoId].filter(Boolean)) {
      const part = '(SELECT id FROM proy_participaciones WHERE proyecto_id = ?)';
      for (const tabla of ['proy_gestiones', 'proy_entregas_muestra', 'proy_cotizaciones', 'proy_ventas', 'proy_reasignaciones']) {
        await db.query(`DELETE FROM ${tabla} WHERE participacion_id IN ${part}`, [id], `cie:limpiar_${tabla}`);
      }
    }
    await db.query('DELETE FROM proy_proyectos WHERE creado_en >= ? AND creado_por = ?', [inicio, admin], 'cie:limpiar_proyectos');
    await db.query("DELETE FROM proy_clientes WHERE nombre LIKE 'CIE %'", [], 'cie:limpiar_clientes');
    await db.query("DELETE FROM notificaciones WHERE modulo = 'proyectos' AND creado_en >= ?", [inicio], 'cie:limpiar_notificaciones');
    await db.query("DELETE FROM idempotency_keys WHERE idempotency_key LIKE 'proy-%' AND creado_en >= ?", [inicio], 'cie:limpiar_claves');
    await db.query('UPDATE proy_pais_config SET moneda_codigo = ?, referencia_obligatoria = ?, confirmacion_ventas = ? WHERE pais_id = ?', [paisAntes.moneda_codigo, paisAntes.referencia_obligatoria, paisAntes.confirmacion_ventas, paisGT], 'cie:restaurar_pais');
    await db.query('DELETE FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'cie:limpiar_ajustes');
    for (const { clave: k, valor } of ajustesAntes) await db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?)', [k, valor], 'cie:restaurar_ajuste');
    await db.query('DELETE FROM proy_config_historial WHERE creado_en >= ?', [inicio], 'cie:limpiar_historial');
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
