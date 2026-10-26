// src/modules/prompts/services/plantillaService.js
// Funciones puras: validan y renderizan la plantilla de un producto.
const { ENCABEZADO_SISTEMA, LOGO_MARCA_AGUA, DESCRIPCION_LOGO, VARIABLES_AUTOMATICAS } = require('../constantes');
const { resolverVisibilidad, indexarPorClave } = require('./esquemaService');

const ETIQUETA_RE = /\{\{([^{}]*)\}\}/g;
const MARCA_BLOQUE = '\u0001'; // señala dónde hubo una etiqueta de bloque, para eliminar líneas que quedan vacías
const MAX_PROFUNDIDAD_CALCULADO = 5;
const VARIABLE_OTROS = 'otros_parametros';

const normalizar = texto => String(texto).replace(/\r\n?/g, '\n');
const sinControl = texto => String(texto).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const aLinea = texto => sinControl(texto).replace(/\s+/g, ' ').trim(); // un dato de usuario no puede romper la estructura del prompt

// ---------- Análisis ----------

/** @returns {{ nodos: object[], errores: {mensaje: string}[] }} nodos: texto | variable | bloque */
function analizar(plantilla, clavesValidas) {
  const errores = [];
  const raiz = [];
  let actual = raiz;
  let abierto = null;
  const texto = normalizar(plantilla);
  let ultimo = 0;

  const agregarTexto = fragmento => {
    if (!fragmento) return;
    if (/\{\{|\}\}/.test(fragmento)) errores.push({ mensaje: 'Hay una llave «{{» o «}}» sin cerrar o mal escrita.' });
    actual.push({ tipo: 'texto', valor: fragmento });
  };
  const exigirClave = clave => {
    if (!clavesValidas.has(clave)) errores.push({ mensaje: `La variable «${clave}» no existe en el esquema.` });
  };

  for (const m of texto.matchAll(ETIQUETA_RE)) {
    agregarTexto(texto.slice(ultimo, m.index));
    ultimo = m.index + m[0].length;
    const interior = m[1].trim();
    const apertura = interior.match(/^#(si|no)\s+([a-z][a-z0-9_]*)$/);
    const cierre = interior.match(/^\/(si|no)$/);
    if (apertura) {
      exigirClave(apertura[2]);
      if (abierto) { errores.push({ mensaje: `No se pueden anidar bloques: «${apertura[2]}» está dentro de «${abierto.clave}».` }); continue; }
      abierto = { tipo: 'bloque', condicion: apertura[1], clave: apertura[2], hijos: [] };
      actual.push(abierto);
      actual = abierto.hijos;
    } else if (cierre) {
      if (!abierto) errores.push({ mensaje: `«{{/${cierre[1]}}}» no tiene su apertura.` });
      else if (abierto.condicion !== cierre[1]) errores.push({ mensaje: `«{{#${abierto.condicion} ${abierto.clave}}}» se cierra con «{{/${cierre[1]}}}».` });
      if (abierto) { abierto = null; actual = raiz; }
    } else if (/^[a-z][a-z0-9_]*$/.test(interior)) {
      exigirClave(interior);
      actual.push({ tipo: 'variable', clave: interior });
    } else {
      errores.push({ mensaje: `Etiqueta no válida: «{{${interior}}}».` });
    }
  }
  agregarTexto(texto.slice(ultimo));
  if (abierto) errores.push({ mensaje: `El bloque «{{#${abierto.condicion} ${abierto.clave}}}» no está cerrado.` });
  return { nodos: raiz, errores };
}

function clavesDelEsquema(esquema) {
  const parametros = indexarPorClave(resolverVisibilidad(esquema).parametros);
  return new Set([...parametros.keys(), ...VARIABLES_AUTOMATICAS]);
}

/** @returns {{mensaje: string}[]} lista vacía si la plantilla es válida */
function validarPlantilla(plantilla, esquema) {
  if (typeof plantilla !== 'string' || !plantilla.trim()) return [{ mensaje: 'La plantilla no puede estar vacía.' }];
  const unicos = new Map();
  analizar(plantilla, clavesDelEsquema(esquema)).errores.forEach(e => unicos.set(e.mensaje, e));
  return [...unicos.values()];
}

// ---------- Parámetros referenciados ----------

// Referenciado = aparece como {{clave}}, {{#si clave}} o {{#no clave}}; sus destinos «unidad_de» e «igual_a» también cuentan.
function clavesReferenciadas(plantilla, esquema) {
  const usadas = new Set();
  const recorrer = nodos => nodos.forEach(n => {
    if (n.tipo === 'variable') usadas.add(n.clave);
    if (n.tipo === 'bloque') { usadas.add(n.clave); recorrer(n.hijos); }
  });
  if (typeof plantilla === 'string') recorrer(analizar(plantilla, new Set()).nodos);
  const porClave = indexarPorClave(resolverVisibilidad(esquema).parametros);
  [...usadas].forEach(clave => {
    const p = porClave.get(clave);
    if (p && p.tipo === 'numero' && p.unidad_de) usadas.add(p.unidad_de);
    if (p && p.tipo === 'calculado' && p.igual_a) usadas.add(p.igual_a);
  });
  return usadas;
}

/** Parámetros (visibles o no, sin «calculado») que la plantilla no nombra. */
function parametrosSinUsar(esquema, plantilla) {
  const usadas = clavesReferenciadas(plantilla, esquema);
  const grupos = esquema && Array.isArray(esquema.grupos) ? esquema.grupos : [];
  return grupos.flatMap(g => (Array.isArray(g.parametros) ? g.parametros : [])
    .filter(p => p && p.tipo !== 'calculado' && !usadas.has(p.clave))
    .map(p => ({ clave: p.clave, etiqueta: p.etiqueta, grupo: g.etiqueta })));
}

// ---------- Formato de valores ----------

const aTexto = n => String(Math.round(n * 100) / 100);

// Se usa «e» y no «y» porque la siguiente palabra siempre empieza con «i» de «imagen».
function unirConE(partes) {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

function itemDeImagen(crudo) {
  const item = typeof crudo === 'string' ? { nombre: crudo } : crudo;
  if (!item || typeof item.nombre !== 'string' || !item.nombre.trim()) return null;
  const texto = valor => (typeof valor === 'string' ? aLinea(valor) : '');
  return { nombre: aLinea(item.nombre), descripcion: texto(item.descripcion), ubicacion: texto(item.ubicacion) };
}

function referenciaDeImagen(item) {
  const detalle = [item.descripcion, item.ubicacion && `ubicación: ${item.ubicacion}`].filter(Boolean).join('; ');
  return detalle ? `imagen ${item.numero} (${detalle})` : `imagen ${item.numero}`;
}

function crearContexto({ esquema, valores, imagenes, contacto, referenciadas }) {
  const { visibles, crudos, parametros } = resolverVisibilidad(esquema, valores, imagenes);
  const porClave = indexarPorClave(parametros);
  const grupos = esquema && Array.isArray(esquema.grupos) ? esquema.grupos : [];

  // Imágenes numeradas: parámetros `imagenes` visibles en orden del esquema y, dentro, en orden de envío.
  const items = [];
  const itemsPorParametro = new Map();
  grupos.forEach(g => (Array.isArray(g.parametros) ? g.parametros : []).forEach(p => {
    if (!p || p.tipo !== 'imagenes' || !visibles.get(p.clave)) return;
    const crudo = crudos.get(p.clave);
    const propios = (Array.isArray(crudo) ? crudo : []).map(itemDeImagen).filter(Boolean).map(i => {
      const item = { numero: items.length + 1, parametro: p.clave, grupo: g.etiqueta, ...i };
      items.push(item);
      return item;
    });
    itemsPorParametro.set(p.clave, propios);
  }));
  const logo = { numero: items.length + 1, url: LOGO_MARCA_AGUA, descripcion: DESCRIPCION_LOGO };
  const totalImagenes = items.length + 1;
  const datos = contacto || {};

  const listaImagenes = () => [
    ...items.map(i => `- Imagen ${i.numero} (${aLinea(i.grupo).toLowerCase()}): ${i.descripcion || 'sin descripción'}.${i.ubicacion ? ` Ubicación: ${i.ubicacion}.` : ''}`),
    `- Imagen ${logo.numero} (marca de agua): ${logo.descripcion}.`
  ].join('\n');

  const automaticas = {
    asesor_nombre: () => datos.nombre,
    asesor_telefono: () => datos.telefono,
    asesor_correo: () => datos.email,
    logo_marca_agua: () => `imagen ${logo.numero}`,
    total_imagenes: () => (totalImagenes === 1 ? '1 imagen' : `${totalImagenes} imágenes`),
    lista_imagenes: listaImagenes,
    [VARIABLE_OTROS]: () => otrosParametros()
  };

  // Valor formateado de un parámetro ('' si está oculto o sin valor).
  function formatear(clave, profundidad = 0) {
    if (Object.prototype.hasOwnProperty.call(automaticas, clave)) {
      const valor = automaticas[clave]();
      return sinControl(valor == null ? '' : String(valor)).trim();
    }
    const p = porClave.get(clave);
    if (!p || !visibles.get(clave)) return '';
    const crudo = crudos.get(clave);
    switch (p.tipo) {
      case 'texto':
        return typeof crudo === 'string' ? sinControl(crudo).trim() : '';
      case 'texto_largo': {
        if (typeof crudo !== 'string') return '';
        const texto = sinControl(crudo).trim();
        if (!p.separador) return texto;
        return texto.split(p.separador).map(f => f.trim()).filter(Boolean).map(f => `"${f}"`).join(', ');
      }
      case 'numero': {
        if (typeof crudo !== 'number' || !Number.isFinite(crudo)) return '';
        const unidad = p.unidad_de ? porClave.get(p.unidad_de) : null;
        const opcion = unidad && (unidad.opciones || []).find(o => o.valor === crudos.get(unidad.clave));
        return opcion ? `${aTexto(crudo)} ${sinControl(opcion.texto_prompt)}` : aTexto(crudo);
      }
      case 'opciones': {
        const opcion = (p.opciones || []).find(o => o.valor === crudo);
        return opcion ? sinControl(opcion.texto_prompt) : '';
      }
      case 'si_no':
        return crudo === true ? 'sí' : 'no';
      case 'imagenes':
        return unirConE((itemsPorParametro.get(clave) || []).map(referenciaDeImagen));
      case 'calculado':
        return profundidad < MAX_PROFUNDIDAD_CALCULADO ? formatear(p.igual_a, profundidad + 1) : '';
      default:
        return '';
    }
  }

  // «Tiene valor»: si_no solo cuando es verdadero.
  function tieneValor(clave, profundidad = 0) {
    const p = porClave.get(clave);
    if (p && visibles.get(clave)) {
      if (p.tipo === 'si_no') return crudos.get(clave) === true;
      if (p.tipo === 'calculado') return profundidad < MAX_PROFUNDIDAD_CALCULADO && tieneValor(p.igual_a, profundidad + 1);
    }
    return formatear(clave, profundidad) !== '';
  }

  // Lo que el administrador agregó al esquema pero la plantilla no nombra, para que nunca se pierda.
  function otrosParametros() {
    const secciones = grupos.map(g => {
      const lineas = (Array.isArray(g.parametros) ? g.parametros : [])
        .filter(p => p && p.tipo !== 'calculado' && !referenciadas.has(p.clave) && tieneValor(p.clave))
        .map(p => `- ${aLinea(p.etiqueta)}: ${formatear(p.clave)}`);
      return lineas.length ? `${aLinea(g.etiqueta).toUpperCase()}\n${lineas.join('\n')}` : '';
    }).filter(Boolean);
    return secciones.length ? `ESPECIFICACIONES ADICIONALES\n${secciones.join('\n')}` : '';
  }

  return { formatear, tieneValor, items, logo, totalImagenes };
}

// ---------- Render ----------

function renderizarNodos(nodos, ctx) {
  return nodos.map(n => {
    if (n.tipo === 'texto') return n.valor;
    if (n.tipo === 'variable') return ctx.formatear(n.clave);
    const mostrar = ctx.tieneValor(n.clave) === (n.condicion === 'si');
    return MARCA_BLOQUE + (mostrar ? renderizarNodos(n.hijos, ctx) : '') + MARCA_BLOQUE;
  }).join('');
}

function limpiarLineas(texto) {
  return texto.split('\n')
    .filter(linea => !(linea.includes(MARCA_BLOQUE) && linea.split(MARCA_BLOQUE).join('').trim() === ''))
    .map(linea => linea.split(MARCA_BLOQUE).join(''))
    .join('\n');
}

/**
 * Arma el prompt final y la lista numerada de imágenes. Los valores se insertan en una sola pasada.
 * @returns {{ prompt: string, imagenes: {numero:number, parametro:string, grupo:string, nombre:string, descripcion:string, ubicacion:string}[],
 *   logo: {numero:number, url:string, descripcion:string}, totalImagenes: number }}
 */
function renderizar({ plantilla, esquema, valores = {}, imagenes = {}, contacto = {} }) {
  const referenciadas = clavesReferenciadas(plantilla, esquema);
  // Sin {{otros_parametros}} en la plantilla, la sección se agrega al final.
  const completa = referenciadas.has(VARIABLE_OTROS) ? plantilla : `${plantilla}\n\n{{${VARIABLE_OTROS}}}`;
  const { nodos } = analizar(completa, clavesDelEsquema(esquema));
  const ctx = crearContexto({ esquema, valores, imagenes, contacto, referenciadas });
  const cuerpo = limpiarLineas(renderizarNodos(nodos, ctx)).replace(/\n{3,}/g, '\n\n').trim();
  return {
    prompt: `${ENCABEZADO_SISTEMA}\n\n${cuerpo}`,
    imagenes: ctx.items,
    logo: ctx.logo,
    totalImagenes: ctx.totalImagenes
  };
}

module.exports = { validarPlantilla, renderizar, parametrosSinUsar };
