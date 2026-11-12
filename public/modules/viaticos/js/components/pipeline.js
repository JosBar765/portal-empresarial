// Pipeline de estado de una solicitud: nodos unidos por conectores, la etiqueta de estado y su detalle.
// El servidor lo calcula (`pipeline` de pipelineService); aquí solo se dibuja.
import { escapeHtml } from '../utils/formato.js';
import { ESTADOS_PASO, FASES } from '../config/constantes.js';
import { t, TEXTOS } from '../textos.js';

const SIMBOLOS = {
  completado: '<svg viewBox="0 0 12 10" aria-hidden="true"><path d="M1.5 5.5 4.5 8.5 10.5 1.5"/></svg>',
  rechazado: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5"/></svg>',
  vencida: '<svg viewBox="0 0 4 12" aria-hidden="true"><path d="M2 1.5v5.5M2 10.5v.01"/></svg>'
};

// Una solicitud vencida pinta su paso actual como aviso (ámbar); el resto de los pasos conserva su estado.
const estadoVisual = (paso, vencida) => (vencida && paso.estado === ESTADOS_PASO.ACTUAL ? 'vencida' : paso.estado);

function htmlNodo(paso, i, total, vencida) {
  const estado = estadoVisual(paso, vencida);
  // Un estado que el catálogo no conozca se muestra tal cual en vez de romper toda la tabla.
  const clave = `pipeline.estadoPaso.${estado}`;
  const descripcion = t('pipeline.paso', { n: i + 1, total, etiqueta: paso.etiqueta, estado: clave in TEXTOS ? t(clave) : estado });
  return `<span class="vi-pl-nodo vi-pl-nodo--${escapeHtml(estado)}" role="img" aria-label="${escapeHtml(descripcion)}">${SIMBOLOS[estado] || ''}</span>`;
}

// `pipeline`: { pasos: [{ clave, etiqueta, estado }], etiqueta, detalle, vencida, fase }.
export function htmlPipeline(pipeline) {
  if (!pipeline || !Array.isArray(pipeline.pasos) || pipeline.pasos.length === 0) return '';
  const vencida = !!pipeline.vencida || pipeline.fase === FASES.VENCIDA;
  const pasos = pipeline.pasos.map((paso, i) => {
    const conector = i === 0 ? '' : `<span class="vi-pl-conector${pipeline.pasos[i - 1].estado === ESTADOS_PASO.COMPLETADO ? ' vi-pl-conector--completado' : ''}" aria-hidden="true"></span>`;
    return conector + htmlNodo(paso, i, pipeline.pasos.length, vencida);
  }).join('');
  // Solo «Rechazada» y «Vencida» cambian el color del texto; ninguna lleva fondo.
  const tono = pipeline.fase === FASES.RECHAZADA ? ' vi-pl-estado--rechazada' : (vencida ? ' vi-pl-estado--vencida' : '');
  const titulo = [pipeline.etiqueta, pipeline.detalle].filter(Boolean).join('. ');
  return `<div class="vi-pipeline" role="group" aria-label="${escapeHtml(titulo)}" title="${escapeHtml(titulo)}">
    <div class="vi-pl-pasos">${pasos}</div>
    <span class="vi-pl-estado${tono}">${escapeHtml(pipeline.etiqueta)}</span>
    ${pipeline.detalle ? `<span class="vi-pl-detalle">${escapeHtml(pipeline.detalle)}</span>` : ''}
  </div>`;
}
