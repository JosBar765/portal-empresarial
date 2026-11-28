// src/modules/tiempos/calculo/extras.js
// Extras de la tabla (Colores, Moldes, Costura, UV y los que cree el administrador): a qué productos se ofrecen y cómo suman días.
// Funciones puras; las usan el motor, el catálogo de la calculadora y la administración.
const TIPOS = ['si_no', 'por_cantidad', 'por_unidades'];
const dias = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;

// ¿Se ofrece este extra en este producto? (todos, o por línea, categoría o producto)
function aplica(extra, producto) {
  const a = extra.alcance || { todos: true };
  if (a.todos) return true;
  return (a.lineas || []).includes(producto.linea) || Boolean(producto.categoria && (a.categorias || []).includes(producto.categoria))
    || (a.productos || []).includes(producto.clave);
}

// Los extras visibles que se ofrecen en un producto, en el orden de la tabla.
const extrasDe = (tabla, producto) => tabla.extras.filter(e => e.activo !== false && aplica(e, producto));

// Días que suman `n` unidades (p. ej. 5 colores con 2 incluidos y +1 día cada 2 más → 2 días).
function diasPorUnidades(u, n) {
  const extra = Math.max(0, n - u.incluidas);
  return extra > 0 ? Math.ceil(extra / u.cada) * u.dias : 0;
}

// Cómo suma, en una línea (para la calculadora, la referencia y la lista de la administración).
function textoExtra(e) {
  if (e.tipo === 'si_no') return `Suma ${dias(e.diasFijos)}`;
  if (e.tipo === 'por_unidades') return `Incluye ${e.unidades.incluidas}; +${dias(e.unidades.dias)} cada ${e.unidades.cada} más`;
  const valores = e.opciones.flatMap(o => o.rangos.filter(r => !r.aConvenir).map(r => r.dias));
  if (!valores.length) return 'Suma días según la cantidad';
  const a = Math.min(...valores); const b = Math.max(...valores);
  return a === b ? `Suma ${dias(a)} según la cantidad` : `Suma de ${a} a ${b} días según la cantidad`;
}

module.exports = { TIPOS, aplica, extrasDe, diasPorUnidades, textoExtra };
