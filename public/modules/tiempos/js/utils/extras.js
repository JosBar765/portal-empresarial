// public/modules/tiempos/js/utils/extras.js
// Textos y reglas de los extras en la pantalla (las mismas que calculo/extras.js del servidor).
import { pluralDias } from './formato.js';

export const TIPOS = {
  si_no: { nombre: 'Sí / No', clase: 'tm-tipo--si-no', texto: 'Una casilla. Si se marca, suma siempre los mismos días.', ejemplo: 'Ej.: Moldes, +2 días' },
  por_cantidad: { nombre: 'Por cantidad', clase: 'tm-tipo--cantidad', texto: 'Los días dependen de cuántas piezas son, con una tabla de rangos. Puede tener varias opciones a elegir.', ejemplo: 'Ej.: Impresión UV (3 tipos) o Costura del lanyard' },
  por_unidades: { nombre: 'Por unidades', clase: 'tm-tipo--unidades', texto: 'Se escribe un número. Incluye algunos y suma días por cada grupo extra.', ejemplo: 'Ej.: Colores: incluye 2, +1 día cada 2 más' }
};

const esNum = (x) => Number.isInteger(x);

export function aplica(extra, producto) {
  const a = extra.alcance || { todos: true };
  if (a.todos) return true;
  return a.lineas.includes(producto.linea) || Boolean(producto.categoria && a.categorias.includes(producto.categoria)) || a.productos.includes(producto.clave);
}

export function diasPorUnidades(u, n) {
  const extra = Math.max(0, n - u.incluidas);
  return extra > 0 ? Math.ceil(extra / u.cada) * u.dias : 0;
}

// «Suma 2 días» · «Incluye 2; +1 día cada 2 más» · «Suma de 2 a 7 días según la cantidad»
export function textoExtra(e) {
  if (e.tipo === 'si_no') return esNum(e.diasFijos) ? `Suma ${pluralDias(e.diasFijos)}` : 'Suma días fijos';
  if (e.tipo === 'por_unidades') { const u = e.unidades || {}; return esNum(u.incluidas) && esNum(u.dias) && esNum(u.cada) ? `Incluye ${u.incluidas}; +${pluralDias(u.dias)} cada ${u.cada} más` : 'Suma días por unidades'; }
  const v = (e.opciones || []).flatMap(o => o.rangos.filter(r => !r.aConvenir && esNum(r.dias)).map(r => r.dias));
  if (!v.length) return 'Suma días según la cantidad';
  const a = Math.min(...v); const b = Math.max(...v);
  return a === b ? `Suma ${pluralDias(a)} según la cantidad` : `Suma de ${a} a ${b} días según la cantidad`;
}

// «Todos los productos» · «Categoría: Piezas fundidas (8)» · «Línea: Mundi (11) y 2 productos»
export function textoAlcance(e, datos) {
  const a = e.alcance;
  if (a.todos) return 'Todos los productos';
  const cuantos = (f) => datos.productos.filter(f).length;
  const partes = [
    ...a.lineas.map(c => { const l = datos.lineas.find(x => x.clave === c); return `Línea: ${l ? l.nombre : c} (${cuantos(p => p.linea === c)})`; }),
    ...a.categorias.map(c => { const k = datos.categorias.find(x => x.clave === c); return `Categoría: ${k ? k.nombre : c} (${cuantos(p => p.categoria === c)})`; })
  ];
  if (a.productos.length) partes.push(a.productos.length === 1 ? `Producto: ${(datos.productos.find(p => p.clave === a.productos[0]) || {}).nombre || a.productos[0]}` : `${a.productos.length} productos`);
  return partes.join(' · ') || 'Ningún producto';
}
