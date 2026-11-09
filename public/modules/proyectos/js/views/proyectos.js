// Proyectos del mes: la lista (S1) con sus borradores (S17), el detalle de un proyecto (incluido «Esperando aprobación», T12)
// y el asistente de creación. Rutas: #/proyectos, #/proyectos/nuevo, #/proyectos/<id> y #/proyectos/<id>/editar.
import { h, icono, montar } from '../utils/dom.js';
import { hace, fechaCorta, pluralizar } from '../utils/formato.js';
import { cabecera, aviso, cargando, estadoVacio, avisar } from '../components/ui.js';
import { modalFormulario } from '../components/modalFormulario.js';
import { campoArea } from '../components/campos.js';
import { listarProyectos, obtenerProyecto, cancelarProyecto } from '../api/api.js';
import { renderAsistente } from './proyectoAsistente.js';
import { state } from '../state.js';

const FILTROS = [['todos', 'Todos'], ['activos', 'Activos'], ['vencidos', 'Vencidos'], ['cerrados', 'Cerrados'], ['borradores', 'Borradores']];
const ETIQUETA_ESTADO = { borrador: 'Borrador', pendiente_aprobacion: 'Esperando aprobación', activo: 'Activo', cerrado: 'Cerrado', cancelado: 'Cancelado' };
const CLASE_ESTADO = { borrador: '', pendiente_aprobacion: 'chip-estado--inactiva', activo: 'chip-estado--activa', cerrado: '', cancelado: '', vencido: 'chip-estado--no_contactar' };
const fechaLarga = (f) => (f ? fechaCorta(`${f} 00:00`).split(' · ')[0] : '—');

let filtroRecordado = 'todos';
let pestanaRecordada = 'proyectos';

export function renderProyectos(cont, parametro) {
  if (!parametro) return renderLista(cont);
  if (parametro === 'nuevo') return renderAsistente(cont, null);
  const [id, accion] = parametro.split('/');
  if (accion === 'editar') return renderAsistente(cont, id);
  return renderDetalle(cont, id);
}

const chipDe = (p) => h('span', { class: `chip-estado ${CLASE_ESTADO[p.vencido ? 'vencido' : p.estado]}`, text: p.vencido ? 'Vencido' : ETIQUETA_ESTADO[p.estado] });

// Pide el motivo y cancela. Un proyecto activo lo exige; un borrador, no.
function cancelar(p, alTerminar) {
  const valores = { motivo: '' };
  const errores = {};
  const nodo = h('form', { class: 'formulario-modal', novalidate: '' });
  const dibujar = () => montar(nodo,
    h('p', { class: 'panel-descripcion', text: p.estado === 'activo' ? `«${p.nombre}» se cancela: sus tiendas y sus empresas quedan libres para otro proyecto. Lo ya registrado se conserva.` : `«${p.nombre}» se descarta. No había repartido nada.` }),
    campoArea({ valores, errores, clave: 'motivo', etiqueta: p.estado === 'activo' ? 'Motivo de la cancelación *' : 'Motivo (opcional)', maximo: 255, prefijoId: 'cancelar' }));
  dibujar();
  modalFormulario({
    title: p.estado === 'activo' ? 'Cancelar el proyecto' : 'Descartar el borrador', nodo, aceptar: p.estado === 'activo' ? 'Cancelar proyecto' : 'Descartar', peligro: true,
    enviar: async () => { await cancelarProyecto(p.id, valores.motivo); avisar('success', p.estado === 'activo' ? 'Proyecto cancelado' : 'Borrador descartado', p.nombre); await alTerminar(); },
    alError: (error) => { if (error.campos) { Object.assign(errores, error.campos); dibujar(); } else avisar('error', 'No se pudo cancelar', error.message); }
  });
}

// --- Lista (S1) y borradores (S17) ---

async function renderLista(cont) {
  montar(cont, cargando());
  let filtro = filtroRecordado;
  let anio = '';
  let datos = await listarProyectos({});
  const zona = h('div');
  const puedeCrear = state.user.permissions.includes('proyectos.activar');

  async function recargar() { datos = await listarProyectos({ anio }); dibujar(); }
  const pasoDe = (p) => (p.tiendas === 0 ? 'Paso 2 de 4 · alcance y participantes' : 'Paso 3 de 4 · artículo, meta y etapas');

  function tablaProyectos() {
    const items = datos.items.filter(p => (filtro === 'todos' ? p.estado !== 'borrador' : true));
    if (!items.length) return h('div', { class: 'tabla-caja' }, estadoVacio('Todavía no hay proyectos', 'Crea el del mes con el botón «Crear proyecto».', 'folder-open-outline'));
    return h('div', { class: 'tabla-caja' }, h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table' },
      h('thead', null, h('tr', null, ['Proyecto', 'Mes', 'Estado', 'Tiendas', 'Asesores', 'Empresas'].map(t => h('th', { class: ['Tiendas', 'Asesores', 'Empresas'].includes(t) ? 'num' : null, text: t })))),
      h('tbody', null, items.map(p => h('tr', null,
        h('td', null, h('a', { class: 'cliente-enlace', href: `#/proyectos/${p.id}`, text: p.nombre }), h('div', { class: 'texto-tenue', text: p.codigo })),
        h('td', { text: p.mesTexto }), h('td', null, chipDe(p)),
        h('td', { class: 'num', text: String(p.tiendas) }), h('td', { class: 'num', text: String(p.asesores) }), h('td', { class: 'num', text: String(p.empresas) })))))));
  }

  function listaBorradores() {
    const borradores = datos.items.filter(p => p.estado === 'borrador');
    return [
      borradores.length ? h('div', { class: 'lista-borradores' }, borradores.map(p => h('div', { class: 'borrador' },
        h('div', null, h('div', { class: 'borrador-nombre', text: p.nombre }), h('div', { class: 'texto-tenue', text: pasoDe(p) }), h('div', { class: 'texto-tenue', text: `Creado ${hace(p.creadoEn)}` })),
        h('div', { class: 'borrador-acciones' }, h('span', { class: 'chip-estado', text: 'Borrador' }),
          h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => cancelar({ ...p, estado: 'borrador' }, recargar) }, 'Descartar'),
          h('a', { class: 'btn btn--primary', href: `#/proyectos/${p.id}/editar` }, icono('chevron-forward-outline'), 'Continuar')))))
        : h('div', { class: 'tabla-caja' }, estadoVacio('No tienes borradores', 'Cuando guardes un proyecto a medias, aparecerá aquí.', 'document-outline')),
      aviso({ titulo: 'Un borrador no reparte nada', texto: 'Se puede retomar desde el paso donde quedó. Solo tú y el administrador lo ven.' })
    ];
  }

  function dibujar() {
    const vencidos = datos.vencidos;
    const pestana = (id, titulo, n) => h('button', { class: `pestana${pestanaRecordada === id ? ' pestana-activa' : ''}`, type: 'button', role: 'tab', onclick: () => { pestanaRecordada = id; dibujar(); } }, titulo, h('span', { class: 'pestana-cuenta', text: String(n) }));
    const chip = (id, titulo) => h('button', { class: `chip-filtro${filtro === id ? ' chip-filtro--activo' : ''}`, type: 'button', onclick: async () => { filtro = id; filtroRecordado = id; datos = await listarProyectos({ estado: id === 'todos' ? undefined : id, anio }); dibujar(); } }, titulo, h('span', { class: 'pestana-cuenta', text: String(id === 'todos' ? datos.conteos.todos - datos.conteos.borradores : (datos.conteos[id] ?? 0)) }));
    montar(zona,
      vencidos.length ? aviso({ tipo: 'error', titulo: `${pluralizar(vencidos.length, 'proyecto vencido', 'proyectos vencidos')}`, texto: `${vencidos.map(v => `«${v.nombre}» terminó el ${fechaLarga(v.fechaFin)}`).join(' · ')} y sigue abierto. Ciérralo para iniciar otro en esas tiendas.` }) : null,
      h('div', { class: 'pestanas', role: 'tablist' }, pestana('proyectos', 'Proyectos', datos.conteos.todos - datos.conteos.borradores), pestana('borradores', 'Borradores', datos.conteos.borradores)),
      pestanaRecordada === 'borradores' ? listaBorradores() : [
        h('div', { class: 'filtros-proyectos' },
          h('div', { class: 'chips' }, FILTROS.filter(([id]) => id !== 'borradores').map(([id, t]) => chip(id, t))),
          datos.anios.length > 1 ? (() => {
            const s = h('select', { 'aria-label': 'Año' }, h('option', { value: '', text: 'Todos los años' }), datos.anios.map(a => h('option', { value: String(a), text: `Año ${a}` })));
            s.value = anio;
            s.addEventListener('change', () => { anio = s.value; recargar(); });
            return s;
          })() : null),
        tablaProyectos()
      ]);
  }

  montar(cont,
    cabecera({
      titulo: 'Proyectos', subtitulo: 'Los proyectos de tus tiendas y tus borradores.',
      acciones: puedeCrear ? h('a', { class: 'btn btn--primary', href: '#/proyectos/nuevo' }, icono('add-outline'), 'Crear proyecto') : null
    }),
    zona);
  dibujar();
}

// --- Detalle ---

async function renderDetalle(cont, id) {
  montar(cont, cargando());
  let p;
  try {
    p = await obtenerProyecto(id);
  } catch (error) {
    if (error.status !== 404) throw error;
    montar(cont, cabecera({ titulo: 'Proyecto no encontrado', acciones: h('a', { class: 'btn btn--ghost', href: '#/proyectos' }, icono('arrow-back-outline'), 'Proyectos') }),
      aviso({ tipo: 'advertencia', titulo: 'No existe o no es de tus tiendas', texto: 'Revisa el enlace o búscalo en la lista de proyectos.' }));
    return;
  }
  if (p.estado === 'borrador') { window.location.hash = `#/proyectos/${p.id}/editar`; return; }
  const maximo = Math.max(1, ...p.reparto.map(r => r.empresas));
  const dato = (titulo, valor) => h('div', { class: 'dato' }, h('dt', { text: titulo }), h('dd', null, valor || '—'));
  const puedeCancelar = ['activo', 'pendiente_aprobacion'].includes(p.estado);
  montar(cont,
    cabecera({
      titulo: p.nombre, subtitulo: `${p.codigo} · ${pluralizar(p.tiendas.length, 'tienda', 'tiendas')} · ${pluralizar(p.asesores, 'asesor', 'asesores')}${p.estado === 'pendiente_aprobacion' ? '' : ` · ${pluralizar(p.empresas, 'empresa', 'empresas')}`}`,
      acciones: h('div', { class: 'acciones-cabecera' }, h('a', { class: 'btn btn--ghost', href: '#/proyectos' }, icono('arrow-back-outline'), 'Proyectos'),
        puedeCancelar ? h('button', { class: 'btn btn--danger', type: 'button', onclick: () => cancelar(p, () => renderDetalle(cont, id)) }, icono('close-circle-outline'), 'Cancelar proyecto') : null)
    }),
    h('div', { class: 'chips chips--ficha' }, chipDe(p)),
    p.estado === 'pendiente_aprobacion' ? aviso({ tipo: 'advertencia', titulo: `Pediste la activación el ${fechaLarga((p.aprobacionPedidaEn || '').slice(0, 10))}`, texto: `${p.aprobacionPedidaPor ? `${p.aprobacionPedidaPor} ` : 'El gerente '}la aprobará o la devolverá con comentarios. Mientras tanto no se reparte nada y no se edita.` }) : null,
    p.estado === 'cancelado' ? aviso({ titulo: 'Proyecto cancelado', texto: 'Sus tiendas y sus empresas quedaron libres. Lo registrado se conserva en el historial.' }) : null,
    h('div', { class: 'ficha-cuerpo' },
      h('div', { class: 'ficha-columna' },
        h('section', { class: 'panel' }, h('h2', { class: 'panel-titulo', text: 'Datos del proyecto' }),
          h('dl', { class: 'datos' }, dato('Nicho', p.nicho), dato('Mes', p.mesTexto), dato('Inicio', fechaLarga(p.fechaInicio)), dato('Fin', fechaLarga(p.fechaFin)),
            dato('Artículo', p.articulo ? `${p.articulo}${p.existenciaMuestras !== null ? ` · ${p.existenciaMuestras} unidades` : ''}` : 'Sin artículo'),
            dato('Meta', p.metaMonto !== null ? `${p.metaMonto.toLocaleString('es-GT')} ${p.metaMoneda}` : 'Sin meta'),
            dato('Tope por asesor', p.topePorAsesor === null ? 'Sin tope' : String(p.topePorAsesor)), dato('Plantilla', p.fotoConfiguracion && p.fotoConfiguracion.plantilla))),
        h('section', { class: 'panel' }, h('h2', { class: 'panel-titulo', text: `Tiendas (${p.tiendas.length})` }),
          h('ul', { class: 'lista-simple' }, p.tiendas.map(t => h('li', null, h('strong', { text: t.codigo }), ` · ${t.empresa} · ${t.pais}`))))),
      h('div', { class: 'ficha-columna' },
        p.estado === 'pendiente_aprobacion' || !p.reparto.length ? h('section', { class: 'panel' }, h('h2', { class: 'panel-titulo', text: 'Reparto' }), h('p', { class: 'panel-descripcion', text: p.estado === 'pendiente_aprobacion' ? 'Se reparte cuando el gerente apruebe.' : 'Este proyecto no repartió empresas.' })) :
          h('section', { class: 'panel' }, h('h2', { class: 'panel-titulo', text: 'Reparto entre asesores' }),
            h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table' },
              h('thead', null, h('tr', null, ['Asesor', 'Tienda', 'Empresas'].map(t => h('th', { text: t })))),
              h('tbody', null, p.reparto.map(r => h('tr', null, h('td', { text: r.asesor || 'En reserva (sin asesor)' }), h('td', { text: r.tienda || '—' }),
                h('td', null, h('div', { class: 'barra-fila' }, h('div', { class: 'barra' }, h('span', { style: `width:${Math.round((r.empresas / maximo) * 100)}%` })), h('strong', { text: String(r.empresas) })))))))))))
  );
}
