import { escapeHtml } from '../utils/formato.js';
import { ROL_ENCARGADO_DISENO_LOCAL } from '../config/roles.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { crearMenuCascada, construirArbolTiendas } from '../components/menuCascada.js';
import { crearTaller, listarTiendas, listarUsuariosRaw } from '../api/adminApi.js';
import { cargarTalleres } from '../views/talleres.js';

// -----------------------------------------------------------------------
// Igual al VARCHAR de `talleres.nombre`; el backend lo valida de nuevo.
const LONGITUD_MAXIMA_NOMBRE = 100;

// "Nuevo taller": desde el panel solo se crean talleres de Diseño Local.
//  - El nombre se escribe libre (máximo 100 caracteres, único) y se elige la
//    tienda principal (la sede), que puede repetirse entre Locales.
//  - El encargado es opcional y solo puede ser un usuario con rol Diseño Local
//    que no sea ya encargado de otro taller (mismo criterio que el asesor con
//    su tienda). La validación real vive en el backend; esto solo evita
//    ofrecer opciones que serían rechazadas.
// -----------------------------------------------------------------------
export async function abrirModalNuevoTaller() {
  let tiendas;
  let usuariosRaw;
  try {
    const [datosTiendas, usuarios] = await Promise.all([listarTiendas(), listarUsuariosRaw()]);
    tiendas = datosTiendas.tiendas;
    usuariosRaw = usuarios;
    if (!tiendas || !usuariosRaw.res.ok) throw new Error('No se pudieron cargar los datos necesarios.');
  } catch (error) {
    window.toast.error('No se pudo abrir el formulario', error.message);
    return;
  }

  // La tienda principal puede repetirse entre Locales: solo se filtran las inactivas.
  const tiendasDisponibles = tiendas.filter(t => t.activo);
  const encargadosDisponibles = usuariosRaw.data.usuarios.filter(u => u.activo && Number(u.rol_id) === ROL_ENCARGADO_DISENO_LOCAL && !u.taller_id);

  const bodyHtml = `
    <div class="form-grid">
      <div class="form-field full">
        <span class="campo-titulo">Tipo de taller</span>
        <div class="campo-fijo"><ion-icon name="color-palette-outline"></ion-icon><strong>Diseño Local</strong></div>
        <span class="form-hint">Desde aquí solo se crean talleres de Diseño Local.</span>
      </div>
      <div class="form-field full">
        <label for="input-taller-nombre">Nombre *</label>
        <input type="text" id="input-taller-nombre" maxlength="${LONGITUD_MAXIMA_NOMBRE}" autocomplete="off">
        <span class="form-hint">Hasta ${LONGITUD_MAXIMA_NOMBRE} caracteres y distinto al de los demás talleres.</span>
      </div>
      <div class="form-field full">
        <label for="input-taller-tienda">Tienda principal *</label>
        <div id="input-taller-tienda"></div>
        <span class="form-hint">${tiendasDisponibles.length
          ? 'Define el país, los feriados y el código de los archivos del taller. Varios talleres pueden tener la misma tienda principal.'
          : 'No hay tiendas activas disponibles.'}</span>
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

  // El menú en cascada reemplaza al select: la tienda elegida vive en `tiendaId`.
  let tiendaId = null;
  const menuTienda = crearMenuCascada({
    arbol: construirArbolTiendas(tiendasDisponibles),
    valorActual: null,
    etiquetaVacio: tiendasDisponibles.length ? 'Seleccionar tienda...' : 'No hay tiendas disponibles',
    ariaLabel: 'Tienda principal del taller',
    mensajeVacio: 'No hay tiendas disponibles.',
    onSeleccionar: (valor) => {
      tiendaId = Number(valor);
      actualizarVistaPrevia();
      limpiarError();
    }
  });
  overlay.querySelector('#input-taller-tienda').appendChild(menuTienda.elemento);
  const selectEncargado = overlay.querySelector('#input-taller-encargado');
  const vistaPrevia = overlay.querySelector('#taller-vista-previa');
  function actualizarVistaPrevia() {
    const tienda = tiendasDisponibles.find(t => Number(t.id) === tiendaId);
    vistaPrevia.innerHTML = tienda
      ? `Tienda principal: <strong>${escapeHtml(tienda.codigo)}</strong>. El taller atenderá esta tienda y podrás asignarle más después.`
      : 'Elige la tienda principal del taller.';
  }
  actualizarVistaPrevia();
  // El aviso de error deja de ser cierto en cuanto el usuario cambia una elección.
  const limpiarError = () => overlay.querySelectorAll('.form-error').forEach(e => e.remove());
  selectEncargado.addEventListener('change', limpiarError);
  const inputNombre = overlay.querySelector('#input-taller-nombre');
  inputNombre.addEventListener('input', limpiarError);

  overlay.querySelector('#btn-cancelar-taller').addEventListener('click', cerrar);
  overlay.querySelector('#btn-crear-taller').addEventListener('click', async () => {
    const nombre = inputNombre.value.trim();
    if (!nombre) {
      mostrarErrorModal(overlay, 'Escribe el nombre del taller.');
      inputNombre.focus();
      return;
    }
    if (tiendaId == null) {
      mostrarErrorModal(overlay, 'Selecciona la tienda principal del taller.');
      menuTienda.elemento.querySelector('.menu-cascada-trigger').focus();
      return;
    }
    const btn = overlay.querySelector('#btn-crear-taller');
    btn.disabled = true;
    btn.classList.add('btn--loading');
    try {
      const taller = await crearTaller({
        nombre,
        tiendaId,
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
  inputNombre.focus();
}
