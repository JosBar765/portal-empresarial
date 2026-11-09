// scripts/proyectos/verificar-plantillas-aprobacion.js
// Verifica las plantillas de proyecto (A4/A4b), la foto de la configuración al activar y la aprobación opcional del gerente
// (fase 3b), por HTTP contra las rutas reales: validaciones, controles bloqueados y obligatorios que el servidor hace cumplir,
// plantilla predeterminada, calendario de etapas, foto de configuración, pedir / aprobar / rechazar y permisos por rol.
//
// Uso (base DESECHABLE con las migraciones aplicadas; crea datos de prueba y los borra al terminar):
//   node scripts/proyectos/verificar-plantillas-aprobacion.js
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

const PERM_SUPERVISOR = ['proyectos.ver', 'proyectos.activar'];
const PERM_ADMIN = ['proyectos.ver', 'proyectos.administrar', 'proyectos.activar'];
const PERM_GERENTE = ['proyectos.ver', 'proyectos.ver_gerencia', 'proyectos.aprobar_activacion'];

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
  const inicio = (await db.query('SELECT NOW() - INTERVAL 2 SECOND AS t', [], 'pla:inicio'))[0].t;
  const ajustesAntes = await db.query('SELECT clave, valor FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'pla:ajustes_antes');
  const predeterminadaAntes = (await db.query('SELECT id FROM proy_plantillas WHERE predeterminada = 1', [], 'pla:pred'))[0].id;
  const nicho = async (n) => (await db.query('SELECT id FROM proy_nichos WHERE nombre = ?', [n], 'pla:nicho'))[0].id;
  const nichoBancos = await nicho('Bancos y cooperativas');
  const [{ id: estructuraId }] = await db.query('SELECT id FROM proy_estructuras ORDER BY id LIMIT 1', [], 'pla:estructura');
  const [{ id: paisGT }] = await db.query("SELECT id FROM paises WHERE codigo = 'GT'", [], 'pla:pais');
  const [{ id: admin }] = await db.query('SELECT id FROM usuarios WHERE rol_id = 1 ORDER BY id LIMIT 1', [], 'pla:admin');
  const [{ id: gerente }] = await db.query("SELECT id FROM usuarios WHERE email = 'gerente@grupopremia.com'", [], 'pla:gerente');
  const [{ id: articulo }] = await db.query('SELECT id FROM proy_articulos WHERE activo = 1 ORDER BY id LIMIT 1', [], 'pla:articulo');
  const SUP = 13;
  const T1 = 1;

  const servidor = await levantar();
  const base = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;
  const llamar = async (metodo, ruta, { usuario = admin, permisos = PERM_ADMIN, cuerpo } = {}) => {
    const res = await fetch(base + ruta, { method: metodo, headers: { 'content-type': 'application/json', 'x-usuario': String(usuario), 'x-permisos': permisos.join(',') }, body: cuerpo === undefined || metodo === 'GET' ? undefined : JSON.stringify(cuerpo) });
    return { status: res.status, datos: await res.json().catch(() => null) };
  };
  const sup = (metodo, ruta, cuerpo) => llamar(metodo, ruta, { usuario: SUP, permisos: PERM_SUPERVISOR, cuerpo });
  const ger = (metodo, ruta, cuerpo) => llamar(metodo, ruta, { usuario: gerente, permisos: PERM_GERENTE, cuerpo });
  const clave = () => `pla-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const etapas = [{ nombre: 'Preparación', descripcion: 'Depurar contactos', duracionDiasHabiles: 5 }, { nombre: 'Contacto', descripcion: 'Primer contacto', duracionDiasHabiles: 5 }, { nombre: 'Seguimiento', descripcion: 'Cotizaciones', duracionDiasHabiles: 5 }, { nombre: 'Cierre', descripcion: 'Cerrar ventas', duracionDiasHabiles: 5 }];
  const plantilla = (extra = {}) => ({ nombre: 'PLA Completa', descripcion: 'Para pruebas', etapas, articuloId: articulo, existenciaSugerida: 420, topePorAsesor: 50, metaMonto: 80000, metaMoneda: 'GTQ',
    controles: { articulo: 'editable', existencia: 'obligatorio', meta: 'obligatorio', tope: 'bloqueado', fechas_etapas: 'editable' }, ...extra });
  const borrador = (extra = {}) => ({ nichoId: nichoBancos, anio: 2026, mes: 11, tiendaIds: [T1], fechaInicio: '2026-11-02', ...extra });
  await db.query('INSERT INTO proy_clientes (nombre, nombre_normalizado, nicho_id, pais_id, estructura_id, estado, creado_por) VALUES ?',
    [Array.from({ length: 12 }, (_, i) => [`PLA Banco ${i}`, `pla banco ${i}`, nichoBancos, paisGT, estructuraId, 'activa', admin])], 'pla:empresas');

  try {
    console.log('Plantillas · permisos y lista');
    prueba('sin proyectos.administrar no se ven las plantillas (403)', (await sup('GET', '/config/plantillas')).status === 403);
    prueba('ni se crean (403)', (await sup('POST', '/config/plantillas', plantilla())).status === 403);
    let r = await llamar('GET', '/config/plantillas');
    const semilla = r.datos.items.find(p => p.nombre === 'Proyecto mensual estándar');
    prueba('existe la plantilla «Proyecto mensual estándar»: predeterminada, 4 etapas de 5 días y 4 semanas', r.status === 200 && semilla && semilla.predeterminada && semilla.etapas.length === 4 && semilla.etapas.every(e => e.duracionDiasHabiles === 5) && semilla.duracionSemanas === 4, JSON.stringify(semilla));
    r = await sup('GET', '/proyectos/opciones');
    prueba('el supervisor ve las plantillas activas al crear un proyecto', r.status === 200 && r.datos.plantillas.some(p => p.nombre === 'Proyecto mensual estándar'));

    console.log('Plantillas · validación');
    r = await llamar('POST', '/config/plantillas', { cuerpo: { nombre: '  ', etapas: [] } });
    prueba('sin nombre ni etapas → 400', r.status === 400 && r.datos.campos.nombre && r.datos.campos.etapas, JSON.stringify(r.datos));
    r = await llamar('POST', '/config/plantillas', { cuerpo: plantilla({ etapas: [{ nombre: 'X', duracionDiasHabiles: 0 }] }) });
    prueba('una etapa de 0 días → 400 con la etapa marcada', r.status === 400 && !!r.datos.campos['etapas.0.duracionDiasHabiles']);
    r = await llamar('POST', '/config/plantillas', { cuerpo: plantilla({ controles: { articulo: 'a_la_fuerza' } }) });
    prueba('un modo de control inválido → 400', r.status === 400 && !!r.datos.campos['controles.articulo']);
    r = await llamar('POST', '/config/plantillas', { cuerpo: plantilla({ topePorAsesor: null }) });
    prueba('no se puede bloquear un dato que la plantilla no trae → 400', r.status === 400 && /debe tener un valor/.test(r.datos.campos['controles.tope'] || ''), JSON.stringify(r.datos));
    r = await llamar('POST', '/config/plantillas', { cuerpo: plantilla({ metaMonto: 5000, metaMoneda: 'XXX' }) });
    prueba('una meta con moneda inexistente → 400', r.status === 400 && !!r.datos.campos.metaMoneda);
    r = await llamar('POST', '/config/plantillas', { cuerpo: plantilla({ nombre: 'Proyecto mensual estándar' }) });
    prueba('un nombre repetido → 400', r.status === 400 && /Ya existe/.test(r.datos.campos.nombre));
    r = await llamar('POST', '/config/plantillas', { cuerpo: plantilla() });
    const completa = r.datos.item;
    prueba('crea la plantilla con sus etapas, la duración en semanas y los controles', r.status === 201 && completa.etapas.length === 4 && completa.duracionSemanas === 4 && completa.controles.tope === 'bloqueado' && completa.activa && !completa.predeterminada, JSON.stringify(r.datos));
    r = await llamar('PUT', `/config/plantillas/${completa.id}`, { cuerpo: { etapas: [...etapas, { nombre: 'Extra', descripcion: '', duracionDiasHabiles: 3 }] } });
    prueba('editar las etapas recalcula la duración (23 días hábiles → 5 semanas)', r.status === 200 && r.datos.item.etapas.length === 5 && r.datos.item.duracionSemanas === 5, JSON.stringify(r.datos));
    await llamar('PUT', `/config/plantillas/${completa.id}`, { cuerpo: { etapas } });
    r = await llamar('PUT', `/config/plantillas/${completa.id}`, { cuerpo: { predeterminada: true } });
    const lista = (await llamar('GET', '/config/plantillas')).datos.items;
    prueba('al marcarla predeterminada, la anterior deja de serlo (solo una)', r.status === 200 && lista.filter(p => p.predeterminada).length === 1 && lista.find(p => p.predeterminada).id === completa.id);
    r = await llamar('PATCH', `/config/plantillas/${completa.id}/activa`, { cuerpo: { activa: false } });
    prueba('no se desactiva la predeterminada (409)', r.status === 409);
    await llamar('PUT', `/config/plantillas/${semilla.id}`, { cuerpo: { predeterminada: true } });
    r = await llamar('POST', '/config/plantillas', { cuerpo: plantilla({ nombre: 'PLA Bloquea fechas', controles: { fechas_etapas: 'bloqueado', tope: 'editable' } }) });
    const conFechas = r.datos.item;
    r = await llamar('POST', '/config/plantillas', { cuerpo: plantilla({ nombre: 'PLA Apagada' }) });
    const apagada = r.datos.item;
    r = await llamar('PATCH', `/config/plantillas/${apagada.id}/activa`, { cuerpo: { activa: false } });
    prueba('una plantilla que no es la predeterminada sí se desactiva', r.status === 200 && r.datos.item.activa === false);
    r = await llamar('GET', '/config/historial?area=plantillas');
    prueba('cada cambio queda en el historial (crear, editar, activar/desactivar) con quién y antes/después', r.status === 200 && r.datos.items.length >= 5 && r.datos.items.every(i => i.area === 'Plantillas de proyecto') && r.datos.items.some(i => i.accionCodigo === 'editar' && i.cambios.length) && r.datos.items.some(i => i.accionCodigo === 'desactivar'), JSON.stringify(r.datos.items.slice(0, 2)));

    console.log('Proyecto con plantilla');
    r = await sup('POST', '/proyectos', borrador({ plantillaId: apagada.id }));
    prueba('una plantilla desactivada no se puede usar (400)', r.status === 400 && !!r.datos.campos.plantillaId);
    r = await sup('POST', '/proyectos', borrador({ plantillaId: completa.id }));
    const p1 = r.datos;
    prueba('el borrador toma de la plantilla el artículo, la existencia, el tope, la meta y las 4 etapas', r.status === 201 && p1.articuloId === articulo && p1.existenciaMuestras === 420 && p1.topePorAsesor === 50 && p1.metaMonto === 80000 && p1.metaMoneda === 'GTQ' && p1.etapas.length === 4 && p1.plantillaId === completa.id, JSON.stringify(r.datos));
    prueba('las etapas llevan fechas en días hábiles, una tras otra (2–6, 9–13, 16–20 y 23–27 de nov) y el fin del proyecto es el de la última',
      p1.etapas.map(e => `${e.fechaInicio}>${e.fechaFin}`).join() === '2026-11-02>2026-11-06,2026-11-09>2026-11-13,2026-11-16>2026-11-20,2026-11-23>2026-11-27' && p1.fechaFin === '2026-11-27', JSON.stringify(p1.etapas));
    r = await sup('PUT', `/proyectos/${p1.id}`, { topePorAsesor: 99 });
    prueba('un dato bloqueado por la plantilla no se puede cambiar: el servidor lo rechaza (400)', r.status === 400 && /fija la plantilla/.test(r.datos.campos.topePorAsesor), JSON.stringify(r.datos));
    r = await sup('PUT', `/proyectos/${p1.id}`, { topePorAsesor: 50, existenciaMuestras: 300 });
    prueba('lo editable sí se cambia y el bloqueado se acepta con su mismo valor', r.status === 200 && r.datos.existenciaMuestras === 300 && r.datos.topePorAsesor === 50);
    r = await sup('PUT', `/proyectos/${p1.id}`, { existenciaMuestras: null });
    prueba('un dato obligatorio puede quedar vacío en el borrador…', r.status === 200 && r.datos.existenciaMuestras === null);
    r = await sup('POST', `/proyectos/${p1.id}/activar`, { idempotencyKey: clave() });
    prueba('…pero no se activa sin completarlo: la plantilla lo exige (400)', r.status === 400 && /plantilla pide/.test(r.datos.campos.existenciaMuestras || ''), JSON.stringify(r.datos));
    await sup('PUT', `/proyectos/${p1.id}`, { existenciaMuestras: 420 });
    r = await sup('POST', '/proyectos', borrador({ plantillaId: conFechas.id, tiendaIds: [], etapas: [{ nombre: 'Preparación', fechaInicio: '2026-12-01', fechaFin: '2026-12-02' }] }));
    prueba('con las fechas de las etapas bloqueadas, el calendario lo fija la plantilla (ignora las fechas mandadas)', r.status === 201 && r.datos.etapas[0].fechaInicio === '2026-11-02' && r.datos.etapas[0].fechaFin === '2026-11-06', JSON.stringify(r.datos.etapas));
    await sup('POST', `/proyectos/${r.datos.id}/cancelar`, {});

    console.log('Foto de la configuración');
    r = await sup('POST', `/proyectos/${p1.id}/activar`, { idempotencyKey: clave() });
    const foto = (await db.query('SELECT config_snapshot FROM proy_proyectos WHERE id = ?', [p1.id], 'pla:foto'))[0].config_snapshot;
    const fotoObj = typeof foto === 'string' ? JSON.parse(foto) : foto;
    prueba('al activar se guarda la foto: parámetros, países del alcance y copia de la plantilla', r.status === 200 && fotoObj && fotoObj.version === 1 && fotoObj.parametros['reparto.afinidad_tienda'] !== undefined && fotoObj.paises.length === 1 && fotoObj.paises[0].codigo === 'GT' && fotoObj.plantilla.nombre === 'PLA Completa' && fotoObj.plantilla.etapas.length === 4, JSON.stringify(fotoObj && Object.keys(fotoObj)));
    prueba('la ficha del proyecto dice con qué plantilla se activó', r.datos.fotoConfiguracion && r.datos.fotoConfiguracion.plantilla === 'PLA Completa');
    await configService.guardar({ 'reparto.tope_por_asesor': 7 }, admin);
    const foto2 = (await db.query('SELECT config_snapshot FROM proy_proyectos WHERE id = ?', [p1.id], 'pla:foto2'))[0].config_snapshot;
    prueba('cambiar un ajuste después NO cambia la foto del proyecto ya activado', (typeof foto2 === 'string' ? JSON.parse(foto2) : foto2).parametros['reparto.tope_por_asesor'] === fotoObj.parametros['reparto.tope_por_asesor']);
    await configService.guardar({ 'reparto.tope_por_asesor': null }, admin).catch(() => {});
    const conGracia = (await db.query(`INSERT INTO proy_proyectos (codigo, nombre, nicho_id, anio, mes, estado, fecha_inicio, fecha_fin, activado_en, creado_por, config_snapshot)
       VALUES ('PLA-GRACIA', 'PLA con gracia larga', ?, 2026, 9, 'activo', '2026-09-01', '2026-10-30', NOW(), ?, ?)`, [nichoBancos, SUP, JSON.stringify({ version: 1, parametros: { 'vencimiento.gracia_dias_habiles': 30 } })], 'pla:gracia')).insertId;
    const sinFoto = (await db.query(`INSERT INTO proy_proyectos (codigo, nombre, nicho_id, anio, mes, estado, fecha_inicio, fecha_fin, activado_en, creado_por)
       VALUES ('PLA-SINFOTO', 'PLA sin foto', ?, 2026, 9, 'activo', '2026-09-01', '2026-10-30', NOW(), ?)`, [nichoBancos, SUP], 'pla:sinfoto')).insertId;
    r = await sup('GET', '/proyectos');
    prueba('el vencimiento usa los días de gracia de la foto (30 → no vencido) y, sin foto, los de hoy (3 → vencido)',
      r.datos.items.find(x => x.id === conGracia).vencido === false && r.datos.items.find(x => x.id === sinFoto).vencido === true, JSON.stringify(r.datos.items.map(x => [x.codigo, x.vencido])));
    await sup('POST', `/proyectos/${p1.id}/cancelar`, { motivo: 'Fin de la prueba' });

    console.log('Aprobación del gerente');
    r = await sup('POST', '/proyectos', borrador({ plantillaId: completa.id }));
    const a1 = r.datos;
    prueba('con la aprobación apagada, pedirla responde 409', (await sup('POST', `/proyectos/${a1.id}/pedir-aprobacion`)).status === 409);
    await configService.guardar({ 'reglas.aprobar_activacion': true }, admin);
    r = await sup('POST', `/proyectos/${a1.id}/activar`, { idempotencyKey: clave() });
    prueba('con la aprobación encendida, activar directo responde 409', r.status === 409 && /aprobación del gerente/.test(r.datos.error));
    await sup('PUT', `/proyectos/${a1.id}`, { fechaInicio: null });
    r = await sup('POST', `/proyectos/${a1.id}/pedir-aprobacion`);
    prueba('no se puede pedir la aprobación con datos incompletos (400)', r.status === 400 && !!r.datos.campos.fechaInicio, JSON.stringify(r.datos));
    await sup('PUT', `/proyectos/${a1.id}`, { fechaInicio: '2026-11-02' });
    prueba('un asesor sin proyectos.activar no puede pedirla (403)', (await llamar('POST', `/proyectos/${a1.id}/pedir-aprobacion`, { usuario: 49, permisos: ['proyectos.ver'] })).status === 403);
    r = await sup('POST', `/proyectos/${a1.id}/pedir-aprobacion`);
    prueba('pedirla deja el proyecto «esperando aprobación», con quién y cuándo', r.status === 200 && r.datos.estado === 'pendiente_aprobacion' && r.datos.aprobacionPedidaPor && r.datos.aprobacionPedidaEn, JSON.stringify(r.datos));
    r = await sup('PUT', `/proyectos/${a1.id}`, { metaMonto: 1 });
    prueba('mientras espera, el proyecto no se edita (409)', r.status === 409);
    r = await sup('POST', `/proyectos/${a1.id}/aprobar`, { idempotencyKey: clave() });
    prueba('el supervisor no puede aprobar (403)', r.status === 403);
    r = await ger('GET', `/proyectos/${a1.id}`);
    prueba('el gerente ve el proyecto que espera su aprobación', r.status === 200 && r.datos.estado === 'pendiente_aprobacion');
    r = await ger('GET', '/proyectos?estado=aprobacion');
    prueba('la cola de aprobaciones lo lista', r.datos.items.some(x => x.id === a1.id) && r.datos.conteos.aprobacion >= 1);
    r = await ger('POST', `/proyectos/${a1.id}/vista-previa`);
    prueba('el gerente ve la vista previa del reparto antes de aprobar', r.status === 200 && r.datos.totalEmpresas === 12 && r.datos.porAsesor.length === 6, JSON.stringify(r.datos));
    r = await ger('POST', `/proyectos/${a1.id}/rechazar`, {});
    prueba('rechazar sin comentario → 400', r.status === 400 && !!r.datos.campos.comentario);
    r = await ger('POST', `/proyectos/${a1.id}/rechazar`, { comentario: 'Falta la meta de ventas' });
    prueba('rechazar con comentario devuelve el proyecto a «borrador» con ese comentario', r.status === 200 && r.datos.estado === 'borrador' && r.datos.aprobacionComentario === 'Falta la meta de ventas', JSON.stringify(r.datos));
    prueba('rechazar un proyecto que ya no espera aprobación → 409', (await ger('POST', `/proyectos/${a1.id}/rechazar`, { comentario: 'otra vez' })).status === 409);
    await sup('POST', `/proyectos/${a1.id}/pedir-aprobacion`);
    const claveA = clave();
    r = await ger('POST', `/proyectos/${a1.id}/aprobar`, { idempotencyKey: claveA });
    prueba('aprobar activa y reparte en ese momento, a nombre del gerente', r.status === 200 && r.datos.estado === 'activo' && r.datos.empresas === 12 && r.datos.repetida === false && Number((await db.query('SELECT COUNT(*) AS n FROM proy_proyectos WHERE id = ? AND activado_por = ? AND aprobada_por = ?', [a1.id, gerente, gerente], 'pla:aprobada'))[0].n) === 1, JSON.stringify(r.datos));
    r = await ger('POST', `/proyectos/${a1.id}/aprobar`, { idempotencyKey: claveA });
    prueba('aprobar otra vez con la misma clave no reparte de nuevo', r.status === 200 && r.datos.repetida === true && Number((await db.query('SELECT COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ?', [a1.id], 'pla:n'))[0].n) === 12);
    prueba('aprobar con otra clave un proyecto ya activo → 409', (await ger('POST', `/proyectos/${a1.id}/aprobar`, { idempotencyKey: clave() })).status === 409);
    const acciones = (await db.query("SELECT accion FROM proy_historial WHERE proyecto_id = ? ORDER BY id", [a1.id], 'pla:hist')).map(x => x.accion);
    prueba('el historial del proyecto guarda crear, pedir, rechazar, pedir y aprobar', ['crear', 'pedir_aprobacion', 'rechazar', 'pedir_aprobacion', 'aprobar'].every((x, i) => acciones[i] === x), acciones.join());
    await sup('POST', `/proyectos/${a1.id}/cancelar`, { motivo: 'Fin de la prueba' });
    await configService.guardar({ 'reglas.aprobar_activacion': false }, admin);
  } finally {
    // Limpieza, pase lo que pase: nada de esta prueba debe quedar en la base.
    await db.query("DELETE FROM proy_proyectos WHERE (creado_en >= ? AND creado_por IN (?)) OR codigo LIKE 'PLA-%'", [inicio, [SUP, admin, gerente]], 'pla:limpiar_proyectos');
    await db.query("DELETE FROM proy_clientes WHERE nombre LIKE 'PLA %'", [], 'pla:limpiar_clientes');
    await db.query("DELETE FROM proy_plantillas WHERE nombre LIKE 'PLA %'", [], 'pla:limpiar_plantillas');
    await db.query('UPDATE proy_plantillas SET predeterminada = (id = ?)', [predeterminadaAntes], 'pla:restaurar_predeterminada');
    await db.query("DELETE FROM idempotency_keys WHERE idempotency_key LIKE 'proy-%' AND creado_en >= ?", [inicio], 'pla:limpiar_claves');
    await db.query('DELETE FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'pla:limpiar_ajustes');
    for (const { clave: c, valor } of ajustesAntes) await db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?)', [c, valor], 'pla:restaurar_ajuste');
    await db.query('DELETE FROM proy_config_historial WHERE creado_en >= ?', [inicio], 'pla:limpiar_historial');
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
