// Hora máxima (Guatemala) hasta la que el taller recibe vales de arte con entrega el mismo día.
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { actualizarHoraMaximaTaller } from '../api/adminApi.js';
import { cargarTalleres } from '../views/talleres.js';

export function abrirModalHoraMaximaTaller(taller) {
  const bodyHtml = `
    <p class="form-hint" style="margin-bottom:12px;">
      Hora (formato de 24 horas) desde la cual este taller ya no recibe vales de arte para entregar
      el mismo día. Es obligatoria; por defecto es 12:00.
    </p>
    <div class="form-grid">
      <div class="form-field">
        <label for="input-hora-maxima">Hora máxima de recibimiento de vales de arte</label>
        <input type="time" id="input-hora-maxima" required value="${taller.hora_maxima_recepcion || '12:00'}" />
      </div>
    </div>
  `;
  const { overlay, cerrar } = abrirModal({
    title: `Hora máxima — ${taller.nombre}`,
    bodyHtml,
    footerHtml: `<button class="btn btn--ghost" id="btn-cerrar-hora">Cancelar</button><button class="btn btn--primary" id="btn-guardar-hora">Guardar</button>`
  });

  overlay.querySelector('#btn-cerrar-hora').addEventListener('click', cerrar);
  overlay.querySelector('#btn-guardar-hora').addEventListener('click', async () => {
    const hora = overlay.querySelector('#input-hora-maxima').value;
    if (!hora) {
      mostrarErrorModal(overlay, 'Indica la hora máxima de recibimiento (HH:MM).');
      return;
    }
    const btn = overlay.querySelector('#btn-guardar-hora');
    btn.disabled = true;
    try {
      await actualizarHoraMaximaTaller(taller.id, hora);
      window.toast.success('Hora máxima actualizada', `Se actualizó la hora máxima de ${taller.nombre}.`);
      cerrar();
      cargarTalleres();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
    }
  });
}
