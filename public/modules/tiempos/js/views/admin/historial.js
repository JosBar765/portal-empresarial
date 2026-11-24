// public/modules/tiempos/js/views/admin/historial.js
// Historial de versiones: qué cambió en cada una, quién publicó, reutilizar una anterior como borrador y descartar el borrador.
import { h, icono, montar } from '../../utils/dom.js';
import { confirmar, cargando, ventana, campo, pie } from '../../components/ui.js';
import { adminVersiones, adminCambiosDeVersion, adminUsarComoBorrador, adminDescartar, adminActividad, adminCambios, adminPublicar } from '../../api/tiemposApi.js';
import { hoyISO } from '../../utils/formato.js';

const ETIQUETA_ESTADO = { borrador: ['Borrador', 'tm-chip--ambar'], publicada: ['En uso', 'tm-chip--verde'], reemplazada: ['Reemplazada', 'tm-chip--gris'] };
const ACCION = { crear: 'creó el borrador', editar: 'guardó cambios', publicar: 'publicó', descartar: 'descartó el borrador', carga_inicial: 'cargó la tabla inicial' };
const ENTIDAD = { producto: 'de un producto', extras: 'de los extras', avisos: 'de los avisos', catalogos: 'de etapas y líneas', version: '' };
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export async function mostrarHistorial(cont) {
  montar(cont, cargando('Cargando el historial…'));
  let [{ versiones }, { actividad }] = await Promise.all([adminVersiones(), adminActividad()]);
  let seleccion = (versiones.find(v => v.estado === 'borrador') || versiones[0] || {}).id;
  const refs = { lista: h('section', { class: 'tm-card tm-historial-lista' }), detalle: h('section', { class: 'tm-card tm-historial-detalle' }), actividad: h('section', { class: 'tm-card' }) };
  const hayBorrador = () => versiones.some(v => v.estado === 'borrador');

  async function recargar() {
    [{ versiones }, { actividad }] = await Promise.all([adminVersiones(), adminActividad()]);
    if (!versiones.some(v => v.id === seleccion)) seleccion = (versiones[0] || {}).id;
    pintar();
  }

  async function pintarDetalle() {
    const v = versiones.find(x => x.id === seleccion);
    if (!v) { montar(refs.detalle, h('p', { class: 'tm-tenue', text: 'Todavía no hay versiones.' })); return; }
    montar(refs.detalle, cargando('Buscando los cambios…'));
    let cambios = [];
    try { cambios = (await adminCambiosDeVersion(v.id)).cambios; } catch (e) { montar(refs.detalle, h('p', { class: 'tm-pie tm-pie--error', text: e.message })); return; }
    const acciones = [];
    if (v.estado === 'borrador') {
      acciones.push(h('button', { class: 'btn btn--ghost', type: 'button', onclick: descartar }, 'Descartar borrador'));
      acciones.push(h('button', { class: 'btn btn--primary', type: 'button', onclick: publicar }, 'Publicar esta versión'));
    } else if (v.estado === 'reemplazada' && !hayBorrador()) acciones.push(h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => usar(v) }, 'Usar como borrador'));
    montar(refs.detalle,
      h('h2', { class: 'tm-card-titulo', text: `Cambios de la versión ${v.numero}${v.estado === 'borrador' ? ' (borrador)' : ''}` }),
      cambios.length ? h('ul', { class: 'tm-cambios' }, cambios.map(c => h('li', null, h('strong', { text: c.objeto }), h('span', { text: c.detalle })))) : h('p', { class: 'tm-tenue', text: 'No hay cambios respecto a la versión publicada.' }),
      h('div', { class: 'tm-acciones' }, acciones));
  }

  async function descartar() {
    const v = versiones.find(x => x.estado === 'borrador');
    const ok = await confirmar({ titulo: '¿Descartar el borrador?', texto: `Se pierden todos los cambios de la versión ${v.numero} y la tabla vuelve a la versión en uso.`, aceptar: 'Descartar borrador', peligro: true });
    if (!ok) return;
    try { await adminDescartar(); if (window.toast) window.toast.success('Borrador descartado', 'La versión en uso no cambió.'); await recargar(); } catch (e) { if (window.toast) window.toast.error('No se pudo descartar', e.message); }
  }

  async function usar(v) {
    const ok = await confirmar({ titulo: `¿Usar la versión ${v.numero} como borrador?`, texto: 'Se crea un borrador con esos tiempos. Los usuarios no ven nada hasta que lo publiques.', aceptar: 'Crear borrador' });
    if (!ok) return;
    try { await adminUsarComoBorrador(v.id); window.location.hash = '#/administracion'; } catch (e) { if (window.toast) window.toast.error('No se pudo crear el borrador', e.message); }
  }

  async function publicar() {
    const b = versiones.find(x => x.estado === 'borrador');
    const cambios = (await adminCambios()).cambios;
    const numero = h('input', { type: 'text', id: 'hp-numero', value: b.numero, maxlength: 20 });
    const fecha = h('input', { type: 'date', id: 'hp-fecha', value: hoyISO() });
    const nota = h('input', { type: 'text', id: 'hp-nota', maxlength: 255, placeholder: 'Ej. Ajuste de fundición y lanyard' });
    ventana({
      titulo: `Publicar la versión ${b.numero}`, subtitulo: 'Al publicar, todos verán estos tiempos en la calculadora y en la tabla de referencia.', aceptar: 'Publicar versión',
      contenido: h('div', { class: 'tm-form' }, h('div', { class: 'tm-fila-2' }, campo('Número de versión', numero, pie(`Sugerido: ${b.numero}`)), campo('Fecha de la versión', fecha)), campo('¿Qué cambió? (para el historial)', nota),
        h('div', { class: 'tm-nota' }, h('strong', { text: plural(cambios.length, 'cambio se publicará', 'cambios se publicarán') }))),
      alAceptar: async () => {
        try { const r = await adminPublicar({ numero: numero.value, fecha: fecha.value, nota: nota.value }); if (window.toast) window.toast.success('Versión publicada', `La versión ${r.numero} ya está en uso.`); seleccion = null; await recargar(); }
        catch (error) { throw new Error(error.campos ? Object.values(error.campos)[0] : error.message); }
      }
    });
  }

  function pintar() {
    montar(refs.lista, h('h2', { class: 'tm-card-titulo', text: 'Versiones' }),
      versiones.map(v => { const [txt, cls] = ETIQUETA_ESTADO[v.estado]; return h('button', { class: `tm-version-fila${v.id === seleccion ? ' tm-version-fila--activa' : ''}`, type: 'button', onclick: () => { seleccion = v.id; pintar(); } },
        h('span', { class: 'tm-version-cab' }, h('strong', { text: `Versión ${v.numero}` }), h('span', { class: `tm-chip ${cls}`, text: txt })),
        h('span', { class: 'tm-tenue', text: v.estado === 'borrador' ? `Borrador · ${v.creadaEn.slice(0, 10).split('-').reverse().join('/')} · ${v.creadaPorNombre || 'Administrador'}` : `${v.fecha.split('-').reverse().join('/')} · ${v.publicadaPorNombre || 'Carga inicial'}` }),
        v.nota ? h('span', { class: 'tm-version-nota', text: v.nota }) : null); }));
    pintarDetalle();
    montar(refs.actividad, h('h2', { class: 'tm-card-titulo', text: 'Actividad reciente' }),
      actividad.length ? h('ul', { class: 'tm-actividad' }, actividad.map(a => h('li', null, h('strong', { text: a.usuario || 'El sistema' }), ` ${ACCION[a.accion] || a.accion} ${ENTIDAD[a.entidad] || ''}`.trimEnd(), h('span', { class: 'tm-tenue', text: ` · ${a.cuando.split(' ')[0].split('-').reverse().join('/')} ${a.cuando.split(' ')[1]}` })))) : h('p', { class: 'tm-tenue', text: 'Todavía no hay actividad.' }));
  }

  pintar();
  montar(cont,
    h('div', { class: 'tm-titulo' }, h('div', null, h('h1', { text: 'Historial de versiones' }), h('p', { text: 'Cada vez que publicas, se guarda una versión. Puedes ver qué cambió y volver a usarla como borrador.' })),
      h('a', { class: 'btn btn--ghost', href: '#/administracion' }, icono('chevron-back-outline'), 'Volver a las tablas')),
    h('div', { class: 'tm-historial' }, refs.lista, refs.detalle), refs.actividad);
  return {};
}
