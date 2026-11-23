// scripts/proyectos/verificar-vales.js
// Verifica la integración con Vales de Arte (fase 7), por HTTP contra las rutas reales: los datos que prellenan el vale (solo el
// dueño, solo con permiso, solo con proyecto activo), el vínculo del vale creado con la empresa (un vale ajeno o inexistente no se
// liga, repetir la liga no duplica, un vale no pasa a otra empresa) y que el vale ligado sale en el historial de la empresa.
//
// Uso (base DESECHABLE con las migraciones aplicadas; crea datos de prueba y los borra al terminar):
//   node scripts/proyectos/verificar-vales.js
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

const PERM_ADMIN = ['proyectos.ver', 'proyectos.administrar', 'proyectos.activar'];
const PERM_SUPERVISOR = ['proyectos.ver', 'proyectos.activar', 'proyectos.supervisar'];
const PERM_ASESOR = ['proyectos.ver', 'proyectos.gestionar'];
const PERM_ASESOR_VALES = ['proyectos.ver', 'proyectos.gestionar', 'vales.crear'];

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
  const inicio = (await db.query('SELECT NOW() - INTERVAL 2 SECOND AS t', [], 'val:inicio'))[0].t;
  const ajustesAntes = await db.query('SELECT clave, valor FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'val:ajustes_antes');
  const [{ id: nichoId }] = await db.query("SELECT id FROM proy_nichos WHERE nombre = 'Hospitales'", [], 'val:nicho');
  const [{ id: estructuraId }] = await db.query('SELECT id FROM proy_estructuras ORDER BY id LIMIT 1', [], 'val:estructura');
  const [{ id: paisGT }] = await db.query("SELECT id FROM paises WHERE codigo = 'GT'", [], 'val:pais');
  const [{ id: admin }] = await db.query('SELECT id FROM usuarios WHERE rol_id = 1 ORDER BY id LIMIT 1', [], 'val:admin');
  const [{ id: articulo }] = await db.query('SELECT id FROM proy_articulos WHERE activo = 1 ORDER BY id LIMIT 1', [], 'val:articulo');
  const [{ id: area }] = await db.query('SELECT id FROM proy_areas_contacto WHERE activo = 1 ORDER BY id LIMIT 1', [], 'val:area');
  const [{ id: estadoVale }] = await db.query('SELECT id FROM estados_vale ORDER BY id LIMIT 1', [], 'val:estado_vale');
  const [{ id: canal }] = await db.query("SELECT id FROM proy_canales WHERE nombre = 'Llamada'", [], 'val:canal');
  const [{ id: rInteresa }] = await db.query("SELECT id FROM proy_resultados_gestion WHERE nombre = 'Pide cotización'", [], 'val:resultado');
  const SUP = 13;

  await db.query('INSERT INTO proy_clientes (nombre, nombre_normalizado, nicho_id, pais_id, estructura_id, estado, creado_por, telefono) VALUES ?',
    [Array.from({ length: 12 }, (_, i) => [`VAL Hospital ${i}`, `val hospital ${i}`, nichoId, paisGT, estructuraId, 'activa', admin, '+502 7765 4400'])], 'val:empresas');

  const servidor = await levantar();
  const base = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;
  const llamar = async (metodo, ruta, { usuario, permisos, cuerpo }) => {
    const res = await fetch(base + ruta, { method: metodo, headers: { 'content-type': 'application/json', 'x-usuario': String(usuario), 'x-permisos': permisos.join(',') }, body: cuerpo === undefined || metodo === 'GET' ? undefined : JSON.stringify(cuerpo) });
    return { status: res.status, datos: await res.json().catch(() => null) };
  };
  const adm = (m, r, c) => llamar(m, r, { usuario: admin, permisos: PERM_ADMIN, cuerpo: c });
  const sup = (m, r, c) => llamar(m, r, { usuario: SUP, permisos: PERM_SUPERVISOR, cuerpo: c });
  const asesor = (m, r, c, u, permisos = PERM_ASESOR_VALES) => llamar(m, r, { usuario: u, permisos, cuerpo: c });
  const clave = () => `val-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const crearVale = async (asesorId, correlativo) => (await db.query(
    `INSERT INTO vales (correlativo, asesor_id, tienda_id, fecha_creacion, hora_creacion, fecha_entrega, fecha_evento, cliente_nombre, cliente_telefono, cliente_correo, producto, material, cantidad, cotizacion, estado_id)
     VALUES (?, ?, 1, CURDATE(), CURTIME(), NOW(), NOW(), 'Cliente de prueba', '+502 1111 1111', 'a@b.com', 'Trofeo', 'Acrílico', 1, 100, ?)`, [correlativo, asesorId, estadoVale], 'val:vale')).insertId;
  let proyectoId = null;
  const vales = [];

  try {
    console.log('Preparación: un proyecto activo con 12 empresas');
    let r = await adm('POST', '/proyectos', { nichoId, anio: 2026, mes: 11, tiendaIds: [1], fechaInicio: '2026-11-02', fechaFin: '2026-11-27', articuloId: articulo, existenciaMuestras: 10, topePorAsesor: 100 });
    proyectoId = r.datos && r.datos.id;
    r = await adm('POST', `/proyectos/${proyectoId}/activar`, { idempotencyKey: clave() });
    prueba('el proyecto se activa y reparte las 12 empresas', r.status === 200 && r.datos.estado === 'activo' && r.datos.empresas === 12, JSON.stringify(r.datos));
    const asesores = (await db.query('SELECT DISTINCT asesor_id FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id IS NOT NULL ORDER BY asesor_id', [proyectoId], 'val:asesores')).map(x => x.asesor_id);
    const [A, B] = asesores;
    const de = async (u) => (await db.query('SELECT id, cliente_id FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id = ? ORDER BY id', [proyectoId, u], 'val:de')).map(x => ({ id: x.id, clienteId: x.cliente_id }));
    const [pa1, pa2] = await de(A);
    const [pb1] = await de(B);

    console.log('Prefill');
    r = await llamar('GET', `/participaciones/${pa1.id}/prefill-vale`, { usuario: SUP, permisos: PERM_SUPERVISOR });
    prueba('sin proyectos.gestionar no se piden los datos (403)', r.status === 403);
    r = await asesor('GET', `/participaciones/${pa1.id}/prefill-vale`, undefined, B);
    prueba('un asesor no pide los datos de la empresa de otro (404)', r.status === 404);
    prueba('una empresa que no existe responde 404', (await asesor('GET', '/participaciones/99999999/prefill-vale', undefined, A)).status === 404);
    r = await asesor('GET', `/participaciones/${pa1.id}/prefill-vale`, undefined, A);
    prueba('sin contactos se usa el nombre y el teléfono de la empresa, ya separado en prefijo y número', r.status === 200 && r.datos.empresa.nombre.startsWith('VAL Hospital') && r.datos.contacto.nombre === r.datos.empresa.nombre && r.datos.contacto.telefonoPrefijo === '+502' && r.datos.contacto.telefono === '7765 4400' && r.datos.referencia === null && r.datos.descripcion === '', JSON.stringify(r.datos));
    await db.query('INSERT INTO proy_contactos (cliente_id, area_id, nombre, cargo, telefono, correo, principal, activo, creado_por) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?), (?, ?, ?, ?, ?, ?, 1, 1, ?)',
      [pa1.clienteId, area, 'Rodrigo Pérez', 'Gerencia', null, null, admin, pa1.clienteId, area, 'Marta López', 'Compras', '+502 5511 2034', 'marta@cooperativa.com.gt', admin], 'val:contactos');
    r = await asesor('POST', `/participaciones/${pa1.id}/gestiones`, { canalId: canal, resultadoId: rInteresa, nota: 'Pidió precios de 200 medallas', idempotencyKey: clave() }, A);
    r = await asesor('GET', `/participaciones/${pa1.id}/prefill-vale`, undefined, A);
    prueba('con contacto principal trae su nombre, teléfono y correo, y la nota de la gestión como descripción', r.datos.contacto.nombre === 'Marta López' && r.datos.contacto.telefonoPrefijo === '+502' && r.datos.contacto.telefono === '5511 2034' && r.datos.contacto.correo === 'marta@cooperativa.com.gt' && r.datos.descripcion === 'Pidió precios de 200 medallas', JSON.stringify(r.datos));
    await asesor('POST', `/participaciones/${pa1.id}/cotizaciones`, { monto: 12500, referencia: 'COT-1180', nota: '200 medallas · aniversario', idempotencyKey: clave() }, A);
    r = await asesor('GET', `/participaciones/${pa1.id}/prefill-vale`, undefined, A);
    prueba('la referencia es la de la cotización vigente y la descripción, su nota', r.datos.referencia === 'COT-1180' && r.datos.descripcion === '200 medallas · aniversario', JSON.stringify(r.datos));
    await asesor('POST', `/participaciones/${pa1.id}/ventas`, { monto: 11800, referencia: 'OV-5231', idempotencyKey: clave() }, A);
    r = await asesor('GET', `/participaciones/${pa1.id}/prefill-vale`, undefined, A);
    prueba('con una venta, la referencia es la de la venta', r.datos.referencia === 'OV-5231', JSON.stringify(r.datos));
    prueba('la dirección no necesita datos personales: solo viaja el id de la participación', !JSON.stringify(r.datos).includes('undefined') && r.datos.participacionId === pa1.id);

    console.log('Vincular');
    const valeA = await crearVale(A, 'VAL-TEST-1'); vales.push(valeA);
    const valeA2 = await crearVale(A, 'VAL-TEST-2'); vales.push(valeA2);
    const valeB = await crearVale(B, 'VAL-TEST-3'); vales.push(valeB);
    r = await asesor('POST', `/participaciones/${pa1.id}/vincular-vale`, { idempotencyKey: clave() }, A);
    prueba('sin indicar el vale → 400', r.status === 400 && !!r.datos.campos.valeId);
    r = await asesor('POST', `/participaciones/${pa1.id}/vincular-vale`, { valeId: 99999999 }, A);
    prueba('un vale que no existe → 404', r.status === 404);
    r = await asesor('POST', `/participaciones/${pa1.id}/vincular-vale`, { valeId: valeB }, A);
    prueba('un vale de otro asesor → 404, igual que uno que no existe', r.status === 404);
    r = await asesor('POST', `/participaciones/${pa1.id}/vincular-vale`, { valeId: valeA }, B);
    prueba('otro asesor no liga vales a una empresa que no es suya (404)', r.status === 404);
    r = await llamar('POST', `/participaciones/${pa1.id}/vincular-vale`, { usuario: A, permisos: ['proyectos.ver'], cuerpo: { valeId: valeA } });
    prueba('sin proyectos.gestionar no se liga (403)', r.status === 403);
    r = await asesor('POST', `/participaciones/${pa1.id}/vincular-vale`, { valeId: valeA }, A);
    prueba('ligar el vale propio funciona: sale en el historial de la empresa con su correlativo', r.status === 200 && r.datos.repetida === false && r.datos.vale.correlativo === 'VAL-TEST-1' && r.datos.historial.some(h => h.tipo === 'vale' && h.correlativo === 'VAL-TEST-1'), JSON.stringify(r.datos.historial.slice(0, 2)));
    prueba('la ficha dice que puede crear vales (con vales.crear) y lo oculta sin ese permiso', r.datos.registro.puedeCrearVale === true && (await asesor('GET', `/participaciones/${pa1.id}`, undefined, A, PERM_ASESOR)).datos.registro.puedeCrearVale === false);
    r = await asesor('POST', `/participaciones/${pa1.id}/vincular-vale`, { valeId: valeA }, A);
    prueba('repetir la misma liga responde bien y no duplica', r.status === 200 && r.datos.repetida === true && Number((await db.query('SELECT COUNT(*) AS n FROM proy_vales WHERE vale_id = ?', [valeA], 'val:cuenta'))[0].n) === 1);
    r = await asesor('POST', `/participaciones/${pa2.id}/vincular-vale`, { valeId: valeA }, A);
    prueba('un vale ya ligado a una empresa no pasa a otra (409)', r.status === 409);
    r = await asesor('POST', `/participaciones/${pa1.id}/vincular-vale`, { valeId: valeA2 }, A);
    prueba('una empresa puede tener varios vales', r.status === 200 && r.datos.historial.filter(h => h.tipo === 'vale').length === 2);
    const acciones = (await db.query("SELECT COUNT(*) AS n FROM proy_historial WHERE proyecto_id = ? AND accion = 'vincular_vale'", [proyectoId], 'val:historial'))[0].n;
    prueba('cada liga queda en el historial del proyecto (la repetida no suma)', Number(acciones) === 2, String(acciones));
    r = await sup('GET', `/participaciones/${pa1.id}/supervision`);
    prueba('el supervisor también ve los vales ligados en su vista de la empresa', r.status === 200 && r.datos.historial.some(h => h.tipo === 'vale'), JSON.stringify(r.datos.historial.length));
    await db.query('DELETE FROM vales WHERE id = ?', [valeA2], 'val:borrar_vale');
    vales.splice(vales.indexOf(valeA2), 1);
    prueba('si el vale se borra en Vales, su liga desaparece sola', Number((await db.query('SELECT COUNT(*) AS n FROM proy_vales WHERE vale_id = ?', [valeA2], 'val:cuenta2'))[0].n) === 0);

    console.log('Proyecto cerrado');
    await db.query("UPDATE proy_proyectos SET estado = 'cerrado', cerrado_en = NOW() WHERE id = ?", [proyectoId], 'val:cerrar');
    await db.query('UPDATE proy_participaciones SET abierta = 0 WHERE proyecto_id = ?', [proyectoId], 'val:cerrar_participaciones');
    r = await asesor('GET', `/participaciones/${pa2.id}/prefill-vale`, undefined, A);
    prueba('con el proyecto cerrado ya no se crean vales desde ahí (409)', r.status === 409);
    r = await asesor('GET', `/participaciones/${pa1.id}`, undefined, A);
    prueba('y la ficha deja de ofrecer «Crear vale»', r.status === 200 && r.datos.registro.puedeCrearVale === false);
    void pb1;
  } finally {
    // Limpieza, pase lo que pase: nada de esta prueba debe quedar en la base.
    if (vales.length) await db.query('DELETE FROM vales WHERE id IN (?)', [vales], 'val:limpiar_vales');
    await db.query("DELETE FROM vales WHERE correlativo LIKE 'VAL-TEST-%'", [], 'val:limpiar_vales2');
    if (proyectoId) {
      const part = '(SELECT id FROM proy_participaciones WHERE proyecto_id = ?)';
      for (const tabla of ['proy_gestiones', 'proy_entregas_muestra', 'proy_cotizaciones', 'proy_ventas', 'proy_reasignaciones', 'proy_vales']) {
        await db.query(`DELETE FROM ${tabla} WHERE participacion_id IN ${part}`, [proyectoId], `val:limpiar_${tabla}`);
      }
    }
    await db.query('DELETE FROM proy_proyectos WHERE creado_en >= ? AND creado_por = ?', [inicio, admin], 'val:limpiar_proyectos');
    await db.query("DELETE FROM proy_contactos WHERE cliente_id IN (SELECT id FROM proy_clientes WHERE nombre LIKE 'VAL %')", [], 'val:limpiar_contactos');
    await db.query("DELETE FROM proy_clientes WHERE nombre LIKE 'VAL %'", [], 'val:limpiar_clientes');
    await db.query("DELETE FROM notificaciones WHERE modulo = 'proyectos' AND creado_en >= ?", [inicio], 'val:limpiar_notificaciones');
    await db.query("DELETE FROM idempotency_keys WHERE idempotency_key LIKE 'proy-%' AND creado_en >= ?", [inicio], 'val:limpiar_claves');
    await db.query('DELETE FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'val:limpiar_ajustes');
    for (const { clave: k, valor } of ajustesAntes) await db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?)', [k, valor], 'val:restaurar_ajuste');
    await db.query('DELETE FROM proy_config_historial WHERE creado_en >= ?', [inicio], 'val:limpiar_historial');
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
