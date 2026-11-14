// Modal de solicitud de viáticos: crear (más de 1 día y 1 día o menos), modificar una solicitud propia y retomar un borrador.
import { state } from '../state.js';
import { h, icono, montar } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { ACCIONES, MODALIDADES } from '../config/constantes.js';
import { abrirModal, confirmarModal, mostrarErrorModal } from '../components/modal.js';
import { crearAviso } from '../components/aviso.js';
import { cerrarPanelFechaActivo } from '../components/datepicker.js';
import { enfocarPrimerCampoInvalido, limpiarErrorCampo } from '../components/validacion.js';
import { actualizarBorrador, calcularSolicitud, crearBorrador, crearLlaveIdempotencia, crearSolicitud, mensajesDeError, modificarSolicitud, obtenerCatalogosSolicitud, obtenerSolicitud } from '../api/viaticosApi.js';
import { registrarAccionPropia } from '../socket.js';
import { t } from '../textos.js';
import { armarPayload, detalleAEstado, estadoInicial, motivoDeRechazo, raizDeCampo, reconciliarEstado, remapearCampo } from './datos.js';
import { avisarCambioBorradores } from '../utils/eventosBorradores.js';
import { borradorAEstado, estadoABorrador } from './borradorEstado.js';
import { crearContexto } from './contexto.js';
import { crearCalculador } from './calculo.js';
import { camposPendientes, erroresDeCampos, erroresVigentes, pintarErrores } from './erroresForm.js';
import { crearResumen } from './resumen.js';
import { crearResumenCorto } from './resumenCorto.js';
import { crearSeccionSolicitud } from './secciones/solicitud.js';
import { crearSeccionVehiculo } from './secciones/vehiculo.js';
import { crearSeccionFechas } from './secciones/fechas.js';
import { crearSeccionRuta } from './secciones/ruta.js';
import { crearSeccionHospedaje } from './secciones/hospedaje.js';
import { crearSeccionComidas } from './secciones/comidas.js';
import { crearSeccionGastos } from './secciones/gastos.js';
import { crearSeccionVehiculoCorto } from './secciones/vehiculoCorto.js';
import { crearSeccionFechasCorto } from './secciones/fechasCorto.js';
import { crearSeccionFluidos } from './secciones/fluidos.js';
import { crearSeccionKit } from './secciones/kit.js';
import { crearSeccionDefectos } from './secciones/defectos.js';

const puedeModificar = (solicitud) => !!solicitud && solicitud.id != null && ((solicitud.pipeline && solicitud.pipeline.acciones) || []).includes(ACCIONES.MODIFICAR);

// `alTerminar` recarga la lista tras guardar (se recibe como función para no importar la vista: evita un ciclo de imports).
// Modo 'borrador': `borrador` es la respuesta de GET /borradores/:id; sigue siendo una solicitud nueva (se envía con `borradorId`).
// Devuelve null si no abre; si no, { ctx, cerrar, overlay, listo } (`listo` se cumple cuando el formulario ya está armado).
export function abrirFormularioSolicitud({ modo = 'crear', solicitud, borrador, alTerminar } = {}) {
  const esModificar = modo === 'modificar';
  const esBorrador = modo === 'borrador';
  if (esBorrador && !(borrador && borrador.id)) return null;
  const borradorId = esBorrador ? borrador.id : null;
  if (esModificar && !puedeModificar(solicitud)) {
    const estadoActual = solicitud && solicitud.pipeline ? solicitud.pipeline.etiqueta : '';
    window.toast?.warning(t('tab.solicitudes'), t('formulario.modificar.noPermitida', { correlativo: solicitud ? solicitud.correlativo : '', estado: estadoActual }));
    return null;
  }

  const paises = state.contexto.paises || [];
  const ctx = crearContexto({ estado: esBorrador ? borradorAEstado(borrador.datos, borrador.modalidad, { paises }) : estadoInicial({ paises }), contexto: state.contexto, modo });
  const { estado } = ctx;
  if (esModificar && solicitud.modalidad) estado.modalidad = solicitud.modalidad;
  let cerrado = false;
  let cargada = !esModificar;
  let numeroCarga = 0;
  let ultimoEnvio = null;
  let resumen = null;
  let resumenCorto = null;

  const form = h('form', { class: 'vi-form', id: 'vi-sol-form', novalidate: true });
  const rechazo = h('div', { class: 'vi-avisos', id: 'vi-sol-rechazo' });
  const bloqueos = h('div', { class: 'vi-avisos', id: 'vi-sol-bloqueos', 'aria-live': 'assertive' });
  const detalle = h('div', { class: 'vi-form-detalle', id: 'vi-sol-detalle' });
  const subtituloDe = () => t(estado.modalidad === MODALIDADES.MAS_DE_UN_DIA ? 'formulario.subtitulo.masDeUnDia' : 'formulario.subtitulo.hastaUnDia');

  const { overlay, cerrar } = abrirModal({
    title: esModificar ? t('formulario.tituloModificar', { correlativo: solicitud.correlativo }) : t('formulario.titulo'),
    subtitle: subtituloDe(),
    size: 'lg',
    clase: 'vi-modal-solicitud',
    bodyHtml: '',
    footerHtml: `<span class="vi-pie-motivo" id="vi-sol-motivo-envio" aria-live="polite"></span>
      <button class="btn btn--ghost" type="button" id="vi-sol-cancelar">${escapeHtml(t('comun.cancelar'))}</button>
      ${esModificar ? '' : `<button class="btn btn--ghost" type="button" id="vi-sol-borrador">${escapeHtml(t('formulario.borrador.guardar'))}</button>`}
      <button class="btn btn--primary" type="button" id="vi-sol-enviar" aria-describedby="vi-sol-motivo-envio">${escapeHtml(t(esModificar ? 'formulario.guardar' : 'formulario.enviar'))}</button>`,
    antesDeCerrar: async () => {
      if (ctx.enviando) return false;
      if (!ctx.sucio) return true;
      return confirmarModal({
        title: t('formulario.cerrar.titulo'), mensaje: t(esModificar ? 'formulario.cerrar.mensajeModificar' : (esBorrador ? 'formulario.cerrar.mensajeBorrador' : 'formulario.cerrar.mensaje')),
        aceptar: t(esModificar || esBorrador ? 'formulario.cerrar.salirModificar' : 'formulario.cerrar.salir'), cancelar: t('formulario.cerrar.seguir'), peligro: true
      });
    },
    alCerrar: () => { cerrado = true; calculador.cancelar(); cerrarPanelFechaActivo(); ctx.soltarDetalle(); }
  });
  const cuerpo = overlay.querySelector('.modal-body');
  const botonEnviar = overlay.querySelector('#vi-sol-enviar');
  const botonBorrador = overlay.querySelector('#vi-sol-borrador');
  const motivoEnvio = overlay.querySelector('#vi-sol-motivo-envio');
  overlay.querySelector('#vi-sol-cancelar').addEventListener('click', () => overlay.querySelector('.modal-close').click());

  // ---------- Cálculo ----------
  const calculador = crearCalculador({
    calcular: calcularSolicitud,
    alIniciar: () => { ctx.calculando = true; ctx.emitir('calculando'); actualizarEnvio(); },
    alResultado: (respuesta, indices) => {
      ctx.calculando = false;
      ctx.errorCalculo = null;
      ctx.respuesta = respuesta;
      ctx.erroresServidor = respuesta ? respuesta.errores.map(e => ({ campo: remapearCampo(e.campo, indices), mensaje: e.mensaje })) : [];
      ctx.emitir('resultado');
      actualizarEnvio();
    },
    alError: (error) => {
      ctx.calculando = false;
      ctx.errorCalculo = error.message;
      ctx.emitir('resultado');
      actualizarEnvio();
    }
  });
  const obtenerEntrada = () => (ctx.catalogos ? armarPayload(estado, ctx.catalogos) : null);
  const recalcular = (opciones) => calculador.programar(obtenerEntrada, opciones);

  // ---------- Botón de envío ----------
  function motivoDeshabilitado() {
    if (!cargada) return t('comun.cargando');
    if (!ctx.catalogos) return t('formulario.envio.sinPais');
    if (ctx.errorCalculo) return t('formulario.envio.errorCalculo');
    if (ctx.calculando || !ctx.respuesta) return t('formulario.envio.calculando');
    const errores = erroresVigentes(ctx);
    if (errores.length || !ctx.respuesta.valido) return t(esModificar ? 'formulario.envio.corrigeGuardar' : 'formulario.envio.corrige', { campos: camposPendientes(errores) || t('formulario.campo.otro') });
    return null;
  }

  function actualizarEnvio() {
    if (cerrado) return;
    pintarErrores(ctx, { form, bloqueos });
    const motivo = motivoDeshabilitado();
    botonEnviar.disabled = !!motivo || ctx.enviando;
    // Guardar borrador no depende del cálculo ni de la validación: solo se frena mientras se envía o se guarda.
    if (botonBorrador) botonBorrador.disabled = ctx.enviando;
    botonEnviar.title = motivo || '';
    motivoEnvio.textContent = motivo || '';
  }

  // ---------- Carga de catálogos por país ----------
  function mostrarResumen(cual) {
    if (!resumen) return;
    resumen.el.style.display = cual === 'largo' ? '' : 'none';
    resumenCorto.el.style.display = cual === 'corto' ? '' : 'none';
  }

  function pintarDetalle() {
    ctx.soltarDetalle();
    const esLargo = estado.modalidad === MODALIDADES.MAS_DE_UN_DIA;
    overlay.querySelector('.modal-subtitulo').textContent = subtituloDe();
    mostrarResumen(ctx.catalogos ? (esLargo ? 'largo' : 'corto') : null);
    if (!ctx.catalogos) return;
    montar(detalle, ...(esLargo
      ? [crearSeccionVehiculo(ctx), crearSeccionFechas(ctx), crearSeccionRuta(ctx), crearSeccionHospedaje(ctx), crearSeccionComidas(ctx), crearSeccionGastos(ctx)]
      : [crearSeccionVehiculoCorto(ctx), crearSeccionFechasCorto(ctx), crearSeccionFluidos(ctx), crearSeccionKit(ctx), crearSeccionDefectos(ctx)]).map(s => s.el));
  }

  function estadoDeDetalle(nodo) { montar(detalle, nodo); mostrarResumen(null); }

  async function cargarCatalogos() {
    const numero = ++numeroCarga;
    ctx.catalogos = null;
    ctx.respuesta = null;
    ctx.erroresServidor = [];
    const spinner = icono('sync-outline');
    spinner.classList.add('spin-animation');
    estadoDeDetalle(h('div', { class: 'buzon-vacio' }, spinner, h('p', { text: t('comun.cargando') })));
    actualizarEnvio();
    try {
      const catalogos = await obtenerCatalogosSolicitud(estado.paisId);
      if (cerrado || numero !== numeroCarga) return;
      ctx.catalogos = catalogos;
      Object.assign(estado, reconciliarEstado(estado, catalogos));
      ctx.emitir('catalogos');
      pintarDetalle();
      recalcular({ inmediato: true });
    } catch (error) {
      if (cerrado || numero !== numeroCarga) return;
      estadoDeDetalle(h('div', { class: 'buzon-vacio buzon-vacio-error', role: 'alert' },
        icono('alert-circle-outline'), h('h3', { text: t('formulario.catalogos.error') }), h('p', { text: error.message }),
        h('button', { class: 'btn btn--primary btn--sm', type: 'button', text: t('comun.reintentar'), onclick: cargarCatalogos })));
      actualizarEnvio();
    }
  }

  function elegirPais(paisId) {
    ctx.sucio = true;
    estado.paisId = paisId;
    if (paisId === '') {
      numeroCarga += 1;
      ctx.catalogos = null;
      ctx.respuesta = null;
      ctx.erroresServidor = [];
      calculador.cancelar();
      ctx.calculando = false;
      ctx.emitir('catalogos');
      estadoDeDetalle(h('p', { class: 'vi-ayuda vi-vacio', text: t('formulario.pais.elige') }));
      actualizarEnvio();
      return;
    }
    cargarCatalogos();
  }

  // ---------- Armado ----------
  function armarFormulario(detalleSolicitud) {
    const seccionSolicitud = crearSeccionSolicitud(ctx, { alElegirPais: elegirPais });
    resumen = crearResumen(ctx, { alReintentar: () => recalcular({ inmediato: true }) });
    resumenCorto = crearResumenCorto(ctx, { alReintentar: () => recalcular({ inmediato: true }) });
    form.append(rechazo, bloqueos, seccionSolicitud.el, detalle);
    cuerpo.replaceChildren(form);
    cuerpo.after(resumen.el, resumenCorto.el);
    mostrarResumen(null);
    estadoDeDetalle(h('p', { class: 'vi-ayuda vi-vacio', text: t('formulario.pais.elige') }));

    const motivo = detalleSolicitud ? motivoDeRechazo(detalleSolicitud) : '';
    if (motivo) rechazo.replaceChildren(crearAviso({ tipo: 'info', titulo: t('formulario.modificar.rechazoTitulo'), texto: t('formulario.modificar.rechazoTexto', { motivo }) }));

    // Al cambiar de tipo de viaje se vuelve a ajustar lo elegido (p. ej. un vehículo propio no sirve en un viaje corto) y se descarta el cálculo anterior.
    ctx.suscribir('modalidad', () => {
      if (ctx.catalogos) Object.assign(estado, reconciliarEstado(estado, ctx.catalogos));
      ctx.respuesta = null;
      ctx.erroresServidor = [];
      pintarDetalle();
    }, true);
    ctx.suscribir('*', () => { recalcular(); actualizarEnvio(); }, true);

    // Un campo se considera tocado al salir de él o cambiarlo: desde ahí sus errores se muestran.
    const tocar = (e) => {
      const campo = e.target.closest ? e.target.closest('[name], .vi-nivel-fila[data-campo]') : null;
      if (campo) ctx.tocados.add(raizDeCampo(campo.getAttribute('name') || campo.dataset.campo));
    };
    form.addEventListener('change', (e) => { ctx.sucio = true; tocar(e); actualizarEnvio(); });
    form.addEventListener('focusout', (e) => { tocar(e); actualizarEnvio(); });
    form.addEventListener('input', (e) => {
      ctx.sucio = true;
      if (e.target.closest && e.target.closest('.form-field')) limpiarErrorCampo(e.target);
    });
  }

  botonEnviar.addEventListener('click', enviar);
  if (botonBorrador) botonBorrador.addEventListener('click', guardarBorrador);

  // ---------- Modificar: carga del detalle ----------
  async function cargarSolicitud() {
    const spinner = icono('sync-outline');
    spinner.classList.add('spin-animation');
    montar(cuerpo, h('div', { class: 'buzon-vacio', id: 'vi-sol-cargando' }, spinner, h('p', { text: t('comun.cargando') })));
    actualizarEnvio();
    let detalleSolicitud;
    try {
      detalleSolicitud = await obtenerSolicitud(solicitud.id);
    } catch (error) {
      if (cerrado) return;
      montar(cuerpo, h('div', { class: 'buzon-vacio buzon-vacio-error', role: 'alert', id: 'vi-sol-error-carga' },
        icono('alert-circle-outline'), h('h3', { text: t('formulario.modificar.error') }), h('p', { text: error.message }),
        h('button', { class: 'btn btn--primary btn--sm', type: 'button', text: t('comun.reintentar'), onclick: cargarSolicitud })));
      return;
    }
    if (cerrado) return;
    // La solicitud pudo cambiar de estado desde que se pintó la lista (p. ej. la autorizaron).
    if (!puedeModificar(detalleSolicitud)) {
      cerrar();
      window.toast?.warning(t('tab.solicitudes'), t('formulario.modificar.noPermitida', { correlativo: detalleSolicitud.correlativo, estado: detalleSolicitud.pipeline ? detalleSolicitud.pipeline.etiqueta : detalleSolicitud.estado }));
      return;
    }
    Object.assign(estado, detalleAEstado(detalleSolicitud));
    cargada = true;
    armarFormulario(detalleSolicitud);
    elegirPais(estado.paisId);
    ctx.sucio = false;
  }

  // ---------- Envío ----------
  // La misma llave de idempotencia sirve para reintentar el mismo envío; si cambian los datos, es otro envío y lleva otra llave.
  // Al modificar no hay llave: el contrato la define solo para la creación.
  async function enviar() {
    if (ctx.enviando || botonEnviar.disabled) return;
    const entrada = armarPayload(estado, ctx.catalogos);
    if (!entrada) return;
    const fotos = entrada.fotos || [];
    const firma = JSON.stringify([entrada.datos, fotos.map(f => [f.name, f.size, f.lastModified])]);
    if (!esModificar && (!ultimoEnvio || ultimoEnvio.firma !== firma)) ultimoEnvio = { firma, llave: crearLlaveIdempotencia() };
    cuerpo.querySelectorAll(':scope > .form-error').forEach(b => b.remove());
    ctx.enviando = true;
    botonEnviar.classList.add('btn--loading');
    actualizarEnvio();
    try {
      const guardada = esModificar
        ? await modificarSolicitud(solicitud.id, entrada.datos, fotos)
        : await crearSolicitud({ ...entrada.datos, ...(esBorrador ? { borradorId } : {}), idempotencyKey: ultimoEnvio.llave }, fotos);
      registrarAccionPropia(guardada.id ?? (solicitud && solicitud.id));
      const correlativo = guardada.correlativo || (solicitud && solicitud.correlativo);
      window.toast?.success(t('tab.solicitudes'), t(esModificar ? 'formulario.actualizada' : 'formulario.enviada', { correlativo }));
      ctx.sucio = false;
      cerrar();
      if (esBorrador) avisarCambioBorradores(); // el servidor borró el borrador al crear la solicitud
      if (alTerminar) await alTerminar();
    } catch (error) {
      if (cerrado) return;
      if (error.campos && typeof error.campos === 'object' && Object.keys(error.campos).length) {
        ctx.intentoEnvio = true;
        ctx.erroresServidor = erroresDeCampos(error.campos, entrada.indices);
        pintarErrores(ctx, { form, bloqueos });
        mostrarErrorModal(overlay, t('comun.errores.revisaCampos'));
        enfocarPrimerCampoInvalido(cuerpo);
      } else {
        mostrarErrorModal(overlay, mensajesDeError(error).join(' '));
      }
    } finally {
      ctx.enviando = false;
      botonEnviar.classList.remove('btn--loading');
      actualizarEnvio();
    }
  }

  // ---------- Guardar borrador ----------
  // Guarda lo que haya (sin fotos) y cierra el modal; reabrirlo desde «Borradores» deja el siguiente guardado como actualización.
  async function guardarBorrador() {
    if (ctx.enviando || !cargada) return;
    cuerpo.querySelectorAll(':scope > .form-error').forEach(b => b.remove());
    ctx.enviando = true;
    botonBorrador.classList.add('btn--loading');
    actualizarEnvio();
    try {
      const datos = estadoABorrador(estado);
      if (esBorrador) await actualizarBorrador(borradorId, estado.modalidad, datos);
      else await crearBorrador(estado.modalidad, datos);
      window.toast?.success(t('tab.solicitudes'), t('formulario.borrador.guardado'));
      avisarCambioBorradores();
      ctx.sucio = false;
      cerrar();
    } catch (error) {
      if (cerrado) return;
      mostrarErrorModal(overlay, mensajesDeError(error).join(' '));
    } finally {
      ctx.enviando = false;
      botonBorrador.classList.remove('btn--loading');
      actualizarEnvio();
    }
  }

  let listo = Promise.resolve();
  if (esModificar) {
    listo = cargarSolicitud();
  } else {
    armarFormulario(null);
    elegirPais(estado.paisId);
    ctx.sucio = false; // elegir el único país posible no cuenta como un cambio del usuario
  }
  return { ctx, cerrar, overlay, listo };
}
