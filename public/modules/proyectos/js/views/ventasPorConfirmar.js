// Ventas por confirmar (S19): el supervisor confirma o rechaza (con motivo) las ventas de sus tiendas cuando el administrador
// encendió la confirmación. La venta cuenta al confirmarla. Ruta: #/ventas.
import { h, icono, montar } from '../utils/dom.js';
import { hace } from '../utils/formato.js';
import { aviso, cargando, estadoVacio, avisar } from '../components/ui.js';
import { modalFormulario } from '../components/modalFormulario.js';
import { campoArea } from '../components/campos.js';
import { listarVentasPorConfirmar, confirmarVenta, rechazarVenta } from '../api/api.js';
import { formatoMonto } from '../utils/gestion.js';

const claveNueva = () => (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID().replace(/-/g, '') : `${Date.now()}${Math.random().toString(36).slice(2)}`).slice(0, 40);
const PESTANAS = [['por_confirmar', 'Por confirmar'], ['confirmada', 'Confirmadas'], ['rechazada', 'Rechazadas']];
let pestanaRecordada = 'por_confirmar';

function pedirRechazo(venta, alTerminar) {
  const valores = { motivo: '' };
  const errores = {};
  const clave = claveNueva();
  const nodo = h('form', { class: 'formulario-modal', novalidate: '' });
  const dibujar = () => montar(nodo,
    h('p', { class: 'hoja-subtitulo', text: `${venta.referencia || 'Sin referencia'} · ${formatoMonto(venta.monto, venta.moneda)} · ${venta.empresa}` }),
    campoArea({ valores, errores, clave: 'motivo', etiqueta: 'Motivo (obligatorio)', maximo: 255, prefijoId: 'rechazo', ayuda: 'Se lo avisamos a quien registró la venta. No cuenta en informes.' }));
  dibujar();
  const { overlay } = modalFormulario({
    title: 'Rechazar venta', nodo, aceptar: 'Rechazar venta', peligro: true,
    enviar: async () => {
      if (!valores.motivo.trim()) { errores.motivo = 'Cuenta el motivo del rechazo.'; dibujar(); throw Object.assign(new Error('Revisa los datos.'), { campos: { motivo: errores.motivo } }); }
      await rechazarVenta(venta.id, { motivo: valores.motivo, idempotencyKey: clave });
      avisar('success', 'Venta rechazada', venta.empresa);
      await alTerminar();
    },
    alError: (error) => { if (error.campos) { Object.assign(errores, error.campos); dibujar(); } else avisar('error', 'No se pudo rechazar', error.message); }
  });
  overlay.classList.add('hoja');
}

export async function renderVentasPorConfirmar(cont) {
  montar(cont, cargando());
  const zona = h('div');
  let datos = await listarVentasPorConfirmar(pestanaRecordada);

  async function recargar() { datos = await listarVentasPorConfirmar(pestanaRecordada); dibujar(); }

  async function confirmar(venta, boton) {
    boton.disabled = true;
    try {
      await confirmarVenta(venta.id, claveNueva());
      avisar('success', 'Venta confirmada', `${venta.empresa} · ya cuenta como vendida`);
      await recargar();
    } catch (error) {
      avisar('error', 'No se pudo confirmar', error.message);
      boton.disabled = false;
    }
  }

  function tabla() {
    if (!datos.ventas.length) return h('div', { class: 'tabla-caja' }, estadoVacio('No hay ventas en esta lista', pestanaRecordada === 'por_confirmar' ? 'Cuando un asesor registre una venta que necesite tu confirmación, aparecerá aquí.' : 'Todavía no hay ventas con este estado.', 'checkmark-circle-outline'));
    const enCola = pestanaRecordada === 'por_confirmar';
    return h('div', { class: 'tabla-caja' }, h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table' },
      h('thead', null, h('tr', null, ['Empresa', 'Asesor', 'Monto', 'Referencia (OV)', 'Registrada', enCola ? '' : 'Motivo'].map((t, i) => h('th', { class: i === 2 ? 'num' : null, text: t })))),
      h('tbody', null, datos.ventas.map(v => h('tr', null,
        h('td', null, h('a', { class: 'cliente-enlace', href: `#/participacion/${v.participacionId}`, text: v.empresa })),
        h('td', { text: v.asesor || '—' }), h('td', { class: 'num' }, h('strong', { text: formatoMonto(v.monto, v.moneda) })),
        h('td', { text: v.referencia || '—' }), h('td', { class: 'texto-tenue', text: hace(v.registradaEn) }),
        enCola ? h('td', { class: 'acciones-fila' }, h('div', { class: 'acciones-doble' },
          h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => pedirRechazo(v, recargar) }, 'Rechazar'),
          (() => { const b = h('button', { class: 'btn btn--primary', type: 'button' }, icono('checkmark-outline'), 'Confirmar'); b.addEventListener('click', () => confirmar(v, b)); return b; })()))
          : h('td', { class: 'texto-tenue', text: v.motivo || '' })))))));
  }

  function dibujar() {
    montar(zona,
      !datos.activa ? aviso({ titulo: 'La confirmación de ventas está apagada', texto: 'Las ventas se guardan como confirmadas. Si el administrador la enciende, las nuevas llegarán aquí.' }) : null,
      h('div', { class: 'pestanas', role: 'tablist' }, PESTANAS.map(([id, titulo]) => h('button', {
        class: `pestana${pestanaRecordada === id ? ' pestana-activa' : ''}`, type: 'button', role: 'tab',
        onclick: async () => { pestanaRecordada = id; await recargar(); }
      }, titulo, h('span', { class: 'pestana-cuenta', text: String(datos.conteos[id] || 0) })))),
      tabla(),
      aviso({ titulo: 'Quién confirma', texto: 'Solo quienes tienen el permiso «Confirmar ventas» (se asigna en Roles) y solo las ventas de sus tiendas.' }));
  }

  montar(cont, h('div', { class: 'pagina-cabecera' }, h('div', null, h('h1', { class: 'pagina-titulo', text: 'Ventas por confirmar' }), h('p', { class: 'pagina-subtitulo', text: 'La venta cuenta al confirmarla.' }))), zona);
  dibujar();
}
