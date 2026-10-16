CAMBIOS 16/10/2026

Rama limpia desde `dev` (`feature/modificaciones-por-tipo`), con commits de descripción simple y entendible para el programador.

1. **Botón único en el paso 5 (confirmación) del Buzón.** Hoy aparecen dos botones: el del ojo (ver vale y propuesta) y el de confirmar / solicitar modificación. Se unifican en un solo botón con el ícono del de confirmar o solicitar modificación. Su modal es el mismo del ojo (vale y propuesta) y abajo a la derecha tiene los botones «Confirmar recibido» y «Solicitar modificación». Los botones cambian únicamente en este paso del pipeline.

2. **Tres tipos de modificación**, según la complejidad del cambio:

    - **Básica:** no crea otro vale `MOD`. Es un cambio muy pequeño: el asesor y el taller conversan por un chat de esa modificación, donde el taller acepta o rechaza la modificación. Si acepta, rehace la propuesta y la vuelve a adjuntar para confirmar. No se valida el cupo. Suma **1 día** a la fecha de entrega contado desde el día en que se pide la modificación, y es exactamente 1 (no se puede poner más).
    - **Media:** crea un vale `MOD` que autoriza el supervisor. Suma **2 días** a la fecha de entrega.
    - **Avanzada:** crea un vale `MOD` que autoriza el supervisor. Suma **3 días** a la fecha de entrega.

    Los días de Media y Avanzada son **mínimos**: se pueden poner más. En un vale `MOD` desaparece la característica «urgente» y no se puede marcar.

3. **MOD acumulables.** La primera modificación (media o avanzada) lleva el prefijo `MOD`, la segunda `MOD2` y así sucesivamente.

4. **Selector del tipo.** Al presionar «Solicitar modificación» el usuario elige entre las tres modificaciones con una buena UI/UX, y tiene un apartado de «información» que explica rápido qué es cada una.

5. **Flujo por tipo.** Básica: conversación asesor ↔ taller (aceptar/rechazar), nueva propuesta y nueva confirmación, hasta llegar a un acuerdo. Media y Avanzada: el mismo flujo que ya tiene un vale `MOD` (nueva fecha de entrega, autoriza el supervisor, MOD sobre MOD con el conteo anterior).

## Decisiones acordadas

- Durante la conversación de una Básica el vale **sigue en el paso 5** (`PENDIENTE_CONFIRMACION`). Solo si el taller acepta, la fila del taller vuelve a `ASIGNADO` (mismo diseñador); al entregar y aprobar la nueva propuesta, el vale regresa al paso 5. Si el taller rechaza, no cambia nada.
- Después de una Básica rechazada el asesor vuelve al paso 5 con todas las opciones y sin límite de intentos.
- Vale con varios talleres: el asesor elige a qué taller(es) pide la Básica; hay una conversación por taller elegido y los demás quedan aprobados sin cambios.
- Código: `MOD-X`, `MOD2-X`, `MOD3-X`, con X el correlativo raíz (no cambia). La siguiente modificación se pide sobre el último MOD vigente.
- Los días mínimos son **días hábiles** según el calendario, contados desde el día de la solicitud, y en un MOD reemplazan la regla de «3 días sin urgente».
- Con el vale `RECIBIDO` el botón «Solicitar modificación» se mantiene y abre el mismo selector, pero solo ofrece Media y Avanzada.
- Los mensajes del chat de la Básica son de 200 caracteres y la conversación no tiene plazo automático: termina cuando el taller acepta o rechaza, o cuando el asesor la cancela.
