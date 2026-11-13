// scripts/incidencias/verificar-flujo.js
// Verifica el núcleo de Incidencias (fase 2) por HTTP contra las rutas reales: reportar (validaciones, país habilitado, fotos,
// prioridad, reincidencia, idempotencia, límite diario), quién ve qué (reportante, técnico, verificador, solo consulta),
// el ciclo completo (tomar con carrera, avances, espera, verificación, corrección, cierre), reasignar, devolver, descartar,
// cambio de prioridad, comentarios y los avisos.
//
// Uso (base DESECHABLE con las migraciones aplicadas; crea datos de prueba y los borra al terminar):
//   node --require ./scripts/security/stub-storage.js scripts/incidencias/verificar-flujo.js
const express = require('express');
const multer = require('multer');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/incidencias/routes');

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};

const P_REPORTA = ['incidencias.ver', 'incidencias.reportar'];
const P_SOLO_VER = ['incidencias.ver'];
const P_TECNICO = ['incidencias.ver', 'incidencias.reportar', 'incidencias.resolver'];
const P_VERIFICA = ['incidencias.ver', 'incidencias.reportar', 'incidencias.verificar', 'incidencias.asignar'];
const P_TECNICO_Y_VERIFICA = ['incidencias.ver', 'incidencias.resolver', 'incidencias.verificar'];
const P_CONSULTA = ['incidencias.ver', 'incidencias.ver_todas'];

// PNG de 1×1 píxel: pasa la validación del tipo real.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function levantar() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: Number(req.headers['x-usuario']), nombre: `Usuario ${req.headers['x-usuario']}`, permissions: (req.headers['x-permisos'] || '').split(',').filter(Boolean) };
    next();
  });
  app.use('/api/incidencias', requirePermission('incidencias.ver'), rutas);
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err instanceof multer.MulterError) return res.status(400).json({ error: 'Archivo no válido.' });
    return res.status(500).json({ error: 'interno' });
  });
  return new Promise(resolver => { const s = app.listen(0, '127.0.0.1', () => resolver(s)); });
}

async function verificar() {
  const ajustesAntes = await db.query("SELECT clave, valor FROM parametros_sistema WHERE clave LIKE 'incidencias.%'", [], 'inc:ajustes_antes');
  const [{ id: paisGT }] = await db.query("SELECT id FROM paises WHERE codigo = 'GT'", [], 'inc:gt');
  const [{ id: paisSV }] = await db.query("SELECT id FROM paises WHERE codigo = 'SV'", [], 'inc:sv');
  const tiendasGT = await db.query('SELECT t.id FROM tiendas t JOIN empresas e ON e.id = t.empresa_id WHERE e.pais_id = ? AND t.activo = 1 ORDER BY t.id LIMIT 3', [paisGT], 'inc:tiendas_gt');
  const [{ id: tiendaSV }] = await db.query('SELECT t.id FROM tiendas t JOIN empresas e ON e.id = t.empresa_id WHERE e.pais_id = ? AND t.activo = 1 ORDER BY t.id LIMIT 1', [paisSV], 'inc:tienda_sv');
  const [TA, TB, TC] = tiendasGT.map(t => t.id);
  const usuarios = (await db.query('SELECT id FROM usuarios WHERE activo = 1 ORDER BY id LIMIT 12', [], 'inc:usuarios')).map(u => u.id);
  const [, X, T1, T2, T3, V, V2, L] = usuarios;
  const asesorConTienda = (await db.query('SELECT a.usuario_id, a.tienda_id FROM asesores a JOIN usuarios u ON u.id = a.usuario_id AND u.activo = 1 JOIN tiendas t ON t.id = a.tienda_id JOIN empresas e ON e.id = t.empresa_id WHERE e.pais_id = ? ORDER BY a.usuario_id LIMIT 1', [paisGT], 'inc:asesor'))[0];
  const R = asesorConTienda.usuario_id;
  const todos = [R, X, T1, T2, T3, V, V2, L];
  const zonas = await db.query('SELECT id FROM incidencia_zonas WHERE tienda_id IS NULL ORDER BY orden LIMIT 3', [], 'inc:zonas');
  const [Z1, Z2] = zonas.map(z => z.id);
  const [{ id: catElectrica }] = await db.query("SELECT id FROM incidencia_categorias WHERE nombre = 'Eléctrica'", [], 'inc:cat');
  const [{ id: tipoToma }] = await db.query("SELECT id FROM incidencia_tipos_activo WHERE nombre = 'Tomacorriente'", [], 'inc:tipo');
  const [{ id: catImpresion }] = await db.query("SELECT id FROM incidencia_categorias WHERE nombre = 'Equipo de impresión'", [], 'inc:cat2');
  const [{ id: motivoEspera }] = await db.query('SELECT id FROM incidencia_motivos_espera ORDER BY orden LIMIT 1', [], 'inc:motivo');

  // Personal de prueba: T1 y T3 cubren todas las tiendas; T2 solo la TB; V verifica la TA; la TB y la TC no tienen verificador.
  await db.query('INSERT INTO incidencia_tecnicos (usuario_id, activo, todas_las_tiendas) VALUES (?, 1, 1), (?, 1, 0), (?, 1, 1)', [T1, T2, T3], 'inc:tecnicos');
  await db.query('INSERT INTO incidencia_tecnico_tiendas (usuario_id, tienda_id) VALUES (?, ?)', [T2, TB], 'inc:tecnico_tienda');
  await db.query('INSERT INTO incidencia_verificadores (usuario_id, tienda_id) VALUES (?, ?)', [V, TA], 'inc:verificador');

  const servidor = await levantar();
  const base = `http://127.0.0.1:${servidor.address().port}/api/incidencias`;
  const llamar = async (metodo, ruta, { usuario, permisos, cuerpo, fotos }) => {
    const cab = { 'x-usuario': String(usuario), 'x-permisos': permisos.join(',') };
    let body;
    if (fotos !== undefined) {
      const f = new FormData();
      for (const [k, v] of Object.entries(cuerpo || {})) if (v !== undefined && v !== null) f.append(k, String(v));
      fotos.forEach((buf, i) => f.append('fotos', new Blob([buf.datos || buf], { type: buf.tipo || 'image/png' }), `foto${i}.png`));
      body = f;
    } else if (cuerpo !== undefined) { cab['content-type'] = 'application/json'; body = JSON.stringify(cuerpo); }
    const res = await fetch(base + ruta, { method: metodo, headers: cab, body });
    return { status: res.status, datos: await res.json().catch(() => null) };
  };
  const como = (usuario, permisos) => (m, r, c, fotos) => llamar(m, r, { usuario, permisos, cuerpo: c, fotos });
  const rep = como(R, P_REPORTA);
  const otro = como(X, P_SOLO_VER);
  const t1 = como(T1, P_TECNICO);
  const t2 = como(T2, P_TECNICO);
  const t3 = como(T3, P_TECNICO);
  const ver = como(V, P_VERIFICA);
  const ver2 = como(V2, P_VERIFICA);
  const t1Verifica = como(T1, P_TECNICO_Y_VERIFICA);
  const lector = como(L, P_CONSULTA);
  const clave = () => `inc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const nuevo = (extra = {}) => ({ tiendaId: TA, zonaId: Z1, categoriaId: catElectrica, tipoActivoId: tipoToma, titulo: 'Tomacorriente sin energía', descripcion: 'No hay corriente en el tomacorriente de la pared norte.', impacto: 'detiene_operacion', idempotencyKey: clave(), ...extra });
  const estadoEnBase = async (id) => (await db.query('SELECT estado, tecnico_id, ronda, cerrada_en FROM incidencias WHERE id = ?', [id], 'inc:estado'))[0];
  const eventosDe = async (id) => db.query('SELECT tipo, usuario_id, visible_reportante FROM incidencia_eventos WHERE incidencia_id = ? ORDER BY id', [id], 'inc:eventos');
  const cuenta = async (usuarioId, tipo) => Number((await db.query("SELECT COUNT(*) AS n FROM notificaciones WHERE modulo = 'incidencias' AND usuario_id = ? AND tipo = ?", [usuarioId, tipo], 'inc:cuenta'))[0].n);
  const fijarParametro = async (c, v) => db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', [`incidencias.${c}`, String(v)], 'inc:param');

  try {
    console.log('Formulario');
    let r = await rep('GET', '/formulario');
    prueba('el formulario trae las tiendas de Guatemala y ninguna de un país apagado', r.status === 200 && r.datos.tiendas.length > 0 && !r.datos.tiendas.some(t => t.pais !== 'Guatemala'), JSON.stringify(r.datos && r.datos.tiendas && r.datos.tiendas.slice(0, 2)));
    prueba('propone la tienda propia del asesor', r.datos.tiendaPropiaId === asesorConTienda.tienda_id, String(r.datos.tiendaPropiaId));
    prueba('trae los 4 impactos con su prioridad y el límite de fotos', r.datos.impactos.length === 4 && r.datos.impactos[0].prioridad.codigo === 'P1' && r.datos.limites.fotos === 5 && r.datos.reportesRestantes === 30, JSON.stringify(r.datos.impactos));
    r = await otro('GET', '/formulario');
    prueba('quien solo puede ver no entra al formulario → 403', r.status === 403, r.status);

    console.log('Reportar');
    r = await rep('POST', '/', nuevo(), []);
    prueba('sin foto no se crea → 400 con mensaje claro', r.status === 400 && /foto/i.test(r.datos.error), JSON.stringify(r.datos));
    r = await rep('POST', '/', { ...nuevo(), idempotencyKey: undefined }, [PNG]);
    prueba('sin clave de la operación → 400', r.status === 400, JSON.stringify(r.datos));
    r = await rep('POST', '/', nuevo({ titulo: '', impacto: 'cualquiera', zonaId: '' }), [PNG]);
    prueba('datos inválidos → 400 con el campo marcado', r.status === 400 && r.datos.campos && r.datos.campos.titulo && r.datos.campos.impacto && r.datos.campos.zonaId, JSON.stringify(r.datos));
    r = await rep('POST', '/', nuevo({ tiendaId: tiendaSV }), [PNG]);
    prueba('una tienda de un país apagado → 409 con el aviso', r.status === 409 && /país/i.test(r.datos.error), JSON.stringify(r.datos));
    r = await rep('POST', '/', nuevo(), [{ datos: Buffer.from('<svg onload=alert(1)>'), tipo: 'image/png' }]);
    prueba('un archivo que dice ser PNG pero no lo es se rechaza → 400', r.status === 400 && /foto/i.test(r.datos.error), JSON.stringify(r.datos));
    r = await rep('POST', '/', nuevo(), Array.from({ length: 6 }, () => PNG));
    prueba('más fotos del máximo → 400', r.status === 400 && /5 fotos/.test(r.datos.error), JSON.stringify(r.datos));
    r = await otro('POST', '/', nuevo(), [PNG]);
    prueba('sin permiso de reportar → 403', r.status === 403, r.status);
    r = await rep('POST', '/', nuevo({ tipoActivoId: 999999 }), [PNG]);
    prueba('un activo que no es de la categoría → 400', r.status === 400 && r.datos.campos && r.datos.campos.tipoActivoId, JSON.stringify(r.datos));

    const llaveA = clave();
    r = await rep('POST', '/', nuevo({ idempotencyKey: llaveA }), [PNG]);
    const incA = r.datos && r.datos.incidencia && r.datos.incidencia.id;
    prueba('reportar crea la incidencia en el buzón con su correlativo y la prioridad del impacto', r.status === 201 && /^INC-\d{6}$/.test(r.datos.incidencia.correlativo) && r.datos.incidencia.estado === 'en_buzon' && r.datos.incidencia.prioridad.codigo === 'P2' && r.datos.incidencia.fotos.length === 1, JSON.stringify(r.datos));
    prueba('queda en el historial: apertura y entrada al buzón', (await eventosDe(incA)).map(e => e.tipo).join() === 'apertura,buzon');
    r = await rep('POST', '/', nuevo({ idempotencyKey: llaveA }), [PNG]);
    prueba('repetir con la misma clave devuelve la misma incidencia sin crear otra', r.status === 200 || r.status === 201 ? r.datos.incidencia.id === incA && r.datos.repetida === true : false, JSON.stringify(r.datos));
    prueba('solo hay una fila con esa clave', Number((await db.query('SELECT COUNT(*) AS n FROM incidencias WHERE reportada_por = ?', [R], 'inc:filas'))[0].n) === 1);
    r = await rep('POST', '/', nuevo({ impacto: 'molestia_menor', tipoActivoId: '' }), [PNG]);
    const incRe = r.datos && r.datos.incidencia;
    prueba('la misma tienda y zona otra vez: la prioridad sube un nivel (P4 → P3) y queda marcada como reincidente', r.status === 201 && incRe.prioridad.codigo === 'P3' && incRe.reincidente === true, JSON.stringify(incRe && incRe.prioridad));
    r = await rep('POST', '/', nuevo({ impacto: 'riesgo_personas', zonaId: Z2, categoriaId: catImpresion, tipoActivoId: '' }), [PNG]);
    const incP1 = r.datos && r.datos.incidencia;
    prueba('riesgo para las personas es P1', r.status === 201 && incP1.prioridad.codigo === 'P1', JSON.stringify(incP1 && incP1.prioridad));
    r = await rep('GET', `/similares?tiendaId=${TA}&categoriaId=${catElectrica}&zonaId=${Z1}`);
    prueba('avisa de reportes parecidos mientras se escribe', r.status === 200 && r.datos.similares.length >= 1 && r.datos.similares[0].correlativo, JSON.stringify(r.datos));

    console.log('Límite diario');
    await fijarParametro('reportes_por_usuario', 3);
    r = await rep('POST', '/', nuevo({ zonaId: Z2 }), [PNG]);
    prueba('al llegar al límite de reportes del día → 429 con mensaje', r.status === 429 && /máximo de reportes/.test(r.datos.error), JSON.stringify(r.datos));
    await db.query("DELETE FROM parametros_sistema WHERE clave = 'incidencias.reportes_por_usuario'", [], 'inc:param_borrar');

    console.log('Quién ve qué');
    r = await rep('GET', `/${incA}`);
    prueba('quien reportó ve su incidencia', r.status === 200 && r.datos.relacion.reportante === true && r.datos.acciones.tomar === false);
    r = await otro('GET', `/${incA}`);
    prueba('otra persona sin relación recibe 404 (no se revela que existe)', r.status === 404);
    r = await t1('GET', `/${incA}`);
    prueba('un técnico que cubre la tienda ve la incidencia del buzón y puede tomarla', r.status === 200 && r.datos.acciones.tomar === true);
    r = await t2('GET', `/${incA}`);
    prueba('un técnico que no cubre esa tienda recibe 404', r.status === 404);
    r = await ver('GET', `/${incA}`);
    prueba('el verificador de la tienda la ve y puede reasignar o descartar, no tomar', r.status === 200 && r.datos.acciones.reasignar && r.datos.acciones.descartar && !r.datos.acciones.tomar);
    r = await ver2('GET', `/${incA}`);
    prueba('un verificador de otra tienda recibe 404', r.status === 404);
    r = await lector('GET', `/${incA}`);
    prueba('quien solo consulta la ve sin ninguna acción', r.status === 200 && Object.values(r.datos.acciones).every(v => v === false) && r.datos.relacion.soloConsulta === true);
    r = await rep('GET', '/?vista=reportadas');
    prueba('«reportadas» lista solo lo propio', r.status === 200 && r.datos.items.length === 3 && r.datos.items.every(i => i.reportante.id === R), JSON.stringify(r.datos.items.map(i => i.reportante)));
    r = await otro('GET', '/?vista=reportadas');
    prueba('otra persona ve su lista vacía', r.status === 200 && r.datos.total === 0);
    r = await t1('GET', '/?vista=buzon');
    prueba('el buzón del técnico va por prioridad: primero la P1', r.status === 200 && r.datos.items.length === 3 && r.datos.items[0].prioridad.codigo === 'P1' && r.datos.items[0].especialidad, JSON.stringify(r.datos.items.map(i => i.prioridad.codigo)));
    r = await t2('GET', '/?vista=buzon');
    prueba('el buzón de quien no cubre la tienda está vacío', r.status === 200 && r.datos.total === 0);
    r = await rep('GET', '/?vista=buzon');
    prueba('pedir una lista sin el permiso → 403', r.status === 403);
    r = await ver('GET', '/?vista=tiendas&estado=abiertas');
    prueba('el verificador ve las de sus tiendas', r.status === 200 && r.datos.total === 3);
    r = await lector('GET', '/?vista=todas');
    prueba('la consulta total ve todo', r.status === 200 && r.datos.total >= 3);
    r = await rep('GET', '/?vista=reportadas&estado=inventado');
    prueba('un estado que no existe → 400', r.status === 400);
    r = await t1('GET', '/resumen');
    prueba('el resumen del técnico cuenta su buzón y las críticas', r.status === 200 && r.datos.buzon.total === 3 && r.datos.buzon.criticas === 1 && r.datos.tecnico.mias === 0, JSON.stringify(r.datos));

    console.log('Tomar (con carrera) y trabajar');
    const [c1, c2] = await Promise.all([t1('POST', `/${incA}/tomar`), t3('POST', `/${incA}/tomar`)]);
    const ganador = c1.status === 200 ? c1 : c2;
    const perdedor = c1.status === 200 ? c2 : c1;
    prueba('dos técnicos la toman a la vez: solo uno gana y el otro recibe 409', [c1.status, c2.status].sort().join() === '200,409' && /ya la tom/i.test(perdedor.datos.error), `${c1.status}/${c2.status}`);
    const dueno = c1.status === 200 ? T1 : T3;
    const comoDueno = c1.status === 200 ? t1 : t3;
    const comoOtro = c1.status === 200 ? t3 : t1;
    prueba('la incidencia queda en proceso y con su técnico', (await estadoEnBase(incA)).estado === 'en_proceso' && (await estadoEnBase(incA)).tecnico_id === dueno && ganador.datos.incidencia.estado === 'en_proceso');
    prueba('quien reportó recibió el aviso de que la tomaron', await cuenta(R, 'incidencia_tomada') === 1);
    prueba('los técnicos recibieron el aviso de la incidencia nueva (y no quien reportó)', await cuenta(T1, 'incidencia_nueva') >= 1 && await cuenta(R, 'incidencia_nueva') === 0);
    r = await comoOtro('GET', `/${incA}`);
    prueba('el otro técnico ya no ve la incidencia: no es suya ni está en el buzón → 404', r.status === 404);
    r = await comoDueno('POST', `/${incA}/tomar`);
    prueba('tomarla otra vez → 409', r.status === 409);

    const llaveAv = clave();
    r = await comoDueno('POST', `/${incA}/avances`, { texto: 'Se revisó la instalación: falta una fase.', evolucion: 'sin_cambios', idempotencyKey: llaveAv }, [PNG]);
    prueba('publicar un avance con foto → 201', r.status === 201 && r.datos.eventos.some(e => e.tipo === 'avance' && e.fotos.length === 1), JSON.stringify(r.datos));
    r = await comoDueno('POST', `/${incA}/avances`, { texto: 'Se revisó la instalación: falta una fase.', evolucion: 'sin_cambios', idempotencyKey: llaveAv }, [PNG]);
    prueba('repetir el avance con la misma clave no lo duplica', r.status === 200 || r.status === 201 ? r.datos.repetida === true && r.datos.eventos.filter(e => e.tipo === 'avance').length === 1 : false, JSON.stringify(r.datos && r.datos.eventos));
    r = await comoDueno('POST', `/${incA}/avances`, { texto: 'Avance de prueba', evolucion: 'rara', idempotencyKey: clave() }, []);
    prueba('un avance sin evolución válida → 400', r.status === 400 && r.datos.campos && r.datos.campos.evolucion, JSON.stringify(r.datos));
    r = await comoOtro('POST', `/${incA}/avances`, { texto: 'Intento ajeno', evolucion: 'mejoro', idempotencyKey: clave() }, []);
    prueba('quien no es el responsable no puede publicar avances', [403, 404].includes(r.status), r.status);
    r = await comoDueno('POST', `/${incA}/comentarios`, { texto: 'Nota interna: pedir el breaker.', visibleReportante: 'false', idempotencyKey: clave() });
    prueba('el técnico puede dejar una nota interna', r.status === 201);
    r = await rep('GET', `/${incA}`);
    prueba('quien reportó no ve la nota interna pero sí el avance', r.status === 200 && !r.datos.eventos.some(e => e.texto && e.texto.startsWith('Nota interna')) && r.datos.eventos.some(e => e.tipo === 'avance'));
    r = await rep('POST', `/${incA}/comentarios`, { texto: 'Gracias, avísenme cuando esté.', idempotencyKey: clave() });
    prueba('quien reportó puede comentar y el técnico lo ve', r.status === 201 && await cuenta(dueno, 'incidencia_comentario') === 1);
    r = await otro('POST', `/${incA}/comentarios`, { texto: 'Soy un curioso', idempotencyKey: clave() });
    prueba('una persona sin relación no puede comentar → 404', r.status === 404);

    console.log('Espera');
    r = await comoDueno('POST', `/${incA}/espera`, {});
    prueba('poner en espera sin motivo → 400', r.status === 400 && r.datos.campos && r.datos.campos.motivoId);
    r = await comoDueno('POST', `/${incA}/espera`, { motivoId: motivoEspera, detalle: 'Llega en 2 días.' });
    prueba('en espera con motivo', r.status === 200 && r.datos.incidencia.estado === 'en_espera' && await cuenta(R, 'incidencia_espera') === 1);
    r = await comoDueno('POST', `/${incA}/verificacion`, { resumen: 'No debería poder', confirmo: 'true', idempotencyKey: clave() }, [PNG]);
    prueba('en espera no se puede enviar a verificación → 409', r.status === 409, JSON.stringify(r.datos));
    r = await comoDueno('POST', `/${incA}/reanudar`);
    prueba('reanudar vuelve a en proceso', r.status === 200 && r.datos.incidencia.estado === 'en_proceso');

    console.log('Verificación, corrección y cierre');
    r = await comoDueno('POST', `/${incA}/verificacion`, { resumen: 'Se cambió el breaker y se probó la corriente.', confirmo: 'true', idempotencyKey: clave() }, []);
    prueba('enviar a verificación sin foto → 400', r.status === 400 && /foto/i.test(r.datos.error), JSON.stringify(r.datos));
    r = await comoDueno('POST', `/${incA}/verificacion`, { resumen: 'Se cambió el breaker y se probó la corriente.', idempotencyKey: clave() }, [PNG]);
    prueba('sin confirmar que quedó resuelto → 400', r.status === 400 && r.datos.campos && r.datos.campos.confirmo);
    const llaveV = clave();
    r = await comoDueno('POST', `/${incA}/verificacion`, { resumen: 'Se cambió el breaker y se probó la corriente.', confirmo: 'true', idempotencyKey: llaveV }, [PNG]);
    prueba('enviar a verificación con resumen y foto', r.status === 200 && r.datos.incidencia.estado === 'en_verificacion' && r.datos.incidencia.ronda === 1);
    prueba('el verificador de la tienda recibió el aviso', await cuenta(V, 'incidencia_a_verificacion') === 1);
    r = await comoDueno('POST', `/${incA}/verificacion`, { resumen: 'Se cambió el breaker y se probó la corriente.', confirmo: 'true', idempotencyKey: llaveV }, [PNG]);
    prueba('repetir el envío con la misma clave no suma otra revisión', (await estadoEnBase(incA)).ronda === 1);
    // Separación de funciones: el técnico con permiso de verificar no puede aprobar lo suyo.
    r = await como(dueno, P_TECNICO_Y_VERIFICA)('POST', `/${incA}/aprobar`, {});
    prueba('quien trabajó en la incidencia no puede aprobarla aunque tenga el permiso → 403', r.status === 403, JSON.stringify(r.datos));
    r = await ver2('POST', `/${incA}/aprobar`, {});
    prueba('un verificador de otra tienda no puede aprobarla → 404', r.status === 404);
    r = await ver('POST', `/${incA}/correccion`, { comentario: '' }, []);
    prueba('pedir corrección sin decir qué → 400', r.status === 400 && r.datos.campos && r.datos.campos.comentario);
    r = await ver('POST', `/${incA}/correccion`, { comentario: 'El tomacorriente sigue sin cubrir; revisa la tapa.' }, [PNG]);
    prueba('pedir corrección con foto de apoyo', r.status === 200 && r.datos.incidencia.estado === 'correccion_pedida' && r.datos.eventos.some(e => e.tipo === 'correccion_pedida' && e.fotos.length === 1));
    prueba('el técnico recibió el aviso de la corrección', await cuenta(dueno, 'incidencia_correccion') === 1);
    r = await comoDueno('POST', `/${incA}/verificacion`, { resumen: 'Se colocó la tapa y se probó otra vez.', confirmo: 'true', idempotencyKey: clave() }, [PNG]);
    prueba('el técnico vuelve a enviarla: segunda revisión', r.status === 200 && r.datos.incidencia.estado === 'en_verificacion' && r.datos.incidencia.ronda === 2);
    r = await ver('POST', `/${incA}/aprobar`, { comentario: 'Todo bien, gracias.' });
    prueba('el verificador la aprueba y se cierra', r.status === 200 && r.datos.incidencia.estado === 'cerrada' && (await estadoEnBase(incA)).cerrada_en !== null);
    prueba('quien reportó y el técnico reciben el aviso de cierre', await cuenta(R, 'incidencia_cerrada') === 1 && await cuenta(dueno, 'incidencia_cerrada') === 1);
    const tipos = (await eventosDe(incA)).map(e => e.tipo);
    prueba('el historial cuenta toda la historia en orden', tipos.join() === 'apertura,buzon,toma,avance,comentario,comentario,espera,reanudacion,a_verificacion,correccion_pedida,a_verificacion,cierre', tipos.join());
    r = await ver('POST', `/${incA}/aprobar`, {});
    prueba('una incidencia cerrada ya no se puede aprobar → 409', r.status === 409);
    r = await rep('POST', `/${incA}/comentarios`, { texto: 'Una más', idempotencyKey: clave() });
    prueba('una incidencia cerrada ya no admite comentarios → 409', r.status === 409);

    console.log('Reasignar, devolver y descartar');
    r = await ver('POST', `/${incRe.id}/reasignar`, { tecnicoId: T3, motivo: 'La atenderá otro técnico' });
    prueba('desde el buzón, reasignar a un técnico la deja en proceso con él', r.status === 200 && r.datos.incidencia.estado === 'en_proceso' && r.datos.incidencia.tecnico.id === T3);
    r = await ver('POST', `/${incRe.id}/reasignar`, { tecnicoId: T2, motivo: 'Probar' });
    prueba('reasignar a quien no cubre la tienda → 400', r.status === 400 && r.datos.campos && r.datos.campos.tecnicoId, JSON.stringify(r.datos));
    r = await ver('POST', `/${incRe.id}/reasignar`, { tecnicoId: T3, motivo: 'Probar' });
    prueba('reasignar a quien ya la tiene → 409', r.status === 409);
    r = await ver('POST', `/${incRe.id}/reasignar`, { tecnicoId: T1 });
    prueba('reasignar sin motivo → 400', r.status === 400 && r.datos.campos && r.datos.campos.motivo);
    r = await ver('POST', `/${incRe.id}/reasignar`, { tecnicoId: T1, motivo: 'Pedro ya no está' });
    prueba('reasignar de un técnico a otro conserva el estado', r.status === 200 && r.datos.incidencia.estado === 'en_proceso' && r.datos.incidencia.tecnico.id === T1 && await cuenta(T1, 'incidencia_reasignada') >= 1);
    r = await como(T1, P_TECNICO)('POST', `/${incRe.id}/devolver`, { motivo: '' });
    prueba('devolver sin motivo → 400', r.status === 400);
    r = await como(T1, P_TECNICO)('POST', `/${incRe.id}/devolver`, { motivo: 'Necesita otra especialidad' });
    prueba('el técnico devuelve la suya al buzón', r.status === 200 && r.datos.incidencia.estado === 'en_buzon' && r.datos.incidencia.tecnico === null);
    r = await ver('POST', `/${incRe.id}/reasignar`, { destino: 'buzon', motivo: 'Ya está' });
    prueba('devolver al buzón lo que ya está en el buzón → 409', r.status === 409);
    r = await ver('POST', `/${incRe.id}/descartar`, { motivo: '' });
    prueba('descartar sin motivo → 400', r.status === 400);
    r = await ver('POST', `/${incRe.id}/descartar`, { motivo: 'Es el mismo problema de la otra', originalId: incA });
    prueba('descartar con motivo y la incidencia original', r.status === 200 && r.datos.incidencia.estado === 'descartada' && r.datos.incidencia.duplicadaDe === incA && await cuenta(R, 'incidencia_descartada') === 1);
    r = await ver('POST', `/${incRe.id}/descartar`, { motivo: 'Otra vez' });
    prueba('una incidencia descartada ya no se puede tocar → 409', r.status === 409);
    r = await t1('POST', `/${incP1.id}/descartar`, { motivo: 'Intento sin permiso' });
    prueba('un técnico sin permiso de asignar no puede descartar → 403', r.status === 403);

    console.log('Prioridad');
    const [{ id: pAlta }] = await db.query("SELECT id FROM incidencia_prioridades WHERE codigo = 'P2'", [], 'inc:p2');
    r = await ver('PUT', `/${incP1.id}/prioridad`, { prioridadId: pAlta });
    prueba('cambiar la prioridad sin motivo → 400', r.status === 400 && r.datos.campos && r.datos.campos.motivo);
    r = await ver('PUT', `/${incP1.id}/prioridad`, { prioridadId: pAlta, motivo: 'No hay riesgo real, solo molestia' });
    prueba('cambiar la prioridad con motivo', r.status === 200 && r.datos.incidencia.prioridad.codigo === 'P2' && r.datos.eventos.some(e => e.tipo === 'prioridad'));
    r = await ver('PUT', `/${incP1.id}/prioridad`, { prioridadId: pAlta, motivo: 'Otra vez' });
    prueba('poner la misma prioridad → 409', r.status === 409);
    r = await rep('GET', `/${incP1.id}`);
    prueba('quien reportó no ve el cambio interno de prioridad', r.status === 200 && !r.datos.eventos.some(e => e.tipo === 'prioridad'));

    console.log('Tienda sin verificador propio ni del país: lo ve quien tenga el permiso');
    r = await rep('POST', '/', nuevo({ tiendaId: TB, zonaId: Z1, tipoActivoId: '' }), [PNG]);
    const incB = r.datos && r.datos.incidencia && r.datos.incidencia.id;
    prueba('se reporta en una tienda sin verificador', r.status === 201, JSON.stringify(r.datos));
    r = await t2('POST', `/${incB}/tomar`);
    prueba('el técnico que solo cubre la TB la toma', r.status === 200);
    r = await t2('POST', `/${incB}/verificacion`, { resumen: 'Se arregló la conexión y se probó.', confirmo: 'true', idempotencyKey: clave() }, [PNG]);
    prueba('la envía a verificación', r.status === 200 && r.datos.incidencia.estado === 'en_verificacion');
    r = await ver2('POST', `/${incB}/aprobar`, {});
    prueba('cualquiera con el permiso de verificar la puede aprobar si la tienda no tiene verificador', r.status === 200 && r.datos.incidencia.estado === 'cerrada', JSON.stringify(r.datos));

    console.log('País apagado');
    await db.query('UPDATE incidencia_paises SET habilitado = 0 WHERE pais_id = ?', [paisGT], 'inc:apagar_gt');
    r = await rep('POST', '/', nuevo(), [PNG]);
    prueba('con Guatemala apagado no se puede reportar → 409', r.status === 409, JSON.stringify(r.datos));
    r = await rep('GET', '/formulario');
    prueba('y el formulario ya no ofrece sus tiendas ni propone la propia, y trae el aviso', r.status === 200 && r.datos.tiendas.length === 0 && r.datos.tiendaPropiaId === null && Boolean(r.datos.avisoPais), JSON.stringify(r.datos.avisoPais));
    await db.query('UPDATE incidencia_paises SET habilitado = 1 WHERE pais_id = ?', [paisGT], 'inc:encender_gt');
  } finally {
    servidor.close();
    await db.query('DELETE FROM incidencias WHERE reportada_por IN (?)', [todos], 'inc:limpiar_incidencias');
    await db.query('DELETE FROM incidencia_verificadores WHERE usuario_id IN (?)', [todos], 'inc:limpiar_verificadores');
    await db.query('DELETE FROM incidencia_tecnicos WHERE usuario_id IN (?)', [todos], 'inc:limpiar_tecnicos');
    await db.query("DELETE FROM notificaciones WHERE modulo = 'incidencias' AND usuario_id IN (?)", [todos], 'inc:limpiar_notificaciones');
    await db.query("DELETE FROM idempotency_keys WHERE idempotency_key LIKE 'inc-%'", [], 'inc:limpiar_claves');
    await db.query("DELETE FROM parametros_sistema WHERE clave LIKE 'incidencias.%'", [], 'inc:limpiar_parametros');
    for (const a of ajustesAntes) await db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?)', [a.clave, a.valor], 'inc:restaurar_parametro');
    await db.query('UPDATE incidencia_paises SET habilitado = 1 WHERE pais_id = ?', [paisGT], 'inc:restaurar_gt');
  }
}

verificar()
  .then(() => { console.log(`\n${buenas} OK, ${malas} fallas`); process.exit(malas ? 1 : 0); })
  .catch((error) => { console.error('ERROR', error); process.exit(2); });
