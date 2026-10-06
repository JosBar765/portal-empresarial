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
