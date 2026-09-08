import { state } from '../state.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { etiquetaEstado } from '../permisos.js';
import { formatearFecha } from '../utils/formato.js';
import { autorizarCreacion, obtenerDetalleVale, aprobarModificacion } from '../api/valesApi.js';
import { cargarBuzon } from '../views/buzon.js';

// -----------------------------------------------------------------------
// Supervisor: autorizar el envío a talleres de un vale recién creado — el
// asesor eligió los talleres al crear (vale.talleres_solicitados, CSV de
// ids); recién aquí se reparten de verdad.
// -----------------------------------------------------------------------
export function abrirModalAutorizarCreacion(vale) {
  const talleresIds = String(vale.talleres_solicitados || '').split(',').map(Number).filter(Number.isFinite);
  const nombresTalleres = talleresIds
    .map(id => ((state.catalogos.talleres || []).find(t => t.id === id) || {}).nombre || `#${id}`)
    .join(', ');
  const { overlay, cerrar } = abrirModal({
    title: `Autorizar creación — ${vale.correlativo}`,
    bodyHtml: `
      <p style="font-size:13px;margin-bottom:10px;">Taller${talleresIds.length > 1 ? 'es' : ''} solicitado${talleresIds.length > 1 ? 's' : ''}: <strong>${nombresTalleres || 'Ninguno'}</strong></p>
      <p style="font-size:13px;">¿Confirmas autorizar este vale de arte? Se enviará de inmediato a ese/esos taller(es) y quedará firmado con tu nombre en el documento.</p>
    `,
    footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-confirmar">Autorizar</button>`
  });
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
}

// -----------------------------------------------------------------------
// Supervisor: aprobar modificación (crea el vale MOD- nuevo)
// -----------------------------------------------------------------------
export async function abrirModalAprobarModificacion(vale) {
  // El supervisor necesita ver la justificación para decidir.
  let detalle;
  try {
    detalle = await obtenerDetalleVale(vale.id);
  } catch {
    detalle = { solicitudModificacion: null };
  }
  const justificacion = detalle.solicitudModificacion && detalle.solicitudModificacion.justificacion;
  // `detalle` es un fetch fresco hecho acá mismo, así que es la fuente
  // correcta del link de "Ver propuesta"; se conserva `vale...` solo como
  // respaldo si ese fetch fallara.
  const propuestaUrl = detalle.propuesta_general_url || vale.propuesta_general_url;

  const { overlay, cerrar } = abrirModal({
    title: `Autorizar modificación — ${vale.correlativo}`,
    bodyHtml: `
      <div class="form-field full" style="margin-bottom:14px;">
        <label>Justificación de la modificación</label>
        <p style="font-size:13px;white-space:pre-wrap;">${justificacion || 'Sin justificación registrada.'}</p>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
        <a href="/api/vales/${vale.id}/pdf" target="_blank" class="btn btn--ghost" style="text-decoration:none;display:inline-flex;">Ver vale de arte (PDF)</a>
        ${propuestaUrl ? `<a href="/${propuestaUrl}" target="_blank" class="btn btn--ghost" style="text-decoration:none;display:inline-flex;">Ver propuesta</a>` : ''}
      </div>
      <p style="font-size:13px;">¿Confirmas autorizar la modificación solicitada para este vale de arte? Se creará un vale de arte nuevo con el prefijo MOD-, enviado de inmediato al taller que el asesor indicó (o al mismo de siempre, si solo hay uno).</p>
    `,
    footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-confirmar">Autorizar</button>`
  });
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelector('#btn-confirmar').addEventListener('click', async () => {
    const btn = overlay.querySelector('#btn-confirmar');
    btn.disabled = true;
    try {
      const data = await aprobarModificacion(vale.id);
      window.toast.success('Modificación autorizada', `Se creó el vale ${data.correlativo}.`);
      cerrar();
      cargarBuzon();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
      // Otro supervisor pudo haberlo aprobado un instante antes — refresca el
      // buzón para que este vale deje de aparecer accionable de inmediato.
      cargarBuzon();
    }
  });
}

// -----------------------------------------------------------------------
// Supervisor: "Ver" abre a elegir entre info de encabezado o el PDF completo
// — a veces solo hace falta lo primero.
// -----------------------------------------------------------------------
export function abrirModalVerSupervisor(v) {
  const { overlay, cerrar } = abrirModal({
    title: `Ver vale de arte — ${v.correlativo}`,
    bodyHtml: `<p style="font-size:13px;">¿Qué necesitas ver?</p>`,
    footerHtml: `
      <button class="btn btn--ghost" id="btn-ver-info">Ver info</button>
      <button class="btn btn--primary" id="btn-ver-pdf">Ver vale</button>
    `
  });
  overlay.querySelector('#btn-ver-pdf').addEventListener('click', () => {
    window.open(`/api/vales/${v.id}/pdf`, '_blank');
    cerrar();
  });
  overlay.querySelector('#btn-ver-info').addEventListener('click', () => {
    cerrar();
    abrirModalInfoVale(v);
  });
}

export function abrirModalInfoVale(v) {
  const campo = (etiqueta, valor) => `
    <div class="form-field"><label>${etiqueta}</label><p style="font-size:13px;margin:0;">${valor || '-'}</p></div>
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
