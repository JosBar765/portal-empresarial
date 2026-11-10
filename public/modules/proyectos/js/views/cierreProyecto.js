// Cierre de un proyecto (S10) y proyecto cerrado en solo lectura (S16). Ruta: #/proyectos/<id>/cierre.
// El informe lo calcula el servidor (una sola función para la pantalla y el PDF); aquí solo se pinta.
import { h, icono, montar } from '../utils/dom.js';
import { pluralizar } from '../utils/formato.js';
import { aviso, cargando, avisar } from '../components/ui.js';
import { modalFormulario } from '../components/modalFormulario.js';
import { campoArea } from '../components/campos.js';
import { obtenerInforme, cerrarProyectoConInforme, reenviarCierre } from '../api/api.js';
import { formatoMonto, diaCorto, nombreDelMes } from '../utils/gestion.js';
import { state } from '../state.js';

const claveNueva = () => (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID().replace(/-/g, '') : `${Date.now()}${Math.random().toString(36).slice(2)}`).slice(0, 40);
const ETIQUETA_SEMAFORO = { verde: 'Verde', ambar: 'Ámbar', rojo: 'Rojo' };

export const enlacePdf = (id) => h('a', { class: 'btn btn--ghost', href: `/api/proyectos/proyectos/${encodeURIComponent(id)}/informe.pdf`, download: '' }, icono('download-outline'), 'Descargar PDF');
// «Exportar CSV»: los resultados del proyecto y las tablas del informe. Solo con `proyectos.ver_reportes` (el servidor también lo exige).
export function menuExportar(id) {
  if (!state.user.permissions.includes('proyectos.ver_reportes')) return null;
  const base = `/api/proyectos/proyectos/${encodeURIComponent(id)}`;
  const opciones = [['Resultados del proyecto', `${base}/exportar.csv`], ['Informe · resumen', `${base}/informe.csv?tabla=resumen`], ['Informe · por asesor', `${base}/informe.csv?tabla=asesores`], ['Informe · por tienda', `${base}/informe.csv?tabla=tiendas`]];
  const menu = h('div', { class: 'menu-acciones', hidden: '' }, opciones.map(([texto, href]) => h('a', { href, download: '' }, icono('document-outline'), texto)));
  const boton = h('button', { class: 'btn btn--ghost', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, icono('grid-outline'), 'Exportar CSV');
  const cerrar = () => { menu.hidden = true; boton.setAttribute('aria-expanded', 'false'); };
  boton.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; boton.setAttribute('aria-expanded', String(!menu.hidden)); });
  document.addEventListener('click', function alClic(e) { if (!menu.isConnected) { document.removeEventListener('click', alClic); return; } if (!menu.contains(e.target)) cerrar(); });
  menu.addEventListener('click', cerrar);
  return h('div', { class: 'menu-contenedor' }, boton, menu);
}

export const montosPorMoneda = (lista) => (lista.length ? lista.map(m => formatoMonto(m.monto, m.moneda)).join(' · ') : '—');
const chipSemaforo = (s) => h('span', { class: `chip-semaforo chip-semaforo--${s}`, text: ETIQUETA_SEMAFORO[s] });

// Las seis cifras del embudo, con su porcentaje debajo cuando lo hay.
export function cifrasDelInforme(informe) {
  const c = informe.cifras;
  const celda = (valor, texto, pct) => h('div', { class: 'cifra' }, h('div', { class: 'cifra-valor', text: String(valor) }), h('div', { class: 'cifra-texto', text: texto }), pct === undefined ? null : h('div', { class: 'cifra-pct', text: `${pct} %` }));
  return h('div', { class: 'cifras-asesor' },
    celda(c.asignadas, 'Asignadas'), celda(c.gestionadas, 'Gestionadas', c.porcentajes.gestionadas), celda(c.contactadas, 'Contactadas'),
    celda(c.interesadas, 'Interesadas', c.porcentajes.interesadas), celda(c.cotizadas, 'Cotizadas', c.porcentajes.cotizadas), celda(c.vendidas, 'Vendidas', c.porcentajes.vendidas));
}

// T3b: confirma el cierre. Las conclusiones deben estar escritas.
function confirmarCierre(datos, conclusiones, alTerminar) {
  const valores = { revisado: false };
  const errores = {};
  const clave = claveNueva();
  const sinGestionar = datos.informe.cifras.sinGestionar;
  const nodo = h('form', { class: 'formulario-modal', novalidate: '' });
  const dibujar = () => montar(nodo,
    h('p', { class: 'hoja-subtitulo', text: `${datos.proyecto.nicho} · el informe queda congelado` }),
    sinGestionar ? aviso({ tipo: 'advertencia', titulo: `${pluralizar(sinGestionar, 'empresa sigue', 'empresas siguen')} sin gestionar`, texto: 'Quedan libres para otro proyecto. Las que tienen resultado conservan su estado.' }) : null,
    h('label', { class: 'casilla' }, (() => { const i = h('input', { type: 'checkbox' }); i.checked = valores.revisado; i.addEventListener('change', () => { valores.revisado = i.checked; delete errores.revisado; dibujar(); }); return i; })(), h('span', { text: 'Revisé las conclusiones y el informe' })),
    errores.revisado ? h('div', { class: 'campo-mensaje campo-mensaje--error' }, icono('alert-circle-outline'), h('span', { text: errores.revisado })) : null,
    datos.reglas && datos.reglas.vistoBueno ? h('p', { class: 'campo-mensaje', text: 'Se avisará al gerente para su visto bueno.' }) : null);
  dibujar();
  const { overlay } = modalFormulario({
    title: 'Cerrar proyecto', nodo, aceptar: 'Cerrar proyecto',
    enviar: async () => {
      if (!valores.revisado) { errores.revisado = 'Confirma que revisaste las conclusiones y el informe.'; dibujar(); throw Object.assign(new Error('Revisa los datos.'), { campos: { revisado: errores.revisado } }); }
      const nuevo = await cerrarProyectoConInforme(datos.proyecto.id, { conclusiones: conclusiones(), confirmado: true, idempotencyKey: clave });
      avisar('success', 'Proyecto cerrado', datos.proyecto.nombre);
      alTerminar(nuevo);
    },
    alError: (error) => { if (error.campos && error.campos.conclusiones) { avisar('error', 'Faltan las conclusiones', error.campos.conclusiones); document.getElementById('cierre-conclusiones')?.focus(); } else if (error.campos) { Object.assign(errores, error.campos); dibujar(); } else avisar('error', 'No se pudo cerrar', error.message); }
  });
  overlay.classList.add('hoja');
}

export async function renderCierre(cont, id) {
  montar(cont, cargando());
  let datos;
  try {
    datos = await obtenerInforme(id);
  } catch (error) {
    if (error.status !== 404) throw error;
    montar(cont, h('div', { class: 'pagina-cabecera' }, h('div', null, h('h1', { class: 'pagina-titulo', text: 'Proyecto no encontrado' }))),
      aviso({ tipo: 'advertencia', titulo: 'No existe o no es de tus tiendas', texto: 'Revisa el enlace o búscalo en la lista de proyectos.' }), h('a', { class: 'btn btn--ghost', href: '#/proyectos' }, icono('arrow-back-outline'), 'Proyectos'));
    return;
  }
  if (datos.proyecto.estado === 'cerrado') pintarCerrado(cont, datos); else if (datos.proyecto.estado === 'activo') pintarCierre(cont, datos); else window.location.hash = `#/proyectos/${datos.proyecto.id}`;
}

// --- S10: cerrar ---
function pintarCierre(cont, datos) {
  const { informe, proyecto } = datos;
  const valores = { conclusiones: datos.conclusiones || '' };
  const errores = {};
  const total = informe.canales.total;
  const barras = h('section', { class: 'panel' }, h('h2', { class: 'panel-titulo', text: 'Presencial vs. remoto' }),
    [['Presencial', informe.canales.porcentajePresencial, 'azul'], ['Remoto', informe.canales.porcentajeRemoto, 'oscuro']].map(([t, pct, color]) => h('div', { class: 'barra-fila' }, h('span', { class: 'barra-avance-pista' }, h('span', { class: `barra-avance-relleno barra-avance-relleno--${color}`, style: `width:${total ? pct : 0}%` })), h('span', { class: 'barra-fila-texto', text: `${t} · ${total ? pct : 0} %` }))),
    total ? null : h('p', { class: 'texto-tenue', text: 'Todavía no hay gestiones registradas.' }));
  const muestras = h('section', { class: 'panel' }, h('h2', { class: 'panel-titulo', text: 'Entregadas por área' }),
    informe.muestras.porArea.length ? informe.muestras.porArea.map(m => h('div', { class: 'fila-dato' }, h('span', { text: m.area }), h('strong', { text: String(m.cantidad) }))) : h('p', { class: 'texto-tenue', text: 'Sin entregas de muestra.' }),
    informe.muestras.total !== null ? h('div', { class: 'fila-dato' }, h('span', { text: 'Quedan' }), h('strong', { text: `${informe.muestras.existencia} de ${informe.muestras.total}` })) : null);
  const conclusiones = h('section', { class: 'panel' }, h('h2', { class: 'panel-titulo', text: 'Conclusiones del supervisor' }));
  const dibujarConclusiones = () => montar(conclusiones, h('h2', { class: 'panel-titulo', text: 'Conclusiones del supervisor' }), campoArea({ valores, errores, clave: 'conclusiones', etiqueta: 'Qué funcionó, qué no y qué recomiendas', maximo: 4000, prefijoId: 'cierre' }));
  dibujarConclusiones();
  const sinGestionar = informe.cifras.sinGestionar;
  montar(cont,
    h('div', { class: 'pagina-cabecera' },
      h('div', null, h('div', { class: 'mi-proyecto-titulo' }, h('h1', { class: 'pagina-titulo', text: `Cierre · ${proyecto.nicho}` }), h('span', { class: 'chip-estado chip-estado--activa', text: 'Activo' })),
        h('p', { class: 'pagina-subtitulo', text: `${nombreDelMes(proyecto.anio, proyecto.mes)} · ${proyecto.paises || ''} · ${pluralizar(proyecto.tiendas, 'tienda', 'tiendas')} · informe al momento` })),
      h('div', { class: 'acciones-cabecera' }, h('a', { class: 'btn btn--ghost', href: `#/proyectos/${proyecto.id}` }, icono('arrow-back-outline'), 'Proyecto'), menuExportar(proyecto.id), enlacePdf(proyecto.id))),
    cifrasDelInforme(informe),
    h('div', { class: 'cierre-cuerpo' },
      h('div', { class: 'cierre-columna' },
        h('section', { class: 'panel' }, h('h2', { class: 'panel-titulo', text: 'Montos por moneda (no se mezclan)' }),
          h('div', { class: 'fila-dato' }, h('span', { text: 'Cotizado' }), h('strong', { text: montosPorMoneda(informe.montos.cotizado) })),
          h('div', { class: 'fila-dato' }, h('span', { text: 'Vendido' }), h('strong', { text: montosPorMoneda(informe.montos.vendido) }))),
        h('div', { class: 'cierre-fila' }, barras, muestras)),
      h('div', { class: 'cierre-columna' },
        conclusiones,
        sinGestionar ? aviso({ tipo: 'advertencia', titulo: `${pluralizar(sinGestionar, 'empresa queda', 'empresas quedan')} sin gestionar`, texto: 'Al cerrar quedan libres. Las que tienen resultado conservan su estado.' }) : null,
        h('section', { class: 'panel' }, h('h2', { class: 'panel-subtitulo', text: 'Visto bueno del gerente' }), h('p', { class: 'texto-tenue', text: datos.reglas && datos.reglas.vistoBueno ? 'Se pedirá al cerrar. Puede devolverlo con comentarios.' : 'No se pide: el cierre termina aquí.' })),
        datos.permisos.cerrar ? h('button', { class: 'btn btn--primary btn--ancho', type: 'button', onclick: () => confirmarCierre(datos, () => valores.conclusiones, (nuevo) => pintarCerrado(cont, nuevo)) }, icono('checkmark-outline'), 'Cerrar proyecto') : null)));
}

// --- S16: proyecto cerrado, solo lectura ---
export function pintarCerrado(cont, datos) {
  const { informe, proyecto, vistoBueno } = datos;
  const valores = { conclusiones: datos.conclusiones || '' };
  const errores = {};
  const banner = () => {
    if (!vistoBueno) return null;
    if (vistoBueno.estado === 'dado') return h('div', { class: 'aviso aviso--ok', role: 'note' }, icono('checkmark-circle-outline'), h('div', null, h('div', { class: 'aviso-titulo', text: 'Visto bueno dado' }), h('div', { class: 'aviso-texto', text: `${vistoBueno.por} · ${diaCorto(vistoBueno.en)}${vistoBueno.comentario ? ` · «${vistoBueno.comentario}»` : ''}` })));
    if (vistoBueno.estado === 'devuelto') return aviso({ tipo: 'error', titulo: 'El gerente devolvió el cierre con comentarios', texto: `${vistoBueno.por} · ${diaCorto(vistoBueno.en)} · «${vistoBueno.comentario}». Ajusta las conclusiones y reenvíalo.` });
    return aviso({ tipo: 'advertencia', titulo: 'Esperando el visto bueno del gerente', texto: 'Se te avisará cuando lo dé o lo devuelva con comentarios.' });
  };
  const editable = datos.permisos.reenviar;
  const zonaConclusiones = h('section', { class: 'panel' });
  const dibujarConclusiones = () => montar(zonaConclusiones, h('h2', { class: 'panel-titulo', text: 'Conclusiones del supervisor' }),
    editable ? [campoArea({ valores, errores, clave: 'conclusiones', etiqueta: 'Corrige las conclusiones', maximo: 4000, prefijoId: 'reenviar' }),
      h('div', { class: 'acciones-panel' }, h('button', { class: 'btn btn--primary', type: 'button', onclick: async () => {
        try { const nuevo = await reenviarCierre(proyecto.id, { conclusiones: valores.conclusiones, idempotencyKey: claveNueva() }); avisar('success', 'Cierre reenviado', 'El gerente lo revisará de nuevo.'); pintarCerrado(cont, nuevo); } catch (error) { if (error.campos) { Object.assign(errores, error.campos); dibujarConclusiones(); } else avisar('error', 'No se pudo reenviar', error.message); }
      } }, icono('send-outline'), 'Reenviar al gerente'))]
      : h('p', { class: 'texto-parrafo', text: datos.conclusiones || 'Sin conclusiones.' }));
  dibujarConclusiones();
  montar(cont,
    h('div', { class: 'pagina-cabecera' },
      h('div', null, h('div', { class: 'mi-proyecto-titulo' }, h('h1', { class: 'pagina-titulo', text: `${proyecto.nicho} · ${nombreDelMes(proyecto.anio, proyecto.mes)}` }), h('span', { class: 'chip-oscuro', text: 'Cerrado' })),
        h('p', { class: 'pagina-subtitulo', text: `${proyecto.codigo} · cerrado el ${diaCorto(datos.cierre.en)} por ${datos.cierre.por}` })),
      h('div', { class: 'acciones-cabecera' }, h('a', { class: 'btn btn--ghost', href: '#/proyectos' }, icono('arrow-back-outline'), 'Proyectos'), menuExportar(proyecto.id), enlacePdf(proyecto.id))),
    banner(),
    cifrasDelInforme(informe),
    h('div', { class: 'cierre-cuerpo cierre-cuerpo--iguales' },
      zonaConclusiones,
      h('div', { class: 'tabla-caja' }, h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table' },
        h('thead', null, h('tr', null, ['Tienda', 'Cotizado', 'Vendido'].map((t, i) => h('th', { class: i ? 'num' : null, text: t })))),
        h('tbody', null, informe.porTienda.map(t => h('tr', null, h('td', null, h('strong', { text: t.empresa })), h('td', { class: 'num', text: montosPorMoneda(t.cotizado) }), h('td', { class: 'num', text: montosPorMoneda(t.vendido) })))))))),
    h('p', { class: 'texto-tenue', text: `Solo lectura. El informe quedó congelado el ${diaCorto(datos.cierre.en)}.` }));
}
