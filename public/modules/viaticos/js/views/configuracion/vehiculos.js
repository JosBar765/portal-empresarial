// Subpestaña «Vehículos»: los de la empresa y los propios de las personas; alta, edición y activar o desactivar.
import { t } from '../../textos.js';
import { hoyMedianoche, isoLocal } from '../../utils/fechas.js';
import { cambiarActivoConfig, listarCombustibles, listarConfig, listarPaises, listarPersonas } from '../../api/viaticosApi.js';
import { confirmarModal } from '../../components/modal.js';
import { crearFiltrosRapidos } from '../../components/filtrosRapidos.js';
import { crearPanelLista, estadoLista } from './lista.js';
import { abrirFormularioVehiculo } from './vehiculoForm.js';
import { htmlFilaVehiculo } from './vehiculosFilas.js';
import { FILTROS_VEHICULO, filtrarVehiculos } from './vehiculosModelo.js';

const OPCIONES_FILTRO = [
  [FILTROS_VEHICULO.TODOS, 'config.vehiculos.filtro.todos'],
  [FILTROS_VEHICULO.EMPRESA, 'config.vehiculos.filtro.empresa'],
  [FILTROS_VEHICULO.PROPIOS, 'config.vehiculos.filtro.propios']
];

export function renderVehiculos(contenedor) {
  const seccion = t('config.vehiculos.titulo');
  let vehiculos = [];
  let busqueda = '';
  let filtro = FILTROS_VEHICULO.TODOS;
  let numeroCarga = 0;
  let accionEnCurso = false;

  const filtros = crearFiltrosRapidos({
    etiquetaAria: t('config.vehiculos.filtro.aria'), idBase: 'vi-veh-filtro', activo: filtro,
    opciones: OPCIONES_FILTRO.map(([valor, clave]) => ({ valor, texto: t(clave) })),
    alCambiar: (valor) => { filtro = valor; pintar(); }
  });
  const panel = crearPanelLista({
    seccion,
    titulo: seccion,
    subtitulo: t('config.vehiculos.subtitulo'),
    encabezados: ['placa', 'vehiculo', 'pais', 'propietario', 'tipoPlaca', 'combustible', 'tarjeta', 'poliza'].map(c => t(`config.vehiculos.col.${c}`)).concat(t('config.col.estado'), t('config.col.acciones')),
    filtros: filtros.nodo,
    alAgregar: () => abrirFormulario(null),
    alBuscar: (texto) => { busqueda = texto.trim(); pintar(); },
    alPulsarFila: (evento) => alPulsarFila(evento)
  });
  contenedor.replaceChildren(panel.raiz);

  function pintar() {
    if (vehiculos.length === 0) {
      panel.ponerResumen(null);
      panel.ponerEstado(estadoLista({ icono: 'car-outline', titulo: t('config.vehiculos.vacio.titulo'), texto: t('config.vehiculos.vacio.texto') }));
      return;
    }
    const visibles = filtrarVehiculos(vehiculos, { filtro, busqueda });
    panel.ponerResumen(visibles.length);
    if (visibles.length === 0) {
      panel.ponerEstado(estadoLista({ icono: 'search-outline', titulo: t('config.lista.sinResultados.titulo'), texto: busqueda ? t('config.lista.sinResultados.texto', { busqueda }) : t('config.vehiculos.sinResultadosFiltro') }));
      return;
    }
    const hoy = isoLocal(hoyMedianoche());
    panel.ponerFilas(visibles.map(v => htmlFilaVehiculo(v, hoy)).join(''));
  }

  async function cargar({ conEstado = true } = {}) {
    const numero = ++numeroCarga;
    if (conEstado) {
      panel.ponerEstado(estadoLista({ icono: 'sync-outline', spinner: true, texto: t('config.lista.cargando', { seccion }) }));
      panel.ponerResumen(null);
    }
    try {
      const datos = await listarConfig('vehiculos');
      // Una respuesta tardía no pisa a otra más reciente ni a una sección ya cerrada.
      if (numero !== numeroCarga || !panel.tbody.isConnected) return;
      vehiculos = Array.isArray(datos) ? datos : [];
      pintar();
    } catch (error) {
      if (numero !== numeroCarga || !panel.tbody.isConnected) return;
      vehiculos = [];
      panel.ponerResumen(null);
      panel.ponerEstado(estadoLista({ icono: 'alert-circle-outline', titulo: t('config.lista.error', { seccion }), texto: error.message, error: true, alReintentar: () => cargar() }));
    }
  }

  async function abrirFormulario(vehiculo) {
    let catalogos;
    try {
      const [paises, tiposPlaca, combustibles, personas] = await Promise.all([listarPaises(), listarConfig('tipos-placa'), listarCombustibles(), listarPersonas()]);
      catalogos = { paises, tiposPlaca, combustibles, personas };
    } catch (error) {
      window.toast?.error(t('config.vehiculos.errorCatalogos'), error.message);
      return;
    }
    abrirFormularioVehiculo({ vehiculo, ...catalogos, alGuardar: () => cargar({ conEstado: false }) });
  }

  async function alternar(vehiculo) {
    const activar = !vehiculo.activo;
    const nombre = vehiculo.placa;
    const confirmado = await confirmarModal({
      title: t(activar ? 'config.confirmar.activar.titulo' : 'config.confirmar.desactivar.titulo'),
      mensaje: t(activar ? 'config.vehiculos.confirmar.activar' : 'config.vehiculos.confirmar.desactivar', { nombre }),
      aceptar: t(activar ? 'config.accion.activar' : 'config.accion.desactivar'),
      peligro: !activar
    });
    if (!confirmado) return;
    try {
      await cambiarActivoConfig('vehiculos', vehiculo.id, activar);
    } catch (error) {
      window.toast?.error(t('config.toast.errorEstado'), error.message);
      return;
    }
    window.toast?.success(t('tab.configuracion'), t(activar ? 'config.toast.activado' : 'config.toast.desactivado', { nombre }));
    await cargar({ conEstado: false });
  }

  // Delegación en el tbody: las filas se repintan en cada carga y sus botones no llevan listeners propios.
  async function alPulsarFila(evento) {
    const boton = evento.target.closest('[data-accion]');
    if (!boton || accionEnCurso) return;
    const vehiculo = vehiculos.find(f => Number(f.id) === Number(boton.dataset.id));
    if (!vehiculo) return;
    accionEnCurso = true;
    try {
      if (boton.dataset.accion === 'editar') await abrirFormulario(vehiculo);
      else if (boton.dataset.accion === 'alternar') await alternar(vehiculo);
    } finally {
      accionEnCurso = false;
    }
  }

  return cargar();
}
