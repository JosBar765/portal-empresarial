// Idempotencia de las acciones que consultan al servidor (puro: sin DOM ni estado, para probarse aislado).
// Mientras una operación con la MISMA clave sigue en curso, pedirla otra vez devuelve esa misma promesa y no lanza otra.
// `epoca()`: contador que sube cuando lo en curso deja de valer (p. ej. se cambió de reporte); entonces no se fusiona con ello,
// porque su resultado ya no se pintará. Una vez terminada, pedirla de nuevo sí ejecuta de nuevo (así se puede refrescar).
export function crearUnaALaVez(epoca = () => 0) {
  let actual = null;
  return (clave, tarea) => {
    if (actual && actual.clave === clave && actual.epoca === epoca()) return actual.promesa;
    const entrada = { clave, epoca: 0, promesa: null };
    entrada.promesa = Promise.resolve(tarea()); // la tarea arranca aquí, de forma síncrona
    entrada.epoca = epoca(); // tras arrancar: la tarea puede haber subido la época al empezar
    actual = entrada;
    const limpiar = () => { if (actual === entrada) actual = null; };
    entrada.promesa.then(limpiar, limpiar);
    return entrada.promesa;
  };
}
