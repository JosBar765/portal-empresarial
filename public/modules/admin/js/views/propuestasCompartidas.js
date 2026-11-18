import { $ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { listarGruposPropuestasCompartidas, actualizarComparteDePropuestas } from '../api/adminApi.js';

// Qué talleres comparten propuestas: solo comparten los que tienen el interruptor activo y son del mismo grupo
// (los generales entre sí; los Diseño Local del mismo país). La regla de grupo la aplica el servidor.
let grupos = [];
// id de taller -> valor guardado en el servidor; sirve para detectar y enviar solo lo que cambió.
const guardado = new Map();

export async function cargarPropuestasCompartidas() {
  ({ grupos } = await listarGruposPropuestasCompartidas());
  guardado.clear();
  grupos.forEach(g => g.talleres.forEach(t => guardado.set(t.id, t.comparte)));
  renderPropuestasCompartidas();
}

function renderPropuestasCompartidas() {
  $('#panel-content').innerHTML = `
    <div class="panel-toolbar">
      <h2>Propuestas compartidas</h2>
      <div class="panel-toolbar-acciones">
        <button class="btn btn--primary" id="btn-guardar-comparte" disabled><ion-icon name="save-outline"></ion-icon> Guardar cambios</button>
      </div>
    </div>
    <p class="form-hint">Cuando un vale va a varios talleres, los que tienen el interruptor activo ven la propuesta aprobada de los demás. Solo comparten los talleres generales entre sí y los talleres Diseño Local del mismo país; nunca un taller general con uno Local ni Locales de países distintos.</p>
    <div id="comparte-error" class="form-error" role="alert" style="display:none;"></div>
    ${grupos.map((g, i) => `
      <section class="horario-seccion" aria-labelledby="comparte-grupo-${i}">
        <div class="panel-toolbar"><h3 id="comparte-grupo-${i}">${escapeHtml(g.etiqueta)}</h3></div>
        <div class="tabla-wrapper">
          <table class="data-table">
            <thead><tr><th>Taller</th><th>Estado</th><th>Comparte propuestas</th></tr></thead>
            <tbody>${g.talleres.map(t => `
              <tr class="${t.activo ? '' : 'fila-inactiva'}">
                <td data-label="Taller">${escapeHtml(t.nombre)}</td>
                <td data-label="Estado"><span class="badge ${t.activo ? 'badge-activo' : 'badge-inactivo'}">${t.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td data-label="Comparte propuestas">
                  <div class="form-checkbox">
                    <input type="checkbox" id="comparte-${Number(t.id)}" data-taller-id="${Number(t.id)}" ${t.comparte ? 'checked' : ''}>
                    <label for="comparte-${Number(t.id)}">${t.comparte ? 'Sí' : 'No'}</label>
                  </div>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `).join('')}
  `;
  const btnGuardar = $('#btn-guardar-comparte');
  const cambios = () => [...document.querySelectorAll('input[data-taller-id]')]
    .map(i => ({ id: Number(i.dataset.tallerId), comparte: i.checked }))
    .filter(c => guardado.get(c.id) !== c.comparte);
  document.querySelectorAll('input[data-taller-id]').forEach(input => {
    input.addEventListener('change', () => {
      input.nextElementSibling.textContent = input.checked ? 'Sí' : 'No';
      btnGuardar.disabled = cambios().length === 0;
    });
  });
  btnGuardar.addEventListener('click', async () => {
    const pendientes = cambios();
    if (!pendientes.length) return;
    const error = $('#comparte-error');
    error.style.display = 'none';
    btnGuardar.disabled = true;
    let guardados = 0;
    try {
      for (const c of pendientes) {
        await actualizarComparteDePropuestas(c.id, c.comparte);
        guardado.set(c.id, c.comparte);
        guardados++;
      }
      window.toast.success('Propuestas compartidas actualizadas', `Se guardaron ${guardados} cambio${guardados === 1 ? '' : 's'}.`);
    } catch (e) {
      error.textContent = `${e.message} Se guardaron ${guardados} de ${pendientes.length} cambios; revisa el resto y vuelve a guardar.`;
      error.style.display = '';
      btnGuardar.disabled = cambios().length === 0;
    }
  });
}
