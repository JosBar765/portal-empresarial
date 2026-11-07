// Orquestador del módulo Proyectos: sesión, rutas por # y conexión en vivo.
import { state } from './state.js';
import { $, montar } from './utils/dom.js';
import { inicialesAvatar } from './utils/formato.js';
import { sessionCheck, logout, refreshToken } from './api/api.js';
import { wireSidebar, wireAccountMenu, marcarRuta, mostrarSoloPermitidas } from './layout/sidebar.js';
import { cargando, estadoError, estadoVacio } from './components/ui.js';
import { liberarSalida } from './components/salida.js';
import { renderInicio } from './views/inicio.js';
import { renderCatalogos } from './views/catalogos.js';
import { renderParametros } from './views/parametros.js';
import { renderReglas } from './views/reglas.js';
import { renderHistorial } from './views/historial.js';

// Hoy el módulo solo tiene el Centro de configuración; las pantallas del asesor y del supervisor llegan por fases.
const PERMISO_ADMINISTRAR = 'proyectos.administrar';
const RUTAS = {
  inicio: renderInicio,
  parametros: renderParametros,
  reglas: renderReglas,
  historial: renderHistorial,
  catalogos: renderCatalogos
};
const RUTA_INICIAL = 'inicio';

// El encabezado se achica en celulares: el menú lateral y los altos fijos usan su alto real.
function seguirAltoEncabezado() {
  const encabezado = document.querySelector('.app-header');
  if (!encabezado) return;
  const fijar = () => document.documentElement.style.setProperty('--header-height', `${encabezado.offsetHeight}px`);
  fijar();
  if ('ResizeObserver' in window) new ResizeObserver(fijar).observe(encabezado);
}

function iniciarConexionEnVivo() {
  if (typeof io === 'undefined') return;
  state.socket = io({ query: { userId: state.user.id } });
  window.centroNotificaciones?.iniciar({ socket: state.socket, modulo: 'proyectos' });
  state.socket.on('connect', () => state.socket.emit('register_module', [`role_${state.user.rolId}`]));
  // Si cambian los permisos de su rol mientras trabaja, se renueva la sesión y se recarga.
  state.socket.on('permisos_actualizados', async () => {
    await refreshToken();
    window.location.reload();
  });
  state.socket.on('sesion_revocada', async () => {
    await logout();
    window.location.href = '/login/?expired=true';
  });
}

const rutaDelHash = () => {
  const coincide = /^#\/([a-z]+)/.exec(window.location.hash);
  return coincide && RUTAS[coincide[1]] ? coincide[1] : RUTA_INICIAL;
};

async function mostrar(ruta) {
  state.ruta = ruta;
  marcarRuta(ruta);
  const contenedor = $('#panel-content');
  montar(contenedor, cargando());
  try {
    await RUTAS[ruta](contenedor);
  } catch (error) {
    montar(contenedor, estadoError(error));
  }
}

let revirtiendo = false;
async function alCambiarElHash() {
  if (revirtiendo) { revirtiendo = false; return; }
  const destino = rutaDelHash();
  if (destino === state.ruta) return;
  if (state.salidaVista && !(await state.salidaVista.confirmar())) {
    revirtiendo = true;
    window.location.hash = `#/${state.ruta}`;
    return;
  }
  liberarSalida();
  await mostrar(destino);
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const sesion = await sessionCheck();
    if (!sesion.autenticado) { window.location.href = '/login/?expired=true'; return; }
    state.user = sesion.user;
    if (!(state.user.permissions || []).includes('proyectos.ver')) { window.location.href = '/dashboard/'; return; }

    $('#user-display-name').textContent = state.user.nombre;
    $('#user-display-role').textContent = state.user.rolNombre;
    $('#account-dropdown-name').textContent = state.user.nombre;
    $('#account-dropdown-role').textContent = state.user.rolNombre;
    $('#account-avatar').textContent = inicialesAvatar(state.user.nombre);
  } catch (error) {
    window.location.href = '/login/?error=conexion';
    return;
  }

  seguirAltoEncabezado();
  wireAccountMenu();
  wireSidebar();
  $('#logout-btn').addEventListener('click', async () => {
    try { await logout(); } catch (error) { /* redirige de todas formas */ }
    window.location.href = '/login/';
  });
  iniciarConexionEnVivo();

  if (!state.user.permissions.includes(PERMISO_ADMINISTRAR)) {
    mostrarSoloPermitidas([]);
    montar($('#panel-content'), estadoVacio('Todavía no hay pantallas para tu rol', 'Las pantallas de Proyectos se habilitan por fases. Te avisaremos cuando estén listas.', 'lock-closed-outline'));
    return;
  }

  mostrarSoloPermitidas(Object.keys(RUTAS));
  window.addEventListener('hashchange', alCambiarElHash);
  await mostrar(rutaDelHash());
});
