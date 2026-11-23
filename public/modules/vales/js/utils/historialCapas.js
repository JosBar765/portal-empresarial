// El gesto «atrás» del celular cierra la capa de arriba (modal o visor) en vez de salir del módulo.
// Mientras haya capas abiertas se mantiene UNA entrada propia en el historial; el «atrás» la consume y cierra solo la capa superior.
const pila = [];
let entradaPropia = false;
let ignorar = 0;

function asegurarEntrada() {
  if (entradaPropia) return;
  history.pushState({ valCapa: true }, '');
  entradaPropia = true;
}

window.addEventListener('popstate', async () => {
  if (ignorar) { ignorar -= 1; return; }
  if (!entradaPropia) return;
  entradaPropia = false;
  const capa = pila[pila.length - 1];
  if (!capa) return;
  await capa.cerrarPorAtras();
  // Quedan capas, o la de arriba no se dejó cerrar (cambios sin guardar): el próximo «atrás» también se queda en el módulo.
  if (pila.length) asegurarEntrada();
});

// `cerrarPorAtras()` cierra la capa (puede preguntar antes). Devuelve `soltar()`, que la capa llama al cerrarse por cualquier vía.
export function registrarCapa(cerrarPorAtras) {
  const capa = { cerrarPorAtras };
  pila.push(capa);
  asegurarEntrada();
  return function soltar() {
    const i = pila.indexOf(capa);
    if (i === -1) return;
    pila.splice(i, 1);
    // Se quita la entrada propia al quedar sin capas, salvo que en este mismo turno se abra otra (un visor que reemplaza a otro).
    setTimeout(() => {
      if (pila.length || !entradaPropia) return;
      entradaPropia = false;
      ignorar += 1;
      history.back();
    }, 0);
  };
}
