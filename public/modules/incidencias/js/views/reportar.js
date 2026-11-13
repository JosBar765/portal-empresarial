// public/modules/incidencias/js/views/reportar.js
// «Reportar incidencia»: foto, dónde está, qué pasó y cómo afecta el trabajo. Una columna en el celular, con un resumen de cómo se
// atenderá al lado en pantallas anchas. Reintentar nunca duplica: el formulario lleva su propia clave de operación.
import { h, icono, montar, sinRebote } from '../utils/dom.js';
import { formulario, atencion, similares, crear } from '../api/incidenciasApi.js';
import { selectorFotos } from '../components/fotos.js';
import { chipPrioridad } from '../components/chips.js';
import { claveDeOperacion, hace } from '../utils/formato.js';
import { cargando, mostrarError, mostrarNoDisponible } from './estados.js';

const opcion = (valor, texto, extra) => h('option', { value: String(valor), ...extra, text: texto });

export async function mostrarReportar(cont) {
  montar(cont, cargando('Preparando el formulario…'));
  let f;
  try { f = await formulario(); } catch (error) { mostrarError(cont, error, () => mostrarReportar(cont)); return {}; }
  if (!f.tiendas.length) { mostrarNoDisponible(cont, f.avisoPais); return {}; }

  const clave = claveDeOperacion();
  const v = { tiendaId: f.tiendaPropiaId ? String(f.tiendaPropiaId) : '', zonaId: '', categoriaId: '', tipoActivoId: '', impacto: '' };
  let enviando = false;

  const paises = [...new Set(f.tiendas.map(t => t.pais))];
  const selTienda = h('select', { id: 'rep-tienda', name: 'tiendaId', required: true },
    opcion('', 'Elige dónde está el problema', { disabled: true }),
    paises.length > 1
      ? paises.map(p => h('optgroup', { label: p }, f.tiendas.filter(t => t.pais === p).map(t => opcion(t.id, `${t.codigo} · ${t.empresa}${t.id === f.tiendaPropiaId ? ' (tu tienda)' : ''}`))))
      : f.tiendas.map(t => opcion(t.id, `${t.codigo} · ${t.empresa}${t.id === f.tiendaPropiaId ? ' (tu tienda)' : ''}`)));
  const selZona = h('select', { id: 'rep-zona', name: 'zonaId', required: true });
  const selCategoria = h('select', { id: 'rep-categoria', name: 'categoriaId', required: true },
    opcion('', 'Elige la categoría', { disabled: true }), f.categorias.map(c => opcion(c.id, c.nombre)));
  const selActivo = h('select', { id: 'rep-activo', name: 'tipoActivoId' });
  const inActivoTexto = h('input', { id: 'rep-activo-texto', name: 'activoTexto', type: 'text', maxlength: f.limites.activoTexto, placeholder: 'Por ejemplo: la impresora de la caja 2', autocomplete: 'off' });
  const inTitulo = h('input', { id: 'rep-titulo', name: 'titulo', type: 'text', maxlength: f.limites.titulo, placeholder: 'Un título corto para reconocerla', autocomplete: 'off', required: true });
  const inDescripcion = h('textarea', { id: 'rep-descripcion', name: 'descripcion', rows: 4, maxlength: f.limites.descripcion, placeholder: 'Qué pasa, desde cuándo y qué ya probaste.', required: true });
  const contadorDescripcion = h('span', { class: 'inc-contador', text: `0 de ${f.limites.descripcion}` });
  const fotos = selectorFotos({ max: f.limites.fotos, obligatorio: true, etiqueta: '' });
  const avisoSimilar = h('div', { class: 'inc-aviso inc-aviso--atencion', role: 'status', hidden: true });
  const errorGeneral = h('div', { class: 'inc-banner inc-banner--error', role: 'alert', hidden: true });
  const impactos = h('div', { class: 'inc-opciones', role: 'radiogroup', 'aria-label': '¿Cómo afecta el trabajo?', 'data-campo': 'impacto' },
    f.impactos.map(i => h('label', { class: `inc-opcion${i.clave === 'riesgo_personas' ? ' inc-opcion--riesgo' : ''}` },
      h('input', { type: 'radio', name: 'impacto', value: i.clave, onchange: () => { v.impacto = i.clave; actualizarResumen(); } }),
      h('span', { class: 'inc-opcion-cuerpo' }, h('strong', { text: i.nombre }), h('small', { text: i.ayuda })))));

  // --- Resumen «Cómo se atenderá» ---
  const rTienda = h('dd');
  const rAtiende = h('dd');
  const rRevisa = h('dd');
  const rPrioridad = h('dd');
  let ultimaAtencion = null;
  function actualizarResumen() {
    const t = f.tiendas.find(x => String(x.id) === v.tiendaId);
    rTienda.textContent = t ? `${t.pais} · ${t.codigo}` : 'Elige la tienda';
    if (ultimaAtencion) {
      const a = ultimaAtencion;
      rAtiende.textContent = a.tecnicos ? `${a.tecnicos} técnico${a.tecnicos === 1 ? '' : 's'}${a.especialidad ? ` · ${a.especialidad}` : ''}` : 'Aún no hay técnicos para esta tienda; igual queda registrada';
      rRevisa.textContent = a.verifica.length ? a.verifica.map(p => p.nombre).join(', ') : 'La persona encargada de tu tienda';
    } else { rAtiende.textContent = '—'; rRevisa.textContent = '—'; }
    const imp = f.impactos.find(i => i.clave === v.impacto);
    rPrioridad.replaceChildren(imp && imp.prioridad ? chipPrioridad(imp.prioridad) : h('span', { class: 'inc-tenue', text: 'Elige cómo afecta el trabajo' }));
  }
  const pedirAtencion = sinRebote(async () => {
    if (!v.tiendaId) { ultimaAtencion = null; actualizarResumen(); return; }
    try { ultimaAtencion = await atencion({ tiendaId: v.tiendaId, categoriaId: v.categoriaId }); } catch (e) { ultimaAtencion = null; }
    actualizarResumen();
  }, 250);
  const buscarSimilares = sinRebote(async () => {
    if (!v.tiendaId || !v.categoriaId) { avisoSimilar.hidden = true; return; }
    try {
      const r = await similares({ tiendaId: v.tiendaId, categoriaId: v.categoriaId, zonaId: v.zonaId, tipoActivoId: v.tipoActivoId });
      if (!r.similares.length) { avisoSimilar.hidden = true; return; }
      const s = r.similares[0];
      avisoSimilar.hidden = false;
      avisoSimilar.replaceChildren(icono('warning-outline'), h('span', { text: `Ya hay un reporte parecido: ${s.correlativo} «${s.titulo}», ${hace(s.creadaEn)}. Si es el mismo problema, no hace falta reportarlo otra vez.` }));
    } catch (e) { avisoSimilar.hidden = true; }
  }, 400);

  function llenarZonas() {
    const zonas = f.zonas.filter(z => z.tiendaId === null || String(z.tiendaId) === v.tiendaId);
    selZona.replaceChildren(opcion('', 'Elige la zona', { disabled: true }), ...zonas.map(z => opcion(z.id, z.nombre)));
    selZona.value = zonas.some(z => String(z.id) === v.zonaId) ? v.zonaId : '';
    if (!selZona.value) v.zonaId = '';
    selZona.options[0].selected = !selZona.value;
  }
  function llenarActivos() {
    const tipos = f.tiposActivo.filter(t => String(t.categoriaId) === v.categoriaId);
    selActivo.disabled = !v.categoriaId;
    selActivo.replaceChildren(opcion('', v.categoriaId ? 'Sin elegir' : 'Primero elige la categoría'), ...tipos.map(t => opcion(t.id, t.nombre)));
    v.tipoActivoId = '';
  }
  selTienda.value = v.tiendaId;
  if (!v.tiendaId) selTienda.options[0].selected = true;
  llenarZonas();
  llenarActivos();
  selCategoria.options[0].selected = true;
  selTienda.addEventListener('change', () => { v.tiendaId = selTienda.value; llenarZonas(); actualizarResumen(); pedirAtencion(); buscarSimilares(); });
  selZona.addEventListener('change', () => { v.zonaId = selZona.value; buscarSimilares(); });
  selCategoria.addEventListener('change', () => { v.categoriaId = selCategoria.value; llenarActivos(); pedirAtencion(); buscarSimilares(); });
  selActivo.addEventListener('change', () => { v.tipoActivoId = selActivo.value; buscarSimilares(); });
  inDescripcion.addEventListener('input', () => { contadorDescripcion.textContent = `${inDescripcion.value.length} de ${f.limites.descripcion}`; });

  const campo = (id, etiqueta, control, extra = {}) => h('div', { class: `inc-campo${extra.ancho ? ' inc-campo--ancho' : ''}`, 'data-campo': extra.clave || control.name },
    h('label', { for: id, text: etiqueta }), control, extra.pie || null, h('p', { class: 'inc-campo-error', hidden: true }));
  const grupoImpacto = h('fieldset', { class: 'inc-card inc-seccion' }, h('legend', { text: '4. ¿Cómo afecta el trabajo? *' }), impactos, h('p', { class: 'inc-campo-error', 'data-error-de': 'impacto', hidden: true }));

  const botonEnviar = h('button', { class: 'btn btn--primary btn--lg inc-enviar', type: 'submit' }, icono('send-outline'), 'Enviar incidencia');

  function marcarErrores(campos) {
    cont.querySelectorAll('[data-campo]').forEach((el) => {
      const texto = campos && campos[el.dataset.campo];
      el.classList.toggle('inc-campo--error', Boolean(texto));
      const pie = el.querySelector('.inc-campo-error');
      if (pie) { pie.hidden = !texto; pie.textContent = texto || ''; }
    });
    const pieImpacto = cont.querySelector('[data-error-de="impacto"]');
    if (pieImpacto) { pieImpacto.hidden = !(campos && campos.impacto); pieImpacto.textContent = (campos && campos.impacto) || ''; }
  }

  async function enviar(e) {
    e.preventDefault();
    if (enviando) return;
    errorGeneral.hidden = true;
    const campos = {};
    if (!v.tiendaId) campos.tiendaId = 'Elige dónde está el problema.';
    if (!v.zonaId) campos.zonaId = 'Elige la zona.';
    if (!v.categoriaId) campos.categoriaId = 'Elige la categoría.';
    if (!inTitulo.value.trim()) campos.titulo = 'Escribe un título corto.';
    if (!inDescripcion.value.trim()) campos.descripcion = 'Cuenta qué pasó.';
    if (!v.impacto) campos.impacto = 'Elige cómo afecta el trabajo.';
    if (!fotos.cantidad()) campos.fotos = 'Agrega al menos una foto del problema.';
    if (fotos.ocupado()) campos.fotos = 'Espera a que termine de prepararse la foto.';
    marcarErrores(campos);
    fotos.marcarError(campos.fotos);
    if (Object.keys(campos).length) {
      errorGeneral.hidden = false;
      errorGeneral.replaceChildren(icono('alert-circle-outline'), h('span', { text: 'Revisa los datos marcados.' }));
      const primero = cont.querySelector('.inc-campo--error, .inc-seccion .inc-campo--error');
      if (primero) primero.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const datos = new FormData();
    datos.set('idempotencyKey', clave);
    datos.set('tiendaId', v.tiendaId);
    datos.set('zonaId', v.zonaId);
    datos.set('categoriaId', v.categoriaId);
    if (v.tipoActivoId) datos.set('tipoActivoId', v.tipoActivoId);
    if (inActivoTexto.value.trim()) datos.set('activoTexto', inActivoTexto.value.trim());
    datos.set('titulo', inTitulo.value.trim());
    datos.set('descripcion', inDescripcion.value.trim());
    datos.set('impacto', v.impacto);
    fotos.archivos().forEach(a => datos.append('fotos', a, a.name));
    enviando = true;
    botonEnviar.disabled = true;
    botonEnviar.replaceChildren(icono('sync-outline', 'spin-animation'), 'Enviando…');
    try {
      const r = await crear(datos);
      fotos.liberar();
      window.location.hash = `#/enviada/${r.incidencia.id}`;
    } catch (error) {
      enviando = false;
      botonEnviar.disabled = false;
      botonEnviar.replaceChildren(icono('send-outline'), 'Enviar incidencia');
      errorGeneral.hidden = false;
      errorGeneral.replaceChildren(icono('alert-circle-outline'), h('span', { text: error.sinConexion ? 'No hay conexión: tu reporte no se envió. Inténtalo otra vez; no se duplicará.' : error.message }));
      if (error.campos) { marcarErrores(error.campos); fotos.marcarError(error.campos.fotos); }
      errorGeneral.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  const formEl = h('form', { class: 'inc-reportar', novalidate: true, onsubmit: enviar },
    h('div', { class: 'inc-pagina-titulo' }, h('div', null, h('h1', { text: 'Reportar incidencia' }), h('p', { text: 'Con una foto y unos datos, la incidencia llega al equipo correcto.' }))),
    errorGeneral,
    f.reportesRestantes <= 5 ? h('div', { class: 'inc-banner inc-banner--info' }, icono('information-circle-outline'), h('span', { text: `Hoy te quedan ${f.reportesRestantes} reporte${f.reportesRestantes === 1 ? '' : 's'}.` })) : null,
    f.avisoPais ? h('div', { class: 'inc-banner inc-banner--info' }, icono('information-circle-outline'), h('span', { text: `${f.avisoPais} Elige otra tienda de la lista.` })) : null,
    h('div', { class: 'inc-reportar-cuerpo' },
      h('div', { class: 'inc-reportar-formulario' },
        h('section', { class: 'inc-card inc-seccion' }, h('h2', { text: '1. Foto del problema' }), fotos.el),
        h('section', { class: 'inc-card inc-seccion' }, h('h2', { text: '2. ¿Dónde está?' }),
          h('div', { class: 'inc-rejilla' }, campo('rep-tienda', 'Ubicación *', selTienda, { clave: 'tiendaId' }), campo('rep-zona', 'Zona *', selZona, { clave: 'zonaId' }))),
        h('section', { class: 'inc-card inc-seccion' }, h('h2', { text: '3. ¿Qué pasó?' }),
          h('div', { class: 'inc-rejilla' }, campo('rep-categoria', 'Categoría *', selCategoria, { clave: 'categoriaId' }), campo('rep-activo', 'Activo afectado', selActivo, { clave: 'tipoActivoId' })),
          campo('rep-activo-texto', '¿Cuál? (opcional)', inActivoTexto, { ancho: true, clave: 'activoTexto' }),
          avisoSimilar,
          campo('rep-titulo', 'Título *', inTitulo, { ancho: true, clave: 'titulo' }),
          campo('rep-descripcion', 'Descripción *', inDescripcion, { ancho: true, clave: 'descripcion', pie: contadorDescripcion })),
        grupoImpacto),
      h('aside', { class: 'inc-reportar-lateral' },
        h('section', { class: 'inc-card inc-atencion' }, h('h2', { text: 'Cómo se atenderá' }),
          h('dl', null, h('dt', { text: 'País y tienda' }), rTienda, h('dt', { text: 'Atiende' }), rAtiende, h('dt', { text: 'Revisa que quede resuelta' }), rRevisa, h('dt', { text: 'Prioridad estimada' }), rPrioridad),
          h('p', { class: 'inc-tenue', text: 'Se calcula según cómo afecta tu trabajo. Quien la revise puede cambiarla.' })),
        h('div', { class: 'inc-barra-fija' }, botonEnviar, h('a', { class: 'btn btn--ghost inc-cancelar', href: '#/mis', text: 'Cancelar' })))));
  montar(cont, formEl);
  actualizarResumen();
  if (v.tiendaId) pedirAtencion();
  return { liberar: () => fotos.liberar() };
}
