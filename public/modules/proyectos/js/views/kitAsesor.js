// M15 · Mensajes y guion del nicho, desde la ficha de la empresa del asesor. El servidor ya reemplaza las variables con los datos de
// la empresa; el portal no envía nada: «Abrir en WhatsApp» o «Abrir en correo» abren la aplicación con el texto escrito.
import { h, icono, montar } from '../utils/dom.js';
import { abrirModal } from '../components/modal.js';
import { avisar, cargando } from '../components/ui.js';
import { obtenerKitDeEmpresa } from '../api/api.js';

const NOMBRE_CANAL = { whatsapp: 'WhatsApp', correo: 'Correo' };
const ICONO_CANAL = { whatsapp: 'logo-whatsapp', correo: 'mail-outline' };

function tarjeta(m) {
  const boton = m.disponible
    ? h('a', { class: 'btn btn--primary btn--chico', href: m.enlace, target: m.canal === 'whatsapp' ? '_blank' : null, rel: 'noopener' }, icono(ICONO_CANAL[m.canal]), m.canal === 'whatsapp' ? 'Abrir en WhatsApp' : 'Abrir en correo')
    : null;
  return h('article', { class: `tarjeta-hoy kit-tarjeta${m.disponible ? '' : ' kit-tarjeta--oculta'}` },
    h('div', { class: 'tarjeta-hoy-fila' }, h('strong', { text: m.titulo }), h('span', { class: 'chip-estado', text: NOMBRE_CANAL[m.canal] })),
    m.disponible ? h('p', { class: 'kit-texto', text: m.texto }) : h('div', { class: 'alerta-linea' }, icono('eye-off-outline'), `Oculto: ${m.motivo}`),
    boton);
}

// Abre la hoja con el kit del nicho de la empresa (`participacionId`). Si el nicho no tiene kit, lo dice y no abre nada raro.
export async function abrirKit(participacionId) {
  let datos;
  try {
    datos = await obtenerKitDeEmpresa(participacionId);
  } catch (error) {
    avisar('error', 'No se pudo abrir el kit', error.message);
    return;
  }
  if (!datos.disponible) { avisar('info', 'Este nicho no tiene kit', 'El administrador todavía no escribió guion ni mensajes para este nicho.'); return; }

  const { overlay } = abrirModal({ title: 'Mensajes y guion', bodyHtml: '' });
  overlay.classList.add('hoja');
  const cuerpo = overlay.querySelector('.modal-body');
  let pestana = datos.mensajes.length ? 'mensajes' : 'guion';
  const zona = h('div', { class: 'kit-zona' });
  const pestanas = h('div', { class: 'segmentos', role: 'tablist' });

  const dibujar = () => {
    montar(pestanas, [['mensajes', 'Mensajes'], ['guion', 'Guion de llamada']].map(([clave, texto]) => h('button', {
      class: `segmento${pestana === clave ? ' segmento--activo' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(pestana === clave), onclick: () => { pestana = clave; dibujar(); }
    }, texto)));
    if (pestana === 'guion') {
      montar(zona, datos.guion ? h('div', { class: 'kit-guion' }, datos.guion.split('\n').filter(l => l.trim()).map(l => h('p', { text: l })))
        : h('p', { class: 'texto-tenue', text: 'Este nicho todavía no tiene guion de llamada.' }));
    } else {
      const visibles = datos.mensajes.filter(m => m.disponible);
      const ocultos = datos.mensajes.filter(m => !m.disponible);
      montar(zona,
        datos.mensajes.length ? [...visibles, ...ocultos].map(tarjeta) : h('p', { class: 'texto-tenue', text: 'Este nicho todavía no tiene mensajes.' }),
        h('p', { class: 'texto-tenue texto-tenue--chico', text: 'El portal no envía nada: se abre WhatsApp o tu correo con el texto listo y tú lo envías.' }));
    }
  };

  cuerpo.append(h('p', { class: 'texto-tenue', text: `Kit de ${datos.nicho} · datos de ${datos.empresa}${datos.contacto ? ` (${datos.contacto})` : ''}` }), pestanas, zona);
  dibujar();
}
