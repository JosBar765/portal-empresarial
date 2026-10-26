// Campos dinámicos del formulario del asesor, según el esquema del producto.
// El estado vive solo en memoria: { valores: {clave: valor}, archivos: {clave: [{file, url, descripcion, ubicacion}]} }.
// Límites y formatos llegan en `config` (GET /api/prompts/config); aquí no hay reglas de negocio fijas.
import { h, icono } from '../../utils/dom.js';
import { t } from '../../textos.js';
import { mimeAExtension, reglasImagenes, validarArchivo, validarDescripciones, listaConO } from './archivos.js';

const LIMITE_TEXTO = { texto: 'texto_max_largo_defecto', texto_largo: 'texto_largo_max_largo_defecto' };

// ---------- Esquema y estado ----------
export function indexarEsquema(esquema) {
  const lista = [];
  const porClave = {};
  const grupoDe = {};
  for (const g of (esquema && esquema.grupos) || []) {
    for (const p of g.parametros || []) {
      lista.push(p);
      porClave[p.clave] = p;
      grupoDe[p.clave] = g;
    }
  }
  return { lista, porClave, grupoDe };
}

function valorInicial(p) {
  if (p.tipo === 'si_no') return p.defecto === true;
  if (p.defecto == null) return '';
  return String(p.defecto); // números como texto: así se compara igual que lo que escribe el usuario
}

export function crearEstado(indice) {
  const estado = { valores: {}, archivos: {} };
  for (const p of indice.lista) {
    if (p.tipo === 'imagenes') estado.archivos[p.clave] = [];
    else if (p.tipo !== 'calculado') estado.valores[p.clave] = valorInicial(p);
  }
  return estado;
}

export function liberarArchivos(estado) {
  for (const lista of Object.values(estado.archivos)) lista.forEach(a => URL.revokeObjectURL(a.url));
}

export function hayCambios(estado, indice) {
  if (Object.values(estado.archivos).some(l => l.length)) return true;
  return indice.lista.some(p => p.clave in estado.valores && estado.valores[p.clave] !== valorInicial(p));
}

export function esVisible(p, valores) {
  return !p.visible_si || valores[p.visible_si.parametro] === p.visible_si.igual;
}

function etiquetaUnidad(p, indice, estado) {
  const origen = p.unidad_de && indice.porClave[p.unidad_de];
  if (!origen) return '';
  const opcion = (origen.opciones || []).find(o => o.valor === estado.valores[origen.clave]);
  return opcion ? opcion.etiqueta : '';
}

// Texto legible del valor de un parámetro ('' si no tiene valor).
export function formatearValor(p, indice, estado, config) {
  const v = estado.valores[p.clave];
  switch (p.tipo) {
    case 'texto':
    case 'texto_largo': return String(v || '').trim();
    case 'numero': return v === '' || v == null ? '' : `${v} ${etiquetaUnidad(p, indice, estado)}`.trim();
    case 'opciones': { const o = (p.opciones || []).find(x => x.valor === v); return o ? o.etiqueta : ''; }
    case 'si_no': return t(v ? 'comun.si' : 'comun.no');
    case 'imagenes': { const n = estado.archivos[p.clave].length; return n ? t('asesor.campos.contador', { n, max: reglasImagenes(p, config).max }) : ''; }
    case 'calculado': {
      const ref = indice.porClave[p.igual_a];
      return ref && ref.tipo !== 'calculado' ? formatearValor(ref, indice, estado, config) : '';
    }
    default: return '';
  }
}

// Mismas reglas que el contrato (sección 2); el servidor vuelve a validar.
export function validarCampo(p, estado, config) {
  const v = estado.valores[p.clave];
  const etiqueta = p.etiqueta;
  switch (p.tipo) {
    case 'texto':
    case 'texto_largo': {
      const texto = String(v || '').trim();
      if (!texto) return p.requerido ? t('asesor.errores.requerido', { etiqueta }) : '';
      const max = p.max_largo || config.limites[LIMITE_TEXTO[p.tipo]];
      return texto.length > max ? t('asesor.errores.textoLargo', { etiqueta, largo: texto.length, max, exceso: texto.length - max }) : '';
    }
    case 'numero': {
      if (v === '' || v == null) return p.requerido ? t('asesor.errores.numeroRequerido', { etiqueta }) : '';
      const n = Number(v);
      if (!Number.isFinite(n)) return t('asesor.errores.numeroInvalido', { etiqueta });
      if (p.min != null && n < p.min) return t('asesor.errores.numeroMin', { etiqueta, min: p.min, valor: n });
      if (p.max != null && n > p.max) return t('asesor.errores.numeroMax', { etiqueta, max: p.max, valor: n });
      return '';
    }
    case 'opciones': return !v && p.requerido ? t('asesor.errores.opcionRequerida', { etiqueta }) : '';
    case 'imagenes': {
      const archivos = estado.archivos[p.clave];
      const r = reglasImagenes(p, config);
      if (archivos.length === 0) return p.requerido ? t('asesor.errores.imagenesRequeridas', { etiqueta }) : '';
      if (archivos.length > r.max) return t('asesor.errores.imagenesExceso', { etiqueta, n: archivos.length, max: r.max });
      const falta = validarDescripciones(p, archivos);
      if (falta) return falta;
      const larga = archivos.find(a => a.descripcion.trim().length > r.maxDescripcion);
      return larga ? t('asesor.errores.descripcionLarga', { etiqueta, archivo: larga.file.name, largo: larga.descripcion.trim().length, max: r.maxDescripcion }) : '';
    }
    default: return '';
  }
}

// ---------- Controles por tipo ----------
function segmentado(opciones, leer, escribir) {
  const botones = opciones.map(o => h('button', {
    type: 'button', class: 'pr-seg', role: 'radio', text: o.etiqueta, onclick: () => escribir(o.valor)
  }));
  const pintar = () => botones.forEach((b, i) => {
    const activo = leer() === opciones[i].valor;
    b.classList.toggle('is-activo', activo);
    b.setAttribute('aria-checked', String(activo));
  });
  pintar();
  return { nodo: h('div', { class: 'pr-segmentado', role: 'radiogroup' }, botones), refrescar: pintar };
}

function tarjetas(p, leer, escribir) {
  const botones = p.opciones.map(o => h('button', {
    type: 'button', class: 'pr-opcion', role: 'radio', onclick: () => escribir(o.valor)
  }, h('span', { text: o.etiqueta })));
  const pintar = () => botones.forEach((b, i) => {
    const activo = leer() === p.opciones[i].valor;
    b.classList.toggle('is-activo', activo);
    b.setAttribute('aria-checked', String(activo));
  });
  pintar();
  return { nodo: h('div', { class: 'pr-opciones', role: 'radiogroup' }, botones), refrescar: pintar };
}

function construirOpciones(p, ctx, id) {
  const { estado, indice } = ctx;
  const leer = () => estado.valores[p.clave];
  const escribir = (v) => { estado.valores[p.clave] = v; ctx.alCambiar(p.clave); };
  const esUnidad = indice.lista.some(q => q.unidad_de === p.clave);
  const opciones = p.opciones || [];
  if (esUnidad) return segmentado(opciones, leer, escribir);
  if (opciones.length <= 3) return tarjetas(p, leer, escribir);
  const select = h('select', { id, onchange: () => escribir(select.value) },
    h('option', { value: '', text: t('asesor.campos.seleccionaOpcion') }),
    opciones.map(o => h('option', { value: o.valor, text: o.etiqueta })));
  select.value = leer();
  return { nodo: select, usaInput: true, refrescar: () => { select.value = leer(); } };
}

let zonaActiva = null; // recuadro bajo el cursor o con foco: destino del Ctrl+V
let contadorPegadas = 0;

// El portapapeles entrega capturas como «image.png»: se renombran para distinguirlas en la lista.
function nombrarPegada(f, extPorMime) {
  if (f.name && !/^image\.\w+$/i.test(f.name)) return f;
  const ext = extPorMime[f.type] || f.type.split('/')[1].split('+')[0];
  return new File([f], t('asesor.campos.imagenPegada', { n: ++contadorPegadas, ext }), { type: f.type });
}

document.addEventListener('paste', (e) => {
  if (!zonaActiva || !zonaActiva.isConnected) return;
  const imagenes = Array.from(e.clipboardData?.files || []).filter(f => f.type.startsWith('image/'));
  if (!imagenes.length) return;
  e.preventDefault();
  zonaActiva.pegar(imagenes);
});

// Tarjeta de una imagen subida: edita descripción y ubicación sobre el mismo objeto, sin reconstruir la grilla.
function tarjetaImagen(p, item, n, r, alQuitar) {
  const base = `pr-img-${p.clave}-${n}`;
  const listaId = `${base}-lista`;
  const sugerencias = Array.isArray(p.sugerencias) ? p.sugerencias : [];
  const ubicaciones = Array.isArray(p.ubicaciones) ? p.ubicaciones : [];
  const archivo = item.file.name;

  const desc = h('input', {
    type: 'text', id: `${base}-desc`, class: 'pr-img-campo', autocomplete: 'off', maxlength: String(r.maxDescripcion),
    placeholder: t('asesor.campos.descripcionEjemplo'), 'aria-required': p.descripcion_requerida ? 'true' : null, 'aria-label': t('asesor.campos.descripcionAria', { archivo }), list: sugerencias.length ? listaId : null
  });
  desc.value = item.descripcion;
  desc.addEventListener('input', () => { item.descripcion = desc.value; });

  let selector = null;
  if (ubicaciones.length) {
    selector = h('select', { id: `${base}-ubic`, class: 'pr-img-campo', 'aria-label': t('asesor.campos.ubicacionAria', { archivo }) },
      h('option', { value: '', text: t('asesor.campos.sinUbicacion') }),
      ubicaciones.map(u => h('option', { value: u, text: u })));
    selector.value = item.ubicacion;
    selector.addEventListener('change', () => { item.ubicacion = selector.value; });
  }

  return h('div', { class: 'pr-img-item' },
    h('div', { class: 'pr-img-item-cab' },
      h('div', { class: 'pr-miniatura-img' }, h('img', { src: item.url, alt: '' })),
      h('span', { class: 'pr-miniatura-nombre', text: archivo, title: archivo })),
    h('button', { type: 'button', class: 'pr-miniatura-quitar', 'aria-label': t('asesor.campos.quitar', { archivo }), text: '×', onclick: alQuitar }),
    h('label', { class: 'pr-img-etiqueta', for: `${base}-desc`, text: t(p.descripcion_requerida ? 'asesor.campos.descripcionObligatoria' : 'asesor.campos.descripcionEtiqueta') }),
    desc,
    sugerencias.length ? h('datalist', { id: listaId }, sugerencias.map(s => h('option', { value: s }))) : null,
    selector ? h('label', { class: 'pr-img-etiqueta', for: `${base}-ubic`, text: t('asesor.campos.ubicacionEtiqueta') }) : null,
    selector);
}

function construirImagenes(p, ctx, id) {
  const { estado, config } = ctx;
  const r = reglasImagenes(p, config);
  const extPorMime = mimeAExtension(config.formatosImagen);
  const lista = () => estado.archivos[p.clave];

  const input = h('input', { type: 'file', id, class: 'pr-file-input', multiple: true, tabindex: '-1', accept: r.extensiones.map(e => `.${e}`).join(',') });
  const zona = h('div', { class: 'pr-dropzone', role: 'button', tabindex: '0', 'aria-controls': id },
    icono('cloud-upload-outline'),
    h('strong', { text: t('asesor.campos.zonaTitulo') }),
    h('span', { class: 'form-hint', text: t('asesor.campos.zonaAyuda', { max: r.max, formatos: listaConO(r.formatos), maxMb: r.maxMb }) }));
  const grilla = h('div', { class: 'pr-miniaturas' });
  const contador = h('span', { class: 'pr-contador' });

  function agregar(archivos) {
    for (const f of archivos) {
      const motivo = validarArchivo(f, p, config, lista().length);
      if (motivo) {
        window.toast.warning(t('asesor.campos.archivoRechazado'), motivo);
        if (lista().length >= r.max) break; // con el límite alcanzado el resto tampoco cabe
        continue;
      }
      lista().push({ file: f, url: URL.createObjectURL(f), descripcion: '', ubicacion: '' });
    }
    ctx.alCambiar(p.clave);
  }

  function quitar(i) {
    const [quitado] = lista().splice(i, 1);
    URL.revokeObjectURL(quitado.url);
    ctx.alCambiar(p.clave);
  }

  const abrirSelector = () => { if (lista().length < r.max) input.click(); };
  zona.addEventListener('click', abrirSelector);
  zona.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirSelector(); } });
  input.addEventListener('change', () => { agregar(Array.from(input.files)); input.value = ''; });
  zona.addEventListener('dragover', (e) => { e.preventDefault(); if (lista().length < r.max) zona.classList.add('is-arrastre'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('is-arrastre'));
  zona.addEventListener('drop', (e) => {
    e.preventDefault();
    zona.classList.remove('is-arrastre');
    if (lista().length < r.max) agregar(Array.from(e.dataTransfer.files));
  });
  zona.pegar = (archivos) => agregar(archivos.map(f => nombrarPegada(f, extPorMime)));
  zona.addEventListener('mouseenter', () => { zonaActiva = zona; });
  zona.addEventListener('focus', () => { zonaActiva = zona; });
  zona.addEventListener('mouseleave', () => { if (zonaActiva === zona && document.activeElement !== zona) zonaActiva = null; });
  zona.addEventListener('blur', () => { if (zonaActiva === zona) zonaActiva = null; });

  let firma = null; // evita reconstruir las miniaturas si la lista no cambió
  const refrescar = () => {
    const lleno = lista().length >= r.max;
    zona.classList.toggle('is-deshabilitada', lleno);
    zona.setAttribute('aria-disabled', String(lleno));
    input.disabled = lleno;
    contador.textContent = t('asesor.campos.contador', { n: lista().length, max: r.max });
    const nueva = lista().map(a => a.url).join('|');
    if (nueva === firma) return;
    firma = nueva;
    grilla.replaceChildren(...lista().map((a, i) => tarjetaImagen(p, a, i, r, () => quitar(i))));
  };
  refrescar();
  return { nodo: h('div', { class: 'pr-imagenes' }, zona, input, grilla), extra: contador, refrescar };
}

function construirCalculado(p, ctx, id) {
  const input = h('input', { type: 'text', id, disabled: true });
  const origen = ctx.indice.porClave[p.igual_a];
  const refrescar = () => { input.value = formatearValor(p, ctx.indice, ctx.estado, ctx.config); };
  refrescar();
  return { nodo: input, usaInput: true, refrescar, ayudaDefecto: origen ? t('asesor.campos.calculado', { origen: origen.etiqueta }) : '' };
}

function construirControl(p, ctx, id) {
  const { estado } = ctx;
  const escribir = (v) => { estado.valores[p.clave] = v; ctx.alCambiar(p.clave); };
  switch (p.tipo) {
    case 'texto': {
      const input = h('input', { type: 'text', id, autocomplete: 'off' });
      input.value = estado.valores[p.clave];
      input.addEventListener('input', () => escribir(input.value));
      return { nodo: input, usaInput: true };
    }
    case 'texto_largo': {
      const area = h('textarea', { id, rows: '3' });
      area.value = estado.valores[p.clave];
      area.addEventListener('input', () => escribir(area.value));
      return { nodo: area, usaInput: true, ayudaDefecto: p.separador ? t('asesor.campos.separador') : '' };
    }
    case 'numero': {
      const input = h('input', { type: 'number', id, step: '0.1', inputmode: 'decimal', min: p.min, max: p.max });
      input.value = estado.valores[p.clave];
      input.addEventListener('input', () => escribir(input.value));
      return { nodo: input, usaInput: true };
    }
    case 'opciones': return construirOpciones(p, ctx, id);
    case 'si_no': return segmentado(
      [{ valor: true, etiqueta: t('comun.si') }, { valor: false, etiqueta: t('comun.no') }],
      () => estado.valores[p.clave], escribir);
    case 'imagenes': return construirImagenes(p, ctx, id);
    case 'calculado': return construirCalculado(p, ctx, id);
    default: return { nodo: h('span', { class: 'form-hint', text: t('asesor.errores.tipoNoSoportado', { etiqueta: p.etiqueta, tipo: p.tipo }) }) };
  }
}

// Devuelve { el, refrescar, setError, ocultoPorVisibilidad }.
// ctx: { indice, estado, config, alCambiar(clave) }
export function crearCampo(p, ctx) {
  const idInput = `pr-input-${p.clave}`;
  const control = construirControl(p, ctx, idInput);
  const etiqueta = h(control.usaInput ? 'label' : 'span', { class: 'pr-etiqueta', for: control.usaInput ? idInput : null });
  const ayuda = p.ayuda || control.ayudaDefecto;
  const errorBox = h('div', { class: 'field-error', hidden: true });
  const esUnidad = ctx.indice.lista.some(q => q.unidad_de === p.clave);
  const ancho = ['texto', 'texto_largo', 'imagenes'].includes(p.tipo) || (p.tipo === 'opciones' && !esUnidad);
  const el = h('div', { class: `form-field pr-campo${ancho ? ' pr-campo--ancho' : ''}`, id: `pr-campo-${p.clave}`, 'data-clave': p.clave },
    h('div', { class: 'pr-etiqueta-fila' }, etiqueta, control.extra),
    control.nodo,
    ayuda ? h('span', { class: 'form-hint', text: ayuda }) : null,
    errorBox);

  const pintarEtiqueta = () => {
    const unidad = etiquetaUnidad(p, ctx.indice, ctx.estado);
    etiqueta.replaceChildren(unidad ? `${p.etiqueta} (${unidad})` : p.etiqueta);
    if (p.requerido) etiqueta.append(' ', h('span', { class: 'pr-req', text: '*', 'aria-hidden': 'true' }));
  };
  pintarEtiqueta();

  return {
    el,
    refrescar() {
      pintarEtiqueta();
      if (control.refrescar) control.refrescar();
      el.style.display = esVisible(p, ctx.estado.valores) ? '' : 'none';
    },
    setError(mensaje) {
      el.classList.toggle('is-invalid', !!mensaje);
      errorBox.hidden = !mensaje;
      errorBox.replaceChildren(...(mensaje ? [icono('alert-circle-outline'), h('span', { text: mensaje })] : []));
    }
  };
}
