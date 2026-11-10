// Ficha de una empresa del asesor (M3 en celular, D2 en escritorio): datos, contactos por área, línea de tiempo, cotizaciones y ventas,
// y los registros. En escritorio la gestión es un panel fijo a la derecha; en celular, una hoja inferior. Ruta: #/empresa/<id>.
import { h, icono, montar } from '../utils/dom.js';
import { hace } from '../utils/formato.js';
import { aviso, cargando } from '../components/ui.js';
import { obtenerFichaDeEmpresa, obtenerOpcionesDeGestion } from '../api/api.js';
import { chipGestion, formatoMonto, hrefLlamar, hrefWhatsApp, diaCorto, horaDe } from '../utils/gestion.js';
import { abrirKit } from './kitAsesor.js';
import { formularioGestion, abrirGestion, abrirCotizacion, abrirVenta, abrirPerdida, abrirDescarte } from './registrosAsesor.js';

const iniciales = (nombre) => String(nombre || '').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '··';
const ICONO_CANAL = { Llamada: 'call-outline', WhatsApp: 'logo-whatsapp', Visita: 'person-outline', Correo: 'mail-outline' };
const ENLACE_EXTERNO = { target: '_blank', rel: 'noopener noreferrer' };

export async function renderEmpresaAsesor(cont, parametro) {
  montar(cont, cargando());
  let ficha;
  try {
    [ficha] = await Promise.all([obtenerFichaDeEmpresa(parametro)]);
  } catch (error) {
    if (error.status !== 404) throw error;
    montar(cont, h('div', { class: 'pagina-cabecera' }, h('div', null, h('h1', { class: 'pagina-titulo', text: 'Empresa no encontrada' }))),
      aviso({ tipo: 'advertencia', titulo: 'No existe o no es tuya', texto: 'Solo puedes ver las empresas que te tocaron en un proyecto. Vuelve a Mi proyecto para ver tu lista.' }),
      h('a', { class: 'btn btn--ghost', href: '#/miproyecto' }, icono('arrow-back-outline'), 'Mi proyecto'));
    return;
  }
  const opciones = await obtenerOpcionesDeGestion();
  pintar(cont, ficha, opciones);
}

function pintar(cont, ficha, opciones) {
  const alGuardar = (nueva) => pintar(cont, nueva, opciones);
  const { empresa, contactos, registro } = ficha;
  const principal = contactos.find(c => c.principal) || contactos[0] || null;
  const telefono = (principal && principal.telefono) || empresa.telefono;
  const correo = contactos.find(c => c.correo);
  const llamar = hrefLlamar(telefono);
  const whatsapp = hrefWhatsApp(telefono);
  const dinero = opciones.monedas;

  const enlaceBoton = (href, nombre, texto, extra = {}) => (href
    ? h('a', { class: 'btn btn--ghost', href, ...extra }, icono(nombre), texto)
    : h('span', { class: 'btn btn--ghost btn--inactivo', title: 'Sin dato de contacto' }, icono(nombre), texto));

  // --- Menú de más acciones ---
  const menu = h('div', { class: 'menu-acciones', hidden: '' },
    h('button', { type: 'button', onclick: () => abrirCotizacion(ficha, opciones, alGuardar) }, icono('document-text-outline'), 'Registrar cotización'),
    h('button', { type: 'button', onclick: () => abrirVenta(ficha, opciones, alGuardar) }, icono('cash-outline'), 'Registrar venta'),
    h('button', { type: 'button', class: 'menu-acciones-peligro', onclick: () => abrirPerdida(ficha, opciones, alGuardar) }, icono('thumbs-down-outline'), 'Marcar como perdida'),
    h('button', { type: 'button', class: 'menu-acciones-peligro', onclick: () => abrirDescarte(ficha, alGuardar) }, icono('close-circle-outline'), 'Descartar empresa'));
  const botonMenu = h('button', { class: 'btn btn--ghost btn--solo-icono', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': 'Más acciones' }, icono('ellipsis-horizontal'));
  botonMenu.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; botonMenu.setAttribute('aria-expanded', String(!menu.hidden)); });
  const cerrarMenu = () => { menu.hidden = true; botonMenu.setAttribute('aria-expanded', 'false'); };
  document.addEventListener('click', function alClic(e) {
    if (!menu.isConnected) { document.removeEventListener('click', alClic); return; }
    if (!menu.contains(e.target)) cerrarMenu();
  });
  menu.addEventListener('click', cerrarMenu);

  // --- Panel de gestión de escritorio ---
  const panelGestion = ficha.abierta ? (() => {
    const f = formularioGestion(ficha, opciones);
    const guardar = h('button', { class: 'btn btn--primary', type: 'button' }, icono('checkmark-outline'), 'Guardar');
    guardar.addEventListener('click', async () => {
      guardar.disabled = true; guardar.classList.add('btn--loading');
      try { alGuardar(await f.enviar()); } catch (error) { f.alError(error); } finally { guardar.disabled = false; guardar.classList.remove('btn--loading'); }
    });
    f.nodo.addEventListener('submit', (e) => { e.preventDefault(); guardar.click(); });
    return h('aside', { class: 'panel panel-gestion', id: 'panel-gestion' }, h('h2', { class: 'panel-titulo', text: 'Registrar gestión' }), f.nodo,
      h('div', { class: 'acciones-panel' }, h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => f.reiniciar() }, 'Cancelar'), guardar));
  })() : null;

  const registrarGestionBtn = ficha.abierta ? h('button', { class: 'btn btn--primary', type: 'button', onclick: () => {
    if (window.matchMedia('(min-width: 1101px)').matches && panelGestion) { panelGestion.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); const c = panelGestion.querySelector('select, input, textarea'); if (c) c.focus(); } else abrirGestion(ficha, opciones, alGuardar);
  } }, icono('add-outline'), 'Registrar gestión') : null;

  // --- Línea de tiempo ---
  const textoDe = (e) => {
    if (e.tipo === 'cotizacion') return `Cotización${e.referencia ? ` ${e.referencia}` : ''} · ${formatoMonto(e.monto, e.moneda, dinero)}`;
    if (e.tipo === 'venta') return `Venta${e.referencia ? ` ${e.referencia}` : ''} · ${formatoMonto(e.monto, e.moneda, dinero)}`;
    if (e.tipo === 'vale') return `Vale de arte ${e.correlativo}`;
    if (e.tipo === 'muestra') return `Muestra entregada: ${e.cantidad}${registro.muestra ? ` × ${registro.muestra.articulo}` : ''}${e.area ? ` · ${e.area}` : ''}`;
    return `${e.canal}${e.contacto ? ` con ${e.contacto}` : ''}: ${e.resultado.charAt(0).toLowerCase()}${e.resultado.slice(1)}`;
  };
  const iconoDe = (e) => ({ cotizacion: 'cart-outline', venta: 'cash-outline', muestra: 'gift-outline', vale: 'document-attach-outline' }[e.tipo] || ICONO_CANAL[e.canal] || 'chatbubble-outline');
  const historial = h('div', { class: 'linea-tiempo' }, ficha.historial.length ? ficha.historial.map(e => h('div', { class: `linea-item${e.anulada ? ' linea-item--anulada' : ''}` },
    icono(iconoDe(e)),
    h('div', null,
      h('div', { class: 'linea-texto', text: textoDe(e) }, e.estadoVenta === 'por_confirmar' ? h('span', { class: 'chip-estado chip-estado--inactiva', text: 'Por confirmar' }) : null, e.anulada ? h('span', { class: 'chip-estado', text: 'Anulada' }) : null),
      e.nota ? h('div', { class: 'linea-nota', text: e.nota }) : null,
      e.proximaEn ? h('div', { class: 'linea-nota', text: `Próximo seguimiento: ${diaCorto(e.proximaEn)} ${horaDe(e.proximaEn)}` }) : null,
      h('div', { class: 'texto-tenue', text: `${hace(e.fecha)} · ${e.usuario}` })))) : h('p', { class: 'texto-tenue', text: 'Todavía no hay nada registrado. Empieza con «Registrar gestión».' }));

  const dineroFilas = ficha.historial.filter(e => e.tipo === 'cotizacion' || e.tipo === 'venta');
  const tablaDinero = dineroFilas.length ? h('div', { class: 'tabla-caja' }, h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table' },
    h('thead', null, h('tr', null, ['Tipo', 'Referencia', 'Monto', 'Estado'].map(t => h('th', { text: t })))),
    h('tbody', null, dineroFilas.map(e => h('tr', null,
      h('td', { text: e.tipo === 'venta' ? 'Venta' : 'Cotización' }), h('td', { text: e.referencia || '—' }), h('td', { text: formatoMonto(e.monto, e.moneda, dinero) }),
      h('td', null, e.anulada ? h('span', { class: 'chip-estado', text: 'Anulada' }) : e.tipo === 'cotizacion' ? chipGestion('cotizada') : e.estadoVenta === 'por_confirmar' ? h('span', { class: 'chip-estado chip-estado--inactiva', text: 'Por confirmar' }) : chipGestion('vendida')))))))) : null;

  const enlaceSitio = empresa.sitioWeb ? h('a', { class: 'cliente-enlace', href: /^https?:\/\//i.test(empresa.sitioWeb) ? empresa.sitioWeb : `https://${empresa.sitioWeb}`, ...ENLACE_EXTERNO, text: empresa.sitioWeb.replace(/^https?:\/\//i, '') }) : null;
  const datosEmpresa = h('div', { class: 'tarjeta-datos' },
    [['location-outline', [empresa.direccion, empresa.ciudad].filter(Boolean).join(', ')], ['call-outline', empresa.telefono], ['link-outline', enlaceSitio], ['business-outline', empresa.estructura]]
      .filter(([, v]) => v).map(([nombre, valor]) => h('div', { class: 'tarjeta-datos-fila' }, icono(nombre), typeof valor === 'string' ? h('span', { text: valor }) : valor)));

  const contactosNodo = contactos.length ? contactos.map(c => h('div', { class: 'contacto-tarjeta' },
    h('span', { class: 'avatar-contacto', text: iniciales(c.nombre) }),
    h('div', { class: 'contacto-datos' }, h('strong', { text: c.nombre }), h('div', { class: 'texto-tenue', text: [c.cargo || c.area, c.telefono].filter(Boolean).join(' · ') }), c.cargo ? h('div', { class: 'texto-tenue', text: c.area }) : null),
    hrefLlamar(c.telefono) ? h('a', { class: 'btn btn--ghost btn--solo-icono', href: hrefLlamar(c.telefono), 'aria-label': `Llamar a ${c.nombre}` }, icono('call-outline')) : null))
    : [h('p', { class: 'texto-tenue', text: 'Esta empresa todavía no tiene contactos.' })];

  montar(cont,
    h('nav', { class: 'migas', 'aria-label': 'Ruta' }, h('a', { href: '#/miproyecto' }, icono('arrow-back-outline'), 'Mi proyecto'), h('span', { text: ` / ${empresa.nombre}` })),
    h('div', { class: 'pagina-cabecera pagina-cabecera--ficha' },
      h('div', null, h('div', { class: 'mi-proyecto-titulo' }, h('h1', { class: 'pagina-titulo', text: empresa.nombre }), chipGestion(ficha.estado)),
        h('p', { class: 'pagina-subtitulo', text: [empresa.nicho, empresa.estructura, empresa.ciudad].filter(Boolean).join(' · ') })),
      h('div', { class: 'acciones-cabecera acciones-ficha' },
        enlaceBoton(llamar, 'call-outline', 'Llamar'), enlaceBoton(whatsapp, 'logo-whatsapp', 'WhatsApp', ENLACE_EXTERNO), correo ? enlaceBoton(`mailto:${correo.correo}`, 'mail-outline', 'Correo') : null,
        ficha.abierta ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => abrirKit(ficha.id) }, icono('chatbubbles-outline'), 'Mensajes y guion') : null,
        registro.puedeCrearVale ? h('a', { class: 'btn btn--ghost', href: `/modules/vales/?prellenar=proyectos:${ficha.id}` }, icono('link-outline'), 'Crear vale') : null,
        ficha.abierta ? h('div', { class: 'menu-contenedor' }, botonMenu, menu) : null, registrarGestionBtn)),
    !ficha.abierta ? aviso({ tipo: 'advertencia', titulo: ficha.estado === 'descartada' ? 'Empresa descartada' : 'Solo consulta', texto: ficha.estado === 'descartada' ? 'La descartaste de este proyecto: ya no recibe registros.' : `«${ficha.proyecto.nombre}» ya no está activo: puedes ver lo que se hizo, pero no registrar nada nuevo.` }) : null,
    ficha.seguimientoVencido ? aviso({ tipo: 'error', titulo: `Seguimiento vencido desde el ${diaCorto(ficha.proximaGestion)}`, texto: 'Registra una gestión para fijar la nueva fecha.' }) : null,
    h('div', { class: `ficha-asesor${panelGestion ? '' : ' ficha-asesor--sin-panel'}` },
      h('div', { class: 'ficha-asesor-col' }, datosEmpresa, h('h2', { class: 'panel-titulo', text: 'Contactos por área' }), contactosNodo),
      h('div', { class: 'ficha-asesor-col' }, h('h2', { class: 'panel-titulo', text: 'Historial' }), historial, tablaDinero ? [h('h2', { class: 'panel-titulo', text: 'Cotizaciones y ventas' }), tablaDinero] : null),
      panelGestion));
}
