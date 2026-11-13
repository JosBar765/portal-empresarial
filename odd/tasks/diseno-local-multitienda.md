# Diseño Local multitienda

Rama: `feature/diseno-local-multitienda` (desde `dev` 4052dda). Estado: mergeado a dev (PR #171). Engram: `odd/diseno-local-multitienda/tasks`, decisiones en `odd/talleres-local-por-tienda/*` (#170, #172).

## Objetivo
Un taller Diseño Local atiende varias tiendas y una tienda puede usar varios Locales; sin romper producción.

## Decisiones del dueño
- SAA, SMG y ECL usan el Local de SSV (se asignan desde el admin, no en la migración).
- Feriados: los del país del taller sede (`talleres.tienda_id`, sin cambio).
- Sin cupo por ahora.
- Un vale puede ir a varios generales entre sí o a varios Locales entre sí; nunca generales con Local.
- Multi-Local replica la lógica del multitaller general. La fusión la hace quien tenga `vales.aprobar_general`.

## Tareas
- [x] T1 Migración `33_diseno_local_tiendas.sql` (tabla `taller_local_tiendas`, copia 1 a 1). Probada en `retencion_test` con el respaldo PROD 2026-11-10: 7 Locales = 7 filas idénticas a `talleres.tienda_id`; segunda ejecución sin cambios.
- [x] T2 Elegibilidad y regla de mezcla (verificada en `retencion_test`: supervisores y reportes idénticos para los 7 Locales; fila extra SAA→Local SSV visible solo para SAA; fila revertida): `valeHelpers.js` (`talleresElegiblesDeTienda`, `validarEleccionTalleres`), `selectorTalleres.js`, `tallerRepository.listarActivos`, cobertura del supervisor, reportes, personal por tienda.
- [x] T3 Admin (backend verificado en `retencion_test`; frontend sin probar en navegador, lo verifica el dueño): `crearLocal` transaccional escribe `talleres`, `taller_tiendas` y la sede en `taller_local_tiendas`; acción «Asignar tiendas» (`/talleres/:id/tiendas`, menú en cascada por país, `tallerTiendas.js`); sede no removible; agregar/quitar/duplicado/general con mensajes claros; filas de prueba revertidas (10 talleres, 7 filas, como antes). `tallerForm.js` sigue usando la sede (regla un Local por sede).
- [x] T5 Admin (backend verificado en `retencion_test`; frontend sin probar en navegador, lo verifica el dueño): pestaña «Propuestas compartidas» (`propuestasCompartidas.js`, `GET /talleres/propuestas-compartidas`, `PUT /talleres/:id/comparte-propuestas`). Regla de grupo (generales juntos; Locales del mismo país) aplicada en `propuestaCompartidaRepository` (`grupoDe`) y `hermanosDe`; con los datos actuales idéntico (generales se ven, Locales en 0). `comparte_propuestas` NO se activa en migración. Mockup en Figma omitido por decisión del dueño (2026-11-10): se reutilizó el estilo de pestañas existente.
- [x] T6 (verificado en `retencion_test`; frontend sin probar en navegador, lo verifica el dueño; filas revertidas) Crear Locales con nombre libre y tienda principal (opción A, aprobada 2026-11-10): se quita «un Local por sede» y el nombre automático `Diseño Local - <código>`; la sede (tienda principal) sigue dando país, feriados y código de archivo y puede repetirse entre Locales. Revisar `nombreArchivo.js` (hoy deduce «es Local» y la tienda desde el NOMBRE; ver H1 de `parche-diseno-local.md`) y colisión de código de archivo entre Locales de una misma sede. Hecho: `crearTallerLocal({ nombre, tiendaId, encargadoId })` valida nombre (obligatorio, sin espacios sobrantes, ≤100, único); `codigoTaller` decide «es Local» con `tienda_id` y usa `tiendas.codigo` (join en `tallerRepository.obtenerPorId`): nombre de archivo de los 7 Locales idéntico al anterior; segundo Local con sede SSV creado y elegible junto al primero; sin colisión (contador compartido por prefijo). Cierra H1 del parche.
- [x] T4 Pruebas contra copia del respaldo y documentación (`.agents/modulos/vales de arte/`, `admin/`).

## Pendiente de revisar en T2
Multi-Local en el flujo del multitaller: fusión, `comparte_propuestas` (hoy 0 en Locales), rechazo por taller, baja automática, cierre sin filas abiertas.
