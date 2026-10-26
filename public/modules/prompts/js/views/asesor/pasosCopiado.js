// Lógica pura (sin DOM) del copiado guiado: imágenes en el orden de la respuesta y al final el prompt.
import { t } from '../../textos.js';

export function construirPasos(imagenes) {
  const pasos = imagenes.map((img, indice) => ({ tipo: 'imagen', indice, numero: img.numero ?? indice + 1 }));
  pasos.push({ tipo: 'prompt' });
  return pasos;
}

export const claveDePaso = (paso) => (paso.tipo === 'imagen' ? `imagen-${paso.indice}` : 'prompt');

// Siempre apunta al primer paso sin copiar, aunque se hayan copiado filas sueltas.
export function siguientePendiente(pasos, hechos) {
  return pasos.find(p => !hechos.has(claveDePaso(p))) || null;
}

export function etiquetaBoton(pasos, hechos) {
  const paso = siguientePendiente(pasos, hechos);
  if (!paso) return t('asesor.resultado.todoCopiado');
  if (paso.tipo !== 'imagen') return t('asesor.resultado.copiarPrompt');
  const total = pasos.filter(p => p.tipo === 'imagen').length;
  return t('asesor.resultado.copiarImagenN', { numero: paso.numero, total });
}
