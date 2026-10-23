import { state } from '../state.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { etiquetaEstado } from '../permisos.js';
import { formatearFecha, escapeHtml, correlativoBase } from '../utils/formato.js';
import { autorizarCreacion, rechazarCreacion, obtenerDetalleVale, obtenerPropuestaVale, aprobarModificacion, rechazarModificacion, marcarValeVisto } from '../api/valesApi.js';
import { cargarBuzon } from '../views/buzon.js';
import { abrirVisorVale, abrirVisorDocumentos } from '../components/visorDocumento.js';

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
    : '<div class="form-aviso"><ion-icon name="alert-circle-outline"></ion-icon><span>Antes de autorizar, abre el vale con «Ver».</span></div>';
}

function registrarVisto(vale) {
  vale.visto = true;
  return marcarValeVisto(vale.id).catch(() => { /* el servidor lo exigirá al autorizar */ });
}

// Modal de autorización abierto en este momento (para avisarle si el asesor corrige el vale).
let modalAutorizarAbierto = null;

export function avisarCambioEnModalAutorizar(valeId) {
  const abierto = modalAutorizarAbierto;
  if (!abierto || abierto.valeId !== Number(valeId) || !abierto.overlay.isConnected) return;
  const cuerpo = abierto.overlay.querySelector('.modal-body');
  if (!cuerpo) {
    const subtitulo = abierto.overlay.querySelector('.visor-titulos p');
    if (subtitulo) { subtitulo.textContent = 'El asesor cambió este vale. Cierra y vuelve a abrir.'; subtitulo.style.color = 'var(--color-danger)'; }
    return;
  }
  if (cuerpo.querySelector('.form-aviso')) return;
  const aviso = document.createElement('div');
  aviso.className = 'form-aviso';
  aviso.innerHTML = '<ion-icon name="alert-circle-outline"></ion-icon><span>El asesor cambió este vale. Cierra y vuelve a abrir.</span>';
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
      <p style="font-size:13px;">¿Autorizar? Se envía ahora al taller y queda firmado con tu nombre.</p>
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
      window.toast.success('Creación autorizada', `${vale.correlativo} ya está ${talleresIds.length > 1 ? 'en los talleres' : 'en el taller'}.`);
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

// Rechazo con justificación (máx. 50 palabras): el vale vuelve al asesor; una modificación se elimina.
function abrirModalRechazarCreacion(vale, cerrarAutorizacion, { modificacion = false } = {}) {
  const { overlay, cerrar } = abrirModal({
    title: `${modificacion ? 'Rechazar modificación' : 'Rechazar vale'} — ${vale.correlativo}`,
    bodyHtml: `
      <p style="font-size:13px;margin-bottom:10px;">${modificacion
        ? 'Se elimina la modificación y el asesor verá tu justificación. El vale anterior sigue Recibido.'
        : 'El asesor lo corrige y lo reenvía con tu justificación.'}</p>
      <div class="form-field full">
        <label>Justificación *</label>
        <textarea id="motivo-rechazo" rows="4" maxlength="400"></textarea>
        <div class="contador-palabras" id="motivo-palabras">0/${MAX_PALABRAS_MOTIVO} palabras</div>
      </div>
    `,
    footerHtml: `<button class="btn btn--ghost" id="btn-volver">Volver</button><button class="btn btn--danger" id="btn-rechazar-confirmar">${modificacion ? 'Rechazar y eliminar' : 'Rechazar y devolver al asesor'}</button>`
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
      window.toast.success(modificacion ? 'Modificación rechazada' : 'Vale rechazado', modificacion ? `${vale.correlativo} eliminada. El asesor verá tu justificación.` : `${vale.correlativo} volvió al asesor con tu justificación.`);
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
// Supervisor: autorizar una modificación media o avanzada. `vale` es el vale MOD (una fila propia del Buzón); su descripción es
// la justificación y el vale que modifica es `vale_original_id` (el original, o el MOD anterior en MOD2, MOD3…).
// -----------------------------------------------------------------------
export async function abrirModalAprobarModificacion(vale) {
  let original = null;
  try { original = await obtenerDetalleVale(vale.vale_original_id); } catch { /* sin datos del vale que modifica */ }
  const correlativoOriginal = (original && original.correlativo) || correlativoBase(vale.correlativo);
  const hayPropuesta = !!(original && (original.propuesta_general_url || (original.propuestas || []).some(p => p.url)));
  const tipo = { MEDIA: ' media', AVANZADA: ' avanzada' }[vale.modificacion_tipo] || '';

  const documentos = [
    {
      etiqueta: 'Datos',
      html: htmlDatosVale(vale, { destacado: vale.descripcion || '' })
    },
    { etiqueta: 'Vale nuevo', url: `/api/vales/${vale.id}/pdf` },
    { etiqueta: correlativoOriginal, url: `/api/vales/${vale.vale_original_id}/pdf` }
  ];
  if (hayPropuesta) documentos.push({ etiqueta: 'Propuesta', cargar: () => obtenerPropuestaVale(vale.vale_original_id, { tipo: 'general' }) });

  // Abrir el visor cuenta como haber visto el vale nuevo (pestaña inicial); el servidor lo exige al autorizar.
  const visto = vale.visto ? Promise.resolve() : registrarVisto(vale);
  const autorizar = async ({ cerrar, boton }) => {
    boton.disabled = true;
    try {
      await visto;
      const data = await aprobarModificacion(vale.id);
      window.toast.success('Modificación autorizada', `${data.correlativo} ya está en los talleres.`);
      cerrar();
      cargarBuzon();
    } catch (error) {
      window.toast.error('No se pudo autorizar', error.message);
      boton.disabled = false;
      // Otro supervisor pudo haberla decidido un instante antes: se refresca el buzón.
      cargarBuzon();
    }
  };
  const visor = abrirVisorDocumentos({
    titulo: `Autorizar modificación${tipo} — ${vale.correlativo}`,
    subtitulo: 'Se envía a los mismos talleres al autorizar.',
    documentos,
    activo: 1,
    acciones: [
      { etiqueta: 'Rechazar', icono: 'close-outline', clase: 'btn--danger', onClick: ({ cerrar }) => abrirModalRechazarCreacion(vale, cerrar, { modificacion: true }) },
      { etiqueta: 'Autorizar', icono: 'checkmark-outline', clase: 'btn--primary', onClick: autorizar }
    ]
  });
  if (visor) modalAutorizarAbierto = { valeId: vale.id, overlay: visor.overlay };
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
    cerrar();
    abrirVisorVale({ id: v.id, correlativo: v.correlativo, propuesta: v.propuesta_general_url || v.propuesta_extra ? { tipo: 'general' } : null });
  });
  overlay.querySelector('#btn-ver-info').addEventListener('click', () => {
    registrarVisto(fila);
    cerrar();
    abrirModalInfoVale(v);
  });
}

// Datos del vale (fila del Buzón) en secciones de solo lectura. `destacado`: texto opcional que se muestra arriba (p. ej. la justificación).
function htmlDatosVale(v, { destacado = null } = {}) {
  const dato = (etiqueta, valor, { ancho = false, enNegrita = false } = {}) => `
    <div class="dato${ancho ? ' dato--ancho' : ''}"><dt>${etiqueta}</dt><dd${valor ? (enNegrita ? ' class="fecha-entrega"' : '') : ' class="dato-vacio"'}>${valor ? escapeHtml(String(valor)) : 'Sin dato'}</dd></div>`;
  const seccion = (icono, titulo, contenido) => `
    <section class="datos-seccion">
      <h4><ion-icon name="${icono}" aria-hidden="true"></ion-icon>${titulo}</h4>
      <dl class="datos-grid">${contenido}</dl>
    </section>`;
  return `
    <div class="datos">
      ${destacado === null ? '' : `
      <div class="datos-destacado">
        <ion-icon name="chatbubble-ellipses-outline" aria-hidden="true"></ion-icon>
        <div><strong>Justificación</strong><p>${destacado ? escapeHtml(destacado) : 'Sin justificación registrada.'}</p></div>
      </div>`}
      ${seccion('calendar-outline', 'Entrega', `
        ${dato('Estado', etiquetaEstado(v))}
        ${dato('Taller(es)', v.taller)}
        ${dato('Fecha de entrega', formatearFecha(v.fecha_entrega), { enNegrita: true })}
        ${dato('Fecha del evento', formatearFecha(v.fecha_evento))}
        ${dato('Urgente', v.urgente ? 'Sí' : 'No')}`)}
      ${seccion('person-outline', 'Cliente', `
        ${dato('Cliente', v.cliente_nombre)}
        ${dato('Empresa', v.cliente_empresa)}
        ${dato('Teléfono', v.cliente_telefono)}
        ${dato('Correo', v.cliente_correo)}`)}
      ${seccion('cube-outline', 'Pedido', `
        ${dato('Código de producto', v.producto)}
        ${dato('Material', v.material)}
        ${dato('Técnica', v.tecnica)}
        ${dato('Acabado', v.acabado)}
        ${dato('Cantidad', v.cantidad)}
        ${dato('Cotización', v.cotizacion != null ? `Q${Number(v.cotizacion).toFixed(2)}` : '')}`)}
    </div>`;
}

export function abrirModalInfoVale(v) {
  const { overlay, cerrar } = abrirModal({
    title: `Información — ${v.correlativo}`,
    size: 'lg',
    bodyHtml: htmlDatosVale(v),
    footerHtml: `<button class="btn btn--primary" id="btn-cerrar-info">Cerrar</button>`
  });
  overlay.querySelector('#btn-cerrar-info').addEventListener('click', cerrar);
}
