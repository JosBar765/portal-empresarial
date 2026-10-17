import { state } from '../state.js';

// Rechazos de modificación básica que el asesor ya leyó. Se guardan solo en este navegador: si no hay almacenamiento, el aviso se repite.
const clave = () => `vales.mbRechazosVistos.${state.user.id}`;

function leer() {
  try { return JSON.parse(localStorage.getItem(clave()) || '[]'); } catch { return []; }
}

export function marcarRechazoVisto(id) {
  try {
    const vistos = leer();
    if (!vistos.includes(id)) localStorage.setItem(clave(), JSON.stringify([...vistos, id].slice(-200)));
  } catch { /* sin almacenamiento */ }
}

// Rechazos de este vale que el asesor dueño todavía no abrió.
export function rechazosSinLeer(vale) {
  if (vale.asesor_id !== state.user.id) return [];
  const vistos = leer();
  return (vale.modificaciones_basicas_rechazadas || []).filter(r => !vistos.includes(r.id));
}

// «Protextil rechazó tu modificación» / «Diseño y Protextil rechazaron tu modificación».
export function textoRechazos(rechazos) {
  const nombres = rechazos.map(r => r.taller);
  const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : nombres[0];
  return `${lista} ${nombres.length > 1 ? 'rechazaron' : 'rechazó'} tu modificación`;
}
