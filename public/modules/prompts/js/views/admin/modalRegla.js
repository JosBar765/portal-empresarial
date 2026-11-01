// Modal para crear o editar una regla específica; valida en cliente con reglasOps (el servidor vuelve a validar al guardar).
import { abrirModal, mostrarErrorModal } from '../../components/modal.js';
import { $, $$, h } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/formato.js';
import { t } from '../../textos.js';
import { CLAVE_LARGO_MAX } from './reglasEsquema.js';
import { claveDesdeEtiqueta, clavesDelEsquema, variableGrupoVacio, insertarEnPosicion } from './esquemaOps.js';
import { variableDeRecurso, recursosDe } from './recursosOps.js';
import { reglaVacia, validarRegla } from './reglasOps.js';

// Las variables salen del esquema y de /config; ninguna lista de negocio vive aquí.
function gruposDeVariables(esquema, automaticas) {
  return [
    { titulo: 'admin.reglas.variablesParametros', nombres: clavesDelEsquema(esquema) },
    { titulo: 'admin.reglas.variablesRecursos', nombres: recursosDe(esquema).map(r => variableDeRecurso(r.clave)) },
    { titulo: 'admin.reglas.variablesGrupos', nombres: esquema.grupos.map(g => variableGrupoVacio(g.clave)) },
    { titulo: 'admin.reglas.variablesAutomaticas', nombres: automaticas }
  ].filter(g => g.nombres.length);
}

export function abrirModalRegla(ed, { original = null, alGuardar }) {
  const { limites, variablesAutomaticas } = ed.config;
  const claveOriginal = original ? original.clave : null;
  const bloqueada = !!original && ed.clavesReglasPublicadas.has(claveOriginal);
  const r = original || reglaVacia();
  let posicion = r.posicion;
  let activo = !!r.activo;
  let claveTocada = !!original;

  const cuerpo = `
    <form id="pr-adm-rg-form" novalidate>
      <div class="form-grid">
        <div class="form-field"><label for="pr-adm-rg-etiqueta">${escapeHtml(t('admin.reglas.etiqueta'))}</label><input id="pr-adm-rg-etiqueta" maxlength="${limites.regla_etiqueta_max}" value="${escapeHtml(r.etiqueta)}"></div>
        <div class="form-field"><label for="pr-adm-rg-clave">${escapeHtml(t('admin.reglas.clave'))}</label>
          <input id="pr-adm-rg-clave" class="pr-adm-mono" maxlength="${CLAVE_LARGO_MAX}" value="${escapeHtml(r.clave)}" ${bloqueada ? 'disabled' : ''}>
          <span class="form-hint">${escapeHtml(bloqueada ? t('admin.reglas.claveBloqueada') : t('admin.reglas.claveAyuda'))}</span></div>
        <div class="form-field full"><label for="pr-adm-rg-texto">${escapeHtml(t('admin.reglas.texto'))}</label>
          <textarea id="pr-adm-rg-texto" class="pr-adm-regla-area" spellcheck="false" maxlength="${limites.regla_texto_max}">${escapeHtml(r.texto)}</textarea>
          <span class="form-hint" id="pr-adm-rg-contador"></span>
          <p class="form-hint" id="pr-adm-rg-sintaxis"></p>
          <div id="pr-adm-rg-variables"></div></div>
        <div class="form-field"><span class="pr-etiqueta">${escapeHtml(t('admin.reglas.posicion'))}</span>
          <div class="pr-chips" id="pr-adm-rg-posicion">
            <button type="button" class="pr-chip" data-valor="inicio">${escapeHtml(t('admin.reglas.posicionInicio'))}</button><button type="button" class="pr-chip" data-valor="fin">${escapeHtml(t('admin.reglas.posicionFin'))}</button></div>
          <span class="form-hint">${escapeHtml(t('admin.reglas.posicionAyuda'))}</span></div>
        <div class="form-field"><span class="pr-etiqueta">${escapeHtml(t('admin.reglas.activo'))}</span>
          <div class="pr-chips" id="pr-adm-rg-activo">
            <button type="button" class="pr-chip" data-valor="1">${escapeHtml(t('comun.si'))}</button><button type="button" class="pr-chip" data-valor="0">${escapeHtml(t('comun.no'))}</button></div>
          <span class="form-hint">${escapeHtml(t('admin.reglas.activoAyuda'))}</span></div>
      </div>
    </form>`;
  const pie = `<button class="btn btn--ghost" type="button" id="pr-adm-rg-cancelar">${escapeHtml(t('comun.cancelar'))}</button><button class="btn btn--primary" type="button" id="pr-adm-rg-guardar">${escapeHtml(t('admin.reglas.guardar'))}</button>`;
  const { overlay, cerrar } = abrirModal({ title: original ? t('admin.reglas.tituloEditar') : t('admin.reglas.tituloAgregar'), bodyHtml: cuerpo, footerHtml: pie, size: 'lg' });

  const q = (sel) => $(sel, overlay);
  const area = q('#pr-adm-rg-texto');
  const pintarChips = () => {
    $$('#pr-adm-rg-posicion .pr-chip', overlay).forEach(b => b.classList.toggle('is-activo', b.dataset.valor === posicion));
    $$('#pr-adm-rg-activo .pr-chip', overlay).forEach(b => b.classList.toggle('is-activo', (b.dataset.valor === '1') === activo));
  };
  const pintarContador = () => { q('#pr-adm-rg-contador').textContent = t('admin.reglas.caracteres', { n: area.value.length, max: limites.regla_texto_max }); };

  // Inserta la variable donde esté el cursor del texto.
  const insertar = (fragmento) => {
    const ins = insertarEnPosicion(area.value, area.selectionStart, area.selectionEnd, fragmento);
    area.value = ins.texto;
    area.focus();
    area.setSelectionRange(ins.cursor, ins.cursor);
    pintarContador();
  };

  q('#pr-adm-rg-sintaxis').textContent = t('admin.reglas.sintaxisAyuda', {
    variable: '{{clave}}', si: '{{#si clave}} … {{/si}}', no: '{{#no clave}} … {{/no}}'
  });
  q('#pr-adm-rg-variables').replaceChildren(...gruposDeVariables(ed.esquema, variablesAutomaticas).flatMap(g => [
    h('span', { class: 'form-hint', text: t(g.titulo) }),
    h('div', { class: 'pr-adm-vars' }, g.nombres.map(n => h('button', { type: 'button', class: 'pr-adm-var', onclick: () => insertar(`{{${n}}}`) }, `{{${n}}}`)))
  ]));

  q('#pr-adm-rg-etiqueta').addEventListener('input', (e) => {
    if (bloqueada || claveTocada) return;
    q('#pr-adm-rg-clave').value = claveDesdeEtiqueta(e.target.value);
  });
  q('#pr-adm-rg-clave').addEventListener('input', () => { claveTocada = true; });
  area.addEventListener('input', pintarContador);
  q('#pr-adm-rg-posicion').addEventListener('click', (e) => {
    const b = e.target.closest('.pr-chip');
    if (b) { posicion = b.dataset.valor; pintarChips(); }
  });
  q('#pr-adm-rg-activo').addEventListener('click', (e) => {
    const b = e.target.closest('.pr-chip');
    if (b) { activo = b.dataset.valor === '1'; pintarChips(); }
  });

  q('#pr-adm-rg-cancelar').addEventListener('click', cerrar);
  q('#pr-adm-rg-form').addEventListener('submit', (e) => e.preventDefault());
  q('#pr-adm-rg-guardar').addEventListener('click', () => {
    const regla = {
      clave: bloqueada ? claveOriginal : q('#pr-adm-rg-clave').value.trim(),
      etiqueta: q('#pr-adm-rg-etiqueta').value.trim(),
      texto: area.value,
      posicion,
      activo
    };
    const errores = validarRegla(regla, limites, ed.esquema, { claveActual: claveOriginal, automaticas: variablesAutomaticas });
    if (errores.length) { mostrarErrorModal(overlay, errores[0]); return; }
    try {
      alGuardar(regla);
      cerrar();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
    }
  });

  pintarChips();
  pintarContador();
  q('#pr-adm-rg-etiqueta').focus();
}
