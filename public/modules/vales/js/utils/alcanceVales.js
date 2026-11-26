// La campana de Vales sigue las tiendas marcadas en el Buzón; la selección vive en el servidor.
import { state } from '../state.js';
import { obtenerCatalogos } from '../api/valesApi.js';
import { ROL, rolVista } from '../config/roles.js';
import { resolverTiendaIds, resolverAsesorIds } from '/js/filtroCascada.js';

const API = '/api/vales/filtro-avisos';
const NADA = { tiendas: [], asesores: [] };

let aplica = false;
let seleccion = NADA;
let alElegir = () => {};
let alRecibir = () => {};
// Con un guardado en camino manda lo de esta pantalla: releer podría traer el paso anterior.
let guardando = 0;

const tiendas = () => state.catalogos.tiendasGerencia || [];
const asesores = () => state.catalogos.asesoresEspeciales || [];
// Los mismos que ven el selector de tiendas en la barra del Buzón.
const tieneSelectorDeTiendas = () => [ROL.SUPERVISOR, ROL.GERENTE, ROL.ADMINISTRADOR].includes(rolVista(state.user));

function seleccionDeValor(valor) {
  const elegibles = new Set(tiendas().map(t => t.id));
  return {
    tiendas: resolverTiendaIds(valor || '', tiendas()).filter(id => elegibles.has(id)),
    asesores: resolverAsesorIds(valor || '', asesores())
  };
}

async function pedir(opciones) {
  const respuesta = await fetch(API, opciones);
  if (!respuesta.ok) throw new Error('No se pudo guardar la selección de tiendas.');
  return respuesta.json();
}

async function enviar(nueva) {
  let guardada;
  guardando++;
  try {
    guardada = await pedir({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nueva) });
  } finally {
    guardando--;
  }
  seleccion = { tiendas: guardada.tiendas, asesores: guardada.asesores };
  window.centroNotificaciones?.recargar();
}

// Al abrir el Buzón: manda lo guardado en el servidor; si nunca se guardó, sube lo que recordaba este navegador.
// Devuelve el valor para el selector, o null si a este usuario no le aplica o no se pudo leer.
export async function sincronizarAlcance(valorLocal, cuandoElija, cuandoLlegue) {
  if (!tieneSelectorDeTiendas()) return null;
  alElegir = cuandoElija;
  alRecibir = cuandoLlegue || (() => {});
  try {
    const guardada = await pedir();
    if (!guardada.aplica) return null;
    aplica = true;
    if (guardada.guardado) {
      seleccion = { tiendas: guardada.tiendas, asesores: guardada.asesores };
      window.centroNotificaciones?.recargar();
    } else {
      await enviar(seleccionDeValor(valorLocal));
    }
    return window.alcanceAvisos.valorDeSeleccion(seleccion);
  } catch {
    return null; // sin conexión: la campana sigue como esté guardada en el servidor
  }
}

export function guardarAlcance(valor) {
  if (!aplica) return;
  enviar(seleccionDeValor(valor)).catch(() => window.toast?.error('Notificaciones', 'No se pudo guardar la selección de tiendas. Revisa tu conexión y vuelve a elegirlas.'));
}

const firma = (s) => JSON.stringify([[...s.tiendas].sort((a, b) => a - b), [...s.asesores].sort((a, b) => a - b)]);

// La selección cambió en otra pantalla o la ajustó el administrador: se aplica aquí sin volver a guardarla.
async function releer() {
  if (!aplica || guardando) return;
  try {
    const guardada = await pedir();
    if (guardando || !guardada.aplica || firma(guardada) === firma(seleccion)) return;
    // El administrador pudo cambiar también las tiendas que se pueden marcar.
    state.catalogos = await obtenerCatalogos();
    seleccion = { tiendas: guardada.tiendas, asesores: guardada.asesores };
    alRecibir(window.alcanceAvisos.valorDeSeleccion(seleccion), tiendas(), asesores());
    window.centroNotificaciones?.recargar();
  } catch { /* se vuelve a intentar con el próximo cambio o al reconectar */ }
}

export function conectarAlcance(socket) {
  socket.on('alcance_avisos', releer);
  // Al reconectar pudo haberse perdido un cambio.
  socket.on('connect', releer);
}

// Antes de mostrar el registro de un aviso: si su tienda no está marcada, se agrega. Devuelve false si no se puede marcar.
export function incluirEnSeleccion(registro) {
  if (!aplica) return false;
  const { cubierto, nueva } = window.alcanceAvisos.incluir(seleccion, registro, tiendas(), asesores());
  if (nueva) {
    seleccion = nueva;
    alElegir(window.alcanceAvisos.valorDeSeleccion(nueva));
  }
  return cubierto;
}

// ¿Un aviso en vivo (cartel y sonido) es de lo que se está viendo?
export const permiteEnVivo = (datos) => !aplica || window.alcanceAvisos.permite(seleccion, datos, state.user.id);

// Lo que la campana necesita para su rótulo y su bloque de «tiendas que no ves».
export const alcanceCampana = {
  rotulo: () => (aplica ? window.alcanceAvisos.rotulo(seleccion, tiendas(), asesores()) : null),
  grupos: (filas) => (aplica ? window.alcanceAvisos.grupos(filas, tiendas(), asesores()) : []),
  resumen: (grupos) => window.alcanceAvisos.resumenFuera(grupos),
  ver: (clave) => alElegir(window.alcanceAvisos.valorDeSeleccion(window.alcanceAvisos.agregar(seleccion, clave))),
  verTodas: () => alElegir('')
};
