// Pinta la pestaña activa en #panel-content con su estado de carga o de error.
import { state } from '../state.js';
import { $, h, icono, montar } from '../utils/dom.js';
import { TABS } from '../config/constantes.js';
import { t } from '../textos.js';
import { registrarRecarga } from '../socket.js';
import { renderSolicitudes } from '../views/solicitudes.js';
import { renderGestiones } from '../views/gestiones.js';
import { renderConfiguracion } from '../views/configuracion.js';

const VISTAS = {
  [TABS.SOLICITUDES]: renderSolicitudes,
  [TABS.GESTIONES]: renderGestiones,
  [TABS.CONFIGURACION]: renderConfiguracion
};

let cargaActual = 0;

const estadoVacio = (nombreIcono, titulo, texto, extra = '') => h('div', { class: `buzon-vacio ${extra}`.trim() },
  icono(nombreIcono), titulo && h('h3', { text: titulo }), h('p', { text: texto }));

export async function cargarTab() {
  const cont = $('#panel-content');
  const carga = ++cargaActual;
  // La vista anterior deja de refrescarse y suelta lo que tuviera sin guardar.
  registrarRecarga(null);
  if (state.salidaVista) { state.salidaVista.liberar(); state.salidaVista = null; }
  document.body.classList.remove('vista-tabla-fija');

  if (!state.tab) {
    montar(cont, estadoVacio('lock-closed-outline', t('shell.sinSecciones.titulo'), t('shell.sinSecciones.texto')));
    return;
  }
  const spinner = estadoVacio('sync-outline', null, t('shell.cargando'));
  spinner.querySelector('ion-icon').classList.add('spin-animation');
  montar(cont, spinner);
  try {
    await VISTAS[state.tab](cont);
  } catch (error) {
    // Un error tardío de una pestaña ya abandonada no pisa la pantalla actual.
    if (carga !== cargaActual) return;
    const panel = estadoVacio('alert-circle-outline', t('shell.errorCarga.titulo'), error.message, 'buzon-vacio-error');
    panel.append(h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: t('comun.reintentar'), onclick: () => cargarTab() }));
    montar(cont, panel);
  }
}
