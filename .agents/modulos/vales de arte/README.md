# Módulo Vales de Arte

Gestión, creación y control de vales artísticos y órdenes de diseño: el asesor crea el vale, su supervisor lo autoriza, los talleres lo verifican, asignan y entregan una propuesta, y el asesor la confirma. Todo con buzón en tiempo real por rol.

La fuente de verdad del flujo (estados, roles, permisos, buzón, límites, atraso, tiempo real) es [`flujo_vale_de_arte.md`](flujo_vale_de_arte.md). Esta página es solo el mapa general.

## Dependencias

- **Montaje:** `/api/vales` con `requireAuth` + `requirePermission('vales.ver')` en `src/app.js`; frontend en `/modules/vales`.
- **Servicios del core:** `src/core/auth` y `permissions` (identidad y permisos), `websocket/socketManager`, `files` (Supabase Storage, `nombreArchivo.js`, `subirYRegistrarArchivo.js`), `idempotency`, `calendario` (horario laboral, feriados, fecha de entrega), `notifications`.
- **Tablas principales:** `vales`, `vale_talleres`, `vale_historial`, `estados_vale`, `estados_taller`, `talleres`, `supervisores`, `asesores`, `supervisor_tiendas`, `idempotency_keys`; para el calendario `horarios_laborales`, `feriados`, `parametros_sistema`.
- **Permisos:** prefijo `vales.*` (`ver`, `crear`, `confirmar`, `corregir`, `dar_de_baja`, `solicitar_modificacion`, `autorizar_creacion`, `aprobar_modificacion`, `verificar_adjuntos`, `rechazar_propuesta`, `responder_rechazo_propuesta`, `aprobar_general`, `ver_historial`, `ver_reportes`, ...); se definen en `database/seed.sql`. Detalle por rol: sección 3 del flujo.
- **Variables de entorno:** las globales de `.env` (Supabase Storage incluido); no tiene variables propias.

## Dónde está el código

- Backend: `src/modules/vales/` (`controllers/`, `services/`, `repositories/`, `routes.js`, `events.js` y los watchers `atrasoWatcher.js`, `adjuntosWatcher.js`, `vigenciaWatcher.js`, `borradorWatcher.js`, `retencionArchivosWatcher.js`).
- Frontend: `public/modules/vales/` (un único `app.js`/`index.html` adaptativo que muestra contadores y acciones distintos según el `rolId`).
- Lógica de negocio repartida en `services/vale*Service.js` (Creacion, Taller, Confirmacion, Buzon, Detalle, Catalogo, Reporte, Modificacion, Correccion, Adjuntos, Pdf, `capacidadEntregaService`...); `valeService.js` es solo una fachada que los reexporta.

## Reglas clave

- **Dos niveles de estado:** general (`vales.estado`) y por taller (`vale_talleres.estado`). Un vale puede ir a varios talleres a la vez; la fusión manual (`APROBADO_DEPARTAMENTO`) solo existe con 2+ talleres. Catálogo completo en la sección 0.1 del flujo.
- **Permisos, no roles:** cada acción se protege con `requirePermission` en `routes.js`. El Administrador ve todo pero no ejecuta acciones de escritura del flujo; el Gerente es solo lectura (buzón general y Reportes).
- **Toda transición** corre bajo `valeMutex` y escribe en `vale_historial`. El historial solo se muestra con `vales.ver_historial`.
- **Verificación de adjuntos** (los adjuntos viajan por correo, fuera del módulo): cada taller empieza en `VERIFICANDO_ADJUNTOS`; ventana de horas laborales desde el primer rechazo y borrado del vale si vence (sección 2.1 del flujo).
- **Modificaciones:** Básica, Media y Avanzada crean un vale `MOD-<correlativo>` (plazos de 1, 2 y 3 días hábiles; `urgente` = siguiente día disponible; nunca de hoy para hoy); sección 1.1 del flujo.
- **Rechazo de propuesta:** el asesor dueño rechaza la propuesta de uno o varios talleres con el vale en `PENDIENTE_CONFIRMACION` y conversa con cada taller, que acepta o rechaza; sección 1.2 del flujo.
- **Horario laboral y fecha de entrega** (hora de Guatemala, UTC-6): plazos en horas laborales y fecha mínima de entrega según `src/core/calendario/`; sección 5.1 del flujo. Los vencimientos guardados se reinician con `scripts/recalcular-vencimientos.js`.
- **Cupo:** solo el tope diario opcional por taller (`talleres.limite_diario`) sobre la fecha de entrega; no hay límite por asesor ni cupo colectivo de autorización (sección 5).
- **Atraso** no es un estado: se deriva de `fecha_entrega` (`calcularAtraso()`) y se congela con `atraso_congelado_en` al confirmar o aprobar una modificación; `atrasoWatcher.js` lanza una alerta roja única (revisa cada 60 s). Sección 7.
- **Propuestas compartidas entre talleres:** `talleres.comparte_propuestas` (simétrico; Diseño/UV-3D/Protextil = 1, Diseño Local = 0, evaluado al leer). Solo nivel de interfaz: el endpoint de detalle sigue devolviendo todas las propuestas, por decisión. Sección 14; script de producción `comparte_propuestas.sql`.
- **PDF del vale** (`services/valePdfService.js`, `pdf-lib`): documento administrativo; las propuestas y fusiones nunca se pegan en él. No se genera nunca un PDF a medias (hasta 3 intentos por adjunto; el log `[ValePdfService]` indica la causa). La autorización arma el PDF firmado antes de tocar la base y confirma todo en una transacción.
- **Archivos:** nunca en MySQL, solo la URL de Supabase Storage. Los objetos se nombran con el correlativo del vale (`src/core/files/nombreArchivo.js`); **al agregar un taller nuevo hay que sumarlo a `codigoTaller` ahí**, o entregar una propuesta con archivo falla. Ver `documentacion/correlativo_documentos_supabase.md`.
- **Idempotencia:** los endpoints que combinan subida de archivo + escritura en base (crear vale, entregar propuesta, aprobar general) aceptan el campo de formulario `idempotencyKey`, verificado contra `idempotency_keys`.
- **Tiempo real:** `events.js` y `socketManager` envían cada evento solo a las salas a las que concierne (`asesor:<id>`, `supervisor:<id>`, `taller:<id>`, `disenador:<id>`, `vales:fusion` para quien tiene `vales.aprobar_general`, `vales:admin`), validadas en el servidor por conexión; los clientes vuelven a pedir su buzón en cada evento (sección 8).
- **Supervisores que crean vales propios** necesitan filas en `supervisores` y `asesores`, los permisos del rol 3 y al menos un supervisor que cubra su tienda (puede ser él mismo); autorizan sus propios vales (sección 3).

## Documentos del módulo

- [`flujo_vale_de_arte.md`](flujo_vale_de_arte.md): estado real del flujo; **fuente de verdad**.
- [`analisis_modulo.md`](analisis_modulo.md): especificación original, solo histórica (aún menciona `VENDIDO`/`CANCELADO` y un flujo de un solo taller que ya no existen).
- [`propuesta_schema_sql.md`](propuesta_schema_sql.md): propuesta inicial del esquema, histórica.
- `documentacion/`: explicación técnica y motivo de cada cambio. Temas generales: [`correlativo_documentos_supabase.md`](documentacion/correlativo_documentos_supabase.md), [`storage_solo_produccion.md`](documentacion/storage_solo_produccion.md), [`retencion_archivos.md`](documentacion/retencion_archivos.md), [`borradores.md`](documentacion/borradores.md), [`baja_taller_multitaller.md`](documentacion/baja_taller_multitaller.md), [`centro_notificaciones_por_modulo.md`](documentacion/centro_notificaciones_por_modulo.md), [`notificaciones_windows.md`](documentacion/notificaciones_windows.md), [`propuestas_otros_talleres_visor.md`](documentacion/propuestas_otros_talleres_visor.md), [`reportes_propuestas_multitaller.md`](documentacion/reportes_propuestas_multitaller.md), [`rendimiento_buzon_prefiltro.md`](documentacion/rendimiento_buzon_prefiltro.md), [`selector_ventana_tiempo.md`](documentacion/selector_ventana_tiempo.md), `auditoria_seguridad_30.md`, `plan_remediacion_25.md`, `plan_remediacion_30.md`, `creacion_v1.md`. El resto (`correccion_*.md`, `correcciones_*.md`) son los ciclos de corrección numerados.
- `correcciones/`: análisis previos de cada ciclo de corrección (`analisis_correcciones_N.md`, [`notificaciones.md`](correcciones/notificaciones.md)). Es historial de cambios, no documentación vigente.
