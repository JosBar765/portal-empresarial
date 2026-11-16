# Viáticos: «visto» obligatorio para autorizar y vencimiento 4 horas después del rechazo

Rama: `module/viaticos`. Estado: en curso (2026-11-16). Estrategia de entrega: `ask-on-risk`.

## Objetivo
1. **Visto obligatorio:** quien va a autorizar o rechazar una solicitud de viáticos debe haber abierto antes su documento (como en Vales de Arte). Si el solicitante la corrige, el visto se pierde y hay que volver a verla.
2. **Vencimiento tras el rechazo:** una solicitud rechazada vence 4 horas después del rechazo; al vencer **pasa a un borrador del solicitante** (decisión del dueño, 2026-11-16) y la solicitud desaparece.

## Referencia de Vales de Arte (lo que se copia y lo que no)
- Visto: tabla `vale_vistos(vale_id, usuario_id, visto_en)` por usuario; `POST /:id/visto`; el servidor exige el visto para autorizar y rechazar (el Administrador queda exento) y se reinicia al corregir o reenviar; en el frontend abrir el visor lo registra y deshabilita Autorizar y Rechazar hasta entonces (solo ayuda: manda el servidor).
- Vencimiento: en Vales NO existe «N horas después del rechazo» (un solo reloj desde la creación); la regla de Viáticos es nueva. Lo que sí se copia: «vencidos a borrador», aviso previo al 25 % restante, notificación al vencer, borrado de archivos.

## Decisiones (valores por defecto fijados por el padre; el dueño eligió solo el destino al vencer)
- Al vencer: pasa a borrador del solicitante y la solicitud se borra con sus archivos (el borrado en Storage solo actúa en producción). Las fotos de defectos no se conservan (como en cualquier borrador). El correlativo de la solicitud se pierde.
- Las 4 horas son **corridas** (no laborales) y se guardan como ajuste `rechazo_vigencia_horas` (entero, 4 por omisión) editable en Configuración.
- El reloj nace al rechazar (`rechazada_en`) y se borra al modificar (modificar la devuelve a «esperando autorización»). Las solicitudes ya rechazadas al desplegar arrancan su reloj en ese momento (no en la fecha del rechazo), para no vencer de golpe.
- Aviso previo al solicitante cuando queda el 25 % del plazo (con 4 h, una hora antes), una sola vez.
- El borrador creado por vencimiento NO cuenta contra el tope de 15 (para no perder trabajo) y vence a los 30 días como cualquier borrador.
- Visto: por usuario con `viaticos.autorizar`, vale para autorizar y para rechazar, basta con abrir el visor de la solicitud (PDF primero), el Administrador queda exento y se borra al modificar.
- Borradores nuevos: los creados por vencimiento llevan una insignia roja sobre el botón «Borradores» hasta que el solicitante abre la lista (igual que Vales); los borradores normales no la activan.

## Tareas
- [x] T1. Migración `39_viaticos_vistos.sql`: tabla `viaticos_vistos(solicitud_id, usuario_id, visto_en)`, PK compuesta y FK con CASCADE.
- [x] T2. Servidor del visto: repositorio y servicio, `POST /gestiones/:id/visto` (`viaticos.autorizar`, solo con la solicitud esperando autorización), exigir el visto en `gestionService.decidir` para autorizar y rechazar (Administrador exento, mensaje explicativo), borrar los vistos al modificar dentro de la transacción de `persistir`, y bandera `visto` por fila en el listado de Gestiones.
- [x] T3. Formulario del visto: abrir el visor en Gestiones registra el visto; Autorizar y Rechazar deshabilitados hasta verlo (con explicación); la fila se actualiza sin recargar todo; textos centralizados.
- [x] T4. Documentación del visto (contrato, modelo de datos, plano del frontend, README).
- [x] T5. Migración `40_viaticos_rechazo_vencimiento.sql`: columnas `rechazada_en` y `vencimiento_aviso_en` en `viaticos_solicitudes`, ajuste `rechazo_vigencia_horas` = 4, y las solicitudes ya rechazadas arrancan su reloj al migrar; en `viaticos_borradores` se agregan `visto_en` (NULL en los creados por vencimiento), `origen_correlativo` y `origen_motivo` (para mostrar de dónde viene cada borrador, como en Vales).
- [x] T6. Servidor del vencimiento: poner `rechazada_en` al rechazar y limpiarla (y el aviso) al modificar; `rechazoWatcher` cada 60 s con aviso previo y expiración (crear borrador con la forma del formulario, sin tope, borrar solicitud y archivos con bloqueo de fila y revalidación); notificaciones y evento en tiempo real; ajuste en `AJUSTES`; `POST /borradores/vistos` y un evento de tiempo real para avisar de los borradores nuevos por vencimiento.
- [x] T7. Formulario del vencimiento: «Vence en X» en la lista y el detalle de una rechazada (tiempo calculado con el reloj del servidor), campo del ajuste en Configuración, textos de las notificaciones nuevas; insignia roja sobre el botón «Borradores» con la cantidad de borradores nuevos por vencimiento (como `#borradores-nuevos` de Vales), etiqueta «Nuevo» y origen (correlativo y motivo del rechazo) en la lista, y la insignia se apaga al abrirla.
- [x] T8. Documentación del vencimiento.
- [ ] T9. Pruebas: API y navegador de ambas funciones (ver abajo).

## Rutas
Un escritor por bloque, en orden: T1 a T4, luego T5 a T8. Cada migración la aplica el dueño con `! npm run migrate` y hasta entonces el servidor de desarrollo fallará en Gestiones y en las listas. T9 la coordina el padre.

## Pruebas previstas
- Visto: autorizar y rechazar sin visto dan error; tras `POST /visto` pasan; modificar la solicitud reinicia el visto; el Administrador está exento; quien no tiene `viaticos.autorizar` no puede registrar visto; en el navegador los botones se habilitan al abrir el visor.
- Vencimiento: rechazar, adelantar `rechazada_en` a más de 4 h y ejecutar el vigilante: se crea el borrador (reabrirlo en el formulario restaura todos los campos), la solicitud y sus archivos desaparecen, el solicitante recibe la notificación; aviso previo una sola vez; modificar antes del vencimiento evita que venza; el borrador creado por vencimiento ignora el tope.
- Sin runner automatizado; RED/GREEN no aplica (excepción registrada).

## Evidencia
- Análisis previo (2026-11-16): `valeVistoService`, `vale_vistos`, `vigenciaWatcher`, `valeCreacionService.expirarVale` en Vales; `gestionService.decidir`, `solicitudGuardadoService.persistir`, `borradorWatcher`, `viaticos_historial` y `AJUSTES` en Viáticos.
- Visto obligatorio (T1 a T4) hecho por un escritor delegado y revisado por el padre; migración `39_viaticos_vistos.sql` aplicada por el dueño. API (2026-11-16, autorizador de prueba sin ser administrador): autorizar y rechazar SIN visto dan 400 con mensaje explicativo; quien no tiene `viaticos.autorizar` no puede registrar visto (403); `POST /gestiones/:id/visto` guarda (`{visto:true}`) y el listado y el detalle traen `visto`; autorizar y rechazar CON visto dan 200; el visto sobre una solicitud que ya no espera autorización no guarda (`{visto:false}`); si el solicitante modifica, el visto se pierde y hay que volver a verla; el Administrador está exento. Navegador (autorizador): las filas «Esperando autorización» tienen Autorizar y Rechazar deshabilitados con explicación; al abrir el visor del PDF solo esa fila los habilita, sin recargar; autorizar y rechazar desde la interfaz funcionan; al corregir el solicitante por API con la lista abierta, la fila vuelve a bloquearse sola en tiempo real.
- Vencimiento (T5 a T8) escrito por un escritor delegado (2026-11-16): migración `40_viaticos_rechazo_vencimiento.sql` (aplicada por el dueño), `rechazoWatcher.js` con `rechazoVencimientoService`/`rechazoPlazoService`/`rechazoRepository`, `borradorDesdeSolicitud.js` (equivale a `estadoABorrador(detalleAEstado(...))`, comprobado con `deepEqual`), `POST /borradores/vistos`, `vencimiento` en listas y detalle, insignia roja en Borradores, subpestaña «Vencimientos» en Configuración. Verificado: `node --check`, carga de módulos, claves de textos, fines de línea. **T9 (pruebas en ejecución) sigue PENDIENTE**: el vigilante, el aviso previo, la creación del borrador y la insignia NO se han probado contra la BD ni en el navegador.
