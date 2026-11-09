# Cierre, informe y gerencia (fase 6)

Cerrar un proyecto congela su informe, libera las tiendas y las empresas y lo deja de solo lectura; el gerente da o devuelve el visto bueno; el panel gerencial resume el año. Aquí se describe el **servidor del cierre y del informe** (rama 6a).

## Una sola función de informe

`informeService.calcular(proyectoId)` es la **única** que cuenta; la pantalla, el PDF y las exportaciones solo la llaman, así nunca dicen cosas distintas. Reutiliza las cifras, el desglose por asesor y por tienda del seguimiento (`seguimientoRepository`), así que el seguimiento y el informe cuentan igual.

- **Acumulativo:** una venta sin cotización previa cuenta también como cotizada; «interesadas» son las que están en interesada, cotizada o vendida; «gestionadas», todas menos las pendientes; «contactadas», las que tienen una gestión cuyo resultado logró contacto.
- **No cuenta:** lo anulado, las ventas «por confirmar» o rechazadas, las reservas sin asesor.
- **Monedas:** un total por moneda (cotizado y vendido), nunca mezcladas ni convertidas.
- **Contenido:** cifras con porcentajes, efectividad con semáforo (umbrales de la foto de configuración del proyecto), perdidas por motivo, presencial frente a remoto (por canal), muestras por área y existencia restante, desglose por asesor (con tiempo de reacción) y por tienda (con cotizado y vendido), fechas y cuántas quedaron sin gestionar.
- **Mientras el proyecto está activo** se calcula al vuelo («informe al momento»); **al cerrar** se guarda en `resumen_cierre` y no cambia aunque después se escriba en la base.

## Cerrar (`proyectos.activar`)

`POST /proyectos/:id/cerrar` con `conclusiones`, `confirmado: true` («revisé las conclusiones y el informe») e `idempotencyKey`. En una transacción (bloqueo del proyecto y luego de todas sus participaciones en orden de id, para no congelar un registro a medias): guarda el informe, las conclusiones, quién y cuándo cerró, pasa a `cerrado`, **libera las tiendas** y **libera las empresas** (las que tienen resultado conservan su estado; las sin gestionar quedan disponibles para otro proyecto) y deja el historial. Solo en proyectos activos de tiendas del supervisor (404 si no es de las suyas). Con `reglas.visto_bueno_cierre` encendida queda `visto_bueno_estado = pendiente`; apagada, el cierre termina ahí. Un proyecto cerrado no recibe registros (409).

## Visto bueno (`proyectos.dar_visto_bueno`)

- `POST /proyectos/:id/visto-bueno`: lo da (comentario opcional).
- `POST /proyectos/:id/devolver`: lo devuelve con comentarios (obligatorios); el estado pasa a `devuelto`.
- `POST /proyectos/:id/reenviar` (`proyectos.activar`): el supervisor corrige las conclusiones y vuelve a `pendiente`. El informe sigue congelado.
- Quién, cuándo y comentario quedan en el proyecto y en el historial; el nombre y la fecha salen en el PDF.

## PDF

`GET /proyectos/:id/informe.pdf` (`informePdfService`, `pdf-lib`): encabezado con la línea configurable `informe.texto_encabezado`, y las secciones que el administrador dejó en `informe.secciones`, con `informe.filas_por_tabla` filas por tabla y «y N más». Lleva las conclusiones y el visto bueno con nombre y fecha. Los textos se limpian a Latin-1 como en Vales.

## Panel gerencial (`proyectos.ver_gerencia` o `proyectos.administrar`, solo lectura)

`GET /gerencia/panel?anio=&paisId=&moneda=`: proyectos activos, vencidos y por dar visto bueno, vendido del año por moneda, efectividad con semáforo, vendido por mes (en una moneda), efectividad por país, comparación de nichos y los cierres por revisar. `GET /gerencia/visto-bueno`: los cierres que esperan el visto bueno y cuántas activaciones esperan aprobación.

## API

| Ruta | Permiso |
|---|---|
| `GET /proyectos/:id/informe` · `/informe.pdf` | supervisar · ver_gerencia · administrar · ver_reportes (con alcance) |
| `POST /proyectos/:id/cerrar` · `/reenviar` | `proyectos.activar` |
| `POST /proyectos/:id/visto-bueno` · `/devolver` | `proyectos.dar_visto_bueno` |
| `GET /gerencia/panel` · `/gerencia/visto-bueno` | ver_gerencia · administrar |

## Código

`informeService.js` · `cierreService.js` · `informePdfService.js` · `gerenciaService.js` · `repositories/informeRepository.js` y `gerenciaRepository.js` · `controllers/cierreController.js` · migración `39_proyectos_visto_bueno` (columna `visto_bueno_estado`: pendiente, dado, devuelto; vacío = sin visto bueno).

## Verificación

`node scripts/proyectos/verificar-cierre.js` (base desechable; 62 comprobaciones, también en MariaDB 11.8). El informe se compara con un **conteo manual** que el propio script lleva aparte mientras los asesores registran: cada cifra, los montos por moneda, presencial y remoto, muestras, lo anulado, lo rechazado y lo «por confirmar». También prueba el cierre, el congelado, la liberación, el visto bueno (dar, devolver, reenviar), el cierre sin visto bueno, el PDF y el panel.
