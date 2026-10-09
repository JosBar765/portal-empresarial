# Correcciones 46 — Badge de la persona bajo el correlativo

Rama: `feature/responsive-movil`. No se tocó la base de datos.

- **Supervisor:** bajo el correlativo del Buzón aparece el **asesor que creó el vale**.
- **Encargado de taller:** aparece el **diseñador asignado** a su taller; si aún no hay, «Sin asignar». En las filas de fusión (F) no se muestra.
- Asesor, Diseñador, Administrador y Gerente no ven el badge.
- El servidor (`valeBuzonService.js`) agrega el campo `persona` a cada fila de la página (nombres con una sola consulta, `reporteRepository.listarNombres`); `badgePersona()` (`utils/formato.js`) lo pinta y los estilos `.persona-badge*` están en `styles.css`. En celular la tarjeta lo muestra junto al correlativo.
- **Filtro por tienda del Supervisor:** ya existía en el Buzón; no se cambió.

Archivos: `src/modules/vales/services/valeBuzonService.js`, `public/modules/vales/js/views/buzon.js`, `js/utils/formato.js`, `css/styles.css`.
