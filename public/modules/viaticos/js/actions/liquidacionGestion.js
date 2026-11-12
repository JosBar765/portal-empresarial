// Liquidación de solo lectura para contabilidad: cifras, diferencia, comprobantes y el PDF de la solicitud.
import { h, icono } from '../utils/dom.js';
import { RUBRO_HOSPEDAJE } from '../config/constantes.js';
import { escapeHtml, formatearDinero, formatearTamano } from '../utils/formato.js';
import { tipoDeDocumento, tituloVisorComprobante, tituloVisorSolicitud } from '../utils/documentos.js';
import { abrirModal } from '../components/modal.js';
import { crearAviso } from '../components/aviso.js';
import { abrirVisorArchivo, abrirVisorSolicitud } from '../components/visorDocumento.js';
import { mensajesDeError, obtenerLiquidacionGestion } from '../api/viaticosApi.js';
import { miniatura } from './liquidacion/comprobantes.js';
import { pendienteCompleto, textoProgreso } from './liquidacion/datos.js';
import { claveTextoDiferencia, signoDiferencia, subtituloLiquidacion, textoDiferencia, tituloLiquidacionGestion } from './gestionDatos.js';
import { t } from '../textos.js';

const tarjeta = (id, etiqueta, valor, { clase = '', nota = null } = {}) => h('div', { class: `vi-liq-tarjeta ${clase}`.trim() },
  h('span', { class: 'vi-liq-tarjeta__etiqueta', text: etiqueta }),
  h('strong', { class: 'vi-liq-tarjeta__valor', id, text: valor }),
  nota && h('span', { class: 'vi-liq-tarjeta__nota', text: nota }));

// Una fila por comprobante; cada `td` lleva su `data-label` para verse como tarjeta en el celular.
function filaComprobante(c, simbolo) {
  const tipo = tipoDeDocumento({ tipo: c.tipoArchivo, url: c.url });
  const abrir = (origen) => abrirVisorArchivo({ titulo: tituloVisorComprobante(c.rubro), url: c.url, tipo, origen });
  const celda = (clave, contenido, clase = '', params) => h('td', { 'data-label': t(clave, params), class: clase || null }, contenido);
  return h('tr', { 'data-comprobante': String(c.id) },
    celda('gestiones.liq.col.rubro', h('strong', { text: c.rubro })),
    celda('gestiones.liq.col.descripcion', c.descripcion || t('gestiones.liq.sinDescripcion')),
    celda('gestiones.liq.col.monto', formatearDinero('', c.monto), 'vi-gl-monto', { simbolo }),
    celda('gestiones.liq.col.comprobante', h('div', { class: 'vi-gl-archivo' },
      miniatura({ url: c.url, tipo, etiquetaAria: t('gestiones.liq.verAria', { rubro: c.rubro, archivo: c.nombreArchivo }), alPulsar: abrir }),
      h('div', { class: 'vi-comp__meta' },
        h('strong', { text: c.nombreArchivo }),
        c.tamano != null && h('small', { text: formatearTamano(c.tamano) })),
      h('button', { type: 'button', class: 'btn btn--ghost btn--sm vi-gl-ver', text: t('gestiones.liq.ver'), 'aria-label': t('gestiones.liq.verAria', { rubro: c.rubro, archivo: c.nombreArchivo }), onclick: (e) => abrir(e.currentTarget) })),
      'vi-gl-celda-archivo'));
}

function seccionRubros(liq) {
  if (!Array.isArray(liq.pendientes) || !liq.pendientes.length) return null;
  return h('section', { class: 'vi-liq-seccion', 'aria-labelledby': 'vi-gl-rubros-titulo' },
    h('h4', { class: 'vi-form-seccion__titulo', id: 'vi-gl-rubros-titulo', text: t('gestiones.liq.rubros') }),
    h('div', { class: 'vi-liq-pendientes', id: 'vi-gl-rubros' }, liq.pendientes.map(p => {
      const completo = pendienteCompleto(p);
      const progreso = textoProgreso(p, RUBRO_HOSPEDAJE);
      return h('div', { class: `vi-liq-rubro${completo ? ' is-completo' : ''}`, 'data-tipo-gasto': String(p.tipoGastoId) },
        h('div', { class: 'vi-liq-rubro__cab' },
          h('strong', { text: p.nombre }),
          completo && h('span', { class: 'vi-liq-rubro__visto' }, icono('checkmark-outline'), h('span', { class: 'vi-solo-lector', text: t('liquidacion.pendiente.completo') }))),
        h('span', { class: 'vi-liq-rubro__progreso', text: t(progreso.clave, progreso.params) }));
    })));
}

export function abrirLiquidacionGestion(solicitud) {
  let cerrado = false;
  let numeroCarga = 0;

  const { overlay, cerrar } = abrirModal({
    title: tituloLiquidacionGestion(solicitud.correlativo),
    subtitle: subtituloLiquidacion(solicitud, null),
    size: 'lg',
    clase: 'vi-modal-liquidacion vi-modal-liqgestion',
    bodyHtml: '',
    footerHtml: `<button class="btn btn--ghost" type="button" id="vi-gl-cerrar">${escapeHtml(t('comun.cerrar'))}</button>`,
    alCerrar: () => { cerrado = true; }
  });
  const cuerpo = overlay.querySelector('.modal-body');
  overlay.querySelector('#vi-gl-cerrar').addEventListener('click', cerrar);

  function estadoDeCarga(nombreIcono, mensaje, { error = false, reintentar = false } = {}) {
    const ico = icono(nombreIcono);
    if (!error) ico.classList.add('spin-animation');
    cuerpo.replaceChildren(h('div', { class: `buzon-vacio${error ? ' buzon-vacio-error' : ''}`, role: error ? 'alert' : 'status' },
      ico,
      error && h('h3', { text: t('gestiones.liq.errorCarga') }),
      h('p', { text: mensaje }),
      reintentar && h('button', { class: 'btn btn--primary btn--sm', type: 'button', id: 'vi-gl-reintentar', text: t('comun.reintentar'), onclick: cargar })));
  }

  // El PDF llega en la respuesta; sin él se pide la lista de documentos de la solicitud al visor de gestión.
  function verPdf(liq, origen) {
    if (liq.pdf && liq.pdf.url) {
      abrirVisorArchivo({ titulo: liq.pdf.titulo || tituloVisorSolicitud(liq.correlativo || solicitud.correlativo), url: liq.pdf.url, tipo: liq.pdf.tipo || 'pdf', origen });
      return;
    }
    abrirVisorSolicitud(solicitud, { gestion: true });
  }

  function pintar(liq) {
    overlay.querySelector('.modal-subtitulo').textContent = subtituloLiquidacion(solicitud, liq);
    const simbolo = liq.moneda ? liq.moneda.simbolo : '';
    const signo = signoDiferencia(liq.diferencia);
    const comprobantes = Array.isArray(liq.comprobantes) ? liq.comprobantes : [];
    const tabla = comprobantes.length
      ? h('div', { class: 'tabla-wrapper vi-gl-tabla-wrapper', tabindex: '0', role: 'region', 'aria-label': t('gestiones.liq.comprobantes') },
        h('table', { class: 'vi-gl-tabla', id: 'vi-gl-tabla' },
          h('thead', null, h('tr', null, ['rubro', 'descripcion', 'monto', 'comprobante'].map(c => h('th', { text: t(`gestiones.liq.col.${c}`, { simbolo }) })))),
          h('tbody', null, comprobantes.map(c => filaComprobante(c, simbolo)))))
      : h('p', { class: 'vi-ayuda vi-vacio', id: 'vi-gl-vacio', text: t('gestiones.liq.sinComprobantes') });

    cuerpo.replaceChildren(
      crearAviso({ tipo: 'info', titulo: t('gestiones.liq.aviso.titulo'), texto: t('gestiones.liq.aviso.texto') }),
      h('div', { class: 'vi-liq-tarjetas' },
        tarjeta('vi-gl-solicitado', t('gestiones.liq.solicitado'), formatearDinero(simbolo, liq.resumen.solicitadoALiquidar)),
        tarjeta('vi-gl-liquidado', t('gestiones.liq.liquidado'), formatearDinero(simbolo, liq.resumen.liquidado)),
        tarjeta('vi-gl-diferencia', t('gestiones.liq.diferencia'), textoDiferencia(simbolo, liq.diferencia), { clase: `vi-gl-diferencia--${signo}`, nota: t(claveTextoDiferencia(liq.diferencia)) })),
      seccionRubros(liq),
      h('section', { class: 'vi-liq-seccion', 'aria-labelledby': 'vi-gl-comprobantes-titulo' },
        h('div', { class: 'vi-gl-cabecera' },
          h('h4', { class: 'vi-form-seccion__titulo', id: 'vi-gl-comprobantes-titulo', text: t('gestiones.liq.comprobantes') }),
          h('button', { type: 'button', class: 'btn btn--ghost btn--sm', id: 'vi-gl-pdf', text: t('gestiones.liq.verPdf'), onclick: (e) => verPdf(liq, e.currentTarget) })),
        tabla));
  }

  async function cargar() {
    const numero = ++numeroCarga;
    estadoDeCarga('sync-outline', t('gestiones.liq.cargando'));
    try {
      const liq = await obtenerLiquidacionGestion(solicitud.id);
      if (cerrado || numero !== numeroCarga) return;
      pintar(liq);
    } catch (error) {
      if (cerrado || numero !== numeroCarga) return;
      // Un 403 trae su explicación (viaje de 1 día o menos, aún sin autorizar, rechazada…): no hay nada que reintentar.
      estadoDeCarga('alert-circle-outline', mensajesDeError(error).join(' '), { error: true, reintentar: error.status !== 403 });
    }
  }

  const listo = cargar();
  return { overlay, cerrar, listo };
}
