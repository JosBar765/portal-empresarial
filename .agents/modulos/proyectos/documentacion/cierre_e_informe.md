# Cierre, informe y gerencia (fase 6)

Cerrar un proyecto congela su informe, libera las tiendas y las empresas y lo deja de solo lectura; el gerente da o devuelve el visto bueno; el panel gerencial resume el año. Primero se describe el **servidor** (rama 6a) y al final las **pantallas** (rama 6b).

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

## Pantallas (rama 6b)

- **Cierre** (`#/proyectos/<id>/cierre`; S10): informe al momento (seis cifras con porcentajes, montos por moneda, presencial frente a remoto, muestras por área), las conclusiones, el aviso de empresas sin gestionar, el estado del visto bueno y «Descargar PDF». «Cerrar proyecto» abre la confirmación (T3b): casilla «Revisé las conclusiones y el informe»; sin conclusiones avisa y no cierra. Desde el detalle de un proyecto activo y desde Seguimiento hay un botón «Ir al cierre».
- **Proyecto cerrado** (S16, solo lectura, mismo enlace): banner del visto bueno (dado en verde, esperando en ámbar, devuelto en rojo con el comentario y las conclusiones editables con «Reenviar al gerente»), informe congelado, conclusiones y tabla por tienda.
- **Panel gerencial** (`#/panel`; G1): proyectos activos, vencidos y por revisar, vendido del año por moneda, efectividad promedio, vendido por mes (con selector de moneda si hay varias), efectividad por país, comparación de nichos con semáforo y los cierres por revisar; filtro por país.
- **Por dar visto bueno** (`#/vistobueno`; G4): pestañas Cierres y Activaciones (esta lleva a «Por aprobar»). **Revisión** (`#/vistobueno/<id>`; G2): cifras, tabla por tienda, conclusiones, «Tu decisión» (dar el visto bueno o devolver con comentarios, obligatorios al devolver) e historial del cierre.
- Las barras y la gráfica son CSS puro; en celular las columnas pasan a una sola.

## Código

`informeService.js` · `cierreService.js` · `informePdfService.js` · `gerenciaService.js` · `repositories/informeRepository.js` y `gerenciaRepository.js` · `controllers/cierreController.js` · frontend en `public/modules/proyectos/js/views/` (`cierreProyecto.js`, `gerencia.js`) · migración `39_proyectos_visto_bueno` (columna `visto_bueno_estado`: pendiente, dado, devuelto; vacío = sin visto bueno).

## Exportar a CSV (fase 9b)

Con `proyectos.ver_reportes` aparece «Exportar CSV» en la Cartera, en el cierre del proyecto y en la ficha de gerencia. Los archivos salen en UTF-8 con BOM (Excel lee bien los acentos), con comillas donde hacen falta y con las celdas que parecen fórmula (`=`, `+`, `-`, `@`) neutralizadas con un apóstrofo.

| Archivo | Ruta | Contenido |
|---|---|---|
| Cartera | `GET /api/proyectos/clientes/exportar.csv` | Empresas con los mismos filtros y el mismo alcance por país que la lista, más los campos propios. Tope de 20 000 filas: si se supera, la respuesta lleva `X-Exportacion-Truncada`. |
| Resultados del proyecto | `GET /api/proyectos/proyectos/:id/exportar.csv` | Una fila por empresa asignada: asesor, tienda, estado, gestiones, muestras, última y próxima gestión, y cotizado y vendido en una columna por moneda, con sus referencias. |
| Informe | `GET /api/proyectos/proyectos/:id/informe.csv?tabla=resumen\|asesores\|tiendas` | Las tablas del informe, con las mismas cifras que la pantalla y el PDF. |

Reglas: lo anulado, rechazado o por confirmar no cuenta; las monedas no se mezclan; quien supervisa solo ve en detalle las tiendas de su alcance (las filas de otras tiendas salen sin ciudad, gestiones ni montos, como en el seguimiento) y gerencia ve todo. Sin el permiso la respuesta es 403.

## Verificación

`node scripts/proyectos/verificar-cierre.js` (base desechable; 62 comprobaciones, también en MariaDB 11.8). El informe se compara con un **conteo manual** que el propio script lleva aparte mientras los asesores registran: cada cifra, los montos por moneda, presencial y remoto, muestras, lo anulado, lo rechazado y lo «por confirmar». También prueba el cierre, el congelado, la liberación, el visto bueno (dar, devolver, reenviar), el cierre sin visto bueno, el PDF y el panel.

También `node scripts/proyectos/verificar-exportacion.js` (24 comprobaciones): formato, permisos por rol, alcance, dinero por moneda y que lo anulado no cuenta.
