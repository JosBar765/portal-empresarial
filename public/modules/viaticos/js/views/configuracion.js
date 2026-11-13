// Pestaña «Configuración»: tira de subpestañas y el panel de la que está abierta.
import { state } from '../state.js';
import { CLAVES_LOCALES } from '../config/constantes.js';
import { h, montar } from '../utils/dom.js';
import { t } from '../textos.js';
import { renderArchivos } from './configuracion/archivos.js';
import { renderCatalogo } from './configuracion/catalogo.js';
import { DEFINICIONES } from './configuracion/definiciones.js';
import { renderPersonas } from './configuracion/personas.js';
import { renderReglasLicencia } from './configuracion/reglasLicencia.js';
import { renderTramos } from './configuracion/tramos.js';
import { renderValoresComida } from './configuracion/valoresComida.js';
import { renderVehiculos } from './configuracion/vehiculos.js';
import { estadoLista } from './configuracion/lista.js';

const catalogo = (recurso) => (panel) => renderCatalogo(panel, DEFINICIONES[recurso]);

// Orden de la tira; `id` es también la clave de su texto (`config.sub.<id>`).
const SUBPESTANAS = [
  { id: 'personas', render: renderPersonas },
  { id: 'monedas', render: catalogo('monedas') },
  { id: 'valores-comida', render: renderValoresComida },
  { id: 'tipos-licencia', render: catalogo('tipos-licencia') },
  { id: 'reglas-licencia', render: renderReglasLicencia },
  { id: 'vehiculos', render: renderVehiculos },
  { id: 'ubicaciones', render: catalogo('ubicaciones') },
  { id: 'tramos', render: renderTramos },
  { id: 'motivos', render: catalogo('motivos') },
  { id: 'tipos-gasto', render: catalogo('tipos-gasto') },
  { id: 'tipos-defecto', render: catalogo('tipos-defecto') },
  { id: 'archivos', render: renderArchivos }
];

// localStorage puede fallar (modo privado, datos bloqueados): es solo comodidad.
const leerLocal = () => { try { return localStorage.getItem(CLAVES_LOCALES.SUBTAB_CONFIG); } catch (e) { return null; } };
const guardarLocal = (id) => { try { localStorage.setItem(CLAVES_LOCALES.SUBTAB_CONFIG, id); } catch (e) { /* sin persistencia */ } };

export function renderConfiguracion(contenedor) {
  const guardada = leerLocal();
  let activa = SUBPESTANAS.some(s => s.id === guardada) ? guardada : SUBPESTANAS[0].id;
  let numeroSeleccion = 0;

  const panel = h('div', { class: 'vi-config-panel', id: 'vi-config-panel', role: 'tabpanel' });
  const botones = SUBPESTANAS.map(sub => h('button', {
    type: 'button', role: 'tab', class: 'vi-subtab', id: `vi-subtab-${sub.id}`, 'data-sub': sub.id, 'aria-controls': 'vi-config-panel',
    text: t(`config.sub.${sub.id}`), onclick: () => seleccionar(sub.id), onkeydown: (e) => alTeclear(e, sub.id)
  }));
  const barra = h('div', { class: 'vi-subtabs', role: 'tablist', 'aria-label': t('config.subpestanas.aria') }, botones);
  montar(contenedor, barra, panel);

  // Desvanece el borde derecho mientras queden subpestañas ocultas a la derecha (solo cuando la tira se desplaza).
  const marcarDesborde = () => barra.classList.toggle('is-mas-derecha', barra.scrollWidth > barra.clientWidth + 1 && barra.scrollLeft + barra.clientWidth < barra.scrollWidth - 1);
  barra.addEventListener('scroll', marcarDesborde, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(marcarDesborde).observe(barra);

  function marcarActiva() {
    botones.forEach(boton => {
      const esActiva = boton.dataset.sub === activa;
      boton.classList.toggle('is-activa', esActiva);
      boton.setAttribute('aria-selected', esActiva ? 'true' : 'false');
      // Un solo tab entra con Tab; las flechas mueven entre ellos.
      boton.tabIndex = esActiva ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', `vi-subtab-${activa}`);
    const boton = botones.find(b => b.dataset.sub === activa);
    // En el celular la tira se desliza: la activa siempre queda a la vista.
    if (boton && boton.scrollIntoView) boton.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    marcarDesborde();
  }

  async function abrir(sub) {
    const numero = ++numeroSeleccion;
    montar(panel);
    try {
      await sub.render(panel);
    } catch (error) {
      if (numero !== numeroSeleccion) return;
      montar(panel, estadoLista({
        icono: 'alert-circle-outline', titulo: t('config.errorSeccion.titulo'), texto: error.message, error: true, alReintentar: () => abrir(sub)
      }));
    }
  }

  // Devuelve false si la subpestaña no cambió (misma o el usuario decidió quedarse con sus cambios sin guardar).
  async function seleccionar(id, { inicial = false } = {}) {
    if (!inicial) {
      if (id === activa) return false;
      if (state.salidaVista && !(await state.salidaVista.confirmar())) return false;
      if (state.salidaVista) { state.salidaVista.liberar(); state.salidaVista = null; }
      // Un modal abierto no sobrevive al cambio: se cierra antes de pintar la otra subpestaña.
      document.querySelectorAll('#modals-root .modal-close').forEach(boton => boton.click());
    }
    activa = id;
    guardarLocal(id);
    marcarActiva();
    abrir(SUBPESTANAS.find(s => s.id === id));
    return true;
  }

  async function alTeclear(evento, id) {
    const indice = SUBPESTANAS.findIndex(s => s.id === id);
    const destino = { ArrowRight: indice + 1, ArrowLeft: indice - 1, Home: 0, End: SUBPESTANAS.length - 1 }[evento.key];
    if (destino === undefined) return;
    evento.preventDefault();
    const siguiente = SUBPESTANAS[(destino + SUBPESTANAS.length) % SUBPESTANAS.length];
    if (await seleccionar(siguiente.id)) document.getElementById(`vi-subtab-${siguiente.id}`).focus();
  }

  seleccionar(activa, { inicial: true });
}
