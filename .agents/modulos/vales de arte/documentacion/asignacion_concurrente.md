# Asignación a un diseñador sin carreras

Dos personas del mismo taller pueden intentar asignar un vale al mismo tiempo: el encargado a sí mismo, un asistente a sí mismo, o el encargado a un diseñador. Un vale en `PENDIENTE_ASIGNACION` debe quedar con **una sola** persona asignada, un solo registro en `vale_historial` y un solo aviso.

## Las dos capas

1. **Mutex en memoria** (`valeMutex.conLockDeVale`): `asignar` y `revisarPropuesta` corren dentro del lock del vale. La segunda petición del mismo proceso recibe 409 «Este vale se está procesando». Solo protege dentro de un proceso Node.
2. **Escritura condicional en la base** (la garantía real): `valeTallerRepository.asignar(id, disenadorId, fecha, estadosPermitidos)` hace `UPDATE vale_talleres … WHERE id = ? AND estado_id IN (<estados permitidos>)` y devuelve las filas cambiadas. InnoDB atiende una escritura primero; la segunda ya no encuentra el estado esperado y devuelve 0. No depende del proceso, así que vale con cualquier cantidad de procesos Node.

`valeTallerService._asignarOFallar` usa esa escritura en los dos caminos que asignan:

| Camino | Estado esperado |
|---|---|
| `asignar` (incluye la autoasignación) | `PENDIENTE_ASIGNACION` |
| Reasignación al desaprobar una propuesta (`_revisarPropuestaInterno`) | `EN_REVISION` |

Si devuelve 0, responde 409 «Este vale ya fue asignado a otra persona. Actualiza la pantalla.» **antes** de escribir el historial o avisar a nadie.

## Frontend

Si la asignación o la reasignación falla, `encargado.js` muestra el mensaje en el modal y recarga el buzón, para que quien perdió vea el estado real (el ganador además dispara el aviso en vivo a la sala del taller).

## Limitación conocida

El lock es por vale. Si un vale va a dos talleres y los dos encargados asignan en el mismo instante, uno recibe «se está procesando» aunque no choquen (es seguro; solo es molesto). No se cambió.

## Verificación

`scripts/vales/verificar-asignacion-concurrente.js`, solo contra una base desechable (crea vales de prueba y los borra):

```text
node --require ./scripts/security/stub-storage.js scripts/vales/verificar-asignacion-concurrente.js
```

Cuatro escenarios: un proceso con mutex; varios procesos simulados (mutex apagado); dos procesos Node reales con una barrera de tiempo; y la regla condicional del repositorio. Debe ganar una sola persona en cada ronda. Sin la escritura condicional, los escenarios 2 y 3 fallan: ganan todos y el historial queda con una asignación por intento.
