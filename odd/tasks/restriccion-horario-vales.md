# restriccion-horario-vales

Rama: `feature/restriccion-horario-vales` (recreada desde el `origin/dev` del 2026-10-08) · Estado: T1–T4 reaplicadas; T5–T7 pendientes (sábado y taller primero).

## Objetivo
Proteger los días de trabajo de los talleres: los vales no se piden en domingo y la entrega "para hoy" solo se acepta si el vale se crea y se autoriza antes de las 12:00.

## Reglas acordadas con el usuario (hora de Guatemala, UTC-6)
- **Fecha mínima de entrega**: hoy si son las 11:59 o antes; mañana desde las 12:00. Si ese día es domingo, pasa al lunes. La fecha de entrega **nunca** puede ser domingo. La fecha del evento no tiene restricción.
- **Domingo**: no se puede crear un vale, solicitar una modificación, corregir, reenviar, autorizar ni aprobar una modificación.
- **Aplica a todo lo que lleva fecha de entrega**: crear, solicitar modificación, corregir y reenviar (también a supervisores que crean vales propios).
- **Al autorizar** (creación y modificación): si la fecha de entrega es anterior al mínimo de ese momento (hoy pasado el mediodía, o una fecha ya pasada), error y el supervisor debe rechazar el vale para que el asesor cambie la fecha. Mensaje: «La fecha de entrega ya no está disponible porque son pasadas las 12:00. Rechaza el vale para que el asesor modifique la fecha de entrega.»
- **Plazos de 24 h**: el domingo **no cuenta** en ninguno de los cuatro (esperando autorización, vale rechazado, modificación, adjuntos). Un vale creado el sábado a las 15:00 vence el lunes a las 15:00.
- Los vales existentes no se tocan hasta que alguien actúe sobre ellos. El calendario deshabilita domingos y fechas anteriores al mínimo; el servidor es quien hace cumplir la regla.

## Hallazgos del mapeo
- Un solo validador (`validarDatosVale`, `valeCreacionService.js:343`) cubre crear, modificar y corregir; `reenviarAutorizacion` tiene su propio chequeo (`:306`); `autorizarCreacion` (`:151`) y `aprobarModificacion` (`valeModificacionService.js:112`) no validan fecha.
- `vales.vigencia_hasta` se fija una sola vez (crear, solicitar modificación) con `DATE_ADD(NOW(), INTERVAL 24 HOUR)` en SQL, y no se reinicia al rechazar, corregir ni reenviar. La ventana de adjuntos (`adjuntos_vence_en`) se fija en el primer rechazo. Son 3 puntos de escritura: `valeRepository.js:40`, `valeModificacionRepository.js:23`, `valeTallerRepository.js:69`.
- Watchers, marca «Vence en N h» y cuenta regresiva derivan del valor guardado: basta guardar el vencimiento ya corrido.
- El selector de fecha usa la hora local del navegador y solo deshabilita por mínimo (`datepicker.js:241`); no hay manejo de UTC-6 en el frontend.

## Diseño técnico propuesto
- Ayudantes en `valeHelpers.js` (hora UTC-6): `esDomingo`, `fechaMinimaEntrega(ahora)` y `sumarHorasSinDomingos(inicio, horas)` (las horas de un domingo no cuentan).
- Mensajes de error por acción, en español, desde el servidor.
- El vencimiento se calcula en JS con el ayudante y se guarda como datetime en los 3 puntos de escritura.

## Tareas
- [x] T1 · Validaciones de servidor: ayudantes, fecha mínima y domingo en crear / modificar / corregir / reenviar; bloqueo del domingo y chequeo de fecha en autorizar y aprobar modificación. Ruta: escritor delegado. Verificado: 40 de 41 checks en proceso con el reloj simulado; el único fallo fue una expectativa mal escrita del propio script (el mínimo ese día era el 15, no el 16) y el código respondió bien. No probado: rutas HTTP, frontend, supervisor creando vale propio.
- [x] T2 · Plazos de 24 h sin domingos: ayudante y los 3 puntos de escritura (autorización/rechazado, modificación, adjuntos). Ruta: escritor delegado. Verificado: 16/16 casos unitarios del ayudante y la integración en proceso con el reloj simulado (sábado 15:00 vence lunes 15:00; modificación y adjuntos igual; segundo rechazo no mueve el plazo); los watchers siguen borrando al vencer. El reloj de la BD coincide con el de la aplicación (0 s). Desviación: se reemplazó la bandera `conVigencia` por el valor `vigenciaHasta` y el cálculo vive en los servicios (los repositorios no pueden importar valeHelpers: dependencia circular).
- [x] T3 · Calendario: mínimo en hora de Guatemala, domingos deshabilitados, mensajes claros. Ruta: escritor delegado. Verificado en el navegador: con el reloj real (pasado el mediodía) el mínimo es mañana y los domingos están deshabilitados; con el reloj simulado a las 11:00, hoy queda habilitado y la nota dice "Entrega mínima: 07/10"; helpers probados bajo tres zonas horarias distintas. Sin ver en pantalla: corregir con fecha ya inválida y el error del servidor en el modal.
- [x] T4 · Documentación y verificación de punta a punta con reloj simulado. Documentación: sección 5.1 de `flujo_vale_de_arte.md` y `CLAUDE.md`. Verificación de punta a punta por HTTP con el reloj real (14:06 en Guatemala): entrega hoy rechazada con el mínimo, domingo rechazado, mañana se crea y se autoriza, autorizar con entrega de hoy da el error exacto y el supervisor puede rechazar (6/6). Sin probar: domingo real por HTTP (solo con reloj simulado en proceso) y la pantalla del supervisor ante el error.

## Verificación y evidencia
Sin suite de tests: scripts propios en proceso con el reloj simulado (`Date.now`) contra la BD de desarrollo, y la interfaz en el navegador.
(pendiente)

## Ruta por tarea
(pendiente)

## Siguiente paso
T1.

## Cambios posteriores (2026-10-08): sábado y taller primero
Reglas nuevas acordadas con el usuario (reemplazan lo que decía solo del domingo):
- **Sábado y domingo son días de descanso de los talleres.** No se puede crear un vale, solicitar una modificación, corregir ni reenviar en sábado ni en domingo. **Autorizar y aprobar una modificación SÍ se pueden en sábado** (el vale llega a los talleres ese día, sin espera); **en domingo no** (el domingo sigue bloqueado todo).
- **La fecha de entrega nunca puede ser sábado ni domingo.** El mínimo de entrega (hoy antes de las 12:00, si no mañana) salta sábados y domingos hasta el lunes.
- **Los plazos de 24 h no cuentan sábado ni domingo** (esperando autorización, rechazado, modificación y adjuntos): un vale creado el viernes a las 15:00 vence el lunes a las 15:00.
- **El atraso NO se toca:** sigue contando días corridos. La restricción solo evita pedir entregas en sábado y domingo.
- **Al crear un vale, la fecha de entrega queda deshabilitada hasta que haya al menos un taller seleccionado.** Si se quitan todos los talleres, la fecha se borra y el campo vuelve a deshabilitarse. En modificar y corregir los talleres ya vienen fijos y la fecha queda habilitada.

## Tareas nuevas
- [x] T5 · Servidor: sábado y domingo (fin de semana) en validaciones, mínimo de entrega y plazos de 24 h; autorizar y aprobar modificación permitidos en sábado y bloqueados en domingo. Ruta: escritor delegado. Verificado con reloj simulado y por HTTP: 13/13 (plazos), 55/55 (validaciones: mínimo, sábado y domingo, autorizar permitido el sábado y bloqueado el domingo, rechazar siempre), 12/12 (plazos integrados) y 7/7 por HTTP con el reloj real. Consecuencia: un vale con entrega el viernes solo se puede autorizar hasta el viernes a las 11:59; después el mínimo es el lunes y el supervisor debe rechazarlo.
- [x] T6 · Calendario: deshabilitar sábados y domingos, mínimo con fin de semana, y fecha de entrega deshabilitada hasta elegir un taller (se borra si se quitan todos). Ruta: escritor delegado. Verificado en el navegador como asesor: sin taller el campo está apagado con «Elige primero un taller» y no abre el calendario; con un taller se habilita; sábados y domingos y los días anteriores al mínimo salen deshabilitados; al quitar el único taller la fecha se borra y el campo vuelve a apagarse; en solicitar modificación el campo queda habilitado con la fecha precargada. Mínimo y helpers probados bajo tres zonas horarias.
- [ ] T7 · Documentación y verificación de punta a punta con reloj simulado.
