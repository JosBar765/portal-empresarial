# rechazo-hallazgos

Rama `fix/rechazo-hallazgos`. Objetivo: cerrar los hallazgos R1, R4, R5 y R9 del rechazo con mensaje (ver `correcciones_51.md`).

## Decisiones del usuario
- R1: la conversación de un taller solo la ven el encargado de ese taller y sus asistentes vinculados.
- R5: caracteres que el PDF no soporta dan 400 claro, no 500.
- R4: campos cortos con tope que siempre cabe en el PDF; descripción hasta 600 caracteres y autoajustada.
- R9: cartel no repetido con la conversación abierta, modal del asesor en vivo, 403 unificado, mensaje claro sin tallerId.

## Tareas
- [x] T1 R1 + R9 (acceso por taller, modal en vivo, sin cartel repetido, 403, mensaje sin tallerId)
- [x] T2 R5 caracteres no soportados (validarTextos; 400 claro; admin incluido)
- [x] T3 R4 límites de campos (100/30/40) y autoajuste de la descripción (600). PDFs vistos en el navegador: 600 «A», URL de 600, párrafos y campos al máximo con «W»/«M», todo dentro de la hoja y de su celda

## Ruta
Un solo escritor, inline (el parent delegó); sin suite de tests: scripts contra dev en el scratchpad.

## Evidencia
- T1: script `t1.js`/`t1b.js` contra dev, 25/25 OK (403 cruzado en GET/POST/verificar/rechazar; encargado y asistente propios sí).
