// src/modules/prompts/services/plantillaService.js
// Funciones puras: validan y renderizan la plantilla de un producto. Todo texto que arma el código viene de `ajustes`.
const { VARIABLES_AUTOMATICAS } = require('../constantes');
const { msg, rellenar } = require('../mensajes');
const { resolverVisibilidad, indexarPorClave, recursosDelEsquema } = require('./esquemaService');

const ETIQUETA_RE = /\{\{([^{}]*)\}\}/g;
const MARCA_BLOQUE = '\u0001'; // señala dónde hubo una etiqueta de bloque, para eliminar líneas que quedan vacías
const MAX_PROFUNDIDAD_CALCULADO = 5;
const VARIABLE_OTROS = 'otros_parametros';
const PREFIJO_RECURSO = 'recurso_';
const EJ_VARIABLE = '{{clave}}'; // ejemplos de sintaxis que muestran los mensajes
const EJ_BLOQUE = '{{#si clave}}';

const normalizar = texto => String(texto).replace(/\r\n?/g, '\n');
const sinControl = texto => String(texto).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const aLinea = texto => sinControl(texto).replace(/\s+/g, ' ').trim(); // un dato de usuario no puede romper la estructura del prompt

// ---------- Análisis ----------

const textoApertura = (condicion, clave) => `{{#${condicion} ${clave}}}`;

/** @returns {{ nodos: object[], errores: {mensaje: string}[] }} nodos: texto | variable | bloque */
function analizar(plantilla, clavesValidas, clavesRecursos = []) {
  const errores = [];
  const raiz = [];
  let actual = raiz;
  let abierto = null;
  const texto = normalizar(plantilla);
  let ultimo = 0;

  const agregarTexto = fragmento => {
    if (!fragmento) return;
    if (/\{\{|\}\}/.test(fragmento)) errores.push({ mensaje: msg('plantilla.llaveSuelta', { abre: '{{', cierra: '}}', ejemplo: EJ_VARIABLE }) });
    actual.push({ tipo: 'texto', valor: fragmento });
  };
  const exigirClave = clave => {
    if (clavesValidas.has(clave)) return;
    errores.push({
      mensaje: clave.startsWith(PREFIJO_RECURSO)
        ? msg('plantilla.recursoDesconocido', {
          variable: clave,
          clave: clave.slice(PREFIJO_RECURSO.length),
          disponibles: clavesRecursos.length ? clavesRecursos.map(c => PREFIJO_RECURSO + c).join(', ') : 'ninguno'
        })
        : msg('plantilla.variableNoExiste', { variable: clave, sistema: VARIABLES_AUTOMATICAS.join(', ') })
    });
  };

  for (const m of texto.matchAll(ETIQUETA_RE)) {
    agregarTexto(texto.slice(ultimo, m.index));
    ultimo = m.index + m[0].length;
    const interior = m[1].trim();
    const apertura = interior.match(/^#(si|no)\s+([a-z][a-z0-9_]*)$/);
    const cierre = interior.match(/^\/(si|no)$/);
    if (apertura) {
      exigirClave(apertura[2]);
      if (abierto) { errores.push({ mensaje: msg('plantilla.anidado', { interno: textoApertura(apertura[1], apertura[2]), externo: textoApertura(abierto.condicion, abierto.clave) }) }); continue; }
      abierto = { tipo: 'bloque', condicion: apertura[1], clave: apertura[2], hijos: [] };
      actual.push(abierto);
      actual = abierto.hijos;
    } else if (cierre) {
      if (!abierto) errores.push({ mensaje: msg('plantilla.cierreSinApertura', { cierre: `{{/${cierre[1]}}}`, ejemplo: EJ_BLOQUE }) });
      else if (abierto.condicion !== cierre[1]) errores.push({ mensaje: msg('plantilla.cierreDistinto', { apertura: textoApertura(abierto.condicion, abierto.clave), cierre: `{{/${cierre[1]}}}`, esperado: `{{/${abierto.condicion}}}` }) });
      if (abierto) { abierto = null; actual = raiz; }
    } else if (/^[a-z][a-z0-9_]*$/.test(interior)) {
      exigirClave(interior);
      actual.push({ tipo: 'variable', clave: interior });
    } else {
      errores.push({ mensaje: msg('plantilla.etiquetaInvalida', { etiqueta: `{{${interior}}}`, ejVariable: EJ_VARIABLE, ejBloque: EJ_BLOQUE, ejCierre: '{{/si}}' }) });
    }
  }
  agregarTexto(texto.slice(ultimo));
  if (abierto) errores.push({ mensaje: msg('plantilla.bloqueSinCerrar', { apertura: textoApertura(abierto.condicion, abierto.clave), cierre: `{{/${abierto.condicion}}}` }) });
  return { nodos: raiz, errores };
}

const clavesDeRecursos = esquema => recursosDelEsquema(esquema).map(r => r.clave);

function clavesDelEsquema(esquema) {
  const parametros = indexarPorClave(resolverVisibilidad(esquema).parametros);
  return new Set([...parametros.keys(), ...VARIABLES_AUTOMATICAS, ...clavesDeRecursos(esquema).map(c => PREFIJO_RECURSO + c)]);
}

/** @returns {{mensaje: string}[]} lista vacía si la plantilla es válida */
function validarPlantilla(plantilla, esquema) {
  if (typeof plantilla !== 'string' || !plantilla.trim()) return [{ mensaje: msg('plantilla.vacia') }];
  const unicos = new Map();
  analizar(plantilla, clavesDelEsquema(esquema), clavesDeRecursos(esquema)).errores.forEach(e => unicos.set(e.mensaje, e));
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

function itemDeImagen(crudo) {
  const item = typeof crudo === 'string' ? { nombre: crudo } : crudo;
  if (!item || typeof item.nombre !== 'string' || !item.nombre.trim()) return null;
  const texto = valor => (typeof valor === 'string' ? aLinea(valor) : '');
  return { nombre: aLinea(item.nombre), descripcion: texto(item.descripcion), ubicacion: texto(item.ubicacion) };
}

function crearContexto({ esquema, valores, imagenes, contacto, referenciadas, ajustes, urlRecurso }) {
  const { visibles, crudos, parametros } = resolverVisibilidad(esquema, valores, imagenes);
  const porClave = indexarPorClave(parametros);
  const grupos = esquema && Array.isArray(esquema.grupos) ? esquema.grupos : [];
  const T = ajustes.textos_prompt;
  const t = (clave, params) => rellenar(T[clave], params);

  // Se une con «e» (y no «y») cuando la siguiente palabra empieza con «i»; el conector lo define el ajuste «union_final».
  const unir = partes => (partes.length <= 1 ? partes.join('') : `${partes.slice(0, -1).join(T.union)}${T.union_final}${partes[partes.length - 1]}`);

  // Imágenes numeradas: recursos «inicio», imágenes del asesor (parámetros visibles en orden del esquema y de envío) y recursos «fin».
  const items = [];
  const activos = recursosDelEsquema(esquema).filter(r => r.activo === true);
  const recursoPorVariable = new Map();
  const agregarRecursos = posicion => activos.filter(r => r.posicion === posicion).forEach(r => {
    const item = {
      numero: items.length + 1,
      origen: 'recurso',
      clave: r.clave,
      etiqueta: aLinea(r.etiqueta || r.clave),
      descripcion: typeof r.descripcion === 'string' ? aLinea(r.descripcion) : '',
      url: urlRecurso(r)
    };
    items.push(item);
    recursoPorVariable.set(PREFIJO_RECURSO + r.clave, item);
  });

  agregarRecursos('inicio');
  const itemsPorParametro = new Map();
  grupos.forEach(g => (Array.isArray(g.parametros) ? g.parametros : []).forEach(p => {
    if (!p || p.tipo !== 'imagenes' || !visibles.get(p.clave)) return;
    const crudo = crudos.get(p.clave);
    const propios = (Array.isArray(crudo) ? crudo : []).map(itemDeImagen).filter(Boolean).map(i => {
      const item = { numero: items.length + 1, origen: 'asesor', parametro: p.clave, grupo: g.etiqueta, ...i };
      items.push(item);
      return item;
    });
    itemsPorParametro.set(p.clave, propios);
  }));
  agregarRecursos('fin');
  const datos = contacto || {};

  const referenciaDeImagen = item => {
    const detalle = [item.descripcion, item.ubicacion && t('detalle_ubicacion', { ubicacion: item.ubicacion })].filter(Boolean).join(T.detalle_union);
    return t('imagen_ref', { numero: item.numero }) + (detalle ? t('imagen_detalle', { detalle }) : '');
  };

  const lineaDeLista = i => t('lista_linea', {
    numero: i.numero,
    origen: i.origen === 'recurso' ? i.etiqueta : aLinea(i.grupo),
    descripcion: i.descripcion || T.lista_sin_descripcion,
    ubicacion: i.ubicacion ? t('lista_ubicacion', { ubicacion: i.ubicacion }) : ''
  });

  // Sin imágenes ni recursos activos, la lista y el total quedan vacíos para que la plantilla los oculte.
  const automaticas = {
    asesor_nombre: () => datos.nombre,
    asesor_telefono: () => datos.telefono,
    asesor_correo: () => datos.email,
    total_imagenes: () => (items.length ? t(items.length === 1 ? 'total_uno' : 'total_varios', { n: items.length }) : ''),
    lista_imagenes: () => items.map(lineaDeLista).join('\n'),
    [VARIABLE_OTROS]: () => otrosParametros()
  };

  // Valor formateado de un parámetro ('' si está oculto o sin valor).
  function formatear(clave, profundidad = 0) {
    if (Object.prototype.hasOwnProperty.call(automaticas, clave)) {
      const valor = automaticas[clave]();
      return sinControl(valor == null ? '' : String(valor)).trim();
    }
    if (recursoPorVariable.has(clave)) return t('imagen_ref', { numero: recursoPorVariable.get(clave).numero });
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
        return texto.split(p.separador).map(f => f.trim()).filter(Boolean).map(f => t('frase_comillas', { frase: f })).join(T.frases_union);
      }
      case 'numero': {
        if (typeof crudo !== 'number' || !Number.isFinite(crudo)) return '';
        const unidad = p.unidad_de ? porClave.get(p.unidad_de) : null;
        const opcion = unidad && (unidad.opciones || []).find(o => o.valor === crudos.get(unidad.clave));
        return opcion ? t('numero_unidad', { valor: aTexto(crudo), unidad: sinControl(opcion.texto_prompt) }) : aTexto(crudo);
      }
      case 'opciones': {
        const opcion = (p.opciones || []).find(o => o.valor === crudo);
        return opcion ? sinControl(opcion.texto_prompt) : '';
      }
      case 'si_no':
        return crudo === true ? T.si : T.no;
      case 'imagenes':
        return unir((itemsPorParametro.get(clave) || []).map(referenciaDeImagen));
      case 'calculado':
        return profundidad < MAX_PROFUNDIDAD_CALCULADO ? formatear(p.igual_a, profundidad + 1) : '';
      default:
        return '';
    }
  }

  // «Tiene valor»: si_no solo cuando es verdadero; un recurso, solo cuando está activo.
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
        .map(p => t('extras_linea', { etiqueta: aLinea(p.etiqueta), valor: formatear(p.clave) }));
      return lineas.length ? `${t('extras_grupo', { grupo: aLinea(g.etiqueta) })}\n${lineas.join('\n')}` : '';
    }).filter(Boolean);
    return secciones.length ? `${T.extras_titulo}\n${secciones.join('\n')}` : '';
  }

  return { formatear, tieneValor, items };
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
 * Arma el prompt final y la lista numerada de imágenes (recursos activos y del asesor). Los valores se insertan en una sola pasada.
 * `urlRecurso(recurso)` decide la URL que ve el cliente (por defecto, la guardada).
 * @returns {{ prompt: string, imagenes: object[], totalImagenes: number }}
 */
function renderizar({ plantilla, esquema, valores = {}, imagenes = {}, contacto = {}, ajustes, urlRecurso = r => r.url }) {
  const referenciadas = clavesReferenciadas(plantilla, esquema);
  // Sin {{otros_parametros}} en la plantilla, la sección se agrega al final.
  const completa = referenciadas.has(VARIABLE_OTROS) ? plantilla : `${plantilla}\n\n{{${VARIABLE_OTROS}}}`;
  const { nodos } = analizar(completa, clavesDelEsquema(esquema), clavesDeRecursos(esquema));
  const ctx = crearContexto({ esquema, valores, imagenes, contacto, referenciadas, ajustes, urlRecurso });
  const cuerpo = limpiarLineas(renderizarNodos(nodos, ctx)).replace(/\n{3,}/g, '\n\n').trim();
  return {
    prompt: `${ajustes.encabezado_sistema}\n\n${cuerpo}`,
    imagenes: ctx.items,
    totalImagenes: ctx.items.length
  };
}

module.exports = { validarPlantilla, renderizar, parametrosSinUsar };
