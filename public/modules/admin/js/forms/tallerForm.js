import { escapeHtml } from '../utils/formato.js';
import { ROL_ENCARGADO_DISENO_LOCAL } from '../config/roles.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { crearTaller, listarTiendas, listarTalleres, listarUsuariosRaw } from '../api/adminApi.js';
import { cargarTalleres } from '../views/talleres.js';

// -----------------------------------------------------------------------
// "Nuevo taller": desde el panel solo se crean talleres de Diseño Local.
//  - Cada uno pertenece a UNA sola tienda (la que se elige aquí), y su nombre
//    se deriva del código de esa tienda — no se escribe a mano.
//  - Una tienda tiene un solo taller de Diseño Local, así que solo se ofrecen
//    las tiendas activas que todavía no tienen el suyo.
//  - El encargado es opcional y solo puede ser un usuario con rol Diseño Local
//    que no sea ya encargado de otro taller (mismo criterio que el asesor con
//    su tienda). La validación real vive en el backend; esto solo evita
//    ofrecer opciones que serían rechazadas.
// -----------------------------------------------------------------------
export async function abrirModalNuevoTaller() {
  let tiendas;
  let talleres;
  let usuariosRaw;
  try {
    const [datosTiendas, datosTalleres, usuarios] = await Promise.all([listarTiendas(), listarTalleres(), listarUsuariosRaw()]);
    tiendas = datosTiendas.tiendas;
    talleres = datosTalleres.talleres;
    usuariosRaw = usuarios;
    if (!tiendas || !talleres || !usuariosRaw.res.ok) throw new Error('No se pudieron cargar los datos necesarios.');
  } catch (error) {
    window.toast.error('No se pudo abrir el formulario', error.message);
    return;
  }

  const tiendasConLocal = new Set(talleres.filter(t => t.tienda_id != null).map(t => Number(t.tienda_id)));
  const tiendasDisponibles = tiendas.filter(t => t.activo && !tiendasConLocal.has(Number(t.id)));
  const encargadosDisponibles = usuariosRaw.data.usuarios.filter(u => u.activo && Number(u.rol_id) === ROL_ENCARGADO_DISENO_LOCAL && !u.taller_id);

  const bodyHtml = `
    <div class="form-grid">
      <div class="form-field full">
        <span class="campo-titulo">Tipo de taller</span>
        <div class="campo-fijo"><ion-icon name="color-palette-outline"></ion-icon><strong>Diseño Local</strong></div>
        <span class="form-hint">Desde aquí solo se crean talleres de Diseño Local. Cada uno pertenece a una sola tienda.</span>
      </div>
      <div class="form-field full">
        <label for="input-taller-tienda">Tienda *</label>
        <select id="input-taller-tienda" ${tiendasDisponibles.length ? '' : 'disabled'}>
          <option value="">${tiendasDisponibles.length ? 'Seleccionar tienda...' : 'No hay tiendas disponibles'}</option>
          ${tiendasDisponibles.map(t => `<option value="${Number(t.id)}">${escapeHtml(t.nombre)} (${escapeHtml(t.codigo)})</option>`).join('')}
        </select>
        <span class="form-hint">${tiendasDisponibles.length
          ? 'Solo aparecen las tiendas activas que todavía no tienen su taller de Diseño Local.'
          : 'Todas las tiendas activas ya tienen su taller de Diseño Local.'}</span>
      </div>
      <div class="form-field full">
        <label for="input-taller-encargado">Encargado</label>
        <select id="input-taller-encargado">
          <option value="">Sin encargado por ahora</option>
          ${encargadosDisponibles.map(u => `<option value="${Number(u.id)}">${escapeHtml(u.nombre)}</option>`).join('')}
        </select>
        <span class="form-hint">${encargadosDisponibles.length
          ? 'Solo aparecen usuarios con rol Diseño Local que todavía no son encargados de otro taller.'
          : 'No hay usuarios con rol Diseño Local disponibles. Puedes crear el taller y asignar un encargado después.'}</span>
      </div>
      <p class="taller-vista-previa full" id="taller-vista-previa" aria-live="polite"></p>
    </div>
  `;
  const { overlay, cerrar } = abrirModal({
    title: 'Nuevo taller de Diseño Local',
    bodyHtml,
    footerHtml: `<button class="btn btn--ghost" id="btn-cancelar-taller" type="button">Cancelar</button><button class="btn btn--primary" id="btn-crear-taller" type="button" ${tiendasDisponibles.length ? '' : 'disabled'}>Crear taller</button>`
  });

  const selectTienda = overlay.querySelector('#input-taller-tienda');
  const selectEncargado = overlay.querySelector('#input-taller-encargado');
  const vistaPrevia = overlay.querySelector('#taller-vista-previa');
  function actualizarVistaPrevia() {
    const tienda = tiendasDisponibles.find(t => Number(t.id) === Number(selectTienda.value));
    vistaPrevia.innerHTML = tienda
      ? `El taller se llamará <strong>Diseño Local - ${escapeHtml(tienda.codigo)}</strong>.`
      : 'El nombre del taller se genera a partir de la tienda que elijas.';
  }
  actualizarVistaPrevia();
  selectTienda.addEventListener('change', actualizarVistaPrevia);
  // El aviso de error deja de ser cierto en cuanto el usuario cambia una elección.
  const limpiarError = () => overlay.querySelectorAll('.form-error').forEach(e => e.remove());
  selectTienda.addEventListener('change', limpiarError);
  selectEncargado.addEventListener('change', limpiarError);

  overlay.querySelector('#btn-cancelar-taller').addEventListener('click', cerrar);
  overlay.querySelector('#btn-crear-taller').addEventListener('click', async () => {
    if (!selectTienda.value) {
      mostrarErrorModal(overlay, 'Selecciona la tienda a la que pertenecerá el taller.');
      selectTienda.focus();
      return;
    }
    const btn = overlay.querySelector('#btn-crear-taller');
    btn.disabled = true;
    btn.classList.add('btn--loading');
    try {
      const taller = await crearTaller({
        tiendaId: Number(selectTienda.value),
        encargadoId: selectEncargado.value ? Number(selectEncargado.value) : null
      });
      window.toast.success('Taller creado', taller.nombre);
      cerrar();
      cargarTalleres();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
      btn.classList.remove('btn--loading');
    }
  });
  selectTienda.focus();
}
