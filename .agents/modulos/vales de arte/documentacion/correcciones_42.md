# Correcciones 42 — Pestaña «Reportes» (actividad por rol y exportación a PDF)

Rama: `feature/reportes-vales` (sobre los cambios aún sin commit de las correcciones 40 y 41, que tocan los mismos archivos).

## Qué es

Una pestaña nueva, «Reportes», en la barra lateral de Vales de Arte. Mide la **actividad de las personas** (cuántos vales trabajó cada quien y cuánto tardó) a partir de `vale_historial`, y se puede **exportar a PDF** con los filtros activos. «Rendimiento» (Supervisor y Gerente) no cambia.

## Quién la ve y qué ve

Se muestra con el permiso nuevo `vales.ver_reportes` (Administrador, Asesor, Supervisor, Encargados de taller y Diseñador; el Gerente no). Quien tiene gente a su cargo ve a su equipo; Asesor y Diseñador solo lo suyo (el servidor ignora cualquier `personaId` ajeno).

| Rol | Alcance | Indicadores |
|---|---|---|
| Diseñador | solo lo suyo | comenzados, entregados, aprobados, devueltos a corregir, tiempo de producción, entregas a tiempo, y ahora mismo: asignados, en proceso y atrasados |
| Asesor | solo lo suyo | creados, autorizados, rechazados, confirmados, modificaciones, tiempo hasta autorización, ciclo completo, recibidos a tiempo, abiertos y atrasados ahora |
| Encargado de taller | su taller (él y cada diseñador) | asignaciones, propuestas recibidas, aprobados, devueltos, tiempo de revisión y de producción, fusiones (con `vales.aprobar_general`), por revisar y en cola ahora; tabla por diseñador |
| Supervisor | sus asesores (y los que él crea) | como el Asesor para el equipo + autorizados/rechazados por él y cupo de hoy; tabla por asesor |
| Administrador | todo, con filtros de tienda y taller | KPIs globales; tablas por asesor, diseñador, taller y tienda |

Cada reporte trae: tarjetas con variación contra el período anterior, una gráfica (por hora si es un solo día, por día o por mes), la tabla por persona (con clic para enfocar a una persona) y el listado de vales del período con sus hitos (primeros 100 en pantalla; el PDF llega a 500).

## Decisiones

- **Período = fecha de la acción** (no la fecha de entrega del Buzón). Abre en «Hoy» (reporte diario) si la barra estaba en «Todo»; usa la misma barra de período (`utils/ventana.js`) y el filtro de tienda (ahora también para el Administrador).
- **Acciones** (por cambio de estado del historial): crear, solicitar modificación, autorizar, rechazar, confirmar, asignar, comenzar, entregar (cancelar un proceso no cuenta), aprobar, devolver y fusionar. Una devolución cuenta para quien entregó el trabajo devuelto, aunque se reasigne. Los tiempos salen de emparejar acciones consecutivas del mismo vale y taller; la hora de MySQL ya está fijada a UTC-6 (`config/database.js`).
- **PDF:** `pdf-lib`, horizontal, estilo del vale (encabezado con rol y período, indicadores, tablas por persona y listado con salto de página). Sin dependencias nuevas. Endpoint `GET /api/vales/reportes/pdf` con los mismos filtros.
- **Administrador:** gana barra lateral (Buzón y Reportes).

## Archivos

- Backend: `repositories/reporteRepository.js`, `services/valeReporteService.js`, `services/valeReportePdfService.js` (nuevos); `services/valeService.js`, `controllers/valeController.js`, `routes.js` (`GET /reportes` y `GET /reportes/pdf`, 30 por minuto por usuario).
- Frontend: `views/reportes.js` y `css/reportes.css` (nuevos); `index.html`, `layout/sidebar.js`, `layout/toolbar.js`, `config/roles.js`, `api/valesApi.js`, `views/buzon.js`, `state.js`.
- Base de datos: `database/seed.sql` (permiso 26 `vales.ver_reportes` y su asignación a los roles 1, 2, 3, 4, 5, 6, 7, 9 y 10) y `database/schema.sql` (índice `idx_historial_creado`).

## Migración para bases ya desplegadas (la ejecuta el usuario)

```sql
SET NAMES utf8mb4;
INSERT IGNORE INTO permisos (id, codigo, nombre, modulo, descripcion) VALUES
(26, 'vales.ver_reportes', 'Ver Reportes de Actividad', 'vales', 'Permite ver la pestaña Reportes (actividad propia o de su equipo según el rol) y exportarla a PDF');
INSERT IGNORE INTO rol_permisos (rol_id, permiso_id) VALUES (1, 26), (2, 26), (3, 26), (4, 26), (5, 26), (6, 26), (7, 26), (9, 26), (10, 26);
ALTER TABLE vale_historial ADD INDEX idx_historial_creado (creado_en);
```

Quien ya tenga sesión abierta debe volver a iniciar sesión para recibir el permiso nuevo en su token.

## Verificación

Con actividad real generada por la API (6 vales creados, autorizados, rechazados, asignados, comenzados, entregados, devueltos y reasignados, aprobados, confirmados y una modificación): por rol, los indicadores coinciden con lo ejecutado (por ejemplo, el Diseñador 1: 2 comenzados, 2 entregados, 1 aprobado, 1 devuelto; el Encargado: 4 asignaciones, 3 recibidas, 2 aprobados, 1 devuelto). Comprobados el alcance (el Asesor no ve a otros, el Supervisor rechaza personas ajenas, el Gerente recibe 403), los filtros de tienda y taller del Administrador, el PDF (visto en el navegador) y la pestaña en pantalla como Supervisor, Administrador y Diseñador. No se pudo revisar la vista móvil; Asesor y Encargado se comprobaron por API.
