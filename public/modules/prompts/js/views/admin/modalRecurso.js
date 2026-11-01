// Modal para crear o editar un recurso fijo; valida en cliente con recursosOps (el servidor vuelve a validar al guardar).
import { abrirModal, mostrarErrorModal } from '../../components/modal.js';
import { $, $$ } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/formato.js';
import { t } from '../../textos.js';
import { CLAVE_LARGO_MAX } from './reglasEsquema.js';
import { claveDesdeEtiqueta } from './esquemaOps.js';
import { recursoVacio, validarRecurso, variableDeRecurso } from './recursosOps.js';
import { miniaturaRecurso } from './comun.js';

export function abrirModalRecurso(ed, { original = null, alGuardar }) {
  const { limites, variablesAutomaticas } = ed.config;
  const claveOriginal = original ? original.clave : null;
  const bloqueada = !!original && ed.clavesRecursosPublicadas.has(claveOriginal);
  const r = original || recursoVacio();
  let posicion = r.posicion;
  let activo = !!r.activo;
  let claveTocada = !!original;

  const cuerpo = `
    <form id="pr-adm-r-form" novalidate>
      <div class="form-grid">
        <div class="form-field"><label for="pr-adm-r-etiqueta">${escapeHtml(t('admin.recursos.etiqueta'))}</label><input id="pr-adm-r-etiqueta" maxlength="${limites.recurso_etiqueta_max}" value="${escapeHtml(r.etiqueta)}"></div>
        <div class="form-field"><label for="pr-adm-r-clave">${escapeHtml(t('admin.recursos.clave'))}</label>
          <input id="pr-adm-r-clave" class="pr-adm-mono" maxlength="${CLAVE_LARGO_MAX}" value="${escapeHtml(r.clave)}" ${bloqueada ? 'disabled' : ''}>
          <span class="form-hint">${escapeHtml(bloqueada ? t('admin.recursos.claveBloqueada') : '')} ${escapeHtml(t('admin.recursos.claveUso'))} <code id="pr-adm-r-clave-uso"></code></span></div>
        <div class="form-field full"><label for="pr-adm-r-descripcion">${escapeHtml(t('admin.recursos.descripcion'))}</label>
          <textarea id="pr-adm-r-descripcion" rows="3" maxlength="${limites.recurso_descripcion_max}">${escapeHtml(r.descripcion)}</textarea>
          <span class="form-hint">${escapeHtml(t('admin.recursos.descripcionAyuda'))}</span></div>
        <div class="form-field full"><label for="pr-adm-r-url">${escapeHtml(t('admin.recursos.url'))}</label>
          <input id="pr-adm-r-url" class="pr-adm-mono" value="${escapeHtml(r.url)}" placeholder="https://...">
          <span class="form-hint">${escapeHtml(t('admin.recursos.urlAyuda'))}</span>
          <div id="pr-adm-r-vista" class="pr-adm-rec-vista"></div></div>
        <div class="form-field"><span class="pr-etiqueta">${escapeHtml(t('admin.recursos.posicion'))}</span>
          <div class="pr-chips" id="pr-adm-r-posicion">
            <button type="button" class="pr-chip" data-valor="inicio">${escapeHtml(t('admin.recursos.posicionInicio'))}</button><button type="button" class="pr-chip" data-valor="fin">${escapeHtml(t('admin.recursos.posicionFin'))}</button></div>
          <span class="form-hint">${escapeHtml(t('admin.recursos.posicionAyuda'))}</span></div>
        <div class="form-field"><span class="pr-etiqueta">${escapeHtml(t('admin.recursos.activo'))}</span>
          <div class="pr-chips" id="pr-adm-r-activo">
            <button type="button" class="pr-chip" data-valor="1">${escapeHtml(t('comun.si'))}</button><button type="button" class="pr-chip" data-valor="0">${escapeHtml(t('comun.no'))}</button></div>
          <span class="form-hint">${escapeHtml(t('admin.recursos.activoAyuda'))}</span></div>
      </div>
    </form>`;
  const pie = `<button class="btn btn--ghost" type="button" id="pr-adm-r-cancelar">${escapeHtml(t('comun.cancelar'))}</button><button class="btn btn--primary" type="button" id="pr-adm-r-guardar">${escapeHtml(t('admin.recursos.guardar'))}</button>`;
  const { overlay, cerrar } = abrirModal({ title: original ? t('admin.recursos.tituloEditar') : t('admin.recursos.tituloAgregar'), bodyHtml: cuerpo, footerHtml: pie, size: 'lg' });

  const q = (sel) => $(sel, overlay);
  const pintarChips = () => {
    $$('#pr-adm-r-posicion .pr-chip', overlay).forEach(b => b.classList.toggle('is-activo', b.dataset.valor === posicion));
    $$('#pr-adm-r-activo .pr-chip', overlay).forEach(b => b.classList.toggle('is-activo', (b.dataset.valor === '1') === activo));
  };
  const pintarUsoClave = () => { q('#pr-adm-r-clave-uso').textContent = `{{${variableDeRecurso(q('#pr-adm-r-clave').value.trim() || t('admin.recursos.claveEjemplo'))}}}`; };
  const pintarVista = () => q('#pr-adm-r-vista').replaceChildren(miniaturaRecurso(q('#pr-adm-r-url').value));

  q('#pr-adm-r-etiqueta').addEventListener('input', (e) => {
    if (bloqueada || claveTocada) return;
    q('#pr-adm-r-clave').value = claveDesdeEtiqueta(e.target.value);
    pintarUsoClave();
  });
  q('#pr-adm-r-clave').addEventListener('input', () => { claveTocada = true; pintarUsoClave(); });
  q('#pr-adm-r-url').addEventListener('change', pintarVista);
  q('#pr-adm-r-posicion').addEventListener('click', (e) => {
    const b = e.target.closest('.pr-chip');
    if (b) { posicion = b.dataset.valor; pintarChips(); }
  });
  q('#pr-adm-r-activo').addEventListener('click', (e) => {
    const b = e.target.closest('.pr-chip');
    if (b) { activo = b.dataset.valor === '1'; pintarChips(); }
  });

  q('#pr-adm-r-cancelar').addEventListener('click', cerrar);
  q('#pr-adm-r-form').addEventListener('submit', (e) => e.preventDefault());
  q('#pr-adm-r-guardar').addEventListener('click', () => {
    const recurso = {
      clave: bloqueada ? claveOriginal : q('#pr-adm-r-clave').value.trim(),
      etiqueta: q('#pr-adm-r-etiqueta').value.trim(),
      descripcion: q('#pr-adm-r-descripcion').value.trim(),
      url: q('#pr-adm-r-url').value.trim(),
      posicion,
      activo
    };
    const errores = validarRecurso(recurso, limites, ed.esquema, { claveActual: claveOriginal, automaticas: variablesAutomaticas });
    if (errores.length) { mostrarErrorModal(overlay, errores[0]); return; }
    try {
      alGuardar(recurso);
      cerrar();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
    }
  });

  pintarChips();
  pintarUsoClave();
  pintarVista();
  q('#pr-adm-r-etiqueta').focus();
}
