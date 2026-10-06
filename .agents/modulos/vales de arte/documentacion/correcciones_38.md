# Correcciones #38 — Pipeline de estado

Rama: `feature/pipeline-estado`. Diseño en Figma: página «Pipeline de estado (Vales)».

## Qué cambia

La columna «Estado» de las tablas pasa de una píldora de texto a un pipeline de 5 pasos numerados (Autorización, Asignación, Producción, Revisión, Confirmación), con la etiqueta del estado actual, quién actúa y marcas (`MOD`, `Vence en N h`). El mapeo de estados reales a pasos está en `flujo_vale_de_arte.md` §10.

## Decisiones

- **Un solo componente para todo el recorrido:** vale normal, vale `MOD-`, rechazo, vigencia, varios talleres, fusión y atraso. Los casos fuera del flujo actual que se quitaron del diseño (corrección tras revisión como paso rojo, «Sin propuesta», «MOD en trámite» del original) no existen como estado visual.
- **Cálculo en el servidor** (`valePipeline.js`): una sola fuente de verdad, sin duplicar reglas en el navegador. Cada fila trae `pipeline`.
- **Dónde se ve:** Buzón y Trabajo realizado de todos los roles, «Encontrar vale» (Gerente) y vales críticos de Rendimiento. El modal de carga de trabajo conserva su píldora.
- **Vigencia:** `SELECT_VALE` agrega `vigencia_minutos` (`TIMESTAMPDIFF(MINUTE, NOW(), vigencia_hasta)`), así no depende de la zona horaria del servidor.
- **Accesibilidad:** el contenedor expone «Paso N de 5: estado…»; cada paso es enfocable y muestra el mismo tooltip con foco (Esc lo cierra); nunca solo color (número, check, pausa o X).

## Contadores del Buzón más compactos

- Tarjetas de 48 px de alto (antes ~80): número a la izquierda y etiqueta a la derecha, con menos relleno y espacio (`styles.css`, `.contador-card`).
- Las que filtran ahora son `<button>` con `aria-pressed` (antes `<div>` sin teclado): se activan con Tab y Enter/Espacio, tienen anillo de foco visible y recuperan el foco al volver a pintarse; las informativas siguen siendo `<div>`.
- Estado activo con fondo y borde azules (antes solo un halo), hover sin desplazamiento de la tarjeta y números tabulares para que no salten al cambiar.

## Archivos

- `src/modules/vales/services/valePipeline.js` (nuevo), `valeBuzonService.js`, `valeRendimientoService.js`, `valeBusquedaService.js`, `repositories/valeRepository.js`.
- `public/modules/vales/js/components/pipeline.js` y `css/pipeline.css` (nuevos); `views/buzon.js`, `views/encontrarVale.js`, `views/rendimientoGerencia.js`, `app.js`, `index.html`.

## Verificación

Probado en navegador contra una base desechable con 18 vales que cubren todos los casos (esperando, rechazado, por vencer, cada estado de taller, varios talleres, fusión, por confirmar, recibido, atraso y vales `MOD-`): sin errores de consola, tooltips con el detalle por taller y con el motivo del rechazo.
# Correcciones 38 — Nuevo correlativo del vale de arte

Rama: `feature/nuevo-correlativo-vale` (desde `fix/correcciones-32`). Análisis de origen: `correcciones/analisis_correcciones_38.md`.

## Estado

| # | Punto | Estado |
|---|---|---|
| 1 | Nuevo formato de correlativo `{PAÍS}-{TIENDA}-{MMAA}-{N}` | **hecho** |

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

## Implementación

- **El número es el `id` del vale** (decidido con gerencia/producto): como hoy, sin tabla nueva. Los vales `MOD-` también consumen `id` aunque su correlativo repita el del original, así que entre dos vales normales pueden verse saltos; se aceptó.
- `catalogoRepository.obtenerTiendaPorId` devuelve ahora `pais_codigo` (`tienda → empresa → país`). `valeCreacionService.crearVale` falla con «La tienda asignada a tu usuario no tiene un país configurado… Avisa al administrador.» si falta, y arma el prefijo `{PAÍS}-{TIENDA}-{MM}{AA}` con la fecha de creación; `valeRepository.crear` le añade el `id`.
- Se eliminó `inicialesAsesor` (ya no se usa).

Verificación (por API): el correlativo sale `GT-MTC-1026-337` (país, tienda, mes y año de hoy, `id`), el siguiente vale es el `id` siguiente, la modificación se llama `MOD-GT-MTC-1026-337`, sus PDF se generan y descargan, el Gerente encuentra el vale y su `MOD-` por correlativo, la búsqueda del Buzón por texto funciona, el orden ascendente y descendente mezcla bien los correlativos viejos y nuevos, las notificaciones y el historial nombran el correlativo nuevo, y con el código de país vacío la creación responde 400 con el mensaje claro.

## Orden y filtros

`numeroDeCorrelativo` (Buzón) ya toma el **último número** del correlativo, así que el orden y el filtrado por correlativo siguen funcionando sin cambios con el formato nuevo, porque el número es global y creciente.

## Qué toca (a revisar al implementar)

- Backend: `valeCreacionService.crearVale` y `valeRepository.crear` (arman el correlativo), un repositorio que resuelva el código de país de la tienda, y `valeHelpers.inicialesAsesor` (deja de usarse en el correlativo).
- Se usa el correlativo como texto en: PDF del vale (`valePdfService`), notificaciones e historial, búsqueda de «Encontrar vale» del Gerente (`valeBusquedaService`) y filtros y búsqueda del Buzón. No depende del formato en ninguno de esos sitios (en Storage los archivos se guardan con nombre aleatorio).
- Documentación a actualizar: `flujo_vale_de_arte.md` (conceptos clave) y el `CLAUDE.md`.
