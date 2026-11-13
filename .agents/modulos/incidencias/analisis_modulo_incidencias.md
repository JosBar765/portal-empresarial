# Análisis del Módulo de Incidencias

> Este documento traduce la idea general recibida del usuario en una
> especificación completa, lista para planificar la implementación siguiendo
> `.agents/reglas/reglas_modulo.md` (estructura de módulo) y
> `.agents/reglas/reglas_autenticacion.md` (RBAC/JWT). Es el equivalente, para
> este módulo, de `.agents/modulos/vales de arte/analisis_modulo.md`: define
> actores, flujo de estados, formularios, reglas, esquema de base de datos
> propuesto y permisos. Nada de esto está implementado todavía — es la base
> para discutir y luego construir.

## 0. Idea original (resumen)

El usuario planteó un módulo para que cualquier empleado reporte incidencias
físicas (equipo, maquinaria, electricidad, mobiliario, etc.) con fotografía y
descripción, que esas incidencias se asignen a personal especializado para
resolverlas, y que exista una verificación final de que el trabajo quedó
hecho. Puntos explícitos a respetar:

1. Responsive de verdad (PC y móvil) — se reporta y se trabaja desde el celular en el piso de venta/bodega, no solo desde escritorio.
2. Reporte = fotografía + descripción de la falla.
3. Debe existir un catálogo de usuarios con **especialidades**, para asignar con criterio.
4. Debe existir **seguimiento** del proceso para que ninguna incidencia se quede estancada.
5. Existen **tipos de usuario con permisos distintos** dentro del módulo.
6. La **verificación** la hace quien tenga el permiso correspondiente, y **el administrador decide quién tiene ese permiso** — no es un rol fijo en el código.

El punto 6 es la decisión de diseño más importante del documento: en vez de
codificar "el supervisor verifica" o "el que reportó verifica", la
verificación se modela como un permiso (`incidencias.verificar`) que el
administrador asigna a cualquier rol desde la pestaña **Roles y Permisos** que
ya existe en Administración — exactamente el mismo patrón de RBAC que ya usa
el resto del sistema (`reglas_autenticacion.md` §1.3). El módulo no debe
asumir en el código quién verifica.

---

## 1. Filosofía de permisos (nada de roles nuevos obligatorios en el código)

Siguiendo el modelo ya existente (`permisos` + `rol_permisos`, tabla genérica,
sin lógica de rol hardcodeada salvo el bypass de Administrador), el módulo
introduce permisos nuevos, todos con prefijo `incidencias.`:

| Código | Qué habilita | A quién se le sugiere de entrada |
|---|---|---|
| `incidencias.reportar` | Ver el botón "Reportar incidencia" y crear reportes propios | **Todos los roles activos** — es la puerta de entrada transversal del módulo, como pide el punto 1 de la idea original |
| `incidencias.ver` | Ver el módulo en el dashboard y la vista "Mis incidencias reportadas" | Igual que `reportar` (van de la mano) |
| `incidencias.asignar` | Ver la bandeja de incidencias sin asignar, asignarlas/reasignarlas a un especialista, descartar duplicados | Rol nuevo sugerido "Encargado de Mantenimiento" (ver §2) |
| `incidencias.trabajar` | Ver "Mis incidencias asignadas", marcar en proceso / resuelta | Rol nuevo sugerido "Técnico de Mantenimiento" — pero **no exclusivo**: cualquier usuario con una especialidad cargada puede recibir este permiso, incluido un técnico de Diseño que también sepa de electricidad |
| `incidencias.verificar` | Ver la bandeja de verificación, aprobar el cierre o rechazar y reabrir | **Decisión abierta del administrador** — puede dárselo al mismo rol que asigna, a Gerente, a Supervisor de tienda, o a quien reportó (ver §7) |
| `incidencias.ver_todas` | Ver el dashboard global (todas las tiendas, todas las especialidades) en vez de solo lo propio | Gerente, Administrador |
| `incidencias.gestionar_catalogos` | CRUD del catálogo de especialidades y de niveles de prioridad/SLA (§3 y §8) | Administrador |

Administrador (`rolId === 1`) sigue el mismo patrón ya documentado en
`CLAUDE.md` para Vales: el bypass de lógica de negocio existe en el
service, pero la puerta real es `requirePermission` a nivel de ruta — si se
quiere que Administrador pueda operar el módulo sin restricciones, su fila en
`rol_permisos` debe incluir explícitamente los códigos que necesite, igual
que se decidió (deliberadamente) recortar para Vales.

**No se crean roles nuevos en el código.** `roles` es una tabla de datos que
ya se administra desde la pestaña **Gestionar Usuarios/Roles** de
Administración (ver `reglas_modulo.md` — ningún módulo debe hardcodear
nombres de rol). Los dos roles sugeridos abajo son solo un punto de partida
razonable para el seed, no un requisito estructural:

- **Encargado de Mantenimiento** → `incidencias.asignar` (+ opcionalmente `incidencias.verificar`, si el administrador decide que el mismo encargado cierra el ciclo).
- **Técnico de Mantenimiento** → `incidencias.trabajar` + al menos una especialidad cargada.

---

## 2. Especialidades: catálogo propio, independiente del rol

A diferencia de los talleres de Vales de Arte (donde el técnico pertenece a
**un** taller vía `taller_tecnicos`), aquí un mismo usuario puede tener
**varias especialidades** (ej. un técnico que sabe de electricidad y de
plomería), y su especialidad **no depende de su rol principal** en el
sistema — un Técnico de Diseño (rol de Vales de Arte) podría también estar
cargado como especialista en carpintería para este módulo, sin que eso
cambie su rol.

Por eso las especialidades se modelan como catálogo propio + relación N:M con
`usuarios`, no como una columna de rol ni una reutilización de `talleres`:

- `especialidades`: catálogo editable por el administrador (`incidencias.gestionar_catalogos`). Ejemplos de seed: Electricidad, Plomería/Fontanería, Climatización (A/C), Mobiliario y Carpintería, Cerrajería, Sistemas/TI y Redes, Pintura y Acabados, Estructura y Techos, Refrigeración.
- `usuario_especialidades`: un usuario activo puede tener 0, 1 o varias especialidades. 0 especialidades = no es elegible para que le asignen incidencias, aunque tenga el permiso `incidencias.trabajar` (evita asignaciones "a ciegas").
- Al reportar, el reportante elige la especialidad que **cree** que aplica (dropdown del catálogo) — es una ayuda para priorizar la bandeja de asignación, no un candado: quien asigna puede corregirla si el reportante se equivocó de categoría.
- La bandeja de asignación se puede filtrar por especialidad, y el selector de "asignar a…" solo lista usuarios activos que tengan esa especialidad cargada (mismo criterio de elegibilidad que ya usa el sistema para encargados/técnicos de taller: activo + rol/atributo correcto + permiso correspondiente).

---

## 3. Flujo / máquina de estados

```text
REPORTADA ──(se asigna)──▶ ASIGNADA ──(el especialista comienza)──▶ EN_PROCESO
                                                                        │
                                                          (marca resuelta, sube evidencia)
                                                                        ▼
                                                                    RESUELTA
                                                                        │
                                                      ┌─────────────────┴─────────────────┐
                                                      │                                   │
                                              (se verifica)                      (se rechaza el cierre)
                                                      ▼                                   ▼
                                                 VERIFICADA                           ASIGNADA
                                                (estado final)                (misma persona u otra, con
                                                                               motivo de rechazo obligatorio)

REPORTADA ──(duplicada / no aplica / no se va a atender)──▶ DESCARTADA (estado final)
```

Reglas del flujo:

- **`REPORTADA`**: recién creada, en la bandeja de asignación. Quien tiene `incidencias.asignar` puede asignarla (→ `ASIGNADA`) o descartarla (→ `DESCARTADA`, requiere un motivo corto, ej. "duplicada de INC-…", "no es una incidencia real").
- **`ASIGNADA`**: tiene un especialista responsable, pero aún no la ha empezado a trabajar. Puede reasignarse a otra persona sin cambiar de estado (igual que Vales permite reasignar sin salir de `ASIGNADO`).
- **`EN_PROCESO`**: el especialista la marcó como iniciada. A diferencia de la regla de Vales ("un técnico solo puede tener un vale en proceso a la vez"), aquí **se permite trabajar varias incidencias en paralelo**: una reparación física de mantenimiento normalmente implica tiempos muertos (esperar que se seque pintura, esperar un repuesto) durante los cuales el mismo especialista puede atender otra incidencia menor. La carga de trabajo se muestra como métrica (ver §9), no como bloqueo duro.
- **`RESUELTA`**: el especialista terminó y adjuntó evidencia (foto del "después" + comentario de qué hizo). Entra a la bandeja de quien tenga `incidencias.verificar`.
- **`VERIFICADA`**: estado final. Quien verifica confirmó, con la evidencia, que el problema quedó resuelto.
- **Rechazo de verificación**: si la evidencia no convence, quien verifica la regresa a `ASIGNADA` (no a `EN_PROCESO`, para forzar que alguien la tome explícitamente otra vez, igual que el "desaprobar" de Vales) con un comentario obligatorio de qué falta. Se cuenta cuántas veces fue rechazada (`veces_rechazada`) para detectar incidencias problemáticas.
- **`DESCARTADA`**: solo alcanzable desde `REPORTADA`, antes de asignar. Una vez asignada, ya no se puede "borrar" el reporte, solo seguir el flujo normal — esto preserva trazabilidad real de mantenimiento.
- No existe estado de "pausa": si un especialista se queda esperando un repuesto o una cotización, se refleja con el campo informativo `en_espera_de` (texto corto, ej. "repuesto en pedido") sobre el registro **sin cambiar de estado** — el mismo principio que ya usa el sistema con el atraso de Vales ("es una condición, no un estado"). Esto evita inflar la máquina de estados y mantiene el seguimiento honesto: la incidencia sigue contando como `EN_PROCESO` y sigue corriendo su SLA.

---

## 4. Formulario de reporte

### Campos

- **Reportante**: se obtiene del JWT (`req.user`), igual que el asesor en Vales — nunca se confía en `req.body` para saber quién reporta.
- **Tienda/ubicación**: `tienda_id` (selector, precargado si el usuario tiene una tienda asociada, ej. un asesor) + campo libre **Zona/área** (texto corto, ej. "Bodega", "Baño de empleados", "Área de cajas") porque `tiendas` no modela ubicaciones internas y no vale la pena crear un catálogo de zonas por tienda para esto.
- **Especialidad sugerida**: selector del catálogo de §2 (ayuda a priorizar, no es vinculante).
- **Prioridad/severidad**: selector con 4 niveles (ver §8) — el reportante propone, quien asigna puede subirla o bajarla (ej. alguien reporta "Media" un cable pelado y quien asigna la sube a "Crítica").
- **Descripción**: texto libre, obligatorio, límite razonable (ej. 500 caracteres, igual de orden de magnitud que la descripción de Vales).
- **Fotografías**: 1 a 5 imágenes, obligatorio al menos 1 (a diferencia de Vales, donde las imágenes son opcionales — aquí la evidencia visual es el corazón del reporte). Mismas restricciones que ya aplica el sistema: formatos jpg/jpeg/png/webp, máximo 2 MB por imagen, optimizadas al subir (`src/core/files/imageOptimizer.js`, ya existente, reutilizable tal cual).
- **Equipo/activo afectado** (opcional, texto libre): ej. "Aire acondicionado sala de ventas", "Silla de recepción" — no existe un módulo de inventario de activos, así que es texto libre y no una relación a catálogo.

### Reglas

- El formulario debe funcionar bien desde el navegador móvil: el input de fotos debe aceptar `capture="environment"` para abrir la cámara trasera directamente, no solo la galería.
- Las fotos se optimizan y suben con el mismo patrón ya usado en Vales: `subirYRegistrarArchivo` (Storage-then-DB con rollback), a Supabase Storage, guardando solo la URL pública en la tabla `incidencia_fotos` — la base de datos nunca almacena binarios.
- El endpoint de creación acepta `idempotencyKey` igual que los 3 endpoints de Vales que combinan subida de archivo + escritura en BD, contra la tabla genérica `idempotency_keys` que ya existe — un reintento de red por mala señal en el piso de venta no debe duplicar el reporte.
- Al crear, el sistema genera un correlativo legible, ej. `INC-{CODIGO_TIENDA}-{ID}` (mismo espíritu que el correlativo de Vales), útil para referenciarlo hablando por radio/WhatsApp con el técnico.

---

## 5. Asignación

- Bandeja de `incidencias.asignar`: lista las incidencias en `REPORTADA`, filtrable por tienda y por especialidad, ordenada por prioridad y antigüedad (las más viejas y más urgentes primero — mismo criterio de jerarquía + cercanía a vencimiento que ya usa Vales).
- Al asignar, el selector de especialista solo ofrece usuarios activos con la especialidad requerida cargada (§2) — igual de estricto que la validación de encargados/técnicos elegibles en Talleres (`adminService.js`), para no poder asignarle una incidencia eléctrica a alguien sin esa especialidad por error de UI (la validación real vive en el backend, la UI solo evita ofrecer opciones que el servidor rechazaría, mismo principio que `tallerForm.js`).
- Reasignar (incidencia ya `ASIGNADA` o devuelta desde `VERIFICADA`→rechazo) usa el mismo modal/acción, sin volver a `REPORTADA`.
- Descartar (solo desde `REPORTADA`) exige motivo, queda en el historial, y el reportante debería verlo reflejado en su vista "Mis incidencias reportadas" con el motivo visible.

---

## 6. Trabajo del especialista

- Bandeja "Mis incidencias asignadas": lo que tiene en `ASIGNADA` y `EN_PROCESO`, ordenado igual (urgencia + antigüedad).
- **Comenzar**: `ASIGNADA` → `EN_PROCESO`. A diferencia de Vales, no bloquea otras incidencias (ver §3).
- **Resolver**: `EN_PROCESO` → `RESUELTA`. Requiere comentario de qué se hizo y al menos una foto del resultado (evidencia del "después"); igual que en el reporte, `idempotencyKey` contra reintentos.
- **No puedo resolverla / no es de mi especialidad**: devuelve la incidencia a `REPORTADA` con un comentario (ej. "es de electricidad, no de plomería") para que quien asigna la reasigne o corrija la especialidad — evita que quede atrapada en el buzón de una persona que no puede avanzarla.

---

## 7. Verificación (permiso, no rol fijo)

- Bandeja de `incidencias.verificar`: lista lo que está en `RESUELTA`.
- Al abrir una incidencia se ven, lado a lado, las fotos del "antes" (reporte) y del "después" (resolución) más el comentario del especialista — la decisión de verificar/rechazar debe poder tomarse sin salir del modal.
- **Verificar**: `RESUELTA` → `VERIFICADA` (final). Debe registrar quién verificó y cuándo.
- **Rechazar**: `RESUELTA` → `ASIGNADA`, con comentario obligatorio, incrementa `veces_rechazada`.
- Como se explicó en §0/§1, el administrador decide libremente a quién darle `incidencias.verificar`: puede coincidir con quien asigna (control centralizado en un encargado de mantenimiento), puede dárselo a Gerente/Supervisor de tienda (control gerencial), o incluso al mismo rol que reporta (para que el que reportó el problema confirme que realmente se solucionó desde su propia tienda) — el módulo no debe asumir ninguno de estos casos en el código, solo verificar el permiso en la ruta, exactamente como ya hace `requirePermission`.

---

## 8. Seguimiento y SLA ("que no se deje pasar el tiempo")

Este es el punto 4 de la idea original, y merece un mecanismo explícito
además del orden de la bandeja:

- Catálogo `incidencia_prioridades` (editable por `incidencias.gestionar_catalogos`, mismo espíritu que el límite diario editable de Talleres): cada nivel de prioridad define un **plazo objetivo en horas** para llegar a `VERIFICADA`. Sugerido de arranque:

  | Prioridad | Plazo objetivo sugerido | Ejemplo |
  |---|---|---|
  | Baja | 120 h (5 días hábiles) | Rayón en mobiliario, detalle estético |
  | Media | 48 h | Foco fundido, llave de agua goteando |
  | Alta | 24 h | Aire acondicionado dañado en temporada alta |
  | Crítica | 4 h | Cable eléctrico expuesto, riesgo de seguridad |

- **Atraso como condición, no estado** (mismo principio ya establecido en Vales): se calcula en vivo comparando `creado_en` + plazo de la prioridad contra la hora actual, mientras la incidencia no esté en `VERIFICADA`/`DESCARTADA`; una vez cerrada, el atraso queda congelado al momento del cierre. Se muestra en la tabla como badge de color (verde = a tiempo, ámbar = por vencer, rojo = atrasada), reutilizando los tokens de estado ya definidos en `global.css` (`--color-success`, `--color-warning`, `--color-danger`).
- **Alerta de estancamiento**: además del plazo total, se guarda `ultima_actividad_en` (se actualiza en cada cambio de estado o comentario). Si una incidencia lleva más de X horas sin ningún movimiento (config, ej. 24h) **independientemente de su prioridad**, se resalta aparte — esto cubre el caso puntual que menciona la idea original ("que no se deje pasar el tiempo entre incidencias"): una incidencia de baja prioridad con plazo de 5 días igual puede quedar "olvidada" sin que nadie la toque en ese tiempo, y el estancamiento lo detecta.
- El dashboard de Gerencia/Administrador (§10) muestra tiempo promedio de resolución por especialidad y por tienda, y el conteo de incidencias atrasadas/estancadas — para poder ver, con datos, si una especialidad o una tienda tiene un cuello de botella.

---

## 9. Tiempo real (Socket.IO)

Siguiendo el mismo patrón transversal que ya describe `reglas_modulo.md` y
que usa Vales (`socketManager.sendToModule`), pero con salas más finas porque
aquí sí importa que solo el especialista correcto se entere de inmediato:

- Sala general `incidencias:asignadores` — todos con `incidencias.asignar`, para nuevas incidencias `REPORTADA`.
- Sala `especialidad:{id}` — especialistas con esa especialidad cargada, opcionalmente usada para avisar "hay una incidencia nueva que podría ser tuya" antes incluso de que se asigne formalmente (ej. mostrarla como sugerida).
- Sala `usuario:{id}` (o reutilizar el patrón `taller:{id}`/`asesor:{id}` de Vales) — el especialista se entera al instante de que le asignaron o reasignaron algo.
- Sala `incidencias:verificadores` — todos con `incidencias.verificar`, para incidencias que pasan a `RESUELTA`.
- Un evento genérico `incidencia_evento` (mismo nombre de patrón que `vale_evento`) al que cada vista reacciona refrescando su bandeja — más simple y robusto que mantener contadores en el cliente, tal como ya se decidió para Vales.
- Toast + sonido de notificación en cada bandeja relevante, igual que Vales.

---

## 10. Vistas por rol/actor

| Quién | Vista principal | Contenido |
|---|---|---|
| Cualquiera con `incidencias.reportar` | "Mis incidencias reportadas" | Botón "Reportar incidencia" + tabla/tarjetas de lo que ha reportado, con estado y atraso visibles |
| `incidencias.asignar` | Bandeja de asignación | Incidencias `REPORTADA`, filtros por tienda/especialidad/prioridad, acción asignar/descartar, widget de carga de trabajo por especialista (mismo concepto que el botón "Carga de trabajo" de Vales) |
| `incidencias.trabajar` | "Mis incidencias asignadas" | Lo que tiene en `ASIGNADA`/`EN_PROCESO`, acciones comenzar/resolver/devolver |
| `incidencias.verificar` | Bandeja de verificación | Incidencias `RESUELTA`, comparación antes/después, acciones verificar/rechazar |
| `incidencias.ver_todas` (Gerente/Administrador) | Dashboard | KPIs: total por estado, por tienda, por especialidad, tiempo promedio de resolución, % atrasadas, incidencias estancadas — mismo espíritu que el dashboard de Gerencia de Vales |
| `incidencias.gestionar_catalogos` (Administrador) | Gestión del módulo | CRUD de especialidades, asignación de especialidades a usuarios, edición de niveles de prioridad/SLA |

Una misma persona puede acumular varias de estas vistas a la vez si su rol
tiene varios permisos (ej. el "Encargado de Mantenimiento" sugerido en §1
vería tanto la bandeja de asignación como, si se le da el permiso, la de
verificación) — el sidebar del módulo debe mostrar solo las pestañas para las
que el usuario realmente tiene permiso, mismo patrón que ya usa Vales
(`layout/sidebar.js`, configuración declarativa por permisos, no por rol
fijo).

---

## 11. Modelo de datos propuesto

Sigue la convención de `database/schema.sql`: `InnoDB`,
`utf8mb4_unicode_ci`, FKs explícitas, catálogos como tablas separadas en vez
de `ENUM` cuando son editables por el administrador (mismo criterio que
`estados_vale`/`tipos_documento`).

```sql
CREATE TABLE IF NOT EXISTS `especialidades` (
  `id`      INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`  VARCHAR(100) NOT NULL UNIQUE,
  `activo`  TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `usuario_especialidades` (
  `usuario_id`      INT NOT NULL,
  `especialidad_id` INT NOT NULL,
  PRIMARY KEY (`usuario_id`, `especialidad_id`),
  FOREIGN KEY (`usuario_id`)      REFERENCES `usuarios`      (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`especialidad_id`) REFERENCES `especialidades` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `incidencia_prioridades` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`          VARCHAR(50) NOT NULL UNIQUE,   -- Baja / Media / Alta / Crítica
  `plazo_horas`     INT NOT NULL,
  `orden`           INT NOT NULL DEFAULT 0          -- para ordenar la bandeja sin depender del id
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estados_incidencia` (
  `id`     INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(50) NOT NULL UNIQUE  -- REPORTADA, ASIGNADA, EN_PROCESO, RESUELTA, VERIFICADA, DESCARTADA
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `incidencias` (
  `id`                  INT AUTO_INCREMENT PRIMARY KEY,
  `correlativo`         VARCHAR(50) NOT NULL UNIQUE,     -- INC-{TIENDA}-{id}
  `reportado_por`       INT NOT NULL,
  `tienda_id`           INT NOT NULL,
  `zona`                VARCHAR(150) DEFAULT NULL,
  `equipo_afectado`     VARCHAR(150) DEFAULT NULL,
  `especialidad_id`     INT NOT NULL,                    -- sugerida al reportar; corregible al asignar
  `prioridad_id`        INT NOT NULL,
  `descripcion`         VARCHAR(600) NOT NULL,
  `estado_id`           INT NOT NULL,
  `asignado_a`          INT DEFAULT NULL,
  `asignado_en`         DATETIME DEFAULT NULL,
  `en_espera_de`        VARCHAR(150) DEFAULT NULL,        -- condición informativa, no cambia el estado (§3)
  `comentario_resolucion` VARCHAR(600) DEFAULT NULL,
  `resuelto_en`         DATETIME DEFAULT NULL,
  `verificado_por`      INT DEFAULT NULL,
  `verificado_en`       DATETIME DEFAULT NULL,
  `veces_rechazada`     INT NOT NULL DEFAULT 0,
  `ultima_actividad_en` DATETIME NOT NULL,
  `creado_en`           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`reportado_por`)   REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`tienda_id`)       REFERENCES `tiendas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`especialidad_id`) REFERENCES `especialidades` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`prioridad_id`)    REFERENCES `incidencia_prioridades` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`estado_id`)       REFERENCES `estados_incidencia` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`asignado_a`)      REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`verificado_por`)  REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_incidencias_estado` (`estado_id`),
  INDEX `idx_incidencias_asignado` (`asignado_a`),
  INDEX `idx_incidencias_tienda` (`tienda_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `incidencia_fotos` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `incidencia_id`   INT NOT NULL,
  `etapa`           ENUM('REPORTE','RESOLUCION') NOT NULL,
  `ruta`            VARCHAR(500) NOT NULL,         -- URL pública de Supabase Storage
  `subido_por`      INT NOT NULL,
  `creado_en`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`incidencia_id`) REFERENCES `incidencias` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`subido_por`)    REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_fotos_incidencia` (`incidencia_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `incidencia_historial` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `incidencia_id`   INT NOT NULL,
  `usuario_id`      INT NOT NULL,
  `estado_anterior` VARCHAR(50) DEFAULT NULL,
  `estado_nuevo`    VARCHAR(50) NOT NULL,
  `comentario`      VARCHAR(600) DEFAULT NULL,     -- motivo de descarte/rechazo, comentario de resolución, etc.
  `creado_en`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`incidencia_id`) REFERENCES `incidencias` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`usuario_id`)    REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_inc_historial_incidencia` (`incidencia_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Reutilización deliberada de infraestructura ya existente (no reinventar):

- `idempotency_keys` (genérica) para creación y resolución con adjuntos.
- `src/core/files/subirYRegistrarArchivo.js` + `supabaseStorage.js` +
  `imageOptimizer.js`, tal cual, para las fotos.
- `socketManager.sendToModule` para el tiempo real.
- El patrón `*_historial` (idéntico a `vale_historial`) para trazabilidad
  visual de cambios de estado, que la idea original pide explícitamente
  ("seguimiento en el proceso").

---

## 12. Permisos a agregar en `database/seed.sql`

```sql
INSERT INTO permisos (codigo, nombre, modulo, descripcion) VALUES
  ('incidencias.reportar',            'Reportar incidencia',            'incidencias', 'Crear reportes de incidencias con foto y descripción'),
  ('incidencias.ver',                 'Ver incidencias propias',        'incidencias', 'Ver el módulo y las incidencias reportadas por el usuario'),
  ('incidencias.asignar',             'Asignar incidencias',            'incidencias', 'Asignar/reasignar incidencias a especialistas, descartar duplicados'),
  ('incidencias.trabajar',            'Trabajar incidencias asignadas', 'incidencias', 'Marcar en proceso y resolver incidencias asignadas'),
  ('incidencias.verificar',           'Verificar incidencias resueltas','incidencias', 'Aprobar o rechazar el cierre de una incidencia resuelta'),
  ('incidencias.ver_todas',           'Ver todas las incidencias',      'incidencias', 'Ver el dashboard global, sin restringir por tienda propia'),
  ('incidencias.gestionar_catalogos', 'Gestionar catálogos',            'incidencias', 'Administrar especialidades, prioridades y SLA del módulo');
```

Asignación sugerida a `rol_permisos` de arranque (ajustable después desde la
UI de Roles y Permisos, sin volver a tocar código):

- Todos los roles activos existentes → `incidencias.reportar` + `incidencias.ver`.
- Gerente → + `incidencias.ver_todas`.
- Administrador → todos los códigos (siguiendo el mismo criterio ya usado: si se decide recortarlo como se hizo con Vales, dejarlo documentado como gap aceptado, no como bug).
- Los dos roles nuevos sugeridos en §1 (si se crean como datos vía la UI, no en código): Encargado de Mantenimiento → `incidencias.asignar`; Técnico de Mantenimiento → `incidencias.trabajar`. `incidencias.verificar` se deja **sin asignar** hasta que el administrador decida a quién dárselo — es, otra vez, la decisión central del módulo.

---

## 13. Registro del módulo (catálogo del dashboard)

Entrada sugerida para el array `catalog` de `/api/modules` en `src/app.js`,
siguiendo `reglas_modulo.md` al pie de la letra:

```javascript
{
  id: 'incidencias',
  nombre: 'Incidencias',
  descripcion: 'Reporta y da seguimiento a incidencias físicas de equipo, maquinaria e instalaciones.',
  icono: 'construct-outline',
  path: '/modules/incidencias',
  permission: 'incidencias.ver',
  color: '#B45309'
}
```

(`#B45309` es solo una sugerencia de acento cálido/ámbar, distinto de los
colores ya usados por Vales `#3B4C8C` y Admin `#52525B` — fácil de cambiar,
no es un token de `global.css` nuevo, se usa tal cual permite el patrón ya
existente de "color por módulo" en el catálogo.)

Estructura de carpetas (backend y frontend) idéntica a la ya usada por Vales,
por `reglas_modulo.md`:

```text
src/modules/incidencias/
├── controllers/incidenciaController.js
├── services/incidenciaService.js       # dueño de la máquina de estados y reglas de negocio
├── repositories/incidenciaRepository.js
├── repositories/especialidadRepository.js
├── routes.js
└── events.js

public/modules/incidencias/
├── index.html
├── css/styles.css     # @import 'global.css', sin colores propios sueltos
└── js/
    ├── app.js
    ├── views/          # bandeja-reportante.js, bandeja-asignacion.js, bandeja-trabajo.js, bandeja-verificacion.js, dashboard.js
    ├── forms/          # reportarIncidencia.js
    ├── actions/        # asignar.js, comenzar.js, resolver.js, verificar.js
    └── api/incidenciasApi.js
```

---

## 14. Consideraciones de UI/UX (mobile-first real)

- El caso de uso más frecuente es reportar **desde el celular, parado frente
  al problema**: el formulario de reporte debe caber sin scroll excesivo en
  una pantalla de teléfono, con el campo de foto arriba de todo (no al
  final) y el botón de cámara grande y fácil de tocar.
- Tabla de bandejas → tarjetas apiladas en `<640px`, mismo patrón responsive
  que ya usa Vales (`data-label` en cada `<td>`, con `::before` para el
  breakpoint móvil) — no reinventar el mecanismo.
- Miniaturas de fotos con lightbox simple (clic para ampliar), tanto en el
  detalle de la incidencia como en la comparación antes/después de
  verificación.
- Badges de prioridad y de atraso reutilizan los tokens semánticos ya
  definidos (`--color-success/-warning/-danger`), nunca hexadecimales
  sueltos, por `reglas_disenoUI.md`.
- Accesos rápidos: en el header del módulo, el botón "Reportar incidencia"
  debe ser visible y accesible desde cualquier vista del módulo (no solo
  desde una pestaña específica), porque cualquier usuario con el permiso
  puede necesitar reportar en cualquier momento, sin importar qué otra
  bandeja esté viendo.

---

## 15. Fuera de alcance (a menos que se pida explícitamente)

- Inventario de repuestos, órdenes de compra o costos de reparación.
- Mantenimiento **preventivo** programado (calendario, recurrencia) — este
  módulo es reactivo/correctivo: nace de un reporte, no de un plan.
- Geolocalización GPS del reporte (basta con tienda + zona en texto libre).
- Chat en vivo entre reportante y especialista — el seguimiento es por
  comentarios de una sola vía en cada cambio de estado (igual que
  `vale_historial`), no una mensajería.
- Firma digital o conformidad del cliente (esto es interno, no de cara al
  cliente final, a diferencia de Vales de Arte).
- Integración con proveedores externos de mantenimiento.

---

## 16. Preguntas abiertas para antes de implementar

1. ¿Los dos roles sugeridos en §1 (Encargado de Mantenimiento / Técnico de
   Mantenimiento) se crean como roles nuevos en el seed, o se prefiere dar
   los permisos `incidencias.*` a roles ya existentes (ej. que el mismo
   Asistente General asigne, o que un Encargado de Diseño UV/3D también
   repare cosas)?
2. ¿A quién se le da `incidencias.verificar` de entrada? (encargado que
   asigna / gerente / supervisor de tienda / el mismo que reportó)
3. ¿Los valores de plazo por prioridad de §8 (120h/48h/24h/4h) son
   razonables para la operación real, o hay guías internas de mantenimiento
   ya establecidas que deban usarse en su lugar?
4. ¿Todas las tiendas comparten el mismo catálogo de especialistas
   (mantenimiento centralizado, especialistas que viajan entre tiendas), o
   cada tienda/región tiene los suyos y hace falta un `especialista_tiendas`
   tipo `supervisor_tiendas`? El diseño actual asume lo primero (sin
   restricción geográfica) por simplicidad, ya que la idea original no la
   menciona.
