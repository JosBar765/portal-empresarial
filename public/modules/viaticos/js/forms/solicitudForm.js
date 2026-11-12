// Modal «Nueva solicitud de viáticos» (viaje de más de 1 día). Modificar y el viaje de 1 día o menos llegan en la siguiente entrega.
import { state } from '../state.js';
import { h, icono, montar } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { MODALIDADES } from '../config/constantes.js';
import { abrirModal, confirmarModal, mostrarErrorModal } from '../components/modal.js';
import { crearAviso } from '../components/aviso.js';
import { cerrarPanelFechaActivo } from '../components/datepicker.js';
import { enfocarPrimerCampoInvalido, limpiarErrorCampo } from '../components/validacion.js';
import { calcularSolicitud, crearLlaveIdempotencia, crearSolicitud, mensajesDeError, obtenerCatalogosSolicitud } from '../api/viaticosApi.js';
import { registrarAccionPropia } from '../socket.js';
import { t } from '../textos.js';
import { armarPayload, estadoInicial, raizDeCampo, reconciliarEstado, remapearCampo } from './datos.js';
import { crearContexto } from './contexto.js';
import { crearCalculador } from './calculo.js';
import { camposPendientes, erroresDeCampos, erroresVigentes, pintarErrores } from './erroresForm.js';
import { crearResumen } from './resumen.js';
import { crearSeccionSolicitud } from './secciones/solicitud.js';
import { crearSeccionVehiculo } from './secciones/vehiculo.js';
import { crearSeccionFechas } from './secciones/fechas.js';
import { crearSeccionRuta } from './secciones/ruta.js';
import { crearSeccionHospedaje } from './secciones/hospedaje.js';
import { crearSeccionComidas } from './secciones/comidas.js';
import { crearSeccionGastos } from './secciones/gastos.js';

// `alTerminar` recarga la lista tras crear (se recibe como función para no importar la vista: evita un ciclo de imports).
export function abrirFormularioSolicitud({ modo = 'crear', solicitud, alTerminar } = {}) {
  if (modo !== 'crear') {
    window.toast?.info(t('tab.solicitudes'), t('solicitudes.proximamente'));
    return null;
  }

  const ctx = crearContexto({ estado: estadoInicial({ paises: state.contexto.paises || [] }), contexto: state.contexto });
  const { estado } = ctx;
  let cerrado = false;
  let numeroCarga = 0;
  let ultimoEnvio = null;

  const form = h('form', { class: 'vi-form', id: 'vi-sol-form', novalidate: true });
  const bloqueos = h('div', { class: 'vi-avisos', id: 'vi-sol-bloqueos', 'aria-live': 'assertive' });
  const detalle = h('div', { class: 'vi-form-detalle', id: 'vi-sol-detalle' });

  const { overlay, cerrar } = abrirModal({
    title: t('formulario.titulo'),
    subtitle: t('formulario.subtitulo.masDeUnDia'),
    size: 'lg',
    clase: 'vi-modal-solicitud',
    bodyHtml: '',
    footerHtml: `<span class="vi-pie-motivo" id="vi-sol-motivo-envio" aria-live="polite"></span>
      <button class="btn btn--ghost" type="button" id="vi-sol-cancelar">${escapeHtml(t('comun.cancelar'))}</button>
      <button class="btn btn--primary" type="button" id="vi-sol-enviar" aria-describedby="vi-sol-motivo-envio">${escapeHtml(t('formulario.enviar'))}</button>`,
    antesDeCerrar: async () => {
      if (ctx.enviando) return false;
      if (!ctx.sucio) return true;
      return confirmarModal({
        title: t('formulario.cerrar.titulo'), mensaje: t('formulario.cerrar.mensaje'), aceptar: t('formulario.cerrar.salir'), cancelar: t('formulario.cerrar.seguir'), peligro: true
      });
    },
    alCerrar: () => { cerrado = true; calculador.cancelar(); cerrarPanelFechaActivo(); }
  });
  const cuerpo = overlay.querySelector('.modal-body');
  const botonEnviar = overlay.querySelector('#vi-sol-enviar');
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
    if (estado.modalidad !== MODALIDADES.MAS_DE_UN_DIA) return t('formulario.envio.cortoNoDisponible');
    if (!ctx.catalogos) return t('formulario.envio.sinPais');
    if (ctx.errorCalculo) return t('formulario.envio.errorCalculo');
    if (ctx.calculando || !ctx.respuesta) return t('formulario.envio.calculando');
    const errores = erroresVigentes(ctx);
    if (errores.length || !ctx.respuesta.valido) return t('formulario.envio.corrige', { campos: camposPendientes(errores) || t('formulario.campo.otro') });
    return null;
  }

  function actualizarEnvio() {
    if (cerrado) return;
    pintarErrores(ctx, { form, bloqueos });
    const motivo = motivoDeshabilitado();
    botonEnviar.disabled = !!motivo || ctx.enviando;
    botonEnviar.title = motivo || '';
    motivoEnvio.textContent = motivo || '';
  }

  // ---------- Carga de catálogos por país ----------
  function pintarDetalle() {
    ctx.soltarDetalle();
    const esLargo = estado.modalidad === MODALIDADES.MAS_DE_UN_DIA;
    overlay.querySelector('.modal-subtitulo').textContent = t(esLargo ? 'formulario.subtitulo.masDeUnDia' : 'formulario.subtitulo.hastaUnDia');
    overlay.querySelector('#vi-sol-resumen').style.display = ctx.catalogos && esLargo ? '' : 'none';
    if (!ctx.catalogos) return;
    if (!esLargo) {
      montar(detalle, crearAviso({ tipo: 'info', titulo: t('formulario.corto.titulo'), texto: t('formulario.corto.texto') }));
      return;
    }
    montar(detalle,
      crearSeccionVehiculo(ctx).el, crearSeccionFechas(ctx).el, crearSeccionRuta(ctx).el,
      crearSeccionHospedaje(ctx).el, crearSeccionComidas(ctx).el, crearSeccionGastos(ctx).el);
  }

  function estadoDeDetalle(nodo) { montar(detalle, nodo); overlay.querySelector('#vi-sol-resumen').style.display = 'none'; }

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
  const seccionSolicitud = crearSeccionSolicitud(ctx, { alElegirPais: elegirPais });
  const resumen = crearResumen(ctx, { alReintentar: () => recalcular({ inmediato: true }) });
  form.append(bloqueos, seccionSolicitud.el, detalle);
  cuerpo.append(form);
  cuerpo.after(resumen.el);
  resumen.el.style.display = 'none';
  estadoDeDetalle(h('p', { class: 'vi-ayuda vi-vacio', text: t('formulario.pais.elige') }));

  ctx.suscribir('modalidad', () => { pintarDetalle(); }, true);
  ctx.suscribir('*', () => { recalcular(); actualizarEnvio(); }, true);

  // Un campo se considera tocado al salir de él o cambiarlo: desde ahí sus errores se muestran.
  const tocar = (e) => {
    const campo = e.target.closest ? e.target.closest('[name]') : null;
    if (campo) ctx.tocados.add(raizDeCampo(campo.name));
  };
  form.addEventListener('change', (e) => { ctx.sucio = true; tocar(e); actualizarEnvio(); });
  form.addEventListener('focusout', (e) => { tocar(e); actualizarEnvio(); });
  form.addEventListener('input', (e) => {
    ctx.sucio = true;
    if (e.target.closest && e.target.closest('.form-field')) limpiarErrorCampo(e.target);
  });
  botonEnviar.addEventListener('click', enviar);

  // ---------- Envío ----------
  // La misma llave de idempotencia sirve para reintentar el mismo envío; si cambian los datos, es otro envío y lleva otra llave.
  async function enviar() {
    if (ctx.enviando || botonEnviar.disabled) return;
    const entrada = armarPayload(estado, ctx.catalogos);
    if (!entrada) return;
    const firma = JSON.stringify(entrada.datos);
    if (!ultimoEnvio || ultimoEnvio.firma !== firma) ultimoEnvio = { firma, llave: crearLlaveIdempotencia() };
    cuerpo.querySelectorAll(':scope > .form-error').forEach(b => b.remove());
    ctx.enviando = true;
    botonEnviar.classList.add('btn--loading');
    actualizarEnvio();
    try {
      const creada = await crearSolicitud({ ...entrada.datos, idempotencyKey: ultimoEnvio.llave }, []);
      registrarAccionPropia(creada.id);
      window.toast?.success(t('tab.solicitudes'), t('formulario.enviada', { correlativo: creada.correlativo }));
      ctx.sucio = false;
      cerrar();
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

  elegirPais(estado.paisId);
  ctx.sucio = false; // elegir el único país posible no cuenta como un cambio del usuario
  return { ctx, cerrar, overlay };
}
