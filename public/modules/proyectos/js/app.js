// Orquestador del módulo Proyectos: sesión, rutas por # y conexión en vivo.
import { state } from './state.js';
import { $, h, icono, montar } from './utils/dom.js';
import { inicialesAvatar } from './utils/formato.js';
import { sessionCheck, logout, refreshToken, obtenerMisPermisos } from './api/api.js';
import { wireSidebar, wireAccountMenu, marcarRuta, mostrarSoloPermitidas } from './layout/sidebar.js';
import { cargando, estadoError, estadoVacio } from './components/ui.js';
import { liberarSalida } from './components/salida.js';
import { barraVolver } from './components/barraVolver.js';
import { destinoDeAviso, nombreDePantalla } from './utils/avisosRutas.js';
import { renderInicio } from './views/inicio.js';
import { renderCatalogos } from './views/catalogos.js';
import { renderParametros } from './views/parametros.js';
import { renderReglas } from './views/reglas.js';
import { renderHistorial } from './views/historial.js';
import { renderClientes } from './views/clientes.js';
import { renderImportar } from './views/importar.js';
import { renderCampos } from './views/campos.js';
import { renderAlcance } from './views/alcance.js';
import { renderPlantillas } from './views/plantillas.js';
import { renderAprobaciones } from './views/aprobaciones.js';
import { renderProyectos } from './views/proyectos.js';
import { renderMiProyecto } from './views/miProyecto.js';
import { renderParaHoy } from './views/paraHoy.js';
import { renderEmpresaAsesor } from './views/empresaAsesor.js';
import { renderAnteriores } from './views/anteriores.js';
import { montarBarraInferior } from './layout/barraInferior.js';
import { renderSeguimiento } from './views/seguimiento.js';
import { renderSupervisionEmpresa } from './views/supervisionEmpresa.js';
import { renderVentasPorConfirmar } from './views/ventasPorConfirmar.js';
import { renderPanel, renderVistoBueno } from './views/gerencia.js';
import { renderAvisos } from './views/avisos.js';
import { renderClientesGanados } from './views/clientesGanados.js';
import { renderKitNicho } from './views/kitNicho.js';
import { renderPlanAnio } from './views/planAnio.js';

// Pantalla que solo cambia el administrador: se explica en lugar de dejar un hueco o saltar a otra.
function pantallaSoloAdmin(contenedor, nombre) {
  montar(contenedor, estadoVacio(`${nombre}: solo el administrador`, 'Esta parte de la configuración la cambia únicamente el administrador, porque afecta a todas las tiendas y países. Si necesitas un cambio aquí, pídeselo.', 'lock-closed-outline'),
    h('div', { class: 'acciones-centradas' }, h('a', { class: 'btn btn--ghost', href: '#/inicio' }, icono('arrow-back-outline'), 'Volver al Centro de configuración')));
}

// Cada pantalla pide su propio permiso: entrar a Proyectos solo exige `proyectos.ver`; la configuración, `proyectos.configurar` o `proyectos.administrar`.
// `soloAdmin`: la pantalla es de quien administra; quien solo configura la ve bloqueada, con la explicación, en lugar de saltar a otra.
const RUTAS = {
  miproyecto: { render: renderMiProyecto, permiso: 'proyectos.gestionar' },
  parahoy: { render: renderParaHoy, permiso: 'proyectos.gestionar' },
  empresa: { render: renderEmpresaAsesor, permiso: 'proyectos.gestionar' },
  anteriores: { render: renderAnteriores, permiso: 'proyectos.gestionar' },
  clientes: { render: renderClientes, permiso: 'proyectos.ver' },
  importar: { render: renderImportar, permiso: 'proyectos.clientes.importar' },
  inicio: { render: renderInicio, permiso: ['proyectos.configurar', 'proyectos.administrar'] },
  parametros: { render: renderParametros, permiso: ['proyectos.configurar', 'proyectos.administrar'], soloAdmin: 'Parámetros' },
  reglas: { render: renderReglas, permiso: ['proyectos.configurar', 'proyectos.administrar'], soloAdmin: 'Reglas y aprobaciones' },
  proyectos: { render: renderProyectos, permiso: ['proyectos.activar', 'proyectos.ver_gerencia', 'proyectos.administrar'] },
  seguimiento: { render: renderSeguimiento, permiso: ['proyectos.supervisar', 'proyectos.ver_gerencia', 'proyectos.administrar'] },
  participacion: { render: renderSupervisionEmpresa, permiso: ['proyectos.supervisar', 'proyectos.ver_gerencia', 'proyectos.administrar'] },
  ganados: { render: renderClientesGanados, permiso: ['proyectos.gestionar', 'proyectos.supervisar', 'proyectos.ver_gerencia', 'proyectos.administrar'] },
  ventas: { render: renderVentasPorConfirmar, permiso: 'proyectos.confirmar_ventas' },
  panel: { render: renderPanel, permiso: ['proyectos.ver_gerencia', 'proyectos.administrar'] },
  vistobueno: { render: renderVistoBueno, permiso: 'proyectos.dar_visto_bueno' },
  aprobaciones: { render: renderAprobaciones, permiso: 'proyectos.aprobar_activacion' },
  plantillas: { render: renderPlantillas, permiso: ['proyectos.configurar', 'proyectos.administrar'] },
  notificaciones: { render: renderAvisos, permiso: ['proyectos.configurar', 'proyectos.administrar'] },
  campos: { render: renderCampos, permiso: ['proyectos.configurar', 'proyectos.administrar'] },
  kit: { render: renderKitNicho, permiso: ['proyectos.configurar', 'proyectos.administrar'] },
  plan: { render: renderPlanAnio, permiso: ['proyectos.configurar', 'proyectos.administrar'] },
  alcance: { render: renderAlcance, permiso: ['proyectos.configurar', 'proyectos.administrar'], soloAdmin: 'Alcance de usuarios' },
  historial: { render: renderHistorial, permiso: ['proyectos.configurar', 'proyectos.administrar'] },
  catalogos: { render: renderCatalogos, permiso: ['proyectos.configurar', 'proyectos.administrar'], soloAdmin: 'Catálogos' }
};
// Una ruta puede pedir un permiso o varios (basta con uno).
const puedeVer = (ruta) => [].concat(RUTAS[ruta].permiso).some(p => state.user.permissions.includes(p));
const permitidas = () => Object.keys(RUTAS).filter(puedeVer);

// El encabezado se achica en celulares: el menú lateral y los altos fijos usan su alto real.
function seguirAltoEncabezado() {
  const encabezado = document.querySelector('.app-header');
  if (!encabezado) return;
  const fijar = () => document.documentElement.style.setProperty('--header-height', `${encabezado.offsetHeight}px`);
  fijar();
  if ('ResizeObserver' in window) new ResizeObserver(fijar).observe(encabezado);
}

// Un clic en un aviso de la campana lleva a la pantalla relacionada y deja la forma de regresar a donde se estaba.
async function abrirDesdeAviso(aviso) {
  const hash = destinoDeAviso(aviso, state.user.permissions);
  if (!hash) { window.toast && window.toast.info('Proyectos', 'Ese aviso ya no tiene una pantalla a la que llevarte.'); return; }
  if (hash === window.location.hash) return;
  if (state.salidaVista && !(await state.salidaVista.confirmar())) return;
  state.volver = { hash: state.clave ? `#/${state.clave}` : '#/', texto: nombreDePantalla(state.ruta), destino: hash.replace(/^#\//, '') };
  window.location.hash = hash;
}

function iniciarConexionEnVivo() {
  if (typeof io === 'undefined') return;
  state.socket = io({ query: { userId: state.user.id } });
  window.centroNotificaciones?.iniciar({ socket: state.socket, modulo: 'proyectos', alAbrir: abrirDesdeAviso });
  state.socket.on('connect', () => state.socket.emit('register_module', [`role_${state.user.rolId}`]));
  // Si cambian los permisos de su rol mientras trabaja, se renueva la sesión y se recarga.
  state.socket.on('permisos_actualizados', async () => {
    await refreshToken();
    window.location.reload();
  });
  // Una reasignación o una anulación cambia lo que ve el asesor y el supervisor: se repinta la pantalla sin recargar la página.
  state.socket.on('proyectos_reasignacion', () => {
    if (['miproyecto', 'parahoy', 'seguimiento'].includes(state.ruta) && !(state.salidaVista && state.salidaVista.sucio())) {
      mostrar(destinoDelHash());
      window.toast && window.toast.info('Proyectos', 'Se actualizó tu trabajo: hubo una reasignación.');
    }
  });
  state.socket.on('sesion_revocada', async () => {
    await logout();
    window.location.href = '/login/?expired=true';
  });
}

// «#/clientes/12» → { ruta: 'clientes', parametro: '12' }. Una ruta desconocida o sin permiso cae en la primera permitida.
function destinoDelHash() {
  const coincide = /^#\/([a-z]+)(?:\/([a-z0-9]+(?:\/[a-z]+)?))?/.exec(window.location.hash);
  const habilitadas = permitidas();
  if (coincide && habilitadas.includes(coincide[1])) return { ruta: coincide[1], parametro: coincide[2] || null };
  return { ruta: habilitadas[0], parametro: null };
}
const claveDe = ({ ruta, parametro }) => (parametro ? `${ruta}/${parametro}` : ruta);

async function mostrar(destino) {
  // Una ventana que quedó abierta (el kit, un repartir, un ajuste…) no sigue encima de la pantalla nueva.
  document.querySelectorAll('#modals-root .modal-overlay').forEach(o => o.remove());
  document.body.style.overflow = '';
  state.ruta = destino.ruta;
  state.clave = claveDe(destino);
  // «Volver» vale solo para la pantalla a la que llevó el aviso: al seguir navegando se descarta.
  if (state.volver && state.volver.destino !== state.clave) state.volver = null;
  marcarRuta(destino.ruta);
  const contenedor = $('#panel-content');
  montar(contenedor, cargando());
  try {
    if (RUTAS[destino.ruta].soloAdmin && !state.user.permissions.includes('proyectos.administrar')) pantallaSoloAdmin(contenedor, RUTAS[destino.ruta].soloAdmin);
    else await RUTAS[destino.ruta].render(contenedor, destino.parametro);
    if (state.volver) {
      const volver = state.volver;
      contenedor.prepend(barraVolver({ texto: volver.texto, alVolver: () => { state.volver = null; window.location.hash = volver.hash; } }));
    }
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
    // Quién aprueba y quién da el visto bueno se asigna por persona: el servidor devuelve los permisos ya con eso.
    try { state.user.permissions = (await obtenerMisPermisos()).permisos; } catch (error) { /* se queda con los de la sesión */ }
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
  if (state.user.permissions.includes('proyectos.gestionar')) montarBarraInferior();
  window.addEventListener('hashchange', alCambiarElHash);
  await mostrar(destinoDelHash());
  window.centroNotificaciones?.abrirPendiente();
});
