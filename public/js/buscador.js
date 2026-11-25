// Buscadores de lista: el botón «✕» limpia el texto y `destacar` llama la atención cuando se llenan solos.
(() => {
  document.addEventListener('click', (evento) => {
    const boton = evento.target.closest && evento.target.closest('.buscador-limpiar');
    if (!boton) return;
    const campo = boton.closest('.buscador').querySelector('input');
    campo.value = '';
    // El mismo evento que al borrar a mano: cada pantalla recarga con su propia lógica.
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.focus();
  });

  function destacar(selector) {
    const caja = document.querySelector(selector)?.closest('.buscador');
    if (!caja) return;
    caja.classList.remove('is-destacado');
    void caja.offsetWidth; // reinicia la animación si ya había corrido
    caja.classList.add('is-destacado');
  }

  window.buscador = { destacar };
})();
