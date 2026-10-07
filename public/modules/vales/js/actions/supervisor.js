import { state } from '../state.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { etiquetaEstado } from '../permisos.js';
import { formatearFecha, escapeHtml } from '../utils/formato.js';
import { autorizarCreacion, rechazarCreacion, obtenerDetalleVale, aprobarModificacion, rechazarModificacion, marcarValeVisto } from '../api/valesApi.js';
import { cargarBuzon } from '../views/buzon.js';

// -----------------------------------------------------------------------
// Supervisor: autorizar el envío a talleres de un vale recién creado — el
// asesor eligió los talleres al crear (vale.talleres_solicitados, CSV de
// ids); recién aquí se reparten de verdad.
// -----------------------------------------------------------------------
const MAX_PALABRAS_MOTIVO = 50;

// El supervisor debe haber abierto "Ver" en el vale antes de autorizarlo (también se exige en el servidor).
function htmlAvisoVisto(vale) {
  return vale.visto
    ? '<p class="nota-visto"><ion-icon name="checkmark-circle-outline"></ion-icon> Ya revisaste este vale.</p>'
    : '<div class="form-aviso"><ion-icon name="alert-circle-outline"></ion-icon><span>Es de suma importancia que hayas visto este vale antes de autorizarlo. Cierra esta ventana, abre el botón "Ver" del vale y vuelve a intentarlo.</span></div>';
}

function registrarVisto(vale) {
  vale.visto = true;
  marcarValeVisto(vale.id).catch(() => { /* el servidor lo exigirá al autorizar */ });
}

// Modal de autorización abierto en este momento (para avisarle si el asesor corrige el vale).
let modalAutorizarAbierto = null;

export function avisarCambioEnModalAutorizar(valeId) {
  const abierto = modalAutorizarAbierto;
  if (!abierto || abierto.valeId !== Number(valeId) || !abierto.overlay.isConnected) return;
  const cuerpo = abierto.overlay.querySelector('.modal-body');
  if (cuerpo.querySelector('.form-aviso')) return;
  const aviso = document.createElement('div');
  aviso.className = 'form-aviso';
  aviso.innerHTML = '<ion-icon name="alert-circle-outline"></ion-icon><span>El asesor modificó este vale. Cierra esta ventana y ábrela de nuevo para ver los datos actualizados.</span>';
  cuerpo.prepend(aviso);
}

export function abrirModalAutorizarCreacion(vale) {
  const talleresIds = String(vale.talleres_solicitados || '').split(',').map(Number).filter(Number.isFinite);
  const nombresTalleres = talleresIds
    .map(id => ((state.catalogos.talleres || []).find(t => t.id === id) || {}).nombre || `#${id}`)
    .join(', ');
  const { overlay, cerrar } = abrirModal({
    title: `Autorizar creación — ${vale.correlativo}`,
    bodyHtml: `
      ${htmlAvisoVisto(vale)}
      <p style="font-size:13px;margin-bottom:10px;">Taller${talleresIds.length > 1 ? 'es' : ''} solicitado${talleresIds.length > 1 ? 's' : ''}: <strong>${nombresTalleres || 'Ninguno'}</strong></p>
      <p style="font-size:13px;">¿Confirmas autorizar este vale de arte? Se enviará de inmediato a ese/esos taller(es) y quedará firmado con tu nombre en el documento.</p>
    `,
    footerHtml: `
      <button class="btn btn--danger" id="btn-rechazar" style="margin-right:auto;">Rechazar</button>
      <button class="btn btn--ghost" id="btn-cerrar">Cancelar</button>
      <button class="btn btn--primary" id="btn-confirmar">Autorizar</button>
    `
  });
  modalAutorizarAbierto = { valeId: vale.id, overlay };
  overlay.querySelector('#btn-confirmar').disabled = !vale.visto;
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelector('#btn-confirmar').addEventListener('click', async () => {
    const btn = overlay.querySelector('#btn-confirmar');
    btn.disabled = true;
    try {
      await autorizarCreacion(vale.id);
      window.toast.success('Creación autorizada', `${vale.correlativo} se creó correctamente, enviado ${talleresIds.length > 1 ? 'a los talleres' : 'al taller'} seleccionado${talleresIds.length > 1 ? 's' : ''}.`);
      cerrar();
      cargarBuzon();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
      // Otro supervisor pudo haberlo autorizado un instante antes — refresca
      // el buzón para que este vale deje de aparecer accionable de inmediato,
      // sin esperar a que el evento de socket llegue o a un refresco manual.
      cargarBuzon();
    }
  });
  overlay.querySelector('#btn-rechazar').addEventListener('click', () => abrirModalRechazarCreacion(vale, cerrar));
}

// Rechazo con justificación (máx. 50 palabras): el vale (o la solicitud de modificación) vuelve al asesor, no se borra.
function abrirModalRechazarCreacion(vale, cerrarAutorizacion, { modificacion = false } = {}) {
  const { overlay, cerrar } = abrirModal({
    title: `${modificacion ? 'Rechazar modificación' : 'Rechazar vale'} — ${vale.correlativo}`,
    bodyHtml: `
      <p style="font-size:13px;margin-bottom:10px;">${modificacion ? 'La solicitud' : 'El vale'} volverá al asesor con tu justificación para que ${modificacion ? 'la' : 'lo'} corrija y ${modificacion ? 'la' : 'lo'} reenvíe.</p>
      <div class="form-field full">
        <label>Justificación *</label>
        <textarea id="motivo-rechazo" rows="4" maxlength="400"></textarea>
        <div class="contador-palabras" id="motivo-palabras">0/${MAX_PALABRAS_MOTIVO} palabras</div>
      </div>
    `,
    footerHtml: `<button class="btn btn--ghost" id="btn-volver">Volver</button><button class="btn btn--danger" id="btn-rechazar-confirmar">Rechazar y devolver al asesor</button>`
  });
  const textarea = overlay.querySelector('#motivo-rechazo');
  const contador = overlay.querySelector('#motivo-palabras');
  const btn = overlay.querySelector('#btn-rechazar-confirmar');
  const palabras = () => textarea.value.trim().split(/\s+/).filter(Boolean).length;
  const actualizar = () => {
    const n = palabras();
    contador.textContent = `${n}/${MAX_PALABRAS_MOTIVO} palabras`;
    contador.classList.toggle('is-excedido', n > MAX_PALABRAS_MOTIVO);
    btn.disabled = n === 0 || n > MAX_PALABRAS_MOTIVO;
  };
  textarea.addEventListener('input', actualizar);
  actualizar();
  overlay.querySelector('#btn-volver').addEventListener('click', cerrar);
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await (modificacion ? rechazarModificacion : rechazarCreacion)(vale.id, textarea.value.trim());
      window.toast.success(modificacion ? 'Modificación rechazada' : 'Vale rechazado', `${vale.correlativo} volvió al asesor con tu justificación.`);
      cerrar();
      cerrarAutorizacion();
      cargarBuzon();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      actualizar();
      cargarBuzon();
    }
  });
}

// -----------------------------------------------------------------------
// Supervisor: autorizar una modificación. `vale` es el vale MOD- (una fila propia del Buzón); su descripción es la
// justificación y su original es `vale_original_id`.
// -----------------------------------------------------------------------
export async function abrirModalAprobarModificacion(vale) {
  let propuestaUrl = null;
  try {
    propuestaUrl = (await obtenerDetalleVale(vale.vale_original_id)).propuesta_general_url || null;
  } catch { /* sin propuesta del original */ }
  const correlativoOriginal = String(vale.correlativo || '').replace(/^MOD-/, '');

  const { overlay, cerrar } = abrirModal({
    title: `Autorizar modificación — ${vale.correlativo}`,
    bodyHtml: `
      <div class="aviso-visto">${htmlAvisoVisto(vale)}</div>
      <div class="form-field full" style="margin-bottom:14px;">
        <label>Justificación de la modificación</label>
        <p style="font-size:13px;white-space:pre-wrap;">${vale.descripcion ? escapeHtml(vale.descripcion) : 'Sin justificación registrada.'}</p>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
        <a href="/api/vales/${vale.id}/pdf" target="_blank" data-visto class="btn btn--ghost" style="text-decoration:none;display:inline-flex;">Ver vale modificado (PDF)</a>
        <a href="/api/vales/${vale.vale_original_id}/pdf" target="_blank" class="btn btn--ghost" style="text-decoration:none;display:inline-flex;">Ver vale original (PDF)</a>
        ${propuestaUrl ? `<a href="${propuestaUrl}" target="_blank" class="btn btn--ghost" style="text-decoration:none;display:inline-flex;">Ver propuesta</a>` : ''}
      </div>
      <p style="font-size:13px;">¿Confirmas autorizar la modificación de ${escapeHtml(correlativoOriginal)}? El vale ${escapeHtml(vale.correlativo)} quedará autorizado y se enviará de inmediato a los mismos talleres del vale original.</p>
    `,
    footerHtml: `
      <button class="btn btn--danger" id="btn-rechazar" style="margin-right:auto;">Rechazar</button>
      <button class="btn btn--ghost" id="btn-cerrar">Cancelar</button>
      <button class="btn btn--primary" id="btn-confirmar">Autorizar</button>
    `
  });
  modalAutorizarAbierto = { valeId: vale.id, overlay };
  overlay.querySelector('#btn-confirmar').disabled = !vale.visto;
  // Abrir el PDF de la modificación desde aquí también cuenta como haberla visto.
  overlay.querySelector('a[data-visto]').addEventListener('click', () => {
    registrarVisto(vale);
    overlay.querySelector('.aviso-visto').innerHTML = htmlAvisoVisto(vale);
    overlay.querySelector('#btn-confirmar').disabled = false;
  });
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelector('#btn-confirmar').addEventListener('click', async () => {
    const btn = overlay.querySelector('#btn-confirmar');
    btn.disabled = true;
    try {
      const data = await aprobarModificacion(vale.id);
      window.toast.success('Modificación autorizada', `El vale ${data.correlativo} quedó autorizado y fue enviado a los talleres.`);
      cerrar();
      cargarBuzon();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
      // Otro supervisor pudo haberla decidido un instante antes: se refresca el buzón.
      cargarBuzon();
    }
  });
  overlay.querySelector('#btn-rechazar').addEventListener('click', () => abrirModalRechazarCreacion(vale, cerrar, { modificacion: true }));
}

// -----------------------------------------------------------------------
// Supervisor: "Ver" abre a elegir entre info de encabezado o el PDF completo
// — a veces solo hace falta lo primero.
// -----------------------------------------------------------------------
export function abrirModalVerSupervisor(fila) {
  const v = fila;
  const { overlay, cerrar } = abrirModal({
    title: `Ver vale de arte — ${v.correlativo}`,
    bodyHtml: `<p style="font-size:13px;">¿Qué necesitas ver?</p>`,
    footerHtml: `
      <button class="btn btn--ghost" id="btn-ver-info">Ver info</button>
      <button class="btn btn--primary" id="btn-ver-pdf">Ver vale</button>
    `
  });
  overlay.querySelector('#btn-ver-pdf').addEventListener('click', () => {
    registrarVisto(fila);
    window.open(`/api/vales/${v.id}/pdf`, '_blank');
    cerrar();
  });
  overlay.querySelector('#btn-ver-info').addEventListener('click', () => {
    registrarVisto(fila);
    cerrar();
    abrirModalInfoVale(v);
  });
}

export function abrirModalInfoVale(v) {
  const campo = (etiqueta, valor) => `
    <div class="form-field"><label>${etiqueta}</label><p style="font-size:13px;margin:0;">${valor ? escapeHtml(String(valor)) : '-'}</p></div>
  `;
  const { overlay, cerrar } = abrirModal({
    title: `Información — ${v.correlativo}`,
    size: 'lg',
    bodyHtml: `
      <div class="form-grid">
        ${campo('Correlativo', v.correlativo)}
        ${campo('Estado', etiquetaEstado(v))}
        ${campo('Cliente', v.cliente_nombre)}
        ${campo('Empresa', v.cliente_empresa)}
        ${campo('Teléfono', v.cliente_telefono)}
        ${campo('Correo', v.cliente_correo)}
        ${campo('Fecha entrega', formatearFecha(v.fecha_entrega))}
        ${campo('Fecha evento', formatearFecha(v.fecha_evento))}
        ${campo('Taller(es)', v.taller)}
        ${campo('Código de producto', v.producto)}
        ${campo('Material', v.material)}
        ${campo('Técnica', v.tecnica)}
        ${campo('Acabado', v.acabado)}
        ${campo('Cantidad', v.cantidad)}
        ${campo('Cotización', v.cotizacion != null ? `Q${Number(v.cotizacion).toFixed(2)}` : '-')}
        ${campo('Urgente', v.urgente ? 'Sí' : 'No')}
      </div>
    `,
    footerHtml: `<button class="btn btn--primary" id="btn-cerrar-info">Cerrar</button>`
  });
  overlay.querySelector('#btn-cerrar-info').addEventListener('click', cerrar);
}
