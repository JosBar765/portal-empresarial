// Lienzo de firma a pantalla completa (dedo, lápiz o mouse con Pointer Events); se apila sobre los modales y devuelve la firma en PNG.
import { h } from '../utils/dom.js';
import { registrarCapa } from '../utils/historialCapas.js';
import { t } from '../textos.js';

const MARGEN_RECORTE = 12; // px CSS alrededor del trazo al exportar
const ESCALA_MAXIMA = 2; // la firma no necesita más resolución y el servidor limita los megapíxeles

// Resuelve con el Blob PNG (recortado al trazo) al aceptar, o null al cancelar. `nombre` se muestra bajo la línea.
export function abrirFirmaPantalla({ nombre = '' } = {}) {
  return new Promise((resolve) => {
    const origen = document.activeElement;
    const trazos = []; // cada trazo: { base: { w, h }, puntos: [{ x, y }] } en px CSS del lienzo de ese momento
    let actual = null;
    let ancho = 0;
    let alto = 0;
    let dpr = 1;

    const lienzo = h('canvas', { class: 'vi-firma__lienzo', role: 'img', 'aria-label': t('firma.lienzo') });
    const area = h('div', { class: 'vi-firma__area' },
      lienzo,
      h('div', { class: 'vi-firma__guia', 'aria-hidden': 'true' },
        h('span', { class: 'vi-firma__linea' }),
        nombre && h('strong', { class: 'vi-firma__nombre', text: nombre }),
        h('span', { class: 'vi-firma__conforme', text: t('recibo.recibiConforme') })));
    const limpiar = h('button', { type: 'button', class: 'btn btn--ghost', id: 'vi-firma-limpiar', text: t('firma.limpiar'), disabled: true });
    const cancelar = h('button', { type: 'button', class: 'btn btn--ghost', id: 'vi-firma-cancelar', text: t('comun.cancelar') });
    const aceptar = h('button', { type: 'button', class: 'btn btn--primary', id: 'vi-firma-aceptar', text: t('comun.aceptar'), disabled: true });
    const capa = h('div', { class: 'vi-firma', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'vi-firma-titulo', 'aria-describedby': 'vi-firma-ayuda' },
      h('div', { class: 'vi-firma__cabecera' },
        h('h3', { id: 'vi-firma-titulo', text: t('firma.titulo') }),
        h('p', { id: 'vi-firma-ayuda', class: 'vi-ayuda', text: t('firma.ayuda') })),
      area,
      h('div', { class: 'vi-firma__pie' }, limpiar, cancelar, aceptar));

    const ctx = lienzo.getContext('2d');
    // El color de la tinta sale del token de texto: nada de colores fijos en el código.
    const tinta = getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim() || 'black';

    const hayTrazo = () => trazos.some(s => s.puntos.length > 0);
    const actualizarBotones = () => { aceptar.disabled = !hayTrazo(); limpiar.disabled = !hayTrazo(); };

    function dibujarTrazo(s, escala) {
      const p = s.puntos.map(q => ({ x: q.x * escala, y: q.y * escala }));
      if (!p.length) return;
      ctx.beginPath();
      if (p.length === 1) { ctx.arc(p[0].x, p[0].y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fillStyle = tinta; ctx.fill(); return; }
      ctx.moveTo(p[0].x, p[0].y);
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
      ctx.stroke();
    }

    function configurarPincel() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = tinta;
    }

    // Al girar el teléfono o cambiar la ventana el lienzo se reinicia: se redibuja la firma escalada para que quepa entera.
    function ajustarTamano() {
      const caja = area.getBoundingClientRect();
      const nuevoDpr = window.devicePixelRatio || 1;
      if (Math.round(caja.width) === ancho && Math.round(caja.height) === alto && nuevoDpr === dpr) return;
      ancho = Math.round(caja.width);
      alto = Math.round(caja.height);
      dpr = nuevoDpr;
      lienzo.width = Math.max(1, Math.round(ancho * dpr));
      lienzo.height = Math.max(1, Math.round(alto * dpr));
      lienzo.style.width = `${ancho}px`;
      lienzo.style.height = `${alto}px`;
      configurarPincel();
      trazos.forEach(s => dibujarTrazo(s, Math.min(ancho / s.base.w, alto / s.base.h)));
    }

    // Los trazos se guardan en la medida actual para que el siguiente redibujo y el recorte usen una sola escala.
    function normalizarTrazos() {
      trazos.forEach(s => {
        const escala = Math.min(ancho / s.base.w, alto / s.base.h);
        if (escala === 1) return;
        s.puntos = s.puntos.map(q => ({ x: q.x * escala, y: q.y * escala }));
        s.base = { w: ancho, h: alto };
      });
    }

    const punto = (e) => { const r = lienzo.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

    function alBajar(e) {
      if (e.button !== undefined && e.button > 0) return;
      e.preventDefault();
      normalizarTrazos();
      lienzo.setPointerCapture?.(e.pointerId);
      actual = { base: { w: ancho, h: alto }, puntos: [punto(e)], id: e.pointerId };
      trazos.push(actual);
      dibujarTrazo(actual, 1);
    }
    function alMover(e) {
      if (!actual || e.pointerId !== actual.id) return;
      e.preventDefault();
      const eventos = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
      const anterior = actual.puntos[actual.puntos.length - 1];
      const nuevos = (eventos.length ? eventos : [e]).map(punto);
      actual.puntos.push(...nuevos);
      ctx.beginPath();
      ctx.moveTo(anterior.x, anterior.y);
      nuevos.forEach(q => ctx.lineTo(q.x, q.y));
      ctx.stroke();
    }
    function alSoltar(e) {
      if (!actual || e.pointerId !== actual.id) return;
      actual = null;
      actualizarBotones();
    }

    function borrar() {
      trazos.length = 0;
      actual = null;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, lienzo.width, lienzo.height);
      configurarPincel();
      actualizarBotones();
    }

    // PNG transparente recortado al trazo: pesa poco y el PDF lo apoya sobre la línea de «Recibí conforme».
    function exportar() {
      normalizarTrazos();
      const puntos = trazos.flatMap(s => s.puntos);
      const xs = puntos.map(p => p.x);
      const ys = puntos.map(p => p.y);
      const x0 = Math.max(0, Math.min(...xs) - MARGEN_RECORTE);
      const y0 = Math.max(0, Math.min(...ys) - MARGEN_RECORTE);
      const x1 = Math.min(ancho, Math.max(...xs) + MARGEN_RECORTE);
      const y1 = Math.min(alto, Math.max(...ys) + MARGEN_RECORTE);
      const escala = Math.min(dpr, ESCALA_MAXIMA);
      const salida = document.createElement('canvas');
      salida.width = Math.max(1, Math.round((x1 - x0) * escala));
      salida.height = Math.max(1, Math.round((y1 - y0) * escala));
      salida.getContext('2d').drawImage(lienzo, x0 * dpr, y0 * dpr, (x1 - x0) * dpr, (y1 - y0) * dpr, 0, 0, salida.width, salida.height);
      return new Promise((ok) => salida.toBlob(b => ok(b), 'image/png'));
    }

    const desbordeAnterior = document.body.style.overflow;
    const observador = typeof ResizeObserver === 'function' ? new ResizeObserver(() => ajustarTamano()) : null;
    const alRedimensionar = () => ajustarTamano();
    const evitarDesplazamiento = (e) => { if (e.target === lienzo) e.preventDefault(); };

    // Escape y Tab se atienden en captura: Escape cierra solo esta capa (los modales de abajo no lo reciben) y el foco no sale de ella.
    function alTeclear(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); terminar(null); return; }
      if (e.key !== 'Tab') return;
      const enfocables = [limpiar, cancelar, aceptar].filter(b => !b.disabled);
      if (!enfocables.length) return;
      const i = enfocables.indexOf(document.activeElement);
      e.preventDefault();
      const siguiente = i === -1 ? 0 : (i + (e.shiftKey ? -1 : 1) + enfocables.length) % enfocables.length;
      enfocables[siguiente].focus();
    }

    let terminado = false;
    function terminar(resultado) {
      if (terminado) return;
      terminado = true;
      soltarHistorial();
      document.removeEventListener('keydown', alTeclear, true);
      window.removeEventListener('resize', alRedimensionar);
      if (observador) observador.disconnect();
      document.body.style.overflow = desbordeAnterior;
      capa.remove();
      if (origen && typeof origen.focus === 'function' && document.contains(origen)) origen.focus();
      resolve(resultado);
    }

    lienzo.addEventListener('pointerdown', alBajar);
    lienzo.addEventListener('pointermove', alMover);
    lienzo.addEventListener('pointerup', alSoltar);
    lienzo.addEventListener('pointercancel', alSoltar);
    capa.addEventListener('touchmove', evitarDesplazamiento, { passive: false });
    limpiar.addEventListener('click', borrar);
    cancelar.addEventListener('click', () => terminar(null));
    aceptar.addEventListener('click', async () => {
      if (!hayTrazo() || aceptar.disabled) return;
      aceptar.disabled = true;
      const blob = await exportar();
      terminar(blob);
    });

    document.body.append(capa);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', alTeclear, true);
    const soltarHistorial = registrarCapa(() => terminar(null));
    window.addEventListener('resize', alRedimensionar);
    if (observador) observador.observe(area);
    ajustarTamano();
    cancelar.focus();
  });
}
