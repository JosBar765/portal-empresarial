import { abrirVisorDocumentos } from '../components/visorDocumento.js';
import { obtenerDetalleVale, obtenerPropuestaVale } from '../api/valesApi.js';

// Propuesta de un taller: existe si la última de su diseñador trae su PDF; el visor la carga con su nota y enlaces.
export const propuestaDe = (det, disenadorId) => {
  const propias = (det.propuestas || []).filter(p => p.disenador_id === disenadorId);
  const ultima = propias[propias.length - 1];
  return ultima && ultima.url ? { id: det.id, disenadorId } : null;
};

// Visor de un vale multitaller: el vale, la propuesta de cada taller que ya entregó y la fusionada si existe.
export async function abrirVisorMultitaller({ id, correlativo }) {
  let det;
  try {
    det = await obtenerDetalleVale(id);
  } catch (error) {
    window.toast.error('No se pudo abrir el vale', error.message);
    return;
  }
  const documentos = [{ etiqueta: 'Vale de arte', url: `/api/vales/${id}/pdf` }];
  (det.talleres || []).forEach(t => {
    const propuesta = propuestaDe(det, t.disenador_id);
    if (propuesta) documentos.push({ etiqueta: `Propuesta ${t.taller_nombre}`, cargar: () => obtenerPropuestaVale(id, { tipo: 'taller', disenadorId: propuesta.disenadorId }) });
  });
  if (det.propuesta_general_url || det.propuesta_general_nota || (det.enlacesFusion || []).length) {
    documentos.push({ etiqueta: 'Propuesta fusionada', cargar: () => obtenerPropuestaVale(id, { tipo: 'general' }) });
  }
  abrirVisorDocumentos({ titulo: correlativo, documentos });
}
