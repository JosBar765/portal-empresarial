// src/modules/proyectos/estadoParticipacion.js
// Estado de una empresa dentro de un proyecto, derivado de lo registrado (función pura, sin base de datos).
// Sube con el trabajo del asesor: pendiente → en gestión → interesada → cotizada → vendida.
// «perdida» y «descartada» las marca el asesor de forma explícita y mandan sobre lo derivado.
const ESTADOS = ['pendiente', 'en_gestion', 'interesada', 'cotizada', 'vendida', 'perdida', 'descartada'];
const FINALES = ['vendida', 'perdida', 'descartada'];

// hechos: { gestiones, interesadas, cotizaciones, ventasConfirmadas } (conteos sin lo anulado) · marca: 'perdida' | 'descartada' | null
function derivar({ gestiones = 0, interesadas = 0, cotizaciones = 0, ventasConfirmadas = 0 } = {}, marca = null) {
  if (marca === 'perdida' || marca === 'descartada') return marca;
  if (ventasConfirmadas > 0) return 'vendida';
  if (cotizaciones > 0) return 'cotizada';
  if (interesadas > 0) return 'interesada';
  if (gestiones > 0) return 'en_gestion';
  return 'pendiente';
}

module.exports = { derivar, ESTADOS, FINALES };
