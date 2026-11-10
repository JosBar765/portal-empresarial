// A10 · Historial de cambios: quién cambió qué, cuándo y cómo estaba antes. Restaurar crea un cambio nuevo.
import { h, icono, montar } from '../utils/dom.js';
import { fechaCorta, nombreCorto } from '../utils/formato.js';
import { cabecera, cargando, avisar, estadoVacio } from '../components/ui.js';
import { listarHistorial, restaurarCambio } from '../api/api.js';
import { confirmarModal } from '../components/modal.js';

const AREAS = [['', 'Todas'], ['parametros', 'Parámetros'], ['reglas', 'Reglas'], ['catalogos', 'Catálogos'], ['paises', 'Países'], ['campos', 'Campos propios'], ['alcance', 'Alcance de usuarios'], ['plantillas', 'Plantillas de proyecto'], ['avisos', 'Notificaciones'], ['kits', 'Kit del nicho']];
const FECHAS = [['todo', 'Todo el historial'], ['hoy', 'Hoy'], ['7', 'Últimos 7 días'], ['30', 'Últimos 30 días'], ['mes', 'Este mes']];

const aISO = (fecha) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;

function rangoDeFechas(opcion, hoy = new Date()) {
  const dias = (n) => { const d = new Date(hoy); d.setDate(d.getDate() - n); return aISO(d); };
  if (opcion === 'hoy') return { desde: aISO(hoy), hasta: aISO(hoy) };
  if (opcion === '7') return { desde: dias(7), hasta: aISO(hoy) };
  if (opcion === '30') return { desde: dias(30), hasta: aISO(hoy) };
  if (opcion === 'mes') return { desde: aISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: aISO(hoy) };
  return {};
}

function selector(etiqueta, opciones, valor, alCambiar) {
  const select = h('select', { id: `filtro-${etiqueta}` }, opciones.map(([v, t]) => h('option', { value: v, text: t })));
  select.value = valor;
  select.addEventListener('change', () => alCambiar(select.value));
  return h('div', { class: 'campo' }, h('label', { for: select.id, text: etiqueta }), select);
}

// Una línea por campo cambiado; si el cambio es un solo valor, solo el valor.
function lineas(cambios, cual) {
  const unico = cambios.length === 1 && cambios[0].campo === 'Valor';
  return cambios.map(c => h('div', { class: 'cambio-linea', text: unico ? c[cual] : `${c.campo}: ${c[cual]}` }));
}

export async function renderHistorial(cont) {
  montar(cont, cargando());
  const filtros = { area: '', usuario: '', fecha: '30' };
  let items = [];
  let total = 0;
  let pagina = 1;
  let hayMas = false;
  let personas = [];

  const zonaFiltros = h('div', { class: 'filtros' });
  const zonaTabla = h('div');

  async function cargar({ anexar = false } = {}) {
    const respuesta = await listarHistorial({ area: filtros.area, usuario: filtros.usuario, ...rangoDeFechas(filtros.fecha), pagina: anexar ? pagina + 1 : 1 });
    pagina = respuesta.pagina;
    items = anexar ? [...items, ...respuesta.items] : respuesta.items;
    total = respuesta.total;
    hayMas = respuesta.hayMas;
    personas = respuesta.personas;
  }

  async function aplicarFiltros() {
    try { await cargar(); } catch (error) { avisar('error', 'No se pudo cargar el historial', error.message); }
    dibujarTabla();
  }

  function dibujarFiltros() {
    montar(zonaFiltros,
      selector('Área', AREAS, filtros.area, (v) => { filtros.area = v; aplicarFiltros(); }),
      selector('Persona', [['', 'Todas'], ...personas.map(p => [String(p.id), nombreCorto(p.nombre)])], filtros.usuario, (v) => { filtros.usuario = v; aplicarFiltros(); }),
      selector('Fechas', FECHAS, filtros.fecha, (v) => { filtros.fecha = v; aplicarFiltros(); }),
      h('button', {
        class: 'btn btn--ghost filtros-fin', type: 'button', text: 'Quitar filtros',
        onclick: () => { Object.assign(filtros, { area: '', usuario: '', fecha: 'todo' }); aplicarFiltros().then(dibujarFiltros); }
      }));
  }

  async function restaurar(item) {
    const primero = item.cambios[0];
    const aceptar = await confirmarModal({
      title: 'Restaurar este valor',
      mensaje: `Volverá a «${primero.antes}» en «${item.objeto}». Queda registrado como un cambio nuevo.`,
      aceptar: 'Restaurar'
    });
    if (!aceptar) return;
    try {
      await restaurarCambio(item.id);
      avisar('success', 'Valor restaurado', `${item.objeto} volvió a «${primero.antes}».`);
      await cargar();
      dibujarFiltros();
    } catch (error) {
      avisar(error.status === 409 ? 'warning' : 'error', 'No se pudo restaurar', error.message);
    }
    dibujarTabla();
  }

  function fila(item) {
    return h('tr', null,
      h('td', { class: 'cambio-cuando', text: fechaCorta(item.fecha) }),
      h('td', { text: nombreCorto(item.usuario) }),
      h('td', { class: 'cambio-cuando', text: item.area }),
      h('td', { class: 'cambio-ajuste', text: item.accionCodigo === 'crear' ? `Nuevo: ${item.objeto}` : item.objeto }),
      h('td', { class: 'cambio-valor-antes' }, item.cambios.length ? lineas(item.cambios, 'antes') : '—'),
      h('td', { class: 'cambio-valor-despues' }, item.cambios.length ? lineas(item.cambios, 'despues') : 'Nuevo'),
      h('td', null, item.restaurable
        ? h('button', { class: 'boton-restaurar', type: 'button', onclick: () => restaurar(item) }, icono('refresh-outline'), 'Restaurar')
        : null));
  }

  function dibujarTabla() {
    if (!items.length) {
      montar(zonaTabla, estadoVacio('No hay cambios con esos filtros', 'Prueba con otra fecha o quita los filtros.', 'time-outline'));
      return;
    }
    montar(zonaTabla, h('div', { class: 'tabla-caja' },
      h('div', { class: 'tabla-scroll' },
        h('table', { class: 'data-table' },
          h('thead', null, h('tr', null, ['Fecha', 'Persona', 'Área', 'Ajuste', 'Antes', 'Después', ''].map(t => h('th', { text: t })))),
          h('tbody', null, items.map(fila)))),
      h('div', { class: 'tabla-pie' },
        h('span', { text: `Mostrando ${items.length} de ${total} ${total === 1 ? 'cambio' : 'cambios'} · restaurar crea un cambio nuevo` }),
        hayMas ? h('button', {
          class: 'btn btn--ghost btn--sm', type: 'button', text: 'Ver más',
          onclick: async () => { try { await cargar({ anexar: true }); } catch (error) { avisar('error', 'No se pudo cargar más', error.message); } dibujarTabla(); }
        }) : null)));
  }

  await cargar();
  montar(cont,
    cabecera({ titulo: 'Historial de cambios', subtitulo: 'Quién cambió qué, cuándo y cómo estaba antes. Se puede restaurar.' }),
    zonaFiltros, zonaTabla);
  dibujarFiltros();
  dibujarTabla();
}
