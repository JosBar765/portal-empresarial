// Prueba de CRUCE del filtro del desglose de los reportes de actividad (tiendas y asesores).
// La misma regla vive en DOS lugares y deben dar lo mismo con los mismos datos:
//   - frontend: public/modules/vales/js/views/reportes2/filtroContadores.js  (lo que se ve al presionar un contador)
//   - servidor: src/modules/vales/services/valeReporteFiltroDesglose.js       (lo que imprime el PDF con los filtros aplicados)
// Correrla ANTES y DESPUÉS de tocar cualquiera de las dos:  node scripts/reportes/probarFiltroDesglose.mjs
// No usa base de datos ni servidor (datos de prueba). Sale con error (código distinto de 0) si las dos copias difieren.
// Además genera PDF de prueba en memoria con el filtro aplicado, vacío por filtro y solo «anteriores» para comprobar que no lanza.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const raiz = fileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, ''); // raíz del repositorio
const require = createRequire(raiz + '/package.json');
const { aplicarFiltroContador, ESTADOS_FILTRO } = await import(pathToFileURL(raiz + '/public/modules/vales/js/views/reportes2/filtroContadores.js').href);
const B = require(raiz + '/src/modules/vales/services/valeReporteFiltroDesglose.js');
const pdfSvc = require(raiz + '/src/modules/vales/services/valeReportePdfService.js');
const { PDFDocument } = require(raiz + '/node_modules/pdf-lib');

let n = 0;
const mk = (urgente, extra) => ({ id: n++, correlativo: `V-${n}`, esMod: false, urgente, autorizado: true, creadoEn: '2026-10-01 09:00:00', fechaEntrega: '2026-10-20', pipeline: { pasos: ['A', 'B', 'C'], paso: 2, terminado: false }, ...extra });
const sec = (vales) => ({ total: vales.length, grupos: vales.length ? [{ id: 1, nombre: 'A', total: Math.ceil(vales.length / 2), vales: vales.slice(0, Math.ceil(vales.length / 2)) }, { id: 2, nombre: 'B', total: vales.length - Math.ceil(vales.length / 2), vales: vales.slice(Math.ceil(vales.length / 2)) }].filter(g => g.vales.length) : [] });
const atr = [mk(true, { atrasado: true, diasAtraso: 2 }), mk(false, { atrasado: true, diasAtraso: 1 }), mk(true, { atrasado: true, diasAtraso: 4 })];
const noE = [mk(true), mk(false), mk(false), mk(true)];
const ent = [mk(true, { diasTarde: 2 }), mk(false, { diasTarde: 0 }), mk(true, { diasTarde: 0 }), mk(false, { diasTarde: 3 }), mk(false, { diasTarde: 0 })];
const ant = [mk(false, { atrasado: true, diasAtraso: 9 }), mk(true, { atrasado: true, diasAtraso: 7 })];
const todos = [...atr, ...noE, ...ent];
const payload = {
  tipo: 'actividad-asesor', rol: 'asesor', titulo: 'Actividad de asesores', periodo: { etiqueta: 'Octubre 2026', titulo: 'Fecha de entrega: Octubre 2026' },
  resumenFiltros: ['Asesores: Todos'], evaluados: [], tablas: [], incluirDesglose: true,
  contadores: { ingresados: todos.length, urgentes: { total: 6, porcentaje: 50 }, sinEntregar: noE.length, atrasados: { total: 5, anteriores: 2, actuales: 3 }, recibidos: { total: 5, conAtraso: 2, sinAtraso: 3 }, porAsesor: [{ id: 1, nombre: 'A', total: 12, urgentes: 6 }] },
  grupos: { agruparPor: 'asesor', desgloseOmitido: false, totalVales: todos.length, secciones: { atrasados: sec(atr), noEntregados: sec(noE), entregados: sec(ent) } },
  atrasadosVigentes: { ...sec(ant), truncado: false }
};
const copia = JSON.stringify(payload);

// (a) cruce con el frontend
let comparados = 0;
const cmp = (estado, urgentes) => {
  const f = aplicarFiltroContador(payload, { estado, urgente: urgentes });
  const b = B.filtrarDesglose(payload, { estado, urgentes });
  assert.deepEqual(b.grupos, f.grupos, `grupos ${estado} ${urgentes}`);
  assert.deepEqual(b.atrasadosVigentes, f.atrasadosVigentes, `vigentes ${estado} ${urgentes}`);
  assert.equal(b.contadores, payload.contadores);
  comparados++;
};
assert.deepEqual(B.ESTADOS_DESGLOSE, ESTADOS_FILTRO);
for (const e of ESTADOS_FILTRO) { cmp(e, false); cmp(e, true); }
cmp(null, true); cmp(null, false);
assert.equal(B.filtrarDesglose(payload, {}), payload);
console.log('(a) cruce frontend/backend OK, combinaciones comparadas:', comparados);

// (b) sin mutar
assert.equal(JSON.stringify(payload), copia);
console.log('(b) entrada sin mutar OK');

// (c) PDF
const paginas = async (r) => (await PDFDocument.load(await pdfSvc.generar(r, { generadoPor: 'Prueba', ahora: '20/11/2026 12:00' }))).getPageCount();
const filtrado = B.aplicarFiltroPdf(payload, { desgloseEstado: 'entregadosConAtraso', desgloseUrgentes: false });
const vacio = B.aplicarFiltroPdf(payload, { desgloseEstado: 'sinEntregar', desgloseUrgentes: true });
const vacio2 = B.aplicarFiltroPdf({ ...payload, grupos: { ...payload.grupos, secciones: { ...payload.grupos.secciones, noEntregados: sec([mk(false)]) } } }, { desgloseEstado: 'sinEntregar', desgloseUrgentes: true });
const soloAnt = B.aplicarFiltroPdf(payload, { desgloseEstado: 'atrasadosAnteriores' });
console.log('(c) normal:', await paginas(payload), 'pág | filtrado:', await paginas(filtrado), 'pág | vacío por filtro:', await paginas(vacio2), 'pág | solo anteriores:', await paginas(soloAnt));
console.log('    resumenFiltros filtrado:', JSON.stringify(filtrado.resumenFiltros), '| filtroDesglose:', filtrado.filtroDesglose);
console.log('    vacío2 totales:', Object.values(vacio2.grupos.secciones).map(s => s.total), 'vigentes', vacio2.atrasadosVigentes.total);
assert.equal(JSON.stringify(payload), copia);

// (d) etiquetas
for (const f of [{ estado: 'atrasadosAnteriores' }, { estado: 'entregadosConAtraso' }, { estado: 'sinEntregar', urgentes: true }, { urgentes: true }, {}]) console.log('(d)', JSON.stringify(f), '->', JSON.stringify(B.etiquetaFiltroDesglose(f)));
console.log('OK');
process.exit(0);
