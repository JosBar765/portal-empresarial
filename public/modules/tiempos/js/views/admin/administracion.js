// public/modules/tiempos/js/views/admin/administracion.js
// Administración de la Tabla de tiempos (solo tiempos.administrar): productos (rangos, días y categoría), extras, catálogos
// (líneas, categorías y etapas), reglas y avisos. Todo lo que se guarda va a un BORRADOR; los usuarios lo ven cuando se publica
// una versión nueva (ver «Publicar versión nueva»).
import { h, icono, montar } from '../../utils/dom.js';
import { campo, pie, interruptor, confirmar, ventana, cargando } from '../../components/ui.js';
import { adminTabla, adminGuardarProducto, adminCrearProducto, adminGuardarExtras, adminGuardarReglas, adminGuardarAvisos, adminGuardarCatalogos, adminCambios, adminPublicar } from '../../api/tiemposApi.js';
import { hoyISO } from '../../utils/formato.js';
import { aplica } from '../../utils/extras.js';
import { listaProductos } from '../../components/listaProductos.js';
import { cuerpoExtras, asistenteExtra } from './extrasAdmin.js';

const copia = (x) => JSON.parse(JSON.stringify(x));
const num = (texto) => (/^\d{1,9}$/.test(String(texto).trim()) ? Number(texto) : String(texto).trim());
const esNum = (x) => typeof x === 'number';
// Cuántos datos son distintos entre dos copias (para decir «N cambios sin guardar»).
function contar(a, b) {
  if (a === b) return 0;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const claves = new Set([...Object.keys(a), ...Object.keys(b)]);
    let n = 0; for (const k of claves) n += contar(a[k], b[k]);
    return n;
  }
  return 1;
}
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const TABS = [['productos', 'Productos'], ['extras', 'Extras'], ['catalogos', 'Catálogos'], ['reglas', 'Reglas'], ['avisos', 'Avisos']];
const CON_LISTA = new Set(['productos', 'avisos']); // pestañas con la lista de productos a la izquierda
// Lo que la pantalla agrega a cada extra y no se guarda.
const extraParaGuardar = ({ resumen, publicado, ...e }) => e;

export async function mostrarAdministracion(cont) {
  montar(cont, cargando('Cargando la administración…'));
  let datos = await adminTabla();
  const margen = () => (Number.isInteger(datos.parametros.margen_dias) ? datos.parametros.margen_dias : 1);
  let tab = 'productos';
  let clave = (datos.productos.find(p => p.activo) || datos.productos[0] || {}).clave;
  let lineaCategorias = (datos.lineas[0] || {}).clave || '';
  let original = null; let trabajo = null; let errores = {};
  const refs = { editor: h('section', { class: 'tm-card tm-editor' }), lista: h('nav', { class: 'tm-card tm-ref-lista', 'aria-label': 'Productos' }), cabecera: h('div'), tabs: h('nav', { class: 'tm-tabs-admin', 'aria-label': 'Secciones de la administración' }), cuerpo: h('div') };

  const producto = () => datos.productos.find(p => p.clave === clave);
  const etapasDe = (p) => p.etapas.map(e => datos.etapas.find(x => x.clave === e) || { clave: e, nombre: e });
  // «11–16 d»: los días al cliente (etapas + margen) de sus rangos con días.
  const metaAdmin = (p) => {
    const v = p.rangos.filter(r => !r.aConvenir && p.etapas.every(e => esNum(r.dias[e]))).map(r => p.etapas.reduce((t, e) => t + r.dias[e], 0) + margen());
    if (!v.length) return 'Sin días';
    const a = Math.min(...v); const b = Math.max(...v);
    return a === b ? `${a} d` : `${a}–${b} d`;
  };
  const sinRangos = (p) => !p.rangos.some(r => !r.aConvenir);
  const lista = listaProductos({
    datos: { lineas: datos.lineas, productos: datos.productos, valor: clave }, metaDe: metaAdmin, placeholder: 'Buscar producto…',
    filtros: [{ clave: 'todos', nombre: 'Todos', prueba: () => true }, { clave: 'ocultos', nombre: 'Ocultos', prueba: (p) => p.activo === false }, { clave: 'sinRangos', nombre: 'Sin rangos', prueba: sinRangos }],
    alElegir: (c) => irA(CON_LISTA.has(tab) ? tab : 'productos', c)
  });
  const marcar = () => refs.barra.replaceWith(refs.barra = barraGuardado());

  // ------------------------------------------------------------------ lo que se edita en cada pestaña
  function iniciarTrabajo() {
    errores = {};
    if (tab === 'productos') { const p = producto(); original = p ? { nombre: p.nombre, activo: p.activo, categoria: p.categoria || '', rangos: copia(p.rangos).map(r => ({ desde: r.desde, hasta: r.hasta, aConvenir: r.aConvenir, dias: r.dias })) } : {}; }
    else if (tab === 'extras') original = { extras: copia(datos.extras) };
    else if (tab === 'avisos') { const p = producto(); original = { producto: p ? [...p.avisos] : [], generales: [...datos.avisosGenerales] }; }
    else if (tab === 'reglas') original = { margen_dias: datos.parametros.margen_dias ?? 1, max_piezas: datos.parametros.max_piezas ?? 20, aviso_urgente: datos.parametros.aviso_urgente || '' };
    else original = { lineas: copia(datos.lineas), categorias: copia(datos.categorias), etapas: copia(datos.etapas) };
    trabajo = copia(original);
  }
  const cuenta = () => contar(original, trabajo);

  async function confirmarSalida() {
    const n = cuenta();
    if (!n) return true;
    return confirmar({ titulo: '¿Descartar los cambios?', texto: `Se pierden los ${n} cambios sin guardar de esta pantalla. El borrador ya guardado no se toca.`, aceptar: 'Descartar cambios', cancelar: 'Seguir editando', peligro: true });
  }
  async function irA(nuevaTab, nuevaClave) {
    if (!(await confirmarSalida())) return;
    tab = nuevaTab; if (nuevaClave) clave = nuevaClave;
    iniciarTrabajo(); pintar();
  }
  async function recargar(mantener = {}) {
    datos = await adminTabla();
    if (mantener.clave) clave = mantener.clave;
    if (!datos.productos.some(p => p.clave === clave)) clave = (datos.productos[0] || {}).clave;
    iniciarTrabajo(); pintar();
  }
  const guardarProductoCon = (p, cambios) => adminGuardarProducto(p.clave, { nombre: p.nombre, activo: p.activo, categoria: p.categoria || '', etapas: p.etapas, rangos: p.rangos, avisos: p.avisos, ...cambios });

  // ------------------------------------------------------------------ guardar
  async function guardar() {
    errores = {};
    try {
      if (tab === 'productos') {
        const p = producto();
        const rangos = copia(trabajo.rangos); const fijos = rangos.filter(r => !r.aConvenir); const abierto = rangos[rangos.length - 1];
        if (abierto && fijos.length && esNum(fijos[fijos.length - 1].hasta)) abierto.desde = fijos[fijos.length - 1].hasta + 1;
        await guardarProductoCon(p, { nombre: trabajo.nombre, activo: trabajo.activo, categoria: trabajo.categoria, rangos });
      } else if (tab === 'extras') await adminGuardarExtras({ extras: trabajo.extras.map(extraParaGuardar) });
      else if (tab === 'avisos') {
        const p = producto();
        if (contar(original.producto, trabajo.producto)) await guardarProductoCon(p, { avisos: trabajo.producto });
        if (contar(original.generales, trabajo.generales)) await adminGuardarAvisos({ avisos: trabajo.generales });
      } else if (tab === 'reglas') await adminGuardarReglas(trabajo);
      else await adminGuardarCatalogos(trabajo);
    } catch (error) {
      if (error.campos) { errores = error.campos; pintar(); const primero = refs.editor.querySelector('.tm-celda--error, .tm-aviso--error'); if (primero) primero.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      if (window.toast) window.toast.error('No se pudo guardar', error.message);
      return;
    }
    if (window.toast) window.toast.success('Borrador guardado', 'Los usuarios lo verán cuando publiques la versión.');
    await recargar();
  }

  // ------------------------------------------------------------------ piezas de formulario
  const entrada = (valor, { ancho = '', error = false, modificado = false, alCambiar, etiqueta }) => {
    const i = h('input', { type: 'text', inputmode: 'numeric', value: valor === null || valor === undefined ? '' : String(valor), class: `tm-celda${error ? ' tm-celda--error' : ''}${modificado ? ' tm-celda--cambio' : ''}`, 'aria-label': etiqueta, 'aria-invalid': error ? 'true' : null, style: ancho ? `width:${ancho}` : null });
    i.addEventListener('input', () => alCambiar(num(i.value), i));
    return i;
  };
  const textoEditable = (valor, alCambiar, etiqueta, error, max = 255) => { const i = h('input', { type: 'text', value: valor || '', class: `tm-texto-edit${error ? ' tm-celda--error' : ''}`, 'aria-label': etiqueta, maxlength: max }); i.addEventListener('input', () => alCambiar(i.value)); return i; };

  function barraGuardado() {
    const n = cuenta();
    const guardarB = h('button', { class: 'btn btn--primary', type: 'button', onclick: guardar, disabled: n ? null : '' }, 'Guardar borrador');
    const descartarB = h('button', { class: 'btn btn--ghost', type: 'button', onclick: async () => { if (await confirmarSalida()) { iniciarTrabajo(); pintar(); } }, disabled: n ? null : '' }, 'Descartar');
    const nErr = Object.keys(errores).length;
    return h('div', { class: 'tm-barra-guardado' },
      nErr ? h('div', { class: 'tm-aviso tm-aviso--error', role: 'alert' }, icono('alert-circle-outline'), h('span', { text: `Corrige ${plural(nErr, 'error', 'errores')} para guardar el borrador` })) : null,
      h('div', { class: 'tm-barra-guardado-fila' }, h('span', { class: `tm-barra-estado${n ? ' tm-barra-estado--cambios' : ''}` }, h('i'), n ? `${plural(n, 'cambio', 'cambios')} sin guardar` : 'Sin cambios pendientes'), h('div', { class: 'tm-barra-botones' }, descartarB, guardarB)));
  }

  // ------------------------------------------------------------------ pestaña: productos (rangos, días y categoría)
  function cuerpoProductos() {
    const p = producto();
    if (!p) return h('p', { class: 'tm-tenue', text: 'Elige un producto de la lista.' });
    const etapas = etapasDe(p);
    const fijos = trabajo.rangos.filter(r => !r.aConvenir);
    const total = (r) => (etapas.every(e => esNum(r.dias[e.clave])) ? etapas.reduce((s, e) => s + r.dias[e.clave], 0) + margen() : null);
    const err = (i, c) => errores[`rangos.${i}.${c}`];
    const celdasCliente = [];
    const actualizarClientes = () => celdasCliente.forEach(({ r, nodo }) => { const t = total(r); nodo.textContent = t === null ? '—' : String(t); });
    const filas = fijos.map((r, i) => {
      const o = original.rangos[i];
      const celda = (campoR, etiqueta, valor, valorOrig, sub) => h('td', null, entrada(valor, { etiqueta, error: Boolean(err(i, campoR)), modificado: !o || valorOrig !== valor, alCambiar: (v) => { if (sub) r.dias[sub] = v; else r[campoR] = v; actualizarClientes(); marcar(); } }));
      const cliente = h('td', { class: 'tm-num' }, h('span', { class: 'tm-cliente-calc', text: total(r) === null ? '—' : String(total(r)) }));
      celdasCliente.push({ r, nodo: cliente.firstChild });
      return h('tr', null,
        celda('desde', `Desde (rango ${i + 1})`, r.desde, o && o.desde), celda('hasta', `Hasta (rango ${i + 1})`, r.hasta, o && o.hasta),
        etapas.map(e => celda(`dias.${e.clave}`, `${e.nombre} (rango ${i + 1})`, r.dias[e.clave], o && o.dias[e.clave], e.clave)),
        cliente,
        h('td', null, h('button', { class: 'btn btn--ghost btn--solo-icono', type: 'button', 'aria-label': `Eliminar el rango ${i + 1}`, onclick: async () => {
          const ok = await confirmar({ titulo: '¿Eliminar este rango?', texto: `Se borra el rango ${r.desde}${esNum(r.hasta) ? ` – ${r.hasta}` : ''} y sus días. Esto no afecta a la versión publicada hasta que publiques.`, aceptar: 'Eliminar rango', peligro: true });
          if (!ok) return; trabajo.rangos.splice(trabajo.rangos.indexOf(r), 1); errores = {}; pintar();
        } }, icono('close-outline'))));
    });
    const ultimoFijo = fijos[fijos.length - 1];
    const filaAbierta = h('tr', { class: 'tm-fila-convenir' }, h('td', { text: ultimoFijo && esNum(ultimoFijo.hasta) ? String(ultimoFijo.hasta + 1) : '—' }), h('td', { text: 'en adelante' }), h('td', { colspan: String(etapas.length + 2), text: 'Tiempo a convenir (siempre es el último rango)' }));
    const tabla = h('div', { class: 'tm-tabla-caja' }, h('table', { class: 'tm-tabla tm-tabla--editable' },
      h('thead', null, h('tr', null, h('th', { text: 'Desde' }), h('th', { text: 'Hasta' }), etapas.map(e => h('th', { class: 'tm-num', text: e.nombre })), h('th', { class: 'tm-num', text: 'Cliente' }), h('th', { 'aria-label': 'Quitar' }))),
      h('tbody', null, filas, filaAbierta)));
    const mensajes = Object.entries(errores).filter(([k]) => /^(rangos|nombre|activo|categoria)/.test(k)).map(([, m]) => h('li', { text: m }));
    const nombre = h('input', { type: 'text', value: trabajo.nombre, maxlength: 150, id: 'adm-nombre', class: errores.nombre ? 'tm-celda--error' : '' });
    nombre.addEventListener('input', () => { trabajo.nombre = nombre.value; marcar(); });
    const cats = datos.categorias.filter(c => c.linea === p.linea && (c.activo || c.clave === trabajo.categoria));
    const categoria = h('select', { id: 'adm-categoria' }, h('option', { value: '', text: 'Sin categoría' }), cats.map(c => h('option', { value: c.clave, text: c.activo ? c.nombre : `${c.nombre} (oculta)` })));
    categoria.value = trabajo.categoria;
    categoria.addEventListener('change', () => { trabajo.categoria = categoria.value; marcar(); });
    const delProducto = datos.extras.filter(e => e.activo !== false && aplica(e, p));
    return h('div', { class: 'tm-rangos' },
      h('div', { class: 'tm-fila-2' },
        campo('Nombre del producto', nombre, errores.nombre ? h('p', { class: 'tm-pie tm-pie--error', text: errores.nombre }) : null),
        campo('Categoría', categoria, pie(errores.categoria || 'Las categorías se crean, ordenan y ocultan en Catálogos.'))),
      interruptor({ marcado: trabajo.activo, etiqueta: 'Se muestra en la calculadora', ayuda: trabajo.activo ? 'Los usuarios lo ven al publicar' : 'Oculto: no aparece, pero no se borra', alCambiar: (v) => { trabajo.activo = v; pintar(); } }),
      h('p', { class: 'tm-tenue tm-extras-producto' }, delProducto.length ? `Extras que se le ofrecen: ${delProducto.map(e => e.nombre).join(', ')}. ` : 'No se le ofrece ningún extra. ',
        h('button', { class: 'tm-enlace', type: 'button', onclick: () => irA('extras') }, 'Cambiar en Extras')),
      tabla,
      mensajes.length ? h('ul', { class: 'tm-errores' }, mensajes) : null,
      h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => {
        const previo = fijos[fijos.length - 1];
        trabajo.rangos.splice(trabajo.rangos.length - 1, 0, { desde: previo && esNum(previo.hasta) ? previo.hasta + 1 : 1, hasta: '', aConvenir: false, dias: previo ? { ...previo.dias } : {} });
        errores = {}; pintar();
      } }, icono('add-outline'), 'Agregar rango'),
      h('p', { class: 'tm-tenue', text: '«Cliente» se calcula solo: suma de las etapas + el margen de la tabla. No hace falta escribirlo.' }));
  }

  // ------------------------------------------------------------------ pestaña: extras
  async function abrirExtra(extra) {
    if (!(await confirmarSalida())) return;
    iniciarTrabajo(); pintar();
    asistenteExtra({
      datos, extra,
      alGuardar: async (final) => {
        const listaE = datos.extras.map(extraParaGuardar);
        const i = extra ? listaE.findIndex(x => x.clave === extra.clave) : listaE.length;
        listaE[i] = final;
        try { await adminGuardarExtras({ extras: listaE }); } catch (error) {
          // Los errores de este extra llegan como «extras.<i>.campo»: el asistente los muestra sin el prefijo.
          if (!error.campos) throw error;
          const propios = {};
          for (const [k, m] of Object.entries(error.campos)) { const pre = `extras.${i}.`; if (k.startsWith(pre)) propios[k.slice(pre.length)] = m; else propios.general = m; }
          const e2 = new Error(error.message); e2.campos = propios; throw e2;
        }
        if (window.toast) window.toast.success(extra ? 'Extra guardado' : 'Extra creado', 'Está en el borrador: los usuarios lo verán cuando publiques.');
        await recargar();
      }
    });
  }
  async function quitarExtra(i) {
    const e = trabajo.extras[i];
    const ok = await confirmar({ titulo: `¿Quitar «${e.nombre}»?`, texto: 'Todavía no se ha publicado, así que se puede quitar. El cambio se guarda con «Guardar borrador».', aceptar: 'Quitar extra', peligro: true });
    if (!ok) return;
    trabajo.extras.splice(i, 1); pintar();
  }

  // ------------------------------------------------------------------ pestaña: catálogos
  function cuerpoCatalogos() {
    const usoV = datos.usoVisible;
    const columna = (tipo, titulo, ayuda, filas, nuevaEtiqueta, filtro) => {
      // Sube o baja dentro de lo que se ve (las categorías se ven por línea).
      const mover = (x, d) => { const listaT = trabajo[tipo]; const k = filas.indexOf(x) + d; if (k < 0 || k >= filas.length) return; const i = listaT.indexOf(x); const j = listaT.indexOf(filas[k]); [listaT[i], listaT[j]] = [listaT[j], listaT[i]]; pintar(); };
      return h('div', { class: 'tm-catalogo' }, h('h3', { class: 'tm-card-titulo', text: titulo }), h('p', { class: 'tm-tenue', text: ayuda }), filtro || null,
        filas.map((x, k) => {
          const i = trabajo[tipo].indexOf(x);
          const enUso = x.clave ? (usoV[tipo][x.clave] || 0) : 0;
          const total = x.clave ? (datos.uso[tipo][x.clave] || 0) : 0;
          const error = errores[`${tipo}.${i}.nombre`] || errores[`${tipo}.${i}.activo`] || errores[`${tipo}.${i}.linea`];
          const oculto = x.activo === false;
          const bloqueado = enUso > 0 && !oculto;
          return h('div', { class: `tm-catalogo-fila${oculto ? ' tm-catalogo-fila--oculta' : ''}` },
            h('div', { class: 'tm-flechas' },
              h('button', { class: 'btn btn--ghost btn--solo-icono', type: 'button', 'aria-label': `Subir ${x.nombre}`, disabled: k === 0 || null, onclick: () => mover(x, -1) }, icono('chevron-up-outline')),
              h('button', { class: 'btn btn--ghost btn--solo-icono', type: 'button', 'aria-label': `Bajar ${x.nombre}`, disabled: k === filas.length - 1 || null, onclick: () => mover(x, 1) }, icono('chevron-down-outline'))),
            textoEditable(x.nombre, (v) => { x.nombre = v; marcar(); }, `${titulo} ${k + 1}`, Boolean(error), 80),
            h('span', { class: 'tm-tenue tm-catalogo-uso', text: x.clave ? plural(total, 'producto', 'productos') : 'Nueva' }),
            h('button', { class: `btn btn--ghost btn--solo-icono tm-ojo${bloqueado ? ' tm-ojo--bloqueado' : ''}`, type: 'button', 'aria-pressed': String(!oculto),
              'aria-label': bloqueado ? `${x.nombre}: no se puede ocultar, está en uso` : (oculto ? `Mostrar ${x.nombre}` : `Ocultar ${x.nombre}`), disabled: bloqueado || null,
              title: bloqueado ? `No se puede ocultar: la usan ${plural(enUso, 'producto visible', 'productos visibles')}.` : (oculto ? 'Mostrar' : 'Ocultar'),
              onclick: () => { x.activo = oculto; pintar(); } }, icono(bloqueado ? 'lock-closed-outline' : (oculto ? 'eye-off-outline' : 'eye-outline'))),
            error ? h('p', { class: 'tm-pie tm-pie--error tm-catalogo-error', text: error }) : null);
        }),
        h('button', { class: 'btn btn--ghost btn--chico', type: 'button', onclick: () => { const n = { clave: '', nombre: '', activo: true }; if (tipo === 'categorias') n.linea = lineaCategorias; trabajo[tipo].push(n); pintar(); } }, icono('add-outline'), nuevaEtiqueta));
    };
    const filtro = h('div', { class: 'tm-pills' }, trabajo.lineas.filter(l => l.clave).map(l => h('button', { class: `tm-pill tm-pill--chica${l.clave === lineaCategorias ? ' tm-pill--activa' : ''}`, type: 'button', 'aria-pressed': String(l.clave === lineaCategorias), onclick: () => { lineaCategorias = l.clave; pintar(); } }, l.nombre)));
    return h('div', null,
      h('p', { class: 'tm-tenue tm-intro', text: 'Renombra, ordena y oculta. Nada se borra: lo oculto deja de verse en la calculadora desde la próxima versión. Lo que usa un producto visible no se puede ocultar (candado).' }),
      h('div', { class: 'tm-catalogos' },
        columna('lineas', 'Líneas', 'Los botones de arriba del selector de productos.', trabajo.lineas, 'Línea nueva'),
        columna('categorias', 'Categorías', 'Agrupan los productos dentro de una línea.', trabajo.categorias.filter(c => c.linea === lineaCategorias), 'Categoría nueva', filtro),
        columna('etapas', 'Etapas', 'Son las columnas de la tabla de tiempos.', trabajo.etapas, 'Etapa nueva')),
      h('p', { class: 'tm-nota-azul', text: 'Para cambiar la categoría de un producto: Productos › elige el producto › «Categoría». El orden que pongas aquí es el que ve quien calcula.' }));
  }

  // ------------------------------------------------------------------ pestaña: reglas
  function cuerpoReglas() {
    const regla = (k, titulo, ayuda, sufijo, ejemplo) => h('div', { class: 'tm-regla-card' }, h('strong', { text: titulo }), h('p', { class: 'tm-tenue', text: ayuda }),
      h('div', { class: 'tm-con-sufijo' }, entrada(trabajo[k], { etiqueta: titulo, ancho: '80px', error: Boolean(errores[`reglas.${k}`]), modificado: original[k] !== trabajo[k], alCambiar: (v) => { trabajo[k] = v; marcar(); } }), h('span', { class: 'tm-tenue', text: sufijo })),
      errores[`reglas.${k}`] ? h('p', { class: 'tm-pie tm-pie--error', text: errores[`reglas.${k}`] }) : (ejemplo ? h('p', { class: 'tm-pie tm-pie--acento', text: ejemplo }) : null));
    const aviso = h('textarea', { id: 'adm-urgente', maxlength: 200, rows: 2, class: `tm-area${errores['reglas.aviso_urgente'] ? ' tm-celda--error' : ''}` });
    aviso.value = trabajo.aviso_urgente;
    const contador = h('span', { class: 'tm-pie', text: `${aviso.value.length} de 200 caracteres` });
    aviso.addEventListener('input', () => { trabajo.aviso_urgente = aviso.value; contador.textContent = `${aviso.value.length} de 200 caracteres`; marcar(); });
    return h('div', { class: 'tm-reglas' },
      h('div', { class: 'tm-fila-2' },
        regla('margen_dias', 'Margen por imprevistos', 'Días que se suman una vez a cada pieza, al final.', 'día(s)', `Ejemplo: etapas 10 días → al cliente ${10 + (esNum(trabajo.margen_dias) ? trabajo.margen_dias : 0)}.`),
        regla('max_piezas', 'Máximo de piezas por pedido', 'Cuántas piezas se pueden agregar en la calculadora.', 'piezas')),
      h('div', { class: 'tm-regla-card' }, h('label', { for: 'adm-urgente' }, h('strong', { text: 'Aviso de pedido urgente' })),
        h('p', { class: 'tm-tenue', text: 'Se muestra en el resultado y en el resumen copiado cuando se marca «Urgente». No cambia los días.' }), aviso,
        errores['reglas.aviso_urgente'] ? h('p', { class: 'tm-pie tm-pie--error', text: errores['reglas.aviso_urgente'] }) : contador),
      h('div', { class: 'tm-aviso tm-aviso--violeta' }, icono('information-circle-outline'), h('span', { text: 'Los días de moldes y la regla de colores ya no están aquí: ahora son extras y se editan en la pestaña Extras.' }),
        h('button', { class: 'btn btn--ghost btn--chico', type: 'button', onclick: () => irA('extras') }, 'Ir a Extras')));
  }

  // ------------------------------------------------------------------ pestaña: avisos
  function listaAvisos(titulo, ayuda, listaT, prefijo) {
    return h('div', { class: 'tm-avisos-bloque' }, h('h3', { class: 'tm-card-titulo', text: titulo }), h('p', { class: 'tm-tenue', text: ayuda }),
      listaT.map((t, i) => h('div', { class: 'tm-aviso-fila' }, textoEditable(t, (v) => { listaT[i] = v; marcar(); }, `${titulo} ${i + 1}`, Boolean(errores[`avisos.${i}.avisos`] && prefijo === 'g')),
        h('button', { class: 'tm-enlace tm-enlace--peligro', type: 'button', onclick: () => { listaT.splice(i, 1); pintar(); } }, 'Quitar'))),
      h('button', { class: 'btn btn--ghost btn--chico', type: 'button', onclick: () => { listaT.push(''); pintar(); } }, icono('add-outline'), 'Agregar aviso'));
  }
  function cuerpoAvisos() {
    const p = producto();
    const mensajes = Object.entries(errores).filter(([k]) => k.startsWith('avisos')).map(([, m]) => h('li', { text: m }));
    return h('div', null,
      p ? listaAvisos(`Avisos de «${p.nombre}»`, 'Se muestran en la calculadora y en la tabla de referencia, solo para este producto.', trabajo.producto, 'p') : null,
      h('div', { class: 'tm-separador' }),
      listaAvisos('Avisos generales', 'Se muestran en todos los resultados de la calculadora.', trabajo.generales, 'g'),
      mensajes.length ? h('ul', { class: 'tm-errores' }, mensajes) : null);
  }

  // ------------------------------------------------------------------ marco
  function pintarLista() {
    lista.actualizar({ lineas: datos.lineas, productos: datos.productos, valor: clave });
    montar(refs.lista, lista.nodo, h('button', { class: 'btn btn--ghost tm-ancho', type: 'button', onclick: nuevoProducto }, icono('add-outline'), 'Producto nuevo'));
  }

  function pintarCabecera() {
    const b = datos.esBorrador;
    montar(refs.cabecera, h('div', { class: 'tm-titulo' },
      h('div', null, h('h1', { text: 'Administración' }), h('p', { text: 'Los cambios se guardan como borrador. Los usuarios los ven cuando publicas una versión nueva.' })),
      h('div', { class: 'tm-titulo-acciones' },
        b ? h('span', { class: 'tm-chip tm-chip--ambar', text: `Borrador ${datos.version.numero} · en uso: ${datos.publicada.numero}` }) : h('span', { class: 'tm-chip tm-chip--verde', text: `Versión ${datos.version.numero} · en uso` }),
        h('a', { class: 'btn btn--ghost', href: '#/administracion/historial' }, 'Historial'),
        h('button', { class: 'btn btn--primary', type: 'button', onclick: publicar, disabled: b ? null : '', title: b ? '' : 'Guarda cambios en el borrador para poder publicar' }, 'Publicar versión nueva'))));
    montar(refs.tabs, TABS.map(([k, t]) => h('button', { class: `tm-tab-admin${tab === k ? ' tm-tab-admin--activa' : ''}`, type: 'button', 'aria-current': tab === k ? 'page' : null, onclick: () => { if (tab !== k) irA(k); } }, t)));
  }

  function pintar() {
    pintarCabecera();
    const conLista = CON_LISTA.has(tab);
    if (conLista) pintarLista();
    const p = producto();
    const cuerpo = tab === 'productos' ? cuerpoProductos() : tab === 'avisos' ? cuerpoAvisos() : tab === 'reglas' ? cuerpoReglas() : tab === 'catalogos' ? cuerpoCatalogos()
      : cuerpoExtras({ datos, trabajo, errores, pintar, abrir: abrirExtra, quitar: quitarExtra });
    refs.barra = barraGuardado();
    montar(refs.editor,
      conLista && p ? h('div', { class: 'tm-ref-titulo' }, h('h2', { text: p.nombre }), p.grupo ? h('span', { class: 'tm-etiqueta-gris', text: p.grupo }) : null, tab === 'productos' ? h('button', { class: 'btn btn--ghost btn--chico tm-ref-accion', type: 'button', onclick: duplicarProducto }, icono('copy-outline'), 'Duplicar este producto') : null) : null,
      cuerpo, refs.barra);
    montar(refs.cuerpo, conLista ? h('div', { class: 'tm-referencia tm-referencia--admin' }, refs.lista, refs.editor) : refs.editor);
  }

  // ------------------------------------------------------------------ ventanas
  function nuevoProducto() {
    const linea = h('select', { id: 'np-linea' }, datos.lineas.filter(l => l.activo).map(l => h('option', { value: l.clave, text: l.nombre })));
    const categoria = h('select', { id: 'np-categoria' });
    const pintarCategorias = () => categoria.replaceChildren(h('option', { value: '', text: 'Sin categoría' }), ...datos.categorias.filter(c => c.linea === linea.value && c.activo).map(c => h('option', { value: c.clave, text: c.nombre })));
    linea.addEventListener('change', pintarCategorias); pintarCategorias();
    const nombre = h('input', { type: 'text', id: 'np-nombre', maxlength: 150, placeholder: 'Ej. Llaveros acrílicos' });
    const elegidas = new Set(['diseno', 'ensamble'].filter(e => datos.etapas.some(x => x.clave === e && x.activo)));
    const chips = h('div', { class: 'tm-pills' });
    const pintarChips = () => chips.replaceChildren(...datos.etapas.filter(e => e.activo).map(e => h('button', { class: `tm-pill${elegidas.has(e.clave) ? ' tm-pill--activa' : ''}`, type: 'button', 'aria-pressed': String(elegidas.has(e.clave)), onclick: () => { if (elegidas.has(e.clave)) elegidas.delete(e.clave); else elegidas.add(e.clave); pintarChips(); }, text: e.nombre })));
    pintarChips();
    const aviso = h('input', { type: 'text', id: 'np-aviso', maxlength: 255, placeholder: 'Ej. Consulta existencias de material' });
    ventana({
      titulo: 'Producto nuevo', subtitulo: 'Se crea oculto: agrega sus rangos y días, y cuando esté listo muéstralo.', aceptar: 'Crear producto',
      contenido: h('div', { class: 'tm-form' }, h('div', { class: 'tm-fila-2' }, campo('Línea', linea), campo('Categoría', categoria)), campo('Nombre del producto', nombre), h('div', { class: 'tm-campo' }, h('span', { class: 'tm-etiqueta', text: 'Etapas que lleva' }), chips, pie('Después agregas los rangos de cantidad y los días de cada etapa.')), campo('Aviso para este producto (opcional)', aviso)),
      alAceptar: async () => {
        if (!(await confirmarSalida())) return false;
        try {
          const r = await adminCrearProducto({ nombre: nombre.value, linea: linea.value, categoria: categoria.value, etapas: datos.etapas.map(e => e.clave).filter(e => elegidas.has(e)), rangos: [{ desde: 1, hasta: null, aConvenir: true, dias: {} }], avisos: aviso.value.trim() ? [aviso.value] : [] });
          tab = 'productos'; if (window.toast) window.toast.success('Producto creado', 'Está oculto: agrega sus rangos y días y luego muéstralo.');
          await recargar({ clave: r.clave });
        } catch (error) { throw new Error(error.campos ? Object.values(error.campos)[0] : error.message); }
      }
    });
  }

  // Crea una variante copiando etapas, rangos, categoría y avisos del producto elegido (nace oculta, como todo producto nuevo).
  async function duplicarProducto() {
    if (!(await confirmarSalida())) return;
    const p = producto(); if (!p) return;
    const nombre = h('input', { type: 'text', id: 'dp-nombre', maxlength: 150, value: `${p.nombre} (copia)` });
    ventana({
      titulo: 'Duplicar producto', subtitulo: `Se copian los rangos, los días, la categoría y los avisos de «${p.nombre}». La copia nace oculta: ajústala y luego muéstrala.`, aceptar: 'Crear copia',
      contenido: h('div', { class: 'tm-form' }, campo('Nombre de la copia', nombre, pie('Cambia el nombre para distinguirla, por ejemplo «Antique con 3 colores».'))),
      alAceptar: async () => {
        try {
          const r = await adminCrearProducto({ nombre: nombre.value, linea: p.linea, categoria: p.categoria || '', etapas: [...p.etapas], avisos: [...p.avisos], rangos: p.rangos.map(x => ({ desde: x.desde, hasta: x.hasta, aConvenir: x.aConvenir, dias: { ...x.dias } })) });
          tab = 'productos'; if (window.toast) window.toast.success('Producto duplicado', 'La copia está oculta: revisa sus días y muéstrala cuando esté lista.');
          await recargar({ clave: r.clave });
        } catch (error) { throw new Error(error.campos ? Object.values(error.campos)[0] : error.message); }
      }
    });
  }

  async function publicar() {
    if (!(await confirmarSalida())) return;
    let cambios = [];
    try { cambios = (await adminCambios()).cambios; } catch (e) { if (window.toast) window.toast.error('No se pudo revisar el borrador', e.message); return; }
    const numero = h('input', { type: 'text', id: 'pub-numero', value: datos.version.numero, maxlength: 20 });
    const fecha = h('input', { type: 'date', id: 'pub-fecha', value: hoyISO() });
    const nota = h('input', { type: 'text', id: 'pub-nota', maxlength: 255, placeholder: 'Ej. Ajuste de fundición y lanyard' });
    ventana({
      titulo: `Publicar la versión ${datos.version.numero}`, subtitulo: 'Al publicar, todos verán estos tiempos en la calculadora y en la tabla de referencia.', aceptar: 'Publicar versión',
      contenido: h('div', { class: 'tm-form' }, h('div', { class: 'tm-fila-2' }, campo('Número de versión', numero, pie(`Sugerido: ${datos.version.numero}`)), campo('Fecha de la versión', fecha)), campo('¿Qué cambió? (para el historial)', nota),
        h('div', { class: 'tm-nota' }, h('strong', { text: plural(cambios.length, 'cambio se publicará', 'cambios se publicarán') }), h('ul', null, cambios.slice(0, 8).map(c => h('li', { text: `${c.objeto}: ${c.detalle}` })), cambios.length > 8 ? h('li', { text: `y ${cambios.length - 8} más` }) : null))),
      alAceptar: async () => {
        try { const r = await adminPublicar({ numero: numero.value, fecha: fecha.value, nota: nota.value }); if (window.toast) window.toast.success('Versión publicada', `La versión ${r.numero} ya está en uso.`); await recargar(); }
        catch (error) { throw new Error(error.campos ? Object.values(error.campos)[0] : error.message); }
      }
    });
  }

  iniciarTrabajo();
  montar(cont, refs.cabecera, refs.tabs, refs.cuerpo);
  pintar();
  return {};
}
