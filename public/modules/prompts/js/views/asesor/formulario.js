// Vista del asesor: formulario dinámico, resumen, pie de imagen y generación.
// Nada se guarda: el estado vive en memoria y las imágenes no salen del navegador.
import { h, icono } from '../../utils/dom.js';
import { listarProductos, obtenerContacto, generarPrompt } from '../../api/promptsApi.js';
import { confirmarModal } from '../../components/modal.js';
import {
  indexarEsquema, crearEstado, liberarArchivos, hayCambios, esVisible,
  crearCampo, validarCampo, formatearValor
} from './campos.js';
import { renderResultado } from './resultado.js';

let ctx = null;
let liberarResultado = null;

// Libera URLs de objeto de las imágenes y de la vista de resultado.
export function liberarAsesor() {
  if (liberarResultado) { liberarResultado(); liberarResultado = null; }
  if (ctx) { liberarArchivos(ctx.estado); ctx = null; }
}

export async function cargarAsesor(cont) {
  const [productos, contacto] = await Promise.all([listarProductos(), obtenerContacto()]);
  if (!productos.length) {
    cont.replaceChildren(h('div', { class: 'buzon-vacio' }, icono('cube-outline'),
      h('p', { text: 'Todavía no hay productos disponibles. Pídele al administrador que active uno.' })));
    return;
  }
  ctx = { cont, productos, contacto, producto: null, indice: null, estado: null, campos: {}, grupos: [], enviando: false };
  seleccionarProducto(productos[0]);
  renderFormulario();
}

function seleccionarProducto(producto) {
  ctx.producto = producto;
  ctx.indice = indexarEsquema(producto.version.esquema);
  ctx.estado = crearEstado(ctx.indice);
}

async function cambiarProducto(producto) {
  if (producto.id === ctx.producto.id) return;
  if (hayCambios(ctx.estado, ctx.indice)) {
    const ok = await confirmarModal({
      title: 'Cambiar de producto',
      mensaje: 'Perderás lo que ya completaste, incluidas las imágenes. ¿Quieres continuar?',
      aceptar: 'Cambiar de producto'
    });
    if (!ok) return;
  }
  liberarArchivos(ctx.estado);
  seleccionarProducto(producto);
  renderFormulario();
}

// ---------- Render ----------
function renderFormulario() {
  const { cont, indice, estado, producto, contacto } = ctx;
  ctx.campos = {};
  ctx.grupos = [];
  const campoCtx = { indice, estado, alCambiar };

  const tarjetas = (producto.version.esquema.grupos || []).map((g) => {
    const campos = (g.parametros || []).map((p) => {
      const campo = crearCampo(p, campoCtx);
      ctx.campos[p.clave] = campo;
      return campo.el;
    });
    const tarjeta = h('section', { class: 'pr-card', 'data-grupo': g.clave },
      h('h3', { class: 'pr-card-titulo', text: g.etiqueta }),
      g.descripcion ? h('p', { class: 'pr-card-sub', text: g.descripcion }) : null,
      h('div', { class: 'pr-campos' }, campos));
    ctx.grupos.push({ g, tarjeta });
    return tarjeta;
  });

  ctx.resumen = h('ul', { class: 'pr-resumen', id: 'pr-resumen' });
  ctx.btnGenerar = h('button', { type: 'button', class: 'btn btn--primary btn--lg', id: 'pr-generar', onclick: () => generar(false) },
    icono('sparkles-outline'), ' Generar prompt');

  const chips = ctx.productos.map(pr => h('button', {
    type: 'button', class: `pr-chip${pr.id === producto.id ? ' is-activo' : ''}`, role: 'radio',
    'aria-checked': String(pr.id === producto.id), text: pr.nombre, onclick: () => cambiarProducto(pr)
  }));

  cont.replaceChildren(
    h('div', { class: 'panel-toolbar' },
      h('div', null,
        h('h2', { text: 'Nueva propuesta' }),
        h('p', { class: 'pr-subtitulo', text: 'Completa los datos y genera un prompt listo para pegar en tu generador de imágenes (Gemini).' })),
      h('div', { class: 'pr-selector-producto' },
        h('span', { class: 'pr-etiqueta-chip', text: 'PRODUCTO' }),
        h('div', { class: 'pr-chips', role: 'radiogroup', 'aria-label': 'Producto' }, chips))),
    h('div', { class: 'pr-layout' },
      h('div', { class: 'pr-columna-form' }, tarjetas),
      h('aside', { class: 'pr-lateral' },
        h('section', { class: 'pr-card' }, h('h3', { class: 'pr-card-titulo', text: 'Resumen' }), ctx.resumen),
        h('section', { class: 'pr-card' }, h('h3', { class: 'pr-card-titulo', text: 'Pie de la imagen' }), construirPie(contacto)),
        h('div', { class: 'pr-generar' }, ctx.btnGenerar),
        h('p', { class: 'pr-nota', text: 'Cada prompt es una instrucción nueva: la IA debe ignorar cualquier propuesta anterior. Pégalo en un chat nuevo.' }))));

  refrescarTodo();
}

function construirPie(contacto) {
  return h('div', { class: 'pr-pie' },
    h('div', { class: 'pr-pie-datos' },
      h('strong', { text: contacto.nombre }),
      contacto.telefono ? h('span', { text: contacto.telefono }) : null,
      h('span', { text: contacto.email })),
    contacto.telefono ? null : h('p', { class: 'pr-pie-nota', text: 'Tu perfil no tiene teléfono: se te preguntará antes de generar.' }));
}

function alCambiar(clave) {
  if (ctx.campos[clave]) ctx.campos[clave].setError('');
  refrescarTodo();
}

function refrescarTodo() {
  const { indice, estado } = ctx;
  for (const p of indice.lista) {
    const campo = ctx.campos[p.clave];
    campo.refrescar();
    if (!esVisible(p, estado.valores)) campo.setError(''); // lo oculto no se valida
  }
  for (const { g, tarjeta } of ctx.grupos) {
    tarjeta.style.display = (g.parametros || []).some(p => esVisible(p, estado.valores)) ? '' : 'none';
  }
  pintarResumen();
}

function pintarResumen() {
  const { indice, estado } = ctx;
  const filas = indice.lista
    .filter(p => esVisible(p, estado.valores))
    .map(p => [p.etiqueta, formatearValor(p, indice, estado)])
    .filter(([, valor]) => valor);
  ctx.resumen.replaceChildren(...(filas.length
    ? filas.map(([etiqueta, valor]) => h('li', { class: 'pr-resumen-fila' },
      h('span', { class: 'pr-resumen-etiqueta', text: etiqueta }),
      h('strong', { class: 'pr-resumen-valor', text: valor, title: valor })))
    : [h('li', { class: 'form-hint', text: 'Aún no has completado datos.' })]));
}

// ---------- Validación y envío ----------
function validarTodo() {
  const errores = {};
  for (const p of ctx.indice.lista) {
    if (!esVisible(p, ctx.estado.valores)) continue;
    const mensaje = validarCampo(p, ctx.estado);
    if (mensaje) errores[p.clave] = mensaje;
  }
  return errores;
}

// Pinta errores por campo y lleva al primero (orden del esquema); devuelve cuántos se mostraron.
function mostrarErrores(errores) {
  let primero = null;
  for (const p of ctx.indice.lista) {
    const mensaje = errores[p.clave];
    ctx.campos[p.clave].setError(mensaje || '');
    if (mensaje && !primero) primero = ctx.campos[p.clave];
  }
  if (primero) {
    primero.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const control = primero.el.querySelector('input:not([type="file"]), textarea, select, button');
    if (control) control.focus({ preventScroll: true });
  }
  return primero ? 1 : 0;
}

function construirPayload(sinTelefono) {
  const { indice, estado } = ctx;
  const valores = {};
  const imagenes = {};
  for (const p of indice.lista) {
    if (!esVisible(p, estado.valores)) continue;
    const v = estado.valores[p.clave];
    if (p.tipo === 'texto' || p.tipo === 'texto_largo') { const t = String(v || '').trim(); if (t) valores[p.clave] = t; }
    else if (p.tipo === 'numero') { if (v !== '') valores[p.clave] = Number(v); }
    else if (p.tipo === 'opciones') { if (v) valores[p.clave] = v; }
    else if (p.tipo === 'si_no') valores[p.clave] = !!v;
    else if (p.tipo === 'imagenes') {
      const items = estado.archivos[p.clave].map((a) => {
        const item = { nombre: a.file.name };
        const descripcion = a.descripcion.trim();
        if (descripcion) item.descripcion = descripcion;
        if (a.ubicacion) item.ubicacion = a.ubicacion;
        return item;
      });
      if (items.length) imagenes[p.clave] = items;
    }
  }
  return { productoId: ctx.producto.id, valores, imagenes, sinTelefono };
}

async function generar(sinTelefono) {
  if (ctx.enviando) return;
  const errores = validarTodo();
  if (Object.keys(errores).length) {
    mostrarErrores(errores);
    window.toast.warning('Revisa el formulario', 'Hay campos por completar o corregir.');
    return;
  }
  const mio = ctx;
  let repetirSinTelefono = false;
  ctx.enviando = true;
  ctx.btnGenerar.classList.add('btn--loading');
  ctx.btnGenerar.disabled = true;
  try {
    const resultado = await generarPrompt(construirPayload(sinTelefono));
    if (ctx !== mio) return; // el usuario cambió de pestaña mientras tanto
    mostrarResultado(resultado);
  } catch (error) {
    if (ctx !== mio) return;
    if (error.codigo === 'TELEFONO_FALTANTE') repetirSinTelefono = true;
    else manejarErrorServidor(error);
  } finally {
    mio.enviando = false;
    mio.btnGenerar.classList.remove('btn--loading');
    mio.btnGenerar.disabled = false;
  }
  if (repetirSinTelefono && await confirmarModal({
    title: 'Falta tu número de teléfono',
    mensaje: 'Tu perfil no tiene teléfono. ¿Quieres generar el prompt sin número? El pie de la imagen saldrá solo con tu nombre y tu correo.',
    aceptar: 'Generar sin número'
  }) && ctx === mio) generar(true);
}

function manejarErrorServidor(error) {
  const campos = error.campos || {};
  const conocidos = Object.keys(campos).filter(k => ctx.campos[k]);
  if (conocidos.length) {
    mostrarErrores(campos);
    window.toast.error('Revisa el formulario', error.message);
  } else {
    window.toast.error('No se pudo generar el prompt', error.message);
  }
}

function mostrarResultado(resultado) {
  liberarResultado = renderResultado(ctx.cont, {
    producto: ctx.producto,
    indice: ctx.indice,
    estado: ctx.estado,
    resultado,
    alEditar: () => {
      if (liberarResultado) { liberarResultado(); liberarResultado = null; }
      renderFormulario();
      window.scrollTo({ top: 0 });
    }
  });
  window.scrollTo({ top: 0 });
}
