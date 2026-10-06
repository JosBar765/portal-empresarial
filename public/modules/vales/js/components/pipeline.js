// Pipeline de estado de 5 pasos para la columna «Estado» de las tablas. El servidor lo calcula
// (`v.pipeline`, valePipeline.js); aquí solo se dibuja y se muestra el detalle de cada paso.
import { escapeHtml } from '../utils/formato.js';
import { claseEstado, etiquetaEstado } from '../permisos.js';

const SIMBOLOS = {
  completado: '<svg viewBox="0 0 12 10" aria-hidden="true"><path d="M1.5 5.5 4.5 8.5 10.5 1.5"/></svg>',
  pausa: '<svg viewBox="0 0 10 12" aria-hidden="true"><rect x="1" y="1" width="3" height="10" rx="1"/><rect x="6" y="1" width="3" height="10" rx="1"/></svg>',
  devuelto: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5"/></svg>'
};

const TEXTO_NODO = {
  completado: 'completado',
  actual: 'paso actual',
  pendiente: 'pendiente',
  pausa: 'en pausa',
  atrasado: 'atrasado',
  devuelto: 'rechazado'
};

function lineasDelPaso(p, i) {
  const nodo = p.nodos[i];
  if (nodo === 'completado') return ['Completado'];
  if (nodo === 'pendiente') return ['Pendiente'];
  const lineas = [p.detalle ? `${p.etiqueta} · ${p.detalle}` : p.etiqueta];
  if (nodo === 'devuelto' && p.motivo) lineas.push(`Motivo: «${p.motivo}»`);
  p.marcas.filter(m => m.tipo !== 'mod').forEach(m => lineas.push(m.texto));
  if (p.talleres.length && i >= 1 && i <= 3) p.talleres.forEach(t => lineas.push(`• ${t.nombre}: ${t.etiqueta}`));
  return lineas;
}

function htmlNodo(p, i) {
  const nodo = p.nodos[i];
  const titulo = `Paso ${i + 1} de 5 · ${p.pasos[i]}`;
  const tip = escapeHtml(JSON.stringify({ titulo, lineas: lineasDelPaso(p, i) }));
  const contenido = SIMBOLOS[nodo] || String(i + 1);
  return `<span class="pl-nodo pl-nodo--${nodo}" tabindex="0" role="img" aria-label="${escapeHtml(`${titulo}: ${TEXTO_NODO[nodo]}`)}" data-pl-tip="${tip}">${contenido}</span>`;
}

export function htmlPipeline(p) {
  const pasos = p.nodos.map((_, i) => `${i ? `<span class="pl-conector pl-conector--${p.nodos[i - 1] === 'completado' ? 'completado' : 'pendiente'}" aria-hidden="true"></span>` : ''}${htmlNodo(p, i)}`).join('');
  const marcas = p.marcas.length
    ? `<div class="pl-marcas">${p.marcas.map(m => `<span class="pl-marca pl-marca--${m.tipo}">${escapeHtml(m.texto)}</span>`).join('')}</div>`
    : '';
  return `<div class="pipeline" role="group" aria-label="${escapeHtml(p.resumen)}">
    <div class="pl-pasos">${pasos}</div>
    <div class="pl-etiqueta pl-etiqueta--${p.tono}"><strong>${escapeHtml(p.etiqueta)}</strong>${p.detalle ? `<span class="pl-detalle${p.alerta ? ' pl-detalle--alerta' : ''}">· ${escapeHtml(p.detalle)}</span>` : ''}</div>
    ${marcas}
  </div>`;
}

// Celda de la columna «Estado»: el pipeline, o la píldora de siempre si la fila no trae uno.
export function celdaEstado(v) {
  if (v.pipeline) return htmlPipeline(v.pipeline);
  return `<span class="estado-pill ${escapeHtml(claseEstado(v))}">${escapeHtml(etiquetaEstado(v))}</span>`;
}

let tooltip = null;
let nodoActivo = null;

function crearTooltip() {
  tooltip = document.createElement('div');
  tooltip.className = 'pl-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  document.body.appendChild(tooltip);
}

function ocultar() {
  if (tooltip) tooltip.hidden = true;
  nodoActivo = null;
}

function mostrar(nodo) {
  let datos;
  try { datos = JSON.parse(nodo.dataset.plTip); } catch { return; }
  if (!tooltip) crearTooltip();
  nodoActivo = nodo;
  tooltip.innerHTML = `<strong>${escapeHtml(datos.titulo)}</strong>${datos.lineas.map(l => `<span>${escapeHtml(l)}</span>`).join('')}`;
  tooltip.classList.remove('pl-tooltip--arriba');
  tooltip.hidden = false;
  const r = nodo.getBoundingClientRect();
  const ancho = tooltip.offsetWidth;
  const alto = tooltip.offsetHeight;
  const izquierda = Math.min(Math.max(8, r.left + r.width / 2 - 20), window.innerWidth - ancho - 8);
  const abajoCabe = r.bottom + 10 + alto <= window.innerHeight;
  tooltip.classList.toggle('pl-tooltip--arriba', !abajoCabe);
  tooltip.style.left = `${izquierda}px`;
  tooltip.style.top = `${abajoCabe ? r.bottom + 10 : r.top - alto - 10}px`;
  tooltip.style.setProperty('--pl-caret-x', `${Math.max(10, r.left + r.width / 2 - izquierda - 6)}px`);
}

// Un solo tooltip para todas las tablas, por delegación: sirve a las filas que se pintan después.
export function iniciarTooltipPipeline() {
  const alEntrar = e => {
    const nodo = e.target.closest && e.target.closest('.pl-nodo');
    if (nodo && nodo !== nodoActivo) mostrar(nodo);
  };
  const alSalir = e => {
    if (e.target.closest && e.target.closest('.pl-nodo')) ocultar();
  };
  document.addEventListener('mouseover', alEntrar);
  document.addEventListener('focusin', alEntrar);
  document.addEventListener('mouseout', alSalir);
  document.addEventListener('focusout', alSalir);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') ocultar(); });
  window.addEventListener('scroll', ocultar, true);
}
