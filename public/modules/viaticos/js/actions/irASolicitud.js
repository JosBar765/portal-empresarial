// Abre la solicitud que nombra un aviso: su pestaña, el mes en que se creó y su correlativo en el buscador.
import { state } from '../state.js';
import { TABS } from '../config/constantes.js';
import { cambiarTab, puedeVerTab } from '../layout/sidebar.js';
import { cargarTab } from '../layout/panel.js';

// Quien tramita llega a Gestiones; a quien la pidió, a sus Solicitudes.
const AVISOS_DE_GESTION = ['solicitud_nueva', 'solicitud_modificada', 'solicitud_liquidada'];

export async function irASolicitud(aviso) {
  const sinDestino = () => window.centroNotificaciones?.sinDestino();
  if (aviso.referencia_tipo !== 'solicitud' || !aviso.referencia_id) { sinDestino(); return; }
  let ubicacion;
  try {
    const respuesta = await fetch(`/api/viaticos/solicitudes/${Number(aviso.referencia_id)}/ubicacion`);
    if (!respuesta.ok) { sinDestino(); return; }
    ubicacion = await respuesta.json();
  } catch {
    sinDestino();
    return;
  }
  const orden = AVISOS_DE_GESTION.includes(aviso.tipo) ? [TABS.GESTIONES, TABS.SOLICITUDES] : [TABS.SOLICITUDES, TABS.GESTIONES];
  const tab = orden.find(t => ubicacion.vistas.includes(t) && puedeVerTab(t));
  if (!tab) { sinDestino(); return; }
  // Una pantalla con cambios sin guardar decide si se puede salir.
  if (state.salidaVista && !(await state.salidaVista.confirmar())) return;

  const periodo = { tipo: 'mes', fecha: ubicacion.fechaCreacion, desde: '', hasta: '' };
  if (tab === TABS.GESTIONES) {
    state.ventanaGestion = periodo;
    state.busquedaGestion = ubicacion.correlativo;
  } else {
    state.ventana = periodo;
    state.busqueda = ubicacion.correlativo;
  }
  if (state.salidaVista) { state.salidaVista.liberar(); state.salidaVista = null; }
  if (state.tab === tab) await cargarTab(); else await cambiarTab(tab);
}
