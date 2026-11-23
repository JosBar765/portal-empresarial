# Reportes: cómo leer un error

Guía práctica para ubicar de dónde viene un fallo de la pestaña «Reportes» de Vales de Arte. Implementación: `src/modules/vales/utils/reporteErrores.js` (servidor), `public/modules/vales/js/api/errorReporte.js` y `views/reportes2/textos.js`, clave `errores` (pantalla).

## 1. Qué se ve en pantalla

Cada fallo muestra una tarjeta con la causa, qué hacer y, al pie, **«Referencia: R-… · Etapa: …»**. Según la causa aparecen «Reintentar» o «Restablecer filtros». Un fallo del PDF sale como aviso emergente «No se pudo descargar el PDF» con la referencia entre paréntesis.

Ejemplo:

```text
Demasiadas consultas seguidas
Espera 23 segundos y vuelve a presionar «Generar».
Referencia: R-3FA9C1 · Etapa: limite             [Reintentar]
```

## 2. La referencia y dónde buscarla

- La referencia (`R-` y seis caracteres hexadecimales) la crea el servidor por cada fallo y viaja en el JSON `{ error, codigo, referencia, etapa }` (en el 429 también `reintentarEnSegundos`).
- **Consola del servidor:** buscar `ref=R-XXXXXX`. Es una sola línea; si el fallo fue interno (`console.error`), justo después viene la línea `[Error interno]` con el stack. Los fallos de negocio (400, 403, 404, 429) salen con `console.warn` y sin stack.
- **Consola del navegador:** cada fallo registra `[Reportes] { reporte, etapa, status, codigo, referencia, mensaje }` (sin filtros).
- Ejemplo de línea del servidor (solo se registra una lista fija de filtros: período, tiendas, talleres, diseñadores, asesores, desglose y `soloUrgentes`):

```text
[Reportes] ref=R-3FA9C1 reporte=actividad-asesor etapa=generar usuario=12 estado=500 codigo=REPORTE_BD filtros=ventana=mes,tiendaId=4 mensaje=<texto del error>
```

## 3. Las etapas

| Etapa | Cuándo | Ruta (`GET /api/vales/reportes/…`) | Limitador |
|---|---|---|---|
| `opciones` | Al elegir un reporte: carga los selectores de filtro, sin recorrer vales | `actividad-{tienda\|taller\|disenador\|asesor}/opciones` | 120 por minuto por usuario |
| `generar` | Al presionar «Generar» (también «Reintentar», «Ver el mes completo» y el modal tienda a asesores) | `actividad-{tienda\|taller\|disenador\|asesor}` | 30 por minuto por usuario |
| `pdf` | «Descargar PDF» | las mismas rutas con `/pdf` | los mismos 30 de `generar` (compartidos) |
| `limite` | La registra el servidor cuando un limitador responde 429 | cualquiera de las anteriores | |
| `permiso` | El servidor rechaza la petición porque la persona no tiene el permiso del reporte (`vales.reporte_actividad_*`); se registra con referencia y línea de log como cualquier otro fallo | cualquiera de las anteriores | |

Cada petición de `generar` o `pdf` arma el reporte dos veces (período y atrasados anteriores) y cada una carga todos los vales: por eso hay un tope más bajo que el de `opciones`.

## 4. Códigos

| Código | Estado | Significado y causa típica | Qué hacer |
|---|---|---|---|
| `REPORTE_FILTRO_INVALIDO` | 400 | Un filtro mal formado o ajeno al alcance (incluido un `desgloseEstado` que no es uno de los siete estados del filtro del desglose, o un `disenadorModo` que no es `entregados` ni `tarde`); casi siempre un filtro guardado que ya no corresponde (p. ej. una tienda fuera del alcance). | «Restablecer filtros» y volver a elegir. |
| `REPORTE_SIN_ACCESO` | 403 | La persona no tiene el permiso del reporte (etapa `permiso`: el rechazo deja su línea `[Reportes] ... etapa=permiso` en el log) (o no tiene alcance, p. ej. asesores para quien solo gestiona un taller). | Pedir el permiso en «Roles y Permisos». |
| `REPORTE_NO_ENCONTRADO` | 404 | El servidor no reconoce el reporte. | Elegir otro. |
| `REPORTE_LIMITE` | 429 | Demasiadas consultas: 30 por minuto en `generar` y `pdf`, 120 en `opciones`. | Esperar los segundos que indica la tarjeta. |
| `REPORTE_BD` | 500 | Error de MySQL o de conexión (códigos `ER_`, `ECONN`, `PROTOCOL_`, `ETIMEDOUT`). | Ver §5. |
| `REPORTE_PDF` | 500 | Fallo interno al armar el PDF. | Ver §5. |
| `REPORTE_INTERNO` | 500 | Otro fallo interno (un error de código, no de datos de entrada). | Buscar la referencia y leer el stack. |
| `REPORTE_NEGOCIO` | otro | Error de negocio con un estado que no es 400, 403, 404 ni 429. | Leer `mensaje` en la línea del log. |
| `REPORTE_RED` | 0 | El navegador no llegó al servidor. No hay referencia ni línea de log. | Revisar la conexión y reintentar. |
| `REPORTE_RESPUESTA` | 2xx | La respuesta llegó pero no se pudo leer como JSON. | Reintentar; si persiste, revisar la pestaña de red del navegador. |
| `REPORTE_CLIENTE` | 0 | Falló la propia pantalla al armar el reporte, no la petición. | Avisar a soporte con el mensaje de la consola del navegador. |

Si el servidor responde sin código (p. ej. un proxy con 502), el cliente lo deduce del estado HTTP: 400, 403, 404 y 429 como arriba y cualquier 5xx como `REPORTE_INTERNO`; en ese caso no hay referencia ni línea del reporte en el log de la aplicación.

## 5. Listas de revisión

**Si es `REPORTE_BD`:**

1. Buscar la referencia en el log y leer `mensaje` (el stack sigue a la línea).
2. `ECONN`, `PROTOCOL_` o `ETIMEDOUT`: conexión caída o tiempo agotado; revisar que la base responde.
3. `ER_…`: consulta o esquema (tabla o columna ausente); comprobar que las migraciones se aplicaron (`npm run migrate:estado`).
4. Repetir con un período corto: si funciona, el problema es el volumen de vales.

**Si es `REPORTE_PDF`:**

1. Buscar la referencia y leer el stack: el armado del PDF está en `valeReportePdfService.js`.
2. Generar el mismo reporte en pantalla: si también falla, el origen son los datos, no el PDF.
3. Repetir sin el desglose (modal «No, sin desglose») para aislar la sección que falla.

## 6. Estado

No se probó en el navegador con fallos reales: la referencia, los códigos y la línea de log se verificaron con un script con datos de prueba y con `node --check`.
