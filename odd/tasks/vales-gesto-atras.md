# Vales: el gesto «atrás» del celular sale del módulo con un visor o modal abierto

Estado: HECHO el 2026-11-19 en `feat/vales-reportes-2` por indicación del dueño (portado de Viáticos: `utils/historialCapas.js`, `modal.js`, `visorDocumento.js`; ver `correcciones_66.md`). Falta probarlo en un celular real. Pendiente: revisar otros módulos con visores propios.

## Problema
En celular, con el visor de documentos (o cualquier modal) abierto en Vales de Arte, el botón o gesto «atrás» del navegador no cierra el visor: sale de la página y lleva al dashboard de módulos. Se pierde lo que se estaba viendo o llenando. El frontend de Vales no maneja el historial del navegador (no hay `pushState` ni `popstate` en `public/modules/vales/`).

## Por qué Vales no quedó cubierto
Viáticos ya lo resolvió (commit `e721b2c` en `module/viaticos`), pero los componentes se copian entre módulos, no se importan (`/modules/vales/*` exige `vales.ver`), así que el visor de Vales es otro archivo y no tiene el arreglo.

## Cómo se resolvió en Viáticos (referencia)
- `public/modules/viaticos/js/utils/historialCapas.js`: mientras haya capas abiertas se mantiene UNA entrada propia en el historial; el «atrás» la consume y cierra solo la capa de arriba; si la capa no se deja cerrar (cambios sin guardar) la entrada se repone; al cerrarse por la X se quita la entrada (con `setTimeout` para no romper un visor que reemplaza a otro en el mismo turno).
- Cada capa llama `registrarCapa(cerrarPorAtras)` al abrirse y el `soltar()` que devuelve al cerrarse: `components/modal.js`, `components/visorDocumento.js`, `components/firmaPantalla.js`.
- Documentado en `.agents/modulos/viaticos/documentacion/plano_frontend.md`, «Gesto “atrás” en celular».

## Alcance probable en Vales
- `public/modules/vales/js/components/visorDocumento.js` (`abrirVisor`, `abrirVisorVale`, `abrirVisorPropuesta`).
- El modal propio de Vales y los visores que lo usan (`actions/asesor.js`, `encargado.js`, `supervisor.js`, `propuestasMultitaller.js`, `propuestasOtros.js`, `views/buzon.js`, `views/reportes.js`).
- Revisar otros módulos con visores o modales propios (p. ej. Generador de Prompts, Administración).

## Nota aparte
Los PDF no se ven integrados en Chrome de Android: es una limitación del navegador; el visor ya ofrece «Abrir en pestaña» como respaldo.
