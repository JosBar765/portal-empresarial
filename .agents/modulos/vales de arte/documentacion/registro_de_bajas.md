# Registro permanente de vales dados de baja

Cuando un vale se elimina completo, el `DELETE` borra la fila y el cascade se lleva sus talleres, documentos e historial. Para no perder el rastro, cada baja deja una fila en `vale_bajas` y copia el historial del vale a `vale_baja_historial`, dentro de la **misma transacción** que el borrado.

## Qué se registra

| Camino | Dónde | `motivo` | `razon` |
|---|---|---|---|
| El asesor da de baja su vale | `valeCreacionService.darDeBaja` | `BAJA_ASESOR` | `eliminado por: <correo del asesor>` |
| Vence la vigencia sin autorizar | `valeCreacionService.expirarVale` | `VENCIMIENTO_VIGENCIA` | `vencimiento` |
| Vencen los adjuntos sin respuesta | `valeAdjuntosService._eliminarValeVencido` | `VENCIMIENTO_ADJUNTOS` | `vencimiento` |
| El supervisor rechaza una modificación | `valeCreacionService.rechazarCreacion` (`modificacion: true`) | `MODIFICACION_RECHAZADA` | `rechazado por: <correo del supervisor>` |
| Se quita UN taller de un vale con 2 o más talleres (el vale sigue vivo) | `valeAdjuntosService.quitarTallerDeVale` | `TALLER_QUITADO` | `taller quitado por: <correo del asesor>` (manual) o `adjuntos vencidos: taller <nombre>` (automático) |

Una fila por cada taller quitado, en la misma transacción que desactiva el taller (`valeRepository.quitarTallerYRegistrar`). Los vales que vencen por vigencia o adjuntos (menos las modificaciones `MOD-`) además pasan a un borrador del asesor (ver `borradores.md`): la baja guarda su `borrador_id`.

**No se registra:** revertir una creación fallida (`crearVale`: el vale nunca llegó a existir).

## La tabla `vale_bajas`

| Columna | Qué guarda |
|---|---|
| `correlativo` | Código del vale. No es único: una modificación `MOD-` comparte número con su original. |
| `cliente_empresa`, `cliente_nombre` | Empresa y cliente del vale. |
| `asesor_id`, `asesor_nombre`, `asesor_correo` | De quién era el vale (nombre y correo, como foto del momento). |
| `vale_original_correlativo` | Solo en una modificación: el código del original. |
| `estado` | Estado general en el que estaba. |
| `motivo`, `razon` | Código y texto legible de la baja (tabla de arriba). |
| `eliminado_por_id`, `eliminado_por_correo` | Quien decidió la baja; vacíos en un vencimiento. |
| `creado_en_vale` | Hora de creación del vale. |
| `fecha_entrega` | Fecha de entrega que quería el asesor (solo fecha). |
| `motivo_rechazo` | Motivo con que se rechazó el vale, si estaba rechazado (solo en la base: el borrador no lo lleva). |
| `taller_id`, `taller_nombre` | Solo en `TALLER_QUITADO`: el taller quitado (nombre como foto del momento). |
| `borrador_id` | Borrador creado con el vale vencido; vacío si no se creó (modificación `MOD-` o falla). Sin clave foránea: los borradores se purgan y el registro es permanente. |
| `eliminado_en` | Hora de eliminación. |

Sin claves foráneas hacia `vales` ni `usuarios`: el registro sobrevive al borrado y a cualquier cambio en los usuarios. Ningún proceso la purga.

## La tabla `vale_baja_historial`

Una fila por cada fila de `vale_historial` del vale eliminado, ligada a su baja por `baja_id`. Se copia **antes** del `DELETE`, en la misma transacción, para poder auditar qué le pasó al vale desde que se creó (también las modificaciones `MOD-` que vencen o se rechazan).

| Columna | Qué guarda |
|---|---|
| `baja_id` | Id de la fila de `vale_bajas`. |
| `usuario_id`, `usuario_correo` | Quien hizo la acción (correo como foto del momento). |
| `taller_id`, `taller_nombre` | Taller de la acción, si la hubo (nombre como foto del momento). |
| `disenador_id` | Diseñador de la acción, si la hubo. |
| `estado_anterior`, `estado_nuevo`, `accion` | Igual que en `vale_historial`. |
| `creado_en` | Fecha original de la acción. |

Sin claves foráneas y sin purga, igual que `vale_bajas`. `TALLER_QUITADO` no copia historial: el vale sigue vivo y conserva el suyo.

## Cómo funciona

- `valeBajas.armarBaja(motivo, actorId, { borradorId, tallerId, tallerNombre })` arma el registro; el correo de quien eliminó se lee de `usuarios`, no del token.
- `valeCreacionService.eliminarValeConArchivos(valeId, baja)` es el único punto de borrado; sin `baja` no registra.
- `valeRepository.eliminarYReabrirOriginal({ …, baja })` hace el `INSERT … SELECT` desde `vales` **antes** del `DELETE`, en la misma transacción, y luego copia el historial con `_copiarHistorialABaja`. Si el registro o la copia fallan, el vale no se borra: nunca se elimina sin dejar rastro.
- `valeCreacionService.eliminarVencidoConBorrador` crea el borrador ANTES de borrar y pasa su id a la baja; si el borrado falla, descarta el borrador.
- Las columnas `fecha_entrega`, `motivo_rechazo`, `taller_*` y `borrador_id` las agrega la migración `vencidos_a_borrador`. Cambian `valeCreacionService`, `valeAdjuntosService` y `vale_bajas`.
- Un motivo nuevo es una entrada más en `valeBajas.js` y un `armarBaja` en el camino que borra.

## Consultar

```sql
-- Las últimas bajas, con quién las hizo
SELECT correlativo, cliente_empresa, cliente_nombre, asesor_correo, estado, razon, creado_en_vale, eliminado_en
FROM vale_bajas ORDER BY eliminado_en DESC LIMIT 50;

-- Bajas de un asesor
SELECT * FROM vale_bajas WHERE asesor_correo = 'asesor@grupopremia.com' ORDER BY eliminado_en DESC;

-- Qué le pasó a un vale antes de eliminarse (su historial completo)
SELECT h.creado_en, h.usuario_correo, h.taller_nombre, h.estado_anterior, h.estado_nuevo, h.accion
FROM vale_bajas b JOIN vale_baja_historial h ON h.baja_id = b.id
WHERE b.correlativo = 'VAL-0001' ORDER BY b.id, h.creado_en, h.id;
```

## Verificación

`scripts/vales/verificar-bajas.js`, solo contra una base desechable con las migraciones aplicadas:

```text
node --require ./scripts/security/stub-storage.js scripts/vales/verificar-bajas.js
```

Ejerce los cuatro caminos reales (aún no cubre `TALLER_QUITADO`), comprueba cada columna, que revertir una creación no deja fila y que, si el registro falla, el vale sigue intacto.
