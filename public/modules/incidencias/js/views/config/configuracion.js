// public/modules/incidencias/js/views/config/configuracion.js
// «Configuración»: siete pestañas (países, catálogos, prioridades, técnicos, verificadores, roles y permisos, parámetros) y,
// arriba, lo que conviene mirar antes de abrir el módulo a más gente (técnicos, verificadores, países encendidos).
import { h, icono, montar } from '../../utils/dom.js';
import { estado as pedirEstado } from '../../api/configApi.js';
import { confirmar } from '../../components/modal.js';
import { cargando, mostrarError } from '../estados.js';
import { mostrarPaises } from './paises.js';
import { mostrarCatalogos } from './catalogos.js';
import { mostrarPrioridades } from './prioridades.js';
import { mostrarTecnicos } from './tecnicos.js';
import { mostrarVerificadores } from './verificadores.js';
import { mostrarRoles } from './roles.js';
import { mostrarParametros } from './parametros.js';
import { abrirHistorial } from './historial.js';

const PESTANAS = [
  ['paises', 'Países', mostrarPaises], ['catalogos', 'Catálogos', mostrarCatalogos], ['prioridades', 'Prioridades', mostrarPrioridades],
  ['tecnicos', 'Técnicos', mostrarTecnicos], ['verificadores', 'Verificadores', mostrarVerificadores], ['roles', 'Roles y permisos', mostrarRoles], ['parametros', 'Parámetros', mostrarParametros]
];

// Avisos de arriba: cada uno lleva a la pestaña donde se arregla.
function avisosDe(e) {
  const lista = [];
  if (e.paisesHabilitados === 0) lista.push({ texto: 'Ningún país está encendido: nadie puede reportar incidencias.', pestana: 'paises' });
  if (e.rolesQueConfiguran === 0) lista.push({ texto: 'Ningún rol puede configurar Incidencias.', pestana: 'roles' });
  if (e.tecnicosActivos === 0) lista.push({ texto: 'Todavía no hay técnicos: las incidencias quedarán en el buzón sin nadie que las tome.', pestana: 'tecnicos' });
  if (e.tiendasSinVerificador > 0) lista.push({ texto: `${e.tiendasSinVerificador} tienda${e.tiendasSinVerificador === 1 ? ' no tiene' : 's no tienen'} verificador: sus cierres los verá quien tenga permiso de verificar.`, pestana: 'verificadores' });
  if (e.rolesQueVerifican === 0) lista.push({ texto: 'Ningún rol puede verificar incidencias, así que nadie podrá aprobar un cierre.', pestana: 'roles' });
  return lista;
}

export async function mostrarConfiguracion(cont, { pestana } = {}) {
  const actual = PESTANAS.find(p => p[0] === pestana) || PESTANAS[0];
  const zonaAvisos = h('div', { class: 'inc-config-avisos' });
  const panel = h('div', { class: 'inc-config-panel', id: 'config-panel', role: 'tabpanel' });
  const sesion = { vista: null, vivo: true };

  const pills = h('nav', { class: 'inc-config-pestanas', 'aria-label': 'Secciones de la configuración' },
    PESTANAS.map(([id, texto]) => {
      const a = h('a', { class: `inc-pestana${id === actual[0] ? ' inc-pestana--activa' : ''}`, href: `#/configuracion/${id}`, 'aria-current': id === actual[0] ? 'page' : null, text: texto });
      // Con cambios sin guardar se pregunta antes de salir de la pestaña.
      a.addEventListener('click', async (e) => {
        if (id === actual[0] || !(sesion.vista && sesion.vista.sinGuardar && sesion.vista.sinGuardar())) return;
        e.preventDefault();
        if (await confirmar({ titulo: '¿Salir sin guardar?', mensaje: 'Hiciste cambios que todavía no se guardan. Si sales de esta pestaña, se pierden.', aceptar: 'Salir sin guardar', peligro: true })) {
          sesion.vista.descartar && sesion.vista.descartar();
          window.location.hash = `#/configuracion/${id}`;
        }
      });
      return a;
    }));

  async function cargarAvisos() {
    try {
      const avisos = avisosDe(await pedirEstado());
      montar(zonaAvisos, avisos.slice(0, 3).map(a => h('div', { class: 'inc-banner inc-banner--atencion' }, icono('alert-circle-outline'),
        h('span', null, `${a.texto} `, h('a', { href: `#/configuracion/${a.pestana}`, text: 'Revisar' })))));
    } catch (error) { montar(zonaAvisos); }
  }

  montar(cont,
    h('div', { class: 'inc-pagina-titulo' }, h('div', null, h('h1', { text: 'Configuración' }), h('p', { text: 'Todo lo que el módulo necesita se cambia aquí, sin pedir cambios al sistema.' })),
      h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => abrirHistorial() }, icono('time-outline'), 'Historial de cambios')),
    zonaAvisos, pills, panel);
  cargarAvisos();
  montar(panel, cargando('Cargando…'));
  try {
    sesion.vista = await actual[2](panel, { alCambiar: cargarAvisos });
  } catch (error) {
    mostrarError(panel, error, () => mostrarConfiguracion(cont, { pestana: actual[0] }));
  }
  return {
    liberar: () => { sesion.vivo = false; if (sesion.vista && sesion.vista.liberar) sesion.vista.liberar(); }
  };
}
