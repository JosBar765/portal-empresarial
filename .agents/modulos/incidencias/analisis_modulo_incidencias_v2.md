# Módulo de Incidencias — Análisis e implementación (v2)

> **Estado:** propuesta de diseño, nada implementado. Reemplaza en alcance a
> `analisis_modulo_incidencias.md` (v1, escrito con una idea más simple: un solo
> origen de reporte y una sola vía de resolución). La v2 incorpora lo que se
> explicó después: **dos orígenes** de incidencias (reporte espontáneo y visita de
> supervisión), **tres vías de resolución** según la ubicación, **dos tipos de
> aprobador**, el flujo de **cambio de equipo** (cotización → aprobación → compra),
> un **sistema de prioridades** y un **dashboard de Gerencia**. Lo que la v1 decía
> sobre permisos como datos (no roles fijos en el código) se conserva.
>
> Se construye siguiendo `.agents/reglas/reglas_modulo.md` (estructura de módulo),
> `reglas_autenticacion.md` (RBAC/JWT) y los controles de seguridad de las fases
> 1–3b (`plan_remediacion_30.md`). Marcadas como **[DECISIÓN]** están las cosas
> que el negocio debe confirmar antes de construir (resumen en la sección 14).

---

## 1. Qué es una incidencia (y qué no cambia entre tipos)

Una incidencia es **un problema con un activo de Grupo Premia** (un edificio, una
instalación, un equipo). Los dos tipos conocidos no son tipos de problema, sino
**formas distintas de enterarse y de resolver**:

| | Reporte espontáneo | Hallazgo de supervisión |
|---|---|---|
| Quién la reporta | Cualquier persona que vea el problema | El supervisor de tiendas, al llenar el formulario de una visita |
| Dónde ocurre | Sede central (Munditrofeos, Premia Z.13) | Tiendas Trofex de Guatemala y de Centroamérica |
| Cómo llega al módulo | Formulario "Reportar incidencia" | Desde el módulo de Supervisiones (integración interna) |
| Quién la resuelve | Técnicos (mantenimiento) | El supervisor de la tienda gestiona la solución |
| Quién aprueba el cierre | Asistente de gerencia | Supervisor de tiendas (ver [DECISIÓN] en 5.3) |
| Seguimiento | Inmediato | En la siguiente visita (y entre visitas) |

**Principio de diseño:** *una sola entidad* `incidencias` con un solo ciclo de vida;
lo que varía (quién resuelve, quién aprueba, de dónde vino) son **datos de la
incidencia**, no código distinto. Así el día que se agreguen incidencias de
producción de trofeos, o de otro origen, se agrega un valor de `origen` y un
catálogo, no un módulo nuevo.

---

## 2. Cómo encaja con lo que ya existe en el sistema

Se parte de los datos reales ya cargados (`database/seed.sql`). Esto es lo que ya
sirve tal cual:

### 2.1 Ubicaciones: ya están en la tabla `tiendas`

`tiendas` ya modela **todas** las ubicaciones relevantes, con empresa, departamento
y subdivisión:

| Grupo real | Códigos en `tiendas` | Empresa / departamento |
|---|---|---|
| Sede central | `MTC`, `MTS` | Munditrofeos, S.A. · "Ventas Munditrofeos" (Comercialización, Sala de Ventas) |
| Extensión | `P13` | Premia, S.A. · "Ventas Premia Z13" |
| Tiendas de Centroamérica | `SSV, SAA, SMG, ECL, CMY, TEG, SPS, MAN, LEO, SJO` | Premia … (El Salvador, Honduras, Nicaragua, Costa Rica) · "Ventas Centroamérica" |
| Trofex Guatemala | `SJN, ZN3, COB, PET, PTB, CHQ, JTP` (región R1) y `SMS, CHM, ESC, HUE, MAZ, VLN, XEL` (región R2) | Trofex … · "Ventas Trofex R1/R2" |

**[DECISIÓN] Dato a validar:** en los datos las tiendas de Centroamérica figuran
como **Premia** (empresas 3–12), no como Trofex. En la explicación se habló de
"Trofex en Centroamérica". El diseño no depende del nombre: la vía de resolución
se deduce de **país y departamento** de la tienda (sección 5.1). Solo hay que
confirmar que los supervisores de C.A. cubren esas tiendas Premia.

No se crea un catálogo nuevo de ubicaciones: una incidencia apunta a `tiendas.id`.
Lo que sí falta es la **zona dentro de la ubicación** (diseño, sala de ventas,
gerencia, bodega…) → catálogo nuevo `incidencia_zonas` (sección 4).

### 2.2 Personas y roles

Roles existentes (`roles`): Administrador (1), Asesor de Ventas (2), Supervisor de
Ventas (3), Encargados de taller (4, 5, 9, 10), Técnico (6), Asistente de Diseño
(7), Gerente (8). Ya existen además `asesores.tienda_id` (cada asesor en una
tienda), `supervisores` y **`supervisor_tiendas`** (un supervisor cubre varias
tiendas).

Lo que **no existe** y hay que crear (como *datos*, desde la pestaña Roles y
Permisos de Administración, no con código):

| Rol nuevo | Para qué |
|---|---|
| **Asistente de Gerencia** | Aprueba el cierre de incidencias de la sede central; no confundir con "Asistente de Diseño" (rol 7), que es otra cosa |
| **Técnico de Mantenimiento** | Resuelve incidencias de la sede central |
| **Encargado de Mantenimiento** (opcional) | Asigna y reasigna entre técnicos; si el volumen es bajo, lo hace el Asistente de Gerencia |

Los supervisores de tiendas Trofex ya podrían ser el rol **Supervisor de Ventas
(3)** con sus filas en `supervisor_tiendas`. **[DECISIÓN]** ¿Son las mismas
personas que supervisan ventas en el módulo de Vales, o un grupo distinto? Si son
distintos, se recomienda un rol aparte ("Supervisor de Tiendas") con su propia
asignación de tiendas, para no mezclar permisos de Vales con los de Incidencias.
Se **recomienda deducir la jurisdicción (Guatemala vs Centroamérica) de las
tiendas asignadas**, no de dos roles separados: un solo rol, y cada supervisor ve
y resuelve solo las incidencias de sus tiendas.

### 2.3 Piezas técnicas reutilizables (ya probadas y asegurantes)

| Necesidad del módulo | Ya existe y se reutiliza |
|---|---|
| Autenticación, sesión, permisos por ruta | `authenticateJWT`, `requirePermission`, `requireModule` |
| Máquina de estados + historial | Patrón de `valeService` + `vale_historial` |
| Adjuntar fotos y PDFs | `multer` + `subirYRegistrarArchivo` (rollback), optimizador de imágenes (tope de 40 MP), PDFs ≤ 5 páginas |
| Archivos privados | Bucket privado + referencias firmadas por usuario (`referenciaArchivo.js`, Fase 3b) |
| Evitar duplicados por reintento de red | `idempotencyKey` + tabla `idempotency_keys` |
| Operaciones de varias tablas atómicas | `db.transaction(fn)` (Fase 3) |
| Registro de quién hizo qué | `auditoriaService` (tabla `auditoria`) |
| Tiempo real | Salas de Socket.IO validadas en el servidor (`registrarValidadorSala`), como `events.js` de Vales |
| Validación y errores | `validar.js`, `responderError`/`ErrorDeNegocio` |
| Límites de tasa, CSP, XSS | `rateLimiters.js`, CSP (sin scripts en línea), `escapeHtml`/`urlSegura` |

> **Un ajuste previo necesario:** hoy el endpoint de apertura de archivos vive en
> `/api/vales/archivo/:ref` y el middleware `protegerRespuestas` se monta solo en el
> router de Vales. Para reutilizarlo hay que **generalizarlo** (por ejemplo
> `/api/archivos/:ref`, montado a nivel de `/api`) antes de construir Incidencias,
> de modo que ninguna respuesta del módulo nuevo entregue URLs directas del bucket.

---

## 3. Actores y permisos

Siguiendo el modelo del sistema (permisos como datos en `permisos` +
`rol_permisos`; el administrador decide quién tiene qué), el módulo introduce
permisos con prefijo `incidencias.`. **No hay roles fijos en el código.**

| Permiso | Habilita | Rol sugerido de entrada |
|---|---|---|
| `incidencias.ver` | Entrar al módulo y ver "mis reportes" | Todos los roles activos |
| `incidencias.reportar` | Crear incidencias (con foto) | Todos los roles activos |
| `incidencias.asignar` | Ver la bandeja sin asignar de su vía y asignar/reasignar | Encargado de Mantenimiento / Asistente de Gerencia |
| `incidencias.resolver` | Tomar y trabajar incidencias, dar seguimiento, enviar a aprobación | Técnico de Mantenimiento; Supervisor de Tiendas (para su vía) |
| `incidencias.aprobar` | Aprobar el cierre o devolver con ajustes | Asistente de Gerencia; Supervisor de Tiendas |
| `incidencias.aprobar_compra` | Aprobar la compra de un equipo | Gerente (o quien defina el negocio) |
| `incidencias.ver_dashboard` | Dashboard estadístico de solo lectura | Gerente, Administrador |
| `incidencias.gestionar_catalogos` | Categorías, zonas, tipos de activo, especialidades, prioridades | Administrador |
| `incidencias.origen_supervision` | Uso **interno**: lo ejerce el módulo de Supervisiones al registrar hallazgos | Supervisor de Tiendas |

Reglas de autorización (todas en el **backend**; ocultar un botón no es control de
acceso):

1. **Permiso por ruta** (`requirePermission`) **y además propiedad por registro**
   (anti-IDOR): ver una incidencia exige ser quien la reportó, o pertenecer a su
   vía (técnico de la sede central; supervisor con esa tienda en
   `supervisor_tiendas`), o ser aprobador/gerencia. Cualquier otro caso responde
   **404**, no 403, igual que Vales.
2. **Separación de funciones:** quien resolvió una incidencia **no puede
   aprobar su propio cierre** (se valida en el servicio; ver 5.3).
3. El Administrador sigue el patrón documentado en `CLAUDE.md`: el permiso real se
   decide en `rol_permisos`; no hay bypass oculto en las rutas.

---

## 4. Modelo de datos propuesto

Todas las tablas nuevas van en `database/schema.sql` (estructura) y los catálogos en
`database/seed.sql`, según `reglas_archivosSQL.md`. Convención del proyecto:
InnoDB, utf8mb4, `creado_en`/`actualizado_en`, claves foráneas explícitas.

### 4.1 Catálogos (los gestiona el administrador)

```
incidencia_categorias   id, nombre, activo            -- Eléctrica, Mobiliario, Equipo de impresión, Sublimación, Redes/Cómputo, Infraestructura, Climatización, Seguridad, Otro
incidencia_zonas        id, nombre, activo            -- Diseño, Sala de ventas, Gerencia, Bodega, Producción, Exterior… (+ tienda_id NULL = aplica a todas)
tipos_activo            id, nombre, categoria_id      -- Impresora, Sublimadora, Plotter, Aire acondicionado, Tomacorriente, Luminaria…
incidencia_prioridades  id, codigo, nombre, orden     -- P1 Crítica, P2 Alta, P3 Media, P4 Baja (sección 8)
especialidades          id, nombre                    -- Electricidad, Plomería, Informática, Equipo de impresión…
usuario_especialidades  usuario_id, especialidad_id   -- Para asignar con criterio
```

### 4.2 Núcleo

```
incidencias
  id, correlativo                  -- INC-000123 (generado como el de vales, con reintento por duplicado)
  origen            ENUM('REPORTE','SUPERVISION','PRODUCCION')   -- PRODUCCION reservado
  origen_ref_id     INT NULL       -- id de la supervisión/visita que la generó (otro módulo)
  tienda_id         FK tiendas     -- ubicación
  zona_id           FK incidencia_zonas
  via_resolucion    ENUM('CENTRAL_GT','TIENDAS_GT','TIENDAS_CA')  -- fotografía al crear (5.1)
  categoria_id      FK
  tipo_activo_id    FK NULL
  activo_id         FK NULL        -- fase 2: activo individual (sección 10)
  titulo            VARCHAR(120)
  descripcion       TEXT
  impacto           ENUM('SEGURIDAD','DETIENE_OPERACION','DEGRADA','MENOR')
  afecta_operacion  TINYINT        -- ¿se puede seguir trabajando?
  prioridad_id      FK             -- calculada (sección 8), ajustable por quien asigna
  estado_id         FK estados_incidencia
  reportada_por     FK usuarios
  asignada_a        FK usuarios NULL
  aprobador_id      FK usuarios NULL  -- quien aprobó/devolvió la última vez
  reabierta_veces   INT DEFAULT 0
  duplicada_de      FK incidencias NULL
  creado_en, actualizado_en, resuelta_en, cerrada_en
```

```
estados_incidencia          id, nombre                                -- ver sección 6
incidencia_documentos       id, incidencia_id, ruta, tipo(imagen|documento), mime_type, tamano, etapa(REPORTE|SEGUIMIENTO|COTIZACION|EVIDENCIA_CIERRE), subido_por, creado_en
incidencia_seguimientos     id, incidencia_id, autor_id, tipo(COMENTARIO|AVANCE|SISTEMA), texto, visible_reportante, creado_en
incidencia_historial        id, incidencia_id, estado_anterior_id, estado_nuevo_id, usuario_id, nota, creado_en   -- inmutable, como vale_historial
incidencia_compras          id, incidencia_id, motivo, estado(COTIZANDO|PENDIENTE_APROBACION|APROBADA|RECHAZADA|COMPRADA|RECIBIDA), monto_cotizado DECIMAL, proveedor, solicitada_por, aprobada_por, notas, creado_en…
```

Las fotos/PDF **nunca se guardan en MySQL**: solo la URL del bucket privado
(`ruta`), igual que `vale_documentos`; el cliente recibe referencias firmadas.

### 4.3 Asignaciones de jurisdicción

Para saber **quién resuelve y quién aprueba** cada vía sin escribir nombres en el
código:

```
incidencia_responsables    via_resolucion, rol_id, funcion(RESOLVER|APROBAR|ASIGNAR)   -- qué rol cumple cada función en cada vía
```

Para las tiendas, la persona concreta sale de `supervisor_tiendas` (el supervisor
que tiene esa tienda). Para la sede central, de los usuarios con el permiso
`incidencias.resolver` y la especialidad adecuada.

---

## 5. Enrutamiento: quién resuelve y quién aprueba

### 5.1 Vía de resolución (se calcula al crear, y queda guardada)

Se deduce de la **tienda** elegida, nunca de lo que mande el cliente:

| Condición sobre la tienda | `via_resolucion` | Resuelve | Aprueba |
|---|---|---|---|
| `MTC`, `MTS`, `P13` (empresas Munditrofeos/Premia Z.13) | `CENTRAL_GT` | Técnicos de mantenimiento | Asistente de Gerencia |
| Tiendas Trofex de Guatemala (departamentos "Ventas Trofex R1/R2") | `TIENDAS_GT` | Supervisor de esa tienda | Supervisor (ver 5.3) |
| Tiendas de Centroamérica (departamento "Ventas Centroamérica") | `TIENDAS_CA` | Supervisor de C.A. de esa tienda | Supervisor (ver 5.3) |

La regla se guarda como **datos** (`incidencias_via_por_departamento`, o columna
`tiendas.via_incidencia`), no como `if` en el código, así una tienda nueva o un
cambio de estructura no exige desplegar.

Se guarda la vía **en la incidencia** (fotografía): si luego una tienda cambia de
responsable, las incidencias ya abiertas no cambian de manos sin que alguien lo
decida.

### 5.2 Quién las ve (bandejas)

- **Reportante:** sus reportes y su estado.
- **Técnicos (sede central):** la bandeja de la vía `CENTRAL_GT` filtrada por sus
  especialidades, ordenada por prioridad y luego por antigüedad.
- **Supervisor:** las incidencias de las tiendas que tiene asignadas en
  `supervisor_tiendas`.
- **Asistente de Gerencia:** bandeja de aprobación de la sede central.
- **Gerente / Administrador:** todo, en solo lectura (dashboard + listado).

### 5.3 Aprobación — separación de funciones

La explicación dice que, en las tiendas, **el supervisor es quien vela por la
solución y también quien aprueba el cierre**. Eso deja a la misma persona como
juez y parte. **[DECISIÓN]** Opciones, de más a menos recomendable:

1. **Verificación en la siguiente visita (recomendada):** el supervisor gestiona la
   solución y la marca "resuelta"; el cierre queda **pendiente de verificación en
   persona en la próxima visita** y se cierra desde el formulario de supervisión
   (con foto de evidencia). Encaja con cómo ya trabajan ("darle seguimiento en
   próximas visitas") y le da peso real al cierre.
2. **Segunda firma de Gerencia/Asistente** solo para cierres que implican compra de
   equipo o prioridad P1.
3. El supervisor aprueba su propio cierre, con evidencia obligatoria (más simple,
   menos control).

En la sede central no hay conflicto: el técnico resuelve y la Asistente de
Gerencia aprueba. En cualquier vía, **el servicio impide que quien resolvió
apruebe** la misma incidencia (si hay una sola persona con ambos permisos, el
sistema lo avisa en lugar de dejarla bloqueada: pasa a un aprobador alterno).

---

## 6. Ciclo de vida (máquina de estados)

```
REPORTADA ──► ASIGNADA ──► EN_PROCESO ──► RESUELTA ──► CERRADA
   │             ▲  ▲          │ ▲            │
   │             │  │          │ │            └──(rechazo/ajustes)──► REABIERTA ──► ASIGNADA
   │             │  │          ▼ │
   │             │  │     EN_ESPERA   (repuesto, proveedor, acceso a la tienda…)
   │             │  │          │
   │             │  └──────────┘
   │             │
   │         (necesita cambio de equipo)
   │             ▼
   │      COTIZACION ──► PENDIENTE_APROBACION_COMPRA ──► COMPRA_APROBADA ──► EN_COMPRA ──► EQUIPO_RECIBIDO ──► EN_PROCESO
   │                              │
   │                              └──(rechazada)──► EN_PROCESO (buscar otra solución) / CANCELADA
   │
   └──► DUPLICADA / CANCELADA   (solo quien asigna o el administrador, con motivo)
```

Reglas del flujo (todas se validan en el servicio, en una transacción, con
registro en `incidencia_historial` y auditoría):

1. **REPORTADA → ASIGNADA:** quien asigna (o un técnico que "toma" la incidencia
   dentro de su vía y especialidad). Una incidencia de seguridad (P1) **notifica
   de inmediato** a todos los candidatos.
2. **ASIGNADA → EN_PROCESO:** el especialista la comienza. **Un especialista puede
   tener varias en proceso**, pero el sistema muestra primero las de mayor
   prioridad (no impone la regla de "una a la vez" de Vales: aquí hay incidencias
   en espera de repuestos mientras se atiende otra).
3. **Seguimiento:** el especialista publica avances en la línea de tiempo (texto +
   fotos). Cada avance puede marcarse como visible para quien reportó (por
   defecto sí) para que sepa cómo va.
4. **EN_PROCESO → RESUELTA (enviada a aprobación):** exige una **foto de
   evidencia** y una descripción de lo que se hizo.
5. **RESUELTA → CERRADA:** la aprueba el aprobador de la vía (5.3).
6. **RESUELTA → REABIERTA:** el aprobador devuelve con ajustes (**motivo
   obligatorio**); vuelve a quien la resolvió y cuenta en `reabierta_veces`.
7. **Cambio de equipo:** cuando la falla no es reparable, el especialista abre una
   **solicitud de compra** (`incidencia_compras`): cotización (PDF/foto, proveedor,
   monto) → aprobación (`incidencias.aprobar_compra`) → compra → recepción. **La
   incidencia no puede cerrarse hasta que el equipo llegue y quede instalado**.
   Cada paso queda en el historial. **[DECISIÓN]** ¿Quién aprueba la compra y hay
   un monto a partir del cual cambia el aprobador?
8. **Sin tiempo estimado ni vencimientos:** como se pidió, no hay SLA ni fecha
   límite. Sí hay **antigüedad** (días abiertas) como dato visible para ordenar y
   para el dashboard, sin generar alertas rojas por plazo.

---

## 7. Formulario de reporte (sugerencias)

Obligatorios según lo pedido: **imagen, descripción, tienda/ubicación y zona**.
Sugerencias para que el reporte llegue accionable y la prioridad salga bien:

| Campo | Tipo | Notas |
|---|---|---|
| **Ubicación** (tienda/edificio) | Selector con búsqueda | Lista de `tiendas`. Por defecto la tienda del usuario (`asesores.tienda_id`) si la tiene |
| **Zona** | Selector | Catálogo `incidencia_zonas` (Diseño, Sala de ventas, Gerencia, Bodega…), más "Otra" con texto |
| **Categoría** | Selector | Eléctrica, mobiliario, equipo, etc. Define a qué especialidad se enruta |
| **Activo afectado** | Selector (`tipos_activo`) + texto libre | "Impresora", "Sublimadora"… Fase 2: elegir el activo concreto por etiqueta/serie |
| **Título corto** | Texto (≤ 120) | Para la lista: "Tomacorriente con chispas, sala de ventas" |
| **Descripción** | Texto | Qué pasa, desde cuándo, qué se intentó |
| **¿Qué tanto afecta?** | 4 opciones con ejemplos | Riesgo para personas/ **Detiene la operación** / Trabaja con limitaciones / Molestia menor. Alimenta la prioridad |
| **Fotos** | 1 a 5 imágenes (obligatoria al menos 1) | Desde la cámara del celular; se optimizan y se valida el tamaño/tipo real |
| **Video corto** (opcional, fase 2) | | Útil para fallas intermitentes; requeriría ampliar tipos permitidos y revisar tamaño |
| **Reincidencia** | Aviso automático | Si ya hay una incidencia abierta o reciente del mismo activo/tienda, se muestra *"Parece que ya existe INC-000123"* para evitar duplicados |
| **Contacto en sitio** | Texto opcional | Quién puede dar acceso/explicar en la tienda (útil para técnicos y supervisores) |

Comportamiento: formulario **responsive pensado para celular** (se reporta de pie
frente al problema), botón único "Enviar", `idempotencyKey` para que un reintento
por mala señal no duplique la incidencia, y confirmación con el correlativo.

**Origen "supervisión":** el módulo de Supervisiones llama internamente al servicio
de incidencias con los mismos campos más `origen_ref_id`; la incidencia nace ya
ligada a la visita y a la tienda visitada (ver sección 11).

---

## 8. Sistema de prioridades

Objetivo explícito: que los técnicos sepan **qué atender primero** para perder el
menor tiempo operativo. Se propone una prioridad **calculada y explicable**, no
solo "alta/media/baja" a gusto de cada quien:

| Impacto declarado | Operación | Prioridad inicial |
|---|---|---|
| Riesgo para personas / seguridad (cable expuesto, chispas, fuga) | — | **P1 Crítica** (siempre) |
| Detiene la operación | No se puede trabajar | **P2 Alta** |
| Detiene la operación | Hay alternativa | **P3 Media** |
| Trabaja con limitaciones | — | **P3 Media** |
| Molestia menor | — | **P4 Baja** |

Ajustes:
- Quien **asigna** puede subir o bajar la prioridad con motivo (queda en historial).
- Una incidencia **reincidente** (misma tienda y activo, reabierta o repetida) sube
  un nivel.
- El orden de la bandeja es **prioridad → antigüedad** (la más vieja primero dentro
  de la misma prioridad). Eso evita que las P4 se queden olvidadas sin necesidad de
  un SLA.
- **[DECISIÓN]** ¿Una tienda cuya caja/impresora principal está caída debe ser
  siempre P2? (por ejemplo, "sublimadora única de la tienda").

La prioridad es **un campo del servidor**: el cliente solo envía el impacto; nunca
la prioridad directamente.

---

## 9. Dashboard de Gerencia (datos y estadísticas)

Pantalla de **solo lectura** (permiso `incidencias.ver_dashboard`), con el mismo
patrón de "Rendimiento" que ya existe en Vales, acotada por periodo y filtrable por
vía, tienda, categoría y país:

| Bloque | Indicadores |
|---|---|
| Panorama | Abiertas hoy · por estado · por prioridad · por vía (central / Trofex GT / C.A.) |
| Flujo | Reportadas vs cerradas por semana/mes (¿se acumula backlog?) |
| Tiempos (descriptivos, no SLA) | Tiempo mediano hasta asignar · hasta resolver · hasta cerrar · antigüedad de las abiertas |
| Calidad | % reabiertas (rechazadas al aprobar) · % duplicadas |
| Dónde duele | Tiendas y zonas con más incidencias · tipos de activo con más fallas · **activos reincidentes** |
| Carga | Abiertas por especialista/supervisor y su antigüedad (para repartir mejor) |
| Compras | Solicitudes de equipo: pendientes, aprobadas, monto cotizado vs comprado, tiempo de compra |
| Origen | Reportes espontáneos vs hallazgos de supervisión |

Notas de implementación: calcular con consultas agregadas en SQL (no cargando toda
la tabla; ver la deuda del buzón de Vales, SEG-20), índices por `estado_id`,
`via_resolucion`, `tienda_id`, `creado_en`; gráficos accesibles (no solo color) y
tabla alterna, según `reglas_disenoUI.md`.

---

## 10. Mejoras y cosas que conviene añadir

1. **Inventario de activos (fase 2):** `activos` (etiqueta/serie, tipo, tienda, fecha
   de compra, estado). Permite reincidencia exacta ("la impresora X lleva 5 fallas"),
   decidir con datos cuándo **conviene reemplazar** y alimentar la cotización.
   Para arrancar basta `tipos_activo` + texto libre.
2. **Aviso de duplicados** al reportar (sección 7).
3. **Notificaciones en tiempo real** con las salas de Socket.IO ya validadas:
   `incidencias:via:<via>` (bandeja), `incidencias:usuario:<id>` (lo mío) y
   `incidencia:<id>` (detalle abierto), con la misma validación servidor que Vales.
   Fase 2: **correo** o WhatsApp para P1 (requiere decisión de infraestructura; el
   hosting actual no obliga a ello).
4. **Comentarios internos vs visibles** para quien reportó (por si hay detalles de
   costo o de proveedores que no le corresponde ver).
5. **Reasignar con motivo** y **delegar** (vacaciones/ausencia del especialista).
6. **Evidencia de cierre obligatoria** (foto "después") para que la aprobación sea
   verificable.
7. **Plantillas por categoría** (por ejemplo, para "impresora" pedir modelo y
   mensaje de error), evitando reportes vagos.
8. **Mantenimiento preventivo (futuro):** crear incidencias programadas (cada N
   meses revisar AC, extintores) con el mismo ciclo.
9. **Más orígenes sin tocar el núcleo:** `origen = 'PRODUCCION'` para fallas de
   máquinas de producción de trofeos, usando `talleres` como ubicación en vez de
   `tiendas` (columna `ubicacion_tipo`), cuando se necesite.
10. **Exportes** (CSV/PDF) del listado y del dashboard para reuniones.
11. **Modo móvil real:** tarjetas en lugar de tablas bajo 640 px (como ya hace
    Vales), cámara directa, subida resistente a mala señal.

---

## 11. Integración con el módulo de Supervisiones

El módulo de supervisiones (en desarrollo) registra hallazgos dentro de sus
formularios de visita. Contrato propuesto, **sin acoplar los módulos**:

- Supervisiones llama a un **servicio interno**
  `incidenciaService.crearDesdeSupervision(usuario, datos, { tx })` (no por HTTP):
  ambos viven en el mismo monolito, y así la creación de la incidencia y el guardado
  del formulario ocurren en **la misma transacción** (`db.transaction`): si falla
  uno, no queda el otro a medias.
- Datos mínimos: `tienda_id`, `zona`, `categoria`/`tipo_activo`, descripción, fotos,
  `impacto`, y `origen_ref_id` = id de la supervisión.
- Idempotente por `(origen, origen_ref_id, hallazgo)` para que reenviar el
  formulario no duplique hallazgos.
- Supervisiones **solo ve el resumen y estado** de las incidencias que generó (un
  enlace a Incidencias); la gestión vive en Incidencias.
- En la siguiente visita, el formulario precarga las **incidencias abiertas de esa
  tienda** para que el supervisor las revise, agregue avance o las verifique/cierre
  (opción 1 de la sección 5.3).
- Dependencia del orden de construcción: Incidencias debe existir **antes** de que
  Supervisiones pueda crear hallazgos, o Supervisiones arranca guardando hallazgos
  como borrador local y los envía cuando el módulo esté listo.

---

## 12. Plan de implementación en este sistema

### 12.1 Estructura (según `reglas_modulo.md`)

```
src/modules/incidencias/
  routes.js
  events.js                      -- salas Socket.IO + validador de sala (como vales/events.js)
  controllers/incidenciaController.js, dashboardController.js
  services/
    incidenciaCreacionService.js     -- crear, vía de resolución, prioridad, duplicados
    incidenciaFlujoService.js        -- máquina de estados (asignar, comenzar, resolver, aprobar, reabrir)
    incidenciaCompraService.js       -- cotización → aprobación → compra → recepción
    incidenciaSeguimientoService.js  -- línea de tiempo
    incidenciaConsultaService.js     -- bandejas y detalle con autorización por registro
    incidenciaDashboardService.js    -- agregados para Gerencia
    incidenciaHelpers.js             -- constantes (ESTADO, VIA…), permisos por registro
  repositories/                      -- todo el SQL, con db.query(sql, params, tag)
public/modules/incidencias/
  index.html, css/styles.css, js/app.js (módulos ES, como vales)
```

Montaje en `src/app.js` (patrón del sistema): `/api/incidencias` con `requireAuth`;
agregar la entrada al arreglo `catalog` de `/api/modules` (permiso `incidencias.ver`);
`router.use(protegerRespuestas)` (tras generalizarlo, sección 2.3); y registrar el
validador de salas en `socketManager`.

### 12.2 Seguridad (obligatoria, ya resuelta en fases previas)

- Permisos por ruta **y** propiedad por registro (404 para no revelar existencia).
- Validación de entrada con `validar.js` (tipos, largos, ids con `idObligatorio`);
  la vía de resolución y la prioridad **se calculan en el servidor**.
- Subidas: límites de `multer`, tipo real por magic bytes, tope de píxeles, PDFs
  ≤ 5 páginas, nombres aleatorios, bucket privado con referencias firmadas.
- `idempotencyKey` en crear incidencia y en enviar a aprobación.
- Cada cambio de estado en **transacción** + `incidencia_historial` + `auditoria`
  (acciones nuevas en `ACCIONES`: `INCIDENCIA_CREADA`, `_ASIGNADA`, `_RESUELTA`,
  `_APROBADA`, `_REABIERTA`, `_COMPRA_APROBADA`, …).
- Límite de reportes por usuario (por ejemplo, 30/día) para evitar abuso/ruido.
- Sin scripts en línea (CSP), textos escapados, enlaces con `urlSegura`.

### 12.3 Fases de entrega sugeridas

| Fase | Contenido | Resultado visible |
|---|---|---|
| **1 — Núcleo (sede central)** | Catálogos, tablas, reportar con foto, vía `CENTRAL_GT`, asignar/trabajar/resolver/aprobar, historial, bandejas, permisos y roles nuevos, notificaciones en tiempo real | La sede central ya gestiona incidencias de punta a punta |
| **2 — Tiendas** | Vías `TIENDAS_GT`/`TIENDAS_CA`, jurisdicción por `supervisor_tiendas`, integración con Supervisiones, verificación en visita | Los supervisores gestionan las de sus tiendas |
| **3 — Compras** | Flujo de cambio de equipo (cotización, aprobación, compra, recepción) | Las incidencias que requieren equipo se cierran con trazabilidad |
| **4 — Dashboard de Gerencia** | Indicadores de la sección 9 | Datos y estadísticas para el Gerente |
| **5 — Mejoras** | Inventario de activos, correo/WhatsApp, preventivos, exportes | |

Cada fase se construye en su rama, con scripts de prueba en `scripts/security/` o
`scripts/` (base desechable, nunca la de desarrollo con datos reales), igual que el
plan de seguridad, y se documenta como correcciones numeradas.

### 12.4 Pruebas mínimas por fase

Ciclo completo por cada vía con cuentas reales de prueba; pruebas de **IDOR**
(otro usuario/otra tienda no ve ni opera la incidencia); quien resuelve no aprueba;
transiciones inválidas rechazadas; idempotencia; archivos (tipo falso, imagen
enorme, PDF de 6 páginas); sockets (solo salas autorizadas); móvil (390 px).

---

## 13. Riesgos y puntos de atención

1. **Datos de jurisdicción incompletos:** si un supervisor no tiene la tienda en
   `supervisor_tiendas`, las incidencias de esa tienda quedan sin responsable. Hay
   que cargar esas asignaciones antes de la fase 2 y mostrar una alerta de
   "incidencias sin responsable".
2. **Una persona con todos los permisos** (p. ej. un supervisor que resuelve y
   aprueba): el diseño exige aprobador alterno para respetar la separación de
   funciones (5.3).
3. **Crecimiento de archivos en el bucket** (fotos): aplicar el optimizador y, más
   adelante, una política de retención para incidencias cerradas hace más de N años.
4. **Dependencia de Supervisiones:** el módulo hermano aún no existe; el contrato
   (sección 11) debe acordarse con quien lo construye.
5. **Prioridad percibida:** si todos marcan "detiene la operación" para ser
   atendidos primero, la prioridad pierde sentido; el control es la revisión de
   quien asigna y las estadísticas por tienda del dashboard.

---


## 14. Decisiones que necesitamos del negocio

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | Tiendas de C.A.: ¿son las "Premia …" que ya están en la base, y las cubren supervisores de C.A.? | Confirmar; el diseño no cambia, solo los datos |
| 2 | ¿Los supervisores de Trofex son los mismos "Supervisor de Ventas" (rol 3) de Vales o un grupo distinto? | Si son distintos, rol aparte "Supervisor de Tiendas" |
| 3 | En tiendas, ¿quién aprueba el cierre si el supervisor ya resolvió? | Verificación en la siguiente visita (5.3, opción 1) |
| 4 | ¿Quién aprueba la compra de un equipo? ¿hay monto límite? | Gerencia; segunda firma sobre un monto |
| 5 | ¿Existe la figura "Encargado de Mantenimiento" o asigna la Asistente de Gerencia? | Depende del volumen; el permiso `incidencias.asignar` sirve para ambos |
| 6 | ¿Se requiere correo/WhatsApp para P1 o basta tiempo real en el portal? | Empezar con tiempo real |
| 7 | ¿Las incidencias de producción de trofeos entrarán pronto? | Dejar `origen` y ubicación genérica listos, construir después |
| 8 | ¿Se llevará inventario de activos (serie/etiqueta)? | Sí, como fase 2, por el valor de la reincidencia |
| 9 | Lista inicial de categorías, zonas y especialidades | Proponerla desde la operación real y cargarla en `seed.sql` |
