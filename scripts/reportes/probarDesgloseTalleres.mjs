// Prueba del desglose del reporte de talleres: un vale compartido sale una sola vez (con todos sus talleres en la columna) y el enfoque de un taller
// parte de su copia con un grupo por taller, igual en pantalla (enfoque.js) y en el servidor/PDF (valeReporteFiltroDesglose.js). Sin BD ni servidor:
//   node scripts/reportes/probarDesgloseTalleres.mjs
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const raiz = fileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const { unirSeccionPorVale, unirSeccionesPorVale } = require(`${raiz}/src/modules/vales/services/valeReporteTalleres.js`);
const { soloGrupoDesglose } = require(`${raiz}/src/modules/vales/services/valeReporteFiltroDesglose.js`);
const { enfocarPayload } = await import(pathToFileURL(`${raiz}/public/modules/vales/js/views/reportes2/enfoque.js`).href);

const ok = (cond, msg) => { assert.ok(cond, msg); console.log('OK  ', msg); };
const v = (id, extra = {}) => ({ id, correlativo: `V-${id}`, urgente: false, autorizado: true, atrasado: false, ...extra });
const grupo = (id, nombre, vales) => ({ id, nombre, total: vales.length, vales });

// Vale 1 compartido entre Diseño (1) y UV/3D (2); vale 2 solo de Diseño; vale 3 solo de UV/3D.
const compartido = v(1, { atrasado: true });
const sec = { total: 4, grupos: [grupo(1, 'Diseño', [compartido, v(2, { atrasado: true })]), grupo(2, 'Diseño UV/3D', [compartido, v(3, { atrasado: true })])] };

// ---- unir por vale ---------------------------------------------------------------------------------------------------------------------
const unida = unirSeccionPorVale(sec);
ok(unida.total === 3, 'el vale compartido cuenta una sola vez en la sección (4 partes -> 3 vales)');
const nombres = unida.grupos.map(g => g.nombre);
ok(nombres.includes('Diseño, Diseño UV/3D') && nombres.includes('Diseño') && nombres.includes('Diseño UV/3D'), `un grupo por conjunto de talleres: ${nombres.join(' | ')}`);
ok(unida.grupos.find(g => g.nombre === 'Diseño, Diseño UV/3D').vales.length === 1, 'el compartido está solo en el grupo con ambos talleres');
ok(unida.grupos.every(g => g.total === g.vales.length), 'el total de cada grupo es el de sus vales');
ok(unida.grupos.find(g => g.nombre === 'Diseño, Diseño UV/3D').atrasados === 1, 'los atrasados del grupo se recalculan');
ok(unirSeccionPorVale({ total: 0, grupos: [] }).grupos.length === 0, 'sección vacía sigue vacía');
const todas = unirSeccionesPorVale({ atrasados: sec, noEntregados: { total: 0, grupos: [] }, entregados: { total: 0, grupos: [] } });
ok(todas.atrasados.total === 3 && todas.noEntregados.total === 0, 'las tres secciones se unen por separado');
ok(sec.grupos[0].vales.length === 2 && sec.total === 4, 'no muta la sección original');

// ---- enfoque de un taller: sobre los grupos unidos, y el vale se sigue viendo con TODOS sus talleres ------------------------------------------
ok(unida.grupos.find(g => g.nombre === 'Diseño, Diseño UV/3D').ids.join() === '1,2', 'el grupo unido guarda los ids de sus talleres');
const reporte = {
  grupos: { secciones: { atrasados: unida } },
  atrasadosVigentes: { total: 0, grupos: [] },
  contadores: { porGrupo: { 1: { todos: { ingresados: 2 }, entregados: { ingresados: 0 }, tarde: { ingresados: 0 } }, 2: { todos: { ingresados: 2 } } } }
};
const nombresDe = (r) => r.grupos.secciones.atrasados.grupos.flatMap(g => g.vales.map(x => `${x.id}:${g.nombre}`)).sort();
const enPantalla = enfocarPayload(reporte, { id: 1 });
ok(nombresDe(enPantalla).join('|') === '1:Diseño, Diseño UV/3D|2:Diseño', `pantalla: enfocar Diseño deja sus dos vales y el compartido conserva AMBOS talleres (${nombresDe(enPantalla).join('|')})`);
const enUV = enfocarPayload(reporte, { id: 2 });
ok(nombresDe(enUV).join('|') === '1:Diseño, Diseño UV/3D|3:Diseño UV/3D', 'pantalla: enfocar UV/3D deja sus vales y el compartido también muestra ambos talleres');
ok(enPantalla.grupos.secciones.atrasados.total === 2, 'pantalla: el total de la sección es el del taller');
const enServidor = soloGrupoDesglose(reporte, 1);
ok(nombresDe(enServidor).join('|') === nombresDe(enPantalla).join('|'), 'servidor/PDF: el mismo enfoque que en pantalla');
ok(enServidor.grupos.secciones.atrasados.total === 2, 'servidor/PDF: el mismo total');

// ---- reporte filtrado por UN taller: el vale compartido sigue mostrando TODOS sus talleres (`talleresDelVale`) ---------------------------------------
const delVale = [{ id: 1, nombre: 'Diseño' }, { id: 2, nombre: 'Diseño UV/3D' }];
const soloDiseno = { total: 1, grupos: [grupo(1, 'Diseño', [{ ...v(9, { atrasado: true }), talleresDelVale: delVale }])] }; // el filtro dejó solo el grupo de Diseño
const filtrada = unirSeccionPorVale(soloDiseno);
ok(filtrada.grupos.length === 1 && filtrada.grupos[0].nombre === 'Diseño, Diseño UV/3D', `filtrado por Diseño el vale sigue con ambos talleres (${filtrada.grupos[0].nombre})`);
ok(filtrada.grupos[0].ids.join() === '1,2' && filtrada.grupos[0].nombres.length === 2, 'y el grupo guarda los ids y nombres de ambos');
ok(enfocarPayload({ grupos: { secciones: { atrasados: filtrada } }, atrasadosVigentes: { total: 0, grupos: [] }, contadores: { porGrupo: { 2: { todos: { ingresados: 1 } } } } }, { id: 2 }).grupos.secciones.atrasados.total === 1, 'enfocar el taller que el filtro no mostró igual encuentra el vale compartido');
console.log('\nTodo OK');
