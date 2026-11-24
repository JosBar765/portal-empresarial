// Subpestaña «Pilotos»: repartidores de la empresa que manejan en los viajes que tramita un solicitante; alta, edición y activar o desactivar.
import { t } from '../../textos.js';
import { hoyMedianoche, isoLocal } from '../../utils/fechas.js';
import { cambiarActivoConfig, listarConfig } from '../../api/viaticosApi.js';
import { confirmarModal } from '../../components/modal.js';
import { crearPanelLista, estadoLista } from './lista.js';
import { abrirFormularioPiloto } from './pilotoForm.js';
import { htmlFilaPiloto } from './pilotosFilas.js';
import { filtrarPilotos } from './pilotosModelo.js';

export function renderPilotos(contenedor) {
  const seccion = t('config.pilotos.titulo');
  let pilotos = [];
  let busqueda = '';
  let numeroCarga = 0;
  let accionEnCurso = false;

  const panel = crearPanelLista({
    seccion,
    titulo: seccion,
    subtitulo: t('config.pilotos.subtitulo'),
    encabezados: ['nombre', 'licencia', 'numero', 'vence'].map(c => t(`config.pilotos.col.${c}`)).concat(t('config.col.estado'), t('config.col.acciones')),
    alAgregar: () => abrirFormulario(null),
    alBuscar: (texto) => { busqueda = texto.trim(); pintar(); },
    alPulsarFila: (evento) => alPulsarFila(evento)
  });
  contenedor.replaceChildren(panel.raiz);

  function pintar() {
    if (pilotos.length === 0) {
      panel.ponerResumen(null);
      panel.ponerEstado(estadoLista({ icono: 'person-outline', titulo: t('config.pilotos.vacio.titulo'), texto: t('config.pilotos.vacio.texto') }));
      return;
    }
    const visibles = filtrarPilotos(pilotos, busqueda);
    panel.ponerResumen(visibles.length);
    if (visibles.length === 0) {
      panel.ponerEstado(estadoLista({ icono: 'search-outline', titulo: t('config.lista.sinResultados.titulo'), texto: t('config.lista.sinResultados.texto', { busqueda }) }));
      return;
    }
    const hoy = isoLocal(hoyMedianoche());
    panel.ponerFilas(visibles.map(p => htmlFilaPiloto(p, hoy)).join(''));
  }

  async function cargar({ conEstado = true } = {}) {
    const numero = ++numeroCarga;
    if (conEstado) {
      panel.ponerEstado(estadoLista({ icono: 'sync-outline', spinner: true, texto: t('config.lista.cargando', { seccion }) }));
      panel.ponerResumen(null);
    }
    try {
      const datos = await listarConfig('pilotos');
      // Una respuesta tardía no pisa a otra más reciente ni a una sección ya cerrada.
      if (numero !== numeroCarga || !panel.tbody.isConnected) return;
      pilotos = Array.isArray(datos) ? datos : [];
      pintar();
    } catch (error) {
      if (numero !== numeroCarga || !panel.tbody.isConnected) return;
      pilotos = [];
      panel.ponerResumen(null);
      panel.ponerEstado(estadoLista({ icono: 'alert-circle-outline', titulo: t('config.lista.error', { seccion }), texto: error.message, error: true, alReintentar: () => cargar() }));
    }
  }

  async function abrirFormulario(piloto) {
    let tiposLicencia;
    try {
      tiposLicencia = (await listarConfig('tipos-licencia')).filter(tp => tp.activo);
    } catch (error) {
      window.toast?.error(t('config.pilotos.errorCatalogos'), error.message);
      return;
    }
    abrirFormularioPiloto({ piloto, tiposLicencia, alGuardar: () => cargar({ conEstado: false }) });
  }

  async function alternar(piloto) {
    const activar = !piloto.activo;
    const nombre = piloto.nombre;
    const confirmado = await confirmarModal({
      title: t(activar ? 'config.confirmar.activar.titulo' : 'config.confirmar.desactivar.titulo'),
      mensaje: t(activar ? 'config.pilotos.confirmar.activar' : 'config.pilotos.confirmar.desactivar', { nombre }),
      aceptar: t(activar ? 'config.accion.activar' : 'config.accion.desactivar'),
      peligro: !activar
    });
    if (!confirmado) return;
    try {
      await cambiarActivoConfig('pilotos', piloto.id, activar);
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
    const piloto = pilotos.find(f => Number(f.id) === Number(boton.dataset.id));
    if (!piloto) return;
    accionEnCurso = true;
    try {
      if (boton.dataset.accion === 'editar') await abrirFormulario(piloto);
      else if (boton.dataset.accion === 'alternar') await alternar(piloto);
    } finally {
      accionEnCurso = false;
    }
  }

  return cargar();
}
