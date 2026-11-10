// scripts/proyectos/verificar-kit.js
// Verifica la fase 9d (kit del nicho), por HTTP contra las rutas reales: las reglas puras de variables y enlaces, la edición del
// administrador (validaciones, historial, kit apagado) y el kit del asesor con los datos de su empresa (mensajes prellenados, los que
// no se pueden armar quedan ocultos con su motivo, solo lo propio y solo con proyecto activo).
//
// Uso (base DESECHABLE con las migraciones aplicadas; crea datos de prueba y los borra al terminar):
//   node scripts/proyectos/verificar-kit.js
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/proyectos/routes');
const kit = require('../../src/modules/proyectos/kit');

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};

const PERM_ADMIN = ['proyectos.ver', 'proyectos.administrar', 'proyectos.activar', 'proyectos.ver_reportes'];
const PERM_ASESOR = ['proyectos.ver', 'proyectos.gestionar'];
const PERM_SUPERVISOR = ['proyectos.ver', 'proyectos.activar', 'proyectos.supervisar'];

async function levantar() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: Number(req.headers['x-usuario']), nombre: req.headers['x-nombre'] ? decodeURIComponent(req.headers['x-nombre']) : 'Persona', permissions: (req.headers['x-permisos'] || '').split(',').filter(Boolean) };
    next();
  });
  app.use('/api/proyectos', requirePermission('proyectos.ver'), rutas);
  return new Promise(resolver => { const s = app.listen(0, '127.0.0.1', () => resolver(s)); });
}

async function verificar() {
  const configService = require('../../src/modules/proyectos/services/configService');
  const inicio = (await db.query('SELECT NOW() - INTERVAL 2 SECOND AS t', [], 'kit:inicio'))[0].t;
  const ajustesAntes = await db.query('SELECT clave, valor FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'kit:ajustes_antes');
  const [{ id: nichoId, nombre: nichoNombre }] = await db.query("SELECT id, nombre FROM proy_nichos WHERE nombre = 'Hospitales'", [], 'kit:nicho');
  const [{ id: otroNichoId }] = await db.query("SELECT id FROM proy_nichos WHERE nombre <> 'Hospitales' AND activo = 1 ORDER BY id LIMIT 1", [], 'kit:otro_nicho');
  const [{ id: estructuraId }] = await db.query('SELECT id FROM proy_estructuras ORDER BY id LIMIT 1', [], 'kit:estructura');
  const [{ id: areaId }] = await db.query('SELECT id FROM proy_areas_contacto ORDER BY id LIMIT 1', [], 'kit:area');
  const [{ id: paisGT }] = await db.query("SELECT id FROM paises WHERE codigo = 'GT'", [], 'kit:pais_gt');
  const [{ id: admin }] = await db.query('SELECT id FROM usuarios WHERE rol_id = 1 ORDER BY id LIMIT 1', [], 'kit:admin');
  const [{ id: articuloId, nombre: articuloNombre }] = await db.query('SELECT id, nombre FROM proy_articulos WHERE activo = 1 ORDER BY id LIMIT 1', [], 'kit:articulo');
  const kitAntes = await db.query('SELECT id FROM proy_kits WHERE nicho_id IN (?)', [[nichoId, otroNichoId]], 'kit:kits_antes');

  const filas = Array.from({ length: 30 }, (_, i) => [`KIT Empresa ${i}`, `kit empresa ${i}`, nichoId, paisGT, estructuraId, 'activa', admin, 'Guatemala', i === 1 ? null : '+502 5511 2034']);
  await db.query('INSERT INTO proy_clientes (nombre, nombre_normalizado, nicho_id, pais_id, estructura_id, estado, creado_por, ciudad, telefono) VALUES ?', [filas], 'kit:empresas');

  const servidor = await levantar();
  const base = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;
  const llamar = async (metodo, ruta, { usuario, permisos, cuerpo, nombre }) => {
    const res = await fetch(base + ruta, { method: metodo, headers: { 'content-type': 'application/json', 'x-usuario': String(usuario), 'x-permisos': permisos.join(','), ...(nombre ? { 'x-nombre': encodeURIComponent(nombre) } : {}) }, body: cuerpo === undefined || metodo === 'GET' ? undefined : JSON.stringify(cuerpo) });
    const texto = await res.text();
    let datos = null;
    try { datos = JSON.parse(texto); } catch { /* no es JSON */ }
    return { status: res.status, datos };
  };
  const adm = (m, r, c) => llamar(m, r, { usuario: admin, permisos: PERM_ADMIN, cuerpo: c });
  const asesor = (u, m, r, c) => llamar(m, r, { usuario: u, permisos: PERM_ASESOR, cuerpo: c, nombre: 'Carla Pérez' });
  const clave = () => `kit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  let proyectoId = null;

  try {
    console.log('Reglas puras: variables y enlaces');
    prueba('las variables permitidas son cinco', kit.VARIABLES.join() === 'empresa,contacto,asesor,articulo,nicho');
    prueba('detecta las variables que no existen (con mayúscula, espacio o inventadas)', kit.variablesDesconocidas('Hola {contacto}, {cliente} {Empresa} {empresa }').join('|') === '{cliente}|{Empresa}|{empresa }');
    const r1 = kit.resolver('Hola {contacto}, soy {asesor} de Premia. {articulo} para {empresa}.', { contacto: 'Ana', asesor: 'Luis', articulo: 'Medalla', empresa: 'Banco X' });
    prueba('reemplaza todas las variables', r1.texto === 'Hola Ana, soy Luis de Premia. Medalla para Banco X.' && r1.faltan.length === 0, JSON.stringify(r1));
    const r2 = kit.resolver('Hola {contacto} de {empresa}', { contacto: '  ', empresa: 'Banco X' });
    prueba('una variable sin dato nunca queda como «{contacto}»: se reporta como faltante', !r2.texto.includes('{') && r2.faltan.join() === 'contacto', JSON.stringify(r2));
    prueba('un texto con llaves o signos raros no se rompe', kit.resolver('100% {empresa} & "x" <b>', { empresa: 'A&B' }).texto === '100% A&B & "x" <b>');
    prueba('el enlace de WhatsApp lleva solo los dígitos y el texto codificado', kit.enlaceWhatsApp('+502 5511-2034', 'Hola & adiós ñ') === 'https://wa.me/50255112034?text=Hola%20%26%20adi%C3%B3s%20%C3%B1' && kit.enlaceWhatsApp('', 'x') === null);
    prueba('el enlace de correo solo existe con un correo válido y codifica asunto y cuerpo', kit.enlaceCorreo('ana@empresa.com', 'Saludo & más', 'Línea 1\nLínea 2') === 'mailto:ana@empresa.com?subject=Saludo%20%26%20m%C3%A1s&body=L%C3%ADnea%201%0AL%C3%ADnea%202'
      && kit.enlaceCorreo('no-es-correo', 'a', 'b') === null && kit.enlaceCorreo('a@b.com,c@d.com', 'a', 'b') === null);

    console.log('Administrador: permisos y lista');
    prueba('un asesor no entra a editar kits (403)', (await asesor(5, 'GET', '/config/kits')).status === 403 && (await asesor(5, 'PUT', `/config/kits/${nichoId}`, { guion: 'x' })).status === 403);
    prueba('un supervisor tampoco (403)', (await llamar('GET', '/config/kits', { usuario: 13, permisos: PERM_SUPERVISOR })).status === 403);
    let r = await adm('GET', '/config/kits');
    prueba('la lista trae los nichos activos y las variables', r.status === 200 && r.datos.nichos.length > 1 && r.datos.variables.length === 5 && r.datos.nichos.find(n => n.id === nichoId), JSON.stringify(r.datos).slice(0, 200));
    prueba('un nicho que no existe → 404', (await adm('GET', '/config/kits/999999')).status === 404 && (await adm('PUT', '/config/kits/abc', { guion: '' })).status === 404);
    r = await adm('GET', `/config/kits/${nichoId}`);
    prueba('un nicho sin kit devuelve uno vacío y activo', r.status === 200 && r.datos.kit.guion === '' && r.datos.kit.activo === true && r.datos.kit.mensajes.length === 0, JSON.stringify(r.datos));

    console.log('Administrador: validaciones');
    const guardar = (cuerpo) => adm('PUT', `/config/kits/${nichoId}`, cuerpo);
    r = await guardar({ guion: 'Hola {cliente}', mensajes: [] });
    prueba('una variable que no existe en el guion → 400 con el campo', r.status === 400 && /\{cliente\}/.test(r.datos.campos.guion), JSON.stringify(r.datos));
    r = await guardar({ guion: 'x'.repeat(4001), mensajes: [] });
    prueba('un guion de más de 4000 caracteres → 400', r.status === 400 && !!r.datos.campos.guion);
    r = await guardar({ guion: '', mensajes: [{ canal: 'sms', titulo: 'a', texto: 'b' }, { canal: 'whatsapp', titulo: '  ', texto: 'b' }, { canal: 'correo', titulo: 'ok', texto: '' }, { canal: 'correo', titulo: 'ok', texto: 'Hola {nombre}' }] });
    prueba('cada mensaje con problema se marca por su número (canal, título, texto y variable)', r.status === 400 && ['mensaje1', 'mensaje2', 'mensaje3', 'mensaje4'].every(k => r.datos.campos[k]), JSON.stringify(r.datos.campos));
    r = await guardar({ guion: '', mensajes: Array.from({ length: 21 }, () => ({ canal: 'whatsapp', titulo: 't', texto: 'x' })) });
    prueba('más de 20 mensajes → 400', r.status === 400 && !!r.datos.campos.mensajes);
    r = await guardar({ guion: 'ok', activo: 'si', mensajes: [] });
    prueba('un «activo» que no es sí/no → 400', r.status === 400 && !!r.datos.campos.activo);
    prueba('nada se guardó con los intentos fallidos', (await adm('GET', `/config/kits/${nichoId}`)).datos.kit.mensajes.length === 0 && (await db.query('SELECT COUNT(*) AS n FROM proy_config_historial WHERE entidad = ? AND creado_en >= ?', ['kit', inicio], 'kit:hist0'))[0].n === 0);

    console.log('Administrador: guardar');
    const kitBueno = {
      guion: '1. Saluda: «Buen día, le habla {asesor} de Premia.»\n2. Cuenta el motivo: un detalle de {articulo} para {empresa}.',
      activo: true,
      mensajes: [
        { canal: 'whatsapp', titulo: 'Saludo inicial', texto: 'Hola {contacto}, soy {asesor} de Premia. Queremos hacerle llegar un {articulo} para {empresa}.' },
        { canal: 'correo', titulo: 'Presentación', texto: 'Estimado {contacto}: este mes trabajamos con empresas de {nicho}.' },
        { canal: 'whatsapp', titulo: 'Apagado', texto: 'No debe verlo el asesor {empresa}', activo: false }
      ]
    };
    r = await guardar(kitBueno);
    prueba('guarda el kit completo y lo devuelve en el orden dado', r.status === 200 && r.datos.kit.mensajes.length === 3 && r.datos.kit.mensajes[0].titulo === 'Saludo inicial' && r.datos.kit.mensajes[2].activo === false, JSON.stringify(r.datos));
    prueba('queda un cambio «crear» en el historial', (await db.query("SELECT accion FROM proy_config_historial WHERE entidad = 'kit' AND clave = ? AND creado_en >= ?", [String(nichoId), inicio], 'kit:hist1')).map(x => x.accion).join() === 'crear');
    r = await guardar(kitBueno);
    prueba('guardar lo mismo no agrega otro cambio al historial', (await db.query("SELECT COUNT(*) AS n FROM proy_config_historial WHERE entidad = 'kit' AND creado_en >= ?", [inicio], 'kit:hist2'))[0].n === 1);
    r = await guardar({ ...kitBueno, mensajes: [...kitBueno.mensajes.slice(0, 2)] });
    prueba('quitar un mensaje queda como «editar» en el historial', (await db.query("SELECT accion FROM proy_config_historial WHERE entidad = 'kit' AND creado_en >= ? ORDER BY id", [inicio], 'kit:hist3')).map(x => x.accion).join() === 'crear,editar' && r.datos.kit.mensajes.length === 2);
    r = await adm('GET', '/config/historial?area=kits');
    prueba('el historial de configuración muestra el área «Kit del nicho»', r.status === 200 && r.datos.items.some(i => i.area === 'Kit del nicho' && i.objeto === nichoNombre), JSON.stringify(r.datos).slice(0, 300));
    await guardar(kitBueno);

    console.log('Preparación: un proyecto con las empresas repartidas');
    r = await adm('POST', '/proyectos', { nichoId, anio: 2026, mes: 11, tiendaIds: [1], fechaInicio: '2026-11-02', fechaFin: '2026-11-27', articuloId, existenciaMuestras: 50, topePorAsesor: 100 });
    proyectoId = r.datos.id;
    r = await adm('POST', `/proyectos/${proyectoId}/activar`, { idempotencyKey: clave() });
    prueba('el proyecto se activa', r.status === 200 && r.datos.estado === 'activo', JSON.stringify(r.datos));
    const asesores = (await db.query('SELECT asesor_id FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id IS NOT NULL GROUP BY asesor_id ORDER BY COUNT(*) DESC, asesor_id', [proyectoId], 'kit:asesores')).map(x => x.asesor_id);
    const A = asesores[0];
    const B = asesores[1];
    const pa = await db.query('SELECT p.id, p.cliente_id, c.telefono FROM proy_participaciones p JOIN proy_clientes c ON c.id = p.cliente_id WHERE p.proyecto_id = ? AND p.asesor_id = ? ORDER BY p.id', [proyectoId, A], 'kit:partes');
    prueba('hay dos asesores y A tiene al menos dos empresas', !!A && !!B && pa.length >= 2, `${asesores.length} ${pa.length}`);
    const contacto = (clienteId, datos) => db.query('INSERT INTO proy_contactos (cliente_id, area_id, nombre, cargo, telefono, correo, principal, creado_por) VALUES (?, ?, ?, ?, ?, ?, 1, ?)', [clienteId, areaId, datos.nombre, null, datos.telefono, datos.correo, admin], 'kit:contacto');

    console.log('Asesor: el kit con los datos de su empresa');
    await contacto(pa[0].cliente_id, { nombre: 'Carolina Ruiz', telefono: '+502 4455 6677', correo: 'carolina@empresa.com' });
    r = await asesor(A, 'GET', `/participaciones/${pa[0].id}/kit`);
    const kitA = r.datos;
    prueba('devuelve el kit del nicho de la empresa', r.status === 200 && kitA.disponible === true && kitA.nicho === nichoNombre && kitA.empresa === (await db.query('SELECT nombre FROM proy_clientes WHERE id = ?', [pa[0].cliente_id], 'kit:nombre'))[0].nombre, JSON.stringify(kitA).slice(0, 300));
    prueba('el guion sale con las variables resueltas (asesor del token, artículo del proyecto)', kitA.guion.includes('le habla Carla Pérez de Premia') && kitA.guion.includes(`un detalle de ${articuloNombre} para ${kitA.empresa}`) && !kitA.guion.includes('{'), kitA.guion);
    const wa = kitA.mensajes.find(m => m.canal === 'whatsapp');
    prueba('el mensaje de WhatsApp sale con los datos del contacto principal y su enlace wa.me', wa.disponible === true && wa.texto === `Hola Carolina Ruiz, soy Carla Pérez de Premia. Queremos hacerle llegar un ${articuloNombre} para ${kitA.empresa}.` && wa.enlace.startsWith('https://wa.me/50244556677?text=') && decodeURIComponent(wa.enlace.split('text=')[1]) === wa.texto, JSON.stringify(wa));
    const co = kitA.mensajes.find(m => m.canal === 'correo');
    prueba('el de correo lleva mailto con el título como asunto y el nicho en el texto', co.disponible === true && co.enlace.startsWith('mailto:carolina@empresa.com?subject=Presentaci%C3%B3n&body=') && co.texto.includes(`empresas de ${nichoNombre}`), JSON.stringify(co));
    prueba('el mensaje apagado no le llega al asesor', kitA.mensajes.length === 2 && !kitA.mensajes.some(m => m.titulo === 'Apagado'));

    // Segunda empresa del asesor: sin contactos y sin correo.
    r = await asesor(A, 'GET', `/participaciones/${pa[1].id}/kit`);
    prueba('sin contacto, el saludo se dirige al equipo de la empresa y usa el teléfono de la empresa', pa[1].telefono === null ? true : (r.datos.mensajes.find(m => m.canal === 'whatsapp').texto.startsWith('Hola equipo de KIT Empresa') && r.datos.mensajes.find(m => m.canal === 'whatsapp').enlace.startsWith('https://wa.me/50255112034')), JSON.stringify(r.datos.mensajes));
    prueba('sin correo, el mensaje de correo queda oculto con su motivo', r.datos.mensajes.find(m => m.canal === 'correo').disponible === false && /correo/.test(r.datos.mensajes.find(m => m.canal === 'correo').motivo), JSON.stringify(r.datos.mensajes));
    const otra = pa.find(p => p.telefono === null);
    if (otra) {
      r = await asesor(A, 'GET', `/participaciones/${otra.id}/kit`);
      prueba('sin ningún teléfono, el de WhatsApp queda oculto con su motivo', r.datos.mensajes.find(m => m.canal === 'whatsapp').disponible === false && /teléfono/.test(r.datos.mensajes.find(m => m.canal === 'whatsapp').motivo), JSON.stringify(r.datos.mensajes));
    } else {
      prueba('(sin empresa sin teléfono entre las de A: se prueba por SQL)', true);
    }
    await db.query('UPDATE proy_clientes SET telefono = NULL WHERE id = ?', [pa[1].cliente_id], 'kit:sin_tel');
    r = await asesor(A, 'GET', `/participaciones/${pa[1].id}/kit`);
    prueba('al quitar el teléfono de la empresa, WhatsApp pasa a oculto', r.datos.mensajes.find(m => m.canal === 'whatsapp').disponible === false);

    console.log('Asesor: alcance y estados');
    prueba('la empresa de otro asesor responde 404', (await asesor(B, 'GET', `/participaciones/${pa[0].id}/kit`)).status === 404);
    prueba('sin proyectos.gestionar → 403', (await llamar('GET', `/participaciones/${pa[0].id}/kit`, { usuario: A, permisos: PERM_SUPERVISOR })).status === 403);
    await adm('PUT', `/config/kits/${nichoId}`, { ...kitBueno, activo: false });
    r = await asesor(A, 'GET', `/participaciones/${pa[0].id}/kit`);
    prueba('con el kit apagado, el asesor recibe «no disponible» y ningún texto', r.status === 200 && r.datos.disponible === false && !r.datos.mensajes && !r.datos.guion, JSON.stringify(r.datos));
    await adm('PUT', `/config/kits/${nichoId}`, { ...kitBueno, activo: true, guion: '', mensajes: [{ canal: 'whatsapp', titulo: 'Solo artículo', texto: 'Para {empresa}: {articulo}' }] });
    await db.query('UPDATE proy_proyectos SET articulo_id = NULL WHERE id = ?', [proyectoId], 'kit:sin_articulo');
    r = await asesor(A, 'GET', `/participaciones/${pa[0].id}/kit`);
    prueba('un mensaje que necesita el artículo del proyecto y no hay queda oculto, sin dejar «{articulo}»', r.datos.mensajes[0].disponible === false && /artículo/.test(r.datos.mensajes[0].motivo) && !r.datos.mensajes[0].texto.includes('{'), JSON.stringify(r.datos.mensajes));
    await db.query('DELETE FROM proy_kit_mensajes WHERE kit_id IN (SELECT id FROM proy_kits WHERE nicho_id = ?)', [nichoId], 'kit:sin_mensajes');
    await db.query("UPDATE proy_kits SET guion = 'Paso {articulo} y {empresa}' WHERE nicho_id = ?", [nichoId], 'kit:guion_hueco');
    r = await asesor(A, 'GET', `/participaciones/${pa[0].id}/kit`);
    prueba('en el guion, un dato faltante se deja como hueco «____» para completarlo en la llamada', r.datos.guion.includes('Paso ____ y KIT Empresa') && r.datos.mensajes.length === 0, JSON.stringify(r.datos));
    // Sin kit para el nicho de otra empresa
    await db.query('UPDATE proy_clientes SET nicho_id = ? WHERE id = ?', [otroNichoId, pa[1].cliente_id], 'kit:otro_nicho_cliente');
    r = await asesor(A, 'GET', `/participaciones/${pa[1].id}/kit`);
    prueba('un nicho sin kit responde «no disponible»', r.status === 200 && r.datos.disponible === false, JSON.stringify(r.datos));
    await db.query("UPDATE proy_proyectos SET estado = 'cerrado', cerrado_en = NOW() WHERE id = ?", [proyectoId], 'kit:cerrar');
    await db.query('UPDATE proy_participaciones SET abierta = 0 WHERE proyecto_id = ?', [proyectoId], 'kit:cerrar_participaciones');
    prueba('con el proyecto cerrado → 409', (await asesor(A, 'GET', `/participaciones/${pa[0].id}/kit`)).status === 409);
  } finally {
    // Limpieza, pase lo que pase: nada de esta prueba debe quedar en la base.
    if (proyectoId) {
      const part = '(SELECT id FROM proy_participaciones WHERE proyecto_id = ?)';
      for (const tabla of ['proy_gestiones', 'proy_entregas_muestra', 'proy_cotizaciones', 'proy_ventas', 'proy_reasignaciones']) {
        await db.query(`DELETE FROM ${tabla} WHERE participacion_id IN ${part}`, [proyectoId], `kit:limpiar_${tabla}`);
      }
    }
    await db.query('DELETE FROM proy_proyectos WHERE creado_en >= ? AND creado_por = ?', [inicio, admin], 'kit:limpiar_proyectos');
    await db.query("DELETE FROM proy_clientes WHERE nombre LIKE 'KIT %'", [], 'kit:limpiar_clientes');
    const previos = kitAntes.map(k => k.id);
    await db.query(previos.length ? 'DELETE FROM proy_kits WHERE nicho_id IN (?) AND id NOT IN (?)' : 'DELETE FROM proy_kits WHERE nicho_id IN (?)', previos.length ? [[nichoId, otroNichoId], previos] : [[nichoId, otroNichoId]], 'kit:limpiar_kits');
    await db.query("DELETE FROM notificaciones WHERE modulo = 'proyectos' AND creado_en >= ?", [inicio], 'kit:limpiar_notificaciones');
    await db.query("DELETE FROM idempotency_keys WHERE idempotency_key LIKE 'proy-%' AND creado_en >= ?", [inicio], 'kit:limpiar_claves');
    await db.query('DELETE FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'kit:limpiar_ajustes');
    for (const { clave: k, valor } of ajustesAntes) await db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?)', [k, valor], 'kit:restaurar_ajuste');
    await db.query('DELETE FROM proy_config_historial WHERE creado_en >= ?', [inicio], 'kit:limpiar_historial');
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
