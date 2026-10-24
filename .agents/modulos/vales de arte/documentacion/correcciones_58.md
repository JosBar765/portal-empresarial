# Correcciones 58 — Administrador y Gerente: solo tres acciones de lectura por fila

Rama: `fix/acciones-admin-gerente` (desde `dev`). Sin cambio visual nuevo: no lleva mockup.

## Problema

Al Administrador le aparecían en el Buzón unas doce acciones de escritura (Ver y decidir, Autorizar, Asignar, Revisar, Comenzar, Entregar, Aprobar y fusionar, etc.) que el servidor rechazaba. El Gerente no veía la propuesta ni el historial ni las propuestas de otros talleres.

## Qué cambia

- **Acciones de fila (Buzón y «Trabajo realizado»):** el Administrador y el Gerente tienen solo tres, todas de lectura: «Ver vale de arte (PDF)» con la propuesta del vale (la fusión final si la hay), «Propuestas de otros talleres» y «Ver historial».
- **Propuesta en «Ver»:** el Gerente también ve la propuesta general (antes solo el Administrador).
- **Permiso:** el Gerente recibe `vales.ver_historial` (migración `gerente_ver_historial`, aditiva e idempotente). Los Gerentes con sesión abierta deben cerrar sesión y volver a entrar, porque el permiso viaja en el token.
- **Propuestas de otros talleres:** para ellos devuelve las propuestas ya aprobadas de todos los talleres activos del vale, sin exigir `talleres.comparte_propuestas`, y solo en vales con 2 o más talleres activos. Es solo lectura: sin «visto», sin signo «?» y `POST .../visto` responde 403 sin escribir.
- **Historial del Gerente:** ve creación, corrección, rechazo y reenvío de la creación, autorización de la creación, asignación, aprobación de cada taller, retorno al asesor, confirmación de recibido, solicitud y aprobación de modificación y adjuntos, más los chats del rechazo (adjuntos y propuesta) en solo lectura.

## Casos borde

- Vale de un solo taller: sin «Propuestas de otros talleres».
- Taller aún sin propuesta aprobada: el detalle lo trae como «En trabajo»; el visor muestra solo las aprobadas.
- Encargado, Asistente y Diseñador: sin cambios (misma regla de compartir y mismo «visto»).
- `puede()` no cambia: se restringe `construirAcciones` por rol.

## Archivos

- `database/migrations/14_gerente_ver_historial.sql`: permiso del Gerente.
- `src/modules/vales/repositories/propuestaCompartidaRepository.js`: `listarFilasActivas`, `listarValesConVariosTalleres`.
- `src/modules/vales/services/propuestasCompartidasService.js`: lectura global para Administrador y Gerente.
- `public/modules/vales/js/views/buzon.js`: `construirAccionesDeLectura` y propuesta general visible para ambos.
- `public/modules/vales/js/actions/propuestasOtros.js`: sin «visto» para ambos.
