# Correcciones 38 — Nuevo correlativo del vale de arte

Rama: `feature/nuevo-correlativo-vale` (desde `fix/correcciones-32`). Análisis de origen: `correcciones/analisis_correcciones_38.md`.

## Estado

| # | Punto | Estado |
|---|---|---|
| 1 | Nuevo formato de correlativo `{PAÍS}-{TIENDA}-{MMAA}-{N}` | **pendiente de implementar** |

## Cómo se arma hoy

- `valeCreacionService.crearVale`: `correlativoPrefijo = "{código tienda}-{iniciales del asesor}"`.
- `valeRepository.crear`: inserta la fila y luego sustituye el correlativo por `"{prefijo}-{id autoincremental}"`. El número es el `id` de MySQL: global y nunca se reutiliza.
- El vale de modificación se llama `MOD-` + el correlativo del original (`valeModificacionService`).
- `vales.correlativo` es `VARCHAR(60) UNIQUE`; el formato nuevo (`GT-MTC-1026-15`, unos 14 a 20 caracteres) cabe de sobra.

## Formato nuevo (decidido)

`{PAÍS}-{TIENDA}-{MM}{AA}-{N}`, por ejemplo `GT-MTC-1026-1`; el vale de modificación es `MOD-GT-MTC-1026-1`.

- **País:** `paises.codigo` del país de la **empresa** de la tienda (`tiendas.empresa_id` → `empresas.pais_id`). En la base de desarrollo las 27 tiendas tienen empresa con país, y coincide con el país de su subdivisión en todas las que la tienen. Si una tienda no resolviera país, la creación falla con un mensaje que pide avisar al administrador.
- **Mes y año:** `MM` con dos dígitos (`01` a `12`) y `AA` los dos últimos dígitos del año, de la fecha de **creación** (hora de referencia UTC-6, como el resto del módulo).
- **Número:** correlativo general del sistema. No se reinicia por mes ni por tienda, no se rellena con ceros y no se reutiliza aunque el vale se borre (baja, vencimiento, rechazo que lo elimina).
- **Iniciales del asesor:** ya no forman parte del correlativo.
- **Vales existentes:** conservan su correlativo (no se renumeran). Cómo queden los datos de prueba no importa.

## Orden y filtros

`numeroDeCorrelativo` (Buzón) ya toma el **último número** del correlativo, así que el orden y el filtrado por correlativo siguen funcionando sin cambios con el formato nuevo, porque el número es global y creciente.

## Qué toca (a revisar al implementar)

- Backend: `valeCreacionService.crearVale` y `valeRepository.crear` (arman el correlativo), un repositorio que resuelva el código de país de la tienda, y `valeHelpers.inicialesAsesor` (deja de usarse en el correlativo).
- Se usa el correlativo como texto en: PDF del vale (`valePdfService`), notificaciones e historial, búsqueda de «Encontrar vale» del Gerente (`valeBusquedaService`), filtros y búsqueda del Buzón, y el nombre de los PDF en Storage (`{correlativo}.pdf`).
- Documentación a actualizar: `flujo_vale_de_arte.md` (conceptos clave) y el `CLAUDE.md`.
