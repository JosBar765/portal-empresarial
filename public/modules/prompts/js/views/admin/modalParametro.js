// Modal para crear o editar un parámetro; valida en cliente (el servidor vuelve a validar al guardar).
import { abrirModal, mostrarErrorModal } from '../../components/modal.js';
import { $, $$ } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/formato.js';
import {
  TIPOS, FORMATOS, VARIABLES_AUTOMATICAS, LISTAS_IMAGENES, camposPorDefecto, claveDesdeEtiqueta,
  claveDisponible, claveValida, dependientesDe, listaDesdeTexto, textoDesdeLista
} from './esquemaOps.js';

const opcionesHtml = (pares, seleccionado) => pares
  .map(([valor, texto]) => `<option value="${escapeHtml(valor)}"${String(valor) === String(seleccionado) ? ' selected' : ''}>${escapeHtml(texto)}</option>`)
  .join('');

const campoNumero = (campo, etiqueta, valor, extra = '') =>
  `<div class="form-field"><label for="pr-adm-p-${campo}">${etiqueta}</label><input id="pr-adm-p-${campo}" type="number" step="any" value="${valor == null ? '' : escapeHtml(valor)}" ${extra}></div>`;

export function abrirModalParametro(ed, { original = null, grupoClave, alGuardar }) {
  const claveOriginal = original ? original.clave : null;
  const bloqueada = !!original && ed.clavesPublicadas.has(claveOriginal);
  const todos = ed.esquema.grupos.flatMap(g => g.parametros);
  const otros = todos.filter(p => p.clave !== claveOriginal);
  const porClave = (c) => otros.find(p => p.clave === c);

  const p = original || { tipo: 'texto', requerido: false };
  let tipo = p.tipo;
  let requerido = !!p.requerido;
  let v = original ? JSON.parse(JSON.stringify(original)) : camposPorDefecto('texto');
  let claveTocada = !!original;

  const cuerpo = `
    <form id="pr-adm-p-form" novalidate>
      <div class="form-grid">
        <div class="form-field"><label for="pr-adm-p-etiqueta">Etiqueta</label><input id="pr-adm-p-etiqueta" maxlength="120" value="${escapeHtml(p.etiqueta || '')}"></div>
        <div class="form-field"><label for="pr-adm-p-clave">Clave</label>
          <input id="pr-adm-p-clave" maxlength="60" class="pr-adm-mono" value="${escapeHtml(p.clave || '')}" ${bloqueada ? 'disabled' : ''}>
          <span class="form-hint">${bloqueada ? 'La clave no cambia una vez publicada.' : ''} Se inserta en la plantilla como <code id="pr-adm-p-clave-uso"></code></span></div>
        <div class="form-field"><label for="pr-adm-p-tipo">Tipo</label><select id="pr-adm-p-tipo">${opcionesHtml(TIPOS.map(t => [t.valor, t.etiqueta]), tipo)}</select></div>
        <div class="form-field"><label for="pr-adm-p-grupo">Grupo</label><select id="pr-adm-p-grupo">${opcionesHtml(ed.esquema.grupos.map(g => [g.clave, g.etiqueta]), grupoClave)}</select></div>
        <div class="form-field full"><span class="pr-etiqueta">Obligatorio</span>
          <div class="pr-chips" id="pr-adm-p-requerido">
            <button type="button" class="pr-chip" data-valor="1">Sí</button><button type="button" class="pr-chip" data-valor="0">No</button></div></div>
        <div class="form-field full"><label for="pr-adm-p-ayuda">Ayuda</label><input id="pr-adm-p-ayuda" maxlength="200" value="${escapeHtml(p.ayuda || '')}"></div>
        <div class="form-field full"><label for="pr-adm-p-vis-param">Visible si</label>
          <div class="pr-adm-visible-si">
            <select id="pr-adm-p-vis-param">${opcionesHtml([['', 'Siempre visible'], ...otros.map(o => [o.clave, `${o.etiqueta} (${o.clave})`])], p.visible_si ? p.visible_si.parametro : '')}</select>
            <span id="pr-adm-p-vis-valor"></span>
          </div></div>
      </div>
      <div id="pr-adm-p-tipo-campos" class="pr-adm-tipo-campos"></div>
    </form>`;
  const pie = '<button class="btn btn--ghost" type="button" id="pr-adm-p-cancelar">Cancelar</button><button class="btn btn--primary" type="button" id="pr-adm-p-guardar">Guardar parámetro</button>';
  const { overlay, cerrar } = abrirModal({ title: original ? 'Editar parámetro' : 'Agregar parámetro', bodyHtml: cuerpo, footerHtml: pie, size: 'lg' });

  const q = (sel) => $(sel, overlay);
  const pintarChipsRequerido = () => $$('#pr-adm-p-requerido .pr-chip', overlay).forEach(b => b.classList.toggle('is-activo', (b.dataset.valor === '1') === requerido));
  const pintarUsoClave = () => { q('#pr-adm-p-clave-uso').textContent = `{{${q('#pr-adm-p-clave').value.trim() || 'clave'}}}`; };

  // "Visible si": el control del valor depende del tipo del parámetro elegido.
  function pintarValorVisible(valorActual) {
    const ref = porClave(q('#pr-adm-p-vis-param').value);
    const caja = q('#pr-adm-p-vis-valor');
    if (!ref) { caja.innerHTML = ''; return; }
    if (ref.tipo === 'si_no') caja.innerHTML = `<select id="pr-adm-p-vis-input">${opcionesHtml([['true', 'Sí'], ['false', 'No']], String(valorActual))}</select>`;
    else if (ref.tipo === 'opciones') caja.innerHTML = `<select id="pr-adm-p-vis-input">${opcionesHtml((ref.opciones || []).map(o => [o.valor, o.etiqueta || o.valor]), valorActual)}</select>`;
    else caja.innerHTML = `<input id="pr-adm-p-vis-input" placeholder="Valor" value="${valorActual == null ? '' : escapeHtml(valorActual)}">`;
  }

  const selectParametros = (id, lista, actual, vacio) =>
    `<select id="${id}">${opcionesHtml([['', vacio], ...lista.map(o => [o.clave, `${o.etiqueta} (${o.clave})`])], actual || '')}</select>`;

  function filaOpcion(o, i) {
    return `<div class="pr-adm-opcion" data-i="${i}">
      <input data-campo="valor" class="pr-adm-mono" placeholder="valor" maxlength="60" value="${escapeHtml(o.valor)}">
      <input data-campo="etiqueta" placeholder="Etiqueta" maxlength="80" value="${escapeHtml(o.etiqueta)}">
      <input data-campo="texto_prompt" placeholder="Texto en el prompt" maxlength="120" value="${escapeHtml(o.texto_prompt)}">
      <button type="button" class="btn-icon icon-danger" data-quitar="${i}" title="Quitar opción" aria-label="Quitar opción"><ion-icon name="trash-outline"></ion-icon></button>
    </div>`;
  }

  const selectDefectoOpciones = () => `<select id="pr-adm-p-defecto">${opcionesHtml([['', 'Sin opción por defecto'], ...v.opciones.filter(o => o.valor).map(o => [o.valor, o.etiqueta || o.valor])], v.defecto)}</select>`;

  function pintarTipo() {
    const caja = q('#pr-adm-p-tipo-campos');
    let html = '';
    if (tipo === 'texto') html = `<div class="form-grid">${campoNumero('max_largo', 'Largo máximo', v.max_largo, 'min="1" step="1"')}</div>`;
    else if (tipo === 'texto_largo') html = `<div class="form-grid">${campoNumero('max_largo', 'Largo máximo', v.max_largo, 'min="1" step="1"')}
      <div class="form-field"><label for="pr-adm-p-separador">Separador (opcional)</label><input id="pr-adm-p-separador" maxlength="5" value="${escapeHtml(v.separador || '')}"><span class="form-hint">Con separador, cada frase sale entre comillas.</span></div></div>`;
    else if (tipo === 'numero') html = `<div class="form-grid">${campoNumero('min', 'Mínimo', v.min)}${campoNumero('max', 'Máximo', v.max)}${campoNumero('defecto', 'Valor por defecto', v.defecto)}
      <div class="form-field"><label for="pr-adm-p-unidad_de">Unidad (parámetro de opciones)</label>${selectParametros('pr-adm-p-unidad_de', otros.filter(o => o.tipo === 'opciones'), v.unidad_de, 'Sin unidad')}</div></div>`;
    else if (tipo === 'opciones') html = `<div class="form-field"><span class="pr-etiqueta">Opciones</span>
      <div class="pr-adm-opciones" id="pr-adm-p-opciones">${v.opciones.map(filaOpcion).join('')}</div>
      <div><button type="button" class="btn btn--ghost btn--sm" id="pr-adm-p-opcion-agregar">Agregar opción</button></div></div>
      <div class="form-field"><label for="pr-adm-p-defecto">Opción por defecto</label><span id="pr-adm-p-defecto-caja">${selectDefectoOpciones()}</span></div>`;
    else if (tipo === 'si_no') html = `<div class="form-field"><label for="pr-adm-p-defecto">Valor por defecto</label><select id="pr-adm-p-defecto">${opcionesHtml([['', 'Sin valor por defecto'], ['true', 'Sí'], ['false', 'No']], v.defecto == null ? '' : String(v.defecto))}</select></div>`;
    else if (tipo === 'imagenes') html = `<div class="form-grid">${campoNumero('max', 'Máximo de imágenes (1 a 20)', v.max, 'min="1" max="20" step="1"')}${campoNumero('max_mb', 'Peso máximo en MB (1 a 10)', v.max_mb, 'min="1" max="10" step="1"')}</div>
      <div class="form-field"><span class="pr-etiqueta">Formatos permitidos</span><div class="pr-chips" id="pr-adm-p-formatos">${FORMATOS.map(f => `<button type="button" class="pr-chip" data-formato="${f}">${f}</button>`).join('')}</div></div>
      <div class="form-grid">
        <div class="form-field"><label for="pr-adm-p-ubicaciones">Ubicaciones posibles</label><textarea id="pr-adm-p-ubicaciones" rows="4">${escapeHtml(textoDesdeLista(v.ubicaciones))}</textarea><span class="form-hint">Una por línea. Déjalo vacío si no aplica.</span></div>
        <div class="form-field"><label for="pr-adm-p-sugerencias">Sugerencias de descripción</label><textarea id="pr-adm-p-sugerencias" rows="4">${escapeHtml(textoDesdeLista(v.sugerencias))}</textarea><span class="form-hint">Una por línea. Déjalo vacío si no aplica.</span></div>
      </div>`;
    else if (tipo === 'calculado') html = `<div class="form-field"><label for="pr-adm-p-igual_a">Igual a</label>${selectParametros('pr-adm-p-igual_a', otros, v.igual_a, 'Elige un parámetro')}<span class="form-hint">Toma el valor formateado de otro parámetro.</span></div>`;
    caja.innerHTML = html;
    $$('#pr-adm-p-formatos .pr-chip', overlay).forEach(b => b.classList.toggle('is-activo', (v.formatos || []).includes(b.dataset.formato)));
  }

  q('#pr-adm-p-etiqueta').addEventListener('input', (e) => {
    if (bloqueada || claveTocada) return;
    q('#pr-adm-p-clave').value = claveDesdeEtiqueta(e.target.value);
    pintarUsoClave();
  });
  q('#pr-adm-p-clave').addEventListener('input', () => { claveTocada = true; pintarUsoClave(); });
  q('#pr-adm-p-requerido').addEventListener('click', (e) => {
    const b = e.target.closest('.pr-chip');
    if (!b) return;
    requerido = b.dataset.valor === '1';
    pintarChipsRequerido();
  });
  q('#pr-adm-p-tipo').addEventListener('change', (e) => { tipo = e.target.value; v = camposPorDefecto(tipo); pintarTipo(); });
  q('#pr-adm-p-vis-param').addEventListener('change', () => pintarValorVisible(''));

  const caja = q('#pr-adm-p-tipo-campos');
  caja.addEventListener('input', (e) => {
    const fila = e.target.closest('.pr-adm-opcion');
    if (!fila) return;
    v.opciones[Number(fila.dataset.i)][e.target.dataset.campo] = e.target.value;
    if (e.target.dataset.campo === 'valor' || e.target.dataset.campo === 'etiqueta') {
      const actual = (q('#pr-adm-p-defecto') || {}).value;
      v.defecto = actual;
      q('#pr-adm-p-defecto-caja').innerHTML = selectDefectoOpciones();
    }
  });
  caja.addEventListener('click', (e) => {
    const quitar = e.target.closest('[data-quitar]');
    if (quitar) {
      v.opciones.splice(Number(quitar.dataset.quitar), 1);
      pintarTipo();
      return;
    }
    if (e.target.closest('#pr-adm-p-opcion-agregar')) {
      v.opciones.push({ valor: '', etiqueta: '', texto_prompt: '' });
      pintarTipo();
      return;
    }
    const formato = e.target.closest('[data-formato]');
    if (formato) {
      const f = formato.dataset.formato;
      v.formatos = (v.formatos || []).includes(f) ? v.formatos.filter(x => x !== f) : [...(v.formatos || []), f];
      // Repintar borraría lo escrito en los recuadros: se conserva antes.
      ['ubicaciones', 'sugerencias'].forEach(c => { v[c] = listaDesdeTexto(q('#pr-adm-p-' + c).value, { maxItems: 1e6, maxLargo: 1e6 }).lista; });
      pintarTipo();
    }
  });

  const num = (campo) => {
    const el = q(`#pr-adm-p-${campo}`);
    return !el || el.value.trim() === '' ? undefined : Number(el.value);
  };
  const entero = (valor, min, max) => Number.isInteger(valor) && valor >= min && valor <= max;

  function camposDelTipo(errores) {
    const out = {};
    if (tipo === 'texto' || tipo === 'texto_largo') {
      const max = num('max_largo');
      if (max !== undefined) { if (!entero(max, 1, 10000)) errores.push('El largo máximo debe ser un entero positivo.'); else out.max_largo = max; }
      const sep = tipo === 'texto_largo' ? q('#pr-adm-p-separador').value : '';
      if (sep) out.separador = sep;
    } else if (tipo === 'numero') {
      const min = num('min'); const max = num('max'); const defecto = num('defecto');
      [min, max, defecto].forEach(n => { if (Number.isNaN(n)) errores.push('Mínimo, máximo y valor por defecto deben ser números.'); });
      if (min !== undefined && max !== undefined && min > max) errores.push('El mínimo no puede ser mayor que el máximo.');
      if (defecto !== undefined && ((min !== undefined && defecto < min) || (max !== undefined && defecto > max))) errores.push('El valor por defecto debe estar entre el mínimo y el máximo.');
      if (min !== undefined) out.min = min;
      if (max !== undefined) out.max = max;
      if (defecto !== undefined) out.defecto = defecto;
      const unidad = q('#pr-adm-p-unidad_de').value;
      if (unidad) out.unidad_de = unidad;
    } else if (tipo === 'opciones') {
      const vistos = new Set();
      if (!v.opciones.length) errores.push('Agrega al menos una opción.');
      v.opciones.forEach((o, i) => {
        const valor = o.valor.trim();
        if (!valor || !o.texto_prompt.trim()) errores.push(`La opción ${i + 1} necesita valor y texto en el prompt.`);
        else if (vistos.has(valor)) errores.push(`El valor «${valor}» está repetido.`);
        vistos.add(valor);
      });
      out.opciones = v.opciones.map(o => ({ valor: o.valor.trim(), etiqueta: o.etiqueta.trim() || o.valor.trim(), texto_prompt: o.texto_prompt.trim() }));
      const defecto = q('#pr-adm-p-defecto').value;
      if (defecto) out.defecto = defecto;
    } else if (tipo === 'si_no') {
      const defecto = q('#pr-adm-p-defecto').value;
      if (defecto) out.defecto = defecto === 'true';
    } else if (tipo === 'imagenes') {
      const max = num('max'); const mb = num('max_mb');
      if (!entero(max, 1, 20)) errores.push('El máximo de imágenes debe estar entre 1 y 20.');
      if (!entero(mb, 1, 10)) errores.push('El peso máximo debe estar entre 1 y 10 MB.');
      if (!(v.formatos || []).length) errores.push('Elige al menos un formato.');
      out.max = max; out.max_mb = mb; out.formatos = FORMATOS.filter(f => (v.formatos || []).includes(f));
      [['ubicaciones', 'Ubicaciones posibles'], ['sugerencias', 'Sugerencias de descripción']].forEach(([campo, nombre]) => {
        const r = listaDesdeTexto(q(`#pr-adm-p-${campo}`).value, LISTAS_IMAGENES[campo]);
        r.errores.forEach(e => errores.push(`${nombre}: ${e}`));
        if (r.lista.length) out[campo] = r.lista;
      });
    } else if (tipo === 'calculado') {
      const igual = q('#pr-adm-p-igual_a').value;
      if (!igual) errores.push('Elige el parámetro del que se calcula.'); else out.igual_a = igual;
    }
    return out;
  }

  function visibleSi(errores) {
    const clave = q('#pr-adm-p-vis-param').value;
    if (!clave) return undefined;
    const ref = porClave(clave);
    const crudo = q('#pr-adm-p-vis-input').value.trim();
    if (!crudo) { errores.push('Indica el valor de «Visible si».'); return undefined; }
    let igual = crudo;
    if (ref.tipo === 'si_no') igual = crudo === 'true';
    else if (ref.tipo === 'numero') igual = Number(crudo);
    return { parametro: clave, igual };
  }

  function leer() {
    const errores = [];
    const etiqueta = q('#pr-adm-p-etiqueta').value.trim();
    if (!etiqueta) errores.push('La etiqueta es obligatoria.');
    const clave = bloqueada ? claveOriginal : q('#pr-adm-p-clave').value.trim();
    if (!claveValida(clave)) errores.push('La clave empieza con una letra minúscula y usa solo minúsculas, números y guion bajo (2 a 60 caracteres).');
    else if (VARIABLES_AUTOMATICAS.includes(clave)) errores.push('Esa clave está reservada para una variable automática.');
    else if (!claveDisponible(ed.esquema, clave, claveOriginal)) errores.push('Esa clave ya existe en el producto.');
    if (original && original.tipo === 'opciones' && tipo !== 'opciones' && dependientesDe(ed.esquema, '', claveOriginal).some(d => d.tipo === 'unidad_de')) {
      errores.push('Otro parámetro usa este como unidad: quita esa relación antes de cambiar el tipo.');
    }
    const propios = camposDelTipo(errores);
    const visible = visibleSi(errores);
    if (errores.length) return { errores };
    const parametro = { clave, etiqueta, tipo, requerido };
    const ayuda = q('#pr-adm-p-ayuda').value.trim();
    if (ayuda) parametro.ayuda = ayuda;
    if (visible) parametro.visible_si = visible;
    return { parametro: { ...parametro, ...propios }, grupo: q('#pr-adm-p-grupo').value };
  }

  q('#pr-adm-p-cancelar').addEventListener('click', cerrar);
  q('#pr-adm-p-form').addEventListener('submit', (e) => e.preventDefault());
  q('#pr-adm-p-guardar').addEventListener('click', () => {
    const r = leer();
    if (r.errores) { mostrarErrorModal(overlay, r.errores[0]); return; }
    try {
      alGuardar(r.parametro, r.grupo);
      cerrar();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
    }
  });

  pintarChipsRequerido();
  pintarUsoClave();
  pintarTipo();
  pintarValorVisible(p.visible_si ? p.visible_si.igual : '');
  q('#pr-adm-p-etiqueta').focus();
}
