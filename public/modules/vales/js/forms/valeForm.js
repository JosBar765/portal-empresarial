import { state } from '../state.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { htmlSelectorTalleres, wireSelectorTalleres, validarTalleresSeleccionados } from '../components/selectorTalleres.js';
import { htmlCampoFecha, wireCampoFecha, validarCampoFecha } from '../components/datepicker.js';
import { htmlDropzone, wireDropzone } from '../components/dropzone.js';
import { validarCamposNativos, wireLimpiezaValidacionInline, enfocarPrimerCampoInvalido } from '../components/validacion.js';
import { hoyMedianoche, sumarDiaLocal, parseIsoLocal } from '../utils/fechas.js';
import { escapeHtml } from '../utils/formato.js';
import { crearVale, solicitarModificacion, obtenerCapacidadEntrega } from '../api/valesApi.js';
import { cargarBuzon } from '../views/buzon.js';

// Mismos límites que ya exige el backend (valeController.js:
// IMAGEN_MAX_BYTES/DOCUMENTO_MAX_BYTES) — se repiten acá para poder
// rechazar el archivo desde el selector, antes de intentar subirlo.
const IMAGEN_MAX_BYTES = 2 * 1024 * 1024;
const DOCUMENTO_MAX_BYTES = 3 * 1024 * 1024;
const DESCRIPCION_MAX_CARACTERES = 600;
// Mismo límite que exige el backend para `justificacion` en
// valeConfirmacionService.solicitarModificacion — distinto del de
// descripción, no es el mismo campo.
const JUSTIFICACION_MAX_CARACTERES = 600;

export function opcionesPaises() {
  return (state.catalogos.paises || []).map(p =>
    `<option value="${p.codigo_telefono}" ${p.codigo === 'GT' ? 'selected' : ''}>${p.codigo_telefono} ${p.codigo}</option>`
  ).join('');
}

// Si la entrega queda a menos de 3 días, "Urgente" se marca solo y no se
// puede desmarcar; con más margen, el asesor decide libremente.
export function wireUrgenteAutoLock(overlay) {
  const fechaInput = overlay.querySelector('[name="fechaEntrega"]');
  const checkbox = overlay.querySelector('[name="urgente"]');
  const actualizar = () => {
    if (!fechaInput.value) { checkbox.disabled = false; return; }
    const diffDias = (parseIsoLocal(fechaInput.value) - hoyMedianoche()) / (1000 * 60 * 60 * 24);
    if (diffDias < 3) {
      checkbox.checked = true;
      checkbox.disabled = true;
    } else {
      checkbox.disabled = false;
    }
  };
  fechaInput.addEventListener('change', actualizar);
  actualizar();
}

// Contador "actual/máximo" del boceto y descripción — el límite en sí ya lo
// impone el navegador vía `maxlength` (no deja escribir de más); esto es
// solo la señal visual: el número sube mientras se escribe y, al llegar al
// máximo, se resalta en rojo junto con un aviso puntual (mismo componente
// `.field-error` que ya usa el resto de la validación inline del
// formulario, pero fuera del mecanismo de `.is-invalid` — ese se limpia
// solo en cuanto el campo vuelve a ser válido, y un textarea dentro de su
// límite SIEMPRE es válido, así que borraría el aviso al instante).
function wireContadorCampo(overlay, nombreCampo, maxCaracteres) {
  const textarea = overlay.querySelector(`[name="${nombreCampo}"]`);
  const contador = overlay.querySelector(`#${nombreCampo}-contador`);
  const alerta = overlay.querySelector(`#${nombreCampo}-alerta-limite`);
  const actualizar = () => {
    const longitud = textarea.value.length;
    const enLimite = longitud >= maxCaracteres;
    contador.textContent = `${longitud}/${maxCaracteres}`;
    contador.classList.toggle('campo-contador-limite', enLimite);
    // `.field-error` ya trae `display: flex` en el CSS, con más peso en la
    // cascada que `[hidden]` — mismo criterio que el resto del código:
    // alternar visibilidad con `style.display`.
    alerta.style.display = enLimite ? '' : 'none';
  };
  alerta.style.display = 'none';
  textarea.addEventListener('input', actualizar);
}

// -----------------------------------------------------------------------
// Modal: Crear vale de arte
// -----------------------------------------------------------------------
export function abrirModalCrearVale() {
  const tallerSeleccionados = new Set();
  const { overlay, cerrar } = abrirModal({
    title: 'Crear Vale de Arte',
    size: 'lg',
    bodyHtml: `
      <form id="form-crear-vale">
        <div class="section-title">Información de Cliente</div>
        <div class="form-grid">
          <div class="form-field"><label>Empresa</label><input type="text" name="clienteEmpresa" /></div>
          <div class="form-field"><label>Cliente *</label><input type="text" name="clienteNombre" required /></div>
          <div class="form-field">
            <label>Teléfono *</label>
            <div class="form-field-phone">
              <select name="clienteTelefonoPais">${opcionesPaises()}</select>
              <input type="text" name="clienteTelefono" required placeholder="0000-0000" />
            </div>
          </div>
          <div class="form-field"><label>Correo *</label><input type="email" name="clienteCorreo" required /></div>
        </div>

        <div class="section-title">Información de Taller</div>
        <div class="form-grid">
          ${htmlSelectorTalleres()}
        </div>

        <div class="section-title">Información de Venta</div>
        <div class="form-grid">
          ${htmlCampoFecha('Fecha de entrega', 'fechaEntrega')}
          ${htmlCampoFecha('Fecha del evento', 'fechaEvento')}
          <div class="form-field"><label>Código de producto *</label><input type="text" name="producto" required maxlength="150" placeholder="Ej. Trofeo" /></div>
          <div class="form-field"><label>Material *</label><input type="text" name="material" required maxlength="150" placeholder="Ej. Acrílico" /></div>
          <div class="form-field"><label>Técnica</label><input type="text" name="tecnica" /></div>
          <div class="form-field"><label>Acabado</label><input type="text" name="acabado" /></div>
          <div class="form-field"><label>Cantidad * (mayor a 1)</label><input type="number" name="cantidad" min="2" required /></div>
          <div class="form-field"><label>Cotización (Q) *</label><input type="number" name="cotizacion" min="0.01" step="0.01" required /></div>
          <div class="form-field form-checkbox full"><input type="checkbox" name="urgente" id="chk-urgente" /><label for="chk-urgente">Urgente</label></div>
        </div>

        <div class="section-title">Boceto y Descripción</div>
        <div class="form-grid">
          <div class="form-field full">
            <label>Descripción <span class="campo-contador" id="descripcion-contador">0/${DESCRIPCION_MAX_CARACTERES}</span></label>
            <textarea name="descripcion" maxlength="${DESCRIPCION_MAX_CARACTERES}"></textarea>
            <span class="field-error" id="descripcion-alerta-limite"><ion-icon name="alert-circle-outline"></ion-icon><span>Alcanzaste el límite de ${DESCRIPCION_MAX_CARACTERES} caracteres.</span></span>
          </div>
          <div class="form-field">
            <label>Imágenes</label>
            ${htmlDropzone({ name: 'imagenes', accept: 'image/jpeg,image/png,image/webp', multiple: true, hint: 'JPG, PNG o WEBP · máx. 2MB c/u' })}
          </div>
          <div class="form-field">
            <label>Documentos adjuntos</label>
            ${htmlDropzone({ name: 'documentos', accept: 'application/pdf', multiple: true, hint: 'PDF · máx. 3MB c/u' })}
          </div>
        </div>
      </form>
    `,
    footerHtml: `
      <button class="btn btn--ghost" id="btn-cancelar-crear">Cancelar</button>
      <button class="btn btn--primary" id="btn-guardar-crear">Crear Vale de Arte</button>
    `
  });

  wireSelectorTalleres(overlay, tallerSeleccionados);
  wireUrgenteAutoLock(overlay);
  const apiFechaEntrega = wireCampoFecha(overlay, 'fechaEntrega', {
    minDate: hoyMedianoche(),
    capacidad: {
      obtenerTalleresIds: () => [...tallerSeleccionados],
      cargarMes: obtenerCapacidadEntrega
    }
  });
  const apiFechaEvento = wireCampoFecha(overlay, 'fechaEvento', { minDate: sumarDiaLocal(hoyMedianoche(), 1) });
  overlay.querySelector('[name="fechaEntrega"]').addEventListener('change', () => {
    apiFechaEvento.setMinDate(sumarDiaLocal(apiFechaEntrega.getDate() || hoyMedianoche(), 1));
  });
  wireContadorCampo(overlay, 'descripcion', DESCRIPCION_MAX_CARACTERES);
  const getImagenes = wireDropzone(overlay, '[name="imagenes"]', '.form-field:has([name="imagenes"]) .archivo-lista', { maxBytes: IMAGEN_MAX_BYTES });
  const getDocumentos = wireDropzone(overlay, '[name="documentos"]', '.form-field:has([name="documentos"]) .archivo-lista', { maxBytes: DOCUMENTO_MAX_BYTES });

  const formCrear = overlay.querySelector('#form-crear-vale');
  wireLimpiezaValidacionInline(formCrear);

  overlay.querySelector('#btn-cancelar-crear').addEventListener('click', cerrar);
  overlay.querySelector('#btn-guardar-crear').addEventListener('click', () => {
    const form = formCrear;
    // validarCamposNativos limpia el estado de TODOS los campos nativos del
    // formulario antes de revisarlos (incluido el <select> de agregar taller,
    // que no tiene `required`) — por eso corre primero, y los validadores
    // manuales (que no son constraint-validation nativa) van después, para
    // que no les borre el error recién marcado.
    const camposOk = validarCamposNativos(form);
    const tallerOk = validarTalleresSeleccionados(overlay, tallerSeleccionados);
    const entregaOk = validarCampoFecha(overlay, 'fechaEntrega');
    const eventoOk = validarCampoFecha(overlay, 'fechaEvento');
    if (!tallerOk || !entregaOk || !eventoOk || !camposOk) {
      enfocarPrimerCampoInvalido(overlay);
      return;
    }
    const formData = new FormData(form);
    formData.set('urgente', form.querySelector('[name="urgente"]').checked ? 'true' : 'false');
    const paisCodigo = form.querySelector('[name="clienteTelefonoPais"]').value;
    const telefonoNum = form.querySelector('[name="clienteTelefono"]').value.trim();
    formData.set('clienteTelefono', `${paisCodigo} ${telefonoNum}`);
    formData.delete('clienteTelefonoPais');
    formData.set('talleresIds', JSON.stringify([...tallerSeleccionados]));
    // Las imágenes/documentos reales viven en los arrays de wireDropzone (el
    // usuario pudo quitar alguno con la "×"), no en el input nativo.
    formData.delete('imagenes');
    formData.delete('documentos');
    getImagenes().forEach(f => formData.append('imagenes', f));
    getDocumentos().forEach(f => formData.append('documentos', f));
    // Una sola key por intento de creación — si el envío falla (ej. corte de
    // red) y el usuario reintenta desde el mismo modal de confirmación, se
    // reenvía el mismo FormData con la misma key, para que el backend pueda
    // detectar el reintento y no duplicar el vale.
    formData.set('idempotencyKey', crypto.randomUUID());

    // Antes de crear el vale de verdad, se confirma con un modal resumen (el
    // modal de creación queda debajo, intacto, por si se cancela).
    abrirModalConfirmarCreacion(formData);
  });
}

function abrirModalConfirmarCreacion(formData) {
  const nombresTalleres = JSON.parse(formData.get('talleresIds') || '[]')
    .map(id => ((state.catalogos.talleres || []).find(t => t.id === id) || {}).nombre || id)
    .join(', ');
  const { overlay, cerrar } = abrirModal({
    title: 'Confirmar creación de Vale de Arte',
    bodyHtml: `
      <p style="font-size:13px;margin-bottom:10px;">Vas a crear un vale de arte con los siguientes datos:</p>
      <ul class="historial-list">
        <li><strong>Cliente:</strong> ${formData.get('clienteNombre')}</li>
        <li><strong>Talleres:</strong> ${nombresTalleres}</li>
        <li><strong>Cantidad:</strong> ${formData.get('cantidad')}</li>
        <li><strong>Cotización:</strong> Q${formData.get('cotizacion')}</li>
        <li><strong>Urgente:</strong> ${formData.get('urgente') === 'true' ? 'Sí' : 'No'}</li>
      </ul>
    `,
    footerHtml: `
      <button class="btn btn--ghost" id="btn-volver">Volver</button>
      <button class="btn btn--primary" id="btn-confirmar-crear">Confirmar y Crear</button>
    `
  });
  overlay.querySelector('#btn-volver').addEventListener('click', cerrar);
  overlay.querySelector('#btn-confirmar-crear').addEventListener('click', async () => {
    const btn = overlay.querySelector('#btn-confirmar-crear');
    btn.disabled = true;
    btn.classList.add('btn--loading');
    try {
      const data = await crearVale(formData);
      window.toast.success('Vale de arte creado', `${data.correlativo} se creó correctamente, en espera de autorización.`);
      cerrar();
      // El modal de creación original sigue debajo — se cierra también.
      document.querySelectorAll('.modal-overlay').forEach(o => o.remove());
      cargarBuzon();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
      btn.classList.remove('btn--loading');
    }
  });
}

// -----------------------------------------------------------------------
// Asesor: solicitar modificación (mismo formulario de creación, precargado;
// boceto y descripción quedan en blanco)
// -----------------------------------------------------------------------
export function abrirModalSolicitarModificacion(vale) {
  const [paisCodigoActual, ...resto] = (vale.cliente_telefono || '').split(' ');
  const telefonoActual = resto.join(' ');
  // Si el vale original fue a un solo taller (Munditrofeos o Diseño Local, da
  // igual) el destino es obvio y no se pregunta nada; si fue a 2+ talleres de
  // Munditrofeos, el asesor debe elegir a cuál(es) de esos MISMOS talleres va
  // la modificación.
  const talleresOriginal = (vale._filasTaller || [])
    .map(f => (state.catalogos.talleres || []).find(t => t.id === f.taller_id))
    .filter(Boolean);
  const requiereEleccionTaller = talleresOriginal.length > 1;

  const { overlay, cerrar } = abrirModal({
    title: `Solicitar modificación — ${vale.correlativo}`,
    size: 'lg',
    bodyHtml: `
      <form id="form-modificacion">
        <div class="section-title">Información de Cliente</div>
        <div class="form-grid">
          <div class="form-field"><label>Empresa</label><input type="text" name="clienteEmpresa" value="${escapeHtml(vale.cliente_empresa || '')}" /></div>
          <div class="form-field"><label>Cliente *</label><input type="text" name="clienteNombre" value="${escapeHtml(vale.cliente_nombre || '')}" required /></div>
          <div class="form-field">
            <label>Teléfono *</label>
            <div class="form-field-phone">
              <select name="clienteTelefonoPais">${opcionesPaises()}</select>
              <input type="text" name="clienteTelefono" value="${escapeHtml(telefonoActual)}" required placeholder="0000-0000" />
            </div>
          </div>
          <div class="form-field"><label>Correo *</label><input type="email" name="clienteCorreo" value="${escapeHtml(vale.cliente_correo || '')}" required /></div>
        </div>

        <div class="section-title">Información de Venta</div>
        <div class="form-grid">
          ${htmlCampoFecha('Fecha de entrega', 'fechaEntrega')}
          ${htmlCampoFecha('Fecha del evento', 'fechaEvento')}
          <div class="form-field"><label>Código de producto *</label><input type="text" name="producto" required maxlength="150" value="${escapeHtml(vale.producto || '')}" /></div>
          <div class="form-field"><label>Material *</label><input type="text" name="material" required maxlength="150" value="${escapeHtml(vale.material || '')}" /></div>
          <div class="form-field"><label>Técnica</label><input type="text" name="tecnica" value="${escapeHtml(vale.tecnica || '')}" /></div>
          <div class="form-field"><label>Acabado</label><input type="text" name="acabado" value="${escapeHtml(vale.acabado || '')}" /></div>
          <div class="form-field"><label>Cantidad * (mayor a 1)</label><input type="number" name="cantidad" min="2" value="${vale.cantidad || ''}" required /></div>
          <div class="form-field"><label>Cotización (Q) *</label><input type="number" name="cotizacion" min="0.01" step="0.01" value="${vale.cotizacion || ''}" required /></div>
          <div class="form-field form-checkbox full"><input type="checkbox" name="urgente" id="chk-urgente-mod" /><label for="chk-urgente-mod">Urgente</label></div>
        </div>

        ${requiereEleccionTaller ? `
        <div class="section-title">Destino de la modificación</div>
        <p style="font-size:13px;margin-bottom:10px;">Este vale se trabajó en más de un taller — elige a cuál(es) enviar la modificación:</p>
        ${htmlSelectorTalleres(talleresOriginal)}
        ` : ''}

        <div class="form-field full">
          <label>Justificación de la modificación * <span class="campo-contador" id="justificacion-contador">0/${JUSTIFICACION_MAX_CARACTERES}</span></label>
          <textarea name="justificacion" required maxlength="${JUSTIFICACION_MAX_CARACTERES}"></textarea>
          <span class="field-error" id="justificacion-alerta-limite"><ion-icon name="alert-circle-outline"></ion-icon><span>Alcanzaste el límite de ${JUSTIFICACION_MAX_CARACTERES} caracteres.</span></span>
        </div>
      </form>
    `,
    footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-enviar">Solicitar Modificación</button>`
  });

  const tallerSeleccionadosMod = new Set();
  if (requiereEleccionTaller) wireSelectorTalleres(overlay, tallerSeleccionadosMod, talleresOriginal);
  wireUrgenteAutoLock(overlay);
  const apiFechaEntregaMod = wireCampoFecha(overlay, 'fechaEntrega', {
    minDate: hoyMedianoche(),
    capacidad: {
      obtenerTalleresIds: () => requiereEleccionTaller ? [...tallerSeleccionadosMod] : talleresOriginal.map(t => t.id),
      cargarMes: obtenerCapacidadEntrega
    }
  });
  const apiFechaEventoMod = wireCampoFecha(overlay, 'fechaEvento', { minDate: sumarDiaLocal(hoyMedianoche(), 1) });
  overlay.querySelector('[name="fechaEntrega"]').addEventListener('change', () => {
    apiFechaEventoMod.setMinDate(sumarDiaLocal(apiFechaEntregaMod.getDate() || hoyMedianoche(), 1));
  });
  if (paisCodigoActual) overlay.querySelector('[name="clienteTelefonoPais"]').value = paisCodigoActual;
  wireContadorCampo(overlay, 'justificacion', JUSTIFICACION_MAX_CARACTERES);

  const formModificacion = overlay.querySelector('#form-modificacion');
  wireLimpiezaValidacionInline(formModificacion);

  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelector('#btn-enviar').addEventListener('click', async () => {
    const form = formModificacion;
    const entregaOk = validarCampoFecha(overlay, 'fechaEntrega');
    const eventoOk = validarCampoFecha(overlay, 'fechaEvento');
    const camposOk = validarCamposNativos(form);
    const tallerOk = !requiereEleccionTaller || validarTalleresSeleccionados(overlay, tallerSeleccionadosMod);
    if (!entregaOk || !eventoOk || !camposOk || !tallerOk) {
      enfocarPrimerCampoInvalido(overlay);
      return;
    }
    const fd = new FormData(form);
    const paisCodigo = fd.get('clienteTelefonoPais');
    const telefonoNum = (fd.get('clienteTelefono') || '').trim();
    const payload = {
      clienteEmpresa: fd.get('clienteEmpresa'),
      clienteNombre: fd.get('clienteNombre'),
      clienteTelefono: `${paisCodigo} ${telefonoNum}`,
      clienteCorreo: fd.get('clienteCorreo'),
      fechaEntrega: fd.get('fechaEntrega'),
      fechaEvento: fd.get('fechaEvento'),
      urgente: form.querySelector('[name="urgente"]').checked,
      producto: fd.get('producto'),
      material: fd.get('material'),
      tecnica: fd.get('tecnica'),
      acabado: fd.get('acabado'),
      cantidad: fd.get('cantidad'),
      cotizacion: fd.get('cotizacion'),
      // Solo se manda cuando el vale original fue a 2+ talleres — si fue a
      // uno solo, el backend lo resuelve automáticamente sin necesidad de
      // elegir nada.
      ...(requiereEleccionTaller ? { talleresIds: JSON.stringify([...tallerSeleccionadosMod]) } : {}),
      justificacion: fd.get('justificacion')
    };
    const btn = overlay.querySelector('#btn-enviar');
    btn.disabled = true;
    try {
      await solicitarModificacion(vale.id, payload);
      window.toast.success('Modificación solicitada', `Modificación solicitada para ${vale.correlativo}.`);
      cerrar();
      cargarBuzon();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
    }
  });
}
