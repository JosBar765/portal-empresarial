// Orquestador del módulo Calculadora de Viáticos: sesión, contexto y wiring del layout y del tiempo real.
import { state } from './state.js';
import { PERMISOS } from './config/constantes.js';
import { sessionCheck } from './api/authApi.js';
import { obtenerContexto } from './api/viaticosApi.js';
import { iniciarCuenta } from './layout/cuenta.js';
import { wireSidebar } from './layout/sidebar.js';
import { cargarTab } from './layout/panel.js';
import { initSocket } from './socket.js';
import { $, h, icono, montar } from './utils/dom.js';
import { t } from './textos.js';

// El encabezado se achica en celulares: el menú lateral y los altos fijos usan su alto real, no el de escritorio.
function seguirAltoEncabezado() {
  const encabezado = document.querySelector('.app-header');
  if (!encabezado) return;
  const fijar = () => document.documentElement.style.setProperty('--header-height', `${encabezado.offsetHeight}px`);
  fijar();
  if ('ResizeObserver' in window) new ResizeObserver(fijar).observe(encabezado);
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const sessionData = await sessionCheck();
    if (!sessionData.autenticado) { window.location.href = '/login/?expired=true'; return; }
    state.user = sessionData.user;
    if (!(state.user.permissions || []).includes(PERMISOS.VER)) { window.location.href = '/dashboard/'; return; }
  } catch (error) {
    window.location.href = '/login/?error=conexion';
    return;
  }

  iniciarCuenta();
  seguirAltoEncabezado();

  try {
    state.contexto = await obtenerContexto();
  } catch (error) {
    // Sin contexto no hay módulo: se explica el motivo y se ofrece reintentar en vez de dejar la pantalla cargando.
    const panel = h('div', { class: 'buzon-vacio buzon-vacio-error' },
      icono('alert-circle-outline'),
      h('h3', { text: t('shell.errorCarga.titulo') }),
      h('p', { text: error.message }),
      h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: t('comun.reintentar'), onclick: () => window.location.reload() }));
    montar($('#panel-content'), panel);
    return;
  }

  wireSidebar();
  initSocket();
  await cargarTab();
});
