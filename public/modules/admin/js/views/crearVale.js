import { $ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { opcionesValePdf, listarValePdfGenerados, generarValePdf } from '../api/adminApi.js';

const MAX_IMAGENES = 10;
const MAX_DOCUMENTOS = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];

// Campos obligatorios: id del input -> etiqueta para el mensaje.
const REQUERIDOS = {
  'cv-correlativo': 'Correlativo', 'cv-fechaGeneracion': 'Fecha de generación', 'cv-asesorNombre': 'Nombre del asesor',
  'cv-clienteNombre': 'Nombre del cliente', 'cv-fechaIngreso': 'Fecha de ingreso', 'cv-horaIngreso': 'Hora de ingreso',
  'cv-fechaEntrega': 'Fecha de entrega', 'cv-cantidad': 'Cantidad', 'cv-cotizacion': 'Cotización'
};

let opciones = { supervisores: [], asesores: [] };
let archivos = { imagenes: [], documentos: [] };

// Hora de Guatemala (UTC-6, sin horario de verano) como valor de datetime-local.
function ahoraGuatemala() {
  const d = new Date(Date.now() - 6 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

// Solo https para href / window.open.
function urlSegura(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.href : null;
  } catch { return null; }
}

function formatearFecha(valor) {
  const d = new Date(valor);
  if (isNaN(d)) return String(valor || '');
  return d.toLocaleString('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'short', timeStyle: 'short' });
}

function formatearTamano(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } finally { ta.remove(); }
  }
  window.toast.success('Link copiado', 'Ya puedes pegarlo donde lo necesites.');
}

function abrirUrl(url) {
  const segura = urlSegura(url);
  if (!segura) { window.toast.error('Link no válido', 'El link no usa https.'); return; }
  window.open(segura, '_blank', 'noopener');
}

function campo(id, etiqueta, { tipo = 'text', requerido = false, extra = '', full = false } = {}) {
  return `<div class="form-field ${full ? 'full' : ''}" id="wrap-${id}">
    <label for="${id}">${etiqueta}${requerido ? ' *' : ''}</label>
    <input type="${tipo}" id="${id}" name="${id.replace('cv-', '')}" ${extra}>
  </div>`;
}

export async function cargarCrearVale() {
  const [ops, generados] = await Promise.all([opcionesValePdf(), listarValePdfGenerados()]);
  opciones = ops;
  archivos = { imagenes: [], documentos: [] };
  renderCrearVale();
  renderGenerados(generados);
}

function renderCrearVale() {
  const optAsesores = opciones.asesores.map((a, i) => `<option value="${i}">${escapeHtml(a.nombre)}</option>`).join('');
  const optSupervisores = opciones.supervisores.map(s => `<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join('');
  $('#panel-content').innerHTML = `
    <div class="panel-toolbar"><h2>Crear Vale de Arte</h2></div>
    <p class="form-hint">Genera el PDF de un vale con los datos que indiques y lo sube al almacenamiento. No crea ni modifica ningún vale.</p>
    <form id="form-crear-vale" class="crear-vale-form" novalidate>
      <div id="cv-error" class="form-error" style="display:none;"></div>

      <fieldset class="crear-vale-seccion"><legend>Cabecera</legend>
        <div class="form-grid">
          ${campo('cv-correlativo', 'Correlativo', { requerido: true, extra: 'maxlength="50"' })}
          ${campo('cv-fechaGeneracion', 'Fecha de generación', { tipo: 'datetime-local', requerido: true, extra: `value="${ahoraGuatemala()}"` })}
        </div>
      </fieldset>

      <fieldset class="crear-vale-seccion"><legend>Asesor</legend>
        <div class="form-grid">
          <div class="form-field full">
            <label for="cv-asesorSelect">Elegir asesor (rellena los datos)</label>
            <select id="cv-asesorSelect"><option value="">Escribir a mano</option>${optAsesores}</select>
          </div>
          ${campo('cv-asesorNombre', 'Nombre', { requerido: true })}
          ${campo('cv-asesorCorreo', 'Correo', { tipo: 'email' })}
          ${campo('cv-asesorTelefono', 'Teléfono')}
        </div>
      </fieldset>

      <fieldset class="crear-vale-seccion"><legend>Cliente</legend>
        <div class="form-grid">
          ${campo('cv-clienteEmpresa', 'Empresa')}
          ${campo('cv-clienteNombre', 'Nombre', { requerido: true })}
          ${campo('cv-clienteTelefono', 'Teléfono')}
          ${campo('cv-clienteCorreo', 'Correo', { tipo: 'email' })}
        </div>
      </fieldset>

      <fieldset class="crear-vale-seccion"><legend>Venta</legend>
        <div class="form-grid">
          ${campo('cv-fechaIngreso', 'Fecha de ingreso', { tipo: 'date', requerido: true })}
          ${campo('cv-horaIngreso', 'Hora de ingreso', { tipo: 'time', requerido: true })}
          ${campo('cv-fechaEntrega', 'Fecha de entrega', { tipo: 'date', requerido: true })}
          ${campo('cv-fechaEvento', 'Fecha del evento', { tipo: 'date' })}
          <div class="form-field">
            <label for="cv-urgente">Urgente</label>
            <select id="cv-urgente" name="urgente"><option value="0">No</option><option value="1">Sí</option></select>
          </div>
          ${campo('cv-producto', 'Producto')}
          ${campo('cv-material', 'Material')}
          ${campo('cv-tecnica', 'Técnica')}
          ${campo('cv-acabado', 'Acabado')}
          ${campo('cv-cantidad', 'Cantidad', { tipo: 'number', requerido: true, extra: 'min="0" step="1"' })}
          ${campo('cv-cotizacion', 'Cotización', { tipo: 'number', requerido: true, extra: 'min="0" step="any"' })}
          <div class="form-field full">
            <label for="cv-descripcion">Descripción</label>
            <textarea id="cv-descripcion" name="descripcion" maxlength="5000" rows="4"></textarea>
          </div>
        </div>
      </fieldset>

      <fieldset class="crear-vale-seccion"><legend>Autorización</legend>
        <div class="form-grid">
          <div class="form-field full">
            <label for="cv-supervisorId">Supervisor</label>
            <select id="cv-supervisorId" name="supervisorId"><option value="">Sin firma</option>${optSupervisores}</select>
          </div>
          <div class="form-field">
            <label for="cv-tipoAutorizacion">Tipo</label>
            <select id="cv-tipoAutorizacion" name="tipoAutorizacion" disabled>
              <option value="CREACION">Creación</option><option value="MODIFICACION">Modificación</option>
            </select>
          </div>
          ${campo('cv-fechaAutorizacion', 'Fecha y hora de autorización', { tipo: 'datetime-local', extra: 'disabled' })}
          <div class="form-checkbox full">
            <input type="checkbox" id="cv-modificado" name="modificado">
            <label for="cv-modificado">Marcar como MODIFICAR (pie del PDF)</label>
          </div>
        </div>
      </fieldset>

      <fieldset class="crear-vale-seccion"><legend>Archivos</legend>
        <div class="form-grid">
          <div class="form-field">
            <label for="cv-imagenes">Imágenes (máx. ${MAX_IMAGENES})</label>
            <input type="file" id="cv-imagenes" accept="image/jpeg,image/png,image/webp" multiple>
            <span class="form-hint">JPG, PNG o WEBP, hasta 5 MB c/u. Las WEBP se aceptan pero se dibujan como un recuadro vacío en el PDF.</span>
            <ul class="crear-vale-archivos" id="cv-lista-imagenes"></ul>
          </div>
          <div class="form-field">
            <label for="cv-documentos">PDF adjuntos (máx. ${MAX_DOCUMENTOS})</label>
            <input type="file" id="cv-documentos" accept="application/pdf" multiple>
            <span class="form-hint">Hasta 5 MB c/u. Se agregan al final del PDF.</span>
            <ul class="crear-vale-archivos" id="cv-lista-documentos"></ul>
          </div>
        </div>
      </fieldset>

      <div class="crear-vale-acciones">
        <button type="button" class="btn btn--ghost" id="cv-limpiar">Limpiar formulario</button>
        <button type="submit" class="btn btn--primary" id="cv-generar"><ion-icon name="document-text-outline"></ion-icon> Generar PDF</button>
      </div>
    </form>

    <div id="cv-resultado"></div>

    <div class="panel-toolbar crear-vale-generados"><h2>PDF generados</h2></div>
    <div id="cv-generados"></div>
  `;

  $('#cv-asesorSelect').addEventListener('change', (e) => {
    const a = opciones.asesores[e.target.value];
    if (!a) return;
    $('#cv-asesorNombre').value = a.nombre || '';
    $('#cv-asesorCorreo').value = a.email || '';
    $('#cv-asesorTelefono').value = a.telefono || '';
  });
  $('#cv-supervisorId').addEventListener('change', (e) => {
    const conFirma = !!e.target.value;
    $('#cv-tipoAutorizacion').disabled = !conFirma;
    const fecha = $('#cv-fechaAutorizacion');
    fecha.disabled = !conFirma;
    if (conFirma && !fecha.value) fecha.value = ahoraGuatemala();
  });
  wireArchivos('imagenes', 'cv-imagenes', 'cv-lista-imagenes', MAX_IMAGENES, TIPOS_IMAGEN, 'una imagen JPG, PNG o WEBP');
  wireArchivos('documentos', 'cv-documentos', 'cv-lista-documentos', MAX_DOCUMENTOS, ['application/pdf'], 'un PDF');
  $('#cv-limpiar').addEventListener('click', () => { archivos = { imagenes: [], documentos: [] }; renderCrearVale(); cargarGenerados(); });
  $('#form-crear-vale').addEventListener('submit', (e) => { e.preventDefault(); if (validar()) abrirModalPassword(); });
}

function wireArchivos(clave, inputId, listaId, max, tipos, descripcion) {
  const input = $(`#${inputId}`);
  const pintar = () => {
    $(`#${listaId}`).innerHTML = archivos[clave].map((f, i) => `
      <li><span>${escapeHtml(f.name)} <small>(${formatearTamano(f.size)})</small></span>
        <button type="button" class="btn-icon icon-danger" data-quitar="${i}" title="Quitar"><ion-icon name="close-outline"></ion-icon></button></li>`).join('');
  };
  input.addEventListener('change', () => {
    for (const f of input.files) {
      if (archivos[clave].length >= max) { window.toast.error('Límite alcanzado', `Máximo ${max} archivos.`); break; }
      if (!tipos.includes(f.type)) { window.toast.error('Archivo no válido', `"${f.name}" no es ${descripcion}.`); continue; }
      if (f.size > MAX_BYTES) { window.toast.error('Archivo muy grande', `"${f.name}" supera 5 MB.`); continue; }
      archivos[clave].push(f);
    }
    input.value = '';
    pintar();
  });
  $(`#${listaId}`).addEventListener('click', (e) => {
    const btn = e.target.closest('[data-quitar]');
    if (!btn) return;
    archivos[clave].splice(Number(btn.dataset.quitar), 1);
    pintar();
  });
}

function mostrarError(msg) {
  const box = $('#cv-error');
  box.textContent = msg || '';
  box.style.display = msg ? '' : 'none';
  if (msg) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function validar() {
  const faltan = [];
  document.querySelectorAll('#form-crear-vale .is-invalid').forEach(el => el.classList.remove('is-invalid'));
  for (const [id, etiqueta] of Object.entries(REQUERIDOS)) {
    if (!$(`#${id}`).value.trim()) { faltan.push(etiqueta); $(`#wrap-${id}`).classList.add('is-invalid'); }
  }
  if (faltan.length) { mostrarError(`Completa los campos obligatorios: ${faltan.join(', ')}.`); return false; }
  const cantidad = Number($('#cv-cantidad').value);
  if (!Number.isInteger(cantidad) || cantidad < 0) { mostrarError('La cantidad debe ser un número entero.'); $('#wrap-cv-cantidad').classList.add('is-invalid'); return false; }
  if (!(Number($('#cv-cotizacion').value) >= 0)) { mostrarError('La cotización debe ser un número mayor o igual a 0.'); $('#wrap-cv-cotizacion').classList.add('is-invalid'); return false; }
  if ($('#cv-supervisorId').value && !$('#cv-fechaAutorizacion').value) {
    mostrarError('Indica la fecha y hora de autorización.'); $('#wrap-cv-fechaAutorizacion').classList.add('is-invalid'); return false;
  }
  mostrarError('');
  return true;
}

function construirFormData(password) {
  const fd = new FormData();
  document.querySelectorAll('#form-crear-vale input[name], #form-crear-vale select[name], #form-crear-vale textarea[name]').forEach(el => {
    if (el.disabled || el.type === 'checkbox') return;
    const v = el.value.trim();
    if (v !== '') fd.append(el.name, v);
  });
  fd.append('modificado', $('#cv-modificado').checked ? '1' : '0');
  fd.append('password', password);
  archivos.imagenes.forEach(f => fd.append('imagenes', f));
  archivos.documentos.forEach(f => fd.append('documentos', f));
  return fd;
}

function abrirModalPassword() {
  const { overlay, cerrar } = abrirModal({
    title: 'Confirmar con tu contraseña',
    bodyHtml: `
      <p>Por seguridad, ingresa la contraseña de tu cuenta para generar el PDF.</p>
      <div class="form-field full" style="margin-top:12px;">
        <label for="cv-password">Contraseña</label>
        <input type="password" id="cv-password" autocomplete="current-password">
      </div>`,
    footerHtml: `<button class="btn btn--ghost" id="cv-pw-cancelar">Cancelar</button><button class="btn btn--primary" id="cv-pw-confirmar">Confirmar</button>`
  });
  const inputPw = overlay.querySelector('#cv-password');
  const btn = overlay.querySelector('#cv-pw-confirmar');
  inputPw.focus();
  const cerrarLimpio = () => { inputPw.value = ''; cerrar(); };
  overlay.querySelector('#cv-pw-cancelar').addEventListener('click', cerrarLimpio);
  const confirmar = async () => {
    if (!inputPw.value) { mostrarErrorModal(overlay, 'Debes ingresar tu contraseña.'); return; }
    btn.disabled = true;
    try {
      const resultado = await generarValePdf(construirFormData(inputPw.value));
      cerrarLimpio();
      mostrarResultado(resultado);
      cargarGenerados();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      inputPw.value = '';
      inputPw.focus();
      btn.disabled = false;
    }
  };
  btn.addEventListener('click', confirmar);
  inputPw.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); confirmar(); } });
}

function mostrarResultado({ correlativo, url }) {
  const cont = $('#cv-resultado');
  cont.innerHTML = `
    <div class="mantenimiento-banner normal crear-vale-resultado">
      <h3>PDF generado: ${escapeHtml(correlativo)}</h3>
      <input type="text" readonly id="cv-link" value="${escapeHtml(url)}">
      <div class="crear-vale-acciones">
        <button type="button" class="btn btn--ghost" id="cv-copiar"><ion-icon name="copy-outline"></ion-icon> Copiar link</button>
        <button type="button" class="btn btn--primary" id="cv-abrir"><ion-icon name="open-outline"></ion-icon> Abrir PDF</button>
      </div>
    </div>`;
  $('#cv-copiar').addEventListener('click', () => copiarTexto(url));
  $('#cv-abrir').addEventListener('click', () => abrirUrl(url));
  cont.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function cargarGenerados() {
  try { renderGenerados(await listarValePdfGenerados()); }
  catch (error) { $('#cv-generados').innerHTML = `<p class="form-hint">${escapeHtml(error.message)}</p>`; }
}

function renderGenerados(filas) {
  const cont = $('#cv-generados');
  if (!cont) return;
  if (!filas.length) {
    cont.innerHTML = `<div class="buzon-vacio"><ion-icon name="document-outline"></ion-icon><p>Aún no se ha generado ningún PDF.</p></div>`;
    return;
  }
  cont.innerHTML = `
    <div class="tabla-wrapper">
      <table class="data-table sticky-header">
        <thead><tr><th>Fecha</th><th>Usuario</th><th>Correlativo</th><th>Link</th></tr></thead>
        <tbody>${filas.map((f, i) => `
          <tr>
            <td data-label="Fecha">${escapeHtml(formatearFecha(f.creado_en))}</td>
            <td data-label="Usuario">${escapeHtml(f.usuario_nombre)}</td>
            <td data-label="Correlativo">${escapeHtml(f.correlativo)}</td>
            <td data-label="Link">
              <button class="btn-icon" data-copiar="${i}" title="Copiar link"><ion-icon name="copy-outline"></ion-icon></button>
              <button class="btn-icon" data-abrir="${i}" title="Abrir PDF"><ion-icon name="open-outline"></ion-icon></button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  cont.onclick = (e) => {
    const c = e.target.closest('[data-copiar]');
    const a = e.target.closest('[data-abrir]');
    if (c) copiarTexto(filas[c.dataset.copiar].url);
    else if (a) abrirUrl(filas[a.dataset.abrir].url);
  };
}
