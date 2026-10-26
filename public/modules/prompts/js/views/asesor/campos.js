// Campos dinámicos del formulario del asesor, según el esquema del producto.
// El estado vive solo en memoria: { valores: {clave: valor}, archivos: {clave: [{file, url, descripcion, ubicacion}]} }.
import { h, icono } from '../../utils/dom.js';

const MAX_LARGO = { texto: 150, texto_largo: 600 };
const FORMATOS_DEFECTO = ['png', 'jpg', 'svg', 'webp'];
const EXTENSIONES = { png: ['png'], jpg: ['jpg', 'jpeg'], svg: ['svg'], webp: ['webp'] };
const MAX_NOMBRE = 150;
const MAX_DESCRIPCION = 120;

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
export function formatearValor(p, indice, estado) {
  const v = estado.valores[p.clave];
  switch (p.tipo) {
    case 'texto':
    case 'texto_largo': return String(v || '').trim();
    case 'numero': return v === '' || v == null ? '' : `${v} ${etiquetaUnidad(p, indice, estado)}`.trim();
    case 'opciones': { const o = (p.opciones || []).find(x => x.valor === v); return o ? o.etiqueta : ''; }
    case 'si_no': return v ? 'Sí' : 'No';
    case 'imagenes': { const n = estado.archivos[p.clave].length; return n ? `${n} de ${p.max || 1}` : ''; }
    case 'calculado': {
      const ref = indice.porClave[p.igual_a];
      return ref && ref.tipo !== 'calculado' ? formatearValor(ref, indice, estado) : '';
    }
    default: return '';
  }
}

// Mismas reglas que el contrato (sección 2); el servidor vuelve a validar.
export function validarCampo(p, estado) {
  const v = estado.valores[p.clave];
  switch (p.tipo) {
    case 'texto':
    case 'texto_largo': {
      const t = String(v || '').trim();
      if (!t) return p.requerido ? 'Este campo es obligatorio.' : '';
      const max = p.max_largo || MAX_LARGO[p.tipo];
      return t.length > max ? `No puede superar ${max} caracteres.` : '';
    }
    case 'numero': {
      if (v === '' || v == null) return p.requerido ? 'Ingresa un número.' : '';
      const n = Number(v);
      if (!Number.isFinite(n)) return 'Ingresa un número válido.';
      if (p.min != null && n < p.min) return `Debe ser al menos ${p.min}.`;
      if (p.max != null && n > p.max) return `No puede ser mayor que ${p.max}.`;
      return '';
    }
    case 'opciones': return !v && p.requerido ? 'Elige una opción.' : '';
    case 'imagenes': {
      const n = estado.archivos[p.clave].length;
      if (n === 0) return p.requerido ? 'Sube al menos una imagen.' : '';
      if (n > (p.max || 1)) return `Máximo ${p.max || 1} imágenes.`;
      return estado.archivos[p.clave].some(a => a.descripcion.trim().length > MAX_DESCRIPCION)
        ? `La descripción de cada imagen no puede superar ${MAX_DESCRIPCION} caracteres.` : '';
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
    h('option', { value: '', text: 'Selecciona una opción' }),
    opciones.map(o => h('option', { value: o.valor, text: o.etiqueta })));
  select.value = leer();
  return { nodo: select, usaInput: true, refrescar: () => { select.value = leer(); } };
}

let zonaActiva = null; // recuadro bajo el cursor o con foco: destino del Ctrl+V
let contadorPegadas = 0;
const EXT_POR_MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/gif': 'gif' };

// El portapapeles entrega capturas como «image.png»: se renombran para distinguirlas en la lista.
function nombrarPegada(f) {
  if (f.name && !/^image\.\w+$/i.test(f.name)) return f;
  const ext = EXT_POR_MIME[f.type] || f.type.split('/')[1] || 'png';
  return new File([f], `imagen-pegada-${++contadorPegadas}.${ext}`, { type: f.type });
}

document.addEventListener('paste', (e) => {
  if (!zonaActiva || !zonaActiva.isConnected) return;
  const imagenes = Array.from(e.clipboardData?.files || []).filter(f => f.type.startsWith('image/'));
  if (!imagenes.length) return;
  e.preventDefault();
  zonaActiva.pegar(imagenes.map(nombrarPegada));
});

// Tarjeta de una imagen subida: edita descripción y ubicación sobre el mismo objeto, sin reconstruir la grilla.
function tarjetaImagen(p, item, n, alQuitar) {
  const base = `pr-img-${p.clave}-${n}`;
  const listaId = `${base}-lista`;
  const sugerencias = Array.isArray(p.sugerencias) ? p.sugerencias : [];
  const ubicaciones = Array.isArray(p.ubicaciones) ? p.ubicaciones : [];

  const desc = h('input', {
    type: 'text', id: `${base}-desc`, class: 'pr-img-campo', autocomplete: 'off', maxlength: String(MAX_DESCRIPCION),
    placeholder: 'Ej.: Logo del organizador', 'aria-label': `¿Qué es? (${item.file.name})`, list: sugerencias.length ? listaId : null
  });
  desc.value = item.descripcion;
  desc.addEventListener('input', () => { item.descripcion = desc.value; });

  let selector = null;
  if (ubicaciones.length) {
    selector = h('select', { id: `${base}-ubic`, class: 'pr-img-campo', 'aria-label': `Ubicación (${item.file.name})` },
      h('option', { value: '', text: 'Sin ubicación específica' }),
      ubicaciones.map(u => h('option', { value: u, text: u })));
    selector.value = item.ubicacion;
    selector.addEventListener('change', () => { item.ubicacion = selector.value; });
  }

  return h('div', { class: 'pr-img-item' },
    h('div', { class: 'pr-img-item-cab' },
      h('div', { class: 'pr-miniatura-img' }, h('img', { src: item.url, alt: '' })),
      h('span', { class: 'pr-miniatura-nombre', text: item.file.name, title: item.file.name })),
    h('button', { type: 'button', class: 'pr-miniatura-quitar', 'aria-label': `Quitar ${item.file.name}`, text: '×', onclick: alQuitar }),
    h('label', { class: 'pr-img-etiqueta', for: `${base}-desc`, text: '¿Qué es?' }),
    desc,
    sugerencias.length ? h('datalist', { id: listaId }, sugerencias.map(s => h('option', { value: s }))) : null,
    selector ? h('label', { class: 'pr-img-etiqueta', for: `${base}-ubic`, text: 'Ubicación' }) : null,
    selector);
}

function construirImagenes(p, ctx, id) {
  const { estado } = ctx;
  const max = p.max || 1;
  const maxMb = p.max_mb || 5;
  const formatos = p.formatos && p.formatos.length ? p.formatos : FORMATOS_DEFECTO;
  const permitidas = formatos.flatMap(f => EXTENSIONES[f] || [f]);
  const lista = () => estado.archivos[p.clave];

  const input = h('input', { type: 'file', id, class: 'pr-file-input', multiple: true, tabindex: '-1', accept: permitidas.map(e => `.${e}`).join(',') });
  const zona = h('div', { class: 'pr-dropzone', role: 'button', tabindex: '0', 'aria-controls': id },
    icono('cloud-upload-outline'),
    h('strong', { text: 'Arrastra, haz clic o pega (Ctrl+V) imágenes' }),
    h('span', { class: 'form-hint', text: `Para pegar, pon el cursor sobre este recuadro · Hasta ${max} imágenes · ${formatos.map(f => f.toUpperCase()).join(', ')} · máx. ${maxMb} MB cada una` }));
  const grilla = h('div', { class: 'pr-miniaturas' });
  const contador = h('span', { class: 'pr-contador' });

  const rechazar = (nombre, motivo) => window.toast.warning(nombre, motivo);

  function agregar(archivos) {
    for (const f of archivos) {
      if (lista().length >= max) { rechazar('Límite alcanzado', `Solo puedes subir hasta ${max} imágenes.`); break; }
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (!permitidas.includes(ext)) { rechazar(f.name, `Formato no permitido. Usa: ${formatos.map(x => x.toUpperCase()).join(', ')}.`); continue; }
      if (f.size > maxMb * 1024 * 1024) { rechazar(f.name, `La imagen supera los ${maxMb} MB.`); continue; }
      if (f.name.length > MAX_NOMBRE) { rechazar(f.name, `El nombre del archivo supera los ${MAX_NOMBRE} caracteres.`); continue; }
      lista().push({ file: f, url: URL.createObjectURL(f), descripcion: '', ubicacion: '' });
    }
    ctx.alCambiar(p.clave);
  }

  function quitar(i) {
    const [quitado] = lista().splice(i, 1);
    URL.revokeObjectURL(quitado.url);
    ctx.alCambiar(p.clave);
  }

  const abrirSelector = () => { if (lista().length < max) input.click(); };
  zona.addEventListener('click', abrirSelector);
  zona.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirSelector(); } });
  input.addEventListener('change', () => { agregar(Array.from(input.files)); input.value = ''; });
  zona.addEventListener('dragover', (e) => { e.preventDefault(); if (lista().length < max) zona.classList.add('is-arrastre'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('is-arrastre'));
  zona.addEventListener('drop', (e) => {
    e.preventDefault();
    zona.classList.remove('is-arrastre');
    if (lista().length < max) agregar(Array.from(e.dataTransfer.files));
  });
  zona.pegar = (archivos) => agregar(archivos);
  zona.addEventListener('mouseenter', () => { zonaActiva = zona; });
  zona.addEventListener('focus', () => { zonaActiva = zona; });
  zona.addEventListener('mouseleave', () => { if (zonaActiva === zona && document.activeElement !== zona) zonaActiva = null; });
  zona.addEventListener('blur', () => { if (zonaActiva === zona) zonaActiva = null; });

  let firma = null; // evita reconstruir las miniaturas si la lista no cambió
  const refrescar = () => {
    const lleno = lista().length >= max;
    zona.classList.toggle('is-deshabilitada', lleno);
    zona.setAttribute('aria-disabled', String(lleno));
    input.disabled = lleno;
    contador.textContent = `${lista().length} de ${max}`;
    const nueva = lista().map(a => a.url).join('|');
    if (nueva === firma) return;
    firma = nueva;
    grilla.replaceChildren(...lista().map((a, i) => tarjetaImagen(p, a, i, () => quitar(i))));
  };
  refrescar();
  return { nodo: h('div', { class: 'pr-imagenes' }, zona, input, grilla), extra: contador, refrescar };
}

function construirCalculado(p, ctx, id) {
  const input = h('input', { type: 'text', id, disabled: true });
  const origen = ctx.indice.porClave[p.igual_a];
  const refrescar = () => { input.value = formatearValor(p, ctx.indice, ctx.estado); };
  refrescar();
  return { nodo: input, usaInput: true, refrescar, ayudaDefecto: origen ? `Se calcula a partir de «${origen.etiqueta}».` : '' };
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
      return { nodo: area, usaInput: true, ayudaDefecto: p.separador ? 'Sepáralas con comas' : '' };
    }
    case 'numero': {
      const input = h('input', { type: 'number', id, step: '0.1', inputmode: 'decimal', min: p.min, max: p.max });
      input.value = estado.valores[p.clave];
      input.addEventListener('input', () => escribir(input.value));
      return { nodo: input, usaInput: true };
    }
    case 'opciones': return construirOpciones(p, ctx, id);
    case 'si_no': return segmentado(
      [{ valor: true, etiqueta: 'Sí' }, { valor: false, etiqueta: 'No' }],
      () => estado.valores[p.clave], escribir);
    case 'imagenes': return construirImagenes(p, ctx, id);
    case 'calculado': return construirCalculado(p, ctx, id);
    default: return { nodo: h('span', { text: `Tipo no soportado: ${p.tipo}` }) };
  }
}

// Devuelve { el, refrescar, setError, ocultoPorVisibilidad }.
// ctx: { indice, estado, alCambiar(clave) }
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
