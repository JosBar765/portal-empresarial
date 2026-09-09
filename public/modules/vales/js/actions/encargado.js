import { state } from '../state.js';
import { ROLES_ENCARGADO_TALLER } from '../config/roles.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { htmlDropzone, wireDropzone } from '../components/dropzone.js';
import { obtenerTecnicosAsignables, asignarTecnico, obtenerDetalleVale, revisarPropuesta, aprobarGeneral } from '../api/valesApi.js';
import { cargarBuzon } from '../views/buzon.js';

// Lista de técnicos asignables, con la opción "(yo mismo)" para un encargado
// — quien revisa una propuesta también puede reasignarse el trabajo a sí
// mismo.
export async function cargarTecnicosAsignables() {
  let tecnicos = [];
  try {
    tecnicos = await obtenerTecnicosAsignables();
  } catch { /* se muestra select vacío si falla */ }

  if (ROLES_ENCARGADO_TALLER.includes(state.user.rolId) && !tecnicos.some(t => t.id === state.user.id)) {
    tecnicos = [{ id: state.user.id, nombre: `${state.user.nombre} (yo mismo)` }, ...tecnicos];
  }
  return tecnicos;
}

// -----------------------------------------------------------------------
// Modal: Asignar a técnico
// -----------------------------------------------------------------------
export async function abrirModalAsignar(vale) {
  const tecnicos = await cargarTecnicosAsignables();

  const { overlay, cerrar } = abrirModal({
    title: `Asignar ${vale.correlativo}`,
    bodyHtml: `
      <div class="form-field">
        <label>Técnico a cargo</label>
        <select id="select-tecnico">
          ${tecnicos.length ? tecnicos.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('') : '<option value="">No hay técnicos bajo su mando</option>'}
        </select>
      </div>
    `,
    footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-confirmar">Asignar</button>`
  });

  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelector('#btn-confirmar').addEventListener('click', async () => {
    const tecnicoId = overlay.querySelector('#select-tecnico').value;
    if (!tecnicoId) return;
    const btn = overlay.querySelector('#btn-confirmar');
    btn.disabled = true;
    try {
      await asignarTecnico(vale.id, tecnicoId);
      const tecnico = tecnicos.find(t => t.id === Number(tecnicoId));
      window.toast.success('Vale asignado', `Se asignó correctamente al técnico ${tecnico ? tecnico.nombre : tecnicoId}.`);
      cerrar();
      cargarBuzon();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
    }
  });
}

// -----------------------------------------------------------------------
// Modal: Revisar propuesta (encargado de taller)
// -----------------------------------------------------------------------
export async function abrirModalRevisar(vale) {
  let detalle;
  try {
    detalle = await obtenerDetalleVale(vale.id);
  } catch {
    detalle = { propuestas: [] };
  }
  // En un vale multi-taller `detalle.propuestas` trae una fila por CADA
  // técnico (una por taller) — se filtra por el propio (`vale.tecnico_id`, ya
  // adjunto por el backend) para no mostrar la propuesta de cualquier taller.
  const propias = (detalle.propuestas || []).filter(p => p.tecnico_id === vale.tecnico_id);
  const ultima = propias[propias.length - 1];
  const tecnicos = await cargarTecnicosAsignables();

  // El backend rechaza aprobar sin un documento adjunto real — se refleja
  // acá deshabilitando el botón en vez de dejar que el usuario reciba el
  // error recién después de hacer clic.
  const puedeAprobar = !!(ultima && ultima.url);

  const { overlay, cerrar } = abrirModal({
    title: `Revisar propuesta — ${vale.correlativo}`,
    bodyHtml: `
      <p style="margin-bottom:14px;font-size:13px;">
        ${!ultima
          ? 'El técnico canceló el proceso — no hay propuesta que revisar.'
          : (ultima.url
              ? `<a href="${ultima.url}" target="_blank" class="btn btn--ghost" style="text-decoration:none;display:inline-flex;">Ver propuesta adjunta</a>`
              : 'El técnico no adjuntó documento de propuesta (no se puede aprobar en blanco).')}
      </p>
      <div class="form-field">
        <label>Reasignar a (solo si desaprueba)</label>
        <select id="select-tecnico-reasignar">
          ${tecnicos.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('')}
        </select>
      </div>
    `,
    footerHtml: `
      <button class="btn btn--danger" id="btn-desaprobar">Desaprobar y reasignar</button>
      <button class="btn btn--primary" id="btn-aprobar" ${puedeAprobar ? '' : 'disabled title="No hay una propuesta adjunta que aprobar"'}>Aprobar</button>
    `
  });

  overlay.querySelector('#btn-aprobar').addEventListener('click', () => enviarRevision(true));
  overlay.querySelector('#btn-desaprobar').addEventListener('click', () => enviarRevision(false));

  async function enviarRevision(aprobarValor) {
    const tecnicoReasignadoId = overlay.querySelector('#select-tecnico-reasignar').value;
    try {
      await revisarPropuesta(vale.id, { aprobar: aprobarValor, tecnicoReasignadoId: aprobarValor ? null : tecnicoReasignadoId });
      window.toast.success(aprobarValor ? 'Propuesta aprobada' : 'Vale reasignado', `${vale.correlativo} ${aprobarValor ? 'aprobado' : 'reasignado'} correctamente.`);
      cerrar();
      cargarBuzon();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
    }
  }
}

// -----------------------------------------------------------------------
// Quien tenga permiso de fusión (Encargado/Asistente de Diseño): aprobar y
// fusionar un vale multi-taller. La fusión NO la hace el sistema — el propio
// encargado revisa la propuesta de cada taller y adjunta manualmente su
// documento final ya fusionado antes de aprobar, sea un vale multi-taller o
// uno de modificación.
// -----------------------------------------------------------------------
export async function abrirModalAprobarGeneral(vale) {
  let detalle;
  try {
    detalle = await obtenerDetalleVale(vale.id);
  } catch {
    detalle = { talleres: [], propuestas: [] };
  }

  // Si este vale es una CORRECCIÓN (tiene vale_original_id), quien fusiona
  // necesita ver TODAS las propuestas originales — no solo las del/los
  // taller(es) al que se mandó la corrección — para poder fusionar
  // cómodamente. Se pide también el detalle del vale ORIGINAL y se arma la
  // lista a partir de SUS talleres, sobreescribiendo con la propuesta de la
  // corrección donde aplique (marcada con un "*" junto al nombre del taller).
  let detalleOriginal = null;
  if (vale.vale_original_id) {
    try {
      detalleOriginal = await obtenerDetalleVale(vale.vale_original_id);
    } catch {
      detalleOriginal = null;
    }
  }
  const urlDePropuesta = (det, tecnicoId) => {
    const propias = (det.propuestas || []).filter(p => p.tecnico_id === tecnicoId);
    const ultima = propias[propias.length - 1];
    return ultima ? ultima.url : null;
  };
  const filaPropuesta = (nombre, url, corregido) =>
    `<li><strong>${nombre}${corregido ? '*' : ''}:</strong> ${url ? `<a href="/${url}" target="_blank">Ver propuesta</a>` : 'Sin propuesta'}</li>`;

  let filasPropuesta;
  if (detalleOriginal) {
    const corregidosPorTaller = new Map((detalle.talleres || []).map(t => [t.taller_id, t]));
    filasPropuesta = (detalleOriginal.talleres || []).map(tOriginal => {
      const corregido = corregidosPorTaller.get(tOriginal.taller_id);
      const url = corregido ? urlDePropuesta(detalle, corregido.tecnico_id) : urlDePropuesta(detalleOriginal, tOriginal.tecnico_id);
      return filaPropuesta(tOriginal.taller_nombre, url, !!corregido);
    }).join('');
  } else {
    filasPropuesta = (detalle.talleres || []).map(t => filaPropuesta(t.taller_nombre, urlDePropuesta(detalle, t.tecnico_id), false)).join('');
  }

  const { overlay, cerrar } = abrirModal({
    title: `Aprobar y fusionar — ${vale.correlativo}`,
    bodyHtml: `
      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
        <a href="/api/vales/${vale.id}/pdf" target="_blank" class="btn btn--ghost" style="text-decoration:none;display:inline-flex;">Ver vale de arte (PDF)</a>
      </div>
      <p style="font-size:13px;margin-bottom:10px;">Revisa la propuesta de cada taller y adjunta el documento final ya fusionado por ti.</p>
      <ul class="historial-list" style="margin-bottom:14px;">${filasPropuesta || '<li>Este vale no tiene talleres asociados.</li>'}</ul>
      ${detalleOriginal ? '<p style="font-size:12px;color:var(--color-text-secondary);margin-top:-10px;margin-bottom:14px;">* Corregido en esta modificación.</p>' : ''}
      <div class="form-field">
        <label>Documento de fusión final *</label>
        ${htmlDropzone({ id: 'input-fusion', accept: 'application/pdf', hint: 'PDF' })}
      </div>
    `,
    footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-confirmar">Aprobar y Fusionar</button>`
  });
  const getFusion = wireDropzone(overlay, '#input-fusion', '.archivo-lista');
  // Una sola key por apertura del modal — si el envío falla y el usuario
  // reintenta con "Aprobar y Fusionar" de nuevo, se reenvía con la misma key
  // para que el backend detecte el reintento y no duplique la fusión.
  const idempotencyKey = crypto.randomUUID();
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelector('#btn-confirmar').addEventListener('click', async () => {
    const file = getFusion()[0];
    if (!file) {
      mostrarErrorModal(overlay, 'Debe adjuntar el documento de fusión final.');
      return;
    }
    const formData = new FormData();
    formData.append('fusion', file);
    formData.append('idempotencyKey', idempotencyKey);
    const btn = overlay.querySelector('#btn-confirmar');
    btn.disabled = true;
    try {
      await aprobarGeneral(vale.id, formData);
      window.toast.success('Vale fusionado', `${vale.correlativo} fusionado y aprobado correctamente.`);
      cerrar();
      cargarBuzon();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
    }
  });
}
