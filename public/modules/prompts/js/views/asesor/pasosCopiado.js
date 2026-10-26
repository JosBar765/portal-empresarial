// Lógica pura (sin DOM) del copiado guiado: imágenes en orden y al final el prompt.
export function construirPasos(totalImagenes) {
  const pasos = Array.from({ length: totalImagenes }, (_, indice) => ({ tipo: 'imagen', indice }));
  pasos.push({ tipo: 'prompt' });
  return pasos;
}

export const claveDePaso = (paso) => (paso.tipo === 'imagen' ? `imagen-${paso.indice}` : 'prompt');

// Siempre apunta al primer paso sin copiar, aunque se hayan copiado filas sueltas.
export function siguientePendiente(pasos, hechos) {
  return pasos.find(p => !hechos.has(claveDePaso(p))) || null;
}

export function etiquetaBoton(pasos, hechos, totalImagenes) {
  const paso = siguientePendiente(pasos, hechos);
  if (!paso) return 'Todo copiado';
  return paso.tipo === 'imagen' ? `Copiar imagen ${paso.indice + 1} de ${totalImagenes}` : 'Copiar prompt';
}
