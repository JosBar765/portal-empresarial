// src/modules/prompts/services/tipos/imagenes.js
const { msg } = require('../../mensajes');
const { definirTipo } = require('./_base');
const { tiene, esObjeto, esTextoNoVacio, esNumero, etiquetaDe, verValor, aLinea } = require('./_utilidades');

// Lista opcional de textos cortos y únicos (ubicaciones, sugerencias).
function validarListaTextos(p, campo, maxLargo, err, maxItems, parametro) {
  const lista = p[campo];
  if (lista === undefined) return;
  if (!Array.isArray(lista) || lista.length > maxItems) return err(msg('param.lista', { parametro, campo, max: maxItems }));
  const vistos = new Set();
  for (const texto of lista) {
    if (!esTextoNoVacio(texto) || texto.trim().length > maxLargo) return err(msg('param.listaElemento', { parametro, campo, max: maxLargo }));
    if (vistos.has(texto.trim())) return err(msg('param.listaRepetido', { parametro, campo, texto: texto.trim() }));
    vistos.add(texto.trim());
  }
}

// Cada imagen es { nombre, descripcion?, ubicacion? }; un texto suelto se toma como el nombre.
function validarImagenes(p, lista, ajustes) {
  const L = ajustes.limites;
  const etiqueta = etiquetaDe(p);
  if (!Array.isArray(lista)) return { error: msg('valor.imagenesLista', { etiqueta }) };
  const max = p.max || L.imagenes_max_defecto;
  const formatos = p.formatos || Object.keys(ajustes.formatos_imagen);
  const extensiones = formatos.flatMap(f => (ajustes.formatos_imagen[f] ? ajustes.formatos_imagen[f].extensiones : []));
  const ubicaciones = Array.isArray(p.ubicaciones) ? p.ubicaciones : [];
  if (lista.length > max) return { error: msg('valor.imagenesMax', { etiqueta, max, total: lista.length, sobran: lista.length - max }) };
  const limpias = [];
  for (const crudo of lista) {
    const item = typeof crudo === 'string' ? { nombre: crudo } : crudo;
    if (!esObjeto(item)) return { error: msg('valor.imagenForma', { etiqueta }) };
    const nombre = typeof item.nombre === 'string' ? item.nombre.trim() : '';
    if (!nombre || nombre.length > L.imagen_nombre_max) return { error: msg('valor.imagenNombre', { etiqueta, max: L.imagen_nombre_max }) };
    const extension = nombre.includes('.') ? nombre.split('.').pop().toLowerCase() : '';
    if (!extensiones.includes(extension)) return { error: msg('valor.imagenFormato', { nombre, etiqueta, permitidas: extensiones.join(', ') }) };

    const limpia = { nombre };
    if (item.descripcion !== undefined && item.descripcion !== null) {
      const descripcion = typeof item.descripcion === 'string' ? item.descripcion.trim() : null;
      if (descripcion === null) return { error: msg('valor.imagenDescripcionTipo', { nombre }) };
      if (descripcion.length > L.imagen_descripcion_max) return { error: msg('valor.imagenDescripcion', { nombre, max: L.imagen_descripcion_max, largo: descripcion.length }) };
      if (descripcion) limpia.descripcion = descripcion;
    }
    // La descripción es el segundo ancla para que el generador identifique cada imagen.
    if (p.descripcion_requerida && !limpia.descripcion) return { error: msg('valor.imagenDescripcionFalta', { nombre, etiqueta }) };
    if (item.ubicacion !== undefined && item.ubicacion !== null && ubicaciones.length) {
      const ubicacion = typeof item.ubicacion === 'string' ? item.ubicacion.trim() : null;
      if (ubicacion === null || (ubicacion && !ubicaciones.includes(ubicacion))) {
        return { error: msg('valor.imagenUbicacion', { nombre, etiqueta, valor: verValor(item.ubicacion), permitidas: ubicaciones.join(', ') }) };
      }
      if (ubicacion) limpia.ubicacion = ubicacion;
    }
    limpias.push(limpia);
  }
  return { valor: limpias };
}

// Imagen lista para el prompt: nombre, descripción y ubicación en una sola línea cada uno; null si no tiene nombre.
function itemDeImagen(crudo) {
  const item = typeof crudo === 'string' ? { nombre: crudo } : crudo;
  if (!item || typeof item.nombre !== 'string' || !item.nombre.trim()) return null;
  const texto = valor => (typeof valor === 'string' ? aLinea(valor) : '');
  return { nombre: aLinea(item.nombre), descripcion: texto(item.descripcion), ubicacion: texto(item.ubicacion) };
}

module.exports = definirTipo({
  clave: 'imagenes',
  destino: 'imagenes',
  cuentaParaGrupoVacio: true,
  valorAusente: () => [],

  validarEsquema(p, { parametro, ajustes, err }) {
    const L = ajustes.limites;
    if (p.max !== undefined && !(Number.isInteger(p.max) && p.max >= 1 && p.max <= L.imagenes_max_tope)) err(msg('param.imagenesMax', { parametro, tope: L.imagenes_max_tope }));
    if (p.max_mb !== undefined && !(esNumero(p.max_mb) && p.max_mb >= 1 && p.max_mb <= L.imagenes_mb_tope)) err(msg('param.imagenesMb', { parametro, tope: L.imagenes_mb_tope }));
    if (p.formatos !== undefined && !(Array.isArray(p.formatos) && p.formatos.length && p.formatos.every(f => tiene(ajustes.formatos_imagen, f)))) {
      err(msg('param.formatos', { parametro, validos: Object.keys(ajustes.formatos_imagen).join(', ') }));
    }
    if (p.descripcion_requerida !== undefined && typeof p.descripcion_requerida !== 'boolean') err(msg('param.descripcionRequerida', { parametro }));
    validarListaTextos(p, 'ubicaciones', L.ubicacion_max, err, L.lista_max_items, parametro);
    validarListaTextos(p, 'sugerencias', L.sugerencia_max, err, L.lista_max_items, parametro);
  },

  validarValor(p, crudo, { ajustes }) {
    const { valor, error } = validarImagenes(p, crudo, ajustes);
    if (error) return { error };
    if (valor.length) return { valor };
    return p.requerido ? { error: msg('valor.imagenesObligatorio', { etiqueta: etiquetaDe(p) }) } : {};
  },

  adjuntos: (p, crudo) => (Array.isArray(crudo) ? crudo : []).map(itemDeImagen).filter(Boolean),
  formatear: (p, crudo, ctx) => ctx.unir(ctx.adjuntosDe(p.clave).map(ctx.referenciaDeImagen))
});
