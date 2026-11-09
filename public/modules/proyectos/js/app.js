// Orquestador del módulo Proyectos: sesión, rutas por # y conexión en vivo.
import { state } from './state.js';
import { $, montar } from './utils/dom.js';
import { inicialesAvatar } from './utils/formato.js';
import { sessionCheck, logout, refreshToken } from './api/api.js';
import { wireSidebar, wireAccountMenu, marcarRuta, mostrarSoloPermitidas } from './layout/sidebar.js';
import { cargando, estadoError } from './components/ui.js';
import { liberarSalida } from './components/salida.js';
import { renderInicio } from './views/inicio.js';
import { renderCatalogos } from './views/catalogos.js';
import { renderParametros } from './views/parametros.js';
import { renderReglas } from './views/reglas.js';
import { renderHistorial } from './views/historial.js';
import { renderClientes } from './views/clientes.js';
import { renderImportar } from './views/importar.js';

// Cada pantalla pide su propio permiso: entrar a Proyectos solo exige `proyectos.ver`, y la configuración, `proyectos.administrar`.
const RUTAS = {
  clientes: { render: renderClientes, permiso: 'proyectos.ver' },
  importar: { render: renderImportar, permiso: 'proyectos.clientes.importar' },
  inicio: { render: renderInicio, permiso: 'proyectos.administrar' },
  parametros: { render: renderParametros, permiso: 'proyectos.administrar' },
  reglas: { render: renderReglas, permiso: 'proyectos.administrar' },
  historial: { render: renderHistorial, permiso: 'proyectos.administrar' },
  catalogos: { render: renderCatalogos, permiso: 'proyectos.administrar' }
};
const permitidas = () => Object.keys(RUTAS).filter(r => state.user.permissions.includes(RUTAS[r].permiso));

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

// «#/clientes/12» → { ruta: 'clientes', parametro: '12' }. Una ruta desconocida o sin permiso cae en la primera permitida.
function destinoDelHash() {
  const coincide = /^#\/([a-z]+)(?:\/([a-z0-9]+))?/.exec(window.location.hash);
  const habilitadas = permitidas();
  if (coincide && habilitadas.includes(coincide[1])) return { ruta: coincide[1], parametro: coincide[2] || null };
  return { ruta: habilitadas[0], parametro: null };
}
const claveDe = ({ ruta, parametro }) => (parametro ? `${ruta}/${parametro}` : ruta);

async function mostrar(destino) {
  state.ruta = destino.ruta;
  state.clave = claveDe(destino);
  marcarRuta(destino.ruta);
  const contenedor = $('#panel-content');
  montar(contenedor, cargando());
  try {
    await RUTAS[destino.ruta].render(contenedor, destino.parametro);
  } catch (error) {
    montar(contenedor, estadoError(error));
  }
}

let revirtiendo = false;
async function alCambiarElHash() {
  if (revirtiendo) { revirtiendo = false; return; }
  const destino = destinoDelHash();
  if (claveDe(destino) === state.clave) return;
  if (state.salidaVista && !(await state.salidaVista.confirmar())) {
    revirtiendo = true;
    window.location.hash = `#/${state.clave}`;
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

  mostrarSoloPermitidas(permitidas());
  window.addEventListener('hashchange', alCambiarElHash);
  await mostrar(destinoDelHash());
});
