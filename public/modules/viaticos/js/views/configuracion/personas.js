// Subpestaña «Personas»: países y licencia de conducir de cada usuario activo; solo se editan, no se agregan.
import { t } from '../../textos.js';
import { hoyMedianoche, isoLocal } from '../../utils/fechas.js';
import { listarConfig, listarPaises, listarPersonas } from '../../api/viaticosApi.js';
import { crearFiltrosRapidos } from '../../components/filtrosRapidos.js';
import { crearPanelLista, estadoLista } from './lista.js';
import { abrirEdicionPersona } from './personaForm.js';
import { htmlFilaPersona } from './personasFilas.js';
import { FILTROS_PERSONA, filtrarPersonas } from './personasModelo.js';

const OPCIONES_FILTRO = [
  [FILTROS_PERSONA.TODAS, 'config.personas.filtro.todas'],
  [FILTROS_PERSONA.CON_LICENCIA, 'config.personas.filtro.conLicencia'],
  [FILTROS_PERSONA.SIN_LICENCIA, 'config.personas.filtro.sinLicencia'],
  [FILTROS_PERSONA.SIN_PAISES, 'config.personas.filtro.sinPaises']
];

export function renderPersonas(contenedor) {
  const seccion = t('config.personas.titulo');
  let personas = [];
  let busqueda = '';
  let filtro = FILTROS_PERSONA.TODAS;
  let numeroCarga = 0;
  let accionEnCurso = false;

  const filtros = crearFiltrosRapidos({
    etiquetaAria: t('config.personas.filtro.aria'), idBase: 'vi-per-filtro', activo: filtro,
    opciones: OPCIONES_FILTRO.map(([valor, clave]) => ({ valor, texto: t(clave) })),
    alCambiar: (valor) => { filtro = valor; pintar(); }
  });
  const panel = crearPanelLista({
    seccion,
    titulo: seccion,
    subtitulo: t('config.personas.subtitulo'),
    encabezados: ['nombre', 'correo', 'rol', 'paises', 'licencia', 'vence'].map(c => t(`config.personas.col.${c}`)).concat(t('config.col.acciones')),
    filtros: filtros.nodo,
    alBuscar: (texto) => { busqueda = texto.trim(); pintar(); },
    alPulsarFila: (evento) => alPulsarFila(evento)
  });
  contenedor.replaceChildren(panel.raiz);

  function pintar() {
    if (personas.length === 0) {
      panel.ponerResumen(null);
      panel.ponerEstado(estadoLista({ icono: 'people-outline', titulo: t('config.personas.vacio.titulo'), texto: t('config.personas.vacio.texto') }));
      return;
    }
    const visibles = filtrarPersonas(personas, { filtro, busqueda });
    panel.ponerResumen(visibles.length);
    if (visibles.length === 0) {
      panel.ponerEstado(estadoLista({ icono: 'search-outline', titulo: t('config.lista.sinResultados.titulo'), texto: busqueda ? t('config.lista.sinResultados.texto', { busqueda }) : t('config.personas.sinResultadosFiltro') }));
      return;
    }
    const hoy = isoLocal(hoyMedianoche());
    panel.ponerFilas(visibles.map(p => htmlFilaPersona(p, hoy)).join(''));
  }

  async function cargar({ conEstado = true } = {}) {
    const numero = ++numeroCarga;
    if (conEstado) {
      panel.ponerEstado(estadoLista({ icono: 'sync-outline', spinner: true, texto: t('config.lista.cargando', { seccion }) }));
      panel.ponerResumen(null);
    }
    try {
      const datos = await listarPersonas();
      // Una respuesta tardía no pisa a otra más reciente ni a una sección ya cerrada.
      if (numero !== numeroCarga || !panel.tbody.isConnected) return;
      personas = Array.isArray(datos) ? datos : [];
      pintar();
    } catch (error) {
      if (numero !== numeroCarga || !panel.tbody.isConnected) return;
      personas = [];
      panel.ponerResumen(null);
      panel.ponerEstado(estadoLista({ icono: 'alert-circle-outline', titulo: t('config.lista.error', { seccion }), texto: error.message, error: true, alReintentar: () => cargar() }));
    }
  }

  async function abrirEdicion(persona) {
    let catalogos;
    try {
      const [paises, tipos] = await Promise.all([listarPaises(), listarConfig('tipos-licencia')]);
      catalogos = { paises, tiposLicencia: tipos.filter(tp => tp.activo) };
    } catch (error) {
      window.toast?.error(t('config.personas.errorCatalogos'), error.message);
      return;
    }
    abrirEdicionPersona({ persona, ...catalogos, alGuardar: () => cargar({ conEstado: false }) });
  }

  // Delegación en el tbody: las filas se repintan en cada carga y sus botones no llevan listeners propios.
  async function alPulsarFila(evento) {
    const boton = evento.target.closest('[data-accion="editar"]');
    if (!boton || accionEnCurso) return;
    const persona = personas.find(p => Number(p.id) === Number(boton.dataset.id));
    if (!persona) return;
    accionEnCurso = true;
    try {
      await abrirEdicion(persona);
    } finally {
      accionEnCurso = false;
    }
  }

  return cargar();
}
