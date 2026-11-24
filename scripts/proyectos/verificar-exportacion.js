// scripts/proyectos/verificar-exportacion.js
// Verifica la exportación a CSV (fase 9b), por HTTP contra las rutas reales: la cartera (mismos filtros y alcance que la lista), los
// resultados de un proyecto (una fila por empresa, dinero por moneda, lo de otras tiendas enmascarado) y las tres tablas del informe,
// con el formato que Excel necesita (UTF-8 con BOM, comillas, fórmulas neutralizadas) y los permisos de cada rol.
//
// Uso (base DESECHABLE con las migraciones aplicadas; crea datos de prueba y los borra al terminar):
//   node scripts/proyectos/verificar-exportacion.js
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/proyectos/routes');
const { leer, armar, escapar } = require('../../src/modules/proyectos/csv');

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
  const inicio = (await db.query('SELECT NOW() - INTERVAL 2 SECOND AS t', [], 'exp:inicio'))[0].t;
  const ajustesAntes = await db.query('SELECT clave, valor FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'exp:ajustes_antes');
  const [{ id: nichoId }] = await db.query("SELECT id FROM proy_nichos WHERE nombre = 'Hospitales'", [], 'exp:nicho');
  const [{ id: estructuraId }] = await db.query('SELECT id FROM proy_estructuras ORDER BY id LIMIT 1', [], 'exp:estructura');
  const [{ id: paisGT }] = await db.query("SELECT id FROM paises WHERE codigo = 'GT'", [], 'exp:pais_gt');
  const [{ id: paisSV }] = await db.query("SELECT id FROM paises WHERE codigo = 'SV'", [], 'exp:pais_sv');
  const [{ id: admin }] = await db.query('SELECT id FROM usuarios WHERE rol_id = 1 ORDER BY id LIMIT 1', [], 'exp:admin');
  const [{ id: gerente }] = await db.query("SELECT id FROM usuarios WHERE email = 'gerente@grupopremia.com'", [], 'exp:gerente');
  const [{ id: articulo }] = await db.query('SELECT id FROM proy_articulos WHERE activo = 1 ORDER BY id LIMIT 1', [], 'exp:articulo');
  const SUP = 13; // supervisa las tiendas 1 y 2 (Guatemala)
  const SUP_SIN = 14; // supervisa la tienda 2: no está en el proyecto
  const RARO = '=EXP rara, "x"';

  const filas = [
    ...Array.from({ length: 12 }, (_, i) => [`EXP Hospital ${i}`, `exp hospital ${i}`, nichoId, paisGT, estructuraId, 'activa', admin, 'Quetzaltenango']),
    [RARO, 'exp rara x', nichoId, paisGT, estructuraId, 'activa', admin, 'Antigua'],
    ['EXP Salvador Uno', 'exp salvador uno', nichoId, paisSV, estructuraId, 'activa', admin, 'San Salvador']
  ];
  await db.query('INSERT INTO proy_clientes (nombre, nombre_normalizado, nicho_id, pais_id, estructura_id, estado, creado_por, ciudad) VALUES ?', [filas], 'exp:empresas');

  const servidor = await levantar();
  const base = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;
  const llamar = async (metodo, ruta, { usuario, permisos, cuerpo }) => {
    const res = await fetch(base + ruta, { method: metodo, headers: { 'content-type': 'application/json', 'x-usuario': String(usuario), 'x-permisos': permisos.join(',') }, body: cuerpo === undefined || metodo === 'GET' ? undefined : JSON.stringify(cuerpo) });
    const texto = Buffer.from(await res.arrayBuffer()).toString('utf8'); // sin pasar por res.text(), que quita el BOM
    let datos = null;
    try { datos = JSON.parse(texto); } catch { /* es un CSV */ }
    return { status: res.status, tipo: res.headers.get('content-type') || '', disposicion: res.headers.get('content-disposition') || '', texto, datos };
  };
  const adm = (m, r, c) => llamar(m, r, { usuario: admin, permisos: PERM_ADMIN, cuerpo: c });
  const sup = (m, r, c) => llamar(m, r, { usuario: SUP, permisos: PERM_SUPERVISOR, cuerpo: c });
  const ger = (m, r, c) => llamar(m, r, { usuario: gerente, permisos: PERM_GERENTE, cuerpo: c });
  const asesor = (m, r, c, u) => llamar(m, r, { usuario: u, permisos: PERM_ASESOR, cuerpo: c });
  const clave = () => `exp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const tabla = (res) => leer(res.texto.replace(/^﻿/, '')).filas;
  let proyectoId = null;

  try {
    console.log('Formato (pruebas puras)');
    prueba('el CSV lleva BOM, comillas donde hacen falta y CRLF', armar([['a', 'b,c'], ['"x"', 'y']]) === '﻿a,"b,c"\r\n"""x""",y\r\n');
    prueba('una celda que parece fórmula se neutraliza', escapar('=1+1') === "'=1+1" && escapar('+5') === "'+5" && escapar('@x') === "'@x" && escapar('normal') === 'normal');

    console.log('Cartera');
    prueba('sin proyectos.ver_reportes no se exporta (403)', (await llamar('GET', '/clientes/exportar.csv', { usuario: SUP, permisos: PERM_SUPERVISOR_SIN_REPORTES })).status === 403);
    prueba('un asesor tampoco (403)', (await asesor('GET', '/clientes/exportar.csv', undefined, 49)).status === 403);
    let r = await sup('GET', '/clientes/exportar.csv?busqueda=EXP');
    const cartera = tabla(r);
    prueba('es un CSV descargable con BOM y nombre con la fecha', r.status === 200 && /text\/csv/.test(r.tipo) && /attachment; filename="cartera-\d{4}-\d{2}-\d{2}\.csv"/.test(r.disposicion) && r.texto.charCodeAt(0) === 0xFEFF, `${r.status} ${r.tipo} ${r.disposicion}`);
    prueba('la primera fila son los encabezados', cartera[0].slice(0, 3).join() === 'Empresa,Nicho,País' && cartera[0].includes('Contactos'), cartera[0].join());
    const lista = await sup('GET', '/clientes?busqueda=EXP');
    prueba('trae las mismas empresas que la lista con ese filtro (13 de Guatemala; la de El Salvador no está en su alcance)', cartera.length - 1 === lista.datos.total && lista.datos.total === 13 && !cartera.some(f => f[0] === 'EXP Salvador Uno'), `${cartera.length - 1} vs ${lista.datos.total}`);
    const rara = cartera.find(f => f[0] === `'${RARO}`);
    prueba('el nombre que parece fórmula sale neutralizado y la coma y las comillas no rompen las columnas', !!rara && rara.length === cartera[0].length && rara[3] === 'Antigua', JSON.stringify(rara));
    r = await sup('GET', '/clientes/exportar.csv?busqueda=Hospital%201');
    prueba('respeta los filtros (la búsqueda)', tabla(r).length - 1 === (await sup('GET', '/clientes?busqueda=Hospital%201')).datos.total && tabla(r).length > 1);

    console.log('Preparación: un proyecto en las tiendas 1 y 3 (dos supervisores distintos)');
    r = await adm('POST', '/proyectos', { nichoId, anio: 2026, mes: 11, tiendaIds: [1, 3], fechaInicio: '2026-11-02', fechaFin: '2026-11-27', articuloId: articulo, existenciaMuestras: 50, topePorAsesor: 100 });
    proyectoId = r.datos.id;
    r = await adm('POST', `/proyectos/${proyectoId}/activar`, { idempotencyKey: clave() });
    prueba('el proyecto se activa y reparte las 13 empresas', r.status === 200 && r.datos.estado === 'activo' && r.datos.empresas === 13, JSON.stringify(r.datos));
    const asesoresT1 = (await db.query('SELECT DISTINCT asesor_id FROM proy_participaciones WHERE proyecto_id = ? AND tienda_id = 1 AND asesor_id IS NOT NULL ORDER BY asesor_id', [proyectoId], 'exp:asesores1')).map(x => x.asesor_id);
    const A = asesoresT1[0];
    const [p1, p2] = (await db.query('SELECT id FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id = ? ORDER BY id', [proyectoId, A], 'exp:partes')).map(x => x.id);
    await asesor('POST', `/participaciones/${p1}/cotizaciones`, { monto: 100, referencia: 'COT-A', idempotencyKey: clave() }, A);
    await asesor('POST', `/participaciones/${p1}/cotizaciones`, { monto: 50, moneda: 'USD', referencia: 'COT-USD', idempotencyKey: clave() }, A);
    await asesor('POST', `/participaciones/${p1}/ventas`, { monto: 200.5, referencia: 'OV-A', idempotencyKey: clave() }, A);
    await asesor('POST', `/participaciones/${p2}/cotizaciones`, { monto: 999, referencia: 'COT-MALA', idempotencyKey: clave() }, A);
    const cotMala = (await db.query("SELECT id FROM proy_cotizaciones WHERE referencia = 'COT-MALA'", [], 'exp:cot_mala'))[0].id;
    await sup('POST', `/participaciones/${p2}/cotizaciones/${cotMala}/anular`, { motivo: 'Equivocada', idempotencyKey: clave() });

    console.log('Resultados del proyecto');
    prueba('sin permiso → 403', (await llamar('GET', `/proyectos/${proyectoId}/exportar.csv`, { usuario: SUP, permisos: PERM_SUPERVISOR_SIN_REPORTES })).status === 403);
    prueba('un supervisor ajeno al proyecto recibe 404', (await llamar('GET', `/proyectos/${proyectoId}/exportar.csv`, { usuario: SUP_SIN, permisos: PERM_SUPERVISOR })).status === 404);
    r = await sup('GET', `/proyectos/${proyectoId}/exportar.csv`);
    let t = tabla(r);
    const col = (nombre) => t[0].indexOf(nombre);
    prueba('una fila por empresa asignada, con nombre de archivo del proyecto', r.status === 200 && t.length - 1 === 13 && /filename="resultados-/.test(r.disposicion), `${t.length - 1} ${r.disposicion}`);
    prueba('hay una columna por moneda usada, para cotizado y vendido', ['Cotizado GTQ', 'Vendido GTQ', 'Cotizado USD', 'Vendido USD'].every(c => col(c) > 0), t[0].join());
    const fila1 = t.find(f => f[col('Empresa')] && f[col('Referencias de cotización')].includes('COT-A'));
    prueba('el dinero de la empresa sale por moneda, con punto decimal y con sus referencias', !!fila1 && fila1[col('Cotizado GTQ')] === '100.00' && fila1[col('Cotizado USD')] === '50.00' && fila1[col('Vendido GTQ')] === '200.50' && fila1[col('Referencias de venta')] === 'OV-A' && fila1[col('Estado')] === 'Vendida', JSON.stringify(fila1));
    const fila2 = t.find(f => f[col('Cotizado GTQ')] !== undefined && f.includes('Quetzaltenango') && f[col('Referencias de cotización')] === '' && f[col('Asesor')] === fila1[col('Asesor')]);
    prueba('una cotización anulada no cuenta ni aparece', !t.some(f => f.join('|').includes('COT-MALA')) && !t.some(f => f[col('Cotizado GTQ')] === '999.00') && (fila2 ? fila2[col('Cotizado GTQ')] === '0.00' : true));
    const deOtraTienda = t.slice(1).filter(f => f[col('Tienda')] === 'P13');
    prueba('las empresas de otra tienda salen sin ciudad, gestiones ni montos (solo empresa, país, asesor, tienda y etapa)', deOtraTienda.length > 0 && deOtraTienda.every(f => f[col('Ciudad')] === '' && f[col('Gestiones')] === '' && f[col('Cotizado GTQ')] === '' && f[col('Referencias de venta')] === '' && f[col('Asesor')] !== '' && f[col('Estado')] !== ''), JSON.stringify(deOtraTienda[0]));
    r = await ger('GET', `/proyectos/${proyectoId}/exportar.csv`);
    t = tabla(r);
    const deOtraParaGerente = t.slice(1).filter(f => f[t[0].indexOf('Tienda')] === 'P13');
    prueba('gerencia ve el detalle de todas las tiendas', r.status === 200 && deOtraParaGerente.length > 0 && deOtraParaGerente.every(f => f[t[0].indexOf('Ciudad')] !== ''));

    console.log('Tablas del informe');
    const informe = (await sup('GET', `/proyectos/${proyectoId}/informe`)).datos.informe;
    r = await sup('GET', `/proyectos/${proyectoId}/informe.csv?tabla=resumen`);
    t = tabla(r);
    const valor = (nombre) => (t.find(f => f[0] === nombre) || [])[1];
    prueba('el resumen trae las cifras del informe', r.status === 200 && valor('Asignadas') === String(informe.cifras.asignadas) && valor('Vendidas') === String(informe.cifras.vendidas) && valor('Cotizado GTQ') === '100.00' && valor('Vendido GTQ') === '200.50' && valor('Cotizado USD') === '50.00', JSON.stringify(t.slice(0, 12)));
    r = await sup('GET', `/proyectos/${proyectoId}/informe.csv?tabla=asesores`);
    t = tabla(r);
    prueba('por asesor: una fila por asesor con las mismas cifras que el informe', t.length - 1 === informe.porAsesor.length && t[0][0] === 'Asesor' && informe.porAsesor.every(a => t.some(f => f[0] === a.nombre && f[2] === String(a.asignadas) && f[6] === String(a.vendidas))), JSON.stringify(t.slice(0, 3)));
    r = await sup('GET', `/proyectos/${proyectoId}/informe.csv?tabla=tiendas`);
    t = tabla(r);
    const tiendaA = t.find(f => f[7].includes('GTQ 100.00'));
    prueba('por tienda: una fila por tienda con el cotizado y vendido por moneda sin mezclar', t.length - 1 === informe.porTienda.length && !!tiendaA && tiendaA[7] === 'GTQ 100.00 · USD 50.00' && tiendaA[8] === 'GTQ 200.50', JSON.stringify(t));
    prueba('una tabla que no existe → 400', (await sup('GET', `/proyectos/${proyectoId}/informe.csv?tabla=otra`)).status === 400);
    prueba('sin permiso → 403', (await llamar('GET', `/proyectos/${proyectoId}/informe.csv`, { usuario: SUP, permisos: PERM_SUPERVISOR_SIN_REPORTES })).status === 403);
    prueba('el supervisor ajeno al proyecto recibe 404', (await llamar('GET', `/proyectos/${proyectoId}/informe.csv`, { usuario: SUP_SIN, permisos: PERM_SUPERVISOR })).status === 404);
  } finally {
    // Limpieza, pase lo que pase: nada de esta prueba debe quedar en la base.
    if (proyectoId) {
      const part = '(SELECT id FROM proy_participaciones WHERE proyecto_id = ?)';
      for (const tabla of ['proy_gestiones', 'proy_entregas_muestra', 'proy_cotizaciones', 'proy_ventas', 'proy_reasignaciones']) {
        await db.query(`DELETE FROM ${tabla} WHERE participacion_id IN ${part}`, [proyectoId], `exp:limpiar_${tabla}`);
      }
    }
    await db.query('DELETE FROM proy_proyectos WHERE creado_en >= ? AND creado_por = ?', [inicio, admin], 'exp:limpiar_proyectos');
    await db.query("DELETE FROM proy_clientes WHERE nombre LIKE 'EXP %' OR nombre LIKE '=EXP%'", [], 'exp:limpiar_clientes');
    await db.query("DELETE FROM notificaciones WHERE modulo = 'proyectos' AND creado_en >= ?", [inicio], 'exp:limpiar_notificaciones');
    await db.query("DELETE FROM idempotency_keys WHERE idempotency_key LIKE 'proy-%' AND creado_en >= ?", [inicio], 'exp:limpiar_claves');
    await db.query('DELETE FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'exp:limpiar_ajustes');
    for (const { clave: k, valor } of ajustesAntes) await db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?)', [k, valor], 'exp:restaurar_ajuste');
    await db.query('DELETE FROM proy_config_historial WHERE creado_en >= ?', [inicio], 'exp:limpiar_historial');
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
