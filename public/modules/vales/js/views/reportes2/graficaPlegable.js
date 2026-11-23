// Título plegable de las gráficas de barras de los reportes (el mismo gesto que las secciones «Sin entregar», «Entregados»…).
// Qué gráficas están plegadas se recuerda mientras la página siga abierta: elegir una barra repinta el reporte y no debe volver a desplegarlas.
import { escapeHtml } from '../../utils/formato.js';

const plegadas = new Set(); // claves de gráfica plegadas
export const estaPlegada = (clave) => plegadas.has(clave);

// Cabecera con el título como botón (aria-expanded) y el chevron de las secciones.
// `info` (opcional): texto de ayuda que sale al pasar el mouse, enfocar o tocar un ícono junto al título (en el PDF va impreso directamente).
export function htmlCabeceraPlegable(titulo, clave, info = '') {
  const plegada = estaPlegada(clave);
  const icono = info ? `<span class="rep2-gt-info"><button type="button" class="rep2-gt-info-btn" aria-label="${escapeHtml(info)}" aria-describedby="rep2-gt-tip-${escapeHtml(clave)}"><ion-icon name="information-circle-outline" aria-hidden="true"></ion-icon></button><span class="rep2-gt-tip" id="rep2-gt-tip-${escapeHtml(clave)}" role="tooltip">${escapeHtml(info)}</span></span>` : '';
  return `<header class="rep2-gt-cab${info ? ' rep2-gt-cab--info' : ''}">
      <h3><button type="button" class="rep2-gt-plegar" aria-expanded="${!plegada}" aria-controls="rep2-gt-cuerpo-${escapeHtml(clave)}" title="Mostrar u ocultar la gráfica">
        <span>${escapeHtml(titulo)}</span><ion-icon name="chevron-down-outline" class="rep2-gt-chevron" aria-hidden="true"></ion-icon>
      </button></h3>${icono}
    </header>`;
}

// Abre el cuerpo (todo lo que va bajo el título); `cuerpo` es su HTML.
export const htmlCuerpoPlegable = (clave, cuerpo) => `<div class="rep2-gt-cuerpo" id="rep2-gt-cuerpo-${escapeHtml(clave)}"${estaPlegada(clave) ? ' hidden' : ''}>${cuerpo}</div>`;

export const clasePlegada = (clave) => (estaPlegada(clave) ? ' rep2-gt--plegada' : '');

// Conecta el botón del título de la sección de una gráfica.
export function conectarPlegable(seccion, clave) {
  const boton = seccion.querySelector('.rep2-gt-plegar');
  const cuerpo = seccion.querySelector('.rep2-gt-cuerpo');
  if (!boton || !cuerpo) return;
  boton.addEventListener('click', () => {
    const plegar = boton.getAttribute('aria-expanded') === 'true';
    if (plegar) plegadas.add(clave); else plegadas.delete(clave);
    boton.setAttribute('aria-expanded', String(!plegar));
    cuerpo.hidden = plegar;
    seccion.classList.toggle('rep2-gt--plegada', plegar);
  });
}
