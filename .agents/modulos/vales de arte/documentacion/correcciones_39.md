# Correcciones 39 — Ajustes del módulo Vales de Arte (07/10/2026)

Rama: `feature/ajustes-vales-0710` (desde `dev`). No cambian la lógica ni el diseño general: reutilizan reglas que ya existían.

## Estado

| # | Punto | Estado |
|---|---|---|
| 1 | Urgente solo automático | **hecho** |
| 2 | Fecha y hora en la firma de autorización | **hecho** |
| 3 | Límites diarios: Diseño y UV/3D = 15, Protextil = 8 | **hecho** (datos) |
| 4 | Archivos de hasta 5 MB | **hecho** |

## 1. Urgente

- La regla ya existía en el servidor: `calcularUrgente` marca urgente si faltan menos de 3 días (entrega hoy, mañana o pasado mañana, contando hasta el fin del día de entrega, hora de Guatemala). Aplica al crear, corregir y solicitar la modificación (los tres pasan por `validarDatosVale`).
- Antes, con 3 o más días de margen, el asesor podía marcarlo a mano. Ahora el servidor ignora cualquier valor del formulario (`calcularUrgente(fechaEntregaNorm)`) y se eliminó `esVerdadero`.
- Formulario: sin casilla; bajo las fechas aparece el aviso «Urgente: entrega en menos de 3 días» solo cuando la fecha cumple la regla (`.aviso-urgente`, `aria-live="polite"`). El resumen de confirmación sigue mostrando «Urgente: Sí/No» con la misma cuenta.
- Sin cambios: el badge URGENTE de las tablas, la fila «Urgente» del detalle del supervisor y el orden por urgencia. El indicador se guarda al crear/corregir/modificar y no se recalcula con el paso de los días.

## 2. Firma de autorización

- La caja roja del PDF muestra tres líneas: supervisor, CREACIÓN/MODIFICACIÓN y `dd/mm/aaaa hh:mm` (de `vales.autorizado_en`, hora de Guatemala). La fila de cotización y firma pasa de 17 a 30 pt de alto para que se lea bien; sin autorización la caja sigue vacía para firmarse a mano.
- `generarBufferPdf` entrega `{ nombre, tipo, fechaHora }` y `_dibujarFilaCotizacionYFirma` (`valePdfService.js`) la dibuja.
- Los PDF ya generados no cambian solos: se actualizan en los eventos que ya regeneran el PDF (autorizar, aprobar modificación, fusionar).

## 3. Límites diarios por taller

- Cambio de datos: `talleres.limite_diario` ya existía y el administrador lo edita en «Gestionar Talleres» (mínimo 3). `database/users.sql` ahora crea Diseño = 15, Diseño UV/3D = 15 y Protextil = 8; los talleres Diseño Local quedan sin límite.
- Base ya desplegada (ejecutarlo en cada ambiente):

```sql
SET NAMES utf8mb4;
UPDATE talleres SET limite_diario = 15 WHERE nombre IN ('Diseño', 'Diseño UV/3D');
UPDATE talleres SET limite_diario = 8 WHERE nombre = 'Protextil';
```

- Decisión: UV/3D pasa a 15 (se asumió por ser departamento de diseño).

## 4. Archivos de 5 MB

- Un solo tope de 5 MB por archivo para imágenes, PDF del vale, propuesta del diseñador y documento de fusión: `routes.js` (multer), `valeController.js` (`ARCHIVO_MAX_BYTES` y mensajes), `app.js` (mensaje de `LIMIT_FILE_SIZE`) y el frontend (`ARCHIVO_MAX_BYTES` en `components/dropzone.js`, usado por el formulario del vale, la propuesta y la fusión, con el texto «máx. 5MB»).
- Sin cambios: tipos permitidos, firmas reales de archivo, 10 imágenes + 5 PDF y el tope de 40 megapíxeles.
- A vigilar al desplegar: la memoria (multer usa `memoryStorage`; el peor caso por petición sube de ~35 MB a ~75 MB) y un posible límite de subida del hosting o proxy; conviene probar una subida de ~5 MB en el entorno real.
