// «¿Qué vas a hacer?» de la ficha de una empresa: tres botones — Contactar, Registrar y Crear vale — en lugar de una fila de botones sueltos.
// Contactar lista a las personas de la empresa (la principal primero) con Llamar, WhatsApp y Correo; Registrar agrupa lo que se anota
// (gestión, cotización, venta) y, aparte, perdida y descartar. En escritorio se despliegan bajo el botón; en celular, como hoja inferior.
import { h, icono } from '../utils/dom.js';
import { hrefLlamar, hrefWhatsApp } from '../utils/gestion.js';

const EXTERNO = { target: '_blank', rel: 'noopener noreferrer' };
const iniciales = (nombre) => String(nombre || '').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '··';
const cerradores = [];

function cerrarTodos() { cerradores.forEach(cerrar => cerrar()); }

// Un botón con su panel. `contenido` se arma al abrir para reflejar lo último; el panel se cierra al elegir algo, al hacer clic fuera o con Escape.
function botonConPanel({ texto, nombreIcono, titulo, subtitulo, contenido }) {
  const panel = h('div', { class: 'que-hacer-panel', hidden: '', role: 'group', 'aria-label': titulo });
  const fondo = h('div', { class: 'que-hacer-fondo', hidden: '' });
  const boton = h('button', { class: 'btn btn--ghost que-hacer-boton', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false' },
    icono(nombreIcono), texto, icono('chevron-down-outline'));
  const cerrar = () => {
    if (panel.hidden) return;
    panel.hidden = true; fondo.hidden = true; boton.setAttribute('aria-expanded', 'false'); boton.classList.remove('que-hacer-boton--abierto');
  };
  const abrir = () => {
    cerrarTodos();
    panel.replaceChildren(h('div', { class: 'que-hacer-cabecera' },
      h('div', null, h('div', { class: 'que-hacer-titulo', text: titulo }), subtitulo ? h('div', { class: 'texto-tenue', text: subtitulo }) : null),
      h('button', { class: 'btn btn--ghost btn--solo-icono que-hacer-cerrar', type: 'button', 'aria-label': 'Cerrar', onclick: cerrar }, icono('close-outline'))), contenido());
    panel.hidden = false; fondo.hidden = false; boton.setAttribute('aria-expanded', 'true'); boton.classList.add('que-hacer-boton--abierto');
    const primero = panel.querySelector('a[href], button:not(.que-hacer-cerrar)');
    if (primero) primero.focus({ preventScroll: true });
  };
  boton.addEventListener('click', (e) => { e.stopPropagation(); if (panel.hidden) abrir(); else cerrar(); });
  fondo.addEventListener('click', cerrar);
  panel.addEventListener('click', (e) => { if (e.target.closest('a[href], .que-hacer-opcion')) cerrar(); e.stopPropagation(); });
  cerradores.push(cerrar);
  return { nodo: h('div', { class: 'que-hacer-contenedor' }, boton, fondo, panel), cerrar };
}

const accionDeContacto = (texto, nombreIcono, href, sinDato, extra = {}) => (href
  ? h('a', { class: 'btn btn--ghost btn--chico que-hacer-accion', href, ...extra }, icono(nombreIcono), texto)
  : h('span', { class: 'btn btn--ghost btn--chico que-hacer-accion que-hacer-accion--apagada', 'aria-disabled': 'true' }, icono(nombreIcono), sinDato));

function tarjetaDePersona(p) {
  return h('div', { class: 'que-hacer-persona' },
    h('div', { class: 'que-hacer-persona-datos' },
      h('span', { class: 'avatar-contacto', text: iniciales(p.nombre) }),
      h('div', null,
        h('div', { class: 'que-hacer-persona-nombre' }, h('strong', { text: p.nombre }), p.principal ? h('span', { class: 'chip-estado chip-estado--principal', text: 'Principal' }) : null),
        h('div', { class: 'texto-tenue', text: [p.cargo || p.area, p.telefono].filter(Boolean).join(' · ') }))),
    h('div', { class: 'que-hacer-persona-acciones' },
      accionDeContacto('Llamar', 'call-outline', hrefLlamar(p.telefono), 'Sin teléfono'),
      accionDeContacto('WhatsApp', 'logo-whatsapp', hrefWhatsApp(p.telefono), 'Sin teléfono', EXTERNO),
      accionDeContacto('Correo', 'mail-outline', p.correo ? `mailto:${p.correo}` : null, 'Sin correo')));
}

const opcion = (texto, detalle, nombreIcono, alElegir, peligro = false, destacada = false) => h('button', {
  class: `que-hacer-opcion${peligro ? ' que-hacer-opcion--peligro' : ''}${destacada ? ' que-hacer-opcion--destacada' : ''}`, type: 'button', onclick: alElegir
}, nombreIcono ? icono(nombreIcono) : h('span', { class: 'que-hacer-sin-icono' }), h('span', null, h('strong', { text: texto }), h('small', { text: detalle })));

// `ficha`: la ficha de la empresa; `acciones`: { gestion, cotizacion, venta, perdida, descarte, kit } (funciones sin argumentos); `hrefVale`: enlace a Vales o null.
export function accionesFicha({ ficha, acciones, hrefVale }) {
  cerradores.length = 0;
  const { empresa, contactos } = ficha;
  // La persona principal va primero; si la empresa no tiene personas, su teléfono hace de contacto único.
  const personas = contactos.length
    ? [...contactos].sort((a, b) => Number(Boolean(b.principal)) - Number(Boolean(a.principal)))
    : [{ nombre: empresa.nombre, area: 'Teléfono de la empresa', telefono: empresa.telefono, correo: null, principal: false }];

  const contactar = botonConPanel({
    texto: 'Contactar', nombreIcono: 'call-outline', titulo: 'Contactar', subtitulo: personas.length > 1 ? `${empresa.nombre} · elige a quién` : empresa.nombre,
    contenido: () => h('div', { class: 'que-hacer-lista' },
      personas.map(tarjetaDePersona),
      ficha.abierta ? opcion('Mensajes y guion del nicho', 'Textos listos para enviar o leer en la llamada', 'chatbubbles-outline', acciones.kit) : null)
  });

  const registrar = ficha.abierta ? botonConPanel({
    texto: 'Registrar', nombreIcono: 'add-outline', titulo: 'Registrar', subtitulo: `${empresa.nombre} · lo que pasó`,
    contenido: () => h('div', { class: 'que-hacer-lista' },
      opcion('Registrar gestión', 'Llamada, WhatsApp, visita o correo', 'add-outline', acciones.gestion, false, true),
      opcion('Registrar cotización', 'Monto, referencia y fecha', 'document-text-outline', acciones.cotizacion),
      opcion('Registrar venta', 'La empresa pasa a «Vendida»', 'cash-outline', acciones.venta),
      h('hr', { class: 'que-hacer-separador' }),
      opcion('Marcar como perdida', 'Con el motivo de pérdida', null, acciones.perdida, true),
      opcion('Descartar empresa', 'No contactar o dato incorrecto', null, acciones.descarte, true))
  }) : null;

  document.addEventListener('click', function alClic() {
    if (!contactar.nodo.isConnected) { document.removeEventListener('click', alClic); document.removeEventListener('keydown', alTecla); return; }
    cerrarTodos();
  });
  function alTecla(e) { if (e.key === 'Escape') cerrarTodos(); }
  document.addEventListener('keydown', alTecla);

  return h('div', { class: 'que-hacer' },
    h('div', { class: 'que-hacer-rotulo', text: '¿Qué vas a hacer?' }),
    h('div', { class: 'que-hacer-fila' },
      contactar.nodo, registrar ? registrar.nodo : null,
      hrefVale ? h('a', { class: 'btn btn--ghost que-hacer-boton', href: hrefVale }, icono('link-outline'), 'Crear vale') : null));
}
