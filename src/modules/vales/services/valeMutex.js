// src/modules/vales/services/valeMutex.js
// Mutex en memoria compartido por todos los servicios de vales — garantiza
// idempotencia de las transiciones de estado a nivel de core (no solo de
// frontend). Válido porque el sistema corre como un único proceso Node
// (monolito modular, sin infraestructura distribuida). Se exporta una única
// instancia: importar este archivo desde Creación, Taller y
// Confirmación/Modificación y usar SIEMPRE esta misma instancia es lo que
// hace que una operación desde cualquiera de esos servicios bloquee a las
// demás sobre el mismo vale — una instancia por archivo rompería esa garantía.
class ValeMutex {
  constructor() {
    this._locksEnVale = new Set();
    // Cola de creación por asesor: el correlativo se arma leyendo "cuántos
    // vales tiene ya este asesor" e insertando con ese número — dos
    // creaciones casi simultáneas del MISMO asesor podían leer el mismo
    // conteo antes de que la primera terminara de insertar, y generar un
    // correlativo duplicado. A diferencia de `conLockDeVale` (que RECHAZA la
    // segunda operación porque es un conflicto de edición sobre el mismo
    // vale), aquí la segunda solicitud debe simplemente ESPERAR su turno —
    // crear dos vales en paralelo para el mismo asesor es un flujo normal,
    // no un error. Válido por el mismo motivo: un único proceso Node.
    this._colaCreacionPorAsesor = new Map();
    // Cola global para "verificar el límite diario de un taller y, si
    // alcanza, consumir ese cupo" (crearVale, aprobarModificacion) —
    // analisis_correcciones_28.md. Sin esto, dos asesores DISTINTOS podían
    // leer el mismo conteo ("queda 1 cupo") al mismo tiempo y ambos
    // insertar, superando el límite: `conColaDeCreacion` no sirve para este
    // caso porque está indexada por asesor, no por taller/fecha. Una sola
    // cola GLOBAL (no una por taller+fecha) a propósito: evita tener que
    // adquirir locks de varios recursos en orden para no deadlockear
    // cuando un vale pide 2+ talleres a la vez, y el volumen real de
    // creación de vales no justifica esa complejidad — serializa toda
    // creación con el resto, pero cada una tarda milisegundos.
    this._colaCapacidad = Promise.resolve();
  }

  async conLockDeVale(valeId, fn) {
    const key = Number(valeId);
    if (this._locksEnVale.has(key)) {
      throw new Error('Ya hay una operación en curso sobre este vale de arte. Intenta de nuevo en un momento.');
    }
    this._locksEnVale.add(key);
    try {
      return await fn();
    } finally {
      this._locksEnVale.delete(key);
    }
  }

  conColaDeCreacion(asesorId, fn) {
    const key = Number(asesorId);
    const anterior = this._colaCreacionPorAsesor.get(key) || Promise.resolve();
    const actual = anterior.then(fn, fn);
    // La cola interna nunca debe quedar "envenenada" por un rechazo — el
    // siguiente en la fila debe poder correr igual; el error real lo sigue
    // recibiendo quien llamó a esta creación en particular a través de `actual`.
    this._colaCreacionPorAsesor.set(key, actual.catch(() => {}));
    return actual;
  }

  conColaDeCapacidad(fn) {
    const actual = this._colaCapacidad.then(fn, fn);
    this._colaCapacidad = actual.catch(() => {});
    return actual;
  }
}

module.exports = new ValeMutex();
