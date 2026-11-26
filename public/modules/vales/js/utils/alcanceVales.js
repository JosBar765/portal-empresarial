// La campana de Vales sigue las tiendas que el supervisor marca en el Buzón; la selección vive en el servidor.
import { state } from '../state.js';
import { ROL } from '../config/roles.js';
import { resolverTiendaIds, resolverAsesorIds } from '/js/filtroCascada.js';

const API = '/api/vales/filtro-avisos';
const NADA = { tiendas: [], asesores: [] };

let aplica = false;
let seleccion = NADA;
let alElegir = () => {};

const tiendas = () => state.catalogos.tiendasGerencia || [];
const asesores = () => state.catalogos.asesoresEspeciales || [];
const esSupervisorConAvisos = () => (state.user.permissions || []).includes('vales.supervisar') && state.user.rolId !== ROL.ADMINISTRADOR;

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
  const guardada = await pedir({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nueva) });
  seleccion = { tiendas: guardada.tiendas, asesores: guardada.asesores };
  window.centroNotificaciones?.recargar();
}

// Al abrir el Buzón: manda lo guardado en el servidor; si nunca se guardó, sube lo que recordaba este navegador.
// Devuelve el valor para el selector, o null si a este usuario no le aplica o no se pudo leer.
export async function sincronizarAlcance(valorLocal, cuandoElija) {
  if (!esSupervisorConAvisos()) return null;
  alElegir = cuandoElija;
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
