// Una empresa vista por el supervisor (T4): ficha en solo lectura con su historial y dinero, Reasignar y Anular (T3c).
// Si es de otra tienda llega «Otra tienda»: sin contactos, historial ni montos, y sin acciones. Ruta: #/participacion/<id>.
import { h, icono, montar } from '../utils/dom.js';
import { hace } from '../utils/formato.js';
import { aviso, cargando, avisar } from '../components/ui.js';
import { modalFormulario } from '../components/modalFormulario.js';
import { campoArea } from '../components/campos.js';
import { obtenerSupervision, anularCotizacion, anularVenta, anularGestion } from '../api/api.js';
import { chipGestion, formatoMonto, hrefLlamar, diaCorto, horaDe } from '../utils/gestion.js';
import { abrirReasignar } from './seguimiento.js';

const ICONO_CANAL = { Llamada: 'call-outline', WhatsApp: 'logo-whatsapp', Visita: 'person-outline', Correo: 'mail-outline' };
const claveNueva = () => (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID().replace(/-/g, '') : `${Date.now()}${Math.random().toString(36).slice(2)}`).slice(0, 40);
const iniciales = (nombre) => String(nombre || '').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '··';

export async function renderSupervisionEmpresa(cont, parametro) {
  montar(cont, cargando());
  let ficha;
  try {
    ficha = await obtenerSupervision(parametro);
  } catch (error) {
    if (error.status !== 404) throw error;
    montar(cont, h('div', { class: 'pagina-cabecera' }, h('div', null, h('h1', { class: 'pagina-titulo', text: 'Empresa no encontrada' }))),
      aviso({ tipo: 'advertencia', titulo: 'No existe o no es de tus tiendas', texto: 'Solo ves las empresas de proyectos que incluyen alguna de tus tiendas.' }),
      h('a', { class: 'btn btn--ghost', href: '#/seguimiento' }, icono('arrow-back-outline'), 'Seguimiento'));
    return;
  }
  pintar(cont, ficha);
}

// T3c: pide el motivo y anula. Recibe la fila del historial (cotización o venta).
function pedirAnulacion(ficha, fila, alTerminar) {
  const esVenta = fila.tipo === 'venta';
  const esGestion = fila.tipo === 'gestion';
  const nombre = esVenta ? 'venta' : esGestion ? 'gestión' : 'cotización';
  const valores = { motivo: '' };
  const errores = {};
  const clave = claveNueva();
  const nodo = h('form', { class: 'formulario-modal', novalidate: '' });
  const dibujar = () => montar(nodo,
    h('p', { class: 'hoja-subtitulo', text: esGestion ? `${fila.canal}: ${fila.resultado} · ${ficha.empresa.nombre}` : `${fila.referencia ? `${fila.referencia} · ` : ''}${formatoMonto(fila.monto, fila.moneda)} · ${ficha.empresa.nombre}` }),
    campoArea({ valores, errores, clave: 'motivo', etiqueta: 'Motivo (obligatorio)', maximo: 255, prefijoId: 'anular', ayuda: esGestion ? 'No cuenta en informes y queda en el historial. La empresa vuelve al estado que le corresponde sin esta gestión. Las muestras entregadas en ella no se devuelven a la existencia.' : `No cuenta en informes y queda en el historial. La empresa vuelve a «${esVenta ? 'Cotizada' : 'Interesada'}» si no tiene otros registros.` }));
  dibujar();
  const { overlay } = modalFormulario({
    title: `Anular ${nombre}`, nodo, aceptar: `Anular ${nombre}`, peligro: true,
    enviar: async () => {
      if (!valores.motivo.trim()) { errores.motivo = 'Cuenta el motivo de la anulación: queda en el historial.'; dibujar(); throw Object.assign(new Error('Revisa los datos.'), { campos: { motivo: errores.motivo } }); }
      const nueva = await (esVenta ? anularVenta : esGestion ? anularGestion : anularCotizacion)(ficha.id, fila.id, { motivo: valores.motivo, idempotencyKey: clave });
      avisar('success', `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} anulada`, ficha.empresa.nombre);
      alTerminar(nueva);
    },
    alError: (error) => { if (error.campos) { Object.assign(errores, error.campos); dibujar(); } else avisar('error', 'No se pudo anular', error.message); }
  });
  overlay.classList.add('hoja');
}

function pintar(cont, ficha) {
  if (ficha.otraTienda) {
    montar(cont,
      h('nav', { class: 'migas' }, h('a', { href: '#/seguimiento' }, icono('arrow-back-outline'), 'Seguimiento')),
      h('div', { class: 'tabla-caja' }, h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table' },
        h('thead', null, h('tr', null, ['Empresa', 'Asesor', 'Estado', 'Contacto', 'Monto', 'Acciones'].map(t => h('th', { text: t })))),
        h('tbody', null, h('tr', { class: 'fila-otra-tienda' },
          h('td', null, h('strong', { text: ficha.empresa }), h('div', { class: 'texto-tenue', text: ficha.ciudad || '' })), h('td', { text: ficha.asesor || '—' }), h('td', null, chipGestion(ficha.estado)),
          h('td', null, h('span', { class: 'texto-candado' }, icono('lock-closed-outline'), 'Sin contactos')), h('td', null, h('span', { class: 'texto-candado' }, icono('lock-closed-outline'), 'Sin montos')),
          h('td', null, h('span', { class: 'texto-candado' }, icono('lock-closed-outline'), 'Solo lectura')))))) ),
      aviso({ titulo: 'Regla de alcance: ver no da poder de actuar', texto: 'Solo ves empresa y etapa. Contactos, referencias y montos van vacíos.' }));
    return;
  }
  const alActualizar = (nueva) => pintar(cont, nueva);
  const { empresa } = ficha;
  const textoDe = (e) => {
    if (e.tipo === 'cotizacion') return `Cotización${e.referencia ? ` ${e.referencia}` : ''} · ${formatoMonto(e.monto, e.moneda)}`;
    if (e.tipo === 'venta') return `Venta${e.referencia ? ` ${e.referencia}` : ''} · ${formatoMonto(e.monto, e.moneda)}`;
    if (e.tipo === 'muestra') return `Muestra entregada: ${e.cantidad}${e.area ? ` · ${e.area}` : ''}`;
    return `${e.canal}${e.contacto ? ` con ${e.contacto}` : ''}: ${e.resultado.charAt(0).toLowerCase()}${e.resultado.slice(1)}`;
  };
  const iconoDe = (e) => ({ cotizacion: 'cart-outline', venta: 'cash-outline', muestra: 'gift-outline' }[e.tipo] || ICONO_CANAL[e.canal] || 'chatbubble-outline');
  const historial = h('div', { class: 'linea-tiempo' }, ficha.historial.length ? ficha.historial.map(e => h('div', { class: `linea-item${e.anulada ? ' linea-item--anulada' : ''}` },
    icono(iconoDe(e)),
    h('div', { class: 'linea-contenido' },
      h('div', { class: 'linea-texto' }, textoDe(e), e.estadoVenta === 'por_confirmar' ? h('span', { class: 'chip-estado chip-estado--inactiva', text: 'Por confirmar' }) : null, e.estadoVenta === 'rechazada' ? h('span', { class: 'chip-estado chip-estado--no_contactar', text: 'Rechazada' }) : null, e.anulada ? h('span', { class: 'chip-estado', text: 'Anulada' }) : null),
      e.nota ? h('div', { class: 'linea-nota', text: e.nota }) : null,
      e.proximaEn ? h('div', { class: 'linea-nota', text: `Próximo seguimiento: ${diaCorto(e.proximaEn)} ${horaDe(e.proximaEn)}` }) : null,
      h('div', { class: 'texto-tenue', text: `${hace(e.fecha)} · ${e.usuario}` })),
    ficha.permisos.anular && ['cotizacion', 'venta', 'gestion'].includes(e.tipo) && !e.anulada && e.estadoVenta !== 'rechazada'
      ? h('button', { class: 'btn-enlace btn-enlace--peligro', type: 'button', onclick: () => pedirAnulacion(ficha, e, alActualizar) }, icono('close-circle-outline'), 'Anular') : null)) : h('p', { class: 'texto-tenue', text: 'Todavía no hay nada registrado.' }));

  const contactos = ficha.contactos.length ? ficha.contactos.map(c => h('div', { class: 'contacto-tarjeta' },
    h('span', { class: 'avatar-contacto', text: iniciales(c.nombre) }),
    h('div', { class: 'contacto-datos' }, h('strong', { text: c.nombre }), h('div', { class: 'texto-tenue', text: [c.cargo || c.area, c.telefono].filter(Boolean).join(' · ') })),
    hrefLlamar(c.telefono) ? h('a', { class: 'btn btn--ghost btn--solo-icono', href: hrefLlamar(c.telefono), 'aria-label': `Llamar a ${c.nombre}` }, icono('call-outline')) : null)) : [h('p', { class: 'texto-tenue', text: 'Esta empresa todavía no tiene contactos.' })];

  montar(cont,
    h('nav', { class: 'migas', 'aria-label': 'Ruta' }, h('a', { href: '#/seguimiento' }, icono('arrow-back-outline'), 'Seguimiento'), h('span', { text: ` / ${empresa.nombre}` })),
    h('div', { class: 'pagina-cabecera pagina-cabecera--ficha' },
      h('div', null, h('div', { class: 'mi-proyecto-titulo' }, h('h1', { class: 'pagina-titulo', text: empresa.nombre }), chipGestion(ficha.estado)),
        h('p', { class: 'pagina-subtitulo', text: `${ficha.asesor ? `Asesor: ${ficha.asesor}` : 'Sin asesor'} · ${ficha.tienda || ''} · ${ficha.proyecto.nombre}` })),
      ficha.permisos.reasignar ? h('button', { class: 'btn btn--primary', type: 'button', onclick: () => abrirReasignar({ proyectoId: ficha.proyecto.id, empresas: [{ id: ficha.id, empresa: empresa.nombre }], alTerminar: async () => { pintar(cont, await obtenerSupervision(ficha.id)); } }) }, icono('swap-horizontal-outline'), 'Reasignar') : null),
    !ficha.abierta ? aviso({ tipo: 'advertencia', titulo: 'Solo consulta', texto: 'El proyecto ya no está activo o la empresa quedó cerrada: no admite cambios.' }) : null,
    h('div', { class: 'ficha-asesor ficha-asesor--sin-panel' },
      h('div', { class: 'ficha-asesor-col' },
        h('div', { class: 'tarjeta-datos' }, [['location-outline', [empresa.direccion, empresa.ciudad].filter(Boolean).join(', ')], ['call-outline', empresa.telefono], ['business-outline', empresa.estructura]].filter(([, v]) => v).map(([n, v]) => h('div', { class: 'tarjeta-datos-fila' }, icono(n), h('span', { text: v })))),
        h('h2', { class: 'panel-titulo', text: 'Contactos por área' }), contactos),
      h('div', { class: 'ficha-asesor-col' }, h('h2', { class: 'panel-titulo', text: 'Historial' }), historial)));
}
