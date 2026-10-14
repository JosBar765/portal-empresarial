import { escapeHtml, formatearFecha } from '../utils/formato.js';

// -----------------------------------------------------------------------
// Bloque «Atrasados vigentes» (Buzón y Reportes): una tarjeta discreta con un resumen en el encabezado y una lista compacta de los
// vales atrasados que siguen abiertos. Muestra los 5 más atrasados y el resto bajo demanda, para no saturar la vista. Plegable
// (el usuario recuerda su elección). Cada fila: vale y contexto, paso del pipeline, fecha de entrega, días de atraso y acciones.
// -----------------------------------------------------------------------
const VISIBLES = 5;

// Gravedad por días de atraso (no depende solo del color: el texto siempre dice los días).
const gravedad = (dias) => (dias >= 8 ? 'alta' : (dias >= 4 ? 'media' : 'baja'));
const textoDias = (dias) => (dias >= 1 ? `${dias} ${dias === 1 ? 'día' : 'días'}` : 'Hoy');

function htmlItem(it, extra) {
  const p = it.pipeline || {};
  const paso = p.paso ? `Paso ${p.paso} de 5` : '';
  return `
    <li class="vig-item${extra ? ' vig-item--extra' : ''}">
      <div class="vig-vale">
        <span class="vig-correlativo"><strong>${escapeHtml(it.correlativo)}</strong>${it.esMod ? '<span class="badge badge-mod">MOD</span>' : ''}</span>
        ${it.sub ? `<span class="vig-sub">${escapeHtml(it.sub)}</span>` : ''}
      </div>
      <div class="vig-estado">
        <span class="vig-etiqueta">${escapeHtml(p.etiqueta || '')}</span>
        ${paso ? `<span class="vig-paso">${paso}</span>` : ''}
      </div>
      <div class="vig-fecha"><span class="vig-rotulo">Entrega</span>${escapeHtml(formatearFecha(it.fechaEntrega))}</div>
      <span class="vig-atraso vig-atraso--${gravedad(it.diasAtraso)}" title="Atraso de ${escapeHtml(textoDias(it.diasAtraso))}"><span class="vig-punto" aria-hidden="true"></span>${escapeHtml(textoDias(it.diasAtraso))}</span>
      <div class="vig-acciones">${it.accionesHtml || ''}</div>
    </li>`;
}

// `items`: [{ correlativo, esMod, sub, pipeline, fechaEntrega, diasAtraso, accionesHtml }], del más atrasado al menos.
export function htmlBloqueVigentes({ id, total, items, truncado, plegado, textoPeriodo = 'con entrega anterior al período elegido' }) {
  const masAtrasado = items.length ? Math.max(...items.map(i => i.diasAtraso || 0)) : 0;
  const resto = items.length - VISIBLES;
  return `
    <section class="vig" id="${id}" aria-label="Atrasados vigentes">
      <button type="button" class="vig-cab" aria-expanded="${!plegado}" aria-controls="${id}-cuerpo">
        <ion-icon name="time-outline" class="vig-icono" aria-hidden="true"></ion-icon>
        <span class="vig-titulo">Atrasados vigentes</span>
        <span class="vig-n">${total}</span>
        <span class="vig-resumen">${masAtrasado >= 1 ? `El más atrasado lleva ${masAtrasado} ${masAtrasado === 1 ? 'día' : 'días'} · ` : ''}${escapeHtml(textoPeriodo)}</span>
        <ion-icon name="chevron-down-outline" class="vig-chevron" aria-hidden="true"></ion-icon>
      </button>
      <div class="vig-cuerpo" id="${id}-cuerpo"${plegado ? ' hidden' : ''}>
        <ul class="vig-lista">${items.map((it, i) => htmlItem(it, i >= VISIBLES)).join('')}</ul>
        ${resto > 0 ? `<button type="button" class="vig-mas" aria-expanded="false" data-resto="${resto}">Ver los ${resto} restantes</button>` : ''}
        ${truncado ? `<p class="vig-nota">Se muestran los ${items.length} más atrasados de ${total}.</p>` : ''}
      </div>
    </section>`;
}

// Conecta el plegado del bloque y el «Ver los N restantes». `alCambiarPlegado(plegado)` guarda la preferencia.
export function conectarBloqueVigentes(raiz, alCambiarPlegado) {
  const cab = raiz.querySelector('.vig-cab');
  const cuerpo = raiz.querySelector('.vig-cuerpo');
  cab.addEventListener('click', () => {
    const abrir = cab.getAttribute('aria-expanded') !== 'true';
    cab.setAttribute('aria-expanded', String(abrir));
    cuerpo.hidden = !abrir;
    alCambiarPlegado(!abrir);
  });
  const mas = raiz.querySelector('.vig-mas');
  if (mas) {
    mas.addEventListener('click', () => {
      const abrir = mas.getAttribute('aria-expanded') !== 'true';
      mas.setAttribute('aria-expanded', String(abrir));
      raiz.querySelector('.vig-lista').classList.toggle('is-completa', abrir);
      mas.textContent = abrir ? 'Ver menos' : `Ver los ${mas.dataset.resto} restantes`;
    });
  }
}
