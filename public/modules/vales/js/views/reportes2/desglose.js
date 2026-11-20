import { $ } from '../../utils/dom.js';
import { escapeHtml, formatearFecha, formatearFechaHora, inicialesAvatar } from '../../utils/formato.js';
import { celdaEstado } from '../../components/pipeline.js';
import { abrirVisorVale } from '../../components/visorDocumento.js';
import { abrirVisorMultitaller } from '../../actions/propuestasMultitaller.js';
import { siguienteTramo, datosVerMas } from './desglosePaginado.js';
import { TEXTOS_DESGLOSE } from './textos.js';

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

// Tablas con filas aún sin dibujar (por id) y cuerpos plegados sin construir (por id del cuerpo); se vacían en cada panel nuevo.
const paginas = new Map();
const diferidos = new Map();
let secuencia = 0;
export function reiniciarDesglose() { paginas.clear(); diferidos.clear(); }

// Una fila de la tabla: la misma para las primeras filas y para las que llegan con «Ver más».
function htmlFila(g, v, { clave, info, taller, avatar }) {
  const conAtraso = clave === 'atrasados' || clave === 'entregados';
  return `
    <tr>
      <td class="rep-c-vale" data-label="Vale"><strong>${escapeHtml(v.correlativo)}</strong>${v.esMod ? '<span class="badge badge-mod">MOD</span>' : ''}${v.urgente ? '<span class="badge badge-urgente">URGENTE</span>' : ''}${taller ? '' : `<span class="rep-cliente">${escapeHtml(v.cliente)}</span>`}</td>
      <td class="rep-c-grupo" data-label="${info.texto}"><span class="rep-grupo-nombre">${avatar ? `<span class="rep-avatar" aria-hidden="true">${escapeHtml(inicialesAvatar(g.nombre))}</span>` : ''}<span>${escapeHtml(g.nombre)}</span></span></td>
      ${taller ? `<td class="rep-c-ingreso" data-label="Fecha de ingreso">${escapeHtml(formatearFechaHora(v.creadoEn))}</td>` : ''}
      <td class="rep-c-estado" data-label="Estado">${celdaEstado(v)}</td>
      <td class="rep-c-entrega fecha-entrega" data-label="Entrega">${escapeHtml(formatearFecha(v.fechaEntrega))}</td>
      ${conAtraso ? `<td class="rep-c-atraso" data-label="Atraso">${clave === 'entregados' ? htmlAtrasoEntregado(v) : htmlAtraso(v)}</td>` : ''}
      <td class="rep-acciones-celda rep-c-acciones" data-label="Acciones"><div class="rep-acciones-fila">
        <button type="button" class="btn-icon" data-ver="${v.id}" data-correlativo="${escapeHtml(v.correlativo)}"${v.tienePropuesta ? ' data-con-propuesta="1"' : ''}${v.multitaller ? ' data-multitaller="1"' : ''} title="Ver vale" aria-label="Ver vale ${escapeHtml(v.correlativo)}"><ion-icon name="eye-outline"></ion-icon></button>
      </div></td>
    </tr>`;
}

const htmlBotonVerMas = (id, quedan) => {
  const { n, quedan: q } = datosVerMas(quedan);
  return `<div class="rep-ver-mas"><button type="button" class="btn btn--ghost btn--sm" data-ver-mas="${id}">${escapeHtml(TEXTOS_DESGLOSE.verMas(n, q))}</button></div>`;
};

// Una sola tabla por sección con todos sus vales: la persona (o taller/tienda) es una columna, no un desplegable.
// Atrasados y entregados muestran el Atraso (en los entregados, los días con que se entregó).
// Dibuja solo las primeras filas; el resto queda en memoria (`paginas`) y se agrega con «Ver más».
export function htmlTablaSeccion(sec, info, taller = false, avatar = true) {
  const items = sec.grupos.flatMap(g => g.vales.map(v => ({ g, v })));
  if (!items.length) return '<p class="rep-sin-vales">Sin vales con entrega en este período.</p>';
  const ctx = { clave: sec.clave, info, taller, avatar };
  const { hasta, quedan } = siguienteTramo(items.length, 0);
  const filas = items.slice(0, hasta).map(({ g, v }) => htmlFila(g, v, ctx)).join('');
  let verMas = '';
  if (quedan > 0) {
    const id = `pag-${++secuencia}`;
    paginas.set(id, { items, ctx, mostrados: hasta });
    verMas = htmlBotonVerMas(id, quedan);
  }
  const conAtraso = sec.clave === 'atrasados' || sec.clave === 'entregados';
  return `<div class="rep-mini-wrap"><table class="rep-mini rep-mini--plana${taller ? ' rep-mini--taller' : ''}"><thead><tr><th>Vale</th><th>${info.texto}</th>${taller ?'<th>Fecha de ingreso</th>' : ''}<th>Estado</th><th>Entrega</th>${conAtraso ? '<th>Atraso</th>' : ''}<th>Acciones</th></tr></thead><tbody>${filas}</tbody></table></div>${verMas}`;
}

// «Ver N más»: agrega la siguiente tanda a la misma tabla y conecta solo las filas nuevas (sin duplicar eventos).
function verMas(boton) {
  const id = boton.dataset.verMas;
  const pag = paginas.get(id);
  if (!pag) return;
  const { desde, hasta, quedan } = siguienteTramo(pag.items.length, pag.mostrados);
  const caja = boton.closest('.rep-ver-mas');
  const tbody = $('tbody', caja.previousElementSibling);
  const antes = tbody.rows.length;
  tbody.insertAdjacentHTML('beforeend', pag.items.slice(desde, hasta).map(({ g, v }) => htmlFila(g, v, pag.ctx)).join(''));
  for (let i = antes; i < tbody.rows.length; i++) conectarAcciones(tbody.rows[i]);
  pag.mostrados = hasta;
  if (quedan > 0) {
    const { n, quedan: q } = datosVerMas(quedan);
    boton.textContent = TEXTOS_DESGLOSE.verMas(n, q);
    return;
  }
  // Sin más filas el botón desaparece: el foco pasa a la primera fila nueva para no perderlo.
  paginas.delete(id);
  const primera = tbody.rows[antes] && tbody.rows[antes].querySelector('[data-ver]');
  if (primera) primera.focus();
  caja.hidden = true;
}

export function conectarVerMas(raiz) {
  raiz.querySelectorAll('[data-ver-mas]').forEach(b => b.addEventListener('click', () => verMas(b)));
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
  conectarVerMas(cuerpo);
}

export function conectarSecciones(panel) {
  conectarVerMas(panel); // las secciones desplegadas ya traen sus filas; las plegadas se conectan al abrirse
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
}
