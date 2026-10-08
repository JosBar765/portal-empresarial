# Correcciones 45 — Encargados y diseñadores sin Fecha Ingreso en la tabla

Rama: `feature/responsive-movil`. Solo diseño: no se tocó la base de datos, la API ni los datos del vale.

- La tabla del Buzón de los **roles de taller** (encargados, asistente y diseñadores) ya no muestra **Fecha Ingreso** (fecha de creación); conserva Correlativo, Fecha Entrega, Atraso, Fecha Evento, Estado y Acciones. La **Fecha Evento** se había quitado también y se restituyó porque sí hace falta.
- Asesor, Supervisor y Administrador ven la tabla completa, como antes.
- Se reutiliza el patrón de «Taller» (`oculta-taller`): `app.js` marca la tabla con `oculta-fechas` según el rol y `styles.css` oculta la columna `.col-fecha-ingreso` (también en las tarjetas del celular).
- La fecha de ingreso sigue en el detalle del vale y en el PDF; no se cambió el orden por columna ni el servidor.

Archivos: `public/modules/vales/index.html`, `js/app.js`, `js/views/buzon.js`, `css/styles.css`.
