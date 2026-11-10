// scripts/proyectos/verificar-ganados.js
// Verifica la fase 9c, por HTTP contra las rutas reales: los enlaces de Google Maps (puros), la ruta de «Para hoy» (paradas con
// dirección en el orden de la hora, las que no tienen dirección se cuentan aparte) y la cartera de clientes ganados (alcance por rol,
// lo anulado y rechazado no cuenta, totales por moneda, recompra sugerida, filtros, exportación y el prellenado del vale de recompra).
//
// Uso (base DESECHABLE con las migraciones aplicadas; crea datos de prueba y los borra al terminar):
//   node scripts/proyectos/verificar-ganados.js
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/proyectos/routes');
const { enlaceDeLugar, enlaceDeRuta, textoDeLugar, MAX_PARADAS } = require('../../src/modules/proyectos/mapas');
const { leer } = require('../../src/modules/proyectos/csv');

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};

const PERM_ADMIN = ['proyectos.ver', 'proyectos.administrar', 'proyectos.activar', 'proyectos.ver_reportes'];
const PERM_SUPERVISOR = ['proyectos.ver', 'proyectos.activar', 'proyectos.supervisar', 'proyectos.corregir', 'proyectos.ver_reportes'];
const PERM_SUPERVISOR_SIN_REPORTES = ['proyectos.ver', 'proyectos.activar', 'proyectos.supervisar'];
const PERM_GERENTE = ['proyectos.ver', 'proyectos.ver_gerencia', 'proyectos.ver_reportes'];
const PERM_ASESOR = ['proyectos.ver', 'proyectos.gestionar'];
const PERM_SIN_ROL = ['proyectos.ver'];

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
  const inicio = (await db.query('SELECT NOW() - INTERVAL 2 SECOND AS t', [], 'gan:inicio'))[0].t;
  const ajustesAntes = await db.query('SELECT clave, valor FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'gan:ajustes_antes');
  const [{ id: nichoId }] = await db.query("SELECT id FROM proy_nichos WHERE nombre = 'Hospitales'", [], 'gan:nicho');
  const [{ id: estructuraId }] = await db.query('SELECT id FROM proy_estructuras ORDER BY id LIMIT 1', [], 'gan:estructura');
  const [{ id: paisGT }] = await db.query("SELECT id FROM paises WHERE codigo = 'GT'", [], 'gan:pais_gt');
  const [{ id: admin }] = await db.query('SELECT id FROM usuarios WHERE rol_id = 1 ORDER BY id LIMIT 1', [], 'gan:admin');
  const [{ id: gerente }] = await db.query("SELECT id FROM usuarios WHERE email = 'gerente@grupopremia.com'", [], 'gan:gerente');
  const [{ id: articulo }] = await db.query('SELECT id FROM proy_articulos WHERE activo = 1 ORDER BY id LIMIT 1', [], 'gan:articulo');
  const SUP = 13; // supervisa las tiendas 1 y 2
  const hoyGT = new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);

  const filas = Array.from({ length: 40 }, (_, i) => [`GAN Empresa ${i}`, `gan empresa ${i}`, nichoId, paisGT, estructuraId, 'activa', admin, 'Guatemala']);
  await db.query('INSERT INTO proy_clientes (nombre, nombre_normalizado, nicho_id, pais_id, estructura_id, estado, creado_por, ciudad) VALUES ?', [filas], 'gan:empresas');

  const servidor = await levantar();
  const base = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;
  const llamar = async (metodo, ruta, { usuario, permisos, cuerpo }) => {
    const res = await fetch(base + ruta, { method: metodo, headers: { 'content-type': 'application/json', 'x-usuario': String(usuario), 'x-permisos': permisos.join(',') }, body: cuerpo === undefined || metodo === 'GET' ? undefined : JSON.stringify(cuerpo) });
    const texto = Buffer.from(await res.arrayBuffer()).toString('utf8');
    let datos = null;
    try { datos = JSON.parse(texto); } catch { /* es un CSV */ }
    return { status: res.status, texto, datos };
  };
  const adm = (m, r, c) => llamar(m, r, { usuario: admin, permisos: PERM_ADMIN, cuerpo: c });
  const sup = (m, r, c) => llamar(m, r, { usuario: SUP, permisos: PERM_SUPERVISOR, cuerpo: c });
  const ger = (m, r, c) => llamar(m, r, { usuario: gerente, permisos: PERM_GERENTE, cuerpo: c });
  const asesor = (u, m, r, c) => llamar(m, r, { usuario: u, permisos: PERM_ASESOR, cuerpo: c });
  const clave = () => `gan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  let proyectoId = null;

  try {
    console.log('Enlaces de Google Maps (puros)');
    prueba('una empresa con dirección da su enlace de búsqueda, bien codificado', enlaceDeLugar({ direccion: '6a Avenida 12-34 Z.1', ciudad: 'Guatemala', pais: 'Guatemala' }) === 'https://www.google.com/maps/search/?api=1&query=6a%20Avenida%2012-34%20Z.1%2C%20Guatemala%2C%20Guatemala');
    prueba('sin dirección no hay enlace (aunque tenga ciudad)', enlaceDeLugar({ direccion: '  ', ciudad: 'Guatemala', pais: 'Guatemala' }) === null && textoDeLugar({ ciudad: 'X' }) === null);
    const ruta2 = enlaceDeRuta([{ direccion: 'A 1', ciudad: 'GT', pais: 'Guatemala' }, { direccion: 'B 2', ciudad: 'GT', pais: 'Guatemala' }, { direccion: 'C 3', ciudad: 'GT', pais: 'Guatemala' }]);
    prueba('la ruta lleva la última parada como destino y las demás como paradas, en orden', ruta2.includes('destination=C%203%2C%20GT%2C%20Guatemala') && ruta2.includes('waypoints=A%201%2C%20GT%2C%20Guatemala%7CB%202%2C%20GT%2C%20Guatemala') && ruta2.startsWith('https://www.google.com/maps/dir/?api=1'), ruta2);
    prueba('una sola parada abre el lugar; ninguna no da enlace', enlaceDeRuta([{ direccion: 'A 1' }]).includes('/search/') && enlaceDeRuta([{ ciudad: 'GT' }]) === null);
    prueba('Maps admite hasta 10 lugares: lo demás se corta', MAX_PARADAS === 10 && decodeURIComponent(enlaceDeRuta(Array.from({ length: 14 }, (_, i) => ({ direccion: `D${i}` })))).split('|').length === 9);
    prueba('un texto con caracteres raros no rompe la dirección del enlace', enlaceDeLugar({ direccion: 'Calle "Z" & <b>x</b>' }).split('query=')[1].split('&').length === 1 && enlaceDeLugar({ direccion: 'Calle "Z" & <b>x</b>' }).includes('%26'));

    console.log('Preparación: un proyecto en las tiendas 1 y 3');
    let r = await adm('POST', '/proyectos', { nichoId, anio: 2026, mes: 11, tiendaIds: [1, 3], fechaInicio: '2026-11-02', fechaFin: '2026-11-27', articuloId: articulo, existenciaMuestras: 50, topePorAsesor: 100 });
    proyectoId = r.datos.id;
    r = await adm('POST', `/proyectos/${proyectoId}/activar`, { idempotencyKey: clave() });
    prueba('el proyecto se activa y reparte las 40 empresas', r.status === 200 && r.datos.estado === 'activo' && r.datos.empresas === 40, JSON.stringify(r.datos));
    const asesoresT1 = (await db.query('SELECT asesor_id FROM proy_participaciones WHERE proyecto_id = ? AND tienda_id = 1 AND asesor_id IS NOT NULL GROUP BY asesor_id ORDER BY COUNT(*) DESC, asesor_id', [proyectoId], 'gan:as1')).map(x => x.asesor_id);
    const asesoresT3 = (await db.query('SELECT DISTINCT asesor_id FROM proy_participaciones WHERE proyecto_id = ? AND tienda_id = 3 AND asesor_id IS NOT NULL ORDER BY asesor_id', [proyectoId], 'gan:as3')).map(x => x.asesor_id);
    const A = asesoresT1[0];
    const B = asesoresT3[0];
    const delAsesor = async (u) => (await db.query('SELECT id, cliente_id FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id = ? ORDER BY id', [proyectoId, u], 'gan:partes'));
    const pa = await delAsesor(A);
    const pb = await delAsesor(B);
    prueba('hay asesores de las dos tiendas con al menos tres empresas cada uno', !!A && !!B && A !== B && pa.length >= 3 && pb.length >= 1, `${pa.length} ${pb.length}`);

    console.log('Ruta de Para hoy');
    // Dos empresas de hoy con dirección (la de las 14:30 se creó primero: el orden es por hora), una de hoy sin dirección y una de mañana con dirección.
    await db.query('UPDATE proy_clientes SET direccion = ? WHERE id = ?', ['5a Calle 7-10 Z.9', pa[0].cliente_id], 'gan:dir0');
    await db.query('UPDATE proy_clientes SET direccion = ? WHERE id = ?', ['Diagonal 6 10-01 Z.10', pa[1].cliente_id], 'gan:dir1');
    await db.query('UPDATE proy_clientes SET direccion = ? WHERE id = ?', ['Ruta 1 Km 5', pa[3] ? pa[3].cliente_id : pa[2].cliente_id], 'gan:dir3');
    await db.query('UPDATE proy_participaciones SET proxima_gestion_en = ? WHERE id = ?', [`${hoyGT} 14:30:00`, pa[0].id], 'gan:hoy0');
    await db.query('UPDATE proy_participaciones SET proxima_gestion_en = ? WHERE id = ?', [`${hoyGT} 09:00:00`, pa[1].id], 'gan:hoy1');
    await db.query('UPDATE proy_participaciones SET proxima_gestion_en = ? WHERE id = ?', [`${hoyGT} 11:00:00`, pa[2].id], 'gan:hoy2');
    r = await asesor(A, 'GET', '/mi-proyecto/para-hoy');
    const ruta = r.datos.ruta;
    prueba('la ruta lista las empresas de hoy con dirección, en el orden de su hora', r.status === 200 && ruta.paradas.length === 2 && ruta.paradas[0].id === pa[1].id && ruta.paradas[1].id === pa[0].id, JSON.stringify(ruta));
    prueba('la de hoy sin dirección se cuenta aparte y no entra en la ruta', ruta.sinDireccion === 1 && !ruta.paradas.some(p => p.id === pa[2].id), JSON.stringify(ruta));
    prueba('el enlace de la ruta lleva las dos paradas con su dirección completa', ruta.enlace && decodeURIComponent(ruta.enlace).includes('Diagonal 6 10-01 Z.10, Guatemala, Guatemala') && decodeURIComponent(ruta.enlace).includes('destination=5a Calle 7-10 Z.9'), ruta.enlace);
    const filaConDir = r.datos.hoy.find(f => f.id === pa[0].id);
    const filaSinDir = r.datos.hoy.find(f => f.id === pa[2].id);
    prueba('cada empresa con dirección trae «Cómo llegar»; la que no tiene dirección no', !!filaConDir.enlaceMapa && filaConDir.tieneDireccion === true && filaSinDir.enlaceMapa === null && filaSinDir.tieneDireccion === false);
    prueba('una empresa de mañana con dirección no entra en la ruta de hoy', !ruta.paradas.some(p => pa[3] && p.id === pa[3].id));
    r = await asesor(B, 'GET', '/mi-proyecto/para-hoy');
    prueba('otro asesor no ve la ruta de A: la suya está vacía', r.datos.ruta.paradas.length === 0 && r.datos.ruta.enlace === null);

    console.log('Clientes ganados: alcance y lo que cuenta');
    const vender = (u, p, monto, moneda, referencia) => asesor(u, 'POST', `/participaciones/${p}/ventas`, { monto, moneda, referencia, idempotencyKey: clave() });
    prueba('A vende dos veces a una empresa (GTQ y USD) y una vez a otra', (await vender(A, pa[0].id, 200.5, 'GTQ', 'GAN-A1')).status === 201 && (await vender(A, pa[0].id, 50, 'USD', 'GAN-A2')).status === 201 && (await vender(A, pa[1].id, 80, 'GTQ', 'GAN-A3')).status === 201);
    prueba('A vende otra más que luego se anula y otra que se rechaza: no cuentan', (await vender(A, pa[2].id, 999, 'GTQ', 'GAN-MALA')).status === 201);
    await db.query("UPDATE proy_ventas SET anulada_en = NOW(), anulada_por = ?, anulacion_motivo = 'prueba' WHERE referencia = 'GAN-MALA'", [admin], 'gan:anular');
    prueba('B vende a una empresa de la otra tienda', (await vender(B, pb[0].id, 300, 'GTQ', 'GAN-B1')).status === 201);
    await db.query("UPDATE proy_ventas SET creado_en = NOW() - INTERVAL 7 MONTH WHERE referencia = 'GAN-A3'", [], 'gan:fecha_vieja');
    await db.query("UPDATE proy_ventas SET creado_en = NOW() - INTERVAL 5 MONTH - INTERVAL 10 DAY WHERE referencia = 'GAN-B1'", [], 'gan:fecha_media');

    r = await asesor(A, 'GET', '/clientes-ganados');
    const nombres = (x) => x.datos.items.map(i => i.nombre);
    prueba('el asesor ve solo sus clientes ganados (2) y no los de B ni la venta anulada', r.status === 200 && r.datos.total === 2 && !r.datos.items.some(i => i.id === pb[0].cliente_id) && r.datos.items.every(i => i.ultimaVenta.referencia !== 'GAN-MALA'), JSON.stringify(nombres(r)));
    const e0 = r.datos.items.find(i => i.id === pa[0].cliente_id);
    prueba('los totales van por moneda sin mezclarlas y cuentan las ventas', !!e0 && e0.ventas === 2 && e0.totales.length === 2 && e0.totales.find(t => t.moneda === 'GTQ').monto === 200.5 && e0.totales.find(t => t.moneda === 'USD').monto === 50, JSON.stringify(e0));
    const e1 = r.datos.items.find(i => i.id === pa[1].cliente_id);
    prueba('una venta de hace 7 meses con recompra a 6 meses sale vencida, y va primero en la lista', e1.recompra.estado === 'vencida' && e1.recompra.dias < 0 && r.datos.items[0].id === e1.id, JSON.stringify(e1.recompra));
    prueba('una venta de hoy sale con recompra lejana y la fecha es la de la venta más 6 meses', e0.recompra.estado === 'lejana' && /^\d{4}-\d{2}-\d{2}$/.test(e0.recompra.fecha) && e0.recompra.dias >= 170, JSON.stringify(e0.recompra));
    r = await asesor(B, 'GET', '/clientes-ganados');
    prueba('B ve solo la suya, con recompra próxima (vendió hace 5 meses y 10 días)', r.datos.total === 1 && r.datos.items[0].recompra.estado === 'proxima' && r.datos.items[0].ultimaVenta.referencia === 'GAN-B1', JSON.stringify(r.datos.items));
    r = await sup('GET', '/clientes-ganados');
    prueba('el supervisor de la tienda 1 ve las de A, pero no las de la tienda 3', r.status === 200 && r.datos.total === 2, JSON.stringify(nombres(r)));
    r = await ger('GET', '/clientes-ganados');
    prueba('gerencia ve todas (3)', r.status === 200 && r.datos.total === 3);
    r = await llamar('GET', '/clientes-ganados', { usuario: 99999, permisos: PERM_SIN_ROL });
    prueba('quien solo tiene proyectos.ver no entra (403)', r.status === 403);

    console.log('Clientes ganados: filtros');
    prueba('filtro de recompra vencida deja solo la vencida', (await ger('GET', '/clientes-ganados?recompra=vencida')).datos.total === 1);
    prueba('filtro de recompra próxima deja solo la de B', (await ger('GET', '/clientes-ganados?recompra=proxima')).datos.items.map(i => i.id).join() === String(pb[0].cliente_id));
    prueba('filtro de última venta en los últimos 6 meses saca la de hace 7 meses', (await ger('GET', '/clientes-ganados?periodo=6')).datos.total === 2);
    prueba('búsqueda por nombre', (await ger('GET', `/clientes-ganados?busqueda=${encodeURIComponent(`Empresa ${pa[0].cliente_id}`.toLowerCase().slice(0, 30))}`)).datos.items.every(i => i.nombre.toLowerCase().includes('empresa')));
    prueba('un valor raro en los filtros se ignora en vez de romper', (await ger('GET', '/clientes-ganados?recompra=zzz&periodo=abc&nicho=x')).datos.total === 3);

    console.log('Exportación de clientes ganados');
    prueba('sin proyectos.ver_reportes → 403', (await llamar('GET', '/clientes-ganados/exportar.csv', { usuario: SUP, permisos: PERM_SUPERVISOR_SIN_REPORTES })).status === 403);
    r = await ger('GET', '/clientes-ganados/exportar.csv');
    const tabla = leer(r.texto.replace(/^﻿/, '')).filas;
    prueba('el CSV trae una fila por cliente y el total por moneda sin mezclar', r.status === 200 && tabla.length === 4 && tabla[0][0] === 'Empresa' && tabla.some(f => f[10] === 'GTQ 200.50 · USD 50.00'), JSON.stringify(tabla.slice(0, 3)));

    console.log('Vale de recompra');
    r = await asesor(A, 'GET', `/clientes-ganados/${pa[0].cliente_id}/prefill-vale`);
    prueba('el asesor trae los datos de su cliente ganado, sin proyecto que ligar', r.status === 200 && r.datos.recompra === true && r.datos.participacionId === null && r.datos.empresa.nombre === (await db.query('SELECT nombre FROM proy_clientes WHERE id = ?', [pa[0].cliente_id], 'gan:nombre'))[0].nombre, JSON.stringify(r.datos));
    prueba('el cliente ganado de otro asesor responde 404 (nadie sabe qué tienen los demás)', (await asesor(B, 'GET', `/clientes-ganados/${pa[0].cliente_id}/prefill-vale`)).status === 404);
    prueba('una empresa que nunca compró responde 404', (await asesor(A, 'GET', `/clientes-ganados/${pa[2].cliente_id}/prefill-vale`)).status === 404);
    prueba('sin proyectos.gestionar → 403', (await llamar('GET', `/clientes-ganados/${pa[0].cliente_id}/prefill-vale`, { usuario: SUP, permisos: PERM_SUPERVISOR_SIN_REPORTES })).status === 403);
    prueba('el vale de recompra no crea ningún vínculo con proyectos', (await db.query('SELECT COUNT(*) AS n FROM proy_vales WHERE participacion_id IN (?)', [[pa[0].id]], 'gan:vinculos'))[0].n === 0);
  } finally {
    // Limpieza, pase lo que pase: nada de esta prueba debe quedar en la base.
    if (proyectoId) {
      const part = '(SELECT id FROM proy_participaciones WHERE proyecto_id = ?)';
      for (const tabla of ['proy_gestiones', 'proy_entregas_muestra', 'proy_cotizaciones', 'proy_ventas', 'proy_reasignaciones']) {
        await db.query(`DELETE FROM ${tabla} WHERE participacion_id IN ${part}`, [proyectoId], `gan:limpiar_${tabla}`);
      }
    }
    await db.query('DELETE FROM proy_proyectos WHERE creado_en >= ? AND creado_por = ?', [inicio, admin], 'gan:limpiar_proyectos');
    await db.query("DELETE FROM proy_clientes WHERE nombre LIKE 'GAN %'", [], 'gan:limpiar_clientes');
    await db.query("DELETE FROM notificaciones WHERE modulo = 'proyectos' AND creado_en >= ?", [inicio], 'gan:limpiar_notificaciones');
    await db.query("DELETE FROM idempotency_keys WHERE idempotency_key LIKE 'proy-%' AND creado_en >= ?", [inicio], 'gan:limpiar_claves');
    await db.query('DELETE FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'gan:limpiar_ajustes');
    for (const { clave: k, valor } of ajustesAntes) await db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?)', [k, valor], 'gan:restaurar_ajuste');
    await db.query('DELETE FROM proy_config_historial WHERE creado_en >= ?', [inicio], 'gan:limpiar_historial');
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
