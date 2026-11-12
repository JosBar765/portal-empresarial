// Orquesta el cálculo del servidor mientras se escribe: espera a que el usuario pare y descarta las respuestas viejas.
// No toca el DOM: avisa por callbacks.
export const ESPERA_CALCULO_MS = 400;

// `calcular(datos)` devuelve la promesa de la API. `alIniciar()` se llama al programar, `alResultado(respuesta, indices)` con la respuesta vigente
// (o `(null, null)` si no hay nada que calcular) y `alError(error)` si falla la llamada vigente.
export function crearCalculador({ calcular, alIniciar, alResultado, alError, espera = ESPERA_CALCULO_MS }) {
  let temporizador = null;
  // Cada programación sube el contador: una respuesta con un número anterior ya no es la vigente.
  let contador = 0;

  // `obtener()` se evalúa al disparar (no al programar) para leer el formulario tal como quedó; devuelve { datos, indices } o null.
  function programar(obtener, { inmediato = false } = {}) {
    clearTimeout(temporizador);
    const mio = ++contador;
    alIniciar();
    const disparar = async () => {
      temporizador = null;
      const entrada = obtener();
      if (!entrada) { if (mio === contador) alResultado(null, null); return; }
      try {
        const respuesta = await calcular(entrada.datos);
        if (mio === contador) alResultado(respuesta, entrada.indices);
      } catch (error) {
        if (mio === contador) alError(error);
      }
    };
    if (inmediato) disparar(); else temporizador = setTimeout(disparar, espera);
  }

  // Al cerrar el modal: nada de lo que esté en vuelo debe pintarse.
  function cancelar() {
    clearTimeout(temporizador);
    contador += 1;
  }

  return { programar, cancelar };
}
