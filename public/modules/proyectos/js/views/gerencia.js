// Panel gerencial (G1, #/panel), lista de cierres por dar visto bueno (G4, #/vistobueno) y revisión de un cierre (G2, #/vistobueno/<id>).
// Todo en solo lectura, salvo la decisión del gerente (dar el visto bueno o devolverlo con comentarios).
import { h, icono, montar } from '../utils/dom.js';
import { hace, pluralizar } from '../utils/formato.js';
import { aviso, cargando, estadoVacio, avisar } from '../components/ui.js';
import { campoArea } from '../components/campos.js';
import { obtenerPanelGerencial, listarPorDarVistoBueno, obtenerInforme, darVistoBueno, devolverCierre } from '../api/api.js';
import { formatoMonto, diaCorto, nombreDelMes } from '../utils/gestion.js';
import { enlacePdf, menuExportar, cifrasDelInforme, montosPorMoneda } from './cierreProyecto.js';

const claveNueva = () => (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID().replace(/-/g, '') : `${Date.now()}${Math.random().toString(36).slice(2)}`).slice(0, 40);
const ETIQUETA_SEMAFORO = { verde: 'Verde', ambar: 'Ámbar', rojo: 'Rojo' };
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const chipSemaforo = (s) => h('span', { class: `chip-semaforo chip-semaforo--${s}`, text: ETIQUETA_SEMAFORO[s] });

let paisRecordado = '';
let monedaRecordada = '';

// --- G1: panel gerencial ---
export async function renderPanel(cont) {
  montar(cont, cargando());
  const zona = h('div');
  const cargar = () => obtenerPanelGerencial({ paisId: paisRecordado, moneda: monedaRecordada });
  let datos = await cargar();

  async function recargar() { datos = await cargar(); dibujar(); }

  function dibujar() {
    const d = datos;
    const maximo = Math.max(1, ...d.porMes.meses);
    const mesActual = new Date(Date.now() - 6 * 3600 * 1000).getUTCMonth();
    const tarjeta = (valor, texto, pie, clase) => h('div', { class: 'cifra' }, h('div', { class: `cifra-valor${clase ? ` ${clase}` : ''}`, text: String(valor) }), h('div', { class: 'cifra-texto', text: texto }), pie ? h('div', { class: 'cifra-pct', text: pie }) : null);
    montar(zona,
      h('div', { class: 'pagina-cabecera' },
        h('div', null, h('h1', { class: 'pagina-titulo', text: 'Panel gerencial' }), h('p', { class: 'pagina-subtitulo', text: `Todos los proyectos y tiendas · solo lectura · ${d.anio}` })),
        h('div', { class: 'chips' }, [['', 'Toda la región'], ...d.porPais.map(p => [String(p.paisId), p.pais])].map(([id, t]) => h('button', { class: `chip-filtro${paisRecordado === id ? ' chip-filtro--activo' : ''}`, type: 'button', onclick: () => { paisRecordado = id; recargar(); } }, t)))),
      h('div', { class: 'cifras-gerencia' },
        tarjeta(d.proyectos.activos, 'Proyectos activos', `${d.proyectos.vencidos} ${d.proyectos.vencidos === 1 ? 'vencido' : 'vencidos'}`),
        tarjeta(d.proyectos.porVistoBueno, 'Por dar visto bueno', null, d.proyectos.porVistoBueno ? 'cifra-valor--ambar' : ''),
        h('div', { class: 'cifra cifra--montos' }, h('div', { class: 'cifra-texto', text: `Vendido en ${d.anio} (por moneda)` }), d.vendido.length ? d.vendido.map(v => h('div', { class: 'cifra-monto', text: formatoMonto(v.monto, v.moneda) })) : h('div', { class: 'texto-tenue', text: 'Sin ventas todavía' })),
        tarjeta(`${d.efectividad.porcentaje} %`, 'Efectividad promedio', ETIQUETA_SEMAFORO[d.efectividad.semaforo], d.efectividad.semaforo === 'verde' ? 'cifra-valor--verde' : d.efectividad.semaforo === 'ambar' ? 'cifra-valor--ambar' : 'cifra-valor--rojo')),
      h('div', { class: 'panel-dos' },
        h('section', { class: 'panel' }, h('div', { class: 'panel-cabecera' }, h('h2', { class: 'panel-titulo', text: `Proyectos por mes · vendido (${d.porMes.moneda})` }),
          d.porMes.monedas.length > 1 ? h('div', { class: 'chips' }, d.porMes.monedas.map(m => h('button', { class: `chip-filtro${d.porMes.moneda === m ? ' chip-filtro--activo' : ''}`, type: 'button', onclick: () => { monedaRecordada = m; recargar(); } }, m))) : null),
          h('div', { class: 'grafica-barras', role: 'img', 'aria-label': 'Vendido por mes' }, d.porMes.meses.map((v, i) => h('div', { class: 'grafica-columna', title: `${MESES_CORTOS[i]}: ${formatoMonto(v, d.porMes.moneda)}` },
            h('span', { class: `grafica-barra${i === mesActual ? ' grafica-barra--actual' : ''}`, style: `height:${Math.round((v / maximo) * 100)}%` }), h('span', { class: 'grafica-etiqueta', text: MESES_CORTOS[i] }))))),
        h('section', { class: 'panel' }, h('h2', { class: 'panel-titulo', text: 'Efectividad por país' }),
          d.porPais.length ? d.porPais.map(p => h('div', { class: 'barra-fila' }, h('span', { class: 'barra-fila-nombre', text: p.pais }), h('span', { class: 'barra-avance-pista' }, h('span', { class: `barra-avance-relleno barra-avance-relleno--${p.semaforo}`, style: `width:${p.efectividad}%` })), h('span', { class: 'barra-fila-valor', text: `${p.efectividad} %` })))
            : h('p', { class: 'texto-tenue', text: 'Todavía no hay proyectos este año.' }))),
      h('div', { class: 'panel-dos panel-dos--tabla' },
        h('div', null, h('h2', { class: 'panel-titulo', text: 'Comparación de nichos' }),
          d.nichos.length ? h('div', { class: 'tabla-caja' }, h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table' },
            h('thead', null, h('tr', null, ['Nicho', 'Proy.', 'Cotizado', 'Vendido', 'Efect.', ''].map((t, i) => h('th', { class: i === 1 || i === 4 ? 'num' : null, text: t })))),
            h('tbody', null, d.nichos.map(n => h('tr', null, h('td', null, h('strong', { text: n.nicho })), h('td', { class: 'num', text: String(n.proyectos) }), h('td', { text: montosPorMoneda(n.cotizado) }), h('td', { text: montosPorMoneda(n.vendido) }), h('td', { class: 'num', text: `${n.efectividad} %` }), h('td', null, chipSemaforo(n.semaforo)))))))) : estadoVacio('Sin datos', 'Cuando haya proyectos este año se compararán aquí.', 'stats-chart-outline')),
        h('div', null, h('h2', { class: 'panel-titulo', text: `Por dar visto bueno · ${d.proyectos.porVistoBueno}` }),
          d.porDarVistoBueno.length ? d.porDarVistoBueno.map(c => h('div', { class: 'tarjeta-revision' }, h('div', null, h('strong', { text: `${c.nombre.replace(/ · .*/, '')} · ${nombreDelMes(c.anio, c.mes).split(' ')[0].slice(0, 3)} ${c.anio}` }), h('div', { class: 'texto-tenue', text: `Cerrado ${diaCorto(c.cerradoEn)} por ${c.cerradoPor}` })), h('a', { class: 'btn btn--ghost', href: `#/vistobueno/${c.id}`, text: 'Revisar' })))
            : h('p', { class: 'texto-tenue', text: 'No hay cierres esperando tu decisión.' }))));
  }
  montar(cont, zona);
  dibujar();
}

// --- G4: por dar visto bueno ---
let pestanaVB = 'cierres';

export async function renderVistoBueno(cont, parametro) {
  if (parametro) return renderRevision(cont, parametro);
  montar(cont, cargando());
  const datos = await listarPorDarVistoBueno();
  const zona = h('div');
  function dibujar() {
    const pestana = (id, t, n) => h('button', { class: `pestana${pestanaVB === id ? ' pestana-activa' : ''}`, type: 'button', role: 'tab', onclick: () => { pestanaVB = id; dibujar(); } }, t, h('span', { class: 'pestana-cuenta', text: String(n) }));
    montar(zona, h('div', { class: 'pestanas', role: 'tablist' }, pestana('cierres', 'Cierres', datos.cierres.length), pestana('activaciones', 'Activaciones', datos.activaciones)),
      pestanaVB === 'cierres'
        ? [...(datos.cierres.length ? datos.cierres.map(c => h('div', { class: 'tarjeta-revision tarjeta-revision--ancha' },
          h('div', null, h('strong', { text: c.nombre }), h('div', { class: 'texto-tenue', text: `Supervisor: ${c.cerradoPor} · Cerrado el ${diaCorto(c.cerradoEn)} · ${hace(c.cerradoEn)}` })),
          h('div', { class: 'tarjeta-revision-cifras' }, [['Asignadas', c.asignadas], ['Vendidas', c.vendidas], ['Efectividad', `${c.efectividad} %`], ['Vendido', montosPorMoneda(c.vendido)]].map(([t, v]) => h('div', null, h('div', { class: 'cifra-texto', text: t }), h('strong', { text: String(v) })))),
          h('a', { class: 'btn btn--primary', href: `#/vistobueno/${c.id}` }, icono('chevron-forward-outline'), 'Revisar')))
          : [estadoVacio('No hay cierres por revisar', 'Cuando un supervisor cierre un proyecto, aparecerá aquí para tu visto bueno.', 'checkmark-done-outline')]),
        aviso({ titulo: 'Con el interruptor apagado no verás esta lista', texto: 'Si el administrador apaga el visto bueno al cerrar, los proyectos se cierran sin pasar por aquí.' })]
        : h('div', { class: 'tabla-caja' }, estadoVacio(datos.activaciones ? `${datos.activaciones} ${datos.activaciones === 1 ? 'activación espera' : 'activaciones esperan'} tu aprobación` : 'No hay activaciones por aprobar', 'Se aprueban o se rechazan con comentario desde «Por aprobar».', 'rocket-outline'), datos.activaciones ? h('div', { class: 'acciones-centradas' }, h('a', { class: 'btn btn--primary', href: '#/aprobaciones' }, 'Ir a Por aprobar')) : null));
  }
  montar(cont, h('div', { class: 'pagina-cabecera' }, h('div', null, h('h1', { class: 'pagina-titulo', text: 'Por dar visto bueno' }), h('p', { class: 'pagina-subtitulo', text: 'Cierres y activaciones que esperan tu decisión.' }))), zona);
  dibujar();
}

// --- G2: revisión de un cierre ---
async function renderRevision(cont, id) {
  montar(cont, cargando());
  let datos;
  try { datos = await obtenerInforme(id); } catch (error) {
    if (error.status !== 404) throw error;
    montar(cont, aviso({ tipo: 'advertencia', titulo: 'Ese proyecto no existe', texto: 'Vuelve a la lista de cierres por revisar.' }), h('a', { class: 'btn btn--ghost', href: '#/vistobueno' }, icono('arrow-back-outline'), 'Por dar visto bueno'));
    return;
  }
  const { informe, proyecto } = datos;
  const valores = { comentario: '' };
  const errores = {};
  const zonaDecision = h('section', { class: 'panel' });
  const decidir = async (accion) => {
    try {
      if (accion === 'devolver' && !valores.comentario.trim()) { errores.comentario = 'Escribe qué debe corregir el supervisor.'; dibujarDecision(); return; }
      const nuevo = await (accion === 'dar' ? darVistoBueno : devolverCierre)(proyecto.id, { comentario: valores.comentario, idempotencyKey: claveNueva() });
      avisar('success', accion === 'dar' ? 'Visto bueno dado' : 'Cierre devuelto', proyecto.nombre);
      datos = nuevo;
      valores.comentario = '';
      dibujarDecision();
      window.location.hash = '#/vistobueno';
    } catch (error) { if (error.campos) { Object.assign(errores, error.campos); dibujarDecision(); } else avisar('error', 'No se pudo guardar tu decisión', error.message); }
  };
  const dibujarDecision = () => {
    if (!datos.permisos.vistoBueno) { montar(zonaDecision, h('h2', { class: 'panel-titulo', text: 'Tu decisión' }), h('p', { class: 'texto-tenue', text: datos.vistoBueno ? `Este cierre ya tiene su respuesta (${datos.vistoBueno.estado === 'dado' ? 'visto bueno dado' : datos.vistoBueno.estado === 'devuelto' ? 'devuelto con comentarios' : 'pendiente'}).` : 'Este cierre no pasa por visto bueno.' })); return; }
    montar(zonaDecision, h('h2', { class: 'panel-titulo', text: 'Tu decisión' }),
      campoArea({ valores, errores, clave: 'comentario', etiqueta: 'Comentario (obligatorio si lo devuelves)', maximo: 500, prefijoId: 'decision' }),
      h('button', { class: 'btn btn--primary btn--ancho', type: 'button', onclick: () => decidir('dar') }, icono('checkmark-outline'), 'Dar visto bueno'),
      h('button', { class: 'btn btn--ghost btn--ancho', type: 'button', onclick: () => decidir('devolver') }, icono('arrow-back-outline'), 'Devolver con comentarios'),
      h('p', { class: 'texto-tenue', text: 'Si lo devuelves, el supervisor corrige y reenvía. Tu nombre y fecha quedan en el PDF.' }));
  };
  dibujarDecision();
  const chipVB = datos.vistoBueno ? h('span', { class: `chip-estado ${datos.vistoBueno.estado === 'dado' ? 'chip-estado--activa' : datos.vistoBueno.estado === 'devuelto' ? 'chip-estado--no_contactar' : 'chip-estado--inactiva'}`, text: datos.vistoBueno.estado === 'dado' ? 'Visto bueno dado' : datos.vistoBueno.estado === 'devuelto' ? 'Devuelto' : 'Visto bueno pendiente' }) : null;
  const ROTULO = { cerrar: 'Proyecto cerrado', activar: 'Proyecto activado', aprobar: 'Activación aprobada', visto_bueno: 'Visto bueno dado', devolver: 'Cierre devuelto', reenviar: 'Cierre reenviado' };
  montar(cont,
    h('nav', { class: 'migas' }, h('a', { href: '#/vistobueno' }, icono('arrow-back-outline'), 'Por dar visto bueno')),
    h('div', { class: 'pagina-cabecera' },
      h('div', null, h('div', { class: 'mi-proyecto-titulo' }, h('h1', { class: 'pagina-titulo', text: `${proyecto.nicho} · ${nombreDelMes(proyecto.anio, proyecto.mes)}` }), h('span', { class: 'chip-oscuro', text: proyecto.estado === 'cerrado' ? 'Cerrado' : 'Activo' }), chipVB),
        h('p', { class: 'pagina-subtitulo', text: `${proyecto.paises || ''} · ${pluralizar(proyecto.tiendas, 'tienda', 'tiendas')}${datos.cierre ? ` · cerrado el ${diaCorto(datos.cierre.en)} por ${datos.cierre.por}` : ''}` })),
      h('div', { class: 'acciones-cabecera' }, menuExportar(proyecto.id), enlacePdf(proyecto.id))),
    h('div', { class: 'cierre-cuerpo' },
      h('div', { class: 'cierre-columna' },
        cifrasDelInforme(informe),
        h('div', { class: 'tabla-caja' }, h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table' },
          h('thead', null, h('tr', null, ['Tienda', 'Asig.', 'Gestion.', 'Vendidas', 'Vendido', 'Semáforo'].map((t, i) => h('th', { class: i > 0 && i < 4 ? 'num' : null, text: t })))),
          h('tbody', null, informe.porTienda.map(t => h('tr', null, h('td', null, h('strong', { text: t.empresa })), h('td', { class: 'num', text: String(t.asignadas) }), h('td', { class: 'num', text: String(t.gestionadas) }), h('td', { class: 'num', text: String(t.vendidas) }), h('td', { text: montosPorMoneda(t.vendido) }), h('td', null, chipSemaforo(t.semaforo)))))))),
        h('section', { class: 'panel' }, h('h2', { class: 'panel-titulo', text: 'Conclusiones del supervisor' }), h('p', { class: 'texto-parrafo', text: datos.conclusiones || 'Sin conclusiones.' }))),
      h('div', { class: 'cierre-columna' }, zonaDecision,
        h('section', { class: 'panel' }, h('h2', { class: 'panel-subtitulo', text: 'Historial del cierre' }),
          datos.historial.length ? datos.historial.map(x => h('div', { class: 'historial-item' }, h('div', { text: ROTULO[x.accion] || x.accion }), h('div', { class: 'texto-tenue', text: `${diaCorto(x.en)} · ${x.usuario || ''}` }))) : h('p', { class: 'texto-tenue', text: 'Todavía sin movimientos.' })))));
}
