import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { escapeHtml, formatearFecha } from '../utils/formato.js';
import { listarBorradores, obtenerBorrador, eliminarBorrador } from '../api/valesApi.js';
import { abrirModalBorrador } from './valeForm.js';
import { EVENTO_BORRADORES, avisarCambioBorradores } from '../utils/eventosBorradores.js';

const DIAS_ALERTA = 3;

export async function actualizarContadorBorradores() {
  try {
    const { total } = await listarBorradores();
    document.querySelector('#borradores-contador').textContent = total;
  } catch {
    // El contador es solo informativo: si no carga, se queda como estaba.
  }
}

export function iniciarBorradores() {
  document.addEventListener(EVENTO_BORRADORES, actualizarContadorBorradores);
  document.querySelector('#btn-borradores').addEventListener('click', abrirModalBorradores);
  actualizarContadorBorradores();
}

function textoVencimiento(dias) {
  if (dias <= 0) return 'Vence hoy';
  return `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

function htmlFila(b) {
  return `
    <li class="borrador-item" data-id="${b.id}">
      <div class="borrador-info">
        <strong class="borrador-titulo">${escapeHtml(b.titulo)}</strong>
        <span class="borrador-meta">
          Creado el ${formatearFecha(b.creadoEn)} ·
          <span class="borrador-vence${b.diasRestantes <= DIAS_ALERTA ? ' borrador-vence--alerta' : ''}">${textoVencimiento(b.diasRestantes)}</span>
        </span>
      </div>
      <div class="borrador-acciones">
        <button class="btn btn--primary btn--sm" data-accion="abrir">Abrir</button>
        <button class="btn btn--danger btn--sm" data-accion="eliminar">Eliminar</button>
      </div>
    </li>`;
}

export async function abrirModalBorradores() {
  const { overlay, cerrar } = abrirModal({
    title: 'Borradores',
    bodyHtml: '<div id="borradores-contenido"><p class="form-nota">Cargando…</p></div>',
    footerHtml: '<button class="btn btn--ghost" id="btn-cerrar-borradores">Cerrar</button>'
  });
  overlay.querySelector('#btn-cerrar-borradores').addEventListener('click', cerrar);
  const contenido = overlay.querySelector('#borradores-contenido');

  const pintar = async () => {
    let datos;
    try {
      datos = await listarBorradores();
    } catch (error) {
      contenido.innerHTML = '';
      mostrarErrorModal(overlay, error.message);
      return;
    }
    document.querySelector('#borradores-contador').textContent = datos.total;
    contenido.innerHTML = `
      <p class="form-nota">Tienes ${datos.total} de ${datos.maximo} borradores. Cada uno se elimina solo a los 30 días de crearse.</p>
      ${datos.borradores.length
        ? `<ul class="borrador-lista">${datos.borradores.map(htmlFila).join('')}</ul>`
        : '<p class="form-nota">No tienes borradores guardados.</p>'}
    `;
  };

  contenido.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-accion]');
    if (!btn) return;
    const id = Number(btn.closest('.borrador-item').dataset.id);
    if (btn.dataset.accion === 'eliminar') {
      abrirModalEliminarBorrador(id, pintar);
      return;
    }
    btn.disabled = true;
    try {
      const borrador = await obtenerBorrador(id);
      cerrar();
      abrirModalBorrador(borrador);
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
    }
  });

  pintar();
}

function abrirModalEliminarBorrador(id, alTerminar) {
  const { overlay, cerrar } = abrirModal({
    title: 'Eliminar borrador',
    bodyHtml: `
      <p style="font-size:14px;font-weight:600;margin-bottom:8px;">¿Estás seguro?</p>
      <p style="font-size:13px;">El borrador se eliminará permanentemente junto con sus archivos. Esta acción no se puede deshacer.</p>
    `,
    footerHtml: '<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--danger" id="btn-confirmar">Eliminar</button>'
  });
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelector('#btn-confirmar').addEventListener('click', async () => {
    const btn = overlay.querySelector('#btn-confirmar');
    btn.disabled = true;
    try {
      await eliminarBorrador(id);
      window.toast.success('Borrador eliminado', 'Se eliminó el borrador y sus archivos.');
      cerrar();
      avisarCambioBorradores();
      alTerminar();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
    }
  });
}
