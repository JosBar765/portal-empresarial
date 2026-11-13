# Módulo Incidencias (`incidencias`) — especificación v3

> **Estado:** mockup v3 aprobado (Figma, página «Prototipo v3 · Guatemala (núcleo)»). Fases 1 a 5 hechas: migración, permisos, semillas, entrada en el catálogo, el backend del núcleo y el de la configuración, la interfaz de reportar, listas, detalle y acciones, y la pantalla de Configuración. Falta el QA (fase 6).
> **Fuente de verdad:** este archivo. `analisis_modulo_incidencias.md` (v1) y `analisis_modulo_incidencias_v2.md` quedan solo como historial: eran más amplios (reemplazo de equipo, cotizaciones, dashboards por rol, hallazgos de Supervisiones, Centroamérica).
> **Rama:** `module/incidencias` (desde `dev`). Commits por tema, en español, sin atribución de IA.

## Idea

Cualquier usuario reporta un problema ligado a **una tienda** (y por ella, a un país). La incidencia cae a un **buzón compartido**; los **técnicos** la toman, dan avances y la llevan hasta que un **verificador** aprueba que quedó resuelta. Todo se configura desde el propio módulo (nada de nombres, roles ni listas en el código) y debe funcionar bien en teléfono.

- **v1 solo Guatemala.** Centroamérica tiene un proceso aún por definir: cada país se **habilita desde el módulo**; apagado, quien reporta ve «aún no disponible en tu país».
- **Los técnicos aún no son usuarios del sistema.** Se crean en Administración con el rol que corresponda; el módulo decide qué roles cumplen cada función.

## Entra y no entra en v1

| Entra | Queda para fases posteriores |
|---|---|
| Reportar con fotos, buzón, tomar, avances, espera, enviar a verificación, verificar o pedir corrección (rondas), reasignar, devolver al buzón, descartar, historial único, avisos (campana y tiempo real), listados por rol, configuración completa, versión móvil | Reemplazo de equipo y cotizaciones · dashboard de gerencia · hallazgos desde Supervisiones · inventario de activos individual (se enlazará con Inventario de Maquinaria) · correo o WhatsApp · mantenimiento preventivo · Centroamérica · rutas y procesos externos de las tiendas (incluido el «contacto en el lugar») |

## Reglas

- **Ubicación.** Tienda activa de un país habilitado; por defecto la suya (`asesores.tienda_id` o la primera de `supervisor_tiendas`). Zona (general o por tienda), categoría (define la especialidad que atiende), tipo de activo (opcional, por categoría) y texto libre.
- **Reporte.** Foto obligatoria (de 1 a 5; JPG, PNG o WebP), título (≤120), descripción, impacto en 4 niveles. **La prioridad la calcula el servidor** con la tabla impacto → prioridad editable; el cliente solo manda el impacto. Aviso de posible duplicado (misma tienda y zona o tipo con incidencia abierta). Límite diario de reportes por usuario.
- **Estados** (en palabras completas): `en_buzon` → `en_proceso` ⇄ `en_espera` → `en_verificacion` → `cerrada`; `correccion_pedida` (vuelve al técnico y cuenta una revisión); `descartada`. Tomar es atómico: quien la toma primero queda como responsable.
- **Avances.** Texto, hasta 3 fotos y evolución (mejoró · sin cambios · empeoró), con fecha y hora. Enviar a verificación exige describir lo hecho y una foto de evidencia.
- **Verificación.** La hace el **verificador de esa tienda** (o del país, si la tienda no tiene uno propio). Quien trabajó la incidencia no puede verificarla. Pedir corrección exige comentario y abre una ronda nueva.
- **Reasignar, devolver, descartar.** Reasignar y descartar: `incidencias.asignar` dentro de su alcance, siempre con motivo. El técnico puede devolver al buzón una incidencia propia, con motivo.
- **Historial inmutable** (`incidencia_eventos`): apertura, entrada al buzón, toma, avances, espera, reanudación, verificación, correcciones, reasignaciones, descarte y cierre.
- **Quién ve qué.** Reportante: lo que reportó. Técnico: el buzón de las tiendas que cubre y lo suyo. Verificador o asignador: las de sus tiendas. `ver_todas`: todo, en solo lectura. Fuera de alcance responde **404**. Todo se valida en el backend.
- **Avisos** (campana del portal y refresco en vivo): incidencia nueva → técnicos con cobertura (P1 como alerta); tomada, avance, espera y cierre → quien reportó; a verificación → verificadores; corrección solicitada → técnico; reasignada → técnico nuevo y anterior; descartada → quien reportó.

## Configuración (pantalla del módulo, permiso `incidencias.configurar`)

| Pestaña | Qué se edita |
|---|---|
| Países | Interruptor por país |
| Catálogos | Categorías (con especialidad), zonas, tipos de activo, especialidades, motivos de espera |
| Prioridades | Nombre, color y orden de P1 a P4; tabla impacto → prioridad; subir un nivel por reincidencia |
| Técnicos | Usuarios que son técnicos, sus especialidades y las tiendas que cubren |
| Verificadores | Verificador(es) por tienda y por país; alerta de tiendas sin verificador |
| Roles y permisos | Qué rol puede reportar, atender, verificar, asignar, ver todo o configurar (escribe `rol_permisos` de `incidencias.*`) |
| Parámetros | Máximo de fotos, límite diario, ventana de duplicados, días sin avance para resaltar |

## Permisos

`incidencias.ver` · `.reportar` · `.resolver` (técnico) · `.verificar` · `.asignar` · `.ver_todas` · `.configurar`. La migración los asigna solo al Administrador; el resto se asigna desde la pestaña «Roles y permisos» o desde Roles.

## Datos

Migración aditiva e idempotente `incidencias_nucleo` (número 44, después de los scripts de Proyectos). Configuración: `incidencia_paises`, `incidencia_especialidades`, `incidencia_categorias`, `incidencia_zonas`, `incidencia_tipos_activo`, `incidencia_prioridades`, `incidencia_reglas_prioridad`, `incidencia_motivos_espera`, `incidencia_tecnicos` (+ especialidades y tiendas), `incidencia_verificadores`. Núcleo: `incidencias`, `incidencia_fotos` (solo la URL de Storage, nunca la imagen en MySQL) e `incidencia_eventos`. Parámetros en `parametros_sistema` con prefijo `incidencias.`.

## API del núcleo (`/api/incidencias`, fase 2)

Todas piden `incidencias.ver` y, además, el permiso de cada ruta; el servicio vuelve a comprobar la relación de la persona con la incidencia (suya, de su buzón o de sus tiendas). Fuera de alcance responde **404**.

| Ruta | Quién | Qué hace |
|---|---|---|
| `GET /formulario` | reporta | Tiendas de los países habilitados, zonas, categorías, tipos de activo, impactos con su prioridad, límites y la tienda propia (o el aviso si su país está apagado) |
| `GET /similares` | reporta | Reportes parecidos y recientes de la misma tienda, mientras se escribe |
| `POST /` | reporta | Reporta con fotos (multipart, campo `fotos`) y `idempotencyKey`; calcula la prioridad y avisa a los técnicos |
| `GET /` · `GET /resumen` | según la lista | Listas (`vista` = reportadas, buzon, tecnico, verificar, tiendas, todas; filtros `estado`, `prioridadId`, `tiendaId`, `q`) y números de pestañas y tarjetas |
| `GET /:id` | quien la ve | Detalle: datos, fotos, historial (sin lo interno para quien solo reportó), acciones permitidas y opciones |
| `POST /:id/tomar` · `avances` · `espera` · `reanudar` · `verificacion` · `devolver` | resuelve | Ciclo del técnico (tomar es atómico; avance y verificación llevan fotos e `idempotencyKey`) |
| `POST /:id/aprobar` · `correccion` | verifica | Cerrar o pedir corrección (quien trabajó en la incidencia nunca la verifica) |
| `POST /:id/reasignar` · `descartar` · `PUT /:id/prioridad` | asigna | Pasar a otro técnico o al buzón, descartar, cambiar la prioridad; siempre con motivo |
| `POST /:id/comentarios` | quien la ve | Comentario (el técnico puede dejarlo interno) |

Verificación: `node --require ./scripts/security/stub-storage.js scripts/incidencias/verificar-flujo.js` sobre una base desechable (92 comprobaciones; pasa en MySQL 8.4 y MariaDB 11.8).

## API de la configuración (`/api/incidencias/configuracion`, fase 3)

Todo exige `incidencias.configurar`. Nada se borra: lo que ya no sirve se **apaga** (`activo = 0`) para no perder el historial de las incidencias que lo usaron. Cada cambio queda en `incidencia_config_historial` (quién, qué, antes y después).

| Ruta | Qué hace |
|---|---|
| `GET /estado` · `GET /historial` | Avisos de arriba (tiendas sin verificador, técnicos activos, roles que configuran) y el historial de cambios |
| `GET /paises` · `PUT /paises/:id` | Encender o apagar un país y su aviso («Todavía no está disponible en tu país»); el formulario lo refleja al momento |
| `GET/POST /catalogos/:catalogo` · `PUT /catalogos/:catalogo/:id` | `especialidades`, `categorias` (con su especialidad), `zonas` (generales o de una tienda), `tipos-activo` (por categoría) y `motivos-espera`; el nombre no se repite dentro de su ámbito |
| `GET/POST /prioridades` · `PUT /prioridades/:id` · `PUT /prioridades/reglas` | Prioridades (código, nombre, color y orden; 1 es la más urgente) y qué prioridad corresponde a cada uno de los cuatro impactos; no se apaga una prioridad que use una regla |
| `GET/PUT /parametros` | Los seis parámetros con su valor, su valor por defecto y sus límites (fotos, reportes por día, reportes repetidos, días sin avance, subir de prioridad) |
| `GET /tecnicos` · `GET /tecnicos/candidatos` · `POST /tecnicos` · `PUT /tecnicos/:usuarioId` | Quién es técnico (usuarios que ya existen), sus especialidades y las tiendas que cubre; no se desactiva a quien tenga incidencias abiertas; avisa si su rol no tiene el permiso de atender |
| `GET/POST /verificadores` · `DELETE /verificadores/:id` | Verificadores por tienda o por país, con quién verifica de verdad cada tienda y cuántas quedan sin verificador |
| `GET /roles` · `PUT /roles/:rolId` | Qué rol tiene cada permiso `incidencias.*`; guarda con el servicio de Administración (herencia entre roles y aviso en vivo), conserva los permisos de otros módulos, agrega «Ver» solo y no deja al módulo sin un rol que pueda configurarlo |

Verificación: `node scripts/incidencias/verificar-configuracion.js` sobre una base desechable (89 comprobaciones; pasa en MySQL 8.4 y MariaDB 11.8).

## Interfaz (`public/modules/incidencias/`, fase 4)

Vanilla JS en módulos ES, sin handlers en línea (CSP), con las rutas por `#`: `#/mis`, `#/reportar`, `#/enviada/:id`, `#/incidencia/:id` y `#/verificar`.

- **Reportar:** foto con la cámara del teléfono o la galería (se reduce en el aparato antes de subirla), tienda y zona, categoría y activo, aviso de reportes parecidos, impacto y el resumen «Cómo se atenderá». Un reintento nunca duplica (clave de operación por formulario).
- **Mis incidencias:** las pestañas salen de lo que cada persona puede hacer: Buzón, Mías, En espera y Cerradas (técnico), De mis tiendas (verificador o asignador), Todas (consulta total) y Reportadas por mí. Tarjetas con números, filtros y búsqueda; tabla en pantalla ancha y tarjetas bajo 640 px. «Tomar» se hace desde el propio buzón.
- **Detalle:** resumen e historial, «Cómo va», detalles, prioridad, comentarios y las acciones que el servidor permite (cada una en una hoja modal accesible: foco atrapado, Escape, errores por campo).
- **En vivo:** un aviso de la campana abre la incidencia que nombra y las pantallas abiertas se actualizan solas.
- **Celular:** el botón principal queda fijo abajo, objetivos táctiles de 44 px, lo importante primero y `prefers-reduced-motion` respetado.

### Configuración (`#/configuracion/:pestana`, fase 5)

Solo con `incidencias.configurar`. Siete pestañas sobre `/api/incidencias/configuracion/*`: Países (interruptor y aviso), Catálogos (categorías, zonas, tipos de activo, especialidades y motivos de espera; nada se borra, se apaga), Prioridades (nombre, color, orden y la tabla impacto → prioridad), Técnicos (alta con buscador de personas, especialidades y cobertura), Verificadores (por país o por tienda; resalta tiendas sin verificador), Roles y permisos (matriz rol × permiso; un rol a la vez; no deja a nadie sin poder configurar) y Parámetros (se dibuja desde el registro del servidor). Arriba, avisos con enlace a la pestaña que los arregla; «Historial de cambios» abre quién cambió qué. En el celular las tablas se vuelven tarjetas y las pestañas se deslizan; cambios sin guardar piden confirmación al salir de la pestaña.

## Implementación (patrón de Proyectos)

Controladores solo HTTP; servicios con las reglas; repositorios con todo el SQL. Se reutilizan los guards de permisos, `MODULOS`, `notificacionService`, `socketManager`, `subirYRegistrarArchivo` con `supabaseStorage`, `idempotencyKey`, `responderError` e `idObligatorio`. Frontend vanilla con los tokens de `public/css/global.css`, sin handlers en línea (CSP). Móvil: tarjetas bajo 640 px, objetivos táctiles de 44 px, cámara directa y reducción de la imagen antes de subir.

## Fases

0. Rama, esta documentación y mockup aprobado.
1. Migración, permisos, semillas y entrada en el catálogo.
2. Backend núcleo y scripts de verificación.
3. Backend de configuración.
4. Frontend: reportar, listados, detalle y acciones.
5. Frontend: configuración.
6. QA por rol (escritorio y 390 px), documentación final y fila en el mapa de docs de `CLAUDE.md`.

## Supuestos (el dueño puede cambiarlos)

1. El técnico puede devolver al buzón una incidencia propia.
2. Sin verificador por tienda ni por país, la incidencia queda visible para quien tenga `incidencias.verificar` (nunca el técnico que la trabajó) y Configuración muestra la alerta.
3. Gerente y Administrador ven todo en solo lectura.
4. Se puede elegir cualquier tienda activa de un país habilitado, incluida la sede central.
5. Los permisos solo se asignan al Administrador al migrar.
