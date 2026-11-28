// scripts/tiempos/verificar-admin.js
// Verifica la administración de la Tabla de tiempos por HTTP contra la base: borrador que no se ve hasta publicar, validaciones con su
// motivo, productos nuevos y ocultos, extras, avisos, etapas y líneas, publicar, historial de versiones y descartar.
// ESCRIBE en la base: usar solo una base DESECHABLE con la carga inicial; al terminar deja solo la versión 5.0 publicada.
// Uso: node scripts/tiempos/verificar-admin.js
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/tiempos/routes');
const cargaInicial = require('../../src/modules/tiempos/services/cargaInicialService');
const tablaService = require('../../src/modules/tiempos/services/tablaService');

let buenas = 0; let malas = 0;
const prueba = (nombre, condicion, detalle = '') => { condicion ? buenas++ : malas++; console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`); };
const j = (x) => JSON.stringify(x);

async function limpiar() {
  await db.query("DELETE FROM tiempos_versiones WHERE numero <> '5.0'", [], 'adm:limpiar');
  await db.query("UPDATE tiempos_versiones SET estado = 'publicada' WHERE numero = '5.0'", [], 'adm:restaurar');
  await db.query("DELETE FROM tiempos_historial WHERE accion <> 'carga_inicial'", [], 'adm:historial');
  tablaService.invalidar();
}

async function verificar() {
  await db.listo;
  await cargaInicial.cargar();
  await limpiar();
  const app = express(); app.use(express.json());
  app.use((req, res, sig) => { req.user = { id: 1, permissions: (req.headers['x-permisos'] || '').split(',').filter(Boolean) }; sig(); });
  app.use('/api/tiempos', requirePermission('tiempos.ver'), rutas);
  const servidor = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${servidor.address().port}/api/tiempos`;
  const llamar = async (metodo, ruta, permisos, cuerpo) => { const r = await fetch(base + ruta, { method: metodo, headers: { 'x-permisos': permisos.join(','), 'content-type': 'application/json' }, body: cuerpo && metodo !== 'GET' ? JSON.stringify(cuerpo) : undefined }); return { estado: r.status, cuerpo: await r.json().catch(() => ({})) }; };
  const VER = ['tiempos.ver']; const ADM = ['tiempos.ver', 'tiempos.administrar'];
  const A = (m, r, c) => llamar(m, r, ADM, c);
  try {
    console.log('Permiso');
    const rutasAdmin = [['GET', '/admin/estado'], ['GET', '/admin/tabla'], ['POST', '/admin/productos'], ['PUT', '/admin/productos/x'], ['PUT', '/admin/extras'], ['PUT', '/admin/reglas'], ['PUT', '/admin/avisos-generales'], ['PUT', '/admin/catalogos'], ['GET', '/admin/cambios'], ['POST', '/admin/publicar'], ['DELETE', '/admin/borrador'], ['GET', '/admin/versiones'], ['GET', '/admin/versiones/1/cambios'], ['POST', '/admin/versiones/1/usar-como-borrador'], ['GET', '/admin/actividad']];
    const prohibidas = [];
    for (const [m, ruta] of rutasAdmin) { const r = await llamar(m, ruta, VER, {}); if (r.estado !== 403) prohibidas.push(`${m} ${ruta} → ${r.estado}`); }
    prueba(`quien solo tiene tiempos.ver recibe 403 en las ${rutasAdmin.length} rutas de administración`, prohibidas.length === 0, prohibidas.join('; '));

    console.log('Estado inicial');
    let r = await A('GET', '/admin/estado');
    prueba('hay una versión publicada 5.0 y ningún borrador', r.cuerpo.publicada.numero === '5.0' && r.cuerpo.borrador === null && r.cuerpo.cambios === 0, j(r.cuerpo));
    r = await A('GET', '/admin/tabla');
    const t0 = r.cuerpo;
    prueba('la tabla de administración trae 38 productos, 10 etapas, 3 líneas y el uso de cada una', t0.productos.length === 38 && t0.etapas.length === 10 && t0.lineas.length === 3 && t0.uso.etapas.fabrica > 5 && !t0.esBorrador, j([t0.productos.length, t0.etapas.length, t0.esBorrador]));

    console.log('Validaciones al guardar un producto');
    const antique = t0.productos.find(p => p.clave === 'fundida-antique-con-color');
    const rangosDe = () => antique.rangos.map(x => ({ desde: x.desde, hasta: x.hasta, aConvenir: x.aConvenir, dias: { ...x.dias } }));
    const cuerpoBase = (rangos) => ({ nombre: antique.nombre, activo: true, etapas: antique.etapas, rangos, avisos: [] });
    let rg = rangosDe(); rg[1].desde = 401;
    r = await A('PUT', '/admin/productos/fundida-antique-con-color', cuerpoBase(rg));
    prueba('un rango que empieza antes de que termine el anterior → 400 con «cámbialo a 501»', r.estado === 400 && /Cámbialo a 501/.test(r.cuerpo.campos['rangos.1.desde']), j(r.cuerpo));
    rg = rangosDe(); rg[1].desde = 600;
    r = await A('PUT', '/admin/productos/fundida-antique-con-color', cuerpoBase(rg));
    prueba('un hueco entre rangos → 400 que dice cuántas piezas quedan sin tiempo', r.estado === 400 && /sin tiempo/.test(r.cuerpo.campos['rangos.1.desde']), j(r.cuerpo));
    rg = rangosDe(); delete rg[2].dias.fundicion;
    r = await A('PUT', '/admin/productos/fundida-antique-con-color', cuerpoBase(rg));
    prueba('un día vacío → 400 «Falta el día de Fundición… (0 si no aplica)»', r.estado === 400 && /Falta el día de Fundición/.test(r.cuerpo.campos['rangos.2.dias.fundicion']), j(r.cuerpo));
    rg = rangosDe(); rg[0].dias.fabrica = -2;
    prueba('días negativos → 400', (await A('PUT', '/admin/productos/fundida-antique-con-color', cuerpoBase(rg))).estado === 400);
    rg = rangosDe(); rg[rg.length - 1] = { desde: 3001, hasta: 4000, aConvenir: false, dias: { piloto: 2, fundicion: 2, fabrica: 5, ensamble: 1 } };
    prueba('el último rango debe quedar «a convenir» → 400', (await A('PUT', '/admin/productos/fundida-antique-con-color', cuerpoBase(rg))).estado === 400);
    prueba('un nombre repetido → 400', (await A('PUT', '/admin/productos/fundida-antique-con-color', { ...cuerpoBase(rangosDe()), nombre: 'Antique sin color' })).cuerpo.campos?.nombre);
    prueba('sin etapas → 400', (await A('PUT', '/admin/productos/fundida-antique-con-color', { ...cuerpoBase(rangosDe()), etapas: [] })).cuerpo.campos?.etapas);
    prueba('un producto que no existe → 404', (await A('PUT', '/admin/productos/no-existe', cuerpoBase(rangosDe()))).estado === 404);
    r = await A('GET', '/admin/estado');
    prueba('guardar con errores no crea borrador', r.cuerpo.borrador === null);

    console.log('Borrador: no se ve hasta publicar');
    rg = rangosDe(); rg[3].dias.fundicion = 4; // 2001–3000: 3 → 4 (Cliente 16 → 17)
    r = await A('PUT', '/admin/productos/fundida-antique-con-color', cuerpoBase(rg));
    prueba('guardar el producto crea el borrador 5.1', r.estado === 200, j(r.cuerpo));
    r = await A('GET', '/admin/estado');
    prueba('el estado muestra el borrador 5.1 con 1 cambio', r.cuerpo.borrador && r.cuerpo.borrador.numero === '5.1' && r.cuerpo.cambios === 1, j(r.cuerpo));
    r = await llamar('GET', '/tabla', VER);
    prueba('los usuarios siguen viendo la versión 5.0 (Cliente 16)', r.cuerpo.version.numero === '5.0' && r.cuerpo.productos.find(p => p.clave === 'fundida-antique-con-color').rangos[3].cliente === 16);
    r = await llamar('POST', '/calcular', VER, { fechaOrden: '2026-11-23', piezas: [{ productoClave: 'fundida-antique-con-color', cantidad: 2500 }] });
    prueba('y el cálculo sigue usando 16 días', r.cuerpo.dias === 16, j(r.cuerpo).slice(0, 80));
    r = await A('GET', '/admin/tabla');
    prueba('la administración sí muestra el borrador con el cambio (Fundición 4)', r.cuerpo.esBorrador && r.cuerpo.version.numero === '5.1' && r.cuerpo.productos.find(p => p.clave === 'fundida-antique-con-color').rangos[3].dias.fundicion === 4);
    r = await A('GET', '/admin/cambios');
    prueba('«qué cambió» dice «Fundición: 3 → 4 días»', r.cuerpo.cambios.some(c => /2001 – 3000/.test(c.objeto) && c.detalle === 'Fundición: 3 → 4 días'), j(r.cuerpo));

    console.log('Producto nuevo y ocultar');
    const nuevo = { nombre: 'Llaveros acrílicos', linea: 'mundi', activo: true, etapas: ['diseno', 'ensamble'], rangos: [{ desde: 10, hasta: 50, aConvenir: false, dias: { diseno: 2, ensamble: 1 } }, { desde: 51, hasta: null, aConvenir: true, dias: {} }], avisos: ['Consulta existencias de material.'] };
    r = await A('POST', '/admin/productos', nuevo);
    prueba('crear un producto nuevo → 201 con su clave', r.estado === 201 && r.cuerpo.clave === 'llaveros-acrilicos', j(r.cuerpo));
    prueba('un producto nuevo nace oculto (se muestra cuando tiene rangos con días)', (await A('GET', '/admin/tabla')).cuerpo.productos.find(p => p.clave === 'llaveros-acrilicos').activo === false);
    prueba('mostrar un producto sin rangos con días → 400', (await A('PUT', '/admin/productos/llaveros-acrilicos', { ...nuevo, activo: true, rangos: [{ desde: 1, hasta: null, aConvenir: true, dias: {} }] })).cuerpo.campos?.activo);
    prueba('mostrarlo con sus rangos → 200', (await A('PUT', '/admin/productos/llaveros-acrilicos', { ...nuevo, activo: true })).estado === 200);
    prueba('crearlo otra vez con el mismo nombre → 400', (await A('POST', '/admin/productos', nuevo)).estado === 400);
    prueba('una línea que no existe → 400', (await A('POST', '/admin/productos', { ...nuevo, nombre: 'Otro', linea: 'x' })).cuerpo.campos?.linea);
    r = await A('PUT', '/admin/productos/mundi-comandos', { nombre: 'Comandos', activo: false, etapas: ['fabrica', 'ensamble'], rangos: t0.productos.find(p => p.clave === 'mundi-comandos').rangos, avisos: [] });
    prueba('ocultar un producto → 200 (se oculta al publicar, no se borra)', r.estado === 200, j(r.cuerpo));

    console.log('Extras');
    const sinCalculados = (lista) => JSON.parse(JSON.stringify(lista)).map(({ resumen, publicado, ...e }) => e);
    prueba('la carga inicial trae Colores, Moldes, Costura del lanyard e Impresión UV como extras editables', j(t0.extras.map(e => e.clave)) === '["colores","moldes","costura","uv"]'
      && j(t0.extras.find(e => e.clave === 'moldes').alcance.categorias) === '["produccion-piezas-fundidas"]' && t0.extras.find(e => e.clave === 'uv').opciones.length === 3 && t0.extras.every(e => e.publicado), j(t0.extras.map(e => [e.clave, e.alcance])));
    const ex = sinCalculados(t0.extras);
    ex.find(e => e.clave === 'uv').opciones.find(o => o.clave === 'uv-cama-plana').rangos[0].dias = 3;
    ex.find(e => e.clave === 'moldes').diasFijos = 3;
    ex.push({ tipo: 'si_no', nombre: 'Empaque especial', etiqueta: 'Lleva empaque especial', diasFijos: 1, alcance: { todos: false, lineas: ['mundi'], categorias: [], productos: [] } });
    ex.push({ tipo: 'por_unidades', nombre: 'Placas grabadas', etiqueta: '¿Cuántas placas lleva?', unidades: { incluidas: 1, cada: 3, dias: 1, max: 20 }, alcance: { todos: false, lineas: [], categorias: [], productos: ['mundi-trofeos-genericos'] } });
    ex.push({ tipo: 'por_cantidad', nombre: 'Barniz', etiqueta: 'Lleva barniz', opciones: [{ nombre: 'Brillante', rangos: [{ desde: 1, hasta: 500, dias: 1 }, { desde: 501, hasta: null, aConvenir: true }] }, { nombre: 'Mate', rangos: [{ desde: 1, hasta: 500, dias: 2 }, { desde: 501, hasta: null, aConvenir: true }] }], alcance: { todos: true } });
    const conError = (cambio) => { const x = JSON.parse(JSON.stringify(ex)); cambio(x); return A('PUT', '/admin/extras', { extras: x }); };
    r = await conError((x) => { x[6].opciones = []; });
    prueba('un extra por cantidad sin opciones → 400 en «opciones»', r.estado === 400 && r.cuerpo.campos['extras.6.opciones'], j(r.cuerpo));
    r = await conError((x) => { x[4].alcance.lineas = []; });
    prueba('un extra sin dónde ofrecerse → 400 en «alcance»', r.estado === 400 && /Marca en qué líneas/.test(r.cuerpo.campos['extras.4.alcance']), j(r.cuerpo));
    r = await conError((x) => { x[4].alcance.categorias = ['no-existe']; });
    prueba('una categoría que no existe → 400', r.estado === 400 && r.cuerpo.campos['extras.4.alcance'], j(r.cuerpo));
    r = await conError((x) => { x.splice(1, 1); });
    prueba('quitar Moldes (ya publicado) → 400 «ocúltalo»', r.estado === 400 && /ocúltalo/.test(r.cuerpo.campos.extras), j(r.cuerpo));
    r = await conError((x) => { x[4].nombre = 'Moldes'; });
    prueba('dos extras con el mismo nombre → 400', r.estado === 400 && r.cuerpo.campos['extras.4.nombre'], j(r.cuerpo));
    r = await conError((x) => { x[4].diasFijos = 0; });
    prueba('un sí/no que suma 0 días → 400', r.estado === 400 && r.cuerpo.campos['extras.4.diasFijos'], j(r.cuerpo));
    r = await conError((x) => { x[5].unidades.incluidas = 30; });
    prueba('unidades incluidas mayores que el máximo → 400', r.estado === 400 && r.cuerpo.campos['extras.5.unidades.incluidas'], j(r.cuerpo));
    r = await conError((x) => { x[6].opciones[1].rangos[0].dias = -1; });
    prueba('días negativos en una opción → 400 en esa opción', r.estado === 400 && Object.keys(r.cuerpo.campos).some(k => k.startsWith('extras.6.opciones.1')), j(r.cuerpo));
    r = await A('PUT', '/admin/extras', { extras: ex });
    prueba('guardar 3 extras nuevos (uno de cada tipo) y cambiar Moldes y UV → 200 con sus claves', r.estado === 200 && j(r.cuerpo.claves) === '["colores","moldes","costura","uv","empaque-especial","placas-grabadas","barniz"]', j(r.cuerpo));
    r = await A('GET', '/admin/tabla');
    const barniz = r.cuerpo.extras.find(e => e.clave === 'barniz');
    prueba('el borrador los trae con claves de opción, resumen y sin marcar como publicados', barniz && j(barniz.opciones.map(o => o.clave)) === '["brillante","mate"]' && barniz.publicado === false && /de 1 a 2 días/.test(barniz.resumen), j(barniz));
    prueba('un extra nuevo (aún no publicado) sí se puede quitar', (await A('PUT', '/admin/extras', { extras: sinCalculados(r.cuerpo.extras).filter(e => e.clave !== 'barniz') })).estado === 200);
    prueba('y volver a agregarlo', (await A('PUT', '/admin/extras', { extras: [...sinCalculados((await A('GET', '/admin/tabla')).cuerpo.extras), ex[6]] })).estado === 200);

    console.log('Reglas, avisos y catálogos');
    r = await A('PUT', '/admin/reglas', { margen_dias: 1, max_piezas: 25, aviso_urgente: 'Urgente: pídelo por escrito al gerente de planta.' });
    prueba('guardar margen, máximo de piezas y el aviso de urgente → 200', r.estado === 200, j(r.cuerpo));
    prueba('un máximo de piezas fuera de rango → 400', (await A('PUT', '/admin/reglas', { max_piezas: 0 })).cuerpo.campos?.['reglas.max_piezas']);
    prueba('un aviso de urgente vacío → 400', (await A('PUT', '/admin/reglas', { aviso_urgente: ' ' })).cuerpo.campos?.['reglas.aviso_urgente']);
    r = await A('PUT', '/admin/avisos-generales', { avisos: ['No incluye el diseño del arte interno.', 'Nuevo aviso de prueba.'] });
    prueba('guardar avisos generales → 200', r.estado === 200, j(r.cuerpo));
    prueba('un aviso vacío → 400', (await A('PUT', '/admin/avisos-generales', { avisos: ['ok', '  '] })).estado === 400);
    const cat = (await A('GET', '/admin/tabla')).cuerpo;
    const catalogos = (cambio) => { const c = { lineas: JSON.parse(JSON.stringify(cat.lineas)), categorias: JSON.parse(JSON.stringify(cat.categorias)), etapas: JSON.parse(JSON.stringify(cat.etapas)) }; cambio(c); return A('PUT', '/admin/catalogos', c); };
    r = await catalogos((c) => { c.etapas.push({ nombre: 'Pulido' }); c.categorias.push({ nombre: 'Llaveros', linea: 'mundi' }); c.categorias.reverse(); });
    prueba('agregar la etapa «Pulido» y la categoría «Llaveros» en Mundi, y reordenar categorías → 200', r.estado === 200, j(r.cuerpo));
    let t1 = (await A('GET', '/admin/tabla')).cuerpo;
    prueba('quedan con su clave y en el orden nuevo', t1.etapas.some(e => e.clave === 'pulido') && t1.categorias[0].clave === 'mundi-llaveros' && t1.categorias[0].linea === 'mundi', j(t1.categorias.slice(0, 2)));
    r = await catalogos((c) => { c.etapas.find(e => e.clave === 'tres_d').activo = false; });
    prueba('ocultar una etapa que usan productos visibles → 400 con cuántos', r.estado === 400 && /la usan \d+ productos? visibles?/.test(Object.values(r.cuerpo.campos || {})[0] || ''), j(r.cuerpo));
    r = await catalogos((c) => { c.categorias.find(x => x.clave === 'produccion-metal').activo = false; });
    prueba('ocultar una categoría en uso → 400', r.estado === 400, j(r.cuerpo));
    r = await catalogos((c) => { c.etapas.push({ nombre: 'Pulido', activo: false }); });
    prueba('una etapa nueva sin uso sí se puede ocultar', r.estado === 200, j(r.cuerpo));
    prueba('un nombre de categoría repetido en la misma línea → 400', (await catalogos((c) => { c.categorias.push({ nombre: 'Metal', linea: 'produccion' }); })).estado === 400);
    const llaveros = (await A('GET', '/admin/tabla')).cuerpo.productos.find(p => p.clave === 'llaveros-acrilicos');
    r = await A('PUT', '/admin/productos/llaveros-acrilicos', { ...nuevo, activo: true, categoria: 'mundi-llaveros', rangos: llaveros.rangos });
    prueba('mover un producto a la categoría «Llaveros» → 200', r.estado === 200, j(r.cuerpo));
    prueba('una categoría de otra línea → 400', (await A('PUT', '/admin/productos/llaveros-acrilicos', { ...nuevo, activo: true, categoria: 'produccion-metal', rangos: llaveros.rangos })).cuerpo.campos?.categoria);
    r = await A('GET', '/admin/tabla');
    prueba('la etapa nueva, la categoría y los cambios están en el borrador', r.cuerpo.etapas.some(e => e.nombre === 'Pulido') && r.cuerpo.productos.find(p => p.clave === 'llaveros-acrilicos').grupo === 'Llaveros' && r.cuerpo.extras.find(e => e.clave === 'moldes').diasFijos === 3 && r.cuerpo.parametros.max_piezas === 25);

    console.log('Publicar');
    prueba('un número mal escrito → 400', (await A('POST', '/admin/publicar', { numero: '5,1', fecha: '2026-11-23', nota: '' })).cuerpo.campos?.numero);
    prueba('un número que ya existe (5.0) → 400', (await A('POST', '/admin/publicar', { numero: '5.0', fecha: '2026-11-23', nota: '' })).cuerpo.campos?.numero);
    prueba('una fecha imposible → 400', (await A('POST', '/admin/publicar', { numero: '5.1', fecha: '2026-02-30', nota: '' })).cuerpo.campos?.fecha);
    r = await A('POST', '/admin/publicar', { numero: '5.1', fecha: '2026-11-23', nota: 'Ajuste de fundición y nuevos productos' });
    prueba('publicar la 5.1 → 200', r.estado === 200 && r.cuerpo.numero === '5.1' && r.cuerpo.cambios >= 5, j(r.cuerpo));
    r = await llamar('GET', '/tabla', VER);
    const antiqueNuevo = r.cuerpo.productos.find(p => p.clave === 'fundida-antique-con-color');
    prueba('los usuarios ya ven la 5.1: Cliente 17, el producto nuevo y sin el producto oculto', r.cuerpo.version.numero === '5.1' && antiqueNuevo.rangos[3].cliente === 17 && r.cuerpo.productos.some(p => p.clave === 'llaveros-acrilicos') && !r.cuerpo.productos.some(p => p.clave === 'mundi-comandos'));
    r = await llamar('POST', '/calcular', VER, { fechaOrden: '2026-11-23', piezas: [{ productoClave: 'fundida-antique-con-color', cantidad: 2500 }] });
    prueba('el cálculo usa ya 17 días', r.cuerpo.dias === 17, j(r.cuerpo).slice(0, 80));
    r = await llamar('POST', '/calcular', VER, { fechaOrden: '2026-11-23', piezas: [{ productoClave: 'fundida-antique-con-color', cantidad: 300, moldesGrande: true }] });
    prueba('la regla de moldes cambió a 3 días (10 + 3 + 1 = 14)', r.cuerpo.dias === 14, j(r.cuerpo).slice(0, 80));
    const cat51 = (await llamar('GET', '/tabla', VER)).cuerpo;
    prueba('Empaque especial solo se ofrece en Mundi y Placas grabadas solo en Trofeos genéricos', cat51.productos.find(p => p.clave === 'mundi-medallas').extras.includes('empaque-especial')
      && !cat51.productos.find(p => p.clave === 'fundida-antique-con-color').extras.includes('empaque-especial') && j(cat51.productos.filter(p => p.extras.includes('placas-grabadas')).map(p => p.clave)) === '["mundi-trofeos-genericos"]');
    r = await llamar('POST', '/calcular', VER, { fechaOrden: '2026-11-23', piezas: [{ productoClave: 'mundi-medallas', cantidad: 100, extras: { 'empaque-especial': true } }] });
    prueba('Medallas 100 con empaque especial: 3 + 1 = 4 días', r.cuerpo.dias === 4, j(r.cuerpo).slice(0, 120));
    r = await llamar('POST', '/calcular', VER, { fechaOrden: '2026-11-23', piezas: [{ productoClave: 'fundida-antique-con-color', cantidad: 300, extras: { 'empaque-especial': true } }] });
    prueba('empaque especial en una pieza fundida (no se ofrece) → 400 en ese extra', r.estado === 400 && /no lleva/.test(r.cuerpo.campos['piezas.0.extras.empaque-especial']), j(r.cuerpo));
    r = await llamar('POST', '/calcular', VER, { fechaOrden: '2026-11-23', piezas: [{ productoClave: 'mundi-trofeos-genericos', cantidad: 120, extras: { 'placas-grabadas': 7 } }] });
    prueba('Trofeos genéricos 120 con 7 placas (1 incluida, +1 día cada 3): 7 + 2 = 9 días', r.cuerpo.dias === 9, j(r.cuerpo).slice(0, 120));
    r = await llamar('POST', '/calcular', VER, { fechaOrden: '2026-11-23', piezas: [{ productoClave: 'mundi-trofeos-genericos', cantidad: 120, extras: { barniz: 'mate' } }, { productoClave: 'mundi-trofeos-genericos', cantidad: 120, extras: { barniz: 'brillante' } }] });
    prueba('Barniz mate suma 2 y brillante 1 (7 → 9 y 8; el pedido toma 9)', r.cuerpo.dias === 9 && r.cuerpo.piezas[1].total === 8, j(r.cuerpo).slice(0, 120));
    prueba('Barniz sin elegir la opción → 400', (await llamar('POST', '/calcular', VER, { piezas: [{ productoClave: 'mundi-trofeos-genericos', cantidad: 120, extras: { barniz: true } }] })).estado === 400);
    prueba('UV cama plana cambió a 3 días en 1–10 piezas (Medallas 5: 3 + 3 = 6)', (await llamar('POST', '/calcular', VER, { piezas: [{ productoClave: 'mundi-medallas', cantidad: 5, uv: 'uv-cama-plana' }] })).cuerpo.dias === 6);
    r = await llamar('POST', '/calcular', VER, { fechaOrden: '2026-11-23', piezas: [{ productoClave: 'mundi-medallas', cantidad: 5, urgente: true }] });
    prueba('el aviso de urgente es el texto nuevo de las reglas', r.cuerpo.avisoUrgente === 'Urgente: pídelo por escrito al gerente de planta.' && r.cuerpo.piezas[0].avisos.includes(r.cuerpo.avisoUrgente), j(r.cuerpo).slice(0, 160));
    prueba('el máximo de piezas es ahora 25', (await llamar('POST', '/calcular', VER, { piezas: Array.from({ length: 25 }, () => ({ productoClave: 'mundi-medallas', cantidad: 5 })) })).estado === 200
      && (await llamar('POST', '/calcular', VER, { piezas: Array.from({ length: 26 }, () => ({ productoClave: 'mundi-medallas', cantidad: 5 })) })).estado === 400);
    prueba('la categoría nueva y el producto movido se ven en la calculadora', cat51.productos.find(p => p.clave === 'llaveros-acrilicos').grupo === 'Llaveros');
    prueba('publicar sin borrador → 409', (await A('POST', '/admin/publicar', { numero: '5.2', fecha: '2026-11-23' })).estado === 409);
    r = await A('GET', '/admin/estado');
    prueba('después de publicar ya no hay borrador', r.cuerpo.borrador === null && r.cuerpo.publicada.numero === '5.1');

    console.log('Historial de versiones');
    r = await A('GET', '/admin/versiones');
    const v50 = r.cuerpo.versiones.find(x => x.numero === '5.0'); const v51 = r.cuerpo.versiones.find(x => x.numero === '5.1');
    prueba('hay dos versiones: la 5.1 en uso y la 5.0 reemplazada', r.cuerpo.versiones.length === 2 && v51.estado === 'publicada' && v50.estado === 'reemplazada', j(r.cuerpo.versiones.map(x => [x.numero, x.estado])));
    r = await A('GET', `/admin/versiones/${v51.id}/cambios`);
    prueba('los cambios de la 5.1 incluyen la fundición, el producto nuevo y los extras nuevos', r.cuerpo.cambios.some(c => c.detalle === 'Fundición: 3 → 4 días') && r.cuerpo.cambios.some(c => c.objeto === 'Llaveros acrílicos') && r.cuerpo.cambios.some(c => c.objeto === 'Barniz' && c.detalle === 'Extra nuevo'), j(r.cuerpo.cambios.slice(0, 3)));
    r = await A('GET', `/admin/versiones/${v50.id}/cambios`);
    prueba('la 5.0 es la versión inicial', r.cuerpo.inicial === true);
    r = await A('POST', `/admin/versiones/${v50.id}/usar-como-borrador`);
    prueba('usar la 5.0 como borrador → 201 y crea el borrador 5.2', r.estado === 201 && (await A('GET', '/admin/estado')).cuerpo.borrador.numero === '5.2', j(r.cuerpo));
    prueba('usar otra mientras hay borrador → 409', (await A('POST', `/admin/versiones/${v50.id}/usar-como-borrador`)).estado === 409);
    r = await A('GET', '/admin/cambios');
    prueba('ese borrador (copia de la 5.0) difiere de la publicada (5.1) en lo que se cambió', r.cuerpo.cambios.some(c => c.detalle === 'Fundición: 4 → 3 días'));
    r = await A('DELETE', '/admin/borrador');
    prueba('descartar el borrador lo borra y no toca lo publicado', r.cuerpo.descartado === true && (await A('GET', '/admin/estado')).cuerpo.borrador === null && (await A('GET', '/admin/estado')).cuerpo.publicada.numero === '5.1');
    prueba('descartar sin borrador no falla', (await A('DELETE', '/admin/borrador')).cuerpo.descartado === false);
    r = await A('GET', '/admin/actividad');
    prueba('la actividad registra quién guardó, publicó y descartó', r.cuerpo.actividad.length >= 8 && r.cuerpo.actividad.some(a => a.accion === 'publicar') && r.cuerpo.actividad.some(a => a.accion === 'descartar'), j(r.cuerpo.actividad.length));
  } finally { servidor.close(); await limpiar(); }
}

verificar().then(() => { console.log(`\n${buenas} OK, ${malas} fallas`); process.exit(malas ? 1 : 0); }).catch((e) => { console.error('Error inesperado:', e); process.exit(1); });
