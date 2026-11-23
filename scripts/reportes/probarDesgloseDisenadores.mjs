// Prueba del desglose del reporte de diseñadores. Regla del dueño: un vale compartido se entrega, o se atrasa, para TODOS sus diseñadores a la vez («justos
// pagan por pecadores»); sale UNA vez, con un badge por diseñador, y enfocar un diseñador deja los vales donde él participa mostrando a todos sus diseñadores.
// Igual en pantalla (enfoque.js) y en servidor/PDF (soloGrupoDesglose). Sin BD ni servidor:
//   node scripts/reportes/probarDesgloseDisenadores.mjs
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const raiz = fileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const { unirSeccionPorVale, unirSeccionesPorVale } = require(`${raiz}/src/modules/vales/services/valeReporteTalleres.js`);
const { resumenPorDisenador } = require(`${raiz}/src/modules/vales/services/valeReporteDisenadores.js`);
const { soloGrupoDesglose } = require(`${raiz}/src/modules/vales/services/valeReporteFiltroDesglose.js`);
const { enfocarPayload } = await import(pathToFileURL(`${raiz}/public/modules/vales/js/views/reportes2/enfoque.js`).href);

const ok = (cond, msg) => { assert.ok(cond, msg); console.log('OK  ', msg); };
const ana = { id: 1, nombre: 'Ana Pérez' }; const beto = { id: 2, nombre: 'Beto López' };
const vale = (id, disenadores, extra = {}) => ({ id, correlativo: `V-${id}`, autorizado: true, atrasado: false, disenadoresDelVale: disenadores, ...extra });
const grupo = (id, nombre, vales) => ({ id, nombre, total: vales.length, vales });

// El vale 1 es compartido entre Ana y Beto: está en el grupo de cada uno (con la MISMA ficha); el 2 es solo de Ana; el 3, solo de Beto; el 4 no tiene diseñador.
const v1 = vale(1, [ana, beto], { atrasado: true });
const v2 = vale(2, [ana], { atrasado: true }); const v3 = vale(3, [beto], { atrasado: true }); const v4 = vale(4, [], { atrasado: true });
const sec = { total: 5, grupos: [grupo(1, 'Ana Pérez', [v1, v2]), grupo(2, 'Beto López', [v1, v3]), grupo(0, 'Sin asignar', [v4])] };

// ---- una fila por vale ---------------------------------------------------------------------------------------------------------------------
const unida = unirSeccionPorVale(sec);
ok(unida.total === 4, 'el vale compartido cuenta una sola vez en la sección (5 apariciones -> 4 vales)');
const nombres = unida.grupos.map(g => g.nombre);
ok(nombres.join('|') === 'Ana Pérez|Ana Pérez, Beto López|Beto López|Sin asignar', `un grupo por conjunto de diseñadores: ${nombres.join(' | ')}`);
const compartido = unida.grupos.find(g => g.nombre === 'Ana Pérez, Beto López');
ok(compartido.vales.length === 1 && compartido.nombres.join() === 'Ana Pérez,Beto López' && compartido.ids.join() === '1,2', 'el compartido va con sus dos diseñadores (nombres e ids)');
ok(unida.grupos.find(g => g.nombre === 'Sin asignar').nombres.join() === 'Sin asignar', 'un vale sin diseñador va en «Sin asignar»');
ok(unirSeccionesPorVale({ atrasados: sec, noEntregados: { total: 0, grupos: [] } }).atrasados.total === 4, 'las secciones se unen por separado');
ok(sec.grupos[0].vales.length === 2 && sec.total === 5, 'no muta la sección original');

// ---- las filas de diseñadores también traen los talleres del vale: los grupos se arman con los DISEÑADORES (bug hallado contra la BD real) ----------------
const conTalleres = (v) => ({ ...v, talleresDelVale: [{ id: 101, nombre: 'Diseño' }, { id: 102, nombre: 'Diseño UV/3D' }] });
const secMixta = unirSeccionPorVale({ total: 2, grupos: [grupo(1, 'Ana Pérez', [conTalleres(v1), conTalleres(v2)]), grupo(2, 'Beto López', [conTalleres(v1)])] });
ok(secMixta.grupos.map(g => g.nombre).sort().join('|') === 'Ana Pérez|Ana Pérez, Beto López', `con talleres en la fila, los grupos son de diseñadores: ${secMixta.grupos.map(g => g.nombre).join(' | ')}`);
ok(secMixta.grupos.every(g => g.ids.every(id => id === 1 || id === 2)), 'y sus ids son de diseñadores, no de talleres (así el enfoque encuentra al diseñador)');

// ---- «justos pagan por pecadores»: el estado es el del vale, el mismo para los dos ------------------------------------------------------------
const resumen = resumenPorDisenador(new Map([[1, { id: 1, nombre: 'Ana Pérez', vales: [{ ...v1, terminado: false }, { ...v2, terminado: false }] }], [2, { id: 2, nombre: 'Beto López', vales: [{ ...v1, terminado: false }, { ...v3, terminado: false }] }]]));
ok(resumen.every(d => d.entregados === 0 && d.efectividad === 0), 'si el vale compartido no está completo, no cuenta como entregado para NINGUNO de los dos');
const entregado = { ...v1, atrasado: false, terminado: true, diasTarde: 2 };
const resumenOk = resumenPorDisenador(new Map([[1, { id: 1, nombre: 'Ana Pérez', vales: [entregado] }], [2, { id: 2, nombre: 'Beto López', vales: [entregado] }]]));
ok(resumenOk.every(d => d.entregados === 1 && d.tarde === 1 && d.efectividad === 100 && d.tardias === 100), 'cuando está completo y tarde, es una entrega tarde para los dos');

// ---- enfoque: sobre los grupos unidos; el vale se sigue viendo con TODOS sus diseñadores ---------------------------------------------------------
const reporte = {
  grupos: { secciones: { atrasados: unida } },
  atrasadosVigentes: { total: 0, grupos: [] },
  contadores: { porGrupo: { 1: { todos: { ingresados: 2 }, entregados: { ingresados: 0 }, tarde: { ingresados: 0 } }, 2: { todos: { ingresados: 2 } } } }
};
const nombresDe = (r) => r.grupos.secciones.atrasados.grupos.flatMap(g => g.vales.map(x => `${x.id}:${g.nombre}`)).sort();
const deAna = enfocarPayload(reporte, { id: 1 });
ok(nombresDe(deAna).join('|') === '1:Ana Pérez, Beto López|2:Ana Pérez', `pantalla: enfocar a Ana deja sus dos vales y el compartido conserva a AMBOS (${nombresDe(deAna).join('|')})`);
ok(deAna.grupos.secciones.atrasados.total === 2, 'pantalla: el total de la sección es el del diseñador');
ok(nombresDe(enfocarPayload(reporte, { id: 2 })).join('|') === '1:Ana Pérez, Beto López|3:Beto López', 'pantalla: enfocar a Beto muestra el compartido con ambos');
const sv = soloGrupoDesglose(reporte, 1);
ok(nombresDe(sv).join('|') === nombresDe(deAna).join('|') && sv.grupos.secciones.atrasados.total === 2, 'servidor/PDF: el mismo enfoque y el mismo total que en pantalla');
ok(reporte.grupos.secciones.atrasados === unida && unida.total === 4, 'la vista general no cambia');
console.log('\nTodo OK');
