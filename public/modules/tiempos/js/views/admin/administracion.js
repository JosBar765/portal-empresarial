// public/modules/tiempos/js/views/admin/administracion.js
// Administración de la Tabla de tiempos (solo tiempos.administrar): rangos y días, extras, avisos, etapas y líneas.
// Todo lo que se guarda va a un BORRADOR; los usuarios lo ven cuando se publica una versión nueva (ver «Publicar versión nueva»).
import { h, icono, montar } from '../../utils/dom.js';
import { campo, pie, interruptor, confirmar, ventana, cargando } from '../../components/ui.js';
import { adminTabla, adminGuardarProducto, adminCrearProducto, adminGuardarExtras, adminGuardarAvisos, adminGuardarCatalogos, adminCambios, adminPublicar } from '../../api/tiemposApi.js';
import { hoyISO } from '../../utils/formato.js';
import { listaProductos } from '../../components/listaProductos.js';

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
const TABS = [['rangos', 'Rangos y días'], ['extras', 'Extras'], ['avisos', 'Avisos'], ['catalogos', 'Etapas y líneas']];

export async function mostrarAdministracion(cont) {
  montar(cont, cargando('Cargando la administración…'));
  let datos = await adminTabla();
  const margen = () => (datos.parametros.margen_dias === undefined ? 1 : datos.parametros.margen_dias);
  let tab = 'rangos';
  let clave = (datos.productos.find(p => p.activo) || datos.productos[0] || {}).clave;
  let original = null; let trabajo = null; let errores = {};
  const refs = { editor: h('section', { class: 'tm-card tm-editor' }), lista: h('nav', { class: 'tm-card tm-ref-lista', 'aria-label': 'Productos' }), cabecera: h('div') };

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
    alElegir: (c) => irA(tab === 'extras' || tab === 'catalogos' ? 'rangos' : tab, c)
  });

  // ------------------------------------------------------------------ lo que se edita en cada pestaña
  function iniciarTrabajo() {
    errores = {};
    if (tab === 'rangos') { const p = producto(); original = p ? { nombre: p.nombre, activo: p.activo, permiteMoldes: p.permiteMoldes, permiteLanyard: p.permiteLanyard, rangos: copia(p.rangos).map(r => ({ desde: r.desde, hasta: r.hasta, aConvenir: r.aConvenir, dias: r.dias })) } : {}; }
    else if (tab === 'extras') original = { extras: copia(datos.extras), parametros: copia(datos.parametros) };
    else if (tab === 'avisos') { const p = producto(); original = { producto: p ? [...p.avisos] : [], generales: [...datos.avisosGenerales] }; }
    else original = { lineas: datos.lineas.map(l => ({ clave: l.clave, nombre: l.nombre })), etapas: datos.etapas.map(e => ({ clave: e.clave, nombre: e.nombre })) };
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

  // ------------------------------------------------------------------ guardar
  async function guardar() {
    errores = {};
    try {
      if (tab === 'rangos') {
        const p = producto(); const fijos = trabajo.rangos.filter(r => !r.aConvenir);
        const rangos = copia(trabajo.rangos); const abierto = rangos[rangos.length - 1];
        if (abierto && fijos.length && esNum(fijos[fijos.length - 1].hasta)) abierto.desde = fijos[fijos.length - 1].hasta + 1;
        await adminGuardarProducto(p.clave, { nombre: trabajo.nombre, activo: trabajo.activo, permiteMoldes: trabajo.permiteMoldes, permiteLanyard: trabajo.permiteLanyard, etapas: p.etapas, rangos, avisos: p.avisos });
      } else if (tab === 'extras') {
        const extras = copia(trabajo.extras);
        for (const e of extras) { const f = e.rangos.filter(r => !r.aConvenir); const ab = e.rangos[e.rangos.length - 1]; if (ab && f.length && esNum(f[f.length - 1].hasta)) ab.desde = f[f.length - 1].hasta + 1; }
        await adminGuardarExtras({ extras, parametros: trabajo.parametros });
      } else if (tab === 'avisos') {
        const p = producto();
        if (contar(original.producto, trabajo.producto)) await adminGuardarProducto(p.clave, { nombre: p.nombre, activo: p.activo, permiteMoldes: p.permiteMoldes, permiteLanyard: p.permiteLanyard, etapas: p.etapas, rangos: p.rangos, avisos: trabajo.producto });
        if (contar(original.generales, trabajo.generales)) await adminGuardarAvisos({ avisos: trabajo.generales });
      } else await adminGuardarCatalogos({ lineas: trabajo.lineas, etapas: trabajo.etapas });
    } catch (error) {
      if (error.campos) { errores = error.campos; pintar(); const primero = refs.editor.querySelector('.tm-celda--error, .tm-aviso--error'); if (primero) primero.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      if (window.toast) window.toast.error('No se pudo guardar', error.message);
      return;
    }
    if (window.toast) window.toast.success('Borrador guardado', 'Los usuarios lo verán cuando publiques la versión.');
    await recargar();
  }

  // ------------------------------------------------------------------ piezas de formulario
  const entrada = (valor, { ancho = '', error = false, modificado = false, alCambiar, etiqueta, deshabilitado = false }) => {
    const i = h('input', { type: 'text', inputmode: 'numeric', value: valor === null || valor === undefined ? '' : String(valor), class: `tm-celda${error ? ' tm-celda--error' : ''}${modificado ? ' tm-celda--cambio' : ''}`, 'aria-label': etiqueta, 'aria-invalid': error ? 'true' : null, style: ancho ? `width:${ancho}` : null, disabled: deshabilitado || null });
    i.addEventListener('input', () => alCambiar(num(i.value), i));
    return i;
  };
  const textoEditable = (valor, alCambiar, etiqueta, error) => { const i = h('input', { type: 'text', value: valor || '', class: `tm-texto-edit${error ? ' tm-celda--error' : ''}`, 'aria-label': etiqueta, maxlength: 255 }); i.addEventListener('input', () => alCambiar(i.value)); return i; };

  function barraGuardado() {
    const n = cuenta();
    const guardarB = h('button', { class: 'btn btn--primary', type: 'button', onclick: guardar, disabled: n ? null : '' }, 'Guardar borrador');
    const descartarB = h('button', { class: 'btn btn--ghost', type: 'button', onclick: async () => { if (await confirmarSalida()) { iniciarTrabajo(); pintar(); } }, disabled: n ? null : '' }, 'Descartar');
    const nErr = Object.keys(errores).length;
    return h('div', { class: 'tm-barra-guardado' },
      nErr ? h('div', { class: 'tm-aviso tm-aviso--error', role: 'alert' }, icono('alert-circle-outline'), h('span', { text: `Corrige ${plural(nErr, 'error', 'errores')} para guardar el borrador` })) : null,
      h('div', { class: 'tm-barra-guardado-fila' }, h('span', { class: `tm-barra-estado${n ? ' tm-barra-estado--cambios' : ''}` }, h('i'), n ? `${plural(n, 'cambio', 'cambios')} sin guardar` : 'Sin cambios pendientes'), h('div', { class: 'tm-barra-botones' }, descartarB, guardarB)));
  }

  // ------------------------------------------------------------------ pestaña: rangos y días
  function cuerpoRangos() {
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
      const celda = (campoR, etiqueta, valor, valorOrig, sub) => h('td', null, entrada(valor, { etiqueta, error: Boolean(err(i, campoR)), modificado: !o || valorOrig !== valor, alCambiar: (v) => { if (sub) r.dias[sub] = v; else r[campoR] = v; actualizarClientes(); refs.barra.replaceWith(refs.barra = barraGuardado()); } }));
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
    const abierto = trabajo.rangos.find(r => r.aConvenir);
    const filaAbierta = h('tr', { class: 'tm-fila-convenir' }, h('td', { text: ultimoFijo && esNum(ultimoFijo.hasta) ? String(ultimoFijo.hasta + 1) : '—' }), h('td', { text: 'en adelante' }), h('td', { colspan: String(etapas.length + 2), text: 'Tiempo a convenir (siempre es el último rango)' }));
    const tabla = h('div', { class: 'tm-tabla-caja' }, h('table', { class: 'tm-tabla tm-tabla--editable' },
      h('thead', null, h('tr', null, h('th', { text: 'Desde' }), h('th', { text: 'Hasta' }), etapas.map(e => h('th', { class: 'tm-num', text: e.nombre })), h('th', { class: 'tm-num', text: 'Cliente' }), h('th', { 'aria-label': 'Quitar' }))),
      h('tbody', null, filas, filaAbierta)));
    const mensajes = Object.entries(errores).filter(([k]) => /^(rangos|nombre|activo)/.test(k)).map(([, m]) => h('li', { text: m }));
    return h('div', { class: 'tm-rangos' },
      h('div', { class: 'tm-fila-2' }, campo('Nombre del producto', (() => { const i = h('input', { type: 'text', value: trabajo.nombre, maxlength: 150, id: 'adm-nombre', class: errores.nombre ? 'tm-celda--error' : '' }); i.addEventListener('input', () => { trabajo.nombre = i.value; refs.barra.replaceWith(refs.barra = barraGuardado()); }); return i; })(), errores.nombre ? h('p', { class: 'tm-pie tm-pie--error', text: errores.nombre }) : null),
        h('div', { class: 'tm-opciones-producto' },
          interruptor({ marcado: trabajo.activo, etiqueta: 'Se muestra en la calculadora', ayuda: trabajo.activo ? 'Los usuarios lo ven al publicar' : 'Oculto: no aparece, pero no se borra', alCambiar: (v) => { trabajo.activo = v; pintar(); } }),
          interruptor({ marcado: trabajo.permiteMoldes, etiqueta: 'Lleva moldes (pieza fundida)', ayuda: 'Suma los días de moldes si pasa de 3.5 pulgadas', alCambiar: (v) => { trabajo.permiteMoldes = v; refs.barra.replaceWith(refs.barra = barraGuardado()); } }),
          interruptor({ marcado: trabajo.permiteLanyard, etiqueta: 'Puede llevar lanyard cosido', ayuda: 'Suma la costura de Protextil', alCambiar: (v) => { trabajo.permiteLanyard = v; refs.barra.replaceWith(refs.barra = barraGuardado()); } }))),
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
  function cuerpoExtras() {
    const tablasUv = trabajo.extras.map((e, ei) => {
      const fijos = e.rangos.filter(r => !r.aConvenir); const ult = fijos[fijos.length - 1];
      const filas = fijos.map((r, i) => {
        const o = original.extras[ei] && original.extras[ei].rangos[i];
        const err = (c) => errores[`extras.${ei}.${i}.${c}`];
        const celda = (c, v, ov, etiqueta) => h('td', null, entrada(v, { etiqueta: `${e.nombre}: ${etiqueta}`, error: Boolean(err(c)), modificado: !o || ov !== v, alCambiar: (nv) => { r[c] = nv; refs.barra.replaceWith(refs.barra = barraGuardado()); } }));
        return h('tr', null, celda('desde', r.desde, o && o.desde, 'desde'), celda('hasta', r.hasta, o && o.hasta, 'hasta'), celda('dias', r.dias, o && o.dias, 'días que suma'),
          h('td', null, h('button', { class: 'btn btn--ghost btn--solo-icono', type: 'button', 'aria-label': `Quitar el rango ${i + 1} de ${e.nombre}`, onclick: () => { e.rangos.splice(e.rangos.indexOf(r), 1); errores = {}; pintar(); } }, icono('close-outline'))));
      });
      return h('div', { class: 'tm-extra-card' }, h('strong', { text: e.nombre }), e.aviso ? h('p', { class: 'tm-tenue', text: e.aviso }) : null,
        h('div', { class: 'tm-tabla-caja' }, h('table', { class: 'tm-tabla tm-tabla--editable' }, h('thead', null, h('tr', null, h('th', { text: 'Desde' }), h('th', { text: 'Hasta' }), h('th', { text: 'Suma (días)' }), h('th', { 'aria-label': 'Quitar' }))),
          h('tbody', null, filas, h('tr', { class: 'tm-fila-convenir' }, h('td', { text: ult && esNum(ult.hasta) ? String(ult.hasta + 1) : '—' }), h('td', { text: 'en adelante' }), h('td', { colspan: '2', text: 'A convenir' }))))),
        h('button', { class: 'btn btn--ghost btn--chico', type: 'button', onclick: () => { e.rangos.splice(e.rangos.length - 1, 0, { desde: ult && esNum(ult.hasta) ? ult.hasta + 1 : 1, hasta: '', aConvenir: false, dias: '' }); errores = {}; pintar(); } }, icono('add-outline'), 'Agregar rango'));
    });
    const param = (k, etiqueta, ayuda) => campo(etiqueta, entrada(trabajo.parametros[k], { etiqueta, error: Boolean(errores[`parametros.${k}`]), modificado: original.parametros[k] !== trabajo.parametros[k], ancho: '72px', alCambiar: (v) => { trabajo.parametros[k] = v; refs.barra.replaceWith(refs.barra = barraGuardado()); } }), pie(errores[`parametros.${k}`] || ayuda), 'tm-campo--param');
    const mensajes = Object.entries(errores).filter(([k]) => k.startsWith('extras.')).map(([, m]) => h('li', { text: m }));
    return h('div', { class: 'tm-extras-admin' },
      h('h3', { class: 'tm-card-titulo', text: 'Impresión UV · días que suma' }), h('div', { class: 'tm-extra-fila' }, tablasUv),
      mensajes.length ? h('ul', { class: 'tm-errores' }, mensajes) : null,
      h('h3', { class: 'tm-card-titulo', text: 'Reglas generales' }),
      h('div', { class: 'tm-params' }, param('moldes_dias', 'Moldes (más de 3.5 pulgadas)', 'Días extra en piezas fundidas'), param('colores_incluidos', 'Colores incluidos', 'Ya vienen en los tiempos de la tabla'),
        param('colores_cada', 'Colores extra: cada cuántos', 'Cada cuántos colores se suma'), param('colores_dias', 'Colores extra: días', 'Días que suma cada grupo'), param('margen_dias', 'Margen por imprevistos', 'Días que se suman al total')),
      h('p', { class: 'tm-tenue', text: 'La costura de Protextil no se escribe aquí: se toma de la columna «Costura» del Lanyard según la cantidad.' }));
  }

  // ------------------------------------------------------------------ pestaña: avisos
  function listaAvisos(titulo, ayuda, lista, prefijo) {
    const marcar = () => refs.barra.replaceWith(refs.barra = barraGuardado());
    return h('div', { class: 'tm-avisos-bloque' }, h('h3', { class: 'tm-card-titulo', text: titulo }), h('p', { class: 'tm-tenue', text: ayuda }),
      lista.map((t, i) => h('div', { class: 'tm-aviso-fila' }, textoEditable(t, (v) => { lista[i] = v; marcar(); }, `${titulo} ${i + 1}`, Boolean(errores[`avisos.${i}.avisos`] && prefijo === 'g')),
        h('button', { class: 'tm-enlace tm-enlace--peligro', type: 'button', onclick: () => { lista.splice(i, 1); pintar(); } }, 'Quitar'))),
      h('button', { class: 'btn btn--ghost btn--chico', type: 'button', onclick: () => { lista.push(''); pintar(); } }, icono('add-outline'), 'Agregar aviso'));
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

  // ------------------------------------------------------------------ pestaña: etapas y líneas
  function cuerpoCatalogos() {
    const bloque = (tipo, titulo, ayuda, lista, uso, nuevaEtiqueta) => h('div', { class: 'tm-catalogo' }, h('h3', { class: 'tm-card-titulo', text: titulo }), h('p', { class: 'tm-tenue', text: ayuda }),
      lista.map((x, i) => h('div', { class: 'tm-catalogo-fila' },
        textoEditable(x.nombre, (v) => { x.nombre = v; refs.barra.replaceWith(refs.barra = barraGuardado()); }, `${titulo} ${i + 1}`, Boolean(errores[`${tipo}.${i}.nombre`])),
        h('span', { class: 'tm-tenue', text: x.clave && uso[x.clave] ? plural(uso[x.clave], 'producto', 'productos') : (x.clave ? 'Sin productos' : 'Nueva') }),
        errores[`${tipo}.${i}.nombre`] ? h('span', { class: 'tm-pie tm-pie--error', text: errores[`${tipo}.${i}.nombre`] }) : null)),
      h('button', { class: 'btn btn--ghost btn--chico', type: 'button', onclick: () => { lista.push({ clave: '', nombre: '' }); pintar(); } }, icono('add-outline'), nuevaEtiqueta));
    return h('div', { class: 'tm-catalogos' },
      bloque('etapas', 'Etapas', 'Son las columnas de la tabla. No se pueden borrar: se renombran o se agregan.', trabajo.etapas, datos.uso.etapas, 'Etapa nueva'),
      bloque('lineas', 'Líneas', 'Agrupan los productos en la calculadora (los botones «Mundi», «Protextil»…).', trabajo.lineas, datos.uso.lineas, 'Línea nueva'));
  }

  // ------------------------------------------------------------------ marco
  function pintarLista() {
    lista.actualizar({ lineas: datos.lineas, productos: datos.productos, valor: tab === 'rangos' || tab === 'avisos' ? clave : '' });
    montar(refs.lista, lista.nodo, h('button', { class: 'btn btn--ghost tm-ancho', type: 'button', onclick: nuevoProducto }, icono('add-outline'), 'Producto nuevo'));
  }

  function pintarCabecera() {
    const b = datos.esBorrador;
    montar(refs.cabecera, h('div', { class: 'tm-titulo' },
      h('div', null, h('h1', { text: 'Administración de tablas' }), h('p', { text: 'Los cambios se guardan como borrador. Los usuarios los ven cuando publicas una versión nueva.' })),
      h('div', { class: 'tm-titulo-acciones' },
        b ? h('span', { class: 'tm-chip tm-chip--ambar', text: `Borrador ${datos.version.numero} · en uso: ${datos.publicada.numero}` }) : h('span', { class: 'tm-chip tm-chip--verde', text: `Versión ${datos.version.numero} · en uso` }),
        h('a', { class: 'btn btn--ghost', href: '#/administracion/historial' }, 'Historial'),
        h('button', { class: 'btn btn--primary', type: 'button', onclick: publicar, disabled: b ? null : '', title: b ? '' : 'Guarda cambios en el borrador para poder publicar' }, 'Publicar versión nueva'))));
  }

  function pintar() {
    pintarCabecera(); pintarLista();
    const cuerpo = tab === 'rangos' ? cuerpoRangos() : tab === 'extras' ? cuerpoExtras() : tab === 'avisos' ? cuerpoAvisos() : cuerpoCatalogos();
    refs.barra = barraGuardado();
    const p = producto();
    montar(refs.editor,
      h('div', { class: 'tm-pills', role: 'tablist' }, TABS.map(([k, t]) => h('button', { class: `tm-pill${tab === k ? ' tm-pill--activa' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(tab === k), onclick: () => irA(k) }, t))),
      (tab === 'rangos' || tab === 'avisos') && p ? h('div', { class: 'tm-ref-titulo' }, h('h2', { text: p.nombre }), p.grupo ? h('span', { class: 'tm-etiqueta-gris', text: p.grupo }) : null, tab === 'rangos' ? h('button', { class: 'btn btn--ghost btn--chico tm-ref-accion', type: 'button', onclick: duplicarProducto }, icono('copy-outline'), 'Duplicar este producto') : null) : null,
      cuerpo, refs.barra);
  }

  // ------------------------------------------------------------------ ventanas
  function nuevoProducto() {
    const linea = h('select', { id: 'np-linea' }, datos.lineas.map(l => h('option', { value: l.clave, text: l.nombre })));
    const nombre = h('input', { type: 'text', id: 'np-nombre', maxlength: 150, placeholder: 'Ej. Llaveros acrílicos' });
    const elegidas = new Set(['diseno', 'ensamble'].filter(e => datos.etapas.some(x => x.clave === e)));
    const chips = h('div', { class: 'tm-pills' });
    const pintarChips = () => chips.replaceChildren(...datos.etapas.map(e => h('button', { class: `tm-pill${elegidas.has(e.clave) ? ' tm-pill--activa' : ''}`, type: 'button', 'aria-pressed': String(elegidas.has(e.clave)), onclick: () => { if (elegidas.has(e.clave)) elegidas.delete(e.clave); else elegidas.add(e.clave); pintarChips(); }, text: e.nombre })));
    pintarChips();
    const aviso = h('input', { type: 'text', id: 'np-aviso', maxlength: 255, placeholder: 'Ej. Consulta existencias de material' });
    ventana({
      titulo: 'Producto nuevo', subtitulo: 'Se crea oculto: agrega sus rangos y días, y cuando esté listo muéstralo.', aceptar: 'Crear producto',
      contenido: h('div', { class: 'tm-form' }, campo('Línea', linea), campo('Nombre del producto', nombre), h('div', { class: 'tm-campo' }, h('span', { class: 'tm-etiqueta', text: 'Etapas que lleva' }), chips, pie('Después agregas los rangos de cantidad y los días de cada etapa.')), campo('Aviso para este producto (opcional)', aviso)),
      alAceptar: async () => {
        if (!(await confirmarSalida())) return false;
        try {
          const r = await adminCrearProducto({ nombre: nombre.value, linea: linea.value, etapas: datos.etapas.map(e => e.clave).filter(e => elegidas.has(e)), rangos: [{ desde: 1, hasta: null, aConvenir: true, dias: {} }], avisos: aviso.value.trim() ? [aviso.value] : [] });
          tab = 'rangos'; if (window.toast) window.toast.success('Producto creado', 'Está oculto: agrega sus rangos y días y luego muéstralo.');
          await recargar({ clave: r.clave });
        } catch (error) { throw new Error(error.campos ? Object.values(error.campos)[0] : error.message); }
      }
    });
  }

  // Crea una variante copiando etapas, rangos y avisos del producto elegido (nace oculta, como todo producto nuevo).
  async function duplicarProducto() {
    if (!(await confirmarSalida())) return;
    const p = producto(); if (!p) return;
    const nombre = h('input', { type: 'text', id: 'dp-nombre', maxlength: 150, value: `${p.nombre} (copia)` });
    ventana({
      titulo: 'Duplicar producto', subtitulo: `Se copian los rangos, los días y los avisos de «${p.nombre}». La copia nace oculta: ajústala y luego muéstrala.`, aceptar: 'Crear copia',
      contenido: h('div', { class: 'tm-form' }, campo('Nombre de la copia', nombre, pie('Cambia el nombre para distinguirla, por ejemplo «Antique con 3 colores».'))),
      alAceptar: async () => {
        try {
          const r = await adminCrearProducto({ nombre: nombre.value, linea: p.linea, grupo: p.grupo || '', etapas: [...p.etapas], permiteMoldes: p.permiteMoldes, permiteLanyard: p.permiteLanyard, avisos: [...p.avisos], rangos: p.rangos.map(x => ({ desde: x.desde, hasta: x.hasta, aConvenir: x.aConvenir, dias: { ...x.dias } })) });
          tab = 'rangos'; if (window.toast) window.toast.success('Producto duplicado', 'La copia está oculta: revisa sus días y muéstrala cuando esté lista.');
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
      titulo: `Publicar la versión ${datos.version.numero}`, subtitulo: 'Al publicar, todos verán estos tiempos en la calculadora y en la tabla de referencia.', aceptar: `Publicar versión`,
      contenido: h('div', { class: 'tm-form' }, h('div', { class: 'tm-fila-2' }, campo('Número de versión', numero, pie(`Sugerido: ${datos.version.numero}`)), campo('Fecha de la versión', fecha)), campo('¿Qué cambió? (para el historial)', nota),
        h('div', { class: 'tm-nota' }, h('strong', { text: plural(cambios.length, 'cambio se publicará', 'cambios se publicarán') }), h('ul', null, cambios.slice(0, 8).map(c => h('li', { text: `${c.objeto}: ${c.detalle}` })), cambios.length > 8 ? h('li', { text: `y ${cambios.length - 8} más` }) : null))),
      alAceptar: async () => {
        try { const r = await adminPublicar({ numero: numero.value, fecha: fecha.value, nota: nota.value }); if (window.toast) window.toast.success('Versión publicada', `La versión ${r.numero} ya está en uso.`); await recargar(); }
        catch (error) { throw new Error(error.campos ? Object.values(error.campos)[0] : error.message); }
      }
    });
  }

  iniciarTrabajo();
  montar(cont, refs.cabecera, h('div', { class: 'tm-referencia tm-referencia--admin' }, refs.lista, refs.editor));
  pintar();
  return {};
}
