// public/modules/incidencias/js/components/modal.js
// Hojas modales accesibles: foco atrapado, Escape y fondo cierran (salvo mientras se guarda), el foco vuelve a donde estaba.
// En celular la hoja ocupa toda la pantalla (los estilos compartidos ya lo hacen bajo 480 px).
import { h, icono, $ } from '../utils/dom.js';

let contador = 0;

// acciones: [{ texto, tipo: 'primario' | 'peligro' | 'secundario', alHacerClic: async (hoja) => {...} }]
// `alHacerClic` puede lanzar un error: se muestra dentro de la hoja con el detalle por campo (error.campos).
export function abrirHoja({ titulo, subtitulo, contenido, acciones = [], cancelar = 'Cancelar', ancho }) {
  const id = `hoja-${++contador}`;
  const anterior = document.activeElement;
  const raiz = $('#modals-root');
  const aviso = h('div', { class: 'inc-hoja-error', role: 'alert', hidden: true });
  const botonCerrar = h('button', { class: 'modal-close', type: 'button', 'aria-label': 'Cerrar' }, '×');
  const botonCancelar = cancelar ? h('button', { class: 'btn btn--ghost', type: 'button', text: cancelar }) : null;
  const botones = acciones.map(a => h('button', {
    class: `btn ${a.tipo === 'peligro' ? 'btn--danger' : (a.tipo === 'secundario' ? 'btn--ghost' : 'btn--primary')}`,
    type: 'button', 'data-accion': a.texto
  }, a.texto));
  const caja = h('div', { class: `modal-box inc-hoja${ancho === 'lg' ? ' modal-lg' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': `${id}-titulo` },
    h('div', { class: 'modal-header' }, h('div', { class: 'inc-hoja-titulos' }, h('h3', { id: `${id}-titulo`, text: titulo }), subtitulo ? h('p', { class: 'inc-hoja-subtitulo', text: subtitulo }) : null), botonCerrar),
    h('div', { class: 'modal-body' }, aviso, contenido),
    h('div', { class: 'modal-footer' }, botonCancelar, botones));
  const overlay = h('div', { class: 'modal-overlay' }, caja);
  let ocupada = false;

  const enfocables = () => Array.from(caja.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type="file"]), select:not([disabled]), textarea:not([disabled]), a[href]')).filter(el => el.offsetParent !== null || el === document.activeElement);
  const cerrar = () => {
    if (ocupada) return;
    document.removeEventListener('keydown', alTeclear, true);
    overlay.remove();
    document.body.classList.remove('inc-sin-scroll');
    if (anterior && anterior.focus) anterior.focus();
  };
  function alTeclear(e) {
    if (!overlay.isConnected || document.querySelector('.inc-visor')) return;
    if (e.key === 'Escape') { e.stopPropagation(); cerrar(); return; }
    if (e.key !== 'Tab') return;
    const lista = enfocables();
    if (!lista.length) return;
    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  }

  const hoja = {
    cerrar,
    el: caja,
    // Muestra el error del servidor; si trae detalle por campo, marca esos campos (data-campo) y los lee en voz alta.
    mostrarError(mensaje, campos) {
      aviso.hidden = false;
      aviso.replaceChildren(h('strong', { text: mensaje || 'Algo salió mal. Inténtalo de nuevo.' }),
        ...(campos ? Object.values(campos).map(t => h('span', { text: t })) : []));
      caja.querySelectorAll('[data-campo]').forEach(el => el.classList.toggle('inc-campo--error', Boolean(campos && campos[el.dataset.campo])));
      aviso.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
    limpiarError() { aviso.hidden = true; caja.querySelectorAll('.inc-campo--error').forEach(el => el.classList.remove('inc-campo--error')); },
    ocupado(valor, texto) {
      ocupada = valor;
      overlay.classList.toggle('inc-hoja--ocupada', valor);
      caja.querySelectorAll('button').forEach(b => { b.disabled = valor; });
      botones.forEach(b => { if (!b.dataset.original) b.dataset.original = b.textContent; b.textContent = valor && b === hoja._activo ? (texto || 'Enviando…') : b.dataset.original; });
    }
  };

  acciones.forEach((a, i) => {
    botones[i].addEventListener('click', async () => {
      hoja.limpiarError();
      hoja._activo = botones[i];
      hoja.ocupado(true, a.textoOcupado);
      try {
        const cerrarDespues = await a.alHacerClic(hoja);
        hoja.ocupado(false);
        if (cerrarDespues !== false) cerrar();
      } catch (error) {
        hoja.ocupado(false);
        hoja.mostrarError(error.message, error.campos);
      }
    });
  });
  botonCerrar.addEventListener('click', cerrar);
  if (botonCancelar) botonCancelar.addEventListener('click', cerrar);
  let mousedownEnFondo = false;
  overlay.addEventListener('mousedown', (e) => { mousedownEnFondo = (e.target === overlay); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownEnFondo) cerrar(); mousedownEnFondo = false; });
  document.addEventListener('keydown', alTeclear, true);

  raiz.appendChild(overlay);
  document.body.classList.add('inc-sin-scroll');
  const primerCampo = caja.querySelector('textarea, input:not([type="file"]):not([type="radio"]), select');
  (primerCampo || botonCerrar).focus();
  return hoja;
}

// Sí o no: cerrar por cualquier otra vía equivale a cancelar.
export function confirmar({ titulo, mensaje, aceptar = 'Aceptar', cancelar = 'Cancelar', peligro = false }) {
  return new Promise((resolver) => {
    let respondida = false;
    const hoja = abrirHoja({
      titulo, contenido: h('p', { class: 'inc-hoja-texto', text: mensaje }), cancelar,
      acciones: [{ texto: aceptar, tipo: peligro ? 'peligro' : 'primario', alHacerClic: async () => { respondida = true; resolver(true); } }]
    });
    const observador = new MutationObserver(() => { if (!hoja.el.isConnected) { observador.disconnect(); if (!respondida) resolver(false); } });
    observador.observe(document.getElementById('modals-root'), { childList: true });
  });
}

export const iconoAviso = () => icono('alert-circle-outline');
