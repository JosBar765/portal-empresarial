// scripts/incidencias/verificar-retencion.js
// Verifica la regla de conservación de las fotos de Incidencias: con 0 no purga; con un plazo borra las fotos del reporte y de los
// avances de incidencias cerradas o descartadas antes del plazo; conserva las de cierre, las incidencias recientes y las abiertas;
// un fallo de Storage no marca nada y no frena a las demás; repetir no hace nada y el detalle ya no devuelve la URL borrada.
//
// Uso (base DESECHABLE con las migraciones aplicadas; crea datos de prueba y los borra al terminar):
//   node scripts/incidencias/verificar-retencion.js
const db = require('../../src/config/database');
const retencion = require('../../src/modules/incidencias/services/retencionFotosService');
const incidenciaService = require('../../src/modules/incidencias/services/incidenciaService');

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};

const CLAVE = 'incidencias.meses_retencion_fotos';
const fijarMeses = (v) => db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', [CLAVE, String(v)], 'ret:param');

async function verificar() {
  const antes = await db.query('SELECT valor FROM parametros_sistema WHERE clave = ?', [CLAVE], 'ret:param_antes');
  const [{ id: usuario }] = await db.query('SELECT id FROM usuarios WHERE activo = 1 ORDER BY id LIMIT 1', [], 'ret:usuario');
  const [{ id: tienda }] = await db.query('SELECT id FROM tiendas WHERE activo = 1 ORDER BY id LIMIT 1', [], 'ret:tienda');
  const [{ id: categoria }] = await db.query('SELECT id FROM incidencia_categorias ORDER BY id LIMIT 1', [], 'ret:categoria');
  const [{ id: prioridad }] = await db.query('SELECT id FROM incidencia_prioridades ORDER BY orden LIMIT 1', [], 'ret:prioridad');
  const creadas = [];

  const incidencia = async (sufijo, estado, mesesAtras) => {
    const cierre = mesesAtras === null ? null : `DATE_SUB(NOW(), INTERVAL ${mesesAtras} MONTH)`;
    const r = await db.query(
      `INSERT INTO incidencias (correlativo, tienda_id, categoria_id, titulo, descripcion, impacto, prioridad_id, estado, reportada_por, creado_en, cerrada_en)
       VALUES (?, ?, ?, 'Prueba de retención', 'Prueba de la regla de conservación de fotos.', 'molestia_menor', ?, ?, ?, DATE_SUB(NOW(), INTERVAL 20 MONTH), ${cierre || 'NULL'})`,
      [`RT${String(Date.now()).slice(-7)}${sufijo}`, tienda, categoria, prioridad, estado, usuario], 'ret:incidencia');
    creadas.push(r.insertId);
    return r.insertId;
  };
  const foto = async (incId, etapa, nombre) => {
    const r = await db.query('INSERT INTO incidencia_fotos (incidencia_id, etapa, url, subida_por) VALUES (?, ?, ?, ?)', [incId, etapa, `http://almacen.falso/${nombre}.jpg`, usuario], 'ret:foto');
    return r.insertId;
  };
  const marca = async (id) => (await db.query('SELECT purgada_en FROM incidencia_fotos WHERE id = ?', [id], 'ret:marca'))[0].purgada_en;

  try {
    // A: cerrada hace 13 meses (reporte, avance y cierre) · B: descartada hace 13 meses · C: cerrada hace 2 meses ·
    // D: abierta, reportada hace 20 meses · E: cerrada hace 13 meses con una foto que el almacén no puede borrar.
    const A = await incidencia('A', 'cerrada', 13);
    const fAr = await foto(A, 'reporte', 'a-reporte');
    const fAa = await foto(A, 'avance', 'a-avance');
    const fAc = await foto(A, 'cierre', 'a-cierre');
    const B = await incidencia('B', 'descartada', 13);
    const fB = await foto(B, 'reporte', 'b-reporte');
    const C = await incidencia('C', 'cerrada', 2);
    const fC = await foto(C, 'reporte', 'c-reporte');
    const D = await incidencia('D', 'en_proceso', null);
    const fD = await foto(D, 'reporte', 'd-reporte');
    const E = await incidencia('E', 'cerrada', 13);
    const fEmala = await foto(E, 'reporte', 'e-falla');
    const fEbuena = await foto(E, 'avance', 'e-avance');

    const borradas = [];
    const almacen = { eliminar: async (url) => { if (url.includes('falla')) throw new Error('Storage no responde'); borradas.push(url); return true; } };

    console.log('Plazo en 0: conservar siempre');
    await fijarMeses(0);
    let r = await retencion.ejecutar({ almacen });
    prueba('con 0 no se borra nada', r.purgadas === 0 && borradas.length === 0, JSON.stringify(r));

    console.log('Plazo de 12 meses');
    await fijarMeses(12);
    r = await retencion.ejecutar({ almacen });
    prueba('se borran las del reporte y los avances de las cerradas y descartadas antiguas', r.purgadas === 4 && (await marca(fAr)) && (await marca(fAa)) && (await marca(fB)) && (await marca(fEbuena)), JSON.stringify(r));
    prueba('la foto de cierre se conserva', !(await marca(fAc)) && !borradas.some(u => u.includes('a-cierre')));
    prueba('una incidencia cerrada hace poco conserva sus fotos', !(await marca(fC)));
    prueba('una incidencia abierta conserva sus fotos aunque sea antigua', !(await marca(fD)));
    prueba('si el almacén falla, la foto no se marca y las demás siguen', r.fallidas === 1 && !(await marca(fEmala)) && (await marca(fEbuena)), JSON.stringify(r));
    prueba('se borró de Storage solo lo que correspondía', borradas.length === 4 && borradas.every(u => /a-reporte|a-avance|b-reporte|e-avance/.test(u)), borradas.join());

    console.log('Repetir');
    const antesDe = borradas.length;
    r = await retencion.ejecutar({ almacen: { eliminar: async (url) => { borradas.push(url); return true; } } });
    prueba('la segunda pasada solo reintenta la que había fallado', r.purgadas === 1 && borradas.length === antesDe + 1 && borradas[borradas.length - 1].includes('e-falla'), JSON.stringify(r));
    r = await retencion.ejecutar({ almacen });
    prueba('la tercera pasada no hace nada', r.purgadas === 0 && r.fallidas === 0, JSON.stringify(r));

    console.log('Lo que ve la pantalla');
    const lector = { id: usuario, nombre: 'Lectura', permissions: ['incidencias.ver', 'incidencias.ver_todas'] };
    const detalle = await incidenciaService.detalle(lector, A);
    const delReporte = detalle.incidencia.fotos[0];
    prueba('el detalle marca la foto borrada y ya no entrega su URL', delReporte.eliminada === true && delReporte.url === undefined, JSON.stringify(delReporte));
    const detalleC = await incidenciaService.detalle(lector, C);
    prueba('una foto vigente sigue con su URL', detalleC.incidencia.fotos[0].url && !detalleC.incidencia.fotos[0].eliminada, JSON.stringify(detalleC.incidencia.fotos[0]));
  } finally {
    if (creadas.length) await db.query(`DELETE FROM incidencias WHERE id IN (${creadas.map(() => '?').join(',')})`, creadas, 'ret:limpia');
    if (antes.length) await fijarMeses(antes[0].valor); else await db.query('DELETE FROM parametros_sistema WHERE clave = ?', [CLAVE], 'ret:limpia_param');
  }
}

verificar()
  .then(() => { console.log(`\n${buenas} OK, ${malas} fallas`); process.exit(malas ? 1 : 0); })
  .catch((error) => { console.error('Error inesperado:', error); process.exit(1); });
