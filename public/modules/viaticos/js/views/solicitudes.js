// Pestaña «Solicitudes»: lista de las solicitudes del usuario por período, con búsqueda, pipeline y acciones por fila.
import { state } from '../state.js';
import { $, h, icono, montar } from '../utils/dom.js';
import { ACCIONES } from '../config/constantes.js';
import { listarSolicitudes } from '../api/viaticosApi.js';
import { crearBarraPeriodo } from '../components/barraPeriodo.js';
import { htmlFilaSolicitud } from '../components/filaSolicitud.js';
import { abrirVisorSolicitud } from '../components/visorDocumento.js';
import { abrirFormularioSolicitud } from '../forms/solicitudForm.js';
import { crearBotonBorradores } from '../forms/borradores.js';
import { abrirLiquidacion } from '../actions/liquidacion.js';
import { darDeBaja } from '../actions/solicitudAcciones.js';
import { registrarRecarga } from '../socket.js';
import { aplicarPeriodoAConsulta, periodoInicial } from '../utils/periodo.js';
import { escapeHtml } from '../utils/formato.js';
import { t } from '../textos.js';

const ESPERA_BUSQUEDA_MS = 300;
const MAX_BUSQUEDA = 50;

// Referencias de la vista abierta: una respuesta que llega con la vista ya cerrada (nodos desconectados) se descarta.
let vista = null;
let solicitudes = [];
let numeroCarga = 0;
let hayDatos = false;
let accionEnCurso = false;

const estado = (nombreIcono, titulo, texto, { error = false, spinner = false, reintentar = false } = {}) => {
  const nodoIcono = icono(nombreIcono);
  if (spinner) nodoIcono.classList.add('spin-animation');
  return h('div', { class: `buzon-vacio${error ? ' buzon-vacio-error' : ''}` },
    nodoIcono,
    titulo && h('h3', { text: titulo }),
    texto && h('p', { text: texto }),
    reintentar && h('button', { class: 'btn btn--primary btn--sm', type: 'button', text: t('comun.reintentar'), onclick: () => cargarSolicitudes({ conEstado: true }) }));
};

// Una sola fila que ocupa toda la tabla (cargando, vacío o error).
const filaDeEstado = (nodo) => {
  const td = h('td', { class: 'tabla-vacia', colspan: '6' }, nodo);
  return h('tr', null, td);
};

function pintarResumen(n) {
  const resumen = $('#vi-solicitudes-resumen');
  if (!resumen) return;
  resumen.textContent = n === null ? '' : (n === 1 ? t('solicitudes.resumen.una') : t('solicitudes.resumen.varias', { n }));
}

function pintarTabla() {
  const tbody = vista.tbody;
  if (solicitudes.length === 0) {
    const conBusqueda = !!state.busqueda;
    montar(tbody, filaDeEstado(conBusqueda
      ? estado('search-outline', t('solicitudes.sinResultados.titulo'), t('solicitudes.sinResultados.texto', { busqueda: state.busqueda }))
      : estado('document-outline', t('solicitudes.vacio.titulo'), t('solicitudes.vacio.texto'))));
    return;
  }
  tbody.innerHTML = solicitudes.map(htmlFilaSolicitud).join('');
}

// `conEstado`: muestra «cargando» y vuelve la tabla arriba (cambio de período o de búsqueda). Un refresco en vivo no mueve nada.
export async function cargarSolicitudes({ conEstado = false } = {}) {
  if (!vista || !vista.tbody.isConnected) return;
  const { tbody, zona } = vista;
  const numero = ++numeroCarga;
  if (conEstado || !hayDatos) {
    montar(tbody, filaDeEstado(estado('sync-outline', null, t('solicitudes.cargando'), { spinner: true })));
    pintarResumen(null);
  }
  if (conEstado) zona.scrollTop = 0;
  try {
    const respuesta = await listarSolicitudes({ ...aplicarPeriodoAConsulta(state.ventana), q: state.busqueda });
    // Una respuesta lenta no pisa a otra más reciente ni a una vista ya cerrada.
    if (numero !== numeroCarga || !tbody.isConnected) return;
    solicitudes = respuesta.solicitudes || [];
    hayDatos = true;
    pintarTabla();
    pintarResumen(solicitudes.length);
  } catch (error) {
    if (numero !== numeroCarga || !tbody.isConnected) return;
    // Un refresco en vivo fallido no borra lo que ya se ve; la próxima carga o «Reintentar» lo resuelve.
    if (hayDatos && !conEstado) { console.error('No se pudo refrescar la lista de solicitudes:', error); return; }
    hayDatos = false;
    solicitudes = [];
    pintarResumen(null);
    montar(tbody, filaDeEstado(estado('alert-circle-outline', t('solicitudes.error.titulo'), error.message, { error: true, reintentar: true })));
  }
}

const ACCIONES_FILA = {
  [ACCIONES.VER]: (solicitud) => abrirVisorSolicitud(solicitud),
  [ACCIONES.MODIFICAR]: (solicitud) => abrirFormularioSolicitud({ modo: 'modificar', solicitud, alTerminar: () => cargarSolicitudes() }),
  [ACCIONES.DAR_DE_BAJA]: (solicitud) => darDeBaja(solicitud, cargarSolicitudes),
  [ACCIONES.LIQUIDAR]: (solicitud) => abrirLiquidacion(solicitud, { alTerminar: () => cargarSolicitudes() })
};

// Delegación en el tbody: la fila se repinta en cada carga y sus botones no llevan listeners propios.
async function alPulsarFila(evento) {
  const boton = evento.target.closest('[data-accion]');
  if (!boton || accionEnCurso) return;
  const solicitud = solicitudes.find(s => Number(s.id) === Number(boton.dataset.id));
  const accion = ACCIONES_FILA[boton.dataset.accion];
  if (!solicitud || !accion) return;
  accionEnCurso = true;
  try {
    await accion(solicitud);
  } finally {
    accionEnCurso = false;
  }
}

function htmlCabeceras() {
  return ['correlativo', 'fechaCreacion', 'fechaViaticos', 'tipo', 'estado', 'acciones']
    .map(clave => `<th>${escapeHtml(t(`solicitudes.col.${clave}`))}</th>`).join('');
}

export function renderSolicitudes(contenedor) {
  if (vista && vista.barra) vista.barra.cerrar();
  state.ventana = state.ventana || periodoInicial();
  // Con la tabla fija solo se desplaza la tabla; panel.js quita la clase al cambiar de pestaña.
  document.body.classList.add('vista-tabla-fija');
  solicitudes = [];
  hayDatos = false;

  const barraPeriodo = h('div', { class: 'rp-barra rp-barra--toolbar', id: 'vi-periodo-barra' });
  const botonNueva = h('button', { class: 'btn btn--primary vi-btn-nueva', type: 'button', onclick: () => abrirFormularioSolicitud({ modo: 'crear', alTerminar: () => cargarSolicitudes() }) },
    icono('add-outline'), t('solicitudes.nueva'));
  const buscador = h('input', {
    type: 'text', id: 'vi-solicitudes-buscar', placeholder: t('solicitudes.buscar'), 'aria-label': t('solicitudes.buscarAria'),
    maxlength: String(MAX_BUSQUEDA), autocomplete: 'off', value: state.busqueda || ''
  });
  const tbody = h('tbody', { id: 'vi-solicitudes-tbody', onclick: alPulsarFila });
  const tabla = h('table', { class: 'buzon-table data-table sticky-header' },
    h('thead', null, h('tr', { html: htmlCabeceras() })), tbody);
  const zona = h('div', { class: 'tabla-wrapper', tabindex: '0', role: 'region', 'aria-label': t('solicitudes.tablaAria') }, tabla);

  montar(contenedor,
    h('div', { class: 'panel-toolbar' }, barraPeriodo, h('div', { class: 'vi-toolbar-acciones' }, crearBotonBorradores({ alTerminar: () => cargarSolicitudes() }), botonNueva)),
    h('section', { class: 'vi-seccion' },
      h('div', { class: 'vi-seccion-cabecera' },
        h('h2', { text: t('tab.solicitudes.titulo') }),
        h('div', { class: 'vi-filtros' },
          h('span', { class: 'vi-lista-resumen', id: 'vi-solicitudes-resumen', 'aria-live': 'polite' }),
          h('div', { class: 'vi-buscador' }, icono('search-outline'), buscador))),
      zona));

  vista = { tbody, zona, barra: null };
  const cambiarPeriodo = (periodo) => { state.ventana = periodo; vista.barra.pintar(); cargarSolicitudes({ conEstado: true }); };
  vista.barra = crearBarraPeriodo(barraPeriodo, { prefijo: 'vi', obtener: () => state.ventana, alCambiar: cambiarPeriodo });

  // Búsqueda contra el servidor (sobre todo el período, no solo lo ya cargado); con espera para no pedir en cada tecla.
  let espera;
  buscador.addEventListener('input', () => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      const valor = buscador.value.trim();
      if (valor === state.busqueda) return;
      state.busqueda = valor;
      cargarSolicitudes({ conEstado: true });
    }, ESPERA_BUSQUEDA_MS);
  });

  registrarRecarga(cargarSolicitudes);
  cargarSolicitudes({ conEstado: true });
}
