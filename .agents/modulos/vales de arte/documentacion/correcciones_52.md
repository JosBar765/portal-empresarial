# Correcciones 52 — Horario laboral, feriados y fecha de entrega aplicados a los vales

Rama: `feature/horarios-laborales`.

## Qué cambia

- **Plazo único de N horas laborales** (parámetro `horas_vencimiento_vale`, hoy 4) en lugar de los tres plazos de 24 h: vale en espera de autorización (y rechazado), `MOD-` y adjuntos tras el primer rechazo (no se reinicia). El cómputo solo corre dentro del horario laboral de cada día y salta noches, días no laborales y feriados del país del vale (Guatemala para Diseño, Diseño UV/3D y Protextil; el de la tienda para Diseño Local).
- **Aviso de «por vencer»** al 25% del plazo en tiempo laboral (una vez), con texto dinámico; reemplaza el aviso de 6 h. La etiqueta «Vence en N h / N min» del buzón muestra el tiempo laboral restante y se pone ámbar con el mismo 25%.
- **Fecha de entrega:** no admite días que no reciben vales ni feriados del país del vale; la hora máxima de recibimiento de cada taller (12:00 por defecto) impide pedir «hoy» desde esa hora; con varios talleres rige la más restrictiva. El formulario consulta el nuevo `GET /api/vales/fechas-entrega` en vez de calcular con el reloj del navegador.
- **Fin de las restricciones por día:** se eliminan `exigirDiaHabil` y `exigirNoDomingo` (crear, reenviar, corregir, solicitar modificación, autorizar y aprobar modificación). Se conserva que al autorizar una fecha de entrega menor a la mínima obliga a rechazar.
- Textos fijos de «24 horas» / «6 horas» pasan a dinámicos (`horasVencimientoVale` llega en `/api/vales/catalogos`).
- Se retiran `sumarHorasHabiles`, `vencimiento24h`, la vieja `fechaMinimaEntrega`, `esSabadoHoy`, `esDomingoHoy` y `esFechaFinDeSemana`.

## Archivos

Nuevos: `src/core/calendario/{calendarioLaboral,calendarioRepository,calendarioService}.js`, `src/modules/vales/services/fechasEntregaService.js`, `scripts/recalcular-vencimientos.js`.
Modificados: `valeHelpers.js`, `valeCreacionService.js`, `valeModificacionService.js`, `valeCorreccionService.js`, `valeAdjuntosService.js`, `valePipeline.js`, `valeBuzonService.js`, `valeRendimientoService.js`, `valeBusquedaService.js`, `valeCatalogoService.js`, `valeService.js`, `valeRepository.js`, `valeTallerRepository.js`, `vigenciaWatcher.js`, `adjuntosWatcher.js`, `routes.js`, `valeController.js`; `adminService.js` y `horarioService.js` (invalidan el caché); en el cliente `datepicker.js`, `valeForm.js`, `fechas.js`, `valesApi.js`, `actions/adjuntos.js` y `css/styles.css`.

## Cómo recalcular los plazos ya guardados

`node scripts/recalcular-vencimientos.js --dry-run` muestra qué cambiaría; sin `--dry-run` lo aplica en una transacción. A cada vale con plazo (`ESPERANDO_AUTORIZACION`, `SOLICITANDO_MODIFICACION`, `RECHAZADO` con `vigencia_hasta`) y a cada taller en `ADJUNTOS_RECHAZADOS` le da N horas laborales completas **contadas desde el momento de ejecutarlo** y reinicia su aviso, así ningún vale se elimina de golpe. Ejecutarlo una sola vez al desplegar (cada ejecución vuelve a dar el plazo completo).

## Para producción

1. Importar `horarios_laborales.sql` (sin correlativo) **antes** de desplegar el código: crea `horarios_laborales`, `feriados`, `parametros_sistema` y `talleres.hora_maxima_recepcion`, que ahora el código lee siempre. Es idempotente.
2. Confirmar que no hay vales con plazo pendiente:
   `SELECT v.correlativo, ev.nombre, v.vigencia_hasta FROM vales v JOIN estados_vale ev ON ev.id = v.estado_id WHERE v.vigencia_hasta IS NOT NULL AND ev.nombre IN ('ESPERANDO_AUTORIZACION','SOLICITANDO_MODIFICACION','RECHAZADO');`
   `SELECT vt.id, vt.vale_id, vt.adjuntos_vence_en FROM vale_talleres vt JOIN estados_taller et ON et.id = vt.estado_id WHERE vt.activo = 1 AND et.nombre = 'ADJUNTOS_RECHAZADOS';`
   Si devuelven filas, ejecutar `scripts/recalcular-vencimientos.js` después de desplegar.
3. Desplegar el código y reiniciar la aplicación.

## Verificación

Simulación del calendario (60 comprobaciones: ejemplos de plazos, límites exactos al cierre/apertura, fecha mínima, país de un Diseño Local), pruebas de API (fechas, plazos, autorización, adjuntos, modificación, entradas inválidas del nuevo endpoint), vigilantes (aviso único al 25%, eliminación de vencidos) y navegador (calendario del formulario).
