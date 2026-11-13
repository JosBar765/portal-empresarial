// Selector de tags de talleres — compartido entre el formulario de creación y
// el de solicitud de modificación (este último con un `opcionesTalleres`
// restringido a los talleres del vale original). `opcionesTalleres` por
// defecto es el catálogo completo filtrado a lo que el asesor puede elegir:
// talleres de toda la empresa + los Diseño Local que atienden SU tienda
// (`tiendas_atendidas_ids`) — la validación real e inapelable sigue siendo la del backend.
import { state } from '../state.js';
import { limpiarErrorCampo, marcarErrorCampo } from './validacion.js';

// Mismo criterio que el backend: atiende su tienda, o su país y el del Diseño Local comparten (`comparteDisenoLocal`).
export function talleresSeleccionablesAsesor() {
  const miTiendaId = state.catalogos.miTiendaId ?? null;
  const comparte = Boolean(state.catalogos.miPais && state.catalogos.miPais.comparteDisenoLocal);
  return (state.catalogos.talleres || []).filter(t => t.tienda_id == null || (t.tiendas_atendidas_ids || []).includes(miTiendaId) || (comparte && t.pais_comparte_diseno_local === 1));
}

// Grupos del select: generales; Diseño Local del país del asesor; los demás Diseño Local, un grupo por país (alfabético).
export function agruparTalleres(talleres, miPais) {
  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
  const miPaisId = miPais ? miPais.id : null;
  const locales = talleres.filter(t => t.tienda_id != null);
  const grupos = [{ etiqueta: 'Talleres generales', talleres: talleres.filter(t => t.tienda_id == null).sort(porNombre) }];
  if (miPaisId !== null) grupos.push({ etiqueta: `Diseño Local ${miPais.nombre}`, talleres: locales.filter(t => t.pais_id === miPaisId).sort(porNombre) });
  const otros = locales.filter(t => t.pais_id !== miPaisId);
  for (const nombrePais of [...new Set(otros.map(t => t.pais_nombre || ''))].sort((a, b) => a.localeCompare(b, 'es'))) {
    grupos.push({ etiqueta: nombrePais ? `Diseño Local ${nombrePais}` : 'Diseño Local', talleres: otros.filter(t => (t.pais_nombre || '') === nombrePais).sort(porNombre) });
  }
  return grupos.filter(g => g.talleres.length > 0);
}

export function htmlSelectorTalleres(opcionesTalleres) {
  const opciones = agruparTalleres(opcionesTalleres || talleresSeleccionablesAsesor(), state.catalogos.miPais)
    .map(g => `<optgroup label="${g.etiqueta}">${g.talleres.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('')}</optgroup>`).join('');
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
    // Los Diseño Local de un vale deben ser del mismo país.
    const paisesElegidos = new Set([...seleccionados].map(id => buscarTaller(id)).filter(t => t && t.tienda_id != null).map(t => t.pais_id));
    Array.from(select.options).forEach(opt => {
      if (!opt.value) return;
      const t = buscarTaller(Number(opt.value));
      if (!t) return;
      opt.disabled = seleccionados.has(t.id) || (t.tienda_id != null ? yaTieneGeneral || (paisesElegidos.size > 0 && !paisesElegidos.has(t.pais_id)) : yaTieneLocal);
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
