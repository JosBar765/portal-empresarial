// Etiqueta cada celda con el encabezado de su columna (`data-label`) para el modo tarjeta en celulares.
export function etiquetarTablas(raiz) {
  raiz.querySelectorAll('table').forEach(tabla => {
    const titulos = [...tabla.querySelectorAll('thead th')].map(th => th.textContent.trim());
    if (!titulos.length) return;
    tabla.querySelectorAll('tbody tr').forEach(tr => {
      [...tr.children].forEach((celda, i) => {
        if (celda.tagName === 'TD' && !celda.hasAttribute('data-label') && titulos[i]) celda.setAttribute('data-label', titulos[i]);
      });
    });
  });
}

// Mantiene las etiquetas al día cuando la vista vuelve a pintar sus tablas.
export function mantenerEtiquetas(raiz) {
  if (!raiz || raiz.__etiquetas) return;
  raiz.__etiquetas = new MutationObserver(() => etiquetarTablas(raiz));
  raiz.__etiquetas.observe(raiz, { childList: true, subtree: true });
  etiquetarTablas(raiz);
}
