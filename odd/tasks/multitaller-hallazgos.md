# multitaller-hallazgos

Rama: `fix/multitaller-hallazgos` (desde `dev`) · Estrategia de entrega: `ask-on-risk` · Estado: T1–T3 hechas; H2 y B6 esperan decisión.

## Origen
Prueba completa del flujo multitaller en `dev` (87ae23a); hallazgos en la conversación. Decisiones del usuario:
- **H1:** el cupo se consume al autorizar; si ya no hay cupo el supervisor rechaza. Solo se corrige la documentación.
- **H3:** los permisos de la BD de desarrollo estaban desfasados por un merge. Protextil trabaja vales pero **no fusiona**.
- **H4:** corregir la frase de la documentación (§7, `EN_PAUSA`).
- **B1:** el aviso al aprobar el último taller debe decir que el vale quedó listo para fusionar.
- **B2:** el gerente no se toca.
- **B3:** el aviso de 6 h de adjuntos va al asesor, al supervisor y al encargado de taller.
- **B4:** corregir la respuesta de adjuntos (mensaje vacío y error «Taller inválido»).
- **B5, B6, H2:** esperan explicación y decisión.

## Tareas
- [x] T1 · Permisos y documentación: `seed.sql` (admin pierde `verificar_adjuntos` y gana `ver_historial`; asesor, supervisor y diseñador pierden `verificar_adjuntos`; Protextil gana `trabajar`), `flujo_vale_de_arte.md` (§3 Protextil y Administrador, cupo, §7 pausa) y BD de desarrollo alineada (Protextil sin `aprobar_general`; permiso `vales.ver_reportes` creado y dado al Administrador, que además recupera `vales.ver`). Ruta: inline.
- [x] T2 · B1: texto de «listo para fusionar» en la aprobación del último taller. Ruta: delegada (escritor único). Evidencia: vale de 2 talleres, el 1.º aprobado da «fue aprobado (taller)»; el último da «… todos los talleres terminaron, el vale está listo para fusionar» (1 fila por persona: 5, 11, 13, 49); vale de 1 taller sin cambios (PENDIENTE_CONFIRMACION); eslint sin errores.
- [x] T3 · B3 y B4: aviso de 6 h a supervisor y talleres; validación de la respuesta de adjuntos. Ruta: delegada. Evidencia: aviso a asesor 49, supervisor 13, encargados 5 y 6 y asistente 11, no a diseñador 97, sin repetirse; responder-adjuntos con espacios -> 400 «Escribe un mensaje para el taller.», sin/!válido tallerId -> 400 «Indica a qué taller respondes.», >200 palabras sigue 400, válido -> 200; botón Enviar deshabilitado con mensaje vacío; eslint sin errores.

## Verificación y evidencia
T1: diff de permisos por nombre entre `seed.sql` y la BD de desarrollo: sin diferencias salvo `admin.vales.generar` (viene de `admin_generar_vale.sql`).

## Siguiente paso
Decidir H2, B5 y B6.
