// Selector de tags de talleres — compartido entre el formulario de creación y
// el de solicitud de modificación (este último con un `opcionesTalleres`
// restringido a los talleres del vale original). `opcionesTalleres` por
// defecto es el catálogo completo filtrado a lo que el asesor puede elegir:
// talleres de toda la empresa + el Diseño Local de SU propia tienda, si tiene
// uno — la validación real e inapelable sigue siendo la del backend.
import { state } from '../state.js';
import { limpiarErrorCampo, marcarErrorCampo } from './validacion.js';

export function talleresSeleccionablesAsesor() {
  const miTiendaId = state.catalogos.miTiendaId ?? null;
  return (state.catalogos.talleres || []).filter(t => t.tienda_id == null || t.tienda_id === miTiendaId);
}

export function htmlSelectorTalleres(opcionesTalleres) {
  const opciones = (opcionesTalleres || talleresSeleccionablesAsesor())
    .map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
  return `
    <div class="form-field full">
      <label>Talleres *</label>
      <div class="taller-tags"></div>
      <select class="select-agregar-taller">
        <option value="">+ Agregar taller...</option>
        ${opciones}
      </select>
    </div>
  `;
}

export function wireSelectorTalleres(overlay, seleccionados, opcionesTalleres) {
  const talleres = opcionesTalleres || talleresSeleccionablesAsesor();
  const container = overlay.querySelector('.taller-tags');
  const select = overlay.querySelector('.select-agregar-taller');
  const buscarTaller = (id) => talleres.find(x => x.id === id);
  const render = () => {
    container.innerHTML = [...seleccionados].map(id => {
      const t = buscarTaller(id);
      return `<span class="taller-tag" data-taller-id="${id}">${t ? t.nombre : id}<button type="button" class="taller-tag-quitar" data-taller-id="${id}">&times;</button></span>`;
    }).join('') || '<span class="taller-tags-vacio">Ningún taller seleccionado</span>';
    if (seleccionados.size > 0) limpiarErrorCampo(select);
    // Exclusividad Diseño Local ↔ talleres de toda la empresa — ayuda de UX;
    // el backend rechaza igual una combinación inválida si esto se saltara de
    // algún modo.
    const yaTieneLocal = [...seleccionados].some(id => (buscarTaller(id) || {}).tienda_id != null);
    const yaTieneGeneral = [...seleccionados].some(id => (buscarTaller(id) || {}).tienda_id == null);
    Array.from(select.options).forEach(opt => {
      if (!opt.value) return;
      const t = buscarTaller(Number(opt.value));
      if (!t) return;
      opt.disabled = seleccionados.has(t.id) || (t.tienda_id != null ? yaTieneGeneral : yaTieneLocal);
    });
  };
  render();
  select.addEventListener('change', () => {
    const id = Number(select.value);
    if (id) { seleccionados.add(id); render(); }
    select.value = '';
  });
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.taller-tag-quitar');
    if (!btn) return;
    seleccionados.delete(Number(btn.dataset.tallerId));
    render();
  });
}

export function validarTalleresSeleccionados(overlay, seleccionados) {
  const campo = overlay.querySelector('.select-agregar-taller');
  if (seleccionados.size > 0) { limpiarErrorCampo(campo); return true; }
  marcarErrorCampo(campo, 'Selecciona al menos un taller.');
  return false;
}
