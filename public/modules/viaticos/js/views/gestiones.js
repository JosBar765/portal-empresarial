// Pestaña «Gestiones»: todas las solicitudes por período, con búsqueda, pipeline y las acciones que el usuario puede hacer en cada una.
import { state } from '../state.js';
import { $, h, icono, montar } from '../utils/dom.js';
import { ACCIONES } from '../config/constantes.js';
import { listarGestiones } from '../api/viaticosApi.js';
import { crearBarraPeriodo } from '../components/barraPeriodo.js';
import { htmlFilaGestion } from '../components/filaGestion.js';
import { abrirVisorSolicitud } from '../components/visorDocumento.js';
import { autorizar, rechazar } from '../actions/gestionAcciones.js';
import { abrirLiquidacionGestion } from '../actions/liquidacionGestion.js';
import { registrarRecarga } from '../socket.js';
import { aplicarPeriodoAConsulta, periodoInicial } from '../utils/periodo.js';
import { escapeHtml } from '../utils/formato.js';
import { t } from '../textos.js';

const ESPERA_BUSQUEDA_MS = 300;
const MAX_BUSQUEDA = 50;
const COLUMNAS = ['correlativo', 'solicitante', 'fechaCreacion', 'fechaViaticos', 'tipo', 'estado', 'acciones'];

// Referencias de la vista abierta: una respuesta que llega con la vista ya cerrada (nodos desconectados) se descarta.
let vista = null;
let gestiones = [];
let numeroCarga = 0;
let hayDatos = false;
let accionEnCurso = false;

const estado = (nombreIcono, titulo, texto, { error = false, spinner = false, reintentar = false } = {}) => {
  const nodoIcono = icono(nombreIcono);
  if (spinner) nodoIcono.classList.add('spin-animation');
  return h('div', { class: `buzon-vacio${error ? ' buzon-vacio-error' : ''}`, role: error ? 'alert' : null },
    nodoIcono,
    titulo && h('h3', { text: titulo }),
    texto && h('p', { text: texto }),
    reintentar && h('button', { class: 'btn btn--primary btn--sm', type: 'button', text: t('comun.reintentar'), onclick: () => cargarGestiones({ conEstado: true }) }));
};

// Una sola fila que ocupa toda la tabla (cargando, vacío o error).
const filaDeEstado = (nodo) => h('tr', null, h('td', { class: 'tabla-vacia', colspan: String(COLUMNAS.length) }, nodo));

function pintarResumen(n) {
  const resumen = $('#vi-gestiones-resumen');
  if (!resumen) return;
  resumen.textContent = n === null ? '' : (n === 1 ? t('solicitudes.resumen.una') : t('solicitudes.resumen.varias', { n }));
}

function pintarTabla() {
  const tbody = vista.tbody;
  if (gestiones.length === 0) {
    montar(tbody, filaDeEstado(state.busquedaGestion
      ? estado('search-outline', t('gestiones.sinResultados.titulo'), t('gestiones.sinResultados.texto', { busqueda: state.busquedaGestion }))
      : estado('document-outline', t('gestiones.vacio.titulo'), t('gestiones.vacio.texto'))));
    return;
  }
  tbody.innerHTML = gestiones.map(htmlFilaGestion).join('');
}

// `conEstado`: muestra «cargando» y vuelve la tabla arriba (cambio de período o de búsqueda). Un refresco en vivo no mueve nada.
export async function cargarGestiones({ conEstado = false } = {}) {
  if (!vista || !vista.tbody.isConnected) return;
  const { tbody, zona } = vista;
  const numero = ++numeroCarga;
  if (conEstado || !hayDatos) {
    montar(tbody, filaDeEstado(estado('sync-outline', null, t('gestiones.cargando'), { spinner: true })));
    pintarResumen(null);
  }
  if (conEstado) zona.scrollTop = 0;
  try {
    const respuesta = await listarGestiones({ ...aplicarPeriodoAConsulta(state.ventanaGestion), q: state.busquedaGestion });
    // Una respuesta lenta no pisa a otra más reciente ni a una vista ya cerrada.
    if (numero !== numeroCarga || !tbody.isConnected) return;
    gestiones = respuesta.solicitudes || [];
    hayDatos = true;
    pintarTabla();
    pintarResumen(gestiones.length);
  } catch (error) {
    if (numero !== numeroCarga || !tbody.isConnected) return;
    // Un refresco en vivo fallido no borra lo que ya se ve; la próxima carga o «Reintentar» lo resuelve.
    if (hayDatos && !conEstado) { console.error('No se pudo refrescar la lista de gestiones:', error); return; }
    hayDatos = false;
    gestiones = [];
    pintarResumen(null);
    montar(tbody, filaDeEstado(estado('alert-circle-outline', t('gestiones.error.titulo'), error.message, { error: true, reintentar: true })));
  }
}

const recargar = () => cargarGestiones();

const ACCIONES_FILA = {
  [ACCIONES.VER]: (solicitud) => abrirVisorSolicitud(solicitud, { gestion: true }),
  [ACCIONES.AUTORIZAR]: (solicitud) => autorizar(solicitud, { alTerminar: recargar }),
  [ACCIONES.RECHAZAR]: (solicitud) => rechazar(solicitud, { alTerminar: recargar }),
  [ACCIONES.LIQUIDAR]: (solicitud) => abrirLiquidacionGestion(solicitud)
};

// Delegación en el tbody: la fila se repinta en cada carga y sus botones no llevan listeners propios.
async function alPulsarFila(evento) {
  const boton = evento.target.closest('[data-accion]');
  if (!boton || accionEnCurso) return;
  const solicitud = gestiones.find(s => Number(s.id) === Number(boton.dataset.id));
  const accion = ACCIONES_FILA[boton.dataset.accion];
  if (!solicitud || !accion) return;
  accionEnCurso = true;
  try {
    await accion(solicitud);
  } finally {
    accionEnCurso = false;
  }
}

const htmlCabeceras = () => COLUMNAS.map(clave => `<th>${escapeHtml(t(`gestiones.col.${clave}`))}</th>`).join('');

export function renderGestiones(contenedor) {
  if (vista && vista.barra) vista.barra.cerrar();
  state.ventanaGestion = state.ventanaGestion || periodoInicial();
  // Con la tabla fija solo se desplaza la tabla; panel.js quita la clase al cambiar de pestaña.
  document.body.classList.add('vista-tabla-fija');
  gestiones = [];
  hayDatos = false;
  accionEnCurso = false;

  const barraPeriodo = h('div', { class: 'rp-barra rp-barra--toolbar', id: 'vi-gestiones-periodo-barra' });
  const buscador = h('input', {
    type: 'text', id: 'vi-gestiones-buscar', placeholder: t('gestiones.buscar'), 'aria-label': t('gestiones.buscarAria'),
    maxlength: String(MAX_BUSQUEDA), autocomplete: 'off', value: state.busquedaGestion || ''
  });
  const tbody = h('tbody', { id: 'vi-gestiones-tbody', onclick: alPulsarFila });
  const tabla = h('table', { class: 'buzon-table data-table sticky-header' },
    h('thead', null, h('tr', { html: htmlCabeceras() })), tbody);
  const zona = h('div', { class: 'tabla-wrapper', tabindex: '0', role: 'region', 'aria-label': t('gestiones.tablaAria') }, tabla);

  montar(contenedor,
    h('div', { class: 'panel-toolbar' }, barraPeriodo),
    h('section', { class: 'vi-seccion' },
      h('div', { class: 'vi-seccion-cabecera' },
        h('h2', { text: t('gestiones.titulo') }),
        h('div', { class: 'vi-filtros' },
          h('span', { class: 'vi-resumen', id: 'vi-gestiones-resumen', 'aria-live': 'polite' }),
          h('div', { class: 'vi-buscador' }, icono('search-outline'), buscador))),
      zona));

  vista = { tbody, zona, barra: null };
  const cambiarPeriodo = (periodo) => { state.ventanaGestion = periodo; vista.barra.pintar(); cargarGestiones({ conEstado: true }); };
  vista.barra = crearBarraPeriodo(barraPeriodo, { prefijo: 'vg', obtener: () => state.ventanaGestion, alCambiar: cambiarPeriodo });

  // Búsqueda contra el servidor (sobre todo el período, no solo lo ya cargado); con espera para no pedir en cada tecla.
  let espera;
  buscador.addEventListener('input', () => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      const valor = buscador.value.trim();
      if (valor === state.busquedaGestion) return;
      state.busquedaGestion = valor;
      cargarGestiones({ conEstado: true });
    }, ESPERA_BUSQUEDA_MS);
  });

  registrarRecarga(cargarGestiones);
  cargarGestiones({ conEstado: true });
}
