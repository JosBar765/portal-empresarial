// Borradores de solicitudes: botón con contador junto a «Nueva solicitud» y modal con la lista (abrir y eliminar).
import { state } from '../state.js';
import { h, icono, montar } from '../utils/dom.js';
import { formatearFecha, formatearRangoViaje } from '../utils/formato.js';
import { MODALIDADES } from '../config/constantes.js';
import { abrirModal, confirmarModal, mostrarErrorModal } from '../components/modal.js';
import { eliminarBorrador, listarBorradores, marcarBorradoresVistos, obtenerBorrador } from '../api/viaticosApi.js';
import { EVENTO_BORRADORES, avisarCambioBorradores } from '../utils/eventosBorradores.js';
import { t } from '../textos.js';
import { abrirFormularioSolicitud } from './solicitudForm.js';

const DIAS_ALERTA = 3;

const nombrePais = (paisId) => {
  const pais = paisId == null ? null : (state.contexto.paises || []).find(p => Number(p.id) === Number(paisId));
  return pais ? pais.nombre : '';
};

function textoVencimiento(dias) {
  if (dias <= 0) return t('borradores.venceHoy');
  return dias === 1 ? t('borradores.venceEnUno') : t('borradores.venceEnVarios', { n: dias });
}

// Botón «Borradores (n)» con una insignia roja con los borradores nuevos por vencimiento; ambos se refrescan solos con el evento de cambios.
// `alTerminar` recarga la lista si se envía un borrador.
export function crearBotonBorradores({ alTerminar } = {}) {
  const etiqueta = h('span', { text: t('borradores.boton', { n: 0 }) });
  const insignia = h('span', { class: 'vi-borradores-insignia', id: 'vi-borradores-nuevos', title: t('borradores.insignia'), hidden: true, text: '0' });
  const boton = h('button', { class: 'btn btn--ghost vi-btn-borradores', type: 'button', id: 'vi-btn-borradores', onclick: () => abrirModalBorradores({ alTerminar }) },
    icono('document-text-outline'), etiqueta, insignia);
  const pintar = async () => {
    try {
      const { borradores, nuevos = 0 } = await listarBorradores();
      etiqueta.textContent = t('borradores.boton', { n: borradores.length });
      insignia.textContent = nuevos > 99 ? '99+' : String(nuevos);
      insignia.hidden = !nuevos;
    } catch {
      // El contador es solo informativo: si no carga, se queda como estaba.
    }
  };
  // La vista se repinta al cambiar de pestaña: el oyente de un botón ya desmontado se retira solo.
  const alCambiar = () => {
    if (!boton.isConnected) document.removeEventListener(EVENTO_BORRADORES, alCambiar);
    else pintar();
  };
  document.addEventListener(EVENTO_BORRADORES, alCambiar);
  pintar();
  return boton;
}

// «Venció la solicitud VIA-GT-3 · Motivo del rechazo: …» de un borrador creado por vencimiento.
const textoOrigen = (b) => [t('borradores.origen', { correlativo: b.origenCorrelativo }), b.origenMotivo && t('borradores.origenMotivo', { motivo: b.origenMotivo })].filter(Boolean).join(' · ');

function filaBorrador(b) {
  const datosViaje = [nombrePais(b.paisId), b.fechaSalida ? formatearRangoViaje(b) : ''].filter(Boolean).join(' · ');
  const alerta = b.diasRestantes <= DIAS_ALERTA;
  return h('li', { class: 'vi-borrador-item', 'data-id': String(b.id) },
    h('div', { class: 'vi-borrador-info' },
      h('strong', { class: 'vi-borrador-titulo', text: t(b.modalidad === MODALIDADES.MAS_DE_UN_DIA ? 'formulario.subtitulo.masDeUnDia' : 'formulario.subtitulo.hastaUnDia') }),
      b.origenCorrelativo && h('span', { class: 'vi-borrador-etiquetas' },
        b.nuevo && h('span', { class: 'vi-borrador-etiqueta vi-borrador-etiqueta--nuevo', text: t('borradores.nuevo') }),
        h('span', { class: 'vi-borrador-origen', text: textoOrigen(b) })),
      datosViaje && h('span', { class: 'vi-borrador-meta', text: datosViaje }),
      h('span', { class: 'vi-borrador-meta' },
        `${t('borradores.creado', { fecha: formatearFecha(b.creadoEn) })} · `,
        h('span', { class: `vi-borrador-vence${alerta ? ' vi-borrador-vence--alerta' : ''}`, text: textoVencimiento(b.diasRestantes) }))),
    h('div', { class: 'vi-borrador-acciones' },
      h('button', { class: 'btn btn--primary btn--sm', type: 'button', 'data-accion': 'abrir', text: t('borradores.abrir') }),
      h('button', { class: 'btn btn--danger btn--sm', type: 'button', 'data-accion': 'eliminar', text: t('borradores.eliminar') })));
}

export function abrirModalBorradores({ alTerminar } = {}) {
  const { overlay, cerrar } = abrirModal({
    title: t('borradores.titulo'),
    bodyHtml: '<div id="vi-borradores-contenido"></div>',
    footerHtml: '<button class="btn btn--ghost" type="button" id="vi-borradores-cerrar"></button>'
  });
  const botonCerrar = overlay.querySelector('#vi-borradores-cerrar');
  botonCerrar.textContent = t('comun.cerrar');
  botonCerrar.addEventListener('click', cerrar);
  const contenido = overlay.querySelector('#vi-borradores-contenido');
  const limpiarError = () => overlay.querySelectorAll('.form-error').forEach(caja => caja.remove());
  montar(contenido, h('p', { class: 'vi-ayuda', text: t('comun.cargando') }));

  const pintar = async () => {
    let respuesta;
    try {
      respuesta = await listarBorradores();
    } catch (error) {
      if (!overlay.isConnected) return null;
      montar(contenido);
      mostrarErrorModal(overlay, error.message);
      return null;
    }
    if (!overlay.isConnected) return null;
    const lista = respuesta.borradores || [];
    montar(contenido,
      h('p', { class: 'vi-ayuda', text: t('borradores.nota') }),
      lista.length
        ? h('ul', { class: 'vi-borrador-lista' }, lista.map(filaBorrador))
        : h('p', { class: 'vi-ayuda vi-vacio', text: t('borradores.vacio') }));
    return respuesta;
  };

  // 404: el borrador venció o se eliminó desde otra pestaña; se avisa y se refresca la lista y el contador.
  const avisarNoDisponible = async () => {
    avisarCambioBorradores();
    await pintar();
    if (overlay.isConnected) mostrarErrorModal(overlay, t('borradores.noDisponible'));
  };

  async function eliminar(id) {
    const acepta = await confirmarModal({ title: t('borradores.eliminar.titulo'), mensaje: t('borradores.eliminar.mensaje'), aceptar: t('borradores.eliminar'), peligro: true });
    if (!acepta || !overlay.isConnected) return;
    try {
      await eliminarBorrador(id);
      window.toast?.success(t('borradores.eliminar.titulo'), t('borradores.eliminar.exito'));
      avisarCambioBorradores();
      await pintar();
    } catch (error) {
      if (error.status === 404) await avisarNoDisponible();
      else if (overlay.isConnected) mostrarErrorModal(overlay, error.message);
    }
  }

  async function abrir(id, boton) {
    boton.disabled = true;
    try {
      const borrador = await obtenerBorrador(id);
      cerrar();
      abrirFormularioSolicitud({ modo: 'borrador', borrador, alTerminar });
    } catch (error) {
      if (error.status === 404) await avisarNoDisponible();
      else if (overlay.isConnected) mostrarErrorModal(overlay, error.message);
      boton.disabled = false;
    }
  }

  contenido.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-accion]');
    if (!boton) return;
    limpiarError();
    const id = Number(boton.closest('.vi-borrador-item').dataset.id);
    if (boton.dataset.accion === 'eliminar') eliminar(id);
    else abrir(id, boton);
  });

  // La lista se pinta con las etiquetas «Nuevo»; recién después se marcan como vistos y la insignia se apaga.
  pintar().then(async (respuesta) => {
    if (!respuesta || !respuesta.nuevos) return;
    try {
      await marcarBorradoresVistos();
      avisarCambioBorradores();
    } catch {
      // Sin conexión: se marcan como vistos en la próxima apertura.
    }
  });
}
