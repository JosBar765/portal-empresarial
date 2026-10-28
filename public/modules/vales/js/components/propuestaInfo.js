import { escapeHtml } from '../utils/formato.js';

// Nota y enlaces de una propuesta, en HTML: el panel del visor y el modal de revisión del Encargado. Los enlaces abren en una
// pestaña nueva (Drive, WeTransfer y similares no se pueden incrustar) y solo se muestran si son https.
const esHttps = (url) => { try { return new URL(url).protocol === 'https:'; } catch { return false; } };
const dominioDe = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

export function hayExtras(datos) {
  return !!(datos && (datos.nota || (datos.enlaces && datos.enlaces.length)));
}

export function htmlPropuestaExtras({ nota, enlaces }) {
  const bloques = [];
  if (nota) {
    bloques.push(`<section class="pinfo-bloque"><h4>Observaciones</h4><p class="pinfo-nota">${escapeHtml(nota)}</p></section>`);
  }
  const validos = (enlaces || []).filter(e => esHttps(e.url));
  if (validos.length) {
    bloques.push(`
      <section class="pinfo-bloque">
        <h4>Enlaces</h4>
        <ul class="pinfo-enlaces">${validos.map(e => `
          <li><a class="pinfo-enlace" href="${escapeHtml(e.url)}" target="_blank" rel="noopener noreferrer">
            <ion-icon name="link-outline" aria-hidden="true"></ion-icon>
            <span class="pinfo-enlace-texto"><strong>${escapeHtml(e.nombre || dominioDe(e.url))}</strong><small>${escapeHtml(dominioDe(e.url))}</small></span>
            <ion-icon name="open-outline" class="pinfo-abrir" aria-hidden="true"></ion-icon><span class="sr-only"> (se abre en una pestaña nueva)</span>
          </a></li>`).join('')}
        </ul>
      </section>`);
  }
  return bloques.join('');
}
