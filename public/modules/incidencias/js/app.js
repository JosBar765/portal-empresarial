// public/modules/incidencias/js/app.js
// Orquestador del módulo Incidencias: sesión, avisos en vivo, menú y rutas (#/mis, #/reportar, #/incidencia/:id, #/verificar, #/enviada/:id).
import { state } from './state.js';
import { $, montar } from './utils/dom.js';
import { iniciales } from './utils/formato.js';
import { sessionCheck, logout, resumen as pedirResumen } from './api/incidenciasApi.js';
import { seguirAltoEncabezado, wireAccountMenu, wireSidebar, ajustarMenu, marcarActivo, mostrarContador } from './layout/shell.js';
import { mostrarLista } from './views/lista.js';
import { mostrarReportar } from './views/reportar.js';
import { mostrarEnviada } from './views/enviada.js';
import { mostrarDetalle } from './views/detalle.js';
import { pantallaMensaje, botonEnlace } from './views/estados.js';

const contenido = () => $('#panel-content');

// #/incidencia/12 → { nombre: 'incidencia', id: 12 }
function leerRuta() {
  const [nombre = 'mis', param = ''] = window.location.hash.replace(/^#\/?/, '').split('?')[0].split('/');
  return { nombre: nombre || 'mis', param };
}

async function abrir() {
  const { nombre, param } = leerRuta();
  if (state.vista && state.vista.liberar) state.vista.liberar();
  state.vista = null;
  const cont = contenido();
  const permisos = state.user.permissions || [];
  window.scrollTo({ top: 0 });
  const id = /^\d+$/.test(param) ? Number(param) : null;
  let vista = null;
  try {
    if (nombre === 'reportar') {
      marcarActivo('reportar');
      vista = permisos.includes('incidencias.reportar') ? await mostrarReportar(cont) : mostrarSinPermiso(cont);
    } else if (nombre === 'enviada' && id) {
      marcarActivo('reportar');
      vista = await mostrarEnviada(cont, id);
    } else if (nombre === 'incidencia' && id) {
      marcarActivo('mis');
      vista = await mostrarDetalle(cont, id);
    } else if (nombre === 'verificar') {
      marcarActivo('verificar');
      vista = permisos.includes('incidencias.verificar') ? await mostrarLista(cont, { vista: 'verificar' }) : mostrarSinPermiso(cont);
    } else if (nombre === 'mis' || nombre === '') {
      marcarActivo('mis');
      let tab = null;
      try { tab = sessionStorage.getItem('incidencias:tab'); } catch (e) { /* sin memoria de pestaña */ }
      state.tab = state.tab || tab;
      vista = await mostrarLista(cont, { vista: 'mis' });
    } else {
      window.location.hash = '#/mis';
      return;
    }
  } catch (error) {
    montar(cont, pantallaMensaje({ icono: 'alert-circle-outline', tono: 'peligro', titulo: 'No se pudo abrir esta pantalla', texto: error.message, acciones: [botonEnlace('Volver a mis incidencias', '#/mis', true, 'arrow-back-outline')] }));
  }
  state.vista = vista;
  actualizarContador();
}

function mostrarSinPermiso(cont) {
  montar(cont, pantallaMensaje({ icono: 'lock-closed-outline', tono: 'peligro', titulo: 'No tienes permiso para esta pantalla', texto: 'Si crees que debería estar disponible, avisa al administrador.', acciones: [botonEnlace('Volver a mis incidencias', '#/mis', true, 'arrow-back-outline')] }));
  return {};
}

// El número junto a «Por verificar»: lo que está esperando a quien verifica.
async function actualizarContador() {
  if (!(state.user.permissions || []).includes('incidencias.verificar')) return;
  try { const r = await pedirResumen(); mostrarContador(r.verificar ? r.verificar.pendientes : 0); } catch (e) { /* el número se queda como estaba */ }
}

// Un aviso en la campana abre la incidencia que nombra.
function alAbrirAviso(aviso) {
  if (aviso.referencia_tipo === 'incidencia' && aviso.referencia_id) window.location.hash = `#/incidencia/${aviso.referencia_id}`;
}

function iniciarSocket() {
  if (typeof io === 'undefined') return;
  state.socket = io({ query: { userId: state.user.id } });
  window.centroNotificaciones?.iniciar({ socket: state.socket, modulo: 'incidencias', alAbrir: alAbrirAviso });
  state.socket.on('connect', () => state.socket.emit('register_module', [`role_${state.user.rolId}`]));
  // Otra persona cambió algo: la pantalla abierta se actualiza sola (sin quitarle el lugar a quien está leyendo).
  let pendiente = null;
  state.socket.on('incidencia_actualizada', (datos) => {
    clearTimeout(pendiente);
    pendiente = setTimeout(() => {
      const vista = state.vista;
      if (vista && vista.refrescar && (!vista.id || vista.id === datos.id)) vista.refrescar();
      actualizarContador();
    }, 600);
  });
  state.socket.on('permisos_actualizados', () => window.location.reload());
  state.socket.on('sesion_revocada', async () => { try { await logout(); } catch (e) { /* redirige de todas formas */ } window.location.href = '/login/?expired=true'; });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const datos = await sessionCheck();
    if (!datos.autenticado) { window.location.href = '/login/?expired=true'; return; }
    state.user = datos.user;
    if (!(state.user.permissions || []).includes('incidencias.ver')) { window.location.href = '/dashboard/'; return; }
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

