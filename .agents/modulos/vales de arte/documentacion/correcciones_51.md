# Correcciones 51 — Ajustes del rechazo con mensaje tras la prueba multitaller

Rama: `fix/rechazo-hallazgos` (desde `dev`).

## Qué cambia

- **Texto del aviso de rechazo.** Ya no dice «rechazado por falta de adjuntos». Ahora: «<encargado> (<taller>): Rechazado (ver mensaje)». El motivo está en la conversación.
- **El supervisor no recibe campana ni cartel de los mensajes de la conversación**, porque no puede leerla (antes recibía un aviso por cada mensaje del taller y al abrirla veía «No tienes acceso»). Sigue recibiendo el rechazo, la verificación y el aviso de 6 h.
- **Refresco inmediato tras «Ya lo atendí».** El supervisor (y las otras pestañas del asesor) refrescan su pantalla en silencio con el evento `vale_refrescar`; antes la fila quedaba en «Faltan adjuntos» hasta recargar.
- **El supervisor ya no ve «Ver conversación»** en el modal de un vale rechazado que no es suyo (antes el botón respondía «No tienes acceso»). El asesor dueño conserva «Leer y responder» y «Ya lo atendí»; un supervisor en su propio vale también.
- **Se quita el tope de 30 mensajes** de la conversación (código, contador «N/30» de la pantalla y mensajes de «máximo alcanzado»). No hace falta ningún cambio en `mensajes_rechazo.sql`: el plazo de 24 h sigue limitando la conversación.
- **Se quitan dos avisos de pantalla:** el contador «Quedan N h» (en el modal del asesor, en la cabecera de la conversación y en el detalle de la fila del encargado, donde ahora dice «Asesor») y la etiqueta «Esperando respuesta del asesor» de la cabecera de la conversación. El modal del asesor conserva la fecha en que se elimina el vale.
- **Documentación:** `correcciones_49.md` (mensaje obligatorio, supervisor sin acceso) y `flujo_vale_de_arte.md` (historial solo con `vales.ver_historial`).
- **Límite conocido (sin cambio de código):** un `mensaje` que no sea texto, enviado a mano a la API, se guarda convertido a cadena. Ver `flujo_vale_de_arte.md` §2.1.

## Archivos

`src/modules/vales/services/valeAdjuntosService.js`; `public/modules/vales/js/actions/adjuntos.js`, `public/modules/vales/js/components/pipeline.js`; `flujo_vale_de_arte.md`; `correcciones_49.md`.
