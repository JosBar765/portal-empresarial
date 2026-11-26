// Abre en el buzón el vale que nombra un aviso: pestaña, mes de entrega y correlativo en el buscador.
import { state } from '../state.js';
import { ROLES_CON_SIDEBAR, rolVista } from '../config/roles.js';
import { mostrarEnBuzon, filtroSincronizado } from '../layout/toolbar.js';
import { incluirEnSeleccion } from '../utils/alcanceVales.js';

const botonDeVista = (vista) => document.querySelector(`.sidebar-item[data-vista="${vista}"]`);
const disponible = (boton) => !!boton && boton.style.display !== 'none';

export async function irAVale(aviso) {
  const sinDestino = () => window.centroNotificaciones?.sinDestino();
  if (!aviso.vale_id) { sinDestino(); return; }
  let ubicacion;
  try {
    const respuesta = await fetch(`/api/vales/${Number(aviso.vale_id)}/ubicacion`);
    if (!respuesta.ok) { sinDestino(); return; }
    ubicacion = await respuesta.json();
  } catch {
    sinDestino();
    return;
  }
  const conMenu = ROLES_CON_SIDEBAR.includes(rolVista(state.user));
  const vista = conMenu ? ubicacion.vistas.find(v => disponible(botonDeVista(v))) : ubicacion.vistas.find(v => v === 'buzon');
  if (!vista) { sinDestino(); return; }
  // El clic del menú cambia título y secciones igual que a mano; si ya estaba ahí no hace nada.
  if (conMenu) botonDeVista(vista).click();
  // Una tienda no marcada se suma a la selección; solo si no se puede marcar se quita el filtro por esta vez.
  await filtroSincronizado;
  const visible = !state.tiendaId || incluirEnSeleccion({ tiendaId: ubicacion.tiendaId, asesorId: ubicacion.asesorId });
  mostrarEnBuzon({ tipo: 'mes', fecha: ubicacion.fechaEntrega, desde: '', hasta: '' }, ubicacion.correlativo, { quitarTienda: !visible });
  window.buscador?.destacar('#filtro-texto');
}
