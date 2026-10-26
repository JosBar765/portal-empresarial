// Modal para crear o editar un parámetro; valida en cliente (el servidor vuelve a validar al guardar).
// Rangos, valores iniciales y formatos salen de /config (ed.config); los textos, de textos.js.
import { abrirModal, mostrarErrorModal } from '../../components/modal.js';
import { $, $$ } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/formato.js';
import { t } from '../../textos.js';
import { TIPOS, LARGOS, CLAVE_LARGO_MAX } from './reglasEsquema.js';
import {
  camposPorDefecto, claveDesdeEtiqueta, claveDisponible, claveValida, dependientesDe, listaDesdeTexto,
  textoDesdeLista, limitesLista, clavesDeRecursos
} from './esquemaOps.js';

const opcionesHtml = (pares, seleccionado) => pares
  .map(([valor, texto]) => `<option value="${escapeHtml(valor)}"${String(valor) === String(seleccionado) ? ' selected' : ''}>${escapeHtml(texto)}</option>`)
  .join('');

const campoNumero = (campo, etiqueta, valor, extra = '') =>
  `<div class="form-field"><label for="pr-adm-p-${campo}">${escapeHtml(etiqueta)}</label><input id="pr-adm-p-${campo}" type="number" step="any" value="${valor == null ? '' : escapeHtml(valor)}" ${extra}></div>`;

export function abrirModalParametro(ed, { original = null, grupoClave, alGuardar }) {
  const cfg = ed.config;
  const { limites } = cfg;
  const formatos = Object.keys(cfg.formatosImagen);
  const claveOriginal = original ? original.clave : null;
  const bloqueada = !!original && ed.clavesPublicadas.has(claveOriginal);
  const todos = ed.esquema.grupos.flatMap(g => g.parametros);
  const otros = todos.filter(p => p.clave !== claveOriginal);
  const porClave = (c) => otros.find(p => p.clave === c);

  const p = original || { tipo: 'texto', requerido: false };
  let tipo = p.tipo;
  let requerido = !!p.requerido;
  let v = original ? JSON.parse(JSON.stringify(original)) : camposPorDefecto('texto', cfg);
  let claveTocada = !!original;

  const cuerpo = `
    <form id="pr-adm-p-form" novalidate>
      <div class="form-grid">
        <div class="form-field"><label for="pr-adm-p-etiqueta">${escapeHtml(t('admin.parametro.etiqueta'))}</label><input id="pr-adm-p-etiqueta" maxlength="${LARGOS.parametroEtiqueta}" value="${escapeHtml(p.etiqueta || '')}"></div>
        <div class="form-field"><label for="pr-adm-p-clave">${escapeHtml(t('admin.parametro.clave'))}</label>
          <input id="pr-adm-p-clave" maxlength="${CLAVE_LARGO_MAX}" class="pr-adm-mono" value="${escapeHtml(p.clave || '')}" ${bloqueada ? 'disabled' : ''}>
          <span class="form-hint">${escapeHtml(bloqueada ? t('admin.parametro.claveBloqueada') : '')} ${escapeHtml(t('admin.parametro.claveUso'))} <code id="pr-adm-p-clave-uso"></code></span></div>
        <div class="form-field"><label for="pr-adm-p-tipo">${escapeHtml(t('admin.parametro.tipo'))}</label><select id="pr-adm-p-tipo">${opcionesHtml(TIPOS.map(x => [x, t(`admin.tipos.${x}`)]), tipo)}</select></div>
        <div class="form-field"><label for="pr-adm-p-grupo">${escapeHtml(t('admin.parametro.grupo'))}</label><select id="pr-adm-p-grupo">${opcionesHtml(ed.esquema.grupos.map(g => [g.clave, g.etiqueta]), grupoClave)}</select></div>
        <div class="form-field full"><span class="pr-etiqueta">${escapeHtml(t('admin.parametro.obligatorio'))}</span>
          <div class="pr-chips" id="pr-adm-p-requerido">
            <button type="button" class="pr-chip" data-valor="1">${escapeHtml(t('comun.si'))}</button><button type="button" class="pr-chip" data-valor="0">${escapeHtml(t('comun.no'))}</button></div></div>
        <div class="form-field full"><label for="pr-adm-p-ayuda">${escapeHtml(t('admin.parametro.ayuda'))}</label><input id="pr-adm-p-ayuda" maxlength="${LARGOS.ayuda}" value="${escapeHtml(p.ayuda || '')}"></div>
        <div class="form-field full"><label for="pr-adm-p-vis-param">${escapeHtml(t('admin.parametro.visibleSi'))}</label>
          <div class="pr-adm-visible-si">
            <select id="pr-adm-p-vis-param">${opcionesHtml([['', t('admin.parametro.siempreVisible')], ...otros.map(o => [o.clave, `${o.etiqueta} (${o.clave})`])], p.visible_si ? p.visible_si.parametro : '')}</select>
            <span id="pr-adm-p-vis-valor"></span>
          </div></div>
      </div>
      <div id="pr-adm-p-tipo-campos" class="pr-adm-tipo-campos"></div>
    </form>`;
  const pie = `<button class="btn btn--ghost" type="button" id="pr-adm-p-cancelar">${escapeHtml(t('comun.cancelar'))}</button><button class="btn btn--primary" type="button" id="pr-adm-p-guardar">${escapeHtml(t('admin.parametro.guardar'))}</button>`;
  const { overlay, cerrar } = abrirModal({ title: original ? t('admin.parametro.tituloEditar') : t('admin.parametro.tituloAgregar'), bodyHtml: cuerpo, footerHtml: pie, size: 'lg' });

  const q = (sel) => $(sel, overlay);
  const pintarChipsRequerido = () => $$('#pr-adm-p-requerido .pr-chip', overlay).forEach(b => b.classList.toggle('is-activo', (b.dataset.valor === '1') === requerido));
  const pintarUsoClave = () => { q('#pr-adm-p-clave-uso').textContent = `{{${q('#pr-adm-p-clave').value.trim() || t('admin.parametro.claveEjemplo')}}}`; };

  // "Visible si": el control del valor depende del tipo del parámetro elegido.
  function pintarValorVisible(valorActual) {
    const ref = porClave(q('#pr-adm-p-vis-param').value);
    const caja = q('#pr-adm-p-vis-valor');
    if (!ref) { caja.innerHTML = ''; return; }
    if (ref.tipo === 'si_no') caja.innerHTML = `<select id="pr-adm-p-vis-input">${opcionesHtml([['true', t('comun.si')], ['false', t('comun.no')]], String(valorActual))}</select>`;
    else if (ref.tipo === 'opciones') caja.innerHTML = `<select id="pr-adm-p-vis-input">${opcionesHtml((ref.opciones || []).map(o => [o.valor, o.etiqueta || o.valor]), valorActual)}</select>`;
    else caja.innerHTML = `<input id="pr-adm-p-vis-input" placeholder="${escapeHtml(t('admin.parametro.visibleSiValor'))}" value="${valorActual == null ? '' : escapeHtml(valorActual)}">`;
  }

  const selectParametros = (id, lista, actual, vacio) =>
    `<select id="${id}">${opcionesHtml([['', vacio], ...lista.map(o => [o.clave, `${o.etiqueta} (${o.clave})`])], actual || '')}</select>`;

  function filaOpcion(o, i) {
    const quitar = escapeHtml(t('admin.parametro.quitarOpcion'));
    return `<div class="pr-adm-opcion" data-i="${i}">
      <input data-campo="valor" class="pr-adm-mono" placeholder="${escapeHtml(t('admin.parametro.opcionValor'))}" maxlength="${LARGOS.opcionValor}" value="${escapeHtml(o.valor)}">
      <input data-campo="etiqueta" placeholder="${escapeHtml(t('admin.parametro.opcionEtiqueta'))}" maxlength="${LARGOS.opcionEtiqueta}" value="${escapeHtml(o.etiqueta)}">
      <input data-campo="texto_prompt" placeholder="${escapeHtml(t('admin.parametro.opcionTexto'))}" maxlength="${LARGOS.opcionTexto}" value="${escapeHtml(o.texto_prompt)}">
      <button type="button" class="btn-icon icon-danger" data-quitar="${i}" title="${quitar}" aria-label="${quitar}"><ion-icon name="trash-outline"></ion-icon></button>
    </div>`;
  }

  const selectDefectoOpciones = () => `<select id="pr-adm-p-defecto">${opcionesHtml([['', t('admin.parametro.sinOpcionDefecto')], ...v.opciones.filter(o => o.valor).map(o => [o.valor, o.etiqueta || o.valor])], v.defecto)}</select>`;

  function pintarTipo() {
    const caja = q('#pr-adm-p-tipo-campos');
    const largo = () => campoNumero('max_largo', t('admin.parametro.largoMax', { tope: limites.max_largo_tope }), v.max_largo, `min="1" max="${limites.max_largo_tope}" step="1"`);
    let html = '';
    if (tipo === 'texto') html = `<div class="form-grid">${largo()}</div>`;
    else if (tipo === 'texto_largo') html = `<div class="form-grid">${largo()}
      <div class="form-field"><label for="pr-adm-p-separador">${escapeHtml(t('admin.parametro.separador'))}</label><input id="pr-adm-p-separador" maxlength="${limites.separador_max}" value="${escapeHtml(v.separador || '')}"><span class="form-hint">${escapeHtml(t('admin.parametro.separadorAyuda'))}</span></div></div>`;
    else if (tipo === 'numero') html = `<div class="form-grid">${campoNumero('min', t('admin.parametro.minimo'), v.min)}${campoNumero('max', t('admin.parametro.maximo'), v.max)}${campoNumero('defecto', t('admin.parametro.valorDefecto'), v.defecto)}
      <div class="form-field"><label for="pr-adm-p-unidad_de">${escapeHtml(t('admin.parametro.unidad'))}</label>${selectParametros('pr-adm-p-unidad_de', otros.filter(o => o.tipo === 'opciones'), v.unidad_de, t('admin.parametro.sinUnidad'))}</div></div>`;
    else if (tipo === 'opciones') html = `<div class="form-field"><span class="pr-etiqueta">${escapeHtml(t('admin.parametro.opciones'))}</span>
      <div class="pr-adm-opciones" id="pr-adm-p-opciones">${v.opciones.map(filaOpcion).join('')}</div>
      <div><button type="button" class="btn btn--ghost btn--sm" id="pr-adm-p-opcion-agregar">${escapeHtml(t('admin.parametro.agregarOpcion'))}</button></div></div>
      <div class="form-field"><label for="pr-adm-p-defecto">${escapeHtml(t('admin.parametro.opcionDefecto'))}</label><span id="pr-adm-p-defecto-caja">${selectDefectoOpciones()}</span></div>`;
    else if (tipo === 'si_no') html = `<div class="form-field"><label for="pr-adm-p-defecto">${escapeHtml(t('admin.parametro.valorDefecto'))}</label><select id="pr-adm-p-defecto">${opcionesHtml([['', t('admin.parametro.sinValorDefecto')], ['true', t('comun.si')], ['false', t('comun.no')]], v.defecto == null ? '' : String(v.defecto))}</select></div>`;
    else if (tipo === 'imagenes') html = `<div class="form-grid">${campoNumero('max', t('admin.parametro.imagenesMax', { tope: limites.imagenes_max_tope }), v.max, `min="1" max="${limites.imagenes_max_tope}" step="1"`)}${campoNumero('max_mb', t('admin.parametro.imagenesMb', { tope: limites.imagenes_mb_tope }), v.max_mb, `min="1" max="${limites.imagenes_mb_tope}" step="1"`)}</div>
      <div class="form-field"><span class="pr-etiqueta">${escapeHtml(t('admin.parametro.formatos'))}</span><div class="pr-chips" id="pr-adm-p-formatos">${formatos.map(f => `<button type="button" class="pr-chip" data-formato="${escapeHtml(f)}">${escapeHtml(f)}</button>`).join('')}</div></div>
      <div class="form-grid">
        <div class="form-field"><label for="pr-adm-p-ubicaciones">${escapeHtml(t('admin.parametro.ubicaciones'))}</label><textarea id="pr-adm-p-ubicaciones" rows="4">${escapeHtml(textoDesdeLista(v.ubicaciones))}</textarea><span class="form-hint">${escapeHtml(t('admin.parametro.listaAyuda'))}</span></div>
        <div class="form-field"><label for="pr-adm-p-sugerencias">${escapeHtml(t('admin.parametro.sugerencias'))}</label><textarea id="pr-adm-p-sugerencias" rows="4">${escapeHtml(textoDesdeLista(v.sugerencias))}</textarea><span class="form-hint">${escapeHtml(t('admin.parametro.listaAyuda'))}</span></div>
      </div>`;
    else if (tipo === 'calculado') html = `<div class="form-field"><label for="pr-adm-p-igual_a">${escapeHtml(t('admin.parametro.igualA'))}</label>${selectParametros('pr-adm-p-igual_a', otros, v.igual_a, t('admin.parametro.elegirParametro'))}<span class="form-hint">${escapeHtml(t('admin.parametro.igualAAyuda'))}</span></div>`;
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
  q('#pr-adm-p-tipo').addEventListener('change', (e) => { tipo = e.target.value; v = camposPorDefecto(tipo, cfg); pintarTipo(); });
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
      // Repintar borraría lo escrito en los recuadros: se conserva antes, sin validar límites.
      ['ubicaciones', 'sugerencias'].forEach(c => { v[c] = listaDesdeTexto(q('#pr-adm-p-' + c).value, { maxItems: Infinity, maxLargo: Infinity }).lista; });
      pintarTipo();
    }
  });

  const num = (campo) => {
    const el = q(`#pr-adm-p-${campo}`);
    return !el || el.value.trim() === '' ? undefined : Number(el.value);
  };
  const entero = (valor, min, max) => Number.isInteger(valor) && valor >= min && valor <= max;

  function camposDelTipo(errores, nombre) {
    const out = {};
    if (tipo === 'texto' || tipo === 'texto_largo') {
      const max = num('max_largo');
      if (max !== undefined) { if (!entero(max, 1, limites.max_largo_tope)) errores.push(t('admin.errores.largoMax', { nombre, tope: limites.max_largo_tope })); else out.max_largo = max; }
      const sep = tipo === 'texto_largo' ? q('#pr-adm-p-separador').value : '';
      if (sep) out.separador = sep;
    } else if (tipo === 'numero') {
      const min = num('min'); const max = num('max'); const defecto = num('defecto');
      if ([min, max, defecto].some(n => Number.isNaN(n))) errores.push(t('admin.errores.numerosInvalidos', { nombre }));
      if (min !== undefined && max !== undefined && min > max) errores.push(t('admin.errores.minMayorMax', { nombre, min, max }));
      if (defecto !== undefined && ((min !== undefined && defecto < min) || (max !== undefined && defecto > max))) errores.push(t('admin.errores.defectoFuera', { nombre, defecto }));
      if (min !== undefined) out.min = min;
      if (max !== undefined) out.max = max;
      if (defecto !== undefined) out.defecto = defecto;
      const unidad = q('#pr-adm-p-unidad_de').value;
      if (unidad) out.unidad_de = unidad;
    } else if (tipo === 'opciones') {
      const vistos = new Set();
      if (!v.opciones.length) errores.push(t('admin.errores.opcionesVacias', { nombre }));
      v.opciones.forEach((o, i) => {
        const valor = o.valor.trim();
        if (!valor || !o.texto_prompt.trim()) errores.push(t('admin.errores.opcionIncompleta', { nombre, n: i + 1 }));
        else if (vistos.has(valor)) errores.push(t('admin.errores.opcionRepetida', { nombre, valor }));
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
      if (!entero(max, 1, limites.imagenes_max_tope)) errores.push(t('admin.errores.imagenesMax', { nombre, tope: limites.imagenes_max_tope }));
      if (!entero(mb, 1, limites.imagenes_mb_tope)) errores.push(t('admin.errores.imagenesMb', { nombre, tope: limites.imagenes_mb_tope }));
      if (!(v.formatos || []).length) errores.push(t('admin.errores.formatosVacios', { nombre, formatos: formatos.join(', ') }));
      out.max = max; out.max_mb = mb; out.formatos = formatos.filter(f => (v.formatos || []).includes(f));
      ['ubicaciones', 'sugerencias'].forEach((campo) => {
        const r = listaDesdeTexto(q(`#pr-adm-p-${campo}`).value, limitesLista(limites, campo));
        r.errores.forEach(e => errores.push(e));
        if (r.lista.length) out[campo] = r.lista;
      });
    } else if (tipo === 'calculado') {
      const igual = q('#pr-adm-p-igual_a').value;
      if (!igual) errores.push(t('admin.errores.calculadoSinOrigen', { nombre })); else out.igual_a = igual;
    }
    return out;
  }

  function visibleSi(errores, nombre) {
    const clave = q('#pr-adm-p-vis-param').value;
    if (!clave) return undefined;
    const ref = porClave(clave);
    const crudo = q('#pr-adm-p-vis-input').value.trim();
    if (!crudo) { errores.push(t('admin.errores.visibleSiSinValor', { nombre, origen: ref.etiqueta })); return undefined; }
    let igual = crudo;
    if (ref.tipo === 'si_no') igual = crudo === 'true';
    else if (ref.tipo === 'numero') igual = Number(crudo);
    return { parametro: clave, igual };
  }

  function leer() {
    const errores = [];
    const etiqueta = q('#pr-adm-p-etiqueta').value.trim();
    const clave = bloqueada ? claveOriginal : q('#pr-adm-p-clave').value.trim();
    const nombre = etiqueta || clave || t('admin.parametro.sinNombre');
    if (!etiqueta) errores.push(t('admin.errores.etiquetaVacia'));
    if (!claveValida(clave)) errores.push(t('admin.errores.claveInvalida', { nombre, clave }));
    else if (cfg.variablesAutomaticas.includes(clave)) errores.push(t('admin.errores.claveReservada', { nombre, clave, lista: cfg.variablesAutomaticas.join(', ') }));
    else if (clavesDeRecursos(ed.esquema).includes(clave)) errores.push(t('admin.errores.claveDeRecurso', { nombre, clave }));
    else if (!claveDisponible(ed.esquema, clave, claveOriginal)) errores.push(t('admin.errores.claveRepetida', { nombre, clave }));
    if (original && original.tipo === 'opciones' && tipo !== 'opciones') {
      const usa = dependientesDe(ed.esquema, '', claveOriginal).find(d => d.tipo === 'unidad_de');
      if (usa) errores.push(t('admin.errores.unidadEnUso', { nombre, etiqueta: usa.etiqueta }));
    }
    const propios = camposDelTipo(errores, nombre);
    const visible = visibleSi(errores, nombre);
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
