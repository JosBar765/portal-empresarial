// scripts/tiempos/verificar-caja-negra.js
// Pruebas de caja negra de la Calculadora de Tiempos: solo hablan con la API HTTP (`/api/tiempos`) y comparan contra lo que dicen las
// imágenes de la Tabla de tiempos Ver. 5.0 (`.agents/modulos/calculadora de tiempos/referencias/`), calculado a mano en
// `plan_de_pruebas.md`. No usan el motor ni los datos del código como referencia. No escriben (solo lectura y cálculos).
//
// Uso (base DESECHABLE con la migración): node scripts/tiempos/verificar-caja-negra.js
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/tiempos/routes');
const cargaInicial = require('../../src/modules/tiempos/services/cargaInicialService');

let buenas = 0; let malas = 0;
const prueba = (nombre, condicion, detalle = '') => { condicion ? buenas++ : malas++; console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`); };
const j = (x) => JSON.stringify(x);
const VER = ['tiempos.ver'];
const ADMIN = ['tiempos.ver', 'tiempos.administrar'];
const LUNES = '2026-11-23';

async function verificar() {
  await db.listo;
  await cargaInicial.cargar();
  const app = express(); app.use(express.json());
  app.use((req, res, sig) => { req.user = { id: 1, permissions: (req.headers['x-permisos'] || '').split(',').filter(Boolean) }; sig(); });
  app.use('/api/tiempos', requirePermission('tiempos.ver'), rutas);
  app.use((error, req, res, sig) => { void sig; res.status(error.status || 500).json({ error: 'Solicitud no válida.' }); }); // sin trazas en la salida de la prueba
  const servidor = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${servidor.address().port}/api/tiempos`;
  const llamar = async (metodo, ruta, permisos, cuerpo, crudo) => {
    const r = await fetch(base + ruta, { method: metodo, headers: { 'x-permisos': permisos.join(','), 'content-type': 'application/json' }, body: crudo !== undefined ? crudo : (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined) });
    return { estado: r.status, cuerpo: await r.json().catch(() => ({})) };
  };
  // Calcula una sola pieza y devuelve { estado HTTP, estado del pedido, días al cliente, fecha, cuerpo }.
  const una = async (pieza, fechaOrden = LUNES) => {
    const r = await llamar('POST', '/calcular', VER, { fechaOrden, piezas: [pieza] });
    return { http: r.estado, estado: r.cuerpo.estado, dias: r.cuerpo.dias, fecha: r.cuerpo.fechaEntrega, cuerpo: r.cuerpo };
  };
  // Tabla de valores límite: [cantidad, esperado] donde esperado es un número (días al cliente) o 'min' / 'conv'.
  const limites = async (titulo, productoClave, casos, extra = {}) => {
    const malos = [];
    for (const [cantidad, esperado] of casos) {
      const r = await una({ productoClave, cantidad, ...extra });
      const ok = typeof esperado === 'number' ? (r.http === 200 && r.estado === 'ok' && r.dias === esperado)
        : esperado === 'min' ? (r.http === 200 && r.cuerpo.piezas && r.cuerpo.piezas[0].estado === 'bajo_minimo' && !r.fecha)
          : (r.http === 200 && r.estado === 'a_convenir' && !r.fecha);
      if (!ok) malos.push(`${cantidad}→${r.http}/${r.estado}/${r.dias} (esperado ${esperado})`);
    }
    prueba(`${titulo}: ${casos.length} cantidades límite`, !malos.length, malos.join(' | '));
  };

  try {
    // ------------------------------------------------------------------ 2.1 Valores límite
    console.log('Valores límite de los rangos (contra las imágenes)');
    await limites('Antique sin color', 'fundida-antique-sin-color',
      [[74, 'min'], [75, 9], [500, 9], [501, 10], [1000, 10], [1001, 11], [2000, 11], [2001, 13], [3000, 13], [3001, 'conv']]);
    await limites('Medallas, láminas, stickers y botones', 'mundi-medallas',
      [[1, 3], [100, 3], [101, 4], [200, 4], [201, 5], [500, 5], [501, 6], [1000, 6], [1001, 'conv']]);
    await limites('Trofeos genéricos / tazas', 'mundi-trofeos-genericos',
      [[1, 3], [25, 3], [26, 4], [50, 4], [51, 5], [100, 5], [101, 7], [250, 7], [251, 9], [500, 9], [501, 'conv']]);
    await limites('Lanyard', 'protextil-lanyard',
      [[49, 'min'], [50, 7], [250, 7], [251, 8], [500, 8], [501, 10], [1000, 10], [1001, 13], [2500, 13], [2501, 'conv']]);
    await limites('Antique con color', 'fundida-antique-con-color',
      [[75, 11], [500, 11], [501, 12], [1000, 12], [1001, 14], [2000, 14], [2001, 16], [3000, 16], [3001, 'conv']]);

    // ------------------------------------------------------------------ 2.2 Cantidades inválidas
    console.log('Cantidades inválidas (nunca un error 500)');
    const invalidas = [0, -5, 12.5, 'abc', '', null, true, [], {}, ' ', '1e3x'];
    const malas500 = []; const sinRechazo = [];
    for (const cantidad of invalidas) {
      const r = await una({ productoClave: 'mundi-comandos', cantidad });
      if (r.http >= 500) malas500.push(j(cantidad));
      if (!(r.http === 400 && r.cuerpo.campos && r.cuerpo.campos['piezas.0.cantidad'])) sinRechazo.push(`${j(cantidad)}→${r.http}`);
    }
    prueba('ninguna cantidad inválida produce 500', !malas500.length, malas500.join(','));
    prueba('cada cantidad inválida responde 400 con el error en el campo «cantidad»', !sinRechazo.length, sinRechazo.join(' | '));
    let r = await una({ productoClave: 'mundi-comandos', cantidad: 999999999999 });
    prueba('una cantidad enorme no rompe: no calcula fecha y no responde 500', r.http < 500 && !r.fecha, `${r.http}/${r.estado}`);
    r = await una({ productoClave: 'mundi-comandos', cantidad: '  25 ' });
    prueba('un número escrito como texto con espacios se acepta o se rechaza con 400, nunca 500', r.http === 200 || r.http === 400, String(r.http));

    // ------------------------------------------------------------------ 2.3 Complementos
    console.log('Complementos');
    const colores = [[1, 11], [2, 11], [3, 12], [4, 12], [5, 13], [6, 13], [7, 14]];
    const malosColores = [];
    for (const [n, esperado] of colores) { const x = await una({ productoClave: 'fundida-antique-con-color', cantidad: 300, colores: n }); if (x.dias !== esperado) malosColores.push(`${n} colores→${x.dias} (esperado ${esperado})`); }
    prueba('Colores: 1 y 2 sin extra; desde el 3.º, +1 día por cada 2 (3 y 4 → +1; 5 y 6 → +2; 7 → +3)', !malosColores.length, malosColores.join(' | '));
    const coloresMalos = [];
    for (const n of [0, 13, 2.5, 'x', -1]) { const x = await una({ productoClave: 'fundida-antique-con-color', cantidad: 300, colores: n }); if (x.http !== 400) coloresMalos.push(`${j(n)}→${x.http}`); }
    prueba('Colores fuera de 1 a 12 o no enteros → 400', !coloresMalos.length, coloresMalos.join(' | '));
    r = await una({ productoClave: 'fundida-antique-con-color', cantidad: 300, moldesGrande: true });
    prueba('Piezas fundidas de más de 3.5": +2 días (11 → 13)', r.dias === 13, j(r.dias));
    r = await una({ productoClave: 'fundida-antique-con-color', cantidad: 300, lanyard: true });
    prueba('Lanyard cosido de 300: suma su costura de 1 día (11 → 12)', r.dias === 12, j(r.dias));
    r = await una({ productoClave: 'fundida-antique-con-color', cantidad: 300, moldesGrande: true, lanyard: true, colores: 4 });
    prueba('Moldes + lanyard + 4 colores en la misma pieza: 11 + 2 + 1 + 1 = 15 (el margen cuenta una sola vez)', r.dias === 15, j(r.dias));
    r = await una({ productoClave: 'mundi-medallas', cantidad: 100, moldesGrande: true });
    prueba('Moldes en un producto que no los lleva → 400', r.http === 400, String(r.http));
    r = await una({ productoClave: 'mundi-medallas', cantidad: 100, lanyard: true });
    prueba('Lanyard cosido en un producto que no lo lleva → 400', r.http === 400, String(r.http));
    r = await una({ productoClave: 'fundida-antique-con-color', cantidad: 300, uv: 'uv-no-existe' });
    prueba('Un tipo de UV que no existe → 400', r.http === 400, String(r.http));

    const uvCasos = [[75, 13], [250, 13], [251, 14], [500, 14], [501, 17], [1000, 17], [1001, 19], [1500, 19], [1501, 21], [2000, 21], [2001, 23], [3000, 23], [3001, 'conv']];
    await limites('Impresión UV sobre Antique con color (+2, +3, +5, +7)', 'fundida-antique-con-color', uvCasos, { uv: 'uv-impresion' });
    await limites('UV vinil sin revestimiento sobre Medallas (+1, +2, +3)', 'mundi-medallas',
      [[300, 6], [301, 7], [500, 7], [501, 8], [600, 8], [601, 9], [1000, 9], [1001, 'conv']], { uv: 'uv-vinil' });
    await limites('UV cama plana / DTF sobre Medallas (+2, +4, +6, +9, +13)', 'mundi-medallas',
      [[10, 5], [11, 7], [150, 8], [151, 10], [300, 11], [301, 14], [600, 15], [601, 19], [1000, 19], [1001, 'conv']], { uv: 'uv-cama-plana' });

    // ------------------------------------------------------------------ 2.4 Pedido con varias piezas
    console.log('Pedido con varias piezas (entrega = la pieza más larga)');
    const P = (productoClave, cantidad, extra = {}) => ({ productoClave, cantidad, ...extra });
    const pedido = async (piezas, fechaOrden = LUNES) => { const x = await llamar('POST', '/calcular', VER, { fechaOrden, piezas }); return { http: x.estado, ...x.cuerpo }; };
    r = await pedido([P('fundida-antique-sin-color', 75), P('mundi-medallas', 100)]);
    prueba('Antique sin color 75 (9 días) + Medallas 100 (3 días) → 9', r.http === 200 && r.dias === 9, j(r.dias));
    const alReves = await pedido([P('mundi-medallas', 100), P('fundida-antique-sin-color', 75)]);
    prueba('El orden de las piezas no cambia el resultado', alReves.dias === r.dias && alReves.fechaEntrega === r.fechaEntrega);
    r = await pedido([P('fundida-antique-sin-color', 75), P('fundida-antique-sin-color', 75), P('fundida-antique-sin-color', 75)]);
    prueba('Tres piezas iguales no se multiplican ni se suman: 9', r.dias === 9, j(r.dias));
    r = await pedido([P('fundida-antique-sin-color', 400), P('fundida-antique-sin-color', 400)]);
    prueba('Cada pieza usa su propia cantidad, no la suma (400 y 400 → rango 75–500 → 9, no 501–1000 → 10)', r.dias === 9, j(r.dias));
    r = await pedido([P('fundida-antique-con-color', 300), P('protextil-lanyard', 300), P('mundi-medallas', 100)]);
    prueba('Ejemplo del plan: Antique con color 300 (11) + Lanyard 300 (8) + Medallas 100 (3) → 11', r.dias === 11, j(r.dias));
    r = await pedido([P('fundida-antique-sin-color', 75), P('fundida-antique-sin-color', 5000)]);
    prueba('Una pieza «a convenir» deja todo el pedido «a convenir», sin fecha', r.http === 200 && r.estado === 'a_convenir' && !r.fechaEntrega, j(r).slice(0, 160));
    r = await pedido([P('fundida-antique-sin-color', 75), P('fundida-antique-sin-color', 10)]);
    prueba('Una pieza por debajo del mínimo no deja fecha de entrega', r.http === 200 && !r.fechaEntrega, j(r).slice(0, 160));
    r = await pedido(Array.from({ length: 20 }, () => P('mundi-comandos', 5)));
    prueba('20 piezas se aceptan', r.http === 200, String(r.http));
    r = await pedido(Array.from({ length: 21 }, () => P('mundi-comandos', 5)));
    prueba('21 piezas se rechazan con 400', r.http === 400, String(r.http));
    r = await pedido([]);
    prueba('Sin piezas → 400', r.http === 400, String(r.http));
    r = await pedido([P('mundi-comandos', 5), P('mundi-comandos', 0)]);
    prueba('Con una pieza inválida el error señala cuál pieza (piezas.1.cantidad)', r.http === 400 && r.campos && r.campos['piezas.1.cantidad'] && !r.campos['piezas.0.cantidad'], j(r.campos));

    // ------------------------------------------------------------------ 2.5 Fechas
    console.log('Fecha de entrega (lunes a viernes, sin contar el día de la orden)');
    const fecha = async (fechaOrden, pieza) => (await una(pieza, fechaOrden)).fecha;
    prueba('Lunes 23 nov + 9 días → viernes 4 dic', (await fecha('2026-11-23', P('fundida-antique-sin-color', 75))) === '2026-12-04');
    prueba('Viernes 27 nov + 3 días → miércoles 2 dic', (await fecha('2026-11-27', P('mundi-medallas', 1))) === '2026-12-02');
    prueba('Sábado 28 nov + 3 días → miércoles 2 dic (el día 1 es el siguiente hábil)', (await fecha('2026-11-28', P('mundi-medallas', 1))) === '2026-12-02');
    prueba('Domingo 29 nov + 3 días → miércoles 2 dic', (await fecha('2026-11-29', P('mundi-medallas', 1))) === '2026-12-02');
    prueba('Lunes 30 nov + 3 días → jueves 3 dic', (await fecha('2026-11-30', P('mundi-medallas', 1))) === '2026-12-03');
    const cambioAnio = await fecha('2026-12-30', P('mundi-medallas', 1));
    prueba('Cambio de año: la entrega cae en enero de 2027, en día hábil', cambioAnio >= '2027-01-04' && ![0, 6].includes(new Date(`${cambioAnio}T12:00:00`).getDay()), cambioAnio);
    r = await llamar('POST', '/calcular', VER, { piezas: [P('mundi-medallas', 1)] });
    prueba('Sin fecha de orden usa la de hoy y calcula', r.estado === 200 && r.cuerpo.estado === 'ok', j(r.cuerpo).slice(0, 100));
    const fechasMalas = []; for (const f of ['2026-02-30', '23/11/2026', 'hoy', '2026-13-01', '']) { const x = await una(P('mundi-medallas', 1), f); if (!(x.http === 400 || (f === '' && x.http === 200))) fechasMalas.push(`${f}→${x.http}`); }
    prueba('Fechas imposibles o mal escritas → 400', !fechasMalas.length, fechasMalas.join(' | '));
    const sabados = []; let n = 0;
    for (const clave of ['mundi-medallas', 'protextil-lanyard', 'fundida-antique-sin-color', 'resina-pintada', 'vidrio-marmol-grabado']) {
      for (let d = 0; d < 14; d++) {
        const inicio = new Date(Date.UTC(2026, 10, 20 + d)).toISOString().slice(0, 10);
        const x = await una(P(clave, clave === 'protextil-lanyard' ? 100 : (clave.startsWith('fundida') ? 100 : 20)), inicio);
        if (x.fecha) { n++; if ([0, 6].includes(new Date(`${x.fecha}T12:00:00Z`).getUTCDay())) sabados.push(`${clave} ${inicio}→${x.fecha}`); }
      }
    }
    prueba(`Ninguna de ${n} fechas de entrega cae en sábado o domingo`, n > 0 && !sabados.length, sabados.slice(0, 3).join(' | '));

    // ------------------------------------------------------------------ Propiedades
    console.log('Propiedades (pedidos al azar, semilla fija)');
    const tabla = (await llamar('GET', '/tabla', VER)).cuerpo;
    let semilla = 20261123; const azar = (m) => { semilla = (semilla * 1664525 + 1013904223) % 4294967296; return semilla % m; };
    const fallos = [];
    for (let i = 0; i < 80; i++) {
      const cuantas = 1 + azar(4);
      const piezas = Array.from({ length: cuantas }, () => { const p = tabla.productos[azar(tabla.productos.length)]; const rango = p.rangos.filter(x => !x.aConvenir)[azar(p.rangos.length - 1)]; return P(p.clave, rango.desde + azar(Math.max(1, (rango.hasta || rango.desde) - rango.desde + 1)), { colores: 1 + azar(5) }); });
      const x = await pedido(piezas);
      if (x.http !== 200 || x.estado !== 'ok') { fallos.push(`pedido ${i}: ${x.http}/${x.estado} ${j(piezas).slice(0, 120)}`); continue; }
      const mayor = Math.max(...x.piezas.map(p => p.total));
      if (x.dias !== mayor) fallos.push(`pedido ${i}: dias ${x.dias} ≠ mayor ${mayor}`);
      if (x.piezas.some(p => p.total !== p.etapas.reduce((s, e) => s + e.dias, 0) + p.extras.reduce((s, e) => s + e.dias, 0) + p.margen)) fallos.push(`pedido ${i}: un total no es etapas + extras + margen`);
      if (!x.fechaEntrega) fallos.push(`pedido ${i}: sin fecha`);
    }
    prueba('80 pedidos al azar: siempre calcula, el pedido = la pieza más larga y cada pieza = etapas + extras + margen', !fallos.length, fallos.slice(0, 3).join(' | '));
    const repetido = await pedido([P('fundida-antique-con-color', 300, { colores: 3, uv: 'uv-impresion' })]);
    const repetido2 = await pedido([P('fundida-antique-con-color', 300, { colores: 3, uv: 'uv-impresion' })]);
    prueba('El mismo pedido dos veces da el mismo resultado', j(repetido) === j(repetido2));
    r = await pedido([P('fundida-antique-con-color', 300)]);
    prueba('El resumen para copiar trae pieza, cantidad, días, entrega y la versión de la tabla', /Antique con color/.test(r.resumen) && /300/.test(r.resumen) && /11 días/.test(r.resumen) && /5\.0/.test(r.resumen), (r.resumen || '').slice(0, 200));
    r = await pedido([P('mundi-comandos', 5, { urgente: true })]);
    const normal = await pedido([P('mundi-comandos', 5)]);
    prueba('Urgente solo avisa (misma cantidad de días) y el resumen menciona al gerente', r.dias === normal.dias && /gerente/i.test(r.resumen || ''), `${r.dias} vs ${normal.dias}`);

    // ------------------------------------------------------------------ Datos de la tabla
    console.log('Datos de la tabla publicada');
    prueba('38 productos (22 de la hoja 1 y 16 de la hoja 2, contados en las imágenes), 3 líneas y 3 tipos de UV', tabla.productos.length === 38 && tabla.lineas.length === 3 && tabla.extras.length === 3, `${tabla.productos.length}/${tabla.lineas.length}/${tabla.extras.length}`);
    const mal = [];
    for (const p of tabla.productos) {
      const rs = p.rangos;
      if (!rs.length) { mal.push(`${p.clave}: sin rangos`); continue; }
      if (!rs[rs.length - 1].aConvenir) mal.push(`${p.clave}: el último rango no es «a convenir»`);
      rs.forEach((x, i) => {
        if (i > 0 && x.desde !== rs[i - 1].hasta + 1) mal.push(`${p.clave}: hueco o traslape en ${x.desde}`);
        if (!x.aConvenir) {
          if (x.hasta === null || x.hasta < x.desde) mal.push(`${p.clave}: rango ${x.desde}–${x.hasta} inválido`);
          const dias = Object.values(x.dias);
          if (dias.some(d => !Number.isInteger(d) || d < 0)) mal.push(`${p.clave}: días no enteros o negativos en ${x.desde}`);
          if (Object.keys(x.dias).sort().join() !== p.etapas.map(e => e.clave).sort().join()) mal.push(`${p.clave}: etapas del rango ${x.desde} no coinciden con las del producto`);
          if (x.cliente !== dias.reduce((s, d) => s + d, 0) + tabla.parametros.margen_dias) mal.push(`${p.clave}: «Cliente» de ${x.desde} no es etapas + margen`);
        }
      });
    }
    prueba('Todos los productos: rangos en orden y sin huecos, último «a convenir», días enteros y «Cliente» = etapas + 1', !mal.length, mal.slice(0, 4).join(' | '));
    prueba('Los avisos de la hoja están en su producto (filamento, llavero NFC y mármol los traen)', ['mundi-3d-filamento', 'vidrio-marmol-grabado', 'protextil-liston'].every(c => tabla.productos.find(p => p.clave === c).avisos.length >= 1));
    prueba('Los productos de fundición y solo ellos permiten moldes', tabla.productos.every(p => p.permiteMoldes === p.clave.startsWith('fundida-')), tabla.productos.filter(p => p.permiteMoldes !== p.clave.startsWith('fundida-')).map(p => p.clave).join(','));

    // ------------------------------------------------------------------ Permisos y seguridad
    console.log('Permisos');
    const rutasAdmin = [['GET', '/admin/estado'], ['GET', '/admin/tabla'], ['POST', '/admin/productos'], ['PUT', '/admin/productos/mundi-comandos'], ['PUT', '/admin/extras'], ['PUT', '/admin/avisos-generales'], ['PUT', '/admin/catalogos'], ['GET', '/admin/cambios'], ['POST', '/admin/publicar'], ['DELETE', '/admin/borrador'], ['GET', '/admin/versiones'], ['GET', '/admin/versiones/1/cambios'], ['POST', '/admin/versiones/1/usar-como-borrador'], ['GET', '/admin/actividad']];
    const sinPermiso = [];
    for (const [metodo, ruta] of [['GET', '/tabla'], ['GET', '/festivos'], ['POST', '/calcular'], ...rutasAdmin]) {
      const x = await llamar(metodo, ruta, [], metodo === 'GET' || metodo === 'DELETE' ? undefined : {});
      if (x.estado !== 403) sinPermiso.push(`${metodo} ${ruta}→${x.estado}`);
    }
    prueba('Sin ningún permiso, todas las rutas responden 403', !sinPermiso.length, sinPermiso.join(' | '));
    const soloVer = [];
    for (const [metodo, ruta] of rutasAdmin) {
      const x = await llamar(metodo, ruta, VER, metodo === 'GET' || metodo === 'DELETE' ? undefined : {});
      if (x.estado !== 403) soloVer.push(`${metodo} ${ruta}→${x.estado}`);
    }
    prueba('Con solo tiempos.ver, las 14 rutas de administración responden 403', !soloVer.length, soloVer.join(' | '));
    r = await llamar('GET', '/admin/estado', ADMIN);
    prueba('Con tiempos.administrar entra a la administración', r.estado === 200, String(r.estado));

    console.log('Seguridad de las entradas');
    const raros = [["' OR 1=1 --", 5], ['<script>alert(1)</script>', 5], ['../../etc/passwd', 5], ['a'.repeat(5000), 5], [null, 5], [{}, 5], [['x'], 5]];
    const rotos = [];
    for (const [clave, cantidad] of raros) { const x = await una({ productoClave: clave, cantidad }); if (x.http !== 400) rotos.push(`${j(clave).slice(0, 25)}→${x.http}`); }
    prueba('Claves de producto con SQL, HTML, rutas, texto enorme u objetos → siempre 400', !rotos.length, rotos.join(' | '));
    const cuerpos = [];
    for (const crudo of ['[1,2]', '"texto"', '123', 'null', '{"piezas":"x"}', '{"piezas":[null]}', '{"piezas":[1]}', '{"piezas":[[]]}', '{"fechaOrden":{}, "piezas":[{}]}']) {
      const x = await llamar('POST', '/calcular', VER, undefined, crudo); if (x.estado >= 500 || x.estado === 200) cuerpos.push(`${crudo}→${x.estado}`);
    }
    prueba('Cuerpos mal formados → 400 (ni 200 ni 500)', !cuerpos.length, cuerpos.join(' | '));
    const jsonRoto = await llamar('POST', '/calcular', VER, undefined, '{no es json');
    prueba('JSON roto → error controlado, sin 500', jsonRoto.estado < 500, String(jsonRoto.estado));
    const textoError = j((await una({ productoClave: "' OR 1=1 --", cantidad: 5 })).cuerpo);
    prueba('Los mensajes de error no filtran SQL ni rutas del servidor', !/SELECT|mysql|ER_|node_modules|at \w+ \(/i.test(textoError), textoError.slice(0, 160));
  } finally { servidor.close(); }
}

verificar().then(() => { console.log(`\n${buenas} OK, ${malas} fallas`); process.exit(malas ? 1 : 0); }).catch((e) => { console.error('Error inesperado:', e); process.exit(1); });
