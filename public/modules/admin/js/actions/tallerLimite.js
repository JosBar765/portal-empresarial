// Límite diario opcional de vales de arte entrantes por fecha de ENTREGA
// (analisis_correcciones_28.md) — modal chico, independiente del de
// personal (tallerPersonal.js), porque no comparte nada con la asignación
// de encargado/técnicos.
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { actualizarLimiteDiarioTaller } from '../api/adminApi.js';
import { cargarTalleres } from '../views/talleres.js';

export function abrirModalLimiteTaller(taller) {
  const bodyHtml = `
    <p class="form-hint" style="margin-bottom:12px;">
      Cantidad máxima de vales de arte que este taller puede recibir por día de
      <strong>fecha de entrega</strong> (la fecha del evento no se limita). Déjalo en
      blanco para no limitar el taller — si se define, debe ser mayor o igual a 3.
    </p>
    <div class="form-grid">
      <div class="form-field">
        <label>Límite diario</label>
        <input type="number" id="input-limite-diario" min="3" step="1" placeholder="Sin límite"
          value="${taller.limite_diario != null ? taller.limite_diario : ''}" />
      </div>
    </div>
  `;
  const { overlay, cerrar } = abrirModal({
    title: `Límite diario — ${taller.nombre}`,
    bodyHtml,
    footerHtml: `<button class="btn btn--ghost" id="btn-cerrar-limite">Cancelar</button><button class="btn btn--primary" id="btn-guardar-limite">Guardar</button>`
  });

  overlay.querySelector('#btn-cerrar-limite').addEventListener('click', cerrar);
  overlay.querySelector('#btn-guardar-limite').addEventListener('click', async () => {
    const raw = overlay.querySelector('#input-limite-diario').value.trim();
    if (raw !== '' && Number(raw) < 3) {
      mostrarErrorModal(overlay, 'El límite diario debe ser mayor o igual a 3, o dejarse vacío para no limitar el taller.');
      return;
    }
    const btn = overlay.querySelector('#btn-guardar-limite');
    btn.disabled = true;
    try {
      await actualizarLimiteDiarioTaller(taller.id, raw === '' ? null : Number(raw));
      window.toast.success('Límite actualizado', `Se actualizó el límite diario de ${taller.nombre}.`);
      cerrar();
      cargarTalleres();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
    }
  });
}
