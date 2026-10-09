# Correcciones 51 — Ajustes del rechazo con mensaje tras la prueba multitaller

Rama: `fix/rechazo-hallazgos` (desde `dev`).

## Qué cambia

- **Texto del aviso de rechazo.** Ya no dice «rechazado por falta de adjuntos». Ahora: «<encargado> (<taller>): Rechazado (ver mensaje)». El motivo está en la conversación.
- **El supervisor no recibe campana ni cartel de los mensajes de la conversación**, porque no puede leerla (antes recibía un aviso por cada mensaje del taller y al abrirla veía «No tienes acceso»). Sigue recibiendo el rechazo, la verificación y el aviso de 6 h.
- **Refresco inmediato tras «Ya lo atendí».** El supervisor (y las otras pestañas del asesor) refrescan su pantalla en silencio con el evento `vale_refrescar`; antes la fila quedaba en «Faltan adjuntos» hasta recargar.
- **El supervisor ya no ve «Ver conversación»** en el modal de un vale rechazado que no es suyo (antes el botón respondía «No tienes acceso»). El asesor dueño conserva «Leer y responder» y «Ya lo atendí»; un supervisor en su propio vale también.
- **Documentación:** `correcciones_49.md` (mensaje obligatorio, supervisor sin acceso) y `flujo_vale_de_arte.md` (historial solo con `vales.ver_historial`).
- **Límite conocido (sin cambio de código):** un `mensaje` que no sea texto, enviado a mano a la API, se guarda convertido a cadena. Ver `flujo_vale_de_arte.md` §2.1.

## Archivos

`src/modules/vales/services/valeAdjuntosService.js`; `flujo_vale_de_arte.md`; `correcciones_49.md`.
