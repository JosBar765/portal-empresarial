// Dona de «Reparto por categoría» como SVG propio (sin librerías) y su leyenda; funciones puras: devuelven texto HTML, sin DOM.
import { escapeHtml, formatearDinero } from '../utils/formato.js';
import { t } from '../textos.js';

// Geometría en un viewBox de 200 × 200: centro (100, 100), radio exterior 88 y del hueco 56.
const CENTRO = 100;
const RADIO = 88;
const RADIO_HUECO = 56;
const FRACCION_COMPLETA = 0.9999;

const redondear = (n) => Number(n.toFixed(2));
// Un número de 1 decimal con «%» separado, igual en la leyenda, la tabla y el texto de accesibilidad.
export const textoPorcentaje = (porcentaje) => `${Number(porcentaje || 0).toFixed(1)} %`;
// Clase CSS del color de una categoría; la paleta vive en informes.css con los tokens de global.css.
export const claseCategoria = (clave) => `vi-rep-c--${String(clave).replace(/[^a-z0-9_-]/gi, '')}`;

function punto(radio, fraccion) {
  const angulo = fraccion * 2 * Math.PI - Math.PI / 2;
  return [redondear(CENTRO + radio * Math.cos(angulo)), redondear(CENTRO + radio * Math.sin(angulo))];
}

// Anillo completo: dos medios arcos por borde, porque un solo arco de 360° no se dibuja.
function trazoCompleto() {
  const [x1, y1] = punto(RADIO, 0);
  const [x2, y2] = punto(RADIO, 0.5);
  const [x3, y3] = punto(RADIO_HUECO, 0);
  const [x4, y4] = punto(RADIO_HUECO, 0.5);
  return `M${x1} ${y1}A${RADIO} ${RADIO} 0 1 1 ${x2} ${y2}A${RADIO} ${RADIO} 0 1 1 ${x1} ${y1}Z`
    + `M${x3} ${y3}A${RADIO_HUECO} ${RADIO_HUECO} 0 1 0 ${x4} ${y4}A${RADIO_HUECO} ${RADIO_HUECO} 0 1 0 ${x3} ${y3}Z`;
}

function trazoRebanada(inicio, fin) {
  if (fin - inicio >= FRACCION_COMPLETA) return trazoCompleto();
  const grande = fin - inicio > 0.5 ? 1 : 0;
  const [ax, ay] = punto(RADIO, inicio);
  const [bx, by] = punto(RADIO, fin);
  const [cx, cy] = punto(RADIO_HUECO, fin);
  const [dx, dy] = punto(RADIO_HUECO, inicio);
  return `M${ax} ${ay}A${RADIO} ${RADIO} 0 ${grande} 1 ${bx} ${by}L${cx} ${cy}A${RADIO_HUECO} ${RADIO_HUECO} 0 ${grande} 0 ${dx} ${dy}Z`;
}

// Una rebanada por categoría con monto mayor que cero, en el orden recibido; la fracción sale de los montos (no de los porcentajes redondeados).
export function calcularRebanadas(categorias) {
  const lista = Array.isArray(categorias) ? categorias : [];
  const total = lista.reduce((suma, c) => suma + Math.max(0, Number(c.monto) || 0), 0);
  if (total <= 0) return [];
  let acumulado = 0;
  const rebanadas = [];
  for (const categoria of lista) {
    const monto = Math.max(0, Number(categoria.monto) || 0);
    if (monto === 0) continue;
    const inicio = acumulado;
    acumulado += monto / total;
    rebanadas.push({ clave: categoria.clave, fraccion: monto / total, trazo: trazoRebanada(inicio, Math.min(acumulado, 1)) });
  }
  return rebanadas;
}

// Resumen para lectores de pantalla: alcance y cada categoría con monto y porcentaje (el color no es la única señal).
export function textoAriaReparto(categorias, simbolo, alcance) {
  const detalle = (categorias || []).filter(c => Number(c.monto) > 0)
    .map(c => `${c.nombre}: ${formatearDinero(simbolo, c.monto)} (${textoPorcentaje(c.porcentaje)})`).join('; ');
  return t('reportes.reparto.aria', { alcance, detalle: detalle || t('reportes.reparto.sinDatos') });
}

export function htmlPastel({ categorias, total, simbolo, alcance }) {
  const rebanadas = calcularRebanadas(categorias);
  const aria = escapeHtml(textoAriaReparto(categorias, simbolo, alcance));
  const trazos = rebanadas.length
    ? rebanadas.map(r => `<path class="vi-rep-rebanada ${claseCategoria(r.clave)}" fill-rule="evenodd" d="${r.trazo}"></path>`).join('')
    : `<circle class="vi-rep-rebanada vi-rep-rebanada--vacia" cx="${CENTRO}" cy="${CENTRO}" r="${(RADIO + RADIO_HUECO) / 2}" fill="none" stroke-width="${RADIO - RADIO_HUECO}"></circle>`;
  return `<svg class="vi-rep-pastel" viewBox="0 0 200 200" role="img" aria-label="${aria}">${trazos}`
    + `<text class="vi-rep-pastel__rotulo" x="${CENTRO}" y="92" text-anchor="middle">${escapeHtml(t('reportes.reparto.totalCentro'))}</text>`
    + `<text class="vi-rep-pastel__total" x="${CENTRO}" y="114" text-anchor="middle">${escapeHtml(formatearDinero(simbolo, total))}</text></svg>`;
}

// Leyenda como tabla real: chip de color, categoría, monto y porcentaje.
export function htmlLeyenda(categorias, simbolo) {
  const col = (clave) => escapeHtml(t(`reportes.reparto.col.${clave}`));
  const filas = (categorias || []).map(c => `<tr>
    <td data-label="${col('categoria')}"><span class="vi-rep-chip ${claseCategoria(c.clave)}" aria-hidden="true"></span>${escapeHtml(c.nombre)}</td>
    <td data-label="${col('monto')}" class="vi-rep-num">${escapeHtml(formatearDinero(simbolo, c.monto))}</td>
    <td data-label="${col('porcentaje')}" class="vi-rep-num">${escapeHtml(textoPorcentaje(c.porcentaje))}</td></tr>`).join('');
  return `<table class="vi-rep-tabla vi-rep-tabla--leyenda"><thead><tr>
    <th scope="col">${col('categoria')}</th><th scope="col" class="vi-rep-num">${col('monto')}</th><th scope="col" class="vi-rep-num">${col('porcentaje')}</th></tr></thead><tbody>${filas}</tbody></table>`;
}
