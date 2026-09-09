import { state } from '../state.js';
import { escapeHtml } from '../utils/formato.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { guardarTienda } from '../api/adminApi.js';
import { cargarTiendas } from '../views/tiendas.js';

const PAISES_TIENDA = [
  { id: 1, nombre: 'Guatemala' }, { id: 2, nombre: 'El Salvador' }, { id: 3, nombre: 'Honduras' },
  { id: 4, nombre: 'Nicaragua' }, { id: 5, nombre: 'Costa Rica' }, { id: 6, nombre: 'Belice' }
];

// El nombre de la tienda ya no se escribe a mano (se deriva de {EMPRESA},
// {SUBDIVISIÓN} en el backend) — este modal solo captura los IDs de los que
// depende: Empresa y Departamento quedan filtrados por el País elegido, y la
// Subdivisión se elige de las existentes de ese departamento/país o se crea
// una nueva.
function empresasDelPais(paisId) {
  return state.organizacion.empresas.filter(e => Number(e.pais_id) === Number(paisId));
}
// Un departamento aparece para un país si tiene alguna subdivisión de ese
// país, o si no tiene subdivisiones propias y su propio país coincide (caso
// "Ventas Premia Z13", exclusivo de Guatemala).
function departamentosDelPais(paisId) {
  const pid = Number(paisId);
  return state.organizacion.departamentos.filter(d => {
    const subs = state.organizacion.subdivisiones.filter(s => s.departamento_id === d.id);
    return subs.length > 0 ? subs.some(s => Number(s.pais_id) === pid) : Number(d.pais_id) === pid;
  });
}
function subdivisionesDelDepartamento(departamentoId, paisId) {
  return state.organizacion.subdivisiones.filter(s => s.departamento_id === Number(departamentoId) && Number(s.pais_id) === Number(paisId));
}

export function abrirModalTienda(tienda) {
  const esEdicion = !!tienda;
  const paisInicial = esEdicion ? tienda.pais_id : (PAISES_TIENDA[0] && PAISES_TIENDA[0].id);
  const bodyHtml = `
    <div class="form-grid">
      <div class="form-field">
        <label>Código</label>
        <input type="text" id="input-codigo" maxlength="10">
      </div>
      <div class="form-field">
        <label>País</label>
        <select id="input-pais">
          ${PAISES_TIENDA.map(p => `<option value="${p.id}" ${paisInicial === p.id ? 'selected' : ''}>${p.nombre}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Empresa</label>
        <select id="input-empresa"></select>
      </div>
      <div class="form-field full" id="zona-departamento"></div>
      <div class="form-field full" id="zona-subdivision"></div>
      ${esEdicion ? `<div class="form-field"><label class="form-checkbox" style="margin-top:8px;"><input type="checkbox" id="input-activo-tienda" ${tienda.activo ? 'checked' : ''}> Tienda activa</label></div>` : ''}
    </div>
  `;
  const { overlay, cerrar } = abrirModal({
    title: esEdicion ? `Editar tienda — ${tienda.nombre}` : 'Nueva tienda',
    bodyHtml,
    footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-guardar">Guardar</button>`
  });
  overlay.querySelector('#input-codigo').value = esEdicion ? tienda.codigo : '';

  let departamentoModo = 'existente'; // 'existente' | 'nueva'
  let subdivisionModo = 'existente'; // 'existente' | 'nueva'

  // Mientras el departamento esté en modo "crear nuevo" no hay ningún
  // departamento real todavía, así que no hay subdivisiones existentes que
  // listar — la única opción posible es crear una subdivisión nueva también.
  function departamentoIdActual() {
    if (departamentoModo === 'nueva') return null;
    const sel = overlay.querySelector('#input-departamento-existente');
    return sel ? sel.value : '';
  }

  function renderZonaSubdivision() {
    const departamentoId = departamentoIdActual();
    const paisId = overlay.querySelector('#input-pais').value;
    const subs = departamentoId ? subdivisionesDelDepartamento(departamentoId, paisId) : [];
    const zona = overlay.querySelector('#zona-subdivision');
    const puedeUsarExistente = departamentoModo === 'existente';
    zona.innerHTML = `
      <label>Subdivisión</label>
      <div class="form-radio-group">
        ${puedeUsarExistente ? `<label class="form-checkbox"><input type="radio" name="modo-subdivision" value="existente" ${subdivisionModo === 'existente' ? 'checked' : ''}> Usar existente</label>` : ''}
        <label class="form-checkbox"><input type="radio" name="modo-subdivision" value="nueva" ${subdivisionModo === 'nueva' ? 'checked' : ''}> Crear nueva</label>
      </div>
      <div id="zona-subdivision-input"></div>
    `;
    function renderInput() {
      const cont = zona.querySelector('#zona-subdivision-input');
      if (subdivisionModo === 'nueva') {
        cont.innerHTML = `<input type="text" id="input-subdivision-nombre" placeholder="Nombre de la nueva subdivisión">`;
      } else {
        const seleccionada = esEdicion && Number(tienda.departamento_id) === Number(departamentoId) ? tienda.subdivision_id : null;
        cont.innerHTML = `
          <select id="input-subdivision-existente">
            <option value="">Sin subdivisión</option>
            ${subs.map(s => `<option value="${s.id}" ${seleccionada === s.id ? 'selected' : ''}>${escapeHtml(s.nombre)}</option>`).join('')}
          </select>
        `;
      }
    }
    renderInput();
    zona.querySelectorAll('input[name="modo-subdivision"]').forEach(r => {
      r.addEventListener('change', (e) => { subdivisionModo = e.target.value; renderInput(); });
    });
  }

  function renderZonaDepartamento() {
    const paisId = overlay.querySelector('#input-pais').value;
    const departamentos = departamentosDelPais(paisId);
    const zona = overlay.querySelector('#zona-departamento');
    zona.innerHTML = `
      <label>Departamento</label>
      <div class="form-radio-group">
        <label class="form-checkbox"><input type="radio" name="modo-departamento" value="existente" ${departamentoModo === 'existente' ? 'checked' : ''}> Usar existente</label>
        <label class="form-checkbox"><input type="radio" name="modo-departamento" value="nueva" ${departamentoModo === 'nueva' ? 'checked' : ''}> Crear nuevo</label>
      </div>
      <div id="zona-departamento-input"></div>
    `;
    function renderInput() {
      const cont = zona.querySelector('#zona-departamento-input');
      if (departamentoModo === 'nueva') {
        cont.innerHTML = `<input type="text" id="input-departamento-nombre" placeholder="Nombre del nuevo departamento">`;
      } else {
        const departamentoSel = esEdicion ? tienda.departamento_id : null;
        cont.innerHTML = departamentos.length
          ? `<select id="input-departamento-existente">${departamentos.map(d => `<option value="${d.id}" ${departamentoSel === d.id ? 'selected' : ''}>${escapeHtml(d.nombre)}</option>`).join('')}</select>`
          : `<select id="input-departamento-existente"><option value="">Sin departamentos para este país</option></select>`;
        overlay.querySelector('#input-departamento-existente').addEventListener('change', renderZonaSubdivision);
      }
    }
    renderInput();
    zona.querySelectorAll('input[name="modo-departamento"]').forEach(r => {
      r.addEventListener('change', (e) => {
        departamentoModo = e.target.value;
        renderInput();
        if (departamentoModo === 'nueva') subdivisionModo = 'nueva';
        renderZonaSubdivision();
      });
    });
  }

  function renderEmpresasYDepartamentos() {
    const paisId = overlay.querySelector('#input-pais').value;
    const empresas = empresasDelPais(paisId);
    const empresaSel = esEdicion ? tienda.empresa_id : null;
    overlay.querySelector('#input-empresa').innerHTML = empresas.length
      ? empresas.map(e => `<option value="${e.id}" ${empresaSel === e.id ? 'selected' : ''}>${escapeHtml(e.nombre)}</option>`).join('')
      : `<option value="">Sin empresas para este país</option>`;
    renderZonaDepartamento();
    renderZonaSubdivision();
  }
  renderEmpresasYDepartamentos();
  overlay.querySelector('#input-pais').addEventListener('change', renderEmpresasYDepartamentos);

  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelector('#btn-guardar').addEventListener('click', async () => {
    const btn = overlay.querySelector('#btn-guardar');
    const paisId = overlay.querySelector('#input-pais').value;
    const empresaId = overlay.querySelector('#input-empresa').value;
    const payload = {
      codigo: overlay.querySelector('#input-codigo').value.trim().toUpperCase(),
      empresaId: empresaId ? Number(empresaId) : null,
      paisId: paisId ? Number(paisId) : null
    };
    if (departamentoModo === 'nueva') {
      payload.departamentoNombre = overlay.querySelector('#input-departamento-nombre').value.trim();
    } else {
      const depVal = overlay.querySelector('#input-departamento-existente').value;
      payload.departamentoId = depVal ? Number(depVal) : null;
    }
    if (subdivisionModo === 'nueva') {
      payload.subdivisionNombre = overlay.querySelector('#input-subdivision-nombre').value.trim();
    } else {
      const subVal = overlay.querySelector('#input-subdivision-existente').value;
      payload.subdivisionId = subVal ? Number(subVal) : null;
    }
    if (esEdicion) payload.activo = overlay.querySelector('#input-activo-tienda').checked;
    if (!payload.codigo || !payload.empresaId || !(payload.departamentoId || payload.departamentoNombre)) {
      mostrarErrorModal(overlay, 'Código, empresa y departamento son obligatorios.');
      return;
    }
    if (departamentoModo === 'nueva' && !payload.departamentoNombre) {
      mostrarErrorModal(overlay, 'Escribe el nombre del nuevo departamento, o elegí "Usar existente".');
      return;
    }
    if (subdivisionModo === 'nueva' && !payload.subdivisionNombre) {
      mostrarErrorModal(overlay, 'Escribe el nombre de la nueva subdivisión, o elegí "Usar existente".');
      return;
    }
    btn.disabled = true;
    try {
      await guardarTienda(esEdicion ? tienda.id : null, payload);
      window.toast.success(esEdicion ? 'Tienda actualizada' : 'Tienda creada', payload.codigo);
      cerrar();
      cargarTiendas();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
    }
  });
}
