import { state } from '../state.js';
import { $ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { crearMenuCascada, construirArbolTiendas } from '../components/menuCascada.js';
import { listarTiendas, obtenerOrganizacion } from '../api/adminApi.js';
import { abrirModalTienda } from '../forms/tiendaForm.js';
import { abrirModalVerPersonal, abrirModalPersonal } from '../actions/tiendaPersonal.js';

export async function cargarTiendas() {
  const [tiendasRes, orgRes] = await Promise.all([
    listarTiendas(),
    obtenerOrganizacion()
  ]);
  state.tiendas = tiendasRes.tiendas;
  state.organizacion = orgRes;
  renderTiendas();
}

export function renderTiendas() {
  $('#panel-content').innerHTML = `
    <div class="panel-toolbar">
      <h2>Gestionar Tiendas</h2>
      <div class="panel-toolbar-acciones">
        <div id="filtro-tienda-tiendas-cont"></div>
        <button class="btn btn--primary" id="btn-nueva-tienda"><ion-icon name="add-outline"></ion-icon> Nueva Tienda</button>
      </div>
    </div>
    <div class="tabla-wrapper">
      <table class="data-table sticky-header">
        <thead>
          <tr>
            <th>Tienda</th>
            <th>País</th>
            <th>Departamento</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="tiendas-tbody"></tbody>
      </table>
    </div>
  `;
  $('#filtro-tienda-tiendas-cont').appendChild(crearMenuCascada({
    arbol: [{ tipo: 'hoja', valor: '', etiqueta: 'Todas las tiendas' }, ...construirArbolTiendas(state.tiendas)],
    valorActual: state.filtroTiendaTiendas,
    etiquetaVacio: 'Todas las tiendas',
    onSeleccionar: (valor) => { state.filtroTiendaTiendas = String(valor); renderTiendas(); }
  }).elemento);

  // Filtro por tienda en vez de reordenar manualmente el catálogo.
  const tiendasFiltradas = state.tiendas.filter(t => !state.filtroTiendaTiendas || String(t.id) === state.filtroTiendaTiendas);
  const tbody = $('#tiendas-tbody');
  tbody.innerHTML = tiendasFiltradas.map(t => `
    <tr>
      <td data-label="Tienda">${escapeHtml(t.nombre)}<div class="tabla-secundaria">${escapeHtml(t.codigo)}</div></td>
      <td data-label="País">${t.pais_nombre ? escapeHtml(t.pais_nombre) : '-'}</td>
      <td data-label="Departamento/Subdivisión">${escapeHtml(t.departamento_nombre)}${t.subdivision_nombre ? '<div class="tabla-secundaria">' + escapeHtml(t.subdivision_nombre) + '</div>' : ''}</td>
      <td data-label="Estado"><span class="badge ${t.activo ? 'badge-activo' : 'badge-inactivo'}">${t.activo ? 'Activa' : 'Inactiva'}</span></td>
      <td data-label="Acciones" class="acciones-cell" data-tienda-id="${t.id}"></td>
    </tr>
  `).join('');

  tiendasFiltradas.forEach(t => {
    const celda = tbody.querySelector(`[data-tienda-id="${t.id}"]`);
    // Acción de solo lectura, separada de "Gestionar personal", para ver el
    // personal agrupado por categoría sin tener que listar todo de corrido.
    const btnVer = document.createElement('button');
    btnVer.className = 'btn-icon';
    btnVer.title = 'Ver personal';
    btnVer.innerHTML = '<ion-icon name="eye-outline"></ion-icon>';
    btnVer.addEventListener('click', () => abrirModalVerPersonal(t));
    celda.appendChild(btnVer);

    const btnPersonal = document.createElement('button');
    btnPersonal.className = 'btn-icon';
    btnPersonal.title = 'Gestionar personal';
    btnPersonal.innerHTML = '<ion-icon name="people-outline"></ion-icon>';
    btnPersonal.addEventListener('click', () => abrirModalPersonal(t));
    celda.appendChild(btnPersonal);

    const btnEditar = document.createElement('button');
    btnEditar.className = 'btn-icon';
    btnEditar.title = 'Editar';
    btnEditar.innerHTML = '<ion-icon name="create-outline"></ion-icon>';
    btnEditar.addEventListener('click', () => abrirModalTienda(t));
    celda.appendChild(btnEditar);
  });

  $('#btn-nueva-tienda').addEventListener('click', () => abrirModalTienda(null));
}
