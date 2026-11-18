// Modal «Generar recibo»: se apila sobre la liquidación, propone valores editables, muestra el monto en letras del servidor y pide la firma a pantalla completa.
import { h, icono } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/formato.js';
import { parseIsoLocal } from '../../utils/fechas.js';
import { abrirModal, confirmarModal } from '../../components/modal.js';
import { crearAviso } from '../../components/aviso.js';
import { crearCampo, crearCampoCalculado, ponerCalculado } from '../../components/campo.js';
import { crearCampoFecha } from '../../components/campoFecha.js';
import { crearCampoNumerico } from '../../components/campoNumerico.js';
import { crearCombo } from '../../components/comboAgrupado.js';
import { wireCampoFecha } from '../../components/datepicker.js';
import { abrirFirmaPantalla } from '../../components/firmaPantalla.js';
import { enfocarPrimerCampoInvalido, limpiarErrorCampo, marcarErroresDeCampos } from '../../components/validacion.js';
import { crearLlaveIdempotencia, crearRecibo, mensajesDeError, montoEnLetrasRecibo } from '../../api/viaticosApi.js';
import {
  FORMAS_PAGO, LIMITES_RECIBO, RUBROS_RECIBO, cambiarRubro, datosDeEnvio, disponibilidadRubros, formularioRecibo, llaveDeRecibo,
  montoParaLetras, nombreRubro, reciboConCambios, validarRecibo
} from './reciboDatos.js';
import { t } from '../../textos.js';

const ESPERA_LETRAS_MS = 300;
const textoDeError = (e) => (typeof e === 'string' ? e : t(e.clave, e.params));

// `alGuardar(liq, recibo)` recibe la liquidación ya actualizada por el servidor. Devuelve { cerrar }.
export function abrirRecibo({ solicitudId, liq, alGuardar, alCerrar }) {
  const f = formularioRecibo(liq);
  const inicial = { ...f };
  const disponibilidad = disponibilidadRubros(liq);
  const sugerencias = liq.sugerenciasRecibo || {};
  const simbolo = liq.moneda ? liq.moneda.simbolo : '';
  let guardando = false;
  let urlFirma = null;
  let pedidoLetras = 0;
  let esperaLetras = null;

  const { overlay, cerrar } = abrirModal({
    title: t('recibo.titulo'),
    subtitle: t('recibo.subtitulo', { correlativo: liq.correlativo || '' }),
    clase: 'vi-modal-recibo',
    bodyHtml: '',
    footerHtml: `<button class="btn btn--ghost" type="button" id="vi-rec-cancelar">${escapeHtml(t('comun.cancelar'))}</button>
      <button class="btn btn--primary" type="button" id="vi-rec-guardar">${escapeHtml(t('recibo.guardar'))}</button>`,
    antesDeCerrar: async () => {
      if (guardando) return false;
      if (!reciboConCambios(f, inicial)) return true;
      return confirmarModal({
        title: t('recibo.cerrar.titulo'), mensaje: t('recibo.cerrar.mensaje'),
        aceptar: t('recibo.cerrar.salir'), cancelar: t('recibo.cerrar.seguir'), peligro: true
      });
    },
    alCerrar: () => {
      clearTimeout(esperaLetras);
      pedidoLetras += 1;
      if (urlFirma) URL.revokeObjectURL(urlFirma);
      if (alCerrar) alCerrar();
    }
  });
  const cuerpo = overlay.querySelector('.modal-body');
  const botonGuardar = overlay.querySelector('#vi-rec-guardar');
  overlay.querySelector('#vi-rec-cancelar').addEventListener('click', () => overlay.querySelector('.modal-close').click());

  const avisos = h('div', { class: 'vi-avisos', id: 'vi-rec-avisos', 'aria-live': 'assertive' });
  const limpiarAviso = () => avisos.replaceChildren();

  // ---------- Concepto (combo; los rubros no disponibles quedan deshabilitados y su motivo sale al pasar el mouse) ----------
  const opcionesRubro = RUBROS_RECIBO.map(r => ({
    valor: r, texto: nombreRubro(r), deshabilitada: !disponibilidad[r].disponible,
    titulo: disponibilidad[r].motivo ? textoDeError(disponibilidad[r].motivo) : undefined
  }));
  const comboRubro = crearCombo({
    id: 'vi-rec-rubro', name: 'rubro', etiquetaAria: t('recibo.concepto'), grupos: [{ opciones: opcionesRubro }], valor: f.rubro,
    alCambiar: (rubro) => elegirRubro(rubro)
  });
  const elegirRubro = (rubro) => {
    if (rubro === f.rubro || !disponibilidad[rubro].disponible) return;
    cambiarRubro(f, liq, rubro);
    monto.value = f.monto;
    pintarConcepto();
    limpiarErrorCampo(comboRubro);
    pedirLetras();
  };
  const campoRubro = crearCampo({ etiqueta: t('recibo.concepto'), control: comboRubro, idControl: 'vi-rec-rubro' });

  // ---------- Fecha, monto y monto en letras ----------
  const campoFecha = crearCampoFecha({ id: 'vi-rec-fecha', name: 'fecha', etiqueta: t('recibo.fecha') });
  const monto = crearCampoNumerico({
    id: 'vi-rec-monto', name: 'monto', valor: f.monto, placeholder: t('liquidacion.borrador.montoEjemplo'),
    alCambiar: (v) => { f.monto = v; f.montoEditado = true; limpiarErrorCampo(monto); pedirLetras(); }
  });
  const campoLetras = crearCampoCalculado({ etiqueta: t('recibo.letras'), id: 'vi-rec-letras', clase: 'vi-rec-letras' });
  const salidaLetras = campoLetras.querySelector('output');

  // Debounce y número de pedido: una respuesta vieja nunca pisa a la del último monto escrito.
  function pedirLetras() {
    clearTimeout(esperaLetras);
    const numero = ++pedidoLetras;
    const valor = montoParaLetras(f.monto);
    if (valor === null) { ponerCalculado(salidaLetras, ''); return; }
    ponerCalculado(salidaLetras, t('recibo.letras.calculando'));
    esperaLetras = setTimeout(async () => {
      try {
        const r = await montoEnLetrasRecibo(solicitudId, valor);
        if (numero === pedidoLetras) ponerCalculado(salidaLetras, r.montoLetras);
      } catch (error) {
        if (numero === pedidoLetras) ponerCalculado(salidaLetras, '');
      }
    }, ESPERA_LETRAS_MS);
  }

  // ---------- Textos ----------
  const recibiDe = h('input', { type: 'text', id: 'vi-rec-recibi', name: 'recibiDe', maxlength: String(LIMITES_RECIBO.RECIBI_DE), autocomplete: 'off', placeholder: t('recibo.recibiDe.ejemplo') });
  recibiDe.addEventListener('input', () => { f.recibiDe = recibiDe.value; limpiarErrorCampo(recibiDe); });
  // Texto libre solo con «Otro»; con Alimentación o Depreciación el concepto lo arma el servidor.
  const concepto = h('input', { type: 'text', id: 'vi-rec-concepto', name: 'concepto', maxlength: String(LIMITES_RECIBO.CONCEPTO), autocomplete: 'off', placeholder: t('recibo.concepto.ejemplo') });
  concepto.value = f.concepto;
  concepto.addEventListener('input', () => { f.concepto = concepto.value; limpiarErrorCampo(concepto); });
  const campoConcepto = crearCampo({ etiqueta: t('recibo.concepto'), control: concepto, idControl: 'vi-rec-concepto' });
  function pintarConcepto() { campoConcepto.hidden = f.rubro !== 'otro'; }

  // ---------- Forma de pago (radios nativos) y sus números ----------
  const radios = FORMAS_PAGO.map(forma => {
    const radio = h('input', { type: 'radio', name: 'formaPago', value: forma, id: `vi-rec-pago-${forma}` });
    radio.addEventListener('change', () => { f.formaPago = forma; limpiarErrorCampo(radio); pintarNumerosPago(); });
    return h('label', { class: 'vi-rec-pago', for: `vi-rec-pago-${forma}` }, radio, h('span', { text: t(`recibo.formaPago.${forma}`) }));
  });
  const numeroCheque = h('input', { type: 'text', id: 'vi-rec-cheque', name: 'numeroCheque', maxlength: String(LIMITES_RECIBO.NUMERO_CHEQUE), autocomplete: 'off' });
  numeroCheque.addEventListener('input', () => { f.numeroCheque = numeroCheque.value; limpiarErrorCampo(numeroCheque); });
  const numeroCuenta = h('input', { type: 'text', id: 'vi-rec-cuenta', name: 'numeroCuenta', maxlength: String(LIMITES_RECIBO.NUMERO_CUENTA), autocomplete: 'off' });
  numeroCuenta.addEventListener('input', () => { f.numeroCuenta = numeroCuenta.value; limpiarErrorCampo(numeroCuenta); });
  const campoCheque = crearCampo({ etiqueta: t('recibo.numeroCheque'), control: numeroCheque, idControl: 'vi-rec-cheque', clase: 'vi-rec-numero' });
  const campoCuenta = crearCampo({ etiqueta: t('recibo.numeroCuenta.opcional'), control: numeroCuenta, idControl: 'vi-rec-cuenta', clase: 'vi-rec-numero' });
  const filaPago = h('div', { class: 'vi-rec-fila', id: 'vi-rec-numeros-pago' }, campoCheque, campoCuenta);
  function pintarNumerosPago() {
    campoCheque.hidden = f.formaPago !== 'cheque';
    campoCuenta.hidden = f.formaPago !== 'transferencia';
    filaPago.hidden = campoCheque.hidden && campoCuenta.hidden;
  }

  // ---------- Firma: se hace a pantalla completa y aquí solo se ve la vista previa ----------
  const bloqueFirma = h('div', { class: 'vi-rec-firma__caja', 'data-campo': 'firma', id: 'vi-rec-firma' });
  function pintarFirma() {
    if (!f.firma) {
      bloqueFirma.replaceChildren(
        h('button', { type: 'button', class: 'btn btn--primary vi-rec-firmar', id: 'vi-rec-firmar', onclick: firmar }, icono('create-outline'), t('recibo.firmar')));
      return;
    }
    bloqueFirma.replaceChildren(
      h('img', { class: 'vi-rec-firma__imagen', src: urlFirma, alt: t('recibo.firma.alt') }),
      h('button', { type: 'button', class: 'btn btn--ghost btn--sm', id: 'vi-rec-refirmar', text: t('recibo.firma.volver'), onclick: firmar }));
  }
  async function firmar() {
    if (guardando) return;
    const blob = await abrirFirmaPantalla({ nombre: sugerencias.solicitanteNombre || '' });
    if (!blob) return;
    if (urlFirma) URL.revokeObjectURL(urlFirma);
    urlFirma = URL.createObjectURL(blob);
    f.firma = blob;
    f.firmaN += 1;
    limpiarErrorCampo(bloqueFirma);
    pintarFirma();
    const refirmar = bloqueFirma.querySelector('#vi-rec-refirmar');
    if (refirmar) refirmar.focus();
  }
  const campoFirma = h('div', { class: 'form-field vi-rec-firma' },
    h('span', { class: 'vi-etiqueta', id: 'vi-rec-firma-etiqueta', text: t('recibo.firma') }),
    bloqueFirma,
    h('div', { class: 'vi-rec-firma__pie' },
      h('span', { class: 'vi-rec-firma__linea', 'aria-hidden': 'true' }),
      sugerencias.solicitanteNombre && h('strong', { text: sugerencias.solicitanteNombre }),
      h('small', { text: t('recibo.recibiConforme') })));

  const formulario = h('div', { class: 'vi-rec-form', id: 'vi-rec-form' },
    campoRubro,
    h('div', { class: 'vi-rec-fila' },
      campoFecha,
      crearCampo({ etiqueta: t('recibo.monto', { simbolo }), control: monto, idControl: 'vi-rec-monto' })),
    campoLetras,
    crearCampo({ etiqueta: t('recibo.recibiDe'), control: recibiDe, idControl: 'vi-rec-recibi' }),
    campoConcepto,
    h('div', { class: 'form-field vi-rec-campo-pago', role: 'radiogroup', 'aria-labelledby': 'vi-rec-pago-etiqueta' },
      h('span', { class: 'vi-etiqueta', id: 'vi-rec-pago-etiqueta', text: t('recibo.formaPago') }),
      h('div', { class: 'vi-rec-pagos' }, radios)),
    filaPago,
    campoFirma);
  cuerpo.replaceChildren(avisos, formulario);

  const fecha = wireCampoFecha(formulario, 'fecha');
  if (f.fecha) fecha.setDate(parseIsoLocal(f.fecha), { silent: true });
  formulario.querySelector('input[name="fecha"]').addEventListener('change', (e) => {
    f.fecha = e.target.value;
    limpiarErrorCampo(e.target);
  });

  // Cada error es un ícono en la esquina de su campo (el mensaje sale al tocarlo), como en el modal de solicitud; lo que no es de un campo va en un aviso.
  function mostrarErrores(campos) {
    formulario.querySelectorAll('.form-field.is-invalid').forEach(w => w.classList.remove('is-invalid'));
    formulario.querySelectorAll('.field-error').forEach(m => m.remove());
    limpiarAviso();
    marcarErroresDeCampos(formulario, campos);
    enfocarPrimerCampoInvalido(formulario);
  }

  async function guardar() {
    if (guardando) return;
    limpiarAviso();
    const errores = validarRecibo(f, { hoy: sugerencias.fecha || null, disponibilidad });
    if (Object.keys(errores).length) {
      mostrarErrores(Object.fromEntries(Object.entries(errores).map(([campo, e]) => [campo, textoDeError(e)])));
      return;
    }
    guardando = true;
    botonGuardar.disabled = true;
    botonGuardar.classList.add('btn--loading');
    try {
      const respuesta = await crearRecibo(solicitudId, { ...datosDeEnvio(f), idempotencyKey: llaveDeRecibo(f, crearLlaveIdempotencia) }, f.firma);
      const { recibo, ...nueva } = respuesta;
      cerrar();
      alGuardar(nueva, recibo);
    } catch (error) {
      guardando = false;
      botonGuardar.disabled = false;
      botonGuardar.classList.remove('btn--loading');
      if (error.status === 400 && error.campos && Object.keys(error.campos).length) { mostrarErrores(error.campos); return; }
      // 409 (el rubro ya tiene su recibo), 403 (ya no se puede liquidar) y fallos de red: el mensaje del servidor explica qué pasó.
      avisos.replaceChildren(crearAviso({ tipo: 'error', titulo: t('recibo.error.guardar'), texto: mensajesDeError(error).join(' ') }));
      avisos.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
  botonGuardar.addEventListener('click', guardar);

  pintarConcepto();
  pintarNumerosPago();
  pintarFirma();
  pedirLetras();
  comboRubro.focus();
  return { cerrar };
}
