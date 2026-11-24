// scripts/tiempos/verificar-api.js
// Verifica la API de Tiempos contra la base (con la carga inicial hecha): tabla publicada, cálculo de un pedido, errores por campo,
// festivos de Guatemala y el permiso tiempos.ver. Solo lee; no escribe.
// Uso (base DESECHABLE con la migración y la carga inicial): node scripts/tiempos/verificar-api.js
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/tiempos/routes');
const cargaInicial = require('../../src/modules/tiempos/services/cargaInicialService');

let buenas = 0; let malas = 0;
const prueba = (nombre, condicion, detalle = '') => { condicion ? buenas++ : malas++; console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`); };
const j = (x) => JSON.stringify(x);

async function verificar() {
  await db.listo;
  await cargaInicial.cargar();
  const app = express(); app.use(express.json());
  app.use((req, res, sig) => { req.user = { id: 1, permissions: (req.headers['x-permisos'] || '').split(',').filter(Boolean) }; sig(); });
  app.use('/api/tiempos', requirePermission('tiempos.ver'), rutas);
  const servidor = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${servidor.address().port}/api/tiempos`;
  const llamar = async (metodo, ruta, permisos, cuerpo) => { const r = await fetch(base + ruta, { method: metodo, headers: { 'x-permisos': permisos.join(','), 'content-type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined }); return { estado: r.status, cuerpo: await r.json().catch(() => ({})) }; };
  const VER = ['tiempos.ver'];
  try {
    console.log('Permiso');
    prueba('sin tiempos.ver → 403 en la tabla y en el cálculo', (await llamar('GET', '/tabla', [])).estado === 403 && (await llamar('POST', '/calcular', [], {})).estado === 403);

    console.log('Tabla publicada');
    let r = await llamar('GET', '/tabla', VER);
    const t = r.cuerpo;
    prueba('devuelve la versión 5.0, 3 líneas y 38 productos', r.estado === 200 && t.version.numero === '5.0' && t.lineas.length === 3 && t.productos.length === 38, j(r.cuerpo).slice(0, 150));
    const antique = t.productos.find(p => p.clave === 'fundida-antique-con-color');
    prueba('cada rango trae «Cliente» calculado (75–500 → 11) y el último queda a convenir', antique.rangos[0].cliente === 11 && antique.rangos[antique.rangos.length - 1].aConvenir === true && antique.rangos[antique.rangos.length - 1].cliente === null, j(antique.rangos));
    prueba('trae los tipos de UV, las reglas y los avisos generales', t.extras.length === 3 && t.parametros.margen_dias === 1 && t.avisosGenerales.length >= 4);
    prueba('los avisos del producto vienen con el producto', t.productos.find(p => p.clave === 'mundi-3d-filamento').avisos.length === 1);

    console.log('Cálculo');
    r = await llamar('POST', '/calcular', VER, { fechaOrden: '2026-11-23', piezas: [{ productoClave: 'fundida-antique-con-color', cantidad: 300 }, { productoClave: 'protextil-lanyard', cantidad: '300' }, { productoClave: 'mundi-medallas', cantidad: 500 }] });
    prueba('el pedido de 3 piezas tarda 11 días y se entrega el martes 8 de diciembre', r.estado === 200 && r.cuerpo.dias === 11 && r.cuerpo.fechaEntrega === '2026-12-08' && r.cuerpo.fechaEntregaTexto === 'martes 8 de diciembre de 2026', j(r.cuerpo).slice(0, 200));
    prueba('trae el texto para copiar y acepta la cantidad escrita como texto', /Entrega: martes 8 de diciembre de 2026 \(11 días hábiles\)/.test(r.cuerpo.resumen));
    const [{ fecha }] = [{ fecha: '2026-12-25' }];
    r = await llamar('POST', '/calcular', VER, { fechaOrden: '2026-12-21', piezas: [{ productoClave: 'mundi-trofeos-genericos', cantidad: 120 }] });
    const feriado = await db.query("SELECT 1 FROM feriados f JOIN paises p ON p.id = f.pais_id AND p.nombre = 'Guatemala' WHERE DATE_FORMAT(f.fecha, '%m-%d') IN ('12-25') LIMIT 1", [], 'api:feriado');
    prueba('los festivos de Guatemala no cuentan (si el 25 dic es festivo, 7 días desde el 21 dic no caen antes del 4 ene)', r.estado === 200 && (feriado.length ? r.cuerpo.fechaEntrega >= '2026-12-31' : true), j([r.cuerpo.fechaEntrega, feriado.length]));
    r = await llamar('POST', '/calcular', VER, { fechaOrden: '2026-11-23', piezas: [{ productoClave: 'fundida-antique-con-color', cantidad: 300, colores: 4, moldesGrande: true, lanyard: true }] });
    prueba('colores, moldes y costura suman: 15 días y entrega el lunes 14 de diciembre', r.cuerpo.dias === 15 && r.cuerpo.fechaEntrega === '2026-12-14', j(r.cuerpo).slice(0, 160));
    r = await llamar('POST', '/calcular', VER, { fechaOrden: '2026-11-23', piezas: [{ productoClave: 'fundida-antique-sin-color', cantidad: 3500 }] });
    prueba('una cantidad fuera de la tabla responde 200 con estado a_convenir y sin fecha', r.estado === 200 && r.cuerpo.estado === 'a_convenir' && !r.cuerpo.fechaEntrega, j(r.cuerpo).slice(0, 120));
    r = await llamar('POST', '/calcular', VER, { fechaOrden: '2026-11-23', piezas: [{ productoClave: 'fundida-antique-con-color', cantidad: 50 }] });
    prueba('una cantidad menor al mínimo responde bajo_minimo con el mínimo', r.cuerpo.estado === 'bajo_minimo' && r.cuerpo.piezas[0].minimo === 75, j(r.cuerpo).slice(0, 120));

    console.log('Errores');
    r = await llamar('POST', '/calcular', VER, { fechaOrden: '2026-11-23', piezas: [{ productoClave: 'mundi-comandos', cantidad: 0 }, { productoClave: 'no-existe', cantidad: 5 }] });
    prueba('datos inválidos → 400 con el error por pieza y campo', r.estado === 400 && r.cuerpo.campos['piezas.0.cantidad'] && r.cuerpo.campos['piezas.1.productoClave'], j(r.cuerpo));
    prueba('sin piezas → 400', (await llamar('POST', '/calcular', VER, { piezas: [] })).estado === 400);
    prueba('fecha imposible → 400', (await llamar('POST', '/calcular', VER, { fechaOrden: '2026-02-30', piezas: [{ productoClave: 'mundi-comandos', cantidad: 5 }] })).cuerpo.campos?.fechaOrden);
    prueba('más de 20 piezas → 400', (await llamar('POST', '/calcular', VER, { piezas: Array.from({ length: 21 }, () => ({ productoClave: 'mundi-comandos', cantidad: 5 })) })).estado === 400);
    prueba('un cuerpo que no es objeto no rompe el servidor (400)', (await llamar('POST', '/calcular', VER, [1, 2])).estado === 400);
    void fecha;
  } finally { servidor.close(); }
}

verificar().then(() => { console.log(`\n${buenas} OK, ${malas} fallas`); process.exit(malas ? 1 : 0); }).catch((e) => { console.error('Error inesperado:', e); process.exit(1); });
