# PDF «Solicitud de viáticos»: ajustes de legibilidad

Rama: `module/viaticos`. Estado: HECHO y aprobado por el dueño (2026-11-16). Estrategia de entrega: `ask-on-risk`.

## Historia
- Primer intento: rediseño completo (franja de resumen, bloques con acento, desglose de costos). El dueño lo probó y NO le gustó: se revirtió a la versión del último commit.
- Segundo intento (el que quedó): ajustes puntuales sobre el PDF original, a partir de los trazos del dueño sobre un PDF real, uno por uno, revisando cada muestra en Chrome.

## Decisiones finales (el PDF conserva su estilo de recibo en blanco y negro)
- Márgenes: el superior se mide hasta el tope del logo y es igual al izquierdo (40 pt).
- Encabezado: título con subtítulo y correlativo centrados en vertical con el logo.
- Barra negra «DESGLOSE» tras la información del viaje, en AMBAS modalidades (en el viaje de 1 día precede a la inspección).
- Títulos de sección solo con el nombre; toda sección con suma (ruta, combustible, depreciación, hospedaje, comidas, otros gastos) cierra con una fila «TOTAL» alineada a la derecha, con regla fina encima.
- Combustible y depreciación: la fórmula va como línea de detalle (sin el monto) y el monto en su fila «TOTAL».
- Comidas es una tabla: Cantidad, Comida (plural), Presupuesto, Total.
- Viaje de 1 día: orden Lectura del odómetro, Nivel de fluidos, Kit de emergencia, Defectos encontrados; los defectos llevan columna «N.º». Fluidos y kit llevan línea punteada guía entre el nombre y el valor (la opción de filas con fondo alterno se probó y se descartó).
- Separación uniforme entre secciones: una sola constante de 12 pt (la del odómetro).
- Firmas ancladas al pie (línea en y=60) en todas las hojas, con el nombre sobre la línea (quien autorizó sobre la línea de Administración).
- Correlativo sin ceros a la izquierda: `VIA-<país>-<número>` (p. ej. `VIA-GT-26`); las solicitudes ya creadas conservan su correlativo viejo.

## Tareas
- [x] T1. Ajustes en `solicitudPdfService.js` y `pdfHelpers.js` (+ claves `pdf.*` de `mensajes.js`).
- [x] T2. Muestras generadas a mano y revisadas en Chrome en cada ronda.
- [x] T3. Documentación (README y contrato: sección PDF).
- [x] T4. Correlativo sin ceros (`constantes.js`, `solicitudGuardadoService.js`, docs).
- [x] T5. Solicitudes reales de ambas modalidades creadas con la cuenta de prueba y su PDF revisado (VIA-GT-31 y VIA-GT-32 con el diseño final).

## Pendiente
- Pasar la etapa del documento (CREACION/CORRECCION/AUTORIZACION) desde `documentoService.regenerarPdf`; hoy el generador la deduce del historial y «Corregida» solo se detecta con más de un envío.
- Las tablas no repiten su cabecera al seguir en otra hoja (ya era así).
- Las secciones vacías del viaje largo muestran «Sin registros» (ya era así).

## Pruebas
Sin runner automatizado; RED/GREEN no aplica. Verificación: muestras generadas con datos de ejemplo, comprobaciones numéricas (márgenes, centros, firmas en y=60, bordes derechos) y revisión visual en Chrome.
