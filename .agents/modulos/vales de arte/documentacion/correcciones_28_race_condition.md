# Correcciones #28 — condición de carrera en el último cupo

Pregunta del usuario sobre correcciones_28: si a un taller le queda 1 cupo
para una fecha de entrega y 3 asesores distintos intentan crear un vale
para ese cupo al mismo tiempo, ¿solo uno lo consigue? La respuesta, con la
implementación original de correcciones_28, era **no** — había una
condición de carrera real.

## Causa raíz

`capacidadEntregaService.validarLimiteDiario` se llamaba ANTES de
`valeMutex.conColaDeCreacion`, y ese mutex está indexado por `asesorId` —
solo serializa al MISMO asesor (para el correlativo), no a asesores
distintos. Tres asesores distintos podían leer "queda 1 cupo" al mismo
tiempo (antes de que cualquiera terminara de insertar) y los tres pasar la
validación, superando el límite.

## Fix

Nueva cola global `valeMutex.conColaDeCapacidad(fn)` (una sola cola, no una
por taller/fecha — el volumen de creación de vales no justifica locks por
recurso con orden de adquisición para evitar deadlocks cuando un vale pide
2+ talleres a la vez). Verificar el límite y consumir el cupo (el INSERT
que lo cuenta) ahora son atómicos entre sí:

- `valeCreacionService.crearVale`: `validarLimiteDiario` + `valeRepository.crear`
  van dentro de `conColaDeCapacidad` (que a su vez envuelve el
  `conColaDeCreacion` existente, por el correlativo).
- `valeConfirmacionService.aprobarModificacion`: `validarLimiteDiario` +
  `valeRepository.crear` + `fanOutTalleres` van dentro de la misma cola
  global.
- `solicitarModificacion` NO necesita esto: su propio INSERT (una
  solicitud pendiente) no cuenta contra el límite — el gate real ocurre en
  `aprobarModificacion`, que sí revalida.

Mensaje de error, ahora amigable a propósito (mismo texto para "perdiste
la carrera por el último cupo" y para "llegaste tarde a un día ya lleno" —
el backend no puede ni necesita distinguir los dos casos):

> ¡Uy! El taller "X" ya no tiene cupo para el YYYY-MM-DD — alguien más
> acaba de tomar el último lugar. Selecciona otra fecha de entrega e
> intenta de nuevo.

## Verificado en vivo

Contenedor MySQL desechable + servidor Node aislado (ninguno de los dos
entornos existentes se tocó). Taller con `limite_diario = 1`, 3 asesores
DISTINTOS (single-session-per-user impide usar el mismo dos veces)
disparando `POST /api/vales` para la misma fecha, verdaderamente en
paralelo (`curl ... &` + `wait`):

- Resultado: exactamente 1 `HTTP 201`, 2 `HTTP 400` con el mensaje de arriba.
- Confirmado en la base de datos: una sola fila en `vales` para esa fecha —
  sin doble reserva pese a la concurrencia real.
