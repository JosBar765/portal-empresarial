// public/modules/tiempos/js/app.js
// Orquestador de la Calculadora de Tiempos: sesión, menú y rutas (#/calculadora, #/referencia).
import { state } from './state.js';
import { $, h, icono, montar } from './utils/dom.js';
import { iniciales } from './utils/formato.js';
import { sessionCheck, logout } from './api/tiemposApi.js';
import { seguirAltoEncabezado, wireAccountMenu, wireSidebar, ajustarMenu, marcarActivo } from './layout/shell.js';
import { mostrarCalculadora } from './views/calculadora.js';
import { mostrarReferencia } from './views/referencia.js';
import { mostrarAdministracion } from './views/admin/administracion.js';
import { mostrarHistorial } from './views/admin/historial.js';
import { mensaje } from './components/ui.js';

const contenido = () => $('#panel-content');
const partesRuta = () => window.location.hash.replace(/^#\/?/, '').split('?')[0].split('/');
const leerRuta = () => partesRuta()[0] || 'calculadora';

async function abrir() {
  const ruta = leerRuta();
  if (state.vista && state.vista.liberar) state.vista.liberar();
  state.vista = null;
  const cont = contenido();
  window.scrollTo({ top: 0 });
  try {
    if (ruta === 'calculadora') { marcarActivo('calculadora'); state.vista = await mostrarCalculadora(cont); }
    else if (ruta === 'referencia') { marcarActivo('referencia'); state.vista = await mostrarReferencia(cont); }
    else if (ruta === 'administracion') {
      marcarActivo('administracion');
      if (!(state.user.permissions || []).includes('tiempos.administrar')) montar(cont, mensaje({ nombreIcono: 'lock-closed-outline', tono: 'peligro', titulo: 'No tienes permiso para esta pantalla', texto: 'Solo el administrador puede editar la tabla de tiempos. Si crees que debería estar disponible, avisa al administrador.', acciones: [h('a', { class: 'btn btn--primary', href: '#/calculadora' }, 'Ir a la calculadora')] }));
      else state.vista = partesRuta()[1] === 'historial' ? await mostrarHistorial(cont) : await mostrarAdministracion(cont);
    }
    else { window.location.hash = '#/calculadora'; }
  } catch (error) {
    const sinTabla = error.status === 409;
    montar(cont, mensaje({
      nombreIcono: sinTabla ? 'file-tray-outline' : 'alert-circle-outline', tono: sinTabla ? 'info' : 'peligro',
      titulo: sinTabla ? 'Todavía no hay una tabla publicada' : 'No pudimos cargar la tabla',
      texto: sinTabla ? 'El administrador debe publicar la primera versión de la tabla de tiempos antes de poder calcular.' : `${error.message} Revisa tu conexión e inténtalo de nuevo. Si sigue igual, avisa al administrador.`,
      acciones: sinTabla ? [] : [h('button', { class: 'btn btn--primary', type: 'button', onclick: abrir }, icono('refresh-outline'), 'Intentar de nuevo')]
    }));
  }
}

function iniciarSocket() {
  if (typeof io === 'undefined') return;
  state.socket = io({ query: { userId: state.user.id } });
  window.centroNotificaciones?.iniciar({ socket: state.socket, modulo: 'tiempos' });
  window.avisoMantenimiento?.iniciar({ socket: state.socket, rolId: state.user.rolId });
  state.socket.on('connect', () => state.socket.emit('register_module', [`role_${state.user.rolId}`]));
  state.socket.on('permisos_actualizados', () => window.location.reload());
  state.socket.on('sesion_revocada', async () => { try { await logout(); } catch (e) { /* redirige de todas formas */ } window.location.href = '/login/?expired=true'; });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const datos = await sessionCheck();
    if (!datos.autenticado) { window.location.href = '/login/?expired=true'; return; }
    state.user = datos.user;
    if (!(state.user.permissions || []).includes('tiempos.ver')) { window.location.href = '/dashboard/'; return; }
    $('#user-display-name').textContent = state.user.nombre;
    $('#user-display-role').textContent = state.user.rolNombre;
    $('#account-dropdown-name').textContent = state.user.nombre;
    $('#account-dropdown-role').textContent = state.user.rolNombre;
    $('#account-avatar').textContent = iniciales(state.user.nombre);
  } catch (error) {
    window.location.href = '/login/?error=conexion';
    return;
  }
  seguirAltoEncabezado();
  wireAccountMenu();
  wireSidebar();
  ajustarMenu(state.user.permissions || []);
  $('#logout-btn').addEventListener('click', async () => {
    try { await logout(); } catch (error) { /* redirige de todas formas */ }
    window.location.href = '/login/';
  });
  iniciarSocket();
  window.addEventListener('hashchange', abrir);
  await abrir();
});
