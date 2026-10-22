# Reportes: propuestas individuales por taller en los vales multitaller

Rama: `fix/reportes-propuestas-multitaller`, sale de `origin/dev` (`ab9cef0`, 2026-10-19). Sin upstream a propósito: NO se pushea hasta que lo pida el usuario.

## Problema
En Reportes, el ojo de una fila abre el visor (`abrirVisorVale`) con una sola pestaña de propuesta que pide `tipo: 'ultima'`: la última fila de `vale_propuestas` del vale, de cualquier taller. En un vale multitaller no es la propuesta de cada taller ni la fusionada. Además la ficha del reporte prefiere la fusión (`propuesta_general_url`) pero el clic ignora esa preferencia.

## Objetivo
Para los vales multitaller, el ojo de Reportes muestra el mismo visor que usan asesores y supervisores, con las propuestas individuales de cada taller, como el modal de fusión del encargado.

## Decisiones (por defecto, a confirmar con el usuario al verlo)
- Vale con 2 o más talleres activos (`vale_talleres.activo = 1`): pestañas «Vale de arte», «Propuesta <Taller>» (una por taller que ya entregó: la última propuesta con archivo del diseñador de ese taller; nota y enlaces incluidos, el visor ya los soporta) y «Propuesta fusionada» si existe `propuesta_general_url`.
- Un taller sin propuesta entregada no muestra pestaña. Un taller dado de baja no cuenta.
- Vale de un solo taller: sin cambios (Vale de arte + Propuesta).
- Vale `MOD-`: solo sus propias propuestas (no se mezclan con las del original).
- Aplica a todos los roles que hoy tienen el ojo en Reportes (Supervisor, Encargado/Asistente, Administrador y Gerente). El acceso a los datos ya lo resuelve `GET /api/vales/:id` y `valeDetalleService._puedeVerVale`.

## Diseño
- Backend mínimo: la ficha de `valeReporteGruposService` lleva un indicador `multitaller` (2+ talleres activos distintos).
- Frontend: en `reportes.js` los tres puntos donde se abre el ojo (`htmlMiniTabla` ~:467, atrasados vigentes ~:297 y `conectarAcciones` ~:581) usan una función nueva cuando el indicador está activo. Esa función pide `obtenerDetalleVale(id)` y arma los documentos con `abrirVisorDocumentos`, reutilizando la lógica de `propuestaDe` del modal de fusión (`js/actions/encargado.js` ~:140-218). No se cambia el comportamiento por defecto de `abrirVisorVale` ni del modal de fusión.

## Reglas
`.agents/reglas/reglas_implementacion.md`: no cambiar endpoints ni payloads salvo el campo aditivo; sin abstracciones nuevas; comentarios de una línea; archivos CRLF se editan conservando CRLF. Commits Conventional Commits en español, sin Co-Authored-By.

## Tareas
- [x] T1 Indicador `multitaller` en la ficha del reporte (`valeReporteGruposService.js`). Commit 8a2be39.
- [x] T2 Función que abre el visor con una pestaña por taller y la fusionada, reutilizando la lógica del modal de fusión sin duplicarla ni cambiarla. Commit 6f496a5.
- [x] T3 Conectar los tres ojos de Reportes a esa función cuando el vale es multitaller. Commit 6f496a5.
- [x] T4 `node --check`, relectura del diff y revisión de que los demás llamadores del visor no cambian.
- [ ] T5 Verificación visual en el navegador (gerente, supervisor, encargado) con un vale multitaller real de la BD de pruebas.
- [x] T6 Documentación breve en `.agents/modulos/vales de arte/documentacion/`.

## Rutas
Un writer delegado para T1-T4 y T6; T5 verificación visual aparte.

## Progreso
T1-T4 y T6 hechas; T5 (verificación visual) pendiente. Helper en `public/modules/vales/js/actions/propuestasMultitaller.js`.
