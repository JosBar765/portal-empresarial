// Vista del asesor: formulario dinámico, resumen, pie de imagen y generación.
// Nada se guarda: el estado vive en memoria y las imágenes no salen del navegador.
import { h, icono } from '../../utils/dom.js';
import { t } from '../../textos.js';
import { cargarConfig } from '../../config.js';
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

function mostrarErrorCarga(cont, error) {
  cont.replaceChildren(h('div', { class: 'buzon-vacio buzon-vacio-error' }, icono('alert-circle-outline'),
    h('h3', { text: t('asesor.formulario.cargaTitulo') }),
    h('p', { text: error.message }),
    h('p', { text: t('asesor.errores.cargaAyuda') }),
    h('button', { type: 'button', class: 'btn btn--primary pr-reintentar', id: 'pr-reintentar', text: t('comun.reintentar'), onclick: () => cargarAsesor(cont, true) })));
}

export async function cargarAsesor(cont, recargarConfig = false) {
  if (recargarConfig) cont.replaceChildren(h('div', { class: 'buzon-vacio' }, h('ion-icon', { name: 'sync-outline', class: 'spin-animation' }), h('p', { text: t('comun.cargando') })));
  let config, productos, contacto;
  try {
    [config, productos, contacto] = await Promise.all([cargarConfig(recargarConfig), listarProductos(), obtenerContacto()]);
  } catch (error) {
    mostrarErrorCarga(cont, error);
    return;
  }
  if (!productos.length) {
    cont.replaceChildren(h('div', { class: 'buzon-vacio' }, icono('cube-outline'),
      h('p', { text: t('asesor.formulario.sinProductos') })));
    return;
  }
  ctx = { cont, config, productos, contacto, producto: null, indice: null, estado: null, campos: {}, grupos: [], enviando: false };
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
      title: t('asesor.formulario.cambiarProducto.titulo'),
      mensaje: t('asesor.formulario.cambiarProducto.mensaje'),
      aceptar: t('asesor.formulario.cambiarProducto.aceptar'),
      cancelar: t('comun.cancelar')
    });
    if (!ok) return;
  }
  liberarArchivos(ctx.estado);
  seleccionarProducto(producto);
  renderFormulario();
}

// ---------- Render ----------
function renderFormulario() {
  const { cont, indice, estado, producto, contacto, config } = ctx;
  ctx.campos = {};
  ctx.grupos = [];
  const campoCtx = { indice, estado, config, alCambiar };

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
    icono('sparkles-outline'), ` ${t('asesor.formulario.generar')}`);

  const chips = ctx.productos.map(pr => h('button', {
    type: 'button', class: `pr-chip${pr.id === producto.id ? ' is-activo' : ''}`, role: 'radio',
    'aria-checked': String(pr.id === producto.id), text: pr.nombre, onclick: () => cambiarProducto(pr)
  }));

  cont.replaceChildren(
    h('div', { class: 'panel-toolbar' },
      h('div', null,
        h('h2', { text: t('asesor.formulario.titulo') }),
        h('p', { class: 'pr-subtitulo', text: t('asesor.formulario.subtitulo') })),
      h('div', { class: 'pr-selector-producto' },
        h('span', { class: 'pr-etiqueta-chip', text: t('asesor.formulario.producto') }),
        h('div', { class: 'pr-chips', role: 'radiogroup', 'aria-label': t('asesor.formulario.productoAria') }, chips))),
    h('div', { class: 'pr-layout' },
      h('div', { class: 'pr-columna-form' }, tarjetas),
      h('aside', { class: 'pr-lateral' },
        h('section', { class: 'pr-card' }, h('h3', { class: 'pr-card-titulo', text: t('asesor.formulario.resumen') }), ctx.resumen),
        h('section', { class: 'pr-card' }, h('h3', { class: 'pr-card-titulo', text: t('asesor.formulario.pie') }), construirPie(contacto)),
        h('div', { class: 'pr-generar' }, ctx.btnGenerar),
        h('p', { class: 'pr-nota', text: config.textosAsesor.nota_prompt_nuevo }))));

  refrescarTodo();
}

function construirPie(contacto) {
  return h('div', { class: 'pr-pie' },
    h('div', { class: 'pr-pie-datos' },
      h('strong', { text: contacto.nombre }),
      contacto.telefono ? h('span', { text: contacto.telefono }) : null,
      h('span', { text: contacto.email })),
    contacto.telefono ? null : h('p', { class: 'pr-pie-nota', text: t('asesor.formulario.pieSinTelefono') }));
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
  const { indice, estado, config } = ctx;
  const filas = indice.lista
    .filter(p => esVisible(p, estado.valores))
    .map(p => [p.etiqueta, formatearValor(p, indice, estado, config)])
    .filter(([, valor]) => valor);
  ctx.resumen.replaceChildren(...(filas.length
    ? filas.map(([etiqueta, valor]) => h('li', { class: 'pr-resumen-fila' },
      h('span', { class: 'pr-resumen-etiqueta', text: etiqueta }),
      h('strong', { class: 'pr-resumen-valor', text: valor, title: valor })))
    : [h('li', { class: 'form-hint', text: t('asesor.formulario.resumenVacio') })]));
}

// ---------- Validación y envío ----------
function validarTodo() {
  const errores = {};
  for (const p of ctx.indice.lista) {
    if (!esVisible(p, ctx.estado.valores)) continue;
    const mensaje = validarCampo(p, ctx.estado, ctx.config);
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
    if (p.tipo === 'texto' || p.tipo === 'texto_largo') { const texto = String(v || '').trim(); if (texto) valores[p.clave] = texto; }
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
  const campos = Object.keys(errores);
  if (campos.length) {
    mostrarErrores(errores);
    window.toast.warning(t('asesor.formulario.toastRevisar'), errores[campos[0]]);
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
    title: t('asesor.formulario.sinTelefono.titulo'),
    mensaje: t('asesor.formulario.sinTelefono.mensaje'),
    aceptar: t('asesor.formulario.sinTelefono.aceptar'),
    cancelar: t('comun.cancelar')
  }) && ctx === mio) generar(true);
}

function manejarErrorServidor(error) {
  const campos = error.campos || {};
  const conocidos = Object.keys(campos).filter(k => ctx.campos[k]);
  if (conocidos.length) {
    mostrarErrores(campos);
    window.toast.error(t('asesor.formulario.toastRevisar'), error.message);
  } else {
    window.toast.error(t('asesor.formulario.toastNoGenerado'), error.message);
  }
}

function mostrarResultado(resultado) {
  liberarResultado = renderResultado(ctx.cont, {
    producto: ctx.producto,
    indice: ctx.indice,
    estado: ctx.estado,
    config: ctx.config,
    resultado,
    alEditar: () => {
      if (liberarResultado) { liberarResultado(); liberarResultado = null; }
      renderFormulario();
      window.scrollTo({ top: 0 });
    }
  });
  window.scrollTo({ top: 0 });
}
