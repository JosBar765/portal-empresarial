// Tiendas que atiende un taller de Diseño Local. La sede siempre queda incluida; quitar una tienda solo afecta a los vales nuevos.
import { escapeHtml } from '../utils/formato.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { crearMenuCascada, construirArbolTiendas } from '../components/menuCascada.js';
import { listarTiendas, listarTiendasDeLocal, agregarTiendaALocal, quitarTiendaDeLocal } from '../api/adminApi.js';
import { cargarTalleres } from '../views/talleres.js';

// Datos del modal y su cuerpo HTML; se recalculan tras cada cambio para repintar el modal en su sitio.
async function cargarCuerpo(taller) {
  const [{ tiendas: asignadas }, { tiendas: todas }] = await Promise.all([listarTiendasDeLocal(taller.id), listarTiendas()]);
  const idsAsignadas = new Set(asignadas.map(t => Number(t.id)));
  // Cualquier tienda activa de cualquier país, aunque ya use otro Local.
  const disponibles = todas.filter(t => t.activo && !idsAsignadas.has(Number(t.id)));
  const bodyHtml = `
    <p class="form-hint">Tiendas que pueden elegir este taller al crear un vale. Quitar una tienda solo afecta a los vales nuevos: los vales abiertos conservan sus talleres.</p>
    <p class="section-title">Tiendas que atiende (${asignadas.length})</p>
    <div class="personal-lista">
      ${asignadas.map(t => `
        <div class="personal-item" data-tienda-id="${Number(t.id)}">
          <div class="personal-item-info">
            <span>${escapeHtml(t.codigo)} - ${escapeHtml(t.nombre)}</span>
            <span class="rol">${escapeHtml(t.pais_nombre || 'Sin país')}${t.es_sede ? ' · Tienda sede (no se puede quitar)' : ''}</span>
          </div>
          ${t.es_sede ? '<ion-icon name="lock-closed-outline" title="Tienda sede"></ion-icon>' : ''}
        </div>
      `).join('')}
    </div>
    <p class="section-title">Agregar tienda</p>
    <div class="form-field full">
      <div id="input-tienda-local"></div>
      <span class="form-hint">${disponibles.length ? 'Aparecen las tiendas activas de todos los países que este taller aún no atiende.' : 'Todas las tiendas activas ya están asignadas a este taller.'}</span>
    </div>
  `;
  return { bodyHtml, disponibles };
}

export async function abrirModalTiendasLocal(taller) {
  let datos;
  try {
    datos = await cargarCuerpo(taller);
  } catch (error) {
    window.toast.error('No se pudo abrir las tiendas del taller', error.message);
    return;
  }
  const { overlay, cerrar } = abrirModal({
    title: `Tiendas — ${taller.nombre}`,
    bodyHtml: datos.bodyHtml,
    footerHtml: '<button class="btn btn--ghost" id="btn-cerrar-tiendas-local" type="button">Cerrar</button><button class="btn btn--primary" id="btn-agregar-tienda-local" type="button">Agregar</button>'
  });
  const cuerpo = overlay.querySelector('.modal-body');
  let tiendaId = null;

  const conectar = () => {
    tiendaId = null;
    const menu = crearMenuCascada({
      arbol: construirArbolTiendas(datos.disponibles),
      valorActual: null,
      etiquetaVacio: datos.disponibles.length ? 'Seleccionar tienda...' : 'No hay tiendas disponibles',
      ariaLabel: 'Tienda a agregar',
      mensajeVacio: 'No hay tiendas disponibles.',
      onSeleccionar: (valor) => { tiendaId = Number(valor); overlay.querySelectorAll('.form-error').forEach(e => e.remove()); }
    });
    overlay.querySelector('#input-tienda-local').appendChild(menu.elemento);
    overlay.querySelectorAll('.personal-item[data-tienda-id]').forEach(item => {
      if (item.querySelector('ion-icon[name="lock-closed-outline"]')) return;
      const btnQuitar = document.createElement('button');
      btnQuitar.className = 'btn-icon icon-danger';
      btnQuitar.title = 'Quitar';
      btnQuitar.innerHTML = '<ion-icon name="close-outline"></ion-icon>';
      btnQuitar.addEventListener('click', async () => {
        btnQuitar.disabled = true;
        try {
          await quitarTiendaDeLocal(taller.id, item.dataset.tiendaId);
          window.toast.success('Tiendas actualizadas', 'Se quitó la tienda del taller.');
          await refrescar();
        } catch (error) {
          mostrarErrorModal(overlay, error.message);
          btnQuitar.disabled = false;
        }
      });
      item.appendChild(btnQuitar);
    });
  };

  // Tras agregar o quitar: la tabla de fondo se actualiza y este modal se repinta con los datos nuevos.
  async function refrescar() {
    cargarTalleres();
    try {
      datos = await cargarCuerpo(taller);
    } catch (error) {
      window.toast.error('No se pudo actualizar la lista', error.message);
      return;
    }
    cuerpo.innerHTML = datos.bodyHtml;
    conectar();
  }
  conectar();

  overlay.querySelector('#btn-cerrar-tiendas-local').addEventListener('click', cerrar);
  overlay.querySelector('#btn-agregar-tienda-local').addEventListener('click', async () => {
    if (tiendaId == null) {
      mostrarErrorModal(overlay, 'Selecciona la tienda que quieres agregar a este taller.');
      return;
    }
    const btn = overlay.querySelector('#btn-agregar-tienda-local');
    btn.disabled = true;
    try {
      await agregarTiendaALocal(taller.id, tiendaId);
      window.toast.success('Tiendas actualizadas', 'Se agregó la tienda al taller.');
      await refrescar();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
    }
    btn.disabled = false;
  });
}
