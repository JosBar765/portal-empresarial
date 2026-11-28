// public/modules/tiempos/js/views/admin/extrasAdmin.js
// Pestaña Extras de la administración: la lista (orden, visible u oculto, quitar) y el asistente «Extra nuevo» / «Editar»
// de cuatro pasos: tipo, datos, dónde se ofrece y revisar. El asistente guarda al terminar; la lista se guarda con la barra.
import { h, icono } from '../../utils/dom.js';
import { campo, pie, nuevoId } from '../../components/ui.js';
import { TIPOS, aplica, diasPorUnidades, textoExtra, textoAlcance } from '../../utils/extras.js';
import { pluralDias, rangoDe } from '../../utils/formato.js';
import { sinAcentos } from '../../components/listaProductos.js';

const num = (t) => (/^\d{1,9}$/.test(String(t).trim()) ? Number(t) : String(t).trim());
const esNum = (x) => Number.isInteger(x);
const copia = (x) => JSON.parse(JSON.stringify(x));
const chipTipo = (tipo) => h('span', { class: `tm-tipo ${TIPOS[tipo].clase}`, text: TIPOS[tipo].nombre });

// ------------------------------------------------------------------ lista
// `ctx`: { datos, trabajo, errores, marcar(), pintar(), abrir(extra|null), quitar(i) }
export function cuerpoExtras(ctx) {
  const lista = ctx.trabajo.extras;
  let arrastrando = null;
  const mover = (de, a) => { if (a < 0 || a >= lista.length || de === a) return; const [x] = lista.splice(de, 1); lista.splice(a, 0, x); ctx.pintar(); };
  const mensajes = Object.entries(ctx.errores).filter(([k]) => k.startsWith('extras')).map(([, m]) => h('li', { text: m }));
  const filas = lista.map((e, i) => {
    const oculto = e.activo === false;
    const fila = h('tr', { class: oculto ? 'tm-fila-oculta' : '', draggable: 'true',
      ondragstart: (ev) => { arrastrando = i; ev.dataTransfer.effectAllowed = 'move'; },
      ondragover: (ev) => { ev.preventDefault(); fila.classList.add('tm-fila-destino'); },
      ondragleave: () => fila.classList.remove('tm-fila-destino'),
      ondrop: (ev) => { ev.preventDefault(); if (arrastrando !== null) mover(arrastrando, i); arrastrando = null; } },
    h('td', { class: 'tm-agarre', 'aria-hidden': 'true' }, icono('reorder-two-outline')),
    h('td', null, h('strong', { class: 'tm-extra-nombre', text: e.nombre }), h('span', { class: 'tm-tenue tm-extra-etiqueta', text: `«${e.etiqueta}»` })),
    h('td', null, chipTipo(e.tipo)),
    h('td', { class: 'tm-celda-texto', text: textoAlcance(e, ctx.datos) }),
    h('td', { class: 'tm-celda-texto', text: textoExtra(e) }),
    h('td', null, h('button', { class: `tm-estado ${oculto ? 'tm-estado--oculto' : 'tm-estado--visible'}`, type: 'button', 'aria-pressed': String(!oculto),
      title: oculto ? 'Mostrarlo en la calculadora' : 'Ocultarlo de la calculadora', onclick: () => { e.activo = oculto; ctx.pintar(); } }, oculto ? 'Oculto' : 'Visible')),
    h('td', null, h('div', { class: 'tm-acciones-fila' },
      h('div', { class: 'tm-flechas' },
        h('button', { class: 'btn btn--ghost btn--solo-icono', type: 'button', 'aria-label': `Subir ${e.nombre}`, disabled: i === 0 || null, onclick: () => mover(i, i - 1) }, icono('chevron-up-outline')),
        h('button', { class: 'btn btn--ghost btn--solo-icono', type: 'button', 'aria-label': `Bajar ${e.nombre}`, disabled: i === lista.length - 1 || null, onclick: () => mover(i, i + 1) }, icono('chevron-down-outline'))),
      h('button', { class: 'btn btn--ghost btn--chico', type: 'button', onclick: () => ctx.abrir(e) }, 'Editar'),
      e.publicado ? null : h('button', { class: 'tm-enlace tm-enlace--peligro', type: 'button', onclick: () => ctx.quitar(i) }, 'Quitar'))));
    return fila;
  });
  return h('div', { class: 'tm-extras-admin' },
    h('div', { class: 'tm-seccion-cab' },
      h('div', null, h('h2', { class: 'tm-card-titulo', text: 'Extras' }), h('p', { class: 'tm-tenue', text: 'Lo que se suma a una pieza según lo que pide el cliente. Arrastra las filas o usa las flechas para cambiar el orden en la calculadora.' })),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: () => ctx.abrir(null) }, icono('add-outline'), 'Extra nuevo')),
    h('div', { class: 'tm-tabla-caja' }, h('table', { class: 'tm-tabla tm-tabla--extras' },
      h('thead', null, h('tr', null, h('th', { 'aria-label': 'Mover' }), h('th', { text: 'Extra' }), h('th', { text: 'Tipo' }), h('th', { text: 'Se ofrece en' }), h('th', { text: 'Cómo suma' }), h('th', { text: 'Estado' }), h('th', { 'aria-label': 'Acciones' }))),
      h('tbody', null, filas.length ? filas : h('tr', null, h('td', { colspan: '7', class: 'tm-tenue', text: 'Todavía no hay extras. Crea el primero con «Extra nuevo».' }))))),
    mensajes.length ? h('ul', { class: 'tm-errores' }, mensajes) : null,
    h('p', { class: 'tm-nota-azul', text: 'Un extra no se borra si ya se usó en una versión publicada: se oculta. Ocultarlo lo quita de la calculadora desde la próxima versión.' }));
}

// ------------------------------------------------------------------ asistente
const PASOS = ['Tipo', 'Datos', 'Dónde se ofrece', 'Revisar'];
const rangosNuevos = () => [{ desde: 1, hasta: '', aConvenir: false, dias: '' }, { desde: '', hasta: null, aConvenir: true, dias: null }];
const vacio = () => ({ clave: '', tipo: '', nombre: '', etiqueta: '', ayuda: '', aviso: '', activo: true, diasFijos: 1,
  unidades: { incluidas: 1, cada: 1, dias: 1, max: 10 }, opciones: [{ clave: '', nombre: '', aviso: '', rangos: rangosNuevos() }],
  alcance: { todos: true, lineas: [], categorias: [], productos: [] } });

// Abre el asistente. `alGuardar(extra)` guarda (puede lanzar un error con `campos` del servidor).
export function asistenteExtra({ datos, extra, alGuardar }) {
  const nuevo = !extra;
  const e = nuevo ? vacio() : Object.assign(vacio(), copia(extra));
  if (!e.opciones.length) e.opciones = vacio().opciones;
  let paso = nuevo ? 1 : 2;
  let opcion = 0;
  let errores = {}; // campo → mensaje (del paso actual o del servidor)
  let filtroArbol = '';
  const abiertos = new Set();
  const previo = document.activeElement;
  const idTitulo = nuevoId('asistente');

  const cuerpo = h('div', { class: 'tm-asistente-cuerpo' });
  const pasos = h('ol', { class: 'tm-pasos' });
  const titulo = h('h2', { id: idTitulo });
  const sub = h('p');
  const pieIzq = h('p', { class: 'tm-tenue' });
  const atras = h('button', { class: 'btn btn--ghost', type: 'button' });
  const siguiente = h('button', { class: 'btn btn--primary', type: 'button' });
  const fondo = h('div', { class: 'tm-modal-fondo' },
    h('div', { class: 'tm-modal tm-modal--asistente', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': idTitulo },
      h('div', { class: 'tm-modal-cabecera' }, h('div', null, titulo, sub), h('button', { class: 'btn btn--ghost btn--solo-icono', type: 'button', 'aria-label': 'Cerrar', onclick: () => cerrar() }, icono('close-outline'))),
      pasos, cuerpo,
      h('div', { class: 'tm-asistente-pie' }, pieIzq, h('div', { class: 'tm-modal-acciones' }, atras, siguiente))));
  const alTecla = (ev) => { if (ev.key === 'Escape') cerrar(); };
  function cerrar() { document.removeEventListener('keydown', alTecla); fondo.remove(); if (previo && previo.focus) previo.focus(); }

  // ---- piezas
  const texto = (valor, alCambiar, o = {}) => { const i = h('input', { type: 'text', value: valor ?? '', maxlength: o.max || 120, placeholder: o.placeholder || '', id: o.id, class: errores[o.error] ? 'tm-celda--error' : '' }); i.addEventListener('input', () => alCambiar(i.value)); return i; };
  const numero = (valor, alCambiar, o = {}) => { const i = h('input', { type: 'text', inputmode: 'numeric', value: valor ?? '', class: `tm-celda${errores[o.error] ? ' tm-celda--error' : ''}`, 'aria-label': o.etiqueta, id: o.id }); i.addEventListener('input', () => { alCambiar(num(i.value)); if (o.refrescar) o.refrescar(); }); return i; };
  const conError = (clave, nodo) => [nodo, errores[clave] ? h('p', { class: 'tm-pie tm-pie--error', text: errores[clave] }) : null];

  // Ejemplo con un producto real: el primero donde se ofrece y que tiene tiempo en la cantidad elegida.
  function ejemplo() {
    const productos = datos.productos.filter(p => p.activo !== false && (e.alcance.todos || aplica(e, p)));
    const margen = Number.isInteger(datos.parametros.margen_dias) ? datos.parametros.margen_dias : 1;
    for (const p of productos) {
      const cantidades = e.tipo === 'por_cantidad' ? (e.opciones[opcion] || e.opciones[0]).rangos.filter(r => !r.aConvenir && esNum(r.desde)).map(r => Math.max(r.desde, 300)) : [300];
      for (const q of [...cantidades, p.rangos[0] ? p.rangos[0].desde : 1]) {
        const r = rangoDe(p, q); if (!r || r.aConvenir) continue;
        const base = Object.values(r.dias).reduce((a, b) => a + b, 0) + margen;
        let suma = null; let detalle = '';
        if (e.tipo === 'si_no' && esNum(e.diasFijos)) { suma = e.diasFijos; detalle = e.nombre || 'el extra'; }
        if (e.tipo === 'por_unidades' && esNum(e.unidades.incluidas) && esNum(e.unidades.cada) && esNum(e.unidades.dias)) { const n = e.unidades.incluidas + e.unidades.cada; suma = diasPorUnidades(e.unidades, n); detalle = `${n} ${(e.nombre || 'unidades').toLowerCase()}`; }
        if (e.tipo === 'por_cantidad') { const o = e.opciones[opcion] || e.opciones[0]; const ro = o.rangos.find(x => !x.aConvenir && esNum(x.desde) && esNum(x.hasta) && q >= x.desde && q <= x.hasta); if (!ro || !esNum(ro.dias)) continue; suma = ro.dias; detalle = o.nombre || e.nombre || 'el extra'; }
        if (suma === null) return null;
        return { producto: p.nombre, cantidad: q, base, suma, total: base + suma, detalle };
      }
    }
    return null;
  }
  const cajaEjemplo = () => {
    const x = ejemplo();
    return h('div', { class: 'tm-ejemplo' }, h('strong', { text: 'Ejemplo con datos reales' }),
      x ? [h('span', { text: `${x.producto} · ${x.cantidad} piezas` }), h('b', { text: `${pluralDias(x.base)} + ${x.suma} de ${x.detalle} = ${pluralDias(x.total)}` })]
        : h('span', { text: 'Completa los datos para ver un ejemplo.' }));
  };

  function vistaPrevia() {
    const control = e.tipo === 'por_unidades'
      ? h('div', { class: 'tm-previa-fila' }, h('div', null, h('strong', { text: e.etiqueta || 'Pregunta en la calculadora' }), h('small', { text: textoExtra(e) })), h('span', { class: 'tm-previa-select', text: `${esNum(e.unidades.incluidas) ? e.unidades.incluidas : 1} (incluidos)` }))
      : h('div', { class: 'tm-previa-fila' }, h('span', { class: 'tm-previa-sw', 'aria-hidden': 'true' }), h('div', null, h('strong', { text: e.etiqueta || 'Texto en la calculadora' }), h('small', { text: e.ayuda || textoExtra(e) })));
    return h('div', { class: 'tm-previa' }, h('span', { class: 'tm-previa-titulo', text: 'Vista previa en la calculadora' }), control,
      e.tipo === 'por_cantidad' && e.opciones.length > 1 ? h('span', { class: 'tm-previa-select', text: e.opciones[0].nombre || 'Elige el tipo' }) : null);
  }

  // ---- paso 1: tipo
  function pasoTipo() {
    return h('div', { class: 'tm-tipos', role: 'radiogroup', 'aria-label': 'Cómo suma días' }, Object.entries(TIPOS).map(([k, t]) => h('button', {
      class: `tm-tipo-card${e.tipo === k ? ' tm-tipo-card--activa' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(e.tipo === k),
      onclick: () => { e.tipo = k; errores = {}; pintar(); }
    }, h('span', { class: 'tm-tipo-card-cab' }, chipTipo(k), h('span', { class: 'tm-radio', 'aria-hidden': 'true' })),
    h('strong', { text: t.nombre }), h('span', { class: 'tm-tenue', text: t.texto }), h('span', { class: `tm-tipo-ejemplo ${t.clase}`, text: t.ejemplo }))),
    errores.tipo ? h('p', { class: 'tm-pie tm-pie--error', text: errores.tipo }) : null);
  }

  // ---- paso 2: datos
  function pasoDatos() {
    const refrescar = () => {
      const viejo = cuerpo.querySelector('.tm-asistente-lado'); if (viejo) viejo.replaceWith(lado());
      // El rango «en adelante» empieza justo después del último que se escribió.
      const celda = cuerpo.querySelector('.tm-fila-convenir td');
      if (celda && e.tipo === 'por_cantidad') { const f = (e.opciones[opcion] || e.opciones[0]).rangos.filter(r => !r.aConvenir); const u = f[f.length - 1]; celda.textContent = u && esNum(u.hasta) ? String(u.hasta + 1) : '—'; }
    };
    const lado = () => h('div', { class: 'tm-asistente-lado' }, vistaPrevia(), cajaEjemplo());
    const comunes = [
      h('div', { class: 'tm-fila-2' },
        campo('Nombre', texto(e.nombre, (v) => { e.nombre = v; refrescar(); }, { max: 80, id: 'ax-nombre', error: 'nombre', placeholder: 'Ej. Empaque especial' }), pie(errores.nombre || 'Así aparece en la administración y en el resumen copiado.')),
        campo(e.tipo === 'por_unidades' ? 'Pregunta en la calculadora' : 'Texto en la calculadora', texto(e.etiqueta, (v) => { e.etiqueta = v; refrescar(); }, { max: 120, id: 'ax-etiqueta', error: 'etiqueta', placeholder: e.tipo === 'por_unidades' ? 'Ej. ¿Cuántos colores lleva?' : 'Ej. Lleva empaque especial' }),
          pie(errores.etiqueta || (e.tipo === 'si_no' ? 'Escríbelo como algo que se marca o no.' : 'Lo que ve quien calcula.'))))
    ];
    let propio = [];
    if (e.tipo === 'si_no') {
      propio = [h('div', { class: 'tm-fila-2' },
        campo('Días que suma', numero(e.diasFijos, (v) => { e.diasFijos = v; }, { etiqueta: 'Días que suma', id: 'ax-dias', error: 'diasFijos', refrescar }), pie(errores.diasFijos || 'Siempre los mismos, sin importar la cantidad.')),
        campo('Ayuda (opcional)', texto(e.ayuda, (v) => { e.ayuda = v; refrescar(); }, { max: 255, id: 'ax-ayuda', error: 'ayuda' }), pie(errores.ayuda || 'Una línea bajo el texto, para aclarar cuándo marcarlo.')))];
    } else if (e.tipo === 'por_unidades') {
      const u = e.unidades;
      const n = (k, etiqueta) => numero(u[k], (v) => { u[k] = v; }, { etiqueta, error: `unidades.${k}`, refrescar: () => { refrescar(); const t = cuerpo.querySelector('.tm-asi-suma'); if (t) t.replaceWith(tablaSuma()); } });
      const tablaSuma = () => {
        if (![u.incluidas, u.cada, u.dias, u.max].every(esNum) || u.cada < 1) return h('div', { class: 'tm-asi-suma tm-tenue', text: 'Completa la regla para ver cuánto suma.' });
        const grupos = []; for (let a = Math.max(1, u.incluidas === 0 ? 0 : 1); a <= u.max && grupos.length < 8;) { const b = a <= u.incluidas ? u.incluidas : Math.min(u.max, a + u.cada - 1); grupos.push([a, b, diasPorUnidades(u, b)]); a = b + 1; }
        return h('div', { class: 'tm-asi-suma' }, h('strong', { text: 'Así suma' }), h('div', { class: 'tm-asi-suma-fila' }, grupos.map(([a, b, d]) => h('span', null, h('small', { text: a === b ? String(a) : `${a}–${b}` }), h('b', { text: `+${d}` })))));
      };
      propio = [h('div', { class: 'tm-regla' }, h('strong', { text: 'Regla' }),
        h('div', { class: 'tm-regla-frase' }, 'Incluye', n('incluidas', 'Incluidas'), 'sin días extra; después, +', n('dias', 'Días por grupo'), 'día(s) cada', n('cada', 'Cada cuántas'), 'más.'),
        h('div', { class: 'tm-regla-frase' }, 'Se puede elegir hasta', n('max', 'Máximo'), '(máximo).'),
        ['unidades.incluidas', 'unidades.cada', 'unidades.dias', 'unidades.max'].filter(k => errores[k]).map(k => h('p', { class: 'tm-pie tm-pie--error', text: errores[k] }))),
      tablaSuma(),
      campo('Ayuda (opcional)', texto(e.ayuda, (v) => { e.ayuda = v; }, { max: 255, id: 'ax-ayuda', error: 'ayuda' }), pie(errores.ayuda || ''))];
    } else {
      const o = e.opciones[opcion] || e.opciones[0];
      const fijos = o.rangos.filter(r => !r.aConvenir);
      const ult = fijos[fijos.length - 1];
      propio = [
        campo('Aviso (opcional)', texto(e.aviso, (v) => { e.aviso = v; }, { max: 255, id: 'ax-aviso', error: 'aviso', placeholder: 'Ej. La tonalidad puede variar en producciones masivas.' }), pie(errores.aviso || 'Se muestra en el resultado cuando se elige este extra.')),
        h('div', { class: 'tm-seccion-cab' }, h('div', null, h('strong', { text: 'Opciones' }), h('span', { class: 'tm-tenue', text: ' Si hay más de una, quien calcula elige cuál.' })),
          h('button', { class: 'btn btn--ghost btn--chico', type: 'button', onclick: () => { e.opciones.push({ clave: '', nombre: '', aviso: '', rangos: rangosNuevos() }); opcion = e.opciones.length - 1; pintar(); } }, icono('add-outline'), 'Opción nueva')),
        h('div', { class: 'tm-pills' }, e.opciones.map((x, i) => h('button', { class: `tm-pill tm-pill--chica${i === opcion ? ' tm-pill--activa' : ''}${Object.keys(errores).some(k => k.startsWith(`opciones.${i}.`)) ? ' tm-pill--error' : ''}`, type: 'button', onclick: () => { opcion = i; pintar(); } }, x.nombre || (e.opciones.length === 1 ? (e.nombre || 'Opción única') : `Opción ${i + 1}`)))),
        e.opciones.length > 1 ? h('div', { class: 'tm-fila-2' },
          campo('Nombre de la opción', texto(o.nombre, (v) => { o.nombre = v; }, { max: 80, id: 'ax-op-nombre', error: `opciones.${opcion}.nombre` }), pie(errores[`opciones.${opcion}.nombre`] || '')),
          h('div', { class: 'tm-campo tm-campo--boton' }, h('button', { class: 'tm-enlace tm-enlace--peligro', type: 'button', onclick: () => { e.opciones.splice(opcion, 1); opcion = 0; errores = {}; pintar(); } }, 'Quitar esta opción'))) : null,
        h('div', { class: 'tm-tabla-caja' }, h('table', { class: 'tm-tabla tm-tabla--editable' },
          h('thead', null, h('tr', null, h('th', { text: 'Desde' }), h('th', { text: 'Hasta' }), h('th', { text: 'Suma (días)' }), h('th', { 'aria-label': 'Quitar' }))),
          h('tbody', null, fijos.map((r, i) => h('tr', null,
            ['desde', 'hasta', 'dias'].map(c => h('td', null, numero(r[c], (v) => { r[c] = v; }, { etiqueta: `${c} (rango ${i + 1})`, error: `opciones.${opcion}.${i}.${c}`, refrescar }))),
            h('td', null, h('button', { class: 'btn btn--ghost btn--solo-icono', type: 'button', 'aria-label': `Quitar el rango ${i + 1}`, onclick: () => { o.rangos.splice(o.rangos.indexOf(r), 1); errores = {}; pintar(); } }, icono('close-outline'))))),
          h('tr', { class: 'tm-fila-convenir' }, h('td', { text: ult && esNum(ult.hasta) ? String(ult.hasta + 1) : '—' }), h('td', { text: 'en adelante' }), h('td', { colspan: '2', text: 'A convenir' }))))),
        Object.entries(errores).filter(([k]) => k.startsWith(`opciones.${opcion}.`) && !/\.nombre$/.test(k)).map(([, m]) => h('p', { class: 'tm-pie tm-pie--error', text: m })),
        errores.opciones ? h('p', { class: 'tm-pie tm-pie--error', text: errores.opciones }) : null,
        h('button', { class: 'btn btn--ghost btn--chico', type: 'button', onclick: () => { o.rangos.splice(o.rangos.length - 1, 0, { desde: ult && esNum(ult.hasta) ? ult.hasta + 1 : 1, hasta: '', aConvenir: false, dias: '' }); pintar(); } }, icono('add-outline'), 'Agregar rango')
      ];
    }
    return h('div', { class: 'tm-asistente-columnas' }, h('div', { class: 'tm-asistente-principal' }, comunes, propio), lado());
  }

  // ---- paso 3: dónde se ofrece
  function pasoAlcance() {
    const a = e.alcance;
    const sacar = (lista, x) => { const i = lista.indexOf(x); if (i >= 0) lista.splice(i, 1); };
    const prodDe = (linea, cat) => datos.productos.filter(p => p.linea === linea && (p.categoria || null) === cat);
    const q = sinAcentos(filtroArbol);
    const pasa = (t) => !q || sinAcentos(t).includes(q);
    const caja = (marcado, parcial, deshabilitado, etiqueta, alCambiar) => {
      const c = h('input', { type: 'checkbox', disabled: deshabilitado || null, 'aria-label': etiqueta });
      c.checked = marcado; c.indeterminate = !marcado && parcial;
      c.addEventListener('change', () => { alCambiar(c.checked); pintar(); });
      return c;
    };
    const filas = [];
    for (const l of datos.lineas) {
      const lineaOn = a.lineas.includes(l.clave);
      const cats = datos.categorias.filter(c => c.linea === l.clave);
      const sueltos = prodDe(l.clave, null);
      const nodos = [];
      for (const c of cats) {
        const catOn = lineaOn || a.categorias.includes(c.clave);
        const prods = prodDe(l.clave, c.clave).filter(p => pasa(`${p.nombre} ${c.nombre}`));
        if (q && !prods.length && !pasa(c.nombre)) continue;
        const abierto = Boolean(q) || abiertos.has(c.clave);
        const marcados = prodDe(l.clave, c.clave).filter(p => catOn || a.productos.includes(p.clave)).length;
        nodos.push(h('li', { class: 'tm-arbol-nodo tm-arbol-nodo--cat' },
          h('div', { class: `tm-arbol-fila${catOn ? ' tm-arbol-fila--on' : ''}` },
            h('button', { class: 'tm-arbol-plegar', type: 'button', 'aria-expanded': String(abierto), 'aria-label': `${abierto ? 'Cerrar' : 'Abrir'} ${c.nombre}`, onclick: () => { if (abierto) abiertos.delete(c.clave); else abiertos.add(c.clave); pintar(); } }, icono(abierto ? 'chevron-down-outline' : 'chevron-forward-outline')),
            h('label', null, caja(catOn, marcados > 0, lineaOn, c.nombre, (v) => { if (v) { a.categorias.push(c.clave); prodDe(l.clave, c.clave).forEach(p => sacar(a.productos, p.clave)); } else sacar(a.categorias, c.clave); }), h('span', { text: c.nombre })),
            catOn && !lineaOn ? h('span', { class: 'tm-tenue', text: 'Toda la categoría' }) : null,
            h('span', { class: 'tm-arbol-cuenta', text: `${marcados} de ${prodDe(l.clave, c.clave).length}` })),
          abierto ? h('ul', null, prods.map(p => h('li', { class: 'tm-arbol-nodo tm-arbol-nodo--prod' }, h('label', { class: 'tm-arbol-fila' },
            caja(catOn || a.productos.includes(p.clave), false, catOn, p.nombre, (v) => { if (v) a.productos.push(p.clave); else sacar(a.productos, p.clave); }), h('span', { text: p.nombre }))))) : null));
      }
      for (const p of sueltos.filter(x => pasa(x.nombre))) {
        nodos.push(h('li', { class: 'tm-arbol-nodo tm-arbol-nodo--prod tm-arbol-nodo--suelto' }, h('label', { class: 'tm-arbol-fila' },
          caja(lineaOn || a.productos.includes(p.clave), false, lineaOn, p.nombre, (v) => { if (v) a.productos.push(p.clave); else sacar(a.productos, p.clave); }), h('span', { text: p.nombre }))));
      }
      if (q && !nodos.length && !pasa(l.nombre)) continue;
      const total = datos.productos.filter(p => p.linea === l.clave);
      const marcados = total.filter(p => aplica(e, p)).length;
      const abierta = Boolean(q) || abiertos.has(l.clave);
      filas.push(h('li', { class: 'tm-arbol-nodo' },
        h('div', { class: `tm-arbol-fila tm-arbol-fila--linea${lineaOn ? ' tm-arbol-fila--on' : ''}` },
          h('button', { class: 'tm-arbol-plegar', type: 'button', 'aria-expanded': String(abierta), 'aria-label': `${abierta ? 'Cerrar' : 'Abrir'} ${l.nombre}`, onclick: () => { if (abierta) abiertos.delete(l.clave); else abiertos.add(l.clave); pintar(); } }, icono(abierta ? 'chevron-down-outline' : 'chevron-forward-outline')),
          h('label', null, caja(lineaOn, marcados > 0, false, l.nombre, (v) => {
            if (v) { a.lineas.push(l.clave); cats.forEach(c => sacar(a.categorias, c.clave)); total.forEach(p => sacar(a.productos, p.clave)); } else sacar(a.lineas, l.clave);
          }), h('strong', { text: l.nombre })),
          lineaOn ? h('span', { class: 'tm-tenue', text: 'Toda la línea' }) : null,
          h('span', { class: 'tm-arbol-cuenta', text: `${marcados} de ${total.length}` })),
        abierta ? h('ul', null, nodos) : null));
    }
    const cuantos = datos.productos.filter(p => aplica(e, p)).length;
    const radio = (todos, tituloR, ayuda) => h('button', { class: `tm-opcion-radio${a.todos === todos ? ' tm-opcion-radio--activa' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(a.todos === todos), onclick: () => { a.todos = todos; errores = {}; pintar(); } },
      h('span', { class: 'tm-radio', 'aria-hidden': 'true' }), h('span', null, h('strong', { text: tituloR }), h('small', { text: ayuda })));
    const buscador = h('input', { type: 'search', class: 'tm-buscador', placeholder: 'Buscar categoría o producto…', value: filtroArbol, 'aria-label': 'Buscar categoría o producto' });
    buscador.addEventListener('input', () => { filtroArbol = buscador.value; pintar(); const b = cuerpo.querySelector('.tm-buscador'); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); } });
    return h('div', { class: 'tm-alcance' },
      h('div', { class: 'tm-fila-2', role: 'radiogroup', 'aria-label': 'Dónde se ofrece' }, radio(true, 'Todos los productos', 'También los que se creen después.'), radio(false, 'Elegir líneas, categorías o productos', 'Una línea o categoría completa, o productos sueltos.')),
      a.todos ? null : [buscador, h('ul', { class: 'tm-arbol' }, filas.length ? filas : h('li', { class: 'tm-tenue', text: 'Nada coincide con la búsqueda.' }))],
      errores.alcance ? h('p', { class: 'tm-pie tm-pie--error', role: 'alert', text: errores.alcance }) : null,
      h('div', { class: 'tm-resumen-alcance' }, a.todos ? 'Se ofrece en todos los productos, también en los que se creen después.'
        : `Se ofrece en ${cuantos} ${cuantos === 1 ? 'producto' : 'productos'}: ${textoAlcance(e, datos)}. Si marcas una línea o categoría completa, sus productos nuevos también lo tendrán.`));
  }

  // ---- paso 4: revisar
  function pasoRevisar() {
    const fila = (t, v) => h('div', { class: 'tm-revisar-fila' }, h('span', { class: 'tm-tenue', text: t }), h('strong', { text: v }));
    const lista = Object.entries(errores);
    return h('div', { class: 'tm-revisar' },
      lista.length ? h('div', { class: 'tm-aviso tm-aviso--error', role: 'alert' }, icono('alert-circle-outline'), h('div', null, h('strong', { text: 'Corrige esto antes de guardar' }),
        h('ul', null, lista.map(([k, m]) => h('li', null, m, ' ', h('button', { class: 'tm-enlace', type: 'button', onclick: () => { paso = k === 'alcance' ? 3 : 2; const o = /^opciones\.(\d+)\./.exec(k); if (o) opcion = Number(o[1]); pintar(); } }, 'Corregir')))))) : null,
      fila('Tipo', TIPOS[e.tipo].nombre), fila('Nombre', e.nombre), fila('En la calculadora', e.etiqueta), fila('Cómo suma', textoExtra(e)),
      e.tipo === 'por_cantidad' && e.opciones.length > 1 ? fila('Opciones', e.opciones.map(o => o.nombre).join(', ')) : null,
      fila('Dónde se ofrece', textoAlcance(e, datos)), fila('Estado', e.activo === false ? 'Oculto' : 'Visible en la calculadora al publicar'),
      cajaEjemplo());
  }

  // Revisión rápida del paso antes de avanzar (el servidor vuelve a validar todo al guardar).
  function revisarPaso() {
    errores = {};
    if (paso === 1 && !e.tipo) errores.tipo = 'Elige cómo suma días este extra.';
    if (paso === 2) {
      if (String(e.nombre).trim().length < 2) errores.nombre = 'Escribe el nombre (2 caracteres o más).';
      if (String(e.etiqueta).trim().length < 2) errores.etiqueta = 'Escribe el texto que verá quien calcula.';
      if (e.tipo === 'si_no' && !(esNum(e.diasFijos) && e.diasFijos >= 1)) errores.diasFijos = 'Escribe los días que suma (1 o más).';
      if (e.tipo === 'por_unidades') for (const k of ['incluidas', 'cada', 'dias', 'max']) if (!esNum(e.unidades[k])) errores[`unidades.${k}`] = 'Completa la regla con números enteros.';
      if (e.tipo === 'por_cantidad') e.opciones.forEach((o, i) => { if (e.opciones.length > 1 && String(o.nombre).trim().length < 2) errores[`opciones.${i}.nombre`] = `Escribe el nombre de la opción ${i + 1}.`; });
    }
    if (paso === 3 && !e.alcance.todos && !(e.alcance.lineas.length + e.alcance.categorias.length + e.alcance.productos.length)) errores.alcance = 'Marca al menos una línea, categoría o producto, o elige «Todos los productos».';
    return !Object.keys(errores).length;
  }

  // Lo que se manda: una opción única toma el nombre del extra; el último rango de cada opción empieza tras el anterior.
  function paraGuardar() {
    const x = copia(e);
    x.nombre = x.nombre.trim(); x.etiqueta = x.etiqueta.trim();
    if (x.tipo === 'por_cantidad') {
      if (x.opciones.length === 1 && !String(x.opciones[0].nombre).trim()) x.opciones[0].nombre = x.nombre;
      for (const o of x.opciones) { const f = o.rangos.filter(r => !r.aConvenir); const ab = o.rangos[o.rangos.length - 1]; if (ab && ab.aConvenir && f.length && esNum(f[f.length - 1].hasta)) ab.desde = f[f.length - 1].hasta + 1; }
    } else x.opciones = [];
    return x;
  }

  async function avanzar() {
    if (paso < 4) { if (revisarPaso()) paso++; pintar(); return; }
    siguiente.disabled = true;
    try { await alGuardar(paraGuardar()); cerrar(); } catch (error) {
      errores = error.campos || { general: error.message };
      siguiente.disabled = false; pintar();
    }
  }

  function pintar() {
    titulo.textContent = nuevo ? 'Extra nuevo' : `Editar «${extra.nombre}»`;
    sub.textContent = `Paso ${paso} de 4 · ${['¿Cómo suma días este extra?', 'Datos del extra', '¿En qué productos aparece este extra?', 'Revisa antes de guardar'][paso - 1]}`;
    pasos.replaceChildren(...PASOS.map((p, i) => h('li', { class: `tm-paso${i + 1 === paso ? ' tm-paso--activo' : ''}${i + 1 < paso ? ' tm-paso--hecho' : ''}`, 'aria-current': i + 1 === paso ? 'step' : null },
      h('span', { class: 'tm-paso-n' }, i + 1 < paso ? icono('checkmark-outline') : String(i + 1)), h('span', { text: p }))));
    cuerpo.replaceChildren(...[paso === 1 ? pasoTipo() : paso === 2 ? pasoDatos() : paso === 3 ? pasoAlcance() : pasoRevisar()].flat().filter(Boolean));
    pieIzq.textContent = paso === 1 ? 'Podrás cambiar los datos después; el tipo no.' : (paso === 3 ? 'Marcar una línea o categoría incluye sus productos futuros.' : (errores.general || ''));
    atras.textContent = paso > (nuevo ? 1 : 2) ? 'Atrás' : 'Cancelar';
    atras.onclick = () => { if (paso > (nuevo ? 1 : 2)) { paso--; errores = {}; pintar(); } else cerrar(); };
    siguiente.textContent = paso === 4 ? 'Guardar extra' : 'Siguiente';
  }

  siguiente.addEventListener('click', avanzar);
  document.getElementById('modals-root').append(fondo);
  document.addEventListener('keydown', alTecla);
  pintar();
  siguiente.focus();
}
