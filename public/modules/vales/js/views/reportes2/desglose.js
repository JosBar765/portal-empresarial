import { $ } from '../../utils/dom.js';
import { escapeHtml, formatearFecha, formatearFechaHora, inicialesAvatar } from '../../utils/formato.js';
import { celdaEstado } from '../../components/pipeline.js';
import { abrirVisorVale } from '../../components/visorDocumento.js';
import { abrirVisorMultitaller } from '../../actions/propuestasMultitaller.js';
import { abrirModalHistorial } from '../../actions/historial.js';
import { puede } from '../../permisos.js';

// Piezas del desglose de vales compartidas por los reportes de actividad de Reportes 2 (esqueleto, cabecera, tabla y secciones plegables).

// Primera carga: barras grises con la forma del reporte (controles, aviso y tabla) en vez de un texto suelto.
export function htmlEsqueletoCuerpo() {
  const barra = (...mod) => `<span class="rep-esq-barra ${mod.map(m => `rep-esq-barra--${m}`).join(' ')}"></span>`;
  const fila = () => `<div class="rep-esq-fila">${barra('vale')}${barra('persona')}${barra('estado')}${barra('corta')}${barra('pildora-s')}${barra('cuadro')}</div>`;
  return `<div class="rep-esq" role="status" aria-label="Calculando el reporte">
    <div class="rep-esq-controles">${barra('pildora', 'xl')}</div>
    <div class="rep-esq-controles">${barra('campo')}${barra('campo')}${barra('campo')}</div>
    <div class="rep-esq-aviso">${barra('l')}${barra('pildora-s')}</div>
    <div class="rep-esq-tarjeta">
      ${barra('m')}${barra('s')}
      <div class="rep-esq-seccion">${barra('circulo')}${barra('l')}${barra('pildora-s')}</div>
      <div class="rep-esq-tabla">${fila()}${fila()}${fila()}${fila()}${fila()}</div>
    </div>
  </div>`;
}

export function cabeceraPanel(titulo, subtitulo = '', extra = '') {
  return `<header class="rend-panel-cab"><div><h3>${titulo}</h3>${subtitulo ? `<p>${subtitulo}</p>` : ''}</div>${extra}</header>`;
}

// -----------------------------------------------------------------------
// Tabla de vales por sección
// -----------------------------------------------------------------------
function htmlAtraso(v) {
  if (v.venceHoy) return '<span class="badge badge-hoy">Vence hoy</span>';
  if (v.atrasado) return `<span class="badge badge-atraso">${v.diasAtraso} d</span>`;
  return '<span class="badge badge-ok">Al día</span>';
}

// Entregado: si llegó con atraso, sus días en rojo (como los atrasados); si no, «Al día».
function htmlAtrasoEntregado(v) {
  return v.diasTarde >= 1 ? `<span class="badge badge-atraso" title="Entregado con atraso">${v.diasTarde} d</span>` : '<span class="badge badge-ok">Al día</span>';
}

// Cuerpos plegados sin construir (por id del cuerpo); se vacían en cada panel nuevo.
const diferidos = new Map();
export function reiniciarDesglose() { diferidos.clear(); }

// Talleres (`g.nombres`): una píldora azul por taller, como en el buzón (la misma clase `.taller-tag`); el resto, el nombre con su avatar opcional.
// Diseñadores: las píldoras salen de los diseñadores del vale (`v.disenadoresDelVale`), también al enfocar uno, para ver siempre a todos.
const nombresDeLaFila = (g, v) => (Array.isArray(v.disenadoresDelVale) ? (v.disenadoresDelVale.length ? v.disenadoresDelVale.map(d => d.nombre) : ['Sin asignar']) : g.nombres);
const celdaGrupo = (g, avatar, v = {}) => (Array.isArray(nombresDeLaFila(g, v)) && nombresDeLaFila(g, v).length
  ? `<div class="taller-tags-cell">${nombresDeLaFila(g, v).map(n => `<span class="taller-tag${n === 'Sin asignar' ? ' taller-tag--sin-asignar' : ''}">${escapeHtml(n)}</span>`).join('')}</div>`
  : `<span class="rep-grupo-nombre">${avatar ? `<span class="rep-avatar" aria-hidden="true">${escapeHtml(inicialesAvatar(g.nombre))}</span>` : ''}<span>${escapeHtml(g.nombre)}</span></span>`);

// Una fila de la tabla.
function htmlFila(g, v, { clave, info, taller, avatar }) {
  const conAtraso = clave === 'atrasados' || clave === 'entregados';
  return `
    <tr>
      <td class="rep-c-vale" data-label="Vale"><strong>${escapeHtml(v.correlativo)}</strong>${v.esMod ? '<span class="badge badge-mod">MOD</span>' : ''}${v.urgente ? '<span class="badge badge-urgente">URGENTE</span>' : ''}${taller ? '' : `<span class="rep-cliente">${escapeHtml(v.cliente)}</span>`}</td>
      <td class="rep-c-grupo" data-label="${info.texto}">${celdaGrupo(g, avatar, v)}</td>
      ${taller ? `<td class="rep-c-ingreso" data-label="Fecha de ingreso">${escapeHtml(formatearFechaHora(v.creadoEn))}</td>` : ''}
      <td class="rep-c-estado" data-label="Estado">${celdaEstado(v)}</td>
      <td class="rep-c-entrega fecha-entrega" data-label="Entrega">${escapeHtml(formatearFecha(v.fechaEntrega))}</td>
      ${conAtraso ? `<td class="rep-c-atraso" data-label="Atraso">${clave === 'entregados' ? htmlAtrasoEntregado(v) : htmlAtraso(v)}</td>` : ''}
      <td class="rep-acciones-celda rep-c-acciones" data-label="Acciones"><div class="rep-acciones-fila">
        <button type="button" class="btn-icon" data-ver="${v.id}" data-correlativo="${escapeHtml(v.correlativo)}"${v.tienePropuesta ? ' data-con-propuesta="1"' : ''}${v.multitaller ? ' data-multitaller="1"' : ''} title="Ver vale" aria-label="Ver vale ${escapeHtml(v.correlativo)}"><ion-icon name="eye-outline"></ion-icon></button>
        ${puede('verHistorial') ? `<button type="button" class="btn-icon" data-historial="${v.id}" data-correlativo="${escapeHtml(v.correlativo)}" title="Ver historial" aria-label="Ver historial de ${escapeHtml(v.correlativo)}"><ion-icon name="time-outline" aria-hidden="true"></ion-icon></button>` : ''}
      </div></td>
    </tr>`;
}

// Una sola tabla por sección con todos sus vales: la persona (o taller/tienda) es una columna, no un desplegable.
// Atrasados y entregados muestran el Atraso (en los entregados, los días con que se entregó).
// Dibuja todas las filas de la sección.
export function htmlTablaSeccion(sec, info, taller = false, avatar = true) {
  // Una sola lista por fecha de entrega (la más próxima primero), sin importar a qué persona, taller o tienda pertenece cada fila.
  const items = sec.grupos.flatMap(g => g.vales.map(v => ({ g, v }))).sort((a, b) => String(a.v.fechaEntrega).localeCompare(String(b.v.fechaEntrega)) || a.v.id - b.v.id);
  if (!items.length) return '<p class="rep-sin-vales">Sin vales con entrega en este período.</p>';
  const ctx = { clave: sec.clave, info, taller, avatar };
  const filas = items.map(({ g, v }) => htmlFila(g, v, ctx)).join('');
  const conAtraso = sec.clave === 'atrasados' || sec.clave === 'entregados';
  return `<div class="rep-mini-caja"><div class="rep-mini-wrap"><table class="rep-mini rep-mini--plana${taller ? ' rep-mini--taller' : ''}"><thead><tr><th>Vale</th><th>${info.texto}</th>${taller ?'<th>Fecha de ingreso</th>' : ''}<th>Estado</th><th>Entrega</th>${conAtraso ? '<th>Atraso</th>' : ''}<th>Acciones</th></tr></thead><tbody>${filas}</tbody></table></div></div>`;
}

// Secciones del reporte (tras «Atrasados antes del período»): cada una plegable, con su contador.
export const SECCIONES_REPORTE = [
  { clave: 'atrasados', titulo: 'Atrasados en el período', icono: 'alert-circle', sub: 'Entrega en el período, vencidos y aún abiertos' },
  { clave: 'noEntregados', titulo: 'No entregados', icono: 'time-outline', sub: 'En curso y dentro del plazo' },
  { clave: 'entregados', titulo: 'Entregados', icono: 'checkmark-circle', sub: '' }
];
const leerSeccionPlegada = (clave) => {
  try {
    const guardado = localStorage.getItem(`vales:repSec:${clave}`);
    if (guardado !== null) return guardado === '1';
  } catch { /* sin almacenamiento */ }
  return clave === 'entregados'; // lo ya resuelto arranca plegado (el contador sigue visible)
};
const guardarSeccionPlegada = (clave, plegada) => { try { localStorage.setItem(`vales:repSec:${clave}`, plegada ? '1' : '0'); } catch { /* sin almacenamiento */ } };

// `cuerpo` es una función que arma el HTML: si la sección arranca plegada no se llama hasta abrirla (dibujo a demanda).
export function htmlSeccion({ clave, titulo, icono, sub, total, cuerpo, prefijo = 'rep-sec' }) { // `prefijo` evita ids repetidos entre pestañas
  const plegada = leerSeccionPlegada(clave);
  if (plegada) diferidos.set(`${prefijo}-${clave}`, cuerpo);
  return `
    <section class="rep-seccion rep-seccion--${clave}" data-seccion="${clave}" aria-label="${escapeHtml(titulo)}">
      <button type="button" class="rep-seccion-cab" aria-expanded="${!plegada}" aria-controls="${prefijo}-${clave}">
        <ion-icon name="${icono}" class="rep-seccion-icono" aria-hidden="true"></ion-icon>
        <span class="rep-seccion-titulo">${escapeHtml(titulo)}</span>
        <span class="rep-seccion-n">${total}</span>
        <span class="rep-seccion-sub">${escapeHtml(sub)}</span>
        <ion-icon name="chevron-down-outline" class="rep-seccion-chevron" aria-hidden="true"></ion-icon>
      </button>
      <div class="rep-seccion-cuerpo" id="${prefijo}-${clave}"${plegada ? ' hidden' : ''}>${plegada ? '' : cuerpo()}</div>
    </section>`;
}

// Primera apertura de una sección que arrancó plegada: recién ahora se crean sus filas.
function construirDiferido(cuerpo) {
  const construir = diferidos.get(cuerpo.id);
  if (!construir) return;
  diferidos.delete(cuerpo.id);
  cuerpo.innerHTML = construir();
  conectarAcciones(cuerpo);
}

export function conectarSecciones(panel) {
  panel.querySelectorAll('.rep-seccion').forEach(sec => {
    const cab = $('.rep-seccion-cab', sec);
    cab.addEventListener('click', () => {
      const abrir = cab.getAttribute('aria-expanded') !== 'true';
      cab.setAttribute('aria-expanded', String(abrir));
      const cuerpo = $('.rep-seccion-cuerpo', sec);
      if (abrir) construirDiferido(cuerpo);
      cuerpo.hidden = !abrir;
      guardarSeccionPlegada(sec.dataset.seccion, !abrir);
    });
  });
}

// Acciones de cada vale: ver el vale (PDF) y ver su propuesta.
export function conectarAcciones(cuerpo) {
  cuerpo.querySelectorAll('[data-ver]').forEach(b => b.addEventListener('click', () => (b.dataset.multitaller
    ? abrirVisorMultitaller({ id: b.dataset.ver, correlativo: b.dataset.correlativo })
    : abrirVisorVale({ id: b.dataset.ver, correlativo: b.dataset.correlativo, propuesta: b.dataset.conPropuesta ? { tipo: 'ultima' } : null }))));
  // Historial del vale: solo para quien tiene el permiso (`vales.ver_historial`); es el mismo modal del buzón.
  cuerpo.querySelectorAll('[data-historial]').forEach(b => b.addEventListener('click', () => abrirModalHistorial({ id: b.dataset.historial, correlativo: b.dataset.correlativo })));
}
