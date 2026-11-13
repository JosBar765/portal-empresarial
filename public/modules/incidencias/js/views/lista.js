// public/modules/incidencias/js/views/lista.js
// «Mis incidencias» y «Por verificar»: las pestañas salen de lo que cada persona puede hacer (reportar, atender, verificar,
// consultar todo). Tabla en pantallas anchas y tarjetas en el celular; «Tomar» se hace desde el propio buzón.
import { h, icono, montar, sinRebote } from '../utils/dom.js';
import { listar, resumen as pedirResumen, tomar } from '../api/incidenciasApi.js';
import { chipPrioridad, chipEstado, chipTexto } from '../components/chips.js';
import { hace, antiguedad } from '../utils/formato.js';
import { state } from '../state.js';
import { cargando, mostrarError, vacio, botonEnlace } from './estados.js';

const ESTADOS_FILTRO = [
  ['abiertas', 'Abiertas'], ['en_buzon', 'En buzón'], ['en_proceso', 'En proceso'], ['en_espera', 'En espera'],
  ['en_verificacion', 'En verificación'], ['correccion_pedida', 'Corrección pedida'], ['cerrada', 'Cerradas'], ['descartada', 'Descartadas'], ['', 'Todas']
];

// Las pestañas que le tocan a esta persona. `estados`: lo que lista cada una; `conteo`: el número que lleva al lado.
function pestanasDe(permisos) {
  const tiene = (p) => permisos.includes(p);
  const tabs = [];
  if (tiene('incidencias.resolver')) {
    tabs.push(
      { id: 'buzon', etiqueta: 'Buzón', vista: 'buzon', conteo: r => r.buzon && r.buzon.total, orden: 'buzon' },
      { id: 'mias', etiqueta: 'Mías', vista: 'tecnico', estados: 'en_proceso,correccion_pedida,en_verificacion', conteo: r => r.tecnico && (r.tecnico.mias + r.tecnico.enVerificacion) },
      { id: 'espera', etiqueta: 'En espera', vista: 'tecnico', estados: 'en_espera', conteo: r => r.tecnico && r.tecnico.enEspera },
      { id: 'cerradas', etiqueta: 'Cerradas', vista: 'tecnico', estados: 'cerrada' });
  }
  if (tiene('incidencias.verificar') || tiene('incidencias.asignar')) tabs.push({ id: 'tiendas', etiqueta: 'De mis tiendas', vista: 'tiendas', estados: 'abiertas', filtroEstado: true, conteo: r => r.tiendas && r.tiendas.abiertas });
  if (tiene('incidencias.ver_todas')) tabs.push({ id: 'todas', etiqueta: 'Todas', vista: 'todas', estados: 'abiertas', filtroEstado: true, conteo: r => r.todas && r.todas.abiertas });
  tabs.push({ id: 'reportadas', etiqueta: 'Reportadas por mí', vista: 'reportadas', filtroChips: true, conteo: r => r.reportadas && r.reportadas.abiertas });
  return tabs;
}

const SUBTITULO = {
  buzon: 'Toma del buzón las que vas a trabajar.',
  mias: 'Lo que ya tomaste y sigue en marcha.',
  espera: 'Las que están detenidas por un motivo.',
  cerradas: 'Las que ya quedaron resueltas.',
  tiendas: 'Las incidencias de las tiendas a tu cargo.',
  todas: 'Consulta de toda la operación (no puedes cambiar nada).',
  reportadas: 'Aquí ves cómo va lo que reportaste.'
};

const VACIO = {
  buzon: ['No hay incidencias en el buzón', 'Cuando alguien reporte algo en las tiendas que cubres, aparecerá aquí.'],
  mias: ['No tienes incidencias en marcha', 'Toma una del buzón para empezar.'],
  espera: ['Nada en espera', 'Las incidencias que detengas por un motivo aparecerán aquí.'],
  cerradas: ['Aún no hay incidencias cerradas', null],
  tiendas: ['No hay incidencias en tus tiendas con ese filtro', null],
  todas: ['No hay incidencias con ese filtro', null],
  reportadas: ['Aún no has reportado incidencias', 'Si ves un equipo dañado o un problema en tu tienda, repórtalo con una foto y lo atiende el equipo correcto.']
};

function tarjetasDe(tab, r) {
  const t = (titulo, valor, nota, clase = '') => ({ titulo, valor, nota, clase });
  if (tab.id === 'reportadas' && r.reportadas) {
    return [t('Abiertas', r.reportadas.abiertas, 'Las que siguen sin cerrarse'), t('En proceso', r.reportadas.enProceso, 'Un técnico trabaja en ellas'),
      t('En verificación', r.reportadas.enVerificacion, 'Esperando que las revisen'), t('Cerradas', r.reportadas.cerradas, 'Gracias por reportar')];
  }
  if (['buzon', 'mias', 'espera', 'cerradas'].includes(tab.id) && r.buzon) {
    const b = r.buzon;
    return [
      t('En el buzón', b.total, 'Esperan que alguien las tome'),
      t('Prioridad crítica', b.criticas, b.critica ? `${b.critica.titulo} · ${hace(b.critica.creadaEn)}` : 'Ninguna por ahora', b.criticas ? 'inc-kpi--alerta' : ''),
      t('Más antigua', b.masAntigua ? antiguedad(b.masAntigua.creadaEn) : '—', b.masAntigua ? b.masAntigua.titulo : 'El buzón está al día'),
      t('Sin avance', r.tecnico ? r.tecnico.sinAvance : 0, 'Incidencias tuyas que no avanzan', r.tecnico && r.tecnico.sinAvance ? 'inc-kpi--alerta' : '')];
  }
  if (tab.id === 'tiendas' && r.tiendas) {
    return [t('En buzón', r.tiendas.enBuzon, 'Esperan que un técnico la tome'), t('En proceso', r.tiendas.enProceso, 'Un técnico trabaja en ellas'),
      t('En espera', r.tiendas.enEspera, 'Detenidas por un motivo'), t('Por verificar', r.verificar ? r.verificar.pendientes : 0, 'Esperan tu aprobación', r.verificar && r.verificar.pendientes ? 'inc-kpi--alerta' : '')];
  }
  if (tab.id === 'todas' && r.todas) return [t('Abiertas', r.todas.abiertas, 'En todas las tiendas'), t('Total', r.todas.total, 'Desde que arrancó el módulo')];
  return [];
}

export async function mostrarLista(cont, { vista = 'mis', tab: tabPedida } = {}) {
  const permisos = state.user.permissions || [];
  const esVerificar = vista === 'verificar';
  const tabs = esVerificar
    ? [{ id: 'verificar', etiqueta: 'Por verificar', vista: 'verificar', conteo: r => r.verificar && r.verificar.pendientes }]
    : pestanasDe(permisos);
  const guardada = state.tab && tabs.some(t => t.id === state.tab) ? state.tab : null;
  const tabInicial = (tabPedida && tabs.find(t => t.id === tabPedida)) || tabs.find(t => t.id === guardada) || tabs[0];
  const sesion = { tab: tabInicial, q: '', estado: tabInicial.estados || '', pagina: 1, items: [], hayMas: false, total: 0, resumen: null, cargando: false, vivo: true };

  const buscador = h('input', { type: 'search', class: 'inc-buscador', placeholder: 'Buscar por título o número INC-…', 'aria-label': 'Buscar incidencias', autocomplete: 'off' });
  const zonaTabs = h('div', { class: 'inc-tabs', role: 'tablist', 'aria-label': 'Listas de incidencias' });
  const zonaKpi = h('div', { class: 'inc-kpis' });
  const zonaFiltros = h('div', { class: 'inc-filtros' });
  const zonaLista = h('div', { class: 'inc-lista' });
  const subtitulo = h('p');
  const titulo = h('h1', { text: esVerificar ? 'Por verificar' : 'Mis incidencias' });

  // `silencioso`: un aviso en vivo actualiza la lista sin taparla con el «Cargando…» ni mover a quien la está leyendo.
  async function cargar({ reiniciar = true, silencioso = false } = {}) {
    if (sesion.cargando) return;
    sesion.cargando = true;
    if (reiniciar) { sesion.pagina = 1; if (!silencioso) montar(zonaLista, cargando('Cargando incidencias…')); }
    try {
      const [datos, res] = await Promise.all([
        listar({ vista: sesion.tab.vista, estado: sesion.estado, q: sesion.q, pagina: sesion.pagina, limite: 20 }),
        reiniciar || !sesion.resumen ? pedirResumen() : Promise.resolve(sesion.resumen)
      ]);
      if (!sesion.vivo) return;
      sesion.resumen = res;
      sesion.items = reiniciar ? datos.items : sesion.items.concat(datos.items);
      sesion.hayMas = datos.hayMas;
      sesion.total = datos.total;
      dibujar();
    } catch (error) {
      if (sesion.vivo) mostrarError(zonaLista, error, () => cargar());
    } finally {
      sesion.cargando = false;
    }
  }

  function dibujarTabs() {
    montar(zonaTabs, tabs.map(tab => {
      const n = sesion.resumen ? tab.conteo && tab.conteo(sesion.resumen) : null;
      return h('button', { class: `inc-tab${tab.id === sesion.tab.id ? ' inc-tab--activa' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(tab.id === sesion.tab.id),
        onclick: () => cambiarTab(tab) }, tab.etiqueta, n || n === 0 ? h('span', { class: 'inc-tab-numero', text: String(n) }) : null);
    }));
    zonaTabs.hidden = tabs.length < 2;
  }

  function cambiarTab(tab) {
    if (tab.id === sesion.tab.id) return;
    sesion.tab = tab; sesion.estado = tab.estados || ''; sesion.q = ''; buscador.value = '';
    state.tab = tab.id;
    try { sessionStorage.setItem('incidencias:tab', tab.id); } catch (e) { /* solo comodidad */ }
    cargar();
  }

  function dibujarFiltros() {
    const tab = sesion.tab;
    if (tab.filtroChips) {
      const opciones = [['', 'Todas'], ['abiertas', 'Abiertas'], ['en_verificacion', 'En verificación'], ['cerrada', 'Cerradas']];
      montar(zonaFiltros, h('div', { class: 'inc-chips-filtro', role: 'group', 'aria-label': 'Filtrar por estado' },
        opciones.map(([valor, texto]) => h('button', { class: `inc-filtro${sesion.estado === valor ? ' inc-filtro--activo' : ''}`, type: 'button', 'aria-pressed': String(sesion.estado === valor), onclick: () => { sesion.estado = valor; cargar(); } }, texto))), buscador);
    } else if (tab.filtroEstado) {
      const sel = h('select', { class: 'inc-select-filtro', 'aria-label': 'Filtrar por estado', onchange: () => { sesion.estado = sel.value; cargar(); } },
        ESTADOS_FILTRO.map(([valor, texto]) => h('option', { value: valor, text: texto, selected: valor === sesion.estado })));
      montar(zonaFiltros, sel, buscador);
    } else {
      montar(zonaFiltros, buscador);
    }
  }

  function dibujarKpis() {
    const tarjetas = sesion.resumen ? tarjetasDe(sesion.tab, sesion.resumen) : [];
    montar(zonaKpi, tarjetas.map(k => h('div', { class: `inc-kpi ${k.clase}`.trim() },
      h('span', { class: 'inc-kpi-titulo', text: k.titulo }), h('strong', { class: 'inc-kpi-valor', text: String(k.valor) }), h('span', { class: 'inc-kpi-nota', text: k.nota }))));
    zonaKpi.hidden = !tarjetas.length;
  }

  async function alTomar(item, boton) {
    boton.disabled = true;
    boton.replaceChildren(icono('sync-outline', 'spin-animation'), 'Tomando…');
    try {
      await tomar(item.id);
      window.toast && window.toast.success('Incidencia tomada', `${item.correlativo} ahora es tuya.`);
      window.location.hash = `#/incidencia/${item.id}`;
    } catch (error) {
      window.toast && window.toast.error('No se pudo tomar', error.message);
      cargar();
    }
  }

  const botonTomar = (item) => {
    const b = h('button', { class: 'btn btn--primary btn--sm inc-tomar', type: 'button', 'aria-label': `Tomar ${item.correlativo}` }, icono('play-outline'), 'Tomar');
    b.addEventListener('click', (e) => { e.stopPropagation(); alTomar(item, b); });
    return b;
  };
  const ubicacion = (i) => `${i.tienda.codigo}${i.zona ? ` · ${i.zona}` : ''}`;
  const abrir = (i) => { window.location.hash = `#/incidencia/${i.id}`; };
  const enBuzon = () => sesion.tab.id === 'buzon';
  const conTecnico = () => ['tiendas', 'todas'].includes(sesion.tab.id);

  function fila(i) {
    const celdas = [
      h('td', null, chipPrioridad(i.prioridad)),
      h('td', { class: 'inc-celda-titulo' }, h('strong', { text: i.titulo }), h('span', { class: 'inc-tenue', text: `${i.correlativo} · ${i.categoria}` })),
      h('td', { text: ubicacion(i) }),
      enBuzon()
        ? h('td', null, i.especialidad === 'tuya' ? chipTexto('Tu especialidad', 'inc-chip--exito') : chipTexto('Otra especialidad', 'inc-chip--neutro'))
        : h('td', null, h('div', { class: 'inc-fila-chips' }, chipEstado(i.estado, i.estadoEtiqueta), i.sinAvance ? chipTexto('Sin avance', 'inc-chip--alerta') : null)),
      conTecnico() ? h('td', { text: i.tecnico ? i.tecnico.nombre : '—' }) : null,
      h('td', { class: `inc-tiempo${enBuzon() && i.prioridad.orden <= 1 ? ' inc-tiempo--alerta' : ''}`, text: enBuzon() ? hace(i.creadaEn) : hace(i.actualizadaEn) }),
      h('td', { class: 'inc-celda-accion' }, enBuzon() ? botonTomar(i) : h('span', { class: 'inc-flecha', 'aria-hidden': 'true' }, icono('chevron-forward-outline')))
    ];
    const tr = h('tr', { class: `inc-fila${i.prioridad.orden <= 1 && ['en_buzon', 'en_proceso'].includes(i.estado) ? ' inc-fila--critica' : ''}`, tabindex: '0', role: 'link', 'aria-label': `${i.correlativo}: ${i.titulo}` }, celdas);
    tr.addEventListener('click', () => abrir(i));
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') abrir(i); });
    return tr;
  }

  function tarjeta(i) {
    const art = h('article', { class: `inc-tarjeta${i.prioridad.orden <= 1 && ['en_buzon', 'en_proceso'].includes(i.estado) ? ' inc-tarjeta--critica' : ''}`, tabindex: '0', role: 'link', 'aria-label': `${i.correlativo}: ${i.titulo}` },
      h('div', { class: 'inc-tarjeta-fila' }, chipPrioridad(i.prioridad), h('span', { class: 'inc-tiempo', text: enBuzon() ? `Llegó ${hace(i.creadaEn)}` : hace(i.actualizadaEn) })),
      h('strong', { class: 'inc-tarjeta-titulo', text: i.titulo }),
      h('span', { class: 'inc-tenue', text: `${i.correlativo} · ${ubicacion(i)}` }),
      h('div', { class: 'inc-fila-chips' },
        enBuzon() ? (i.especialidad === 'tuya' ? chipTexto('Tu especialidad', 'inc-chip--exito') : chipTexto('Otra especialidad', 'inc-chip--neutro')) : chipEstado(i.estado, i.estadoEtiqueta),
        i.sinAvance ? chipTexto('Sin avance', 'inc-chip--alerta') : null,
        conTecnico() && i.tecnico ? chipTexto(i.tecnico.nombre, 'inc-chip--neutro') : null),
      enBuzon() ? botonTomar(i) : null);
    art.addEventListener('click', () => abrir(i));
    art.addEventListener('keydown', (e) => { if (e.key === 'Enter') abrir(i); });
    return art;
  }

  function dibujarLista() {
    if (!sesion.items.length) {
      const [t, texto] = VACIO[sesion.tab.id] || ['No hay incidencias', null];
      const hayFiltro = sesion.q || (sesion.estado && sesion.estado !== (sesion.tab.estados || ''));
      montar(zonaLista, vacio({ icono: sesion.tab.id === 'reportadas' ? 'file-tray-outline' : 'checkmark-done-outline', titulo: hayFiltro ? 'No encontramos incidencias con ese filtro' : t, texto: hayFiltro ? 'Prueba con otra búsqueda o quita el filtro.' : texto,
        acciones: sesion.tab.id === 'reportadas' && !hayFiltro && permisos.includes('incidencias.reportar') ? [botonEnlace('Reportar incidencia', '#/reportar', true, 'add-outline')] : [] }));
      return;
    }
    const cabecera = ['Prioridad', 'Incidencia', 'Ubicación', enBuzon() ? 'Especialidad' : 'Estado', conTecnico() ? 'Técnico' : null, enBuzon() ? 'Llegó' : 'Actualizada', ''].filter(x => x !== null);
    const tabla = h('div', { class: 'inc-tabla-contenedor' }, h('table', { class: 'inc-tabla' },
      h('thead', null, h('tr', null, cabecera.map(c => h('th', { scope: 'col', text: c })))), h('tbody', null, sesion.items.map(fila))));
    const mas = sesion.hayMas ? h('button', { class: 'btn btn--ghost inc-cargar-mas', type: 'button', onclick: () => { sesion.pagina += 1; cargar({ reiniciar: false }); } }, `Cargar más (${sesion.items.length} de ${sesion.total})`) : null;
    montar(zonaLista, tabla, h('div', { class: 'inc-tarjetas' }, sesion.items.map(tarjeta)), mas,
      enBuzon() ? h('p', { class: 'inc-nota', text: 'Cada incidencia la atiende un solo técnico: quien la toma primero se queda con ella y queda anotado en el historial.' }) : null);
  }

  function dibujar() {
    subtitulo.textContent = esVerificar ? 'Incidencias resueltas que esperan tu aprobación.' : (SUBTITULO[sesion.tab.id] || '');
    dibujarTabs(); dibujarKpis(); dibujarFiltros(); dibujarLista();
  }

  buscador.addEventListener('input', sinRebote(() => { sesion.q = buscador.value.trim(); cargar(); }, 350));
  const encabezado = h('div', { class: 'inc-pagina-titulo' }, h('div', null, titulo, subtitulo),
    permisos.includes('incidencias.reportar') && !esVerificar ? botonEnlace('Reportar incidencia', '#/reportar', true, 'add-outline') : null);
  montar(cont, encabezado, zonaTabs, zonaKpi, zonaFiltros, zonaLista);
  subtitulo.textContent = esVerificar ? 'Incidencias resueltas que esperan tu aprobación.' : (SUBTITULO[sesion.tab.id] || '');
  dibujarTabs();
  dibujarFiltros();
  await cargar();
  return {
    liberar: () => { sesion.vivo = false; },
    refrescar: () => cargar({ reiniciar: true, silencioso: true })
  };
}
