// Mi proyecto del asesor (M1 en celular, D1 en escritorio): el proyecto activo con su etapa, las cifras, «Para hoy» y la lista
// de sus empresas con filtros. Sin proyecto activo muestra M11. Ruta: #/miproyecto.
import { h, icono, montar } from '../utils/dom.js';
import { cargando, estadoVacio } from '../components/ui.js';
import { obtenerMiProyecto, listarMisEmpresas } from '../api/api.js';
import { chipGestion, nombreDelMes, diaCorto, textoSeguimiento, textoUltimaGestion, hrefLlamar, hrefWhatsApp, formatoMonto } from '../utils/gestion.js';

const FILTROS = [['', 'Todas'], ['pendiente', 'Pendientes'], ['en_gestion', 'En gestión'], ['interesada', 'Interesadas'], ['cotizada', 'Cotizadas'], ['vendida', 'Vendidas'], ['perdida', 'Perdidas'], ['descartada', 'Descartadas']];
const ESTADOS_ETAPA = { hecha: 'etapa--hecha', actual: 'etapa--actual', proxima: '' };

// M11: sin proyecto activo para las tiendas de la persona.
export function sinProyectoActivo() {
  return h('div', { class: 'sin-proyecto' },
    h('div', { class: 'sin-proyecto-icono' }, icono('folder-outline')),
    h('h2', { text: 'No hay proyecto activo para tus tiendas' }),
    h('p', { text: 'Tu supervisor lo activará al elegir el nicho. Mientras, registra empresas en la cartera.' }),
    h('a', { class: 'btn btn--primary', href: '#/clientes' }, icono('business-outline'), 'Ir a la cartera'));
}

// Llamar y WhatsApp con un toque: el portal no envía nada por sí solo.
export function accionesDeContacto(telefono, { texto = false, enlaceMapa = null } = {}) {
  const llamar = hrefLlamar(telefono);
  const wa = hrefWhatsApp(telefono);
  const boton = (href, nombre, etiqueta, primario) => (href
    ? h('a', { class: `btn ${primario ? 'btn--primary' : 'btn--ghost'} btn--chico`, href, target: nombre === 'logo-whatsapp' ? '_blank' : null, rel: 'noopener', 'aria-label': etiqueta }, icono(nombre), texto ? etiqueta : null)
    : h('span', { class: 'btn btn--ghost btn--chico btn--inactivo', 'aria-label': `${etiqueta} (sin teléfono)` }, icono(nombre), texto ? etiqueta : null));
  // «Cómo llegar» abre Google Maps con la dirección de la empresa; sin dirección registrada no se muestra.
  const llegar = enlaceMapa ? h('a', { class: 'btn btn--ghost btn--chico', href: enlaceMapa, target: '_blank', rel: 'noopener', 'aria-label': 'Cómo llegar' }, icono('location-outline'), texto ? 'Cómo llegar' : null) : null;
  return h('div', { class: 'contacto-acciones' }, boton(llamar, 'call-outline', 'Llamar', texto), boton(wa, 'logo-whatsapp', 'WhatsApp', false), llegar);
}

// La meta de ventas del asesor (M16): su parte del proyecto, lo que lleva vendido y lo que falta. Solo si el proyecto tiene meta.
function tarjetaMeta(meta) {
  if (!meta) return null;
  const monto = (v) => formatoMonto(v, meta.moneda);
  const color = meta.avance >= 100 ? 'verde' : meta.avance >= 50 ? 'ambar' : 'rojo';
  return h('section', { class: 'panel meta-asesor' },
    h('div', { class: 'meta-asesor-fila' }, h('h2', { class: 'panel-titulo', text: 'Mi meta de ventas' }), h('strong', { text: `${meta.avance} %` })),
    h('span', { class: 'barra-avance-pista meta-asesor-barra' }, h('span', { class: `barra-avance-relleno barra-avance-relleno--${color}`, style: `width:${Math.min(meta.avance, 100)}%` })),
    h('p', { text: meta.enMeta ? `Meta cumplida: ${monto(meta.vendido)} de ${monto(meta.meta)}.` : `Vendido ${monto(meta.vendido)} de ${monto(meta.meta)} · Falta ${monto(meta.falta)}` }),
    h('p', { class: 'texto-tenue texto-tenue--chico', text: `${meta.ajustada ? 'Tu supervisor ajustó tu meta. ' : 'Es tu parte igual de la meta del proyecto. Tu supervisor puede ajustarla. '}Cuenta lo vendido y confirmado.` }));
}

export async function renderMiProyecto(cont) {
  montar(cont, cargando());
  const datos = await obtenerMiProyecto();
  if (!datos.proyecto) { montar(cont, sinProyectoActivo()); return; }
  const { proyecto, etapa, etapas, muestra, cifras, conteos, paraHoy } = datos;

  const encabezado = h('section', { class: 'mi-proyecto-cabecera' },
    h('div', { class: 'mi-proyecto-titulo' }, h('h1', { class: 'pagina-titulo', text: proyecto.nombre.replace(/ · .*/, '') }), h('span', { class: `chip-estado ${proyecto.vencido ? 'chip-estado--no_contactar' : 'chip-estado--activa'}`, text: proyecto.vencido ? 'Vencido' : 'Activo' })),
    // En escritorio la etapa y la muestra van en el subtítulo (D1); en celular van en sus propias filas (M1).
    h('p', { class: 'pagina-subtitulo' }, `${nombreDelMes(proyecto.anio, proyecto.mes)} · ${proyecto.nicho}`,
      h('span', { class: 'solo-escritorio' }, `${etapa ? ` · Etapa: ${etapa.nombre} (${diaCorto(etapa.fechaInicio)}–${diaCorto(etapa.fechaFin)})` : ''}${muestra ? ` · Muestra: ${muestra.articulo}${muestra.quedan === null ? '' : `, quedan ${muestra.quedan}`}` : ''}`)),
    etapas.length ? h('ol', { class: 'etapas-barra', 'aria-label': 'Etapas del proyecto' }, etapas.map(e => h('li', { class: `etapa ${ESTADOS_ETAPA[e.estado]}` }, h('span', { class: 'etapa-barra' }), h('span', { class: 'etapa-nombre', text: e.nombre })))) : null,
    etapa ? h('div', { class: 'aviso solo-celular' }, icono('information-circle-outline'), h('div', null, h('div', { class: 'aviso-texto', text: `Etapa: ${etapa.nombre} (${diaCorto(etapa.fechaInicio)}–${diaCorto(etapa.fechaFin)}).${etapa.descripcion ? ` ${etapa.descripcion}.` : ''}` }))) : null,
    muestra ? h('div', { class: 'mi-proyecto-muestra solo-celular' }, icono('gift-outline'), h('span', { text: `Muestra: ${muestra.articulo}${muestra.quedan === null ? '' : ` · quedan ${muestra.quedan}${muestra.total ? ` de ${muestra.total}` : ''}`}` })) : null);

  const cifra = (valor, texto, clase) => h('div', { class: 'cifra' }, h('div', { class: `cifra-valor${clase ? ` ${clase}` : ''}`, text: String(valor) }), h('div', { class: 'cifra-texto', text: texto }));
  const cifras6 = h('div', { class: 'cifras-asesor' },
    cifra(cifras.asignadas, 'Asignadas'), cifra(cifras.gestionadas, 'Gestionadas'), cifra(cifras.interesadas, 'Interesadas'),
    cifra(cifras.cotizadas, 'Cotizadas'), cifra(cifras.vendidas, 'Vendidas', 'cifra-valor--verde'), cifra(`${cifras.efectividad} %`, 'Efectividad'));

  const tarjetaHoy = (f) => h('a', { class: 'tarjeta-hoy', href: `#/empresa/${f.id}` },
    h('div', { class: 'tarjeta-hoy-fila' }, h('strong', { text: f.nombre }), chipGestion(f.estado)),
    f.ciudad ? h('div', { class: 'texto-tenue', text: f.ciudad }) : null,
    f.seguimientoVencido ? h('div', { class: 'alerta-linea alerta-linea--roja' }, icono('warning-outline'), `Seguimiento vencido desde el ${diaCorto(f.proximaGestion)}`)
      : f.proximaGestion ? h('div', { class: 'alerta-linea' }, icono('time-outline'), `Seguimiento: ${textoSeguimiento(f.proximaGestion, false).toLowerCase()}`)
        : h('div', { class: 'alerta-linea alerta-linea--roja' }, icono('warning-outline'), `Sin gestión hace ${f.diasSinGestion} días`));
  const bloqueHoy = h('aside', { class: 'bloque-hoy' },
    h('div', { class: 'bloque-hoy-cabecera' }, h('h2', { class: 'panel-titulo', text: `Para hoy${paraHoy.total ? ` · ${paraHoy.total}` : ''}` }), paraHoy.total ? h('a', { class: 'enlace', href: '#/parahoy', text: `Ver todo (${paraHoy.total})` }) : null),
    paraHoy.primeras.length ? paraHoy.primeras.map(tarjetaHoy) : h('p', { class: 'texto-tenue', text: 'Nada urgente por ahora: ningún seguimiento vence y no hay empresas sin tocar.' }));

  // --- Lista de empresas ---
  let filtro = '';
  let buscar = '';
  let pagina = 1;
  let acumuladas = [];
  let total = 0;
  const zonaLista = h('div', { class: 'mis-empresas' });
  const filas = h('div', { class: 'lista-empresas' });
  let temporizador;

  const fila = (e) => h('div', { class: 'fila-empresa' },
    h('div', { class: 'fila-empresa-nombre' }, h('a', { class: 'cliente-enlace', href: `#/empresa/${e.id}`, text: e.nombre }), h('div', { class: 'texto-tenue', text: [e.ciudad, e.contacto || 'sin contacto'].filter(Boolean).join(' · ') })),
    h('div', { class: 'fila-empresa-estado' }, chipGestion(e.estado)),
    h('div', { class: 'fila-empresa-dato' }, h('span', { class: 'etiqueta-movil', text: 'Última gestión: ' }), textoUltimaGestion(e.ultimaGestion, e.diasSinGestion)),
    h('div', { class: `fila-empresa-dato${e.seguimientoVencido ? ' texto-rojo' : ''}` }, h('span', { class: 'etiqueta-movil', text: 'Seguimiento: ' }), e.proximaGestion || !['vendida', 'perdida', 'descartada'].includes(e.estado) ? textoSeguimiento(e.proximaGestion, e.seguimientoVencido) : '—'),
    h('div', { class: 'fila-empresa-acciones' }, accionesDeContacto(e.telefono)));

  function pintarFilas(cargandoMas = false) {
    const pie = acumuladas.length < total ? h('button', { class: 'btn btn--ghost', type: 'button', disabled: cargandoMas || null, onclick: () => traer(pagina + 1) }, `Cargar más (${total - acumuladas.length})`) : null;
    montar(filas,
      acumuladas.length ? [h('div', { class: 'fila-empresa fila-empresa--titulos', 'aria-hidden': 'true' }, ['Empresa', 'Estado', 'Última gestión', 'Seguimiento', ''].map(t => h('div', { text: t }))), ...acumuladas.map(fila), pie]
        : estadoVacio('No hay empresas con ese filtro', buscar ? 'Prueba con otra búsqueda.' : 'Cambia el filtro para ver las demás.', 'business-outline'));
  }

  async function traer(n) {
    const r = await listarMisEmpresas({ estado: filtro, q: buscar, pagina: n });
    pagina = r.pagina;
    total = r.total;
    acumuladas = n === 1 ? r.empresas : acumuladas.concat(r.empresas);
    pintarFilas();
  }

  function pintarControles() {
    const visibles = FILTROS.filter(([id]) => !id || id === '' || ['pendiente', 'en_gestion', 'interesada', 'cotizada'].includes(id) || (conteos[id] || 0) > 0);
    const entrada = h('input', { type: 'search', placeholder: 'Buscar empresa…', 'aria-label': 'Buscar empresa', maxlength: 80 });
    entrada.value = buscar;
    entrada.addEventListener('input', () => { clearTimeout(temporizador); temporizador = setTimeout(() => { buscar = entrada.value.trim(); traer(1); }, 300); });
    return h('div', { class: 'filtros-empresas' },
      h('div', { class: 'chips' }, visibles.map(([id, t]) => h('button', {
        class: `chip-filtro${filtro === id ? ' chip-filtro--activo' : ''}`, type: 'button',
        onclick: async () => { filtro = id; await traer(1); montar(zonaLista, h('h2', { class: 'panel-titulo', text: 'Mis empresas' }), pintarControles(), filas); }
      }, t, h('span', { class: 'pestana-cuenta', text: String(id === '' ? conteos.todas : (conteos[id] || 0)) })))),
      h('label', { class: 'buscador' }, icono('search-outline'), entrada));
  }

  montar(cont, encabezado, cifras6, tarjetaMeta(datos.meta), h('div', { class: 'mi-proyecto-cuerpo' }, bloqueHoy, zonaLista));
  montar(zonaLista, h('h2', { class: 'panel-titulo', text: 'Mis empresas' }), pintarControles(), filas);
  await traer(1);
}
