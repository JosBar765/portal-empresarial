# Modelo de datos — Calculadora de Viáticos (borrador para aprobación)

Prefijo de tablas: `viaticos_`. Convenciones del proyecto: español, `snake_case`, `INT AUTO_INCREMENT` como PK, `<entidad>_id` como FK, dinero `DECIMAL(10,2)`, `creado_en`/`actualizado_en`/`activo`, InnoDB `utf8mb4_unicode_ci`. Los archivos guardan la **ruta** de Storage, nunca el binario. Todo el módulo vive **solo en migraciones** (decisión del dueño: producción ya está al aire y se actualiza ejecutando scripts; `schema.sql` y `seed.sql` no se tocan): dos scripts idempotentes con el mismo correlativo, `NN_viaticos_esquema.sql` (tablas) y `NN_viaticos_semilla.sql` (permisos, rol Piloto y datos iniciales), que el ejecutor aplica en ese orden por nombre. Correlativo previsto: 37 (dev llega a 34 y `module/proyectos` a 36); se confirma al integrar con `dev`.

## Normalización (3FN)

- Sin grupos repetidos: los niveles de fluidos y el kit de emergencia son filas hijas, no cinco o cuatro columnas.
- Sin valores derivables guardados: «En curso», «Terminado» y «Vencida» se calculan con las fechas; no son columnas.
- Los tramos son pares no ordenados: se guarda un solo par (A, B) con `ubicacion_a_id < ubicacion_b_id` y vale en ambos sentidos; pueden cruzar países.
- Todo lo que hoy sería una lista fija en código es una tabla de catálogo administrable desde `Configuración`.
- **Desnormalización deliberada (histórico):** la solicitud conserva el precio unitario de cada comida, los km y horas de cada tramo y el `total_solicitado`, porque son un documento: cambiar el catálogo después no debe alterar lo ya autorizado ni su PDF.

## Catálogos

| Tabla | Columnas clave |
|---|---|
| `viaticos_monedas` | `id`, `codigo` (UNIQUE, ISO: GTQ, USD, HNL, NIO, CRC, PAB), `nombre`, `simbolo`, `activo` |
| `viaticos_tipos_comida` | `id`, `nombre` (desayuno, almuerzo, cena), `orden` |
| `viaticos_valores_comida` | `moneda_id`, `tipo_comida_id` (PK compuesta), `valor` — depende solo de la moneda (ej. GTQ 30/40/40; USD 20/25/25), no del país |
| `viaticos_ubicaciones` | `id`, `pais_id`, `nombre`, `activo`; UNIQUE (`pais_id`, `nombre`) — el país es un atributo de la ubicación; no filtra qué ubicaciones se pueden elegir en una solicitud |
| `viaticos_tramos` | `id`, `ubicacion_a_id`, `ubicacion_b_id`, `km`, `horas`, `activo`; UNIQUE (A, B); CHECK A < B — un tramo puede unir ubicaciones de países distintos (ej. Ciudad de Guatemala – El Salvador) |
| `viaticos_motivos` | `id`, `nombre`, `activo` |
| `viaticos_tipos_gasto` | `id`, `nombre`, `es_otros`, `seleccionable_en_gastos`, `activo` (incluye Hospedaje y Combustible con `seleccionable_en_gastos = 0`, para reutilizarlo como rubro de liquidación) |
| `viaticos_tipos_defecto` | `id`, `nombre`, `es_otros`, `activo` |
| `viaticos_fluidos` | `id`, `nombre` (combustible, aceite del motor, agua del radiador, líquido de frenos, líquido hidráulico), `permite_no_aplica`, `orden` |
| `viaticos_niveles` | `id`, `nombre` (F, 3/4, 1/2, 1/4, E, N/A), `orden`, `bajo_la_mitad` |
| `viaticos_kit_items` | `id`, `nombre` (llanta de repuesto, triquet/gato, triángulo, extintor), `orden` |
| `viaticos_combustibles` | `id`, `nombre` (gasolina, diésel) |
| `viaticos_estados` | `id`, `nombre` (esperando autorización, rechazada, autorizada, liquidada) |
| `viaticos_salvedades` | `id`, `nombre`, `texto_pdf` (licencia, tarjeta de circulación, seguro: «… vencerá durante el trayecto») |
| `viaticos_ajustes` | `clave` (PK), `valor` JSON, `descripcion` (tipos y tamaño máximo de archivo, etc.; mismo patrón que `prompt_ajustes`) |
| `viaticos_secuencias` | `pais_id` (PK), `ultimo` — correlativo `VIA-<código país>-<ultimo con 6 dígitos>`, incrementado en transacción con `FOR UPDATE` |

## Licencias, vehículos y personas

| Tabla | Columnas clave |
|---|---|
| `viaticos_tipos_licencia` | `id`, `codigo`, `nombre`, `activo` (catálogo global; las reglas por país lo usan) |
| `viaticos_tipos_placa` | `id`, `pais_id`, `codigo`, `nombre`, `activo` |
| `viaticos_reglas_licencia` | `pais_id`, `tipo_licencia_id`, `tipo_placa_id` (PK compuesta), `tonelaje_max` NULL, `pasajeros_max` NULL — qué placa permite manejar cada tipo de licencia en cada país |
| `viaticos_licencias` | `usuario_id` (PK, FK `usuarios`), `tipo_licencia_id`, `numero`, `vence_el` — **una por persona (supuesto)** |
| `viaticos_usuario_paises` | `usuario_id`, `pais_id` (PK compuesta) — países en los que puede solicitar |
| `viaticos_vehiculos` | `id`, `pais_id`, `propietario_id` NULL (NULL = de la empresa; si no, FK `usuarios`), `marca`, `modelo`, `anio`, `placa`, `tipo_placa_id`, `combustible_id`, `tonelaje` NULL, `pasajeros` NULL, `poliza_numero`, `poliza_vence_el`, `tarjeta_vence_el`, `activo`; UNIQUE (`pais_id`, `placa`) |

## Solicitud y sus partes

| Tabla | Columnas clave |
|---|---|
| `viaticos_solicitudes` | `id`, `correlativo` (UNIQUE), `pais_id`, `moneda_id` NULL (solo viajes de más de 1 día), `solicitante_id`, `modalidad` ENUM('hasta_un_dia','mas_de_un_dia'), `estado_id`, `motivo_id`, `vehiculo_id`, `fecha_salida` DATETIME, `fecha_regreso` DATE NULL, `rendimiento_km_galon`, `precio_galon`, `depreciacion_por_km` (NULL si el vehículo es de la empresa), `odometro` NULL, `total_solicitado`, `pdf_ruta` NULL, `creado_en`, `actualizado_en` |
| `viaticos_historial` | `id`, `solicitud_id` (CASCADE), `estado_id`, `usuario_id`, `motivo` NULL (razón del rechazo, libre), `creado_en` |
| `viaticos_solicitud_tramos` | `id`, `solicitud_id` (CASCADE), `orden`, `tramo_id`, `sentido` ('ida','vuelta'), `km`, `horas` (copia histórica) |
| `viaticos_solicitud_hospedajes` | `id`, `solicitud_id`, `hotel` VARCHAR(50), `lugar` VARCHAR(50), `noches`, `valor_noche` |
| `viaticos_solicitud_comidas` | `solicitud_id`, `fecha`, `tipo_comida_id` (PK compuesta), `valor_unitario` (copia histórica); una fila por comida marcada |
| `viaticos_solicitud_gastos` | `id`, `solicitud_id`, `tipo_gasto_id`, `descripcion` VARCHAR(100), `monto` |
| `viaticos_solicitud_salvedades` | `solicitud_id`, `salvedad_id` (PK compuesta) |
| `viaticos_inspeccion_fluidos` | `solicitud_id`, `fluido_id` (PK compuesta), `nivel_id` |
| `viaticos_solicitud_kit` | `solicitud_id`, `kit_item_id` (PK compuesta), `presente` |
| `viaticos_defectos` | `id`, `solicitud_id`, `tipo_defecto_id`, `descripcion` NULL (solo «otros»), `ruta`, `mime_type`, `tamano` |
| `viaticos_comprobantes` | `id`, `solicitud_id`, `tipo_gasto_id`, `descripcion` NULL (solo «otro»), `monto`, `nombre_original`, `ruta`, `mime_type`, `tamano`, `subido_en` |

Dar de baja una solicitud la borra con sus hijas (`ON DELETE CASCADE`) y el servicio borra los archivos en Storage solo en producción. Las FK hacia `usuarios` obligatorias van con `RESTRICT`; las de pertenencia con `CASCADE` (convención del proyecto).

## Permisos (`permisos.modulo = 'viaticos'`)

`viaticos.ver`, `viaticos.gestionar`, `viaticos.autorizar`, `viaticos.liquidar`, `viaticos.configurar`. Se insertan por `codigo` (sin id fijo) en la migración. Asignación (dueño): se crea el rol **Piloto** (nuevo, sin id fijo en la migración, buscado por nombre) con `viaticos.ver`, y el Administrador recibe los cinco. Cualquier otro rol (p. ej. Supervisor de Ventas, que también solicita viáticos) se asigna después desde Administración. Antes de F3 hay que verificar que Administración y los filtros por rol del código no asuman solo los roles 1 a 10.

## Pendientes de confirmar

1. ~~Valores de comida~~ Resuelto (dueño): por moneda. ~~Tramos del mismo país~~ Resuelto (dueño): un tramo puede unir países distintos.
2. Una licencia por persona obliga a que los tipos de licencia sean un catálogo global y las reglas sean por país (supuesto ya aceptado).
3. `Vencida` se calcula (fecha de salida pasada y estado esperando autorización); no se guarda. Una solicitud rechazada sigue como rechazada y se puede modificar igual.
4. ~~Roles~~ Resuelto (dueño): se crea el rol Piloto con sus permisos; otros roles después.
5. ~~Seed~~ Resuelto (dueño): no se usa `seed.sql` ni `schema.sql`; todo va en las dos migraciones.
