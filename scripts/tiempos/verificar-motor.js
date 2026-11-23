// scripts/tiempos/verificar-motor.js
// Pruebas del motor de la Calculadora de Tiempos y de las fechas (sin base de datos). Usa la carga inicial (tablaV5) como tabla.
// Uso: node scripts/tiempos/verificar-motor.js
const datos = require('../../src/modules/tiempos/datos/tablaV5');
const { tablaDesdeDatos } = require('../../src/modules/tiempos/calculo/tablaDesdeDatos');
const { calcularPieza, calcularPedido } = require('../../src/modules/tiempos/calculo/motor');
const { sumarDiasHabiles, hacerDiaHabil, fechaLarga, esFechaISO } = require('../../src/modules/tiempos/calculo/fechas');
const { resumenTexto } = require('../../src/modules/tiempos/calculo/resumen');

let buenas = 0; let malas = 0;
const prueba = (nombre, condicion, detalle = '') => { condicion ? buenas++ : malas++; console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`); };
const tabla = tablaDesdeDatos(datos);
const j = (x) => JSON.stringify(x);
const ORDEN = '2026-11-23'; // lunes

console.log('Fechas');
prueba('7 días hábiles desde el lunes 23 nov → miércoles 2 dic (el día de la orden no cuenta)', sumarDiasHabiles(ORDEN, 7) === '2026-12-02', sumarDiasHabiles(ORDEN, 7));
prueba('desde un viernes, 1 día hábil → lunes', sumarDiasHabiles('2026-11-27', 1) === '2026-11-30');
prueba('desde un sábado, 1 día hábil → lunes', sumarDiasHabiles('2026-11-28', 1) === '2026-11-30');
prueba('un festivo entre semana no cuenta', sumarDiasHabiles(ORDEN, 7, hacerDiaHabil(new Set(['2026-12-01']))) === '2026-12-03');
prueba('fecha larga en español', fechaLarga('2026-12-08') === 'martes 8 de diciembre de 2026', fechaLarga('2026-12-08'));
prueba('fechas imposibles se detectan', !esFechaISO('2026-02-30') && esFechaISO('2026-02-28') && !esFechaISO('23/11/2026'));

console.log('Una pieza');
let r = calcularPieza(tabla, { productoClave: 'mundi-trofeos-genericos', cantidad: 120 });
prueba('Trofeos genéricos 120: Diseño 1 + Ensamble 5 + margen 1 = 7', r.estado === 'ok' && r.total === 7 && j(r.etapas.map(e => e.dias)) === '[1,5]' && r.margen === 1, j(r));
prueba('«Cliente» impreso = total del motor en todos los rangos (135 filas)', (() => {
  const mal = [];
  for (const p of datos.PRODUCTOS) for (const [desde, hasta, , cliente] of p.rangos) {
    if (hasta === null) continue;
    for (const c of [desde, hasta]) { const x = calcularPieza(tabla, { productoClave: p.clave, cantidad: c }); if (x.estado !== 'ok' || x.total !== cliente) mal.push(`${p.nombre} ${c}`); }
  }
  return mal.length === 0 ? true : mal.slice(0, 3).join('; ');
})() === true);
r = calcularPieza(tabla, { productoClave: 'fundida-antique-con-color', cantidad: 500 });
const r2 = calcularPieza(tabla, { productoClave: 'fundida-antique-con-color', cantidad: 501 });
prueba('el límite del rango: 500 → 11 días y 501 → 12 días', r.total === 11 && r2.total === 12, `${r.total} / ${r2.total}`);
r = calcularPieza(tabla, { productoClave: 'fundida-antique-sin-color', cantidad: 3500 });
prueba('3500 (3001+) → a convenir, sin días', r.estado === 'a_convenir' && r.total === undefined, j(r));
r = calcularPieza(tabla, { productoClave: 'fundida-antique-con-color', cantidad: 50 });
prueba('menos del mínimo (75) → avisa el mínimo', r.estado === 'bajo_minimo' && r.minimo === 75, j(r));
prueba('cantidades inválidas (0, -1, 1.5, texto, vacío) → inválida con motivo', [0, -1, 1.5, '12', null, undefined, NaN].every(c => { const x = calcularPieza(tabla, { productoClave: 'mundi-comandos', cantidad: c }); return x.estado === 'invalida' && x.errores.cantidad; }));
r = calcularPieza(tabla, { productoClave: 'no-existe', cantidad: 10 });
prueba('un producto que no existe → inválida', r.estado === 'invalida' && r.errores.productoClave);

console.log('Colores');
const dc = (colores) => { const x = calcularPieza(tabla, { productoClave: 'fundida-antique-con-color', cantidad: 300, colores }); return x.estado === 'ok' ? x.total - 11 : x; };
prueba('1 y 2 colores no suman; 3 y 4 suman 1; 5 y 6 suman 2; 7 suma 3', [1, 2, 3, 4, 5, 6, 7].map(dc).join() === '0,0,1,1,2,2,3', [1, 2, 3, 4, 5, 6, 7].map(dc).join());
prueba('colores fuera de 1 a 12 → inválida', calcularPieza(tabla, { productoClave: 'mundi-comandos', cantidad: 30, colores: 0 }).estado === 'invalida' && calcularPieza(tabla, { productoClave: 'mundi-comandos', cantidad: 30, colores: 13 }).estado === 'invalida');

console.log('Extras');
r = calcularPieza(tabla, { productoClave: 'fundida-antique-con-color', cantidad: 300, colores: 4, moldesGrande: true, lanyard: true });
prueba('Antique con color 300, 4 colores, moldes y lanyard → 10 + 1 + 2 + 1 + 1 = 15', r.total === 15 && r.extras.length === 3, j(r));
prueba('el desglose lista cada extra por separado', j(r.extras.map(e => [e.clave, e.dias])) === '[["colores",1],["moldes",2],["costura",1]]', j(r.extras));
r = calcularPieza(tabla, { productoClave: 'mundi-trofeos-genericos', cantidad: 120, uv: 'uv-cama-plana' });
prueba('UV cama plana en 120 piezas suma 4 días (7 → 11)', r.total === 11 && r.extras[0].dias === 4 && r.avisos.some(a => /mínimos/.test(a)), j(r));
r = calcularPieza(tabla, { productoClave: 'mundi-trofeos-genericos', cantidad: 120, uv: 'uv-impresion' });
prueba('UV impresión en 120 piezas (rango 75–250) suma 2 días (7 → 9)', r.total === 9, j(r));
r = calcularPieza(tabla, { productoClave: 'mundi-trofeos-genericos', cantidad: 50, uv: 'uv-impresion' });
prueba('UV impresión en 50 piezas → avisa el mínimo de UV (75)', r.estado === 'bajo_minimo' && r.minimo === 75, j(r));
r = calcularPieza(tabla, { productoClave: 'mundi-comandos', cantidad: 150, uv: 'uv-vinil' });
prueba('UV vinil en 150 piezas suma 1 día (1–300)', r.estado === 'ok' && r.extras[0].dias === 1, j(r));
prueba('UV con cantidad en «a convenir» (más de 1000) deja la pieza a convenir', calcularPieza(tabla, { productoClave: 'protextil-bandana', cantidad: 2000, uv: 'uv-cama-plana' }).estado === 'a_convenir');
prueba('moldes en un producto que no los lleva → inválida', calcularPieza(tabla, { productoClave: 'mundi-comandos', cantidad: 30, moldesGrande: true }).errores?.moldesGrande);
prueba('lanyard en un producto que no lo lleva → inválida', calcularPieza(tabla, { productoClave: 'mundi-comandos', cantidad: 30, lanyard: true }).errores?.lanyard);
prueba('un tipo de UV desconocido → inválida', calcularPieza(tabla, { productoClave: 'mundi-comandos', cantidad: 30, uv: 'uv-x' }).errores?.uv);
r = calcularPieza(tabla, { productoClave: 'fundida-antique-con-color', cantidad: 3000, lanyard: true });
prueba('lanyard con cantidad que ya no está en la tabla de costura (más de 2500) → a convenir', r.estado === 'a_convenir', j(r));
prueba('lanyard en la cantidad mínima de la pieza fundida (75) sí tiene costura (rango 50–250)', calcularPieza(tabla, { productoClave: 'fundida-antique-con-color', cantidad: 75, lanyard: true }).estado === 'ok');
prueba('urgente no cambia los días, solo agrega el aviso del gerente', (() => { const a = calcularPieza(tabla, { productoClave: 'mundi-comandos', cantidad: 30 }); const b = calcularPieza(tabla, { productoClave: 'mundi-comandos', cantidad: 30, urgente: true }); return a.total === b.total && b.urgente && b.avisos.some(x => /gerente/.test(x)); })());
prueba('los avisos del producto salen con el resultado', calcularPieza(tabla, { productoClave: 'mundi-3d-filamento', cantidad: 20 }).avisos.some(a => /filamento/i.test(a)));

console.log('Pedido');
const pedido = { fechaOrden: ORDEN, piezas: [{ productoClave: 'fundida-antique-con-color', cantidad: 300 }, { productoClave: 'protextil-lanyard', cantidad: 300 }, { productoClave: 'mundi-medallas', cantidad: 500 }] };
let p = calcularPedido(tabla, pedido);
prueba('tres piezas de 11, 8 y 5 días → el pedido tarda 11 (la más larga, no la suma)', p.estado === 'ok' && p.dias === 11 && j(p.piezas.map(x => x.total)) === '[11,8,5]', j(p.piezas.map(x => x.total)));
prueba('la pieza más larga es la 1 y la entrega es el martes 8 de diciembre', p.piezaMasLarga === 0 && p.fechaEntrega === '2026-12-08' && p.desde === '2026-11-24', `${p.piezaMasLarga} ${p.fechaEntrega} ${p.desde}`);
p = calcularPedido(tabla, { fechaOrden: ORDEN, piezas: [{ productoClave: 'mundi-trofeos-genericos', cantidad: 120 }] }, { esHabil: hacerDiaHabil(new Set(['2026-11-26'])) });
prueba('un festivo en medio mueve la entrega un día (7 días: 2 dic → 3 dic)', p.fechaEntrega === '2026-12-03', p.fechaEntrega);
p = calcularPedido(tabla, { fechaOrden: ORDEN, piezas: [...pedido.piezas, { productoClave: 'fundida-antique-sin-color', cantidad: 3500 }] });
prueba('una pieza a convenir deja todo el pedido a convenir, sin fecha', p.estado === 'a_convenir' && p.fechaEntrega === undefined && p.dias === undefined, j(p).slice(0, 120));
p = calcularPedido(tabla, { fechaOrden: ORDEN, piezas: [{ productoClave: 'mundi-comandos', cantidad: 5 }, { productoClave: 'mundi-comandos', cantidad: 30, urgente: true }] });
prueba('con una pieza urgente, el pedido se marca urgente', p.estado === 'ok' && p.urgente === true, j(p).slice(0, 100));
prueba('sin piezas o con fecha imposible → inválido con motivo', calcularPedido(tabla, { fechaOrden: ORDEN, piezas: [] }).errores?.piezas && calcularPedido(tabla, { fechaOrden: '2026-02-30', piezas: [{ productoClave: 'mundi-comandos', cantidad: 30 }] }).errores?.fechaOrden);
prueba('una pieza inválida marca el pedido inválido', calcularPedido(tabla, { fechaOrden: ORDEN, piezas: [{ productoClave: 'mundi-comandos', cantidad: 0 }] }).estado === 'invalida');
prueba('el motor no cambia los datos de entrada', (() => { const copia = j(tabla); calcularPedido(tabla, pedido); return copia === j(tabla); })());

console.log('Resumen para copiar');
const t = resumenTexto(calcularPedido(tabla, pedido));
prueba('el texto trae el pedido, cada pieza, la entrega y la nota del arte', /^Pedido del lunes 23 de noviembre de 2026 \(tabla v5\.0\)/.test(t) && t.includes('1) Antique con color · 300 pzs → 11 días') && t.includes('Entrega: martes 8 de diciembre de 2026 (11 días hábiles)') && t.endsWith('No incluye el diseño del arte interno.'), t);

console.log(`\n${buenas} OK, ${malas} fallas`);
process.exit(malas ? 1 : 0);
