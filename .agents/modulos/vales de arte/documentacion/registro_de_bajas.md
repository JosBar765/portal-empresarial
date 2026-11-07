# Registro permanente de vales dados de baja

Cuando un vale se elimina completo, el `DELETE` borra la fila y el cascade se lleva sus talleres, documentos e historial. Para no perder el rastro, cada baja deja una fila en `vale_bajas`, dentro de la **misma transacción** que el borrado.

## Qué se registra

| Camino | Dónde | `motivo` | `razon` |
|---|---|---|---|
| El asesor da de baja su vale | `valeCreacionService.darDeBaja` | `BAJA_ASESOR` | `eliminado por: <correo del asesor>` |
| Vence la vigencia sin autorizar | `valeCreacionService.expirarVale` | `VENCIMIENTO_VIGENCIA` | `vencimiento` |
| Vencen los adjuntos sin respuesta | `valeAdjuntosService._eliminarValeVencido` | `VENCIMIENTO_ADJUNTOS` | `vencimiento` |
| El supervisor rechaza una modificación | `valeCreacionService.rechazarCreacion` (`modificacion: true`) | `MODIFICACION_RECHAZADA` | `rechazado por: <correo del supervisor>` |

**No se registra:** revertir una creación fallida (`crearVale`: el vale nunca llegó a existir), ni quitar un solo taller de un vale con varios talleres (el vale sigue vivo).

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
| `eliminado_en` | Hora de eliminación. |

Sin claves foráneas hacia `vales` ni `usuarios`: el registro sobrevive al borrado y a cualquier cambio en los usuarios. Ningún proceso la purga.

## Cómo funciona

- `valeBajas.armarBaja(motivo, actorId)` arma el registro; el correo de quien eliminó se lee de `usuarios`, no del token.
- `valeCreacionService.eliminarValeConArchivos(valeId, baja)` es el único punto de borrado; sin `baja` no registra.
- `valeRepository.eliminarYReabrirOriginal({ …, baja })` hace el `INSERT … SELECT` desde `vales` **antes** del `DELETE`, en la misma transacción. Si el registro falla, el vale no se borra: nunca se elimina sin dejar rastro.
- Un motivo nuevo es una entrada más en `valeBajas.js` y un `armarBaja` en el camino que borra.

## Consultar

```sql
-- Las últimas bajas, con quién las hizo
SELECT correlativo, cliente_empresa, cliente_nombre, asesor_correo, estado, razon, creado_en_vale, eliminado_en
FROM vale_bajas ORDER BY eliminado_en DESC LIMIT 50;

-- Bajas de un asesor
SELECT * FROM vale_bajas WHERE asesor_correo = 'asesor@grupopremia.com' ORDER BY eliminado_en DESC;
```

## Verificación

`scripts/vales/verificar-bajas.js`, solo contra una base desechable con las migraciones aplicadas:

```text
node --require ./scripts/security/stub-storage.js scripts/vales/verificar-bajas.js
```

Ejerce los cuatro caminos reales, comprueba cada columna, que revertir una creación no deja fila y que, si el registro falla, el vale sigue intacto.
