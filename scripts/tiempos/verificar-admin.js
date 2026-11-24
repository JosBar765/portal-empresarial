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
    const rutasAdmin = [['GET', '/admin/estado'], ['GET', '/admin/tabla'], ['POST', '/admin/productos'], ['PUT', '/admin/productos/x'], ['PUT', '/admin/extras'], ['PUT', '/admin/avisos-generales'], ['PUT', '/admin/catalogos'], ['GET', '/admin/cambios'], ['POST', '/admin/publicar'], ['DELETE', '/admin/borrador'], ['GET', '/admin/versiones'], ['GET', '/admin/versiones/1/cambios'], ['POST', '/admin/versiones/1/usar-como-borrador'], ['GET', '/admin/actividad']];
    const prohibidas = [];
    for (const [m, ruta] of rutasAdmin) { const r = await llamar(m, ruta, VER, {}); if (r.estado !== 403) prohibidas.push(`${m} ${ruta} → ${r.estado}`); }
    prueba('quien solo tiene tiempos.ver recibe 403 en las 14 rutas de administración', prohibidas.length === 0, prohibidas.join('; '));

    console.log('Estado inicial');
    let r = await A('GET', '/admin/estado');
    prueba('hay una versión publicada 5.0 y ningún borrador', r.cuerpo.publicada.numero === '5.0' && r.cuerpo.borrador === null && r.cuerpo.cambios === 0, j(r.cuerpo));
    r = await A('GET', '/admin/tabla');
    const t0 = r.cuerpo;
    prueba('la tabla de administración trae 38 productos, 10 etapas, 3 líneas y el uso de cada una', t0.productos.length === 38 && t0.etapas.length === 10 && t0.lineas.length === 3 && t0.uso.etapas.fabrica > 5 && !t0.esBorrador, j([t0.productos.length, t0.etapas.length, t0.esBorrador]));

    console.log('Validaciones al guardar un producto');
    const antique = t0.productos.find(p => p.clave === 'fundida-antique-con-color');
    const rangosDe = () => antique.rangos.map(x => ({ desde: x.desde, hasta: x.hasta, aConvenir: x.aConvenir, dias: { ...x.dias } }));
    const cuerpoBase = (rangos) => ({ nombre: antique.nombre, activo: true, permiteMoldes: true, permiteLanyard: true, etapas: antique.etapas, rangos, avisos: [] });
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
    r = await A('PUT', '/admin/productos/mundi-comandos', { nombre: 'Comandos', activo: false, permiteMoldes: false, permiteLanyard: false, etapas: ['fabrica', 'ensamble'], rangos: t0.productos.find(p => p.clave === 'mundi-comandos').rangos, avisos: [] });
    prueba('ocultar un producto → 200 (se oculta al publicar, no se borra)', r.estado === 200, j(r.cuerpo));

    console.log('Extras, reglas, avisos, etapas y líneas');
    const extra = t0.extras.find(e => e.clave === 'uv-cama-plana');
    const extrasNuevos = t0.extras.map(e => ({ ...e, rangos: e.rangos.map(x => ({ ...x })) }));
    extrasNuevos.find(e => e.clave === 'uv-cama-plana').rangos[0].dias = 3;
    r = await A('PUT', '/admin/extras', { extras: extrasNuevos, parametros: { margen_dias: 1, moldes_dias: 3 } });
    prueba('cambiar un día de UV y las reglas de moldes → 200', r.estado === 200, j(r.cuerpo));
    prueba('una regla fuera de rango → 400', (await A('PUT', '/admin/extras', { extras: extrasNuevos, parametros: { colores_incluidos: 0 } })).cuerpo.campos?.['parametros.colores_incluidos']);
    const malos = extrasNuevos.map(e => ({ ...e, rangos: e.rangos.map(x => ({ ...x })) })); malos[0].rangos[0].dias = -1;
    prueba('días de UV negativos → 400', (await A('PUT', '/admin/extras', { extras: malos, parametros: {} })).estado === 400);
    r = await A('PUT', '/admin/avisos-generales', { avisos: ['No incluye el diseño del arte interno.', 'Nuevo aviso de prueba.'] });
    prueba('guardar avisos generales → 200', r.estado === 200, j(r.cuerpo));
    prueba('un aviso vacío → 400', (await A('PUT', '/admin/avisos-generales', { avisos: ['ok', '  '] })).estado === 400);
    r = await A('PUT', '/admin/catalogos', { lineas: t0.lineas.map(l => ({ clave: l.clave, nombre: l.nombre })), etapas: [...t0.etapas.map(e => ({ clave: e.clave, nombre: e.nombre })), { nombre: 'Pulido' }] });
    prueba('agregar la etapa «Pulido» → 200', r.estado === 200, j(r.cuerpo));
    prueba('un nombre de etapa repetido → 400', (await A('PUT', '/admin/catalogos', { lineas: [], etapas: [{ nombre: 'Pulido' }, { nombre: 'pulido' }] })).estado === 400);
    r = await A('GET', '/admin/tabla');
    prueba('la etapa nueva y los cambios están en el borrador', r.cuerpo.etapas.some(e => e.nombre === 'Pulido') && r.cuerpo.productos.some(p => p.clave === 'llaveros-acrilicos') && r.cuerpo.parametros.moldes_dias === 3);

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
    prueba('publicar sin borrador → 409', (await A('POST', '/admin/publicar', { numero: '5.2', fecha: '2026-11-23' })).estado === 409);
    r = await A('GET', '/admin/estado');
    prueba('después de publicar ya no hay borrador', r.cuerpo.borrador === null && r.cuerpo.publicada.numero === '5.1');

    console.log('Historial de versiones');
    r = await A('GET', '/admin/versiones');
    const v50 = r.cuerpo.versiones.find(x => x.numero === '5.0'); const v51 = r.cuerpo.versiones.find(x => x.numero === '5.1');
    prueba('hay dos versiones: la 5.1 en uso y la 5.0 reemplazada', r.cuerpo.versiones.length === 2 && v51.estado === 'publicada' && v50.estado === 'reemplazada', j(r.cuerpo.versiones.map(x => [x.numero, x.estado])));
    r = await A('GET', `/admin/versiones/${v51.id}/cambios`);
    prueba('los cambios de la 5.1 incluyen la fundición y el producto nuevo', r.cuerpo.cambios.some(c => c.detalle === 'Fundición: 3 → 4 días') && r.cuerpo.cambios.some(c => c.objeto === 'Llaveros acrílicos'), j(r.cuerpo.cambios.slice(0, 3)));
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
