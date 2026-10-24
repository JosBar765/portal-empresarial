import { state } from '../state.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { htmlSelectorTalleres, wireSelectorTalleres, validarTalleresSeleccionados, talleresSeleccionablesAsesor } from '../components/selectorTalleres.js';
import { htmlCampoFecha, wireCampoFecha, validarCampoFecha } from '../components/datepicker.js';
import { htmlDropzone, wireDropzone, ARCHIVO_MAX_BYTES } from '../components/dropzone.js';
import { validarCamposNativos, wireLimpiezaValidacionInline, enfocarPrimerCampoInvalido } from '../components/validacion.js';
import { hoyMedianoche, sumarDiaLocal, parseIsoLocal } from '../utils/fechas.js';
import { escapeHtml, formatearFecha, siguienteCodigoMod } from '../utils/formato.js';
import { crearVale, corregirVale, solicitarModificacion, obtenerCapacidadEntrega, obtenerFechasEntrega, obtenerDetalleVale, guardarBorrador, actualizarBorrador } from '../api/valesApi.js';
import { avisarCambioBorradores } from '../utils/eventosBorradores.js';
import { cargarBuzon } from '../views/buzon.js';
import { limitarTelefono } from '/js/telefono.js';

const DESCRIPCION_MAX_CARACTERES = 600;
export function opcionesPaises() {
  return (state.catalogos.paises || []).map(p =>
    `<option value="${p.codigo_telefono}" ${p.codigo === 'GT' ? 'selected' : ''}>${p.codigo_telefono} ${p.codigo}</option>`
  ).join('');
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
  abrirModalFormularioVale(null);
}

// Asesor: corregir un vale propio que aún no fue autorizado (mismo formulario, precargado).
export function abrirModalCorregirVale(vale) {
  abrirModalFormularioVale(vale);
}

// Borrador guardado (detalle de GET /api/vales/borradores/:id): el mismo formulario, precargado.
export function abrirModalBorrador(borrador) {
  abrirModalFormularioVale(borrador, 'borrador');
}

const NOTA_ENTREGA_SIN_TALLER = 'Elige primero un taller para ver la fecha mínima de entrega.';
const NOMBRE_TIPO_MOD = { BASICA: 'básica', MEDIA: 'media', AVANZADA: 'avanzada' };

// Ayuda de la casilla «urgente»: en una modificación baja el plazo al siguiente día disponible.
const textoAyudaUrgente = (esMod, marcada) => {
  if (esMod) return marcada ? 'Entrega al siguiente día disponible.' : 'Márcalo para entregar al siguiente día disponible.';
  return marcada ? 'Puedes elegir una entrega con menos de 3 días; sigue aplicando la hora máxima de recibimiento.' : 'Márcalo si la entrega es en menos de 3 días.';
};

// `tipoModificacion` (BASICA / MEDIA / AVANZADA): al pedir una modificación con vale MOD; al corregir un MOD sale del propio vale.
// `alCancelar` permite volver al modal desde el que se abrió (p. ej. el selector de tipo de modificación).
function abrirModalFormularioVale(vale, modo = vale ? 'corregir' : 'crear', tipoModificacion = null, { alCancelar } = {}) {
  const esCorreccion = modo === 'corregir';
  const esModificacion = modo === 'modificar';
  const esBorrador = modo === 'borrador';
  const hayOriginal = !!vale && !esBorrador;
  // Un formulario de modificación: pedirla, o corregir un vale MOD (talleres fijos y justificación obligatoria).
  const esMod = esModificacion || (hayOriginal && Number(vale.vale_original_id) > 0);
  const tipoMod = esMod ? (esModificacion ? tipoModificacion : vale.modificacion_tipo) : null;
  // Una modificación va a los mismos talleres del vale original (los de su reparto, o los solicitados).
  const talleresOriginales = esModificacion
    ? [...new Set((vale._filasTaller || []).map(f => f.taller_id))]
    : [];
  const tallerSeleccionados = new Set(esModificacion
    ? (talleresOriginales.length ? talleresOriginales : String(vale.talleres_solicitados || '').split(',').map(Number).filter(Number.isFinite))
    : (esCorreccion ? String(vale.talleres_solicitados || '').split(',').map(Number).filter(Number.isFinite)
      : (esBorrador ? vale.talleres_ids.filter(id => talleresSeleccionablesAsesor().some(t => t.id === id)) : [])));
  const documentosQuitar = new Set();
  const nombresTalleres = [...tallerSeleccionados]
    .map(id => ((state.catalogos.talleres || []).find(t => t.id === id) || {}).nombre || `#${id}`);
  const titulos = { crear: 'Crear Vale de Arte', corregir: esMod ? 'Corregir modificación' : 'Corregir vale', modificar: 'Solicitar modificación', borrador: 'Borrador de Vale de Arte' };
  const { overlay, cerrar } = abrirModal({
    title: hayOriginal ? `${titulos[modo]} — ${vale.correlativo}` : titulos[modo],
    size: 'lg',
    bodyHtml: `
      <form id="form-crear-vale">
        ${esModificacion ? `<p class="mod-aviso"><ion-icon name="information-circle-outline" aria-hidden="true"></ion-icon><span>Modificación <strong>${NOMBRE_TIPO_MOD[tipoMod] || 'media'}</strong>: crea <strong>${escapeHtml(siguienteCodigoMod(vale))}</strong> y lo autoriza tu supervisor.</span></p>` : ''}
        <div class="section-title">Información de Cliente</div>
        <div class="form-grid">
          <div class="form-field"><label>Empresa</label><input type="text" name="clienteEmpresa" maxlength="100" /></div>
          <div class="form-field"><label>Cliente *</label><input type="text" name="clienteNombre" required maxlength="100" /></div>
          <div class="form-field">
            <label>Teléfono *</label>
            <div class="form-field-phone">
              <select name="clienteTelefonoPais">${opcionesPaises()}</select>
              <input type="text" name="clienteTelefono" required placeholder="0000-0000" />
            </div>
          </div>
          <div class="form-field"><label>Correo *</label><input type="email" name="clienteCorreo" required maxlength="100" /></div>
        </div>

        <div class="section-title">Información de Taller</div>
        <div class="form-grid">
          ${esMod
            ? `<div class="form-field full"><label>Talleres</label><div class="taller-tags">${nombresTalleres.map(n => `<span class="taller-tag">${escapeHtml(n)}</span>`).join('')}</div><p class="form-nota">Una modificación se envía a los mismos talleres del vale original.</p></div>`
            : htmlSelectorTalleres()}
        </div>

        <div class="section-title">Información de Venta</div>
        <div class="form-grid">
          ${htmlCampoFecha('Fecha de entrega', 'fechaEntrega')}
          ${htmlCampoFecha('Fecha del evento', 'fechaEvento')}
          <div class="form-field full">
            <label class="urgente-opcion" for="vale-urgente">
              <input type="checkbox" name="urgente" id="vale-urgente" />
              <span class="urgente-opcion-texto"><strong>Pedido urgente</strong><small id="urgente-ayuda">${textoAyudaUrgente(esMod, false)}</small></span>
            </label>
          </div>
          <div class="form-field"><label>Código de producto *</label><input type="text" name="producto" required maxlength="40" placeholder="Ej. Trofeo" /></div>
          <div class="form-field"><label>Material *</label><input type="text" name="material" required maxlength="40" placeholder="Ej. Acrílico" /></div>
          <div class="form-field"><label>Técnica</label><input type="text" name="tecnica" maxlength="40" /></div>
          <div class="form-field"><label>Acabado</label><input type="text" name="acabado" maxlength="40" /></div>
          <div class="form-field"><label>Cantidad *</label><input type="number" name="cantidad" min="1" step="1" required /></div>
          <div class="form-field"><label>Cotización (Q) *</label><input type="number" name="cotizacion" min="0.01" step="0.01" required /></div>        </div>

        <div class="section-title">Boceto y Descripción</div>
        <div class="form-grid">
          <div class="form-field full">
            <label>${esMod ? 'Justificación de la modificación *' : 'Descripción'} <span class="campo-contador" id="descripcion-contador">0/${DESCRIPCION_MAX_CARACTERES}</span></label>
            <textarea name="descripcion" maxlength="${DESCRIPCION_MAX_CARACTERES}"${esMod ? ' required' : ''}></textarea>
            <span class="field-error" id="descripcion-alerta-limite"><ion-icon name="alert-circle-outline"></ion-icon><span>Alcanzaste el límite de ${DESCRIPCION_MAX_CARACTERES} caracteres.</span></span>
          </div>
          <p class="form-nota full" style="margin:0;">Obligatorio: adjunta al menos una imagen o un documento PDF.</p>
          <div class="form-field">
            <label>Imágenes</label>
            <div class="archivos-actuales" data-tipo="imagen"></div>
            ${htmlDropzone({ name: 'imagenes', accept: 'image/jpeg,image/png,image/webp', multiple: true, hint: 'JPG, PNG o WEBP · máx. 5MB c/u' })}
          </div>
          <div class="form-field">
            <label>Documentos adjuntos</label>
            <div class="archivos-actuales" data-tipo="documento"></div>
            ${htmlDropzone({ name: 'documentos', accept: 'application/pdf', multiple: true, hint: 'PDF · máx. 5MB c/u' })}
          </div>
          <span class="field-error full" id="adjuntos-error" style="display:none;"><ion-icon name="alert-circle-outline"></ion-icon><span>Adjunta al menos una imagen o un documento PDF.</span></span>
        </div>
      </form>
    `,
    footerHtml: `
      <button class="btn btn--ghost" id="btn-cancelar-crear">Cancelar</button>
      ${modo === 'crear' || esBorrador ? `<button class="btn btn--ghost" id="btn-guardar-borrador">${esBorrador ? 'Guardar borrador' : 'Guardar como borrador'}</button>` : ''}
      <button class="btn btn--primary" id="btn-guardar-crear">${{ crear: 'Crear Vale de Arte', corregir: 'Guardar cambios', modificar: 'Solicitar modificación', borrador: 'Crear Vale de Arte' }[modo]}</button>
    `
  });

  if (!esMod) wireSelectorTalleres(overlay, tallerSeleccionados);
  const campoEntrega = overlay.querySelector('[data-date-field="fechaEntrega"]').closest('.form-field');
  campoEntrega.insertAdjacentHTML('beforeend', `<p class="form-nota" id="nota-entrega">${NOTA_ENTREGA_SIN_TALLER}</p>`);
  const notaEntrega = campoEntrega.querySelector('#nota-entrega');
  // Las reglas de la fecha de entrega (mínima, feriados, días sin recepción, hora máxima) las calcula el servidor.
  let consultaFechas = 0;
  const casillaUrgente = overlay.querySelector('[name="urgente"]');
  let mesVisible = null;
  const cargarFechasEntrega = async (anio, mes, reemplazar = false) => {
    mesVisible = { anio, mes };
    const talleresIds = [...tallerSeleccionados];
    const consulta = ++consultaFechas;
    if (talleresIds.length === 0) {
      apiFechaEntrega.setRestricciones(null, new Map(), true);
      notaEntrega.textContent = NOTA_ENTREGA_SIN_TALLER;
      return;
    }
    const mm = String(mes).padStart(2, '0');
    try {
      const data = await obtenerFechasEntrega(talleresIds, `${anio}-${mm}-01`, `${anio}-${mm}-${String(new Date(anio, mes, 0).getDate()).padStart(2, '0')}`, !!casillaUrgente && casillaUrgente.checked, tipoMod);
      if (consulta !== consultaFechas) return;
      apiFechaEntrega.setRestricciones(data.minima ? parseIsoLocal(data.minima) : null, new Map(data.noDisponibles.map(x => [x.fecha, x])), reemplazar);
      notaEntrega.textContent = data.minima
        ? `Mínimo ${data.minima.slice(8, 10)}/${data.minima.slice(5, 7)} · se recibe hasta las ${data.horaMaxima}`
        : 'No hay días para recibir vales. Avisa al administrador.';
    } catch {
      if (consulta === consultaFechas) notaEntrega.textContent = 'No se cargaron las fechas; se validarán al guardar.';
    }
  };
  const apiFechaEntrega = wireCampoFecha(overlay, 'fechaEntrega', {
    alCambiarMes: (anio, mes) => cargarFechasEntrega(anio, mes),
    capacidad: {
      obtenerTalleresIds: () => [...tallerSeleccionados],
      cargarMes: obtenerCapacidadEntrega
    }
  });
  // Marcar o desmarcar «Urgente» cambia la fecha mínima: se recargan las reglas y se borra la fecha si ya no vale.
  const ayudaUrgente = overlay.querySelector('#urgente-ayuda');
  if (casillaUrgente) casillaUrgente.addEventListener('change', () => {
    ayudaUrgente.textContent = textoAyudaUrgente(esMod, casillaUrgente.checked);
    const { anio, mes } = mesVisible || { anio: new Date().getFullYear(), mes: new Date().getMonth() + 1 };
    cargarFechasEntrega(anio, mes, true);
  });
  const mesInicial = vale && vale.fecha_entrega ? parseIsoLocal(String(vale.fecha_entrega).slice(0, 10)) : new Date();
  cargarFechasEntrega(mesInicial.getFullYear(), mesInicial.getMonth() + 1, true);
  const apiFechaEvento = wireCampoFecha(overlay, 'fechaEvento', { minDate: sumarDiaLocal(hoyMedianoche(), 1) });
  overlay.querySelector('[name="fechaEntrega"]').addEventListener('change', () => {
    apiFechaEvento.setMinDate(sumarDiaLocal(apiFechaEntrega.getDate() || hoyMedianoche(), 1));
  });
  // Al crear, la entrega espera a que haya al menos un taller (si se quitan todos, se borra).
  if (modo === 'crear' || esBorrador) {
    const sincronizarEntrega = () => {
      apiFechaEntrega.setEnabled(tallerSeleccionados.size > 0, 'Elige primero un taller');
      const hoy = new Date();
      cargarFechasEntrega(hoy.getFullYear(), hoy.getMonth() + 1, true);
    };
    overlay.querySelector('.select-agregar-taller').addEventListener('change', sincronizarEntrega);
    overlay.querySelector('.taller-tags').addEventListener('click', sincronizarEntrega);
    sincronizarEntrega();
  }
  wireContadorCampo(overlay, 'descripcion', DESCRIPCION_MAX_CARACTERES);
  limitarTelefono(overlay.querySelector('[name="clienteTelefono"]'));
  const getImagenes = wireDropzone(overlay, '[name="imagenes"]', '.form-field:has([name="imagenes"]) .archivo-lista', { maxBytes: ARCHIVO_MAX_BYTES });
  const getDocumentos = wireDropzone(overlay, '[name="documentos"]', '.form-field:has([name="documentos"]) .archivo-lista', { maxBytes: ARCHIVO_MAX_BYTES });

  const formCrear = overlay.querySelector('#form-crear-vale');
  if (vale) precargarFormulario(overlay, formCrear, vale, { apiFechaEntrega, apiFechaEvento }, { conDescripcion: !esModificacion, conUrgente: !esModificacion });
  if (esCorreccion && vale.estado === 'RECHAZADO') {
    const aviso = document.createElement('div');
    aviso.className = 'form-aviso';
    aviso.innerHTML = `<ion-icon name="alert-circle-outline"></ion-icon><span>Vale rechazado. Motivo: ${escapeHtml((vale.rechazo_motivo || 'sin motivo registrado').replace(/[.\s]+$/, ''))}. Guarda tus cambios y luego usa "Reenviar a autorización".</span>`;
    overlay.querySelector('.modal-body').prepend(aviso);
  }
  wireLimpiezaValidacionInline(formCrear);
  const actuales = { documentos: [] };
  if (hayOriginal) cargarArchivosActuales(overlay, async () => (await obtenerDetalleVale(vale.id)).documentos || [], documentosQuitar, actuales);
  if (esBorrador) cargarArchivosActuales(overlay, async () => vale.documentos, documentosQuitar, actuales);
  const errorAdjuntos = overlay.querySelector('#adjuntos-error');
  overlay.addEventListener('change', (e) => { if (e.target.type === 'file') errorAdjuntos.style.display = 'none'; });
  // Al menos un archivo: los nuevos más los que el vale ya tiene y no se quitan (la propuesta original de un MOD- no cuenta).
  const hayAdjuntos = () => getImagenes().length + getDocumentos().length
    + actuales.documentos.filter(d => !documentosQuitar.has(d.id) && !esPropuestaOriginal(d)).length > 0;

  // Mismos campos y archivos para el vale y para el borrador.
  const armarFormData = () => {
    const formData = new FormData(formCrear);
    const paisCodigo = formCrear.querySelector('[name="clienteTelefonoPais"]').value;
    const telefonoNum = formCrear.querySelector('[name="clienteTelefono"]').value.trim();
    formData.set('clienteTelefono', `${paisCodigo} ${telefonoNum}`);
    formData.delete('clienteTelefonoPais');
    formData.set('talleresIds', JSON.stringify([...tallerSeleccionados]));
    // Las imágenes/documentos reales viven en los arrays de wireDropzone (el
    // usuario pudo quitar alguno con la "×"), no en el input nativo.
    formData.delete('imagenes');
    formData.delete('documentos');
    getImagenes().forEach(f => formData.append('imagenes', f));
    getDocumentos().forEach(f => formData.append('documentos', f));
    return formData;
  };

  overlay.querySelector('#btn-cancelar-crear').addEventListener('click', () => { cerrar(); if (alCancelar) alCancelar(); });
  const btnBorrador = overlay.querySelector('#btn-guardar-borrador');
  if (btnBorrador) btnBorrador.addEventListener('click', async () => {
    // Un borrador no se valida: se guarda lo que haya escrito.
    const formData = armarFormData();
    if (!formCrear.querySelector('[name="clienteTelefono"]').value.trim()) formData.set('clienteTelefono', '');
    btnBorrador.disabled = true;
    btnBorrador.classList.add('btn--loading');
    try {
      if (esBorrador) {
        formData.set('documentosQuitar', JSON.stringify([...documentosQuitar]));
        await actualizarBorrador(vale.id, formData);
      } else {
        await guardarBorrador(formData);
      }
      window.toast.success('Borrador guardado', 'Puedes terminarlo después desde «Borradores».');
      cerrar();
      avisarCambioBorradores();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btnBorrador.disabled = false;
      btnBorrador.classList.remove('btn--loading');
    }
  });
  overlay.querySelector('#btn-guardar-crear').addEventListener('click', () => {
    const form = formCrear;
    // validarCamposNativos limpia el estado de TODOS los campos nativos del
    // formulario antes de revisarlos (incluido el <select> de agregar taller,
    // que no tiene `required`) — por eso corre primero, y los validadores
    // manuales (que no son constraint-validation nativa) van después, para
    // que no les borre el error recién marcado.
    const camposOk = validarCamposNativos(form);
    const tallerOk = esMod || validarTalleresSeleccionados(overlay, tallerSeleccionados);
    const entregaOk = validarCampoFecha(overlay, 'fechaEntrega');
    const eventoOk = validarCampoFecha(overlay, 'fechaEvento');
    const adjuntosOk = hayAdjuntos();
    errorAdjuntos.style.display = adjuntosOk ? 'none' : '';
    if (!tallerOk || !entregaOk || !eventoOk || !camposOk) {
      enfocarPrimerCampoInvalido(overlay);
      return;
    }
    if (!adjuntosOk) {
      errorAdjuntos.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const formData = armarFormData();
    // Una sola key por intento de creación — si el envío falla (ej. corte de
    // red) y el usuario reintenta desde el mismo modal de confirmación, se
    // reenvía el mismo FormData con la misma key, para que el backend pueda
    // detectar el reintento y no duplicar el vale.
    formData.set('idempotencyKey', crypto.randomUUID());
    if (esModificacion) formData.set('tipo', tipoMod);

    if (hayOriginal) {
      formData.set('documentosQuitar', JSON.stringify([...documentosQuitar]));
      guardarCambios(overlay, vale, formData, modo);
      return;
    }
    // Un borrador se envía con el mismo flujo; el servidor suma los archivos que conserva a los nuevos.
    if (esBorrador) {
      formData.set('borradorId', vale.id);
      formData.set('documentosQuitar', JSON.stringify([...documentosQuitar]));
    }
    // Antes de crear el vale de verdad, se confirma con un modal resumen (el
    // modal de creación queda debajo, intacto, por si se cancela).
    abrirModalConfirmarCreacion(formData);
  });
}

async function guardarCambios(overlay, vale, formData, modo) {
  const btn = overlay.querySelector('#btn-guardar-crear');
  btn.disabled = true;
  btn.classList.add('btn--loading');
  try {
    if (modo === 'modificar') {
      await solicitarModificacion(vale.id, formData);
      window.toast.success('Modificación solicitada', 'Tu supervisor la revisará.');
    } else {
      await corregirVale(vale.id, formData);
      window.toast.success('Vale corregido', `${vale.correlativo} se actualizó.`);
    }
    document.querySelectorAll('.modal-overlay').forEach(o => o.remove());
    cargarBuzon();
  } catch (error) {
    mostrarErrorModal(overlay, error.message);
    btn.disabled = false;
    btn.classList.remove('btn--loading');
    cargarBuzon();
  }
}

function precargarFormulario(overlay, form, vale, { apiFechaEntrega, apiFechaEvento }, { conDescripcion, conUrgente }) {
  const campos = ['clienteEmpresa', 'clienteNombre', 'clienteCorreo', 'producto', 'material', 'tecnica', 'acabado', 'cantidad', 'cotizacion'];
  if (conDescripcion) campos.push('descripcion');
  for (const campo of campos) {
    const nombreColumna = campo.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
    form.querySelector(`[name="${campo}"]`).value = vale[nombreColumna] ?? '';
  }
  const [pais, ...numero] = (vale.cliente_telefono || '').split(' ');
  if (pais) form.querySelector('[name="clienteTelefonoPais"]').value = pais;
  form.querySelector('[name="clienteTelefono"]').value = numero.join(' ');
  const casilla = form.querySelector('[name="urgente"]'); // al pedir una modificación no se hereda el «urgente» del original
  if (casilla && conUrgente) {
    casilla.checked = Number(vale.urgente) === 1;
    casilla.dispatchEvent(new Event('change', { bubbles: true }));
  }
  // La entrega se precarga y, cuando llegan las reglas del servidor, se limpia si ya no está disponible (un borrador puede no tener fechas).
  if (vale.fecha_entrega) {
    const entrega = parseIsoLocal(String(vale.fecha_entrega).slice(0, 10));
    if (apiFechaEntrega.esValida(entrega)) apiFechaEntrega.setDate(entrega, { silent: true });
  }
  apiFechaEvento.setMinDate(sumarDiaLocal(apiFechaEntrega.getDate() || hoyMedianoche(), 1));
  if (vale.fecha_evento) apiFechaEvento.setDate(parseIsoLocal(String(vale.fecha_evento).slice(0, 10)), { silent: true });
  form.querySelector('[name="descripcion"]').dispatchEvent(new Event('input'));
  form.querySelector('[name="fechaEntrega"]').dispatchEvent(new Event('change', { bubbles: true }));
}

const esPropuestaOriginal = d => String(d.nombre_original || '').startsWith('Propuesta original - ');

// Archivos ya guardados del vale: se muestran con su enlace y una "×" para quitarlos al guardar.
async function cargarArchivosActuales(overlay, cargarDocumentos, documentosQuitar, actuales) {
  let documentos;
  try {
    documentos = await cargarDocumentos();
    actuales.documentos = documentos;
  } catch (error) {
    mostrarErrorModal(overlay, error.message);
    return;
  }
  const render = () => {
    overlay.querySelectorAll('.archivos-actuales').forEach(cont => {
      const tipo = cont.dataset.tipo;
      cont.innerHTML = documentos.filter(d => d.tipo === tipo && !documentosQuitar.has(d.id)).map(d => `
        <span class="archivo-chip">
          <${d.ruta ? 'a' : 'span'} class="archivo-chip-ver" ${d.ruta ? `href="${escapeHtml(d.ruta)}" target="_blank" rel="noopener" title="Ver archivo"` : 'title="Archivo eliminado"'}>
            ${tipo === 'imagen' && d.ruta
              ? `<img class="archivo-chip-miniatura" src="${escapeHtml(d.ruta)}" alt="">`
              : '<ion-icon name="document-text-outline" class="archivo-chip-icon"></ion-icon>'}
            <span class="archivo-chip-nombre">${escapeHtml(d.nombre_original)}${d.ruta ? '' : ' (archivo eliminado)'}</span>
          </${d.ruta ? 'a' : 'span'}>
          ${esPropuestaOriginal(d)
            ? '<small class="form-nota" style="margin:0 0 0 6px;">Propuesta del vale original: no se puede quitar</small>'
            : `<button type="button" class="archivo-chip-quitar" data-id="${d.id}" title="Quitar">&times;</button>`}
        </span>
      `).join('');
    });
  };
  overlay.querySelectorAll('.archivos-actuales').forEach(cont => cont.addEventListener('click', (e) => {
    const btn = e.target.closest('.archivo-chip-quitar');
    if (!btn) return;
    documentosQuitar.add(Number(btn.dataset.id));
    render();
  }));
  render();
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
        <li><strong>Cliente:</strong> ${escapeHtml(formData.get('clienteNombre'))}</li>
        <li><strong>Teléfono cliente:</strong> ${escapeHtml(formData.get('clienteTelefono'))}</li>
        <li><strong>Correo cliente:</strong> ${escapeHtml(formData.get('clienteCorreo'))}</li>
        <li><strong>Talleres:</strong> ${escapeHtml(nombresTalleres)}</li>
        <li><strong>Fecha de entrega:</strong> ${formatearFecha(formData.get('fechaEntrega'))}</li>
        <li><strong>Urgente:</strong> ${formData.get('urgente') ? 'Sí' : 'No'}</li>
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
      if (formData.get('borradorId')) avisarCambioBorradores();
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
// Asesor: solicitar una modificación básica, media o avanzada de un vale (mismo formulario, precargado; los talleres
// quedan fijos y la justificación es la descripción del nuevo vale MOD)
// -----------------------------------------------------------------------
export function abrirModalSolicitarModificacion(vale, tipo, opciones) {
  abrirModalFormularioVale(vale, 'modificar', tipo, opciones);
}
