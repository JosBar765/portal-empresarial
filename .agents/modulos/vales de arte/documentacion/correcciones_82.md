# Correcciones 82: desglose del reporte de diseñadores con badges y una fila por vale

> **Actualización 2026-11-23 (`correcciones_83.md`):** el conteo **por parte** de cada diseñador y el **detalle desplegable** por diseñador de este documento quedaron **sin efecto** (ver `correcciones_83.md`); siguen vigentes los badges, el desglose de una fila por vale y la igualdad pantalla = PDF.

Fecha: 2026-11-23. Rama `feat/vales-reportes-2`. Pedido del dueño: aplicar al reporte de diseñadores la misma lógica que a talleres: sin círculo de iniciales, sin el rol (Encargado/Asistente), diseñadores en badges y, si un vale es compartido, una sola fila con un badge por diseñador que se despliega para ver el estado individual de cada uno.

## Regla (dueño)

- Un vale compartido cae en la sección del **vale completo**, como en talleres: si un diseñador terminó y el otro no, es un vale **atrasado** (o **por vencer** si aún no vence). Así el desglose cuadra con los contadores de arriba.
- El estado de la **parte** de cada diseñador (su decisión anterior, la opción 1) sigue en la gráfica, en E y T, y en el detalle desplegable de la fila.

## Cambio

- Desglose general: una fila por vale, en la sección del vale completo, con un badge (clase `.taller-tag`, la del buzón) por cada diseñador del vale, sin avatar ni rol. Los vales con dos o más diseñadores traen un botón (flecha) que despliega «Henry Juárez — Entregó a tiempo · Pamela Morales — Atrasado · 19 d». Funciona también en modo tarjetas.
- Textos del estado de cada parte: Entregó a tiempo · Entregó con N d de atraso · Atrasado · N d · Por vencer (· vence hoy).
- Con un diseñador enfocado (barra de la gráfica) las filas siguen **la parte de ese diseñador** (las cifras de su barra) y siguen mostrando a todos los diseñadores del vale; la copia por parte viaja en `grupos.porParte`, usada igual por la pantalla (`enfoque.js`) y por el servidor/PDF (`soloGrupoDesglose`).
- Los nombres de los diseñadores salen sin el rol en todo el reporte (gráfica, desglose, título del PDF). El selector de diseñadores conserva el rol, porque ahí distingue cuentas.
- PDF: la tabla de cada grupo se mantiene; bajo ella, una línea por vale compartido con el estado de cada diseñador (el papel no se despliega).

## Dónde

- Servidor: `valeReporteGruposService.js` (`detalleDe`, filas por vale, secciones unidas, copia por parte), `valeReporteDisenadores.js` (`agruparPorDisenadores`, `textoDeParte`), `valeReporteEquiposService.js`, `valeReporteFiltroDesglose.js`, `valeReportePdfService.js` (`_partesPdf`).
- Frontend: `views/reportes2/desglose.js` (badges, fila de detalle), `textos.js` (`TEXTOS_DESGLOSE`), `enfoque.js`, `actividadEquipos.js` (`sinAvatar`), `css/reportes2.css`.
- Pruebas: `scripts/reportes/probarDesgloseDisenadores.mjs` (agrupar, texto de la parte igual en pantalla y PDF, enfoque) y el bloque (i) de `probarPdfDisenadores.mjs`.

## Notas

- Las cifras del desglose y de los contadores de arriba cuentan vales únicos con el estado del vale completo; la gráfica sigue contando por parte (un vale compartido aparece en la barra de cada diseñador).
- Verificado en el navegador con la tabla real y datos de ejemplo (badges, despliegue, tarjetas). **No probado:** el conteo real dentro de `armar` ni el PDF completo (necesitan BD y un usuario con permiso de reportes).

## Verificación: pantalla = PDF, y el estado del vale no depende del filtro

- **Regla en diseñadores:** el estado del vale (el de los contadores y las secciones del desglose) sale siempre de todas sus filas, con o sin filtro de talleres y para cualquier usuario; los estados individuales (su parte) siguen en la gráfica, E y T y el detalle desplegable.
- **Pantalla = PDF:** el detalle de Efectividad del PDF era más corto que el de la pantalla (sin «(N atrasados)») y no cuidaba singulares; ahora los textos de las tarjetas salen de funciones compartidas (`detalleUrgentes`, `detalleEfectividad`, `detalleATiempo` en `valeReporteContadores.js`), las notas de la gráfica (`NOTA_TALLERES`, `NOTA_DISENADORES`) son las mismas del ícono, el orden de la gráfica es el mismo (Sin asignar primero; luego más asignados y por nombre) y la tarjeta de Efectividad del PDF es más ancha. Lo fija `scripts/reportes/probarTextosPantallaPdf.mjs`.
- **Contra la base local (solo lectura):** `node scripts/reportes/verificarReportesContraBD.mjs` genera los cuatro reportes de varios meses como Administrador, con y sin filtro de taller, y comprueba identidades, que el desglose cuadre con los contadores, que el filtro no cambie estados, y que el PDF diga lo mismo que la pantalla. Se aborta si no es desarrollo con base local. **Pendiente de correrlo** (no se pudo desde la sesión).
- **Diferencia conocida:** la gráfica de tiendas y asesores imprime las 10 primeras y una fila «Otras (N)», mientras la pantalla permite ver las demás con «Ver las N restantes».
