// Prueba de las reglas puras del reporte de actividad por diseñador (sin base de datos ni servidor):
//   - porcentajes con hasta dos decimales (`porcentajeDe`, `porcentajeONulo`);
//   - la ficha «por parte» de un diseñador (vale compartido, atraso, sección, «sin diseñador»);
//   - `porDisenador`, las variantes de `porGrupo` y los contadores de vales únicos;
//   - regresión: `seccionDeEntrega` da lo mismo que la regla anterior de `fichar` para fichas que no son de diseñador.
// Lo que NO cubre: el cableado dentro de `armar` (necesita la base de datos).
// Correrla:  node scripts/reportes/probarContadoresDisenador.mjs   (sale con código distinto de 0 si algo falla)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ruta = (archivo) => fileURLToPath(new URL(`../../src/modules/vales/services/${archivo}`, import.meta.url));
const { contadoresDeFichas, contadoresPorGrupo, completarPorGrupo, porcentajeDe, porcentajeONulo } = require(ruta('valeReporteContadores.js'));
const D = require(ruta('valeReporteDisenadores.js'));

let fallos = 0;
const igual = (nombre, real, esperado) => {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) fallos += 1;
  console.log(`${ok ? 'OK ' : 'FALLA'} ${nombre}${ok ? '' : `\n   real:     ${JSON.stringify(real)}\n   esperado: ${JSON.stringify(esperado)}`}`);
};

// (a) porcentajes
igual('porcentajeDe 1/3 = 33.33', porcentajeDe(1, 3), 33.33);
igual('porcentajeDe 2/3 = 66.67', porcentajeDe(2, 3), 66.67);
igual('porcentajeDe 1/2 = 50', porcentajeDe(1, 2), 50);
igual('porcentajeDe base 0 = 0', porcentajeDe(0, 0), 0);
igual('porcentajeONulo 1/3 = 33.33', porcentajeONulo(1, 3), 33.33);
igual('porcentajeONulo 0/5 = 0 (base real)', porcentajeONulo(0, 5), 0);
igual('porcentajeONulo base 0 = null', porcentajeONulo(0, 0), null);

// (b) la ficha por parte ya no existe: un vale compartido se entrega o se atrasa para todos (regla del dueño), así que solo se agrupa.

// (c) tres diseñadores: 10 (vales 1 compartido, 2 entregado tarde), 11 (vales 1 compartido, 3 urgente), 0 (vale 4 sin diseñador)
const ficha = (id, p) => ({ id, urgente: false, terminado: false, diasTarde: 0, seccion: 'noEntregados', atrasado: false, ...p });
const v1A = ficha(1, { terminado: true, diasTarde: 0, seccion: 'entregados' });                  // compartido: A entregó a tiempo
const v1B = ficha(1, { seccion: 'atrasados', atrasado: true });                                   // compartido: B pendiente y vencido
const v2A = ficha(2, { terminado: true, diasTarde: 2, seccion: 'entregados' });                  // entrega tarde
const v3B = ficha(3, { urgente: true });                                                          // urgente sin entregar
const v4 = ficha(4);                                                                              // sin diseñador
const grupos = new Map([
  [10, { id: 10, nombre: 'Ana · Encargado', vales: [v1A, v2A] }],
  [11, { id: 11, nombre: 'Beto', vales: [v1B, v3B] }],
  [0, { id: 0, nombre: 'Sin diseñador asignado', vales: [v4] }],
  [12, { id: 12, nombre: 'Carla', vales: [] }]
]);
const pd = D.resumenPorDisenador(grupos);
igual('porDisenador ordenado por asignados y nombre', pd.map(x => x.nombre), ['Ana · Encargado', 'Beto', 'Sin diseñador asignado', 'Carla']);
igual('porDisenador Ana', pd[0], { id: 10, nombre: 'Ana · Encargado', asignados: 2, entregados: 2, tarde: 1, efectividad: 100, tardias: 50 });
igual('porDisenador Beto: 0 entregados, tardías null', pd[1], { id: 11, nombre: 'Beto', asignados: 2, entregados: 0, tarde: 0, efectividad: 0, tardias: null });
igual('porDisenador Carla sin vales: ambas null', [pd[3].asignados, pd[3].efectividad, pd[3].tardias], [0, null, null]);
igual('entregados <= asignados en todos', pd.every(x => x.entregados <= x.asignados), true);
const mapa = new Map([...grupos].map(([id, g]) => [id, g.vales]));
const pg = completarPorGrupo(contadoresPorGrupo(mapa, { conEntrega: true }), { 11: { todos: 2, urgentes: 1 } });
igual('porGrupo[10] ingresados por variante', [pg[10].todos.ingresados, pg[10].urgentes.ingresados, pg[10].entregados.ingresados, pg[10].tarde.ingresados], [2, 0, 2, 1]);
igual('porGrupo[10].tarde: recibidos con atraso 1', pg[10].tarde.recibidos, { total: 1, conAtraso: 1, sinAtraso: 0 });
igual('porGrupo[11] todos: 1 atrasado actual + 2 anteriores', pg[11].todos.atrasados, { total: 3, anteriores: 2, actuales: 1 });
igual('porGrupo[11] urgentes: anteriores 1; urgentes.total 1 (100 %)', [pg[11].urgentes.atrasados.anteriores, pg[11].urgentes.urgentes], [1, { total: 1, porcentaje: 100 }]);
igual('anteriores de entregados y tarde = 0', [pg[11].entregados.atrasados.anteriores, pg[10].tarde.atrasados.anteriores], [0, 0]);
igual('suma de variantes: entregados + atrasados + sin entregar = ingresados (todos[10])', pg[10].todos.recibidos.total + pg[10].todos.atrasados.actuales + pg[10].todos.sinEntregar, pg[10].todos.ingresados);
igual('porGrupo del grupo vacío sin vales', [pg[12].todos.ingresados, pg[12].entregados.ingresados], [0, 0]);
igual('porGrupo sin conEntrega solo trae todos y urgentes (tienda/asesor)', Object.keys(contadoresPorGrupo(mapa)[10]), ['todos', 'urgentes']);
igual('urgentes.porcentaje con dos decimales (1 de 3)', contadoresDeFichas({ fichas: [ficha(1, { urgente: true }), ficha(2), ficha(3)] }).urgentes.porcentaje, 33.33);

// (d) contadores de vales únicos: el vale 1 compartido cuenta UNA vez (ficha del vale, no la de cada diseñador)
const unicas = [ficha(1, { seccion: 'noEntregados' }), ficha(2, { terminado: true, diasTarde: 2, seccion: 'entregados' }), ficha(3, { urgente: true, seccion: 'atrasados', atrasado: true }), ficha(4)];
const u = D.contadoresUnicos(unicas);
igual('únicos: ingresados 4, recibidos 1, atrasados 1, sin entregar 2', [u.ingresados, u.recibidos.total, u.atrasados.actuales, u.sinEntregar], [4, 1, 1, 2]);
igual('identidad entregados + atrasados actuales + sin entregar = ingresados', u.recibidos.total + u.atrasados.actuales + u.sinEntregar, u.ingresados);
igual('efectividad 25 y aTiempo 0 (el único recibido llegó tarde)', [u.efectividad, u.aTiempo], [25, 0]);
const vacio = D.contadoresUnicos([]);
igual('sin vales: efectividad y aTiempo null', [vacio.efectividad, vacio.aTiempo], [null, null]);

// (e) regresión: seccionDeEntrega == regla anterior de `fichar` en las 8 combinaciones
const reglaAnterior = ({ abierto, vencido, entregado }) => { const a = abierto && vencido; return { atrasado: a, seccion: a ? 'atrasados' : (entregado ? 'entregados' : 'noEntregados') }; };
let distintas = 0;
for (const abierto of [true, false]) for (const vencido of [true, false]) for (const entregado of [true, false]) {
  if (JSON.stringify(D.seccionDeEntrega({ abierto, vencido, entregado })) !== JSON.stringify(reglaAnterior({ abierto, vencido, entregado }))) distintas += 1;
}
igual('seccionDeEntrega idéntica a la regla anterior (8 combinaciones)', distintas, 0);

console.log(fallos ? `\n${fallos} prueba(s) fallaron` : '\nTodas las pruebas OK');
process.exit(fallos ? 1 : 0);
