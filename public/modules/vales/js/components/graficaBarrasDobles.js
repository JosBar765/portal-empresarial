import { escapeHtml } from '../utils/formato.js';

// -----------------------------------------------------------------------
// Gráfica de barras dobles por persona (Reportes del Encargado y del Supervisor). Barras horizontales: los nombres se leen
// completos y escala bien con muchas personas. Cada barra lleva su valor al final; a la derecha, el % de la 2ª serie sobre la 1ª.
// Accesible: el conjunto es una imagen con resumen y una tabla equivalente solo para lectores de pantalla.
// -----------------------------------------------------------------------
const LIMITE_SIN_SCROLL = 9;

const porcentaje = (a, b) => (a > 0 ? `${Math.round((b / a) * 100)} %` : '—');

function htmlFila(f, [serieA, serieB], maximo) {
  const ancho = (n) => (n > 0 ? Math.max((n / maximo) * 100, 2) : 0);
  const detalle = `${f.nombre}: ${f.a} ${serieA.etiqueta.toLowerCase()}, ${f.b} ${serieB.etiqueta.toLowerCase()}${f.a > 0 ? ` (${porcentaje(f.a, f.b)})` : ''}`;
  return `
    <li class="gbd-fila${f.a === 0 ? ' gbd-fila--vacia' : ''}" title="${escapeHtml(detalle)}">
      <span class="gbd-nombre">${escapeHtml(f.nombre)}</span>
      <div class="gbd-barras" aria-hidden="true">
        <div class="gbd-linea"><div class="gbd-pista"><div class="gbd-barra gbd-barra--a" style="width:${ancho(f.a)}%"></div></div><span class="gbd-valor">${f.a}</span></div>
        <div class="gbd-linea"><div class="gbd-pista"><div class="gbd-barra gbd-barra--b" style="width:${ancho(f.b)}%"></div></div><span class="gbd-valor">${f.b}</span></div>
      </div>
      <span class="gbd-pct" aria-hidden="true">${porcentaje(f.a, f.b)}</span>
    </li>`;
}

// `grafica`: { titulo, subtitulo, series: [{ etiqueta, ayuda }, { etiqueta, ayuda }], filas: [{ nombre, a, b }] }
export function htmlGraficaBarrasDobles(grafica) {
  if (!grafica || !grafica.filas.length) return '';
  const { series, filas } = grafica;
  const maximo = Math.max(1, ...filas.map(f => Math.max(f.a, f.b)));
  const totalA = filas.reduce((s, f) => s + f.a, 0);
  const totalB = filas.reduce((s, f) => s + f.b, 0);
  const resumen = `${grafica.titulo}. ${filas.length} personas. Total: ${totalA} ${series[0].etiqueta.toLowerCase()} y ${totalB} ${series[1].etiqueta.toLowerCase()}.`;
  const hayScroll = filas.length > LIMITE_SIN_SCROLL;
  return `
    <section class="rend-panel rep-grafica" aria-label="${escapeHtml(grafica.titulo)}">
      <header class="rend-panel-cab">
        <div><h3>${escapeHtml(grafica.titulo)}</h3><p>${escapeHtml(grafica.subtitulo || '')}</p></div>
        <ul class="gbd-leyenda">
          ${series.map((s, i) => `<li><span class="gbd-clave gbd-clave--${i ? 'b' : 'a'}" aria-hidden="true"></span>${escapeHtml(s.etiqueta)}<button type="button" class="rep-info" data-info="${escapeHtml(s.ayuda)}" aria-label="¿Qué es «${escapeHtml(s.etiqueta)}»? ${escapeHtml(s.ayuda)}"><ion-icon name="information-circle-outline" aria-hidden="true"></ion-icon></button></li>`).join('')}
        </ul>
      </header>
      <div class="gbd-cuerpo${hayScroll ? ' gbd-cuerpo--scroll' : ''}" role="img" aria-label="${escapeHtml(resumen)}" tabindex="${hayScroll ? '0' : '-1'}">
        <ol class="gbd-lista">${filas.map(f => htmlFila(f, series, maximo)).join('')}</ol>
      </div>
      <table class="sr-only">
        <caption>${escapeHtml(grafica.titulo)}</caption>
        <thead><tr><th>Persona</th><th>${escapeHtml(series[0].etiqueta)}</th><th>${escapeHtml(series[1].etiqueta)}</th></tr></thead>
        <tbody>${filas.map(f => `<tr><td>${escapeHtml(f.nombre)}</td><td>${f.a}</td><td>${f.b}</td></tr>`).join('')}</tbody>
      </table>
      <p class="gbd-pie">El porcentaje de la derecha es ${escapeHtml(series[1].etiqueta.toLowerCase())} entre ${escapeHtml(series[0].etiqueta.toLowerCase())}.</p>
    </section>`;
}
