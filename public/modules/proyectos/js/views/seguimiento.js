// Seguimiento del supervisor (S6 por asesor, S14 por tienda, S15 estancados) y la ventana de reasignar (S7).
// Rutas: #/seguimiento y #/seguimiento/<proyectoId>. Lo de otras tiendas llega enmascarado del servidor: aquí solo se pinta con candado.
import { h, icono, montar } from '../utils/dom.js';
import { pluralizar } from '../utils/formato.js';
import { cabecera, aviso, cargando, estadoVacio, avisar } from '../components/ui.js';
import { modalFormulario } from '../components/modalFormulario.js';
import { campoArea } from '../components/campos.js';
import {
  listarProyectosEnSeguimiento, obtenerSeguimiento, obtenerSeguimientoPorAsesor, obtenerSeguimientoPorTienda, obtenerEstancados,
  obtenerDestinosDeReasignacion, reasignarEmpresas
} from '../api/api.js';
import { chipGestion, nombreDelMes, diaCorto } from '../utils/gestion.js';

const ETIQUETA_SEMAFORO = { verde: 'Verde', ambar: 'Ámbar', rojo: 'Rojo' };
const iniciales = (nombre) => String(nombre || '').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '··';
const claveNueva = () => (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID().replace(/-/g, '') : `${Date.now()}${Math.random().toString(36).slice(2)}`).slice(0, 40);
const chipSemaforo = (s) => (s ? h('span', { class: `chip-semaforo chip-semaforo--${s}`, text: ETIQUETA_SEMAFORO[s] }) : null);
const candado = (texto) => h('span', { class: 'texto-candado' }, icono('lock-closed-outline'), texto);

let pestanaRecordada = 'asesores';

// Barra de gestionadas: el color sigue al semáforo.
function barra(gestionadas, asignadas, semaforo) {
  const pct = asignadas ? Math.round((gestionadas / asignadas) * 100) : 0;
  return h('div', { class: 'barra-avance' },
    h('span', { class: `barra-avance-pista${semaforo ? '' : ' barra-avance-pista--gris'}` }, h('span', { class: `barra-avance-relleno barra-avance-relleno--${semaforo || 'gris'}`, style: `width:${pct}%` })),
    h('span', { class: 'barra-avance-valor', text: String(gestionadas) }));
}

export async function renderSeguimiento(cont, parametro) {
  montar(cont, cargando());
  const { proyectos } = await listarProyectosEnSeguimiento();
  const id = parametro && proyectos.some(p => String(p.id) === String(parametro)) ? Number(parametro) : (proyectos[0] && proyectos[0].id);
  if (!id) {
    montar(cont, cabecera({ titulo: 'Seguimiento', subtitulo: 'El avance de tus proyectos activos.' }),
      estadoVacio('No hay proyectos activos en tus tiendas', 'Cuando actives un proyecto, aquí verás cómo avanza cada asesor y cada tienda.', 'trending-up-outline'));
    return;
  }
  const [resumen, asesores, tiendas, estancados] = await Promise.all([obtenerSeguimiento(id), obtenerSeguimientoPorAsesor(id), obtenerSeguimientoPorTienda(id), obtenerEstancados(id, false)]);
  const datos = { resumen, asesores: asesores.asesores, tiendas: tiendas.tiendas, estancados };
  const seleccion = new Set();
  const zona = h('div');

  async function recargar() {
    const [r, a, t, e] = await Promise.all([obtenerSeguimiento(id), obtenerSeguimientoPorAsesor(id), obtenerSeguimientoPorTienda(id), obtenerEstancados(id, datos.estancados.mostrando > 7)]);
    Object.assign(datos, { resumen: r, asesores: a.asesores, tiendas: t.tiendas, estancados: e });
    seleccion.clear();
    dibujar();
  }

  const reasignar = (opciones) => abrirReasignar({ proyectoId: id, ...opciones, alTerminar: recargar });

  function tablaAsesores() {
    const puede = datos.resumen.permisos.reasignar;
    return h('div', { class: 'tabla-caja' }, h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table tabla-seguimiento' },
      h('thead', null, h('tr', null, ['Asesor', 'Asig.', 'Gestionadas', 'Interes.', 'Cotiz.', 'Vendidas', 'Reacción', 'Semáforo', ''].map((t, i) => h('th', { class: i > 0 && i < 8 && i !== 2 ? 'num' : null, text: t })))),
      h('tbody', null, datos.asesores.map(a => h('tr', { class: a.otraTienda ? 'fila-otra-tienda' : null },
        h('td', null, h('div', { class: 'celda-persona' }, h('span', { class: 'avatar-contacto', text: iniciales(a.nombre) }), h('div', null, h('strong', { text: a.nombre }), h('div', { class: 'texto-tenue', text: a.otraTienda ? `Otra tienda · ${a.empresa}` : a.empresa })))),
        h('td', { class: 'num', text: String(a.asignadas) }),
        h('td', null, barra(a.gestionadas, a.asignadas, a.semaforo)),
        ...(a.otraTienda ? [h('td', { class: 'num texto-tenue', text: '—' }), h('td', { class: 'num texto-tenue', text: '—' }), h('td', { class: 'num texto-tenue', text: '—' }), h('td', { class: 'num texto-tenue', text: '—' }), h('td', { class: 'texto-tenue', text: '—' })]
          : [h('td', { class: 'num', text: String(a.interesadas) }), h('td', { class: 'num', text: String(a.cotizadas) }), h('td', { class: 'num', text: String(a.vendidas) }),
            h('td', { class: `num${a.yaGestiono ? '' : ' texto-rojo'}`, title: a.yaGestiono ? 'Días entre la asignación y la primera gestión' : 'Todavía no registra ninguna gestión', text: `${a.reaccionDias} d` }), h('td', null, chipSemaforo(a.semaforo))]),
        h('td', { class: 'acciones-fila' }, a.otraTienda ? candado('Solo lectura')
          : puede ? h('button', { class: 'btn btn--ghost btn--chico', type: 'button', onclick: () => reasignar({ asesor: a }) }, icono('swap-horizontal-outline'), 'Reasignar') : null)))))));
  }

  function tablaTiendas() {
    return h('div', { class: 'tabla-caja' }, h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table tabla-seguimiento' },
      h('thead', null, h('tr', null, ['Tienda', 'Asesores', 'Asignadas', 'Gestionadas', 'Interesadas', 'Cotizadas', 'Vendidas', 'Semáforo'].map((t, i) => h('th', { class: i > 0 && i !== 3 && i !== 7 ? 'num' : null, text: t })))),
      h('tbody', null, datos.tiendas.map(t => h('tr', null,
        h('td', null, h('strong', { text: t.empresa }), h('div', { class: 'texto-tenue', text: t.tienda })),
        h('td', { class: 'num', text: String(t.asesores) }), h('td', { class: 'num', text: String(t.asignadas) }),
        h('td', null, h('div', { class: 'barra-avance' }, h('span', { class: 'barra-avance-pista' }, h('span', { class: `barra-avance-relleno barra-avance-relleno--${t.semaforo}`, style: `width:${t.coberturaPorcentaje}%` })), h('span', { class: 'barra-avance-valor', text: `${t.gestionadas} (${t.coberturaPorcentaje} %)` }))),
        h('td', { class: 'num', text: String(t.interesadas) }), h('td', { class: 'num', text: String(t.cotizadas) }), h('td', { class: 'num', text: String(t.vendidas) }), h('td', null, chipSemaforo(t.semaforo))))))));
  }

  function vistaEstancados() {
    const e = datos.estancados;
    const puede = datos.resumen.permisos.reasignar;
    const dias = e.diasEstancado;
    if (!e.total) return estadoVacio('Nada estancado', `Ninguna empresa lleva ${dias} días o más sin gestión.`, 'checkmark-circle-outline');
    const todas = e.empresas.filter(x => !x.otraTienda);
    return [
      aviso({ tipo: 'advertencia', titulo: `${pluralizar(e.total, 'empresa lleva', 'empresas llevan')} ${dias} días o más sin gestión`, texto: 'Reasígnalas a otro asesor o pídele al asesor que las retome. Solo puedes reasignar las de tus tiendas.' }),
      h('div', { class: 'tabla-caja' }, h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table tabla-seguimiento' },
        h('thead', null, h('tr', null, [h('th', { class: 'celda-casilla' }, puede ? (() => { const c = h('input', { type: 'checkbox', 'aria-label': 'Elegir todas' }); c.checked = todas.length > 0 && todas.every(x => seleccion.has(x.id)); c.addEventListener('change', () => { todas.forEach(x => (c.checked ? seleccion.add(x.id) : seleccion.delete(x.id))); dibujar(); }); return c; })() : null), ...['Empresa', 'Asesor', 'Tienda', 'Última gestión', 'Estado', ''].map(t => h('th', { text: t }))])),
        h('tbody', null, e.empresas.map(x => h('tr', { class: x.otraTienda ? 'fila-otra-tienda' : null },
          h('td', { class: 'celda-casilla' }, puede && !x.otraTienda ? (() => { const c = h('input', { type: 'checkbox', 'aria-label': `Elegir ${x.empresa}` }); c.checked = seleccion.has(x.id); c.addEventListener('change', () => { c.checked ? seleccion.add(x.id) : seleccion.delete(x.id); dibujar(); }); return c; })() : null),
          h('td', null, h('a', { class: 'cliente-enlace', href: `#/participacion/${x.id}`, text: x.empresa })),
          h('td', { text: x.asesor }), h('td', { class: 'texto-tenue', text: x.tienda }),
          h('td', { class: x.diasSinGestion >= dias + 3 ? 'texto-rojo' : null, text: x.ultimaGestion || x.diasSinGestion ? `hace ${pluralizar(x.diasSinGestion, 'día', 'días')}` : 'sin gestión' }),
          h('td', null, chipGestion(x.estado)),
          h('td', { class: 'acciones-fila' }, x.otraTienda ? candado('Solo lectura') : puede ? h('button', { class: 'btn-enlace', type: 'button', onclick: () => reasignar({ empresas: [x] }) }, icono('swap-horizontal-outline'), 'Reasignar') : null))))))),
      h('div', { class: 'pie-estancados' },
        h('span', { class: 'texto-tenue', text: `Mostrando ${e.mostrando} de ${e.total} estancadas · de la más antigua a la más reciente` }),
        e.mostrando < e.total ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: async () => { datos.estancados = await obtenerEstancados(id, true); dibujar(); } }, `Ver las ${e.total}`) : null)
    ];
  }

  function dibujar() {
    const { resumen: r } = datos;
    const cifra = (valor, texto, clase) => h('div', { class: 'cifra' }, h('div', { class: `cifra-valor${clase ? ` ${clase}` : ''}`, text: String(valor) }), h('div', { class: 'cifra-texto', text: texto }));
    const pestana = (clave, titulo, n) => h('button', { class: `pestana${pestanaRecordada === clave ? ' pestana-activa' : ''}`, type: 'button', role: 'tab', onclick: () => { pestanaRecordada = clave; dibujar(); } }, titulo, n === null ? null : h('span', { class: 'pestana-cuenta', text: String(n) }));
    const seleccionables = seleccion.size;
    montar(zona,
      h('div', { class: 'pagina-cabecera' },
        h('div', null,
          h('div', { class: 'mi-proyecto-titulo' }, h('h1', { class: 'pagina-titulo', text: 'Seguimiento' }), h('span', { class: 'chip-estado chip-estado--activa', text: 'Activo' })),
          h('p', { class: 'pagina-subtitulo', text: `${r.proyecto.nicho} · ${nombreDelMes(r.proyecto.anio, r.proyecto.mes)}${r.etapa ? ` · Etapa: ${r.etapa.nombre} (${diaCorto(r.etapa.fechaInicio)}–${diaCorto(r.etapa.fechaFin)})` : ''} · Cobertura: ${ETIQUETA_SEMAFORO[r.cobertura.semaforo].toLowerCase()}` })),
        proyectos.length > 1 ? (() => {
          const s = h('select', { 'aria-label': 'Proyecto' }, proyectos.map(p => h('option', { value: String(p.id), text: p.nombre })));
          s.value = String(id);
          s.addEventListener('change', () => { window.location.hash = `#/seguimiento/${s.value}`; });
          return s;
        })() : null,
        pestanaRecordada === 'estancados' && r.permisos.reasignar ? h('button', { class: 'btn btn--primary', type: 'button', disabled: seleccionables ? null : '', onclick: () => reasignar({ empresas: datos.estancados.empresas.filter(x => seleccion.has(x.id)) }) }, icono('swap-horizontal-outline'), seleccionables ? `Reasignar seleccionadas (${seleccionables})` : 'Reasignar seleccionadas') : null),
      h('div', { class: 'cifras-asesor' },
        cifra(r.cifras.asignadas, 'Asignadas'), cifra(r.cifras.gestionadas, 'Gestionadas'), cifra(r.cifras.interesadas, 'Interesadas'), cifra(r.cifras.cotizadas, 'Cotizadas'),
        cifra(r.cifras.vendidas, 'Vendidas', 'cifra-valor--verde'), cifra(`${r.cifras.efectividad} %`, 'Efectividad', r.cifras.efectividad < 50 ? 'cifra-valor--ambar' : '')),
      h('div', { class: 'pestanas', role: 'tablist' }, pestana('asesores', 'Por asesor', r.conteos.asesores), pestana('tiendas', 'Por tienda', r.conteos.tiendas), pestana('estancados', 'Estancados', datos.estancados.total)),
      pestanaRecordada === 'asesores' ? tablaAsesores() : pestanaRecordada === 'tiendas' ? tablaTiendas() : vistaEstancados());
  }

  montar(cont, zona);
  dibujar();
}

// --- Reasignar (S7) ---
// `asesor`: todas las pendientes de ese asesor · `empresas`: las empresas elegidas (una o varias).
export async function abrirReasignar({ proyectoId, asesor = null, empresas = null, alTerminar }) {
  const { destinos } = await obtenerDestinosDeReasignacion(proyectoId);
  const masiva = Boolean(asesor);
  const base = masiva ? { deAsesorId: asesor.asesorId, todasLasPendientes: true } : { empresaIds: empresas.map(e => e.id) };
  const valores = { destino: 'equitativo', motivo: '' };
  const errores = {};
  const clave = claveNueva();
  let vista = null;
  const nodo = h('form', { class: 'formulario-modal', novalidate: '' });
  const posibles = destinos.filter(d => !masiva || d.asesorId !== asesor.asesorId);

  async function pedirVista() {
    try { vista = await reasignarEmpresas(proyectoId, { ...base, aAsesorId: valores.destino === 'equitativo' ? 'equitativo' : Number(valores.destino), soloVistaPrevia: true }); errores.destino = ''; } catch (error) { vista = null; errores.destino = error.message; }
    dibujar();
  }

  let botonAceptar = null;
  function dibujar() {
    const total = vista ? vista.total : (masiva ? null : empresas.length);
    if (botonAceptar) botonAceptar.textContent = total ? `Reasignar ${pluralizar(total, 'empresa', 'empresas')}` : 'Reasignar';
    const titulo = masiva ? `Todas las pendientes de ${asesor.nombre}${total !== null ? ` · ${pluralizar(total, 'empresa', 'empresas')}` : ''}` : empresas.length === 1 ? 'Una empresa' : `${empresas.length} empresas elegidas`;
    const sub = masiva ? 'Las que no tienen resultado todavía' : empresas.length === 1 ? empresas[0].empresa : empresas.slice(0, 3).map(e => e.empresa).join(', ') + (empresas.length > 3 ? '…' : '');
    const destino = h('select', { id: 'reasignar-destino', 'aria-label': 'Destino' }, h('option', { value: 'equitativo', text: 'Repartir equitativamente entre los asesores de la tienda' }), posibles.map(d => h('option', { value: String(d.asesorId), text: `${d.nombre} · ${d.tienda}` })));
    destino.value = valores.destino;
    destino.addEventListener('change', () => { valores.destino = destino.value; pedirVista(); });
    montar(nodo,
      h('p', { class: 'hoja-subtitulo', text: masiva ? `De ${asesor.nombre} · ${asesor.empresa}` : 'Las empresas se pasan con su historial y su estado.' }),
      h('div', { class: 'opcion-radio opcion-radio--activa' }, h('span', { class: 'opcion-radio-punto' }), h('div', null, h('strong', { text: titulo }), h('div', { class: 'texto-tenue', text: sub }))),
      h('div', { class: 'campo' }, h('label', { for: 'reasignar-destino', text: 'Destino (solo asesores de tus tiendas)' }), destino,
        errores.destino ? h('div', { class: 'campo-mensaje campo-mensaje--error' }, icono('alert-circle-outline'), h('span', { text: errores.destino })) : null),
      vista && vista.porAsesor.length ? h('div', { class: 'vista-reparto' }, vista.porAsesor.map(p => h('span', { class: 'vista-reparto-item' }, h('span', { class: 'avatar-contacto', text: iniciales(p.nombre) }), `${p.nombre} recibe +${p.recibe}`))) : null,
      campoArea({ valores, errores, clave: 'motivo', etiqueta: 'Motivo (obligatorio)', maximo: 255, prefijoId: 'reasignar', ayuda: 'Queda en el historial con el motivo. Se avisa a quien recibe y a quien cede.' }));
  }
  dibujar();
  pedirVista();

  const { overlay } = modalFormulario({
    title: 'Reasignar empresas', nodo, aceptar: 'Reasignar',
    enviar: async () => {
      if (!String(valores.motivo).trim()) { errores.motivo = 'Cuenta el motivo: queda en el historial.'; dibujar(); throw Object.assign(new Error('Revisa los datos.'), { campos: { motivo: errores.motivo } }); }
      const r = await reasignarEmpresas(proyectoId, { ...base, aAsesorId: valores.destino === 'equitativo' ? 'equitativo' : Number(valores.destino), motivo: valores.motivo, idempotencyKey: clave });
      avisar('success', 'Empresas reasignadas', pluralizar(r.reasignadas, 'empresa', 'empresas'));
      await alTerminar();
    },
    alError: (error) => { if (error.campos) { Object.assign(errores, error.campos); dibujar(); } else avisar('error', 'No se pudo reasignar', error.message); }
  });
  overlay.classList.add('hoja');
  botonAceptar = overlay.querySelector('[data-accion="aceptar"]');
  dibujar();
}
