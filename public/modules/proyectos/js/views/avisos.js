// Notificaciones (A8): qué eventos avisan, a quién y con cuánta anticipación. Para el administrador. Ruta: #/notificaciones.
// Cada cambio se guarda al momento; lo que no cambió queda en su valor por defecto («Restaurar valores por defecto» lo vuelve a poner).
import { h, icono, montar } from '../utils/dom.js';
import { cabecera, cargando, avisar, interruptor } from '../components/ui.js';
import { confirmarModal } from '../components/modal.js';
import { obtenerAvisos, guardarAvisos, restaurarAvisos } from '../api/api.js';

const ETIQUETA_ROL = { asesor: 'Asesor', supervisor: 'Supervisor', gerente: 'Gerente' };

export async function renderAvisos(cont) {
  montar(cont, cargando());
  let datos = await obtenerAvisos();
  const zona = h('div');

  async function guardar(cambios, enlace) {
    try {
      const nuevo = await guardarAvisos(cambios);
      datos = nuevo;
      avisar('success', 'Avisos guardados', 'El cambio vale desde ya.');
    } catch (error) {
      avisar('error', 'No se pudo guardar', error.message);
    }
    dibujar(enlace);
  }

  async function restaurar() {
    if (!(await confirmarModal({ title: 'Restaurar valores por defecto', mensaje: 'Todos los avisos y sus anticipaciones vuelven a los valores originales del módulo. ¿Quieres continuar?', aceptar: 'Restaurar' }))) return;
    try { datos = await restaurarAvisos(); avisar('success', 'Valores restaurados', 'Los avisos volvieron a su configuración original.'); } catch (error) { avisar('error', 'No se pudo restaurar', error.message); }
    dibujar();
  }

  function celda(evento, rol) {
    const c = evento.roles[rol];
    if (!c.aplica) return h('td', { class: 'celda-centro texto-tenue', text: '—' });
    return h('td', { class: 'celda-centro' }, interruptor({ marcado: c.activo, etiqueta: `${evento.nombre}: avisar a ${ETIQUETA_ROL[rol].toLowerCase()}`, alCambiar: (activo) => guardar({ celdas: [{ evento: evento.clave, rol, activo }] }) }));
  }

  function anticipacion(evento) {
    const a = evento.anticipacion;
    if (!a) return h('td', { class: 'celda-centro texto-tenue', text: '—' });
    const entrada = h('input', { class: 'entrada-anticipacion', type: 'number', min: String(a.min), max: String(a.max), step: '1', 'aria-label': `Anticipación de ${evento.nombre}` });
    entrada.value = String(a.valor);
    entrada.addEventListener('change', () => guardar({ anticipaciones: { [evento.clave]: Number(entrada.value) } }));
    return h('td', { class: 'celda-centro' }, h('label', { class: 'anticipacion' }, entrada, h('span', { text: a.texto })));
  }

  function dibujar() {
    montar(zona,
      h('div', { class: 'tabla-caja' }, h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table tabla-avisos' },
        h('thead', null, h('tr', null, [h('th', { text: 'Evento' }), ...datos.roles.map(r => h('th', { class: 'celda-centro', text: ETIQUETA_ROL[r] })), h('th', { class: 'celda-centro', text: 'Anticipación' })])),
        h('tbody', null, datos.eventos.map(e => h('tr', null,
          h('td', null, h('strong', { text: e.nombre }), h('div', { class: 'texto-tenue', text: e.grupo })),
          ...datos.roles.map(r => celda(e, r)), anticipacion(e))))))),
      h('p', { class: 'texto-tenue', text: 'Nunca se avisa a quien hace la acción. Los recordatorios (seguimiento que vence, proyecto por cerrar) los revisa el sistema cada 15 minutos.' }));
  }

  montar(cont,
    cabecera({
      titulo: 'Notificaciones', subtitulo: 'Qué eventos avisan, a quién y con cuánta anticipación.',
      acciones: h('button', { class: 'btn btn--ghost', type: 'button', onclick: restaurar }, icono('refresh-outline'), 'Restaurar valores por defecto')
    }),
    zona);
  dibujar();
}
