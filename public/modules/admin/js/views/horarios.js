import { state } from '../state.js';
import { $ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import {
  obtenerHorarios, guardarHorarios, obtenerParametrosHorario, guardarParametrosHorario, listarPaisesHorarios, listarFeriados,
  crearFeriado, actualizarFeriado, eliminarFeriado
} from '../api/adminApi.js';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const fechaLegible = (f) => String(f).split('-').reverse().join('/');

export async function cargarHorarios() {
  const [horarios, paises, parametros] = await Promise.all([obtenerHorarios(), listarPaisesHorarios(), obtenerParametrosHorario()]);
  state.horarios = horarios;
  state.horasVencimientoVale = parametros.horasVencimientoVale;
  // Guatemala primero y por defecto.
  state.paisesHorarios = [...paises].sort((a, b) => (b.codigo === 'GT') - (a.codigo === 'GT') || a.nombre.localeCompare(b.nombre));
  if (!state.paisesHorarios.some(p => p.id === state.paisFeriadoId)) state.paisFeriadoId = state.paisesHorarios[0]?.id ?? null;
  state.feriados = state.paisFeriadoId ? await listarFeriados(state.paisFeriadoId) : [];
  renderHorarios();
}

function renderHorarios() {
  $('#panel-content').innerHTML = `
    <div class="panel-toolbar"><h2>Horarios y feriados</h2></div>

    <section class="horario-seccion" aria-labelledby="horario-titulo">
      <div class="panel-toolbar">
        <h3 id="horario-titulo">Horario laboral</h3>
        <div class="panel-toolbar-acciones">
          <button class="btn btn--primary" id="btn-guardar-horario"><ion-icon name="save-outline"></ion-icon> Guardar horario</button>
        </div>
      </div>
      <p class="form-hint">Vale para todas las tiendas. Un día que no es laboral no lleva horario.</p>
      <div id="horario-error" class="form-error" role="alert" style="display:none;"></div>
      <div class="tabla-wrapper">
        <table class="data-table horario-tabla">
          <thead><tr><th>Día</th><th>Laboral</th><th>Recibe vales de arte</th><th>Hora de inicio</th><th>Hora de fin</th></tr></thead>
          <tbody>${state.horarios.map(filaHorario).join('')}</tbody>
        </table>
      </div>
    </section>

    <section class="horario-seccion" aria-labelledby="parametros-titulo">
      <div class="panel-toolbar">
        <h3 id="parametros-titulo">Vencimiento de vales de arte</h3>
        <div class="panel-toolbar-acciones">
          <button class="btn btn--primary" id="btn-guardar-parametros"><ion-icon name="save-outline"></ion-icon> Guardar</button>
        </div>
      </div>
      <div id="parametros-error" class="form-error" role="alert" style="display:none;"></div>
      <div class="form-field horario-pais">
        <label for="input-horas-vencimiento">Horas de vencimiento de un vale de arte</label>
        <input type="number" id="input-horas-vencimiento" min="1" max="48" step="1" inputmode="numeric" value="${state.horasVencimientoVale}">
        <span class="form-hint">Número entero de 1 a 48.</span>
      </div>
    </section>

    <section class="horario-seccion" aria-labelledby="feriados-titulo">
      <div class="panel-toolbar">
        <h3 id="feriados-titulo">Feriados</h3>
        <div class="panel-toolbar-acciones">
          <button class="btn btn--primary" id="btn-agregar-feriado" ${state.paisFeriadoId ? '' : 'disabled'}><ion-icon name="add-outline"></ion-icon> Agregar feriado</button>
        </div>
      </div>
      <div class="form-field horario-pais">
        <label for="select-pais-feriados">País</label>
        <select id="select-pais-feriados">${state.paisesHorarios.map(p =>
          `<option value="${p.id}" ${p.id === state.paisFeriadoId ? 'selected' : ''}>${escapeHtml(p.nombre)}</option>`).join('')}</select>
      </div>
      <div id="feriados-lista"></div>
    </section>
  `;
  document.querySelectorAll('.horario-laboral').forEach(chk => chk.addEventListener('change', () => alternarDia(chk)));
  $('#btn-guardar-horario').addEventListener('click', guardar);
  $('#btn-guardar-parametros').addEventListener('click', guardarParametros);
  $('#btn-agregar-feriado').addEventListener('click', () => abrirModalFeriado());
  $('#select-pais-feriados').addEventListener('change', async (e) => {
    state.paisFeriadoId = Number(e.target.value);
    await recargarFeriados();
  });
  renderFeriados();
}

function filaHorario(h) {
  const nombre = DIAS[h.diaSemana - 1];
  const dis = h.laboral ? '' : 'disabled';
  return `
    <tr data-dia="${h.diaSemana}">
      <td data-label="Día">${nombre}</td>
      <td data-label="Laboral">
        <span class="form-checkbox"><input type="checkbox" class="horario-laboral" id="laboral-${h.diaSemana}" ${h.laboral ? 'checked' : ''}>
        <label for="laboral-${h.diaSemana}">Laboral<span class="sr-only"> el ${nombre.toLowerCase()}</span></label></span>
      </td>
      <td data-label="Recibe vales de arte">
        <span class="form-checkbox"><input type="checkbox" class="horario-recibe" id="recibe-${h.diaSemana}" ${h.recibeVales ? 'checked' : ''} ${dis}>
        <label for="recibe-${h.diaSemana}">Recibe vales de arte<span class="sr-only"> el ${nombre.toLowerCase()}</span></label></span>
      </td>
      <td data-label="Hora de inicio"><div class="form-field"><input type="time" class="horario-inicio" aria-label="Hora de inicio del ${nombre.toLowerCase()}" value="${h.horaInicio || ''}" ${dis}></div></td>
      <td data-label="Hora de fin"><div class="form-field"><input type="time" class="horario-fin" aria-label="Hora de fin del ${nombre.toLowerCase()}" value="${h.horaFin || ''}" ${dis}></div></td>
    </tr>`;
}

// Un día no laboral no admite horas ni recibir vales: se deshabilitan y se vacían.
function alternarDia(chk) {
  const fila = chk.closest('tr');
  fila.querySelectorAll('input[type="time"]').forEach(i => { i.disabled = !chk.checked; if (!chk.checked) i.value = ''; });
  const recibe = fila.querySelector('.horario-recibe');
  recibe.disabled = !chk.checked;
  if (!chk.checked) recibe.checked = false;
}

function mostrarErrorHorario(msg) {
  const box = $('#horario-error');
  box.textContent = msg || '';
  box.style.display = msg ? '' : 'none';
}

function leerHorario() {
  return [...document.querySelectorAll('.horario-tabla tbody tr')].map(fila => {
    const laboral = fila.querySelector('.horario-laboral').checked;
    return {
      diaSemana: Number(fila.dataset.dia),
      laboral,
      recibeVales: laboral && fila.querySelector('.horario-recibe').checked,
      horaInicio: laboral ? fila.querySelector('.horario-inicio').value || null : null,
      horaFin: laboral ? fila.querySelector('.horario-fin').value || null : null
    };
  });
}

function validarHorario(dias) {
  for (const d of dias.filter(x => x.laboral)) {
    const nombre = DIAS[d.diaSemana - 1];
    if (!d.horaInicio || !d.horaFin) return `El ${nombre.toLowerCase()} es laboral: indica la hora de inicio y la hora de fin.`;
    if (d.horaInicio >= d.horaFin) return `En el ${nombre.toLowerCase()}, la hora de inicio debe ser anterior a la hora de fin.`;
  }
  return '';
}

async function guardar() {
  const dias = leerHorario();
  const problema = validarHorario(dias);
  mostrarErrorHorario(problema);
  if (problema) return;
  const btn = $('#btn-guardar-horario');
  btn.disabled = true;
  try {
    state.horarios = await guardarHorarios(dias);
    window.toast.success('Horario guardado', 'El horario laboral quedó actualizado.');
    renderHorarios();
  } catch (error) {
    mostrarErrorHorario(error.message);
    btn.disabled = false;
  }
}

function mostrarErrorParametros(msg) {
  const box = $('#parametros-error');
  box.textContent = msg || '';
  box.style.display = msg ? '' : 'none';
}

async function guardarParametros() {
  const crudo = $('#input-horas-vencimiento').value.trim();
  const horas = Number(crudo);
  const problema = !crudo || !Number.isInteger(horas) || horas < 1 || horas > 48
    ? 'Las horas de vencimiento deben ser un número entero de 1 a 48.' : '';
  mostrarErrorParametros(problema);
  if (problema) return;
  const btn = $('#btn-guardar-parametros');
  btn.disabled = true;
  try {
    const r = await guardarParametrosHorario(horas);
    state.horasVencimientoVale = r.horasVencimientoVale;
    window.toast.success('Parámetro guardado', 'Las horas de vencimiento de un vale de arte quedaron actualizadas.');
    $('#input-horas-vencimiento').value = state.horasVencimientoVale;
  } catch (error) {
    mostrarErrorParametros(error.message);
  }
  btn.disabled = false;
}

async function recargarFeriados() {
  try {
    state.feriados = await listarFeriados(state.paisFeriadoId);
    renderFeriados();
  } catch (error) {
    $('#feriados-lista').innerHTML = `<div class="buzon-vacio buzon-vacio-error"><ion-icon name="alert-circle-outline"></ion-icon><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function renderFeriados() {
  const cont = $('#feriados-lista');
  if (!state.feriados.length) {
    cont.innerHTML = `<div class="buzon-vacio"><ion-icon name="calendar-outline"></ion-icon><p>Aún no hay feriados para este país.</p></div>`;
    return;
  }
  cont.innerHTML = `
    <div class="tabla-wrapper">
      <table class="data-table sticky-header">
        <thead><tr><th>Fecha</th><th>Nombre</th><th>Se repite cada año</th><th>Acciones</th></tr></thead>
        <tbody>${state.feriados.map(f => `
          <tr>
            <td data-label="Fecha">${fechaLegible(f.fecha)}</td>
            <td data-label="Nombre">${escapeHtml(f.nombre)}</td>
            <td data-label="Se repite cada año"><span class="badge ${f.seRepiteCadaAnio ? 'badge-activo' : 'badge-inactivo'}">${f.seRepiteCadaAnio ? 'Sí' : 'No'}</span></td>
            <td data-label="Acciones" class="acciones-cell">
              <button class="btn-icon" data-editar="${f.id}" title="Editar feriado" aria-label="Editar ${escapeHtml(f.nombre)}"><ion-icon name="create-outline"></ion-icon></button>
              <button class="btn-icon icon-danger" data-eliminar="${f.id}" title="Eliminar feriado" aria-label="Eliminar ${escapeHtml(f.nombre)}"><ion-icon name="trash-outline"></ion-icon></button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  cont.onclick = (e) => {
    const ed = e.target.closest('[data-editar]');
    const el = e.target.closest('[data-eliminar]');
    if (ed) abrirModalFeriado(state.feriados.find(f => f.id === Number(ed.dataset.editar)));
    else if (el) abrirModalEliminar(state.feriados.find(f => f.id === Number(el.dataset.eliminar)));
  };
}

function abrirModalFeriado(feriado) {
  const { overlay, cerrar } = abrirModal({
    title: feriado ? 'Editar feriado' : 'Agregar feriado',
    bodyHtml: `
      <div class="form-grid">
        <div class="form-field">
          <label for="feriado-fecha">Fecha *</label>
          <input type="date" id="feriado-fecha" min="2000-01-01" max="2100-12-31" value="${feriado ? feriado.fecha : ''}">
        </div>
        <div class="form-field">
          <label for="feriado-nombre">Nombre *</label>
          <input type="text" id="feriado-nombre" maxlength="100" value="${feriado ? escapeHtml(feriado.nombre) : ''}">
        </div>
        <div class="form-checkbox full">
          <input type="checkbox" id="feriado-repite" ${feriado && feriado.seRepiteCadaAnio ? 'checked' : ''}>
          <label for="feriado-repite">Se repite todos los años</label>
        </div>
      </div>`,
    footerHtml: `<button class="btn btn--ghost" id="btn-cancelar-feriado">Cancelar</button><button class="btn btn--primary" id="btn-guardar-feriado">Guardar</button>`
  });
  const btn = overlay.querySelector('#btn-guardar-feriado');
  overlay.querySelector('#feriado-fecha').focus();
  overlay.querySelector('#btn-cancelar-feriado').addEventListener('click', cerrar);
  const guardarFeriado = async () => {
    const datos = {
      fecha: overlay.querySelector('#feriado-fecha').value,
      nombre: overlay.querySelector('#feriado-nombre').value.trim(),
      seRepiteCadaAnio: overlay.querySelector('#feriado-repite').checked
    };
    if (!datos.fecha) { mostrarErrorModal(overlay, 'Indica la fecha del feriado.'); return; }
    if (!datos.nombre) { mostrarErrorModal(overlay, 'Escribe el nombre del feriado.'); return; }
    btn.disabled = true;
    try {
      if (feriado) await actualizarFeriado(feriado.id, datos);
      else await crearFeriado({ paisId: state.paisFeriadoId, ...datos });
      window.toast.success(feriado ? 'Feriado actualizado' : 'Feriado agregado', datos.nombre);
      cerrar();
      recargarFeriados();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
    }
  };
  btn.addEventListener('click', guardarFeriado);
  overlay.querySelectorAll('input[type="text"], input[type="date"]').forEach(i =>
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); guardarFeriado(); } }));
}

function abrirModalEliminar(feriado) {
  const { overlay, cerrar } = abrirModal({
    title: 'Eliminar feriado',
    bodyHtml: `<p>¿Eliminar el feriado <strong>${escapeHtml(feriado.nombre)}</strong> (${fechaLegible(feriado.fecha)})? Esta acción no se puede deshacer.</p>`,
    footerHtml: `<button class="btn btn--ghost" id="btn-cancelar-eliminar">Cancelar</button><button class="btn btn--danger" id="btn-confirmar-eliminar">Eliminar</button>`
  });
  const btn = overlay.querySelector('#btn-confirmar-eliminar');
  overlay.querySelector('#btn-cancelar-eliminar').addEventListener('click', cerrar);
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await eliminarFeriado(feriado.id);
      window.toast.success('Feriado eliminado', feriado.nombre);
      cerrar();
      recargarFeriados();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
    }
  });
}
