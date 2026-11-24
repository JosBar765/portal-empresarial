// scripts/tiempos/verificar-datos.js
// Revisa la carga inicial de la Tabla de tiempos (src/modules/tiempos/datos/tablaV5.js) sin tocar la base:
//  - «Cliente» impreso = suma de las etapas + margen,
//  - los rangos de cada producto no se traslapan ni dejan huecos y el último queda «a convenir»,
//  - cada rango trae un día por cada etapa del producto, y las etapas, líneas y claves existen y no se repiten.
// Uso: node scripts/tiempos/verificar-datos.js
const { ETAPAS, LINEAS, PRODUCTOS, UV, PARAMETROS } = require('../../src/modules/tiempos/datos/tablaV5');

let buenas = 0;
const avisos = [];
const falla = (m) => { avisos.push(m); };
const margen = PARAMETROS.find(p => p[0] === 'margen_dias')[1];
const etapas = new Set(ETAPAS.map(e => e[0]));
const lineas = new Set(LINEAS.map(l => l[0]));
const claves = new Set();

for (const p of PRODUCTOS) {
  if (claves.has(p.clave)) falla(`${p.clave}: clave repetida`);
  claves.add(p.clave);
  if (!lineas.has(p.linea)) falla(`${p.clave}: línea desconocida «${p.linea}»`);
  p.etapas.forEach(e => { if (!etapas.has(e)) falla(`${p.clave}: etapa desconocida «${e}»`); });
  let previoHasta = null;
  p.rangos.forEach(([desde, hasta, dias, cliente], i) => {
    const ultimo = i === p.rangos.length - 1;
    if (previoHasta !== null && desde !== previoHasta + 1) falla(`${p.nombre}: el rango ${desde} no continúa al anterior (termina en ${previoHasta})`);
    if (ultimo && hasta !== null) falla(`${p.nombre}: el último rango debe ser «en adelante»`);
    if (!ultimo && hasta === null) falla(`${p.nombre}: solo el último rango puede ser «en adelante»`);
    if (hasta !== null && hasta < desde) falla(`${p.nombre}: el rango ${desde}-${hasta} está al revés`);
    if (hasta === null) { if (dias || cliente) falla(`${p.nombre}: «a convenir» no lleva días`); } else {
      if (!dias || dias.length !== p.etapas.length) falla(`${p.nombre} ${desde}-${hasta}: faltan días de alguna etapa`);
      else {
        const esperado = dias.reduce((a, b) => a + b, 0) + margen;
        if (esperado !== cliente) falla(`${p.nombre} ${desde}-${hasta}: Cliente impreso ${cliente}, pero etapas (${dias.join('+')}) + margen = ${esperado}`);
        else buenas++;
      }
      previoHasta = hasta;
    }
  });
}
for (const u of UV) {
  let previoHasta = null;
  u.rangos.forEach(([desde, hasta, dias], i) => {
    if (previoHasta !== null && desde !== previoHasta + 1) falla(`${u.nombre}: el rango ${desde} no continúa al anterior`);
    if ((i === u.rangos.length - 1) !== (hasta === null)) falla(`${u.nombre}: solo el último rango debe ser «en adelante»`);
    if (hasta !== null && !dias) falla(`${u.nombre} ${desde}-${hasta}: falta el día que suma`);
    if (hasta !== null) previoHasta = hasta;
  });
}
console.log(`${PRODUCTOS.length} productos, ${PRODUCTOS.reduce((n, p) => n + p.rangos.length, 0)} rangos, ${UV.length} tipos de UV.`);
console.log(`${buenas} filas con «Cliente» impreso que coincide con etapas + margen.`);
if (avisos.length) { console.log(`\n${avisos.length} diferencia(s) para revisar contra la tabla impresa:`); avisos.forEach(a => console.log('  - ' + a)); process.exit(1); }
console.log('Sin diferencias.');
