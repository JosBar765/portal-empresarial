# Flujo del módulo "Vales de Arte" (estado real del sistema)

Referencia del flujo tal como lo implementa el código en `src/modules/vales/`
(verificado contra los servicios el 2026-10-06). Si este archivo y el código
discrepan, manda el código: corrige este archivo.

- `analisis_modulo.md` es la especificación **original** y solo se conserva
  como histórico (habla de `VENDIDO`/`CANCELADO` y de un flujo de un solo
  taller, que ya no existen).
- Los `correcciones/analisis_correcciones_N.md` y `documentacion/` explican el
  porqué de cada cambio puntual.

## 0. Conceptos clave

- Un vale tiene **dos niveles de estado**: el estado **general** del vale
  (`vales.estado`, sección 1) y el estado de **cada taller** involucrado
  (`vale_talleres.estado`, sección 2). Un vale enviado a 2 talleres tiene 2
  filas avanzando en paralelo.
- Las acciones se controlan por **permiso**, no por rol (sección 3). Los
  nombres de rol de este documento describen quién tiene hoy ese permiso en
  `database/seed.sql`, pero el backend solo valida el permiso
  (`routes.js` → `requirePermission`).
- Toda transición se serializa con un lock por vale (`valeMutex`); además, el cupo del supervisor y el "un solo vale en proceso" del técnico se serializan en colas por supervisor y por técnico (`conColaDeSupervisor`, `conColaDeTecnico`). Se anota en
  `vale_historial`.
- Hora de referencia: UTC-6 fijo (Guatemala), calculado por offset, no por la
  zona horaria del servidor.
- Correlativo: `{CÓDIGO TIENDA}-{INICIALES ASESOR}-{id autoincremental}`. El
  vale de modificación lleva el prefijo `MOD-` delante del correlativo del
  original.

## 0.1 Máquina de estados: catálogo completo

Un vale tiene **dos máquinas de estados** que viven en tablas distintas. Los
nombres técnicos (la columna "Código") son los que usa el código y la base de
datos; la columna "Etiqueta" es lo que se muestra hoy en pantalla
(`public/modules/vales/js/config/estados.js`). Para renombrar, ver §9.

### A. Estado GENERAL (`vales.estado` → tabla `estados_vale`)

| id | Código | Etiqueta en pantalla | Qué significa | Entra por | Sale por |
|---|---|---|---|---|---|
| 1 | `ESPERANDO_AUTORIZACION` | Esperando Autorización | El vale existe pero ningún taller lo ve aún; espera al supervisor del asesor. No tiene filas en `vale_talleres`. Tiene vigencia de 24 h (§1). | El asesor crea el vale · el asesor reenvía uno `RECHAZADO` · se solicita una modificación (nace así el vale `MOD-`, oculto para el asesor) | Autorizar → `CREADO` (o `MODIFICADO` si es `MOD-`) · Rechazar → `RECHAZADO` · Baja o vencimiento → **se borra** |
| 9 | `RECHAZADO` | Rechazado | El supervisor devolvió el vale al asesor con un motivo (≤ 50 palabras). El asesor puede corregirlo, reenviarlo o darlo de baja. Conserva la vigencia de 24 h original. | El supervisor rechaza la creación | Reenviar → `ESPERANDO_AUTORIZACION` · Baja o vencimiento → se borra |
| 2 | `CREADO` | Creado | Autorizado; los talleres lo trabajan en paralelo (estado por taller, §2). El estado general no cambia mientras algún taller no esté `APROBADO`. | El supervisor autoriza la creación | Todos los talleres `APROBADO` → `PENDIENTE_CONFIRMACION` (1 taller) o `APROBADO_DEPARTAMENTO` (2+) |
| 3 | `APROBADO_DEPARTAMENTO` | Aprobado por Talleres | Todos los talleres aprobaron y falta la **fusión manual** de sus propuestas (§1, cola de quien tenga `vales.aprobar_general`). | Último taller aprueba, con 2+ talleres (también un `MOD-`, que va a los mismos talleres que su original) | Se adjunta el documento de fusión → `PENDIENTE_CONFIRMACION` |
| 4 | `PENDIENTE_CONFIRMACION` | Pendiente Confirmación | El trabajo está listo; el asesor debe confirmar de recibido (o pedir una modificación). | Último taller aprueba con 1 taller · se fusionó | Confirmar → `RECIBIDO` · Solicitar modificación → `SOLICITANDO_MODIFICACION` |
| 5 | `RECIBIDO` | Recibido (al asesor se le muestra **Confirmado**) | Terminal. El asesor confirmó; el atraso queda congelado. Puede seguir recibiendo **una** solicitud de modificación. | El asesor confirma · una modificación fue aprobada o rechazada (el original vuelve aquí) | Solicitar modificación → `SOLICITANDO_MODIFICACION` |
| 6 | `SOLICITANDO_MODIFICACION` | Solicitando Modificación | El **original** espera que el supervisor apruebe o rechace la modificación. | El asesor solicita la modificación desde `PENDIENTE_CONFIRMACION` o `RECIBIDO` | Aprobada → `RECIBIDO` (y nace el `MOD-`) · Rechazada → vuelve al estado previo (`PENDIENTE_CONFIRMACION` o `RECIBIDO`) |
| 7 | `MODIFICADO` | Modificado | Estado del vale **`MOD-`** desde que se aprueba la modificación hasta que pasa a confirmación. Ya está autorizado y corre el ciclo de taller. | El supervisor aprueba la modificación | Mismos caminos que `CREADO` (§1.1) |
| 8 | `CONFIRMADO` | Confirmado | **No se guarda nunca en `vales.estado` ni en `vale_historial`** (el historial registra `RECIBIDO`, el estado real): existe en el catálogo y en el código, pero solo sirve como etiqueta que ve el asesor (`estadoVisibleAsesor`). En la base, un vale confirmado está en `RECIBIDO`. | — | — |

Diagrama general (flujo feliz y desvíos):

```
                       ┌──────────── asesor corrige / reenvía ────────────┐
                       ▼                                                    │
 asesor crea ─► ESPERANDO_AUTORIZACION ── supervisor rechaza ─► RECHAZADO ──┘
                       │   │                                        │
                       │   └── baja (asesor) / vence 24 h ─► [vale borrado]
                       │ supervisor autoriza
                       ▼
                    CREADO ── talleres (§2) ──► todos APROBADO
                                                   │
                       ┌───────────────────────────┴──────────────┐
                       │ 1 taller                                  │ 2+ talleres
                       │                                           ▼
                       │                              APROBADO_DEPARTAMENTO
                       │                                (fusión manual)
                       ▼                                           │
                 PENDIENTE_CONFIRMACION ◄──────────────────────────┘
                   │              │
        asesor confirma      asesor solicita modificación
                   ▼              ▼
               RECIBIDO ──► SOLICITANDO_MODIFICACION ── rechaza ─► (vuelve al previo)
                   ▲              │ aprueba
                   │              ▼
                   └── original  se crea el vale MOD-:  MODIFICADO ─► (ciclo de taller, §1.1)
                       queda RECIBIDO                     └─► PENDIENTE_CONFIRMACION / APROBADO_DEPARTAMENTO ─► RECIBIDO
```

### B. Estado por TALLER (`vale_talleres.estado` → tabla `estados_taller`)

| id | Código | Etiqueta en pantalla | Qué significa | Entra por | Sale por |
|---|---|---|---|---|---|
| 1 | `PENDIENTE_ASIGNACION` | Pendiente Asignación | El taller recibió el vale; el encargado aún no elige técnico. | El supervisor autoriza (una fila por taller) | Encargado asigna técnico → `ASIGNADO` |
| 2 | `ASIGNADO` | Asignado | Tiene técnico, aún no empieza. | Asignación · el encargado **desaprueba** y reasigna | Técnico comienza → `EN_PROCESO` |
| 3 | `EN_PROCESO` | En Proceso | El técnico trabaja (solo 1 por técnico). | Comenzar · reanudar | Entregar o cancelar → `EN_REVISION` · Pausar → `EN_PAUSA` |
| 4 | `EN_PAUSA` | En Pausa | El técnico detuvo el trabajo. | Pausar | Reanudar → `EN_PROCESO` |
| 5 | `EN_REVISION` | En Revisión | Entregó propuesta (o canceló sin propuesta) y espera al encargado. | Entregar / cancelar | Aprobar → `APROBADO` · Desaprobar → `ASIGNADO` |
| 6 | `APROBADO` | Aprobado | El taller terminó (con propuesta con archivo). | Aprobación del encargado (o autoaprobación si se autoasignó y entregó con archivo) | — |

> Los nombres de los dos niveles **no colisionan** (por eso comparten
> diccionario de etiquetas): `APROBADO` es de taller y `APROBADO_DEPARTAMENTO`
> es general. Cuidado al renombrar uno: `APROBADO` es subcadena del otro.

### C. Lo que ve cada rol (estado "visible")

- **Asesor** (y el **Supervisor** solo en "Trabajo realizado") no ve el estado
  real, sino una versión colapsada (`estadoVisibleAsesor`, calculada en el
  servidor y enviada como `estado_visible`): `CREADO`/`APROBADO_DEPARTAMENTO` →
  **Creado**; `RECIBIDO` → **Confirmado**; el vale `MOD-` se muestra como
  **Modificado** hasta `PENDIENTE_CONFIRMACION`. El resto se muestra igual.
- **Encargado de taller y técnico** ven el estado **de la fila de su taller**
  (`estado_taller`, sección B), no el general.
- **Administrador y Gerente** ven el estado general real.
- Un vale `MOD-` no aparece en los listados del asesor mientras esté en
  `ESPERANDO_AUTORIZACION` (es la solicitud pendiente; ver §1.1).

## 1. Estado GENERAL del vale (`vales.estado`)

```
 ASESOR crea el vale
 (elige 1 o varios talleres → quedan en `talleres_solicitados`)
        │   · valida cupo diario del taller (si tiene límite_diario)
        │   · Diseño Local no se mezcla con talleres de Munditrofeos y
        │     solo se puede elegir el de la propia tienda del asesor
        ▼
 ┌────────────────────────┐
 │ ESPERANDO_AUTORIZACION │  Sin filas aún en vale_talleres.
 └───────────┬────────────┘  Buzón del/los SUPERVISOR(es) del asesor.
             │
     ┌───────┴────────────────────────────┐
     │ Supervisor RECHAZA                 │ Supervisor AUTORIZA
     ▼                                    │ (gated por el cupo colectivo
 Pasa a RECHAZADO y vuelve al ASESOR      │  diario de su equipo, ver §5;
 con un motivo (≤ 50 palabras): puede     │  debe haber abierto "Ver" antes)
 corregir, reenviar o dar de baja.        │ → crea 1 fila en vale_talleres
 (ver notas)                              │   por taller solicitado
                                          │ → sella autorizado_por/en
                                          │   (tipo CREACION) y regenera el
                                          ▼   PDF con firma roja
                                   ┌───────────┐
                                   │  CREADO   │
                                   └─────┬─────┘
                                         │ cada taller corre su ciclo (§2).
                                         │ El estado general NO cambia
                                         │ mientras algún taller no esté
                                         │ APROBADO.
                                         │
                                         │ Cuando TODOS los talleres están APROBADO:
                  ┌──────────────────────┴───────────────────────┐
                  │                                              │
   1 solo taller Y el vale NO es            2+ talleres, O el vale es una modificación
   una modificación                         cuyo ORIGINAL fue a 2+ talleres
                  │                                              │
                  │                                              ▼
                  │                               ┌──────────────────────────┐
                  │                               │  APROBADO_DEPARTAMENTO   │
                  │                               │  Cola de fusión: quien   │
                  │                               │  tenga el permiso        │
                  │                               │  vales.aprobar_general   │
                  │                               │  adjunta SU documento de │
                  │                               │  fusión (obligatorio;    │
                  │                               │  la fusión es manual).   │
                  │                               └────────────┬─────────────┘
                  │  la propuesta del único taller             │ sella fusionado_por/en
                  │  pasa a ser la propuesta general           │
                  ▼                                            ▼
              ┌──────────────────────────────────────────────────────┐
              │              PENDIENTE_CONFIRMACION                   │
              │              (buzón del ASESOR)                       │
              └──────────────────────┬───────────────────────────────┘
                                     │
          ┌──────────────────────────┴──────────────────────────┐
          │ Asesor confirma de recibido                         │ Asesor solicita modificación
          │ (sella confirmado_en y                              │ (ver §1.1; permitido también
          │  congela el atraso)                                 │  desde RECIBIDO)
          ▼                                                     │
     ┌──────────┐                                               │
     │ RECIBIDO │  (terminal)                                   │
     └────┬─────┘                                               │
          │ el asesor aún puede solicitar modificación ─────────┤
                                                                ▼
                                              ┌───────────────────────────┐
                                              │  SOLICITANDO_MODIFICACION │
                                              │  buzón del SUPERVISOR     │
                                              └──────────────┬────────────┘
                                                             │ (ver §1.1)
```

Notas:

- **Rechazo (`RECHAZADO`):** el supervisor debe escribir un motivo (máx. 50
  palabras / 400 caracteres). El vale vuelve al asesor, que recibe una
  notificación y ve "Ver motivo del rechazo", "Corregir" y "Reenviar a
  autorización" (permiso `vales.corregir`) o puede darlo de baja. Al reenviar
  vuelve a `ESPERANDO_AUTORIZACION` y la marca de "visto" del supervisor se
  reinicia. Nada se borra al rechazar.
- **Ver antes de autorizar:** el supervisor solo puede autorizar (creación o
  modificación) un vale que haya abierto con "Ver" o cuyo PDF haya abierto
  (`vale_vistos`); se exige en pantalla y en el servidor. Si el asesor corrige,
  la marca se reinicia.
- **Vigencia de 24 h:** un vale nuevo en `ESPERANDO_AUTORIZACION` o
  `RECHAZADO` se **elimina solo** (con sus archivos) a las 24 h de su creación
  si nadie lo autoriza; 6 h antes se avisa al asesor y a sus supervisores
  (`vigenciaWatcher.js`, cada 60 s). Aplica solo a vales creados desde que
  existe esta regla.
- Mientras está en `ESPERANDO_AUTORIZACION` (o `RECHAZADO`), el **asesor dueño**
  también puede darlo de baja (permiso `vales.dar_de_baja`): el vale se borra.
  Una vez autorizado ya no es posible. Si el supervisor autoriza o
  rechaza un vale ya dado de baja, o el asesor da de baja uno ya autorizado, el
  sistema avisa con un mensaje claro y no cambia nada.
- También mientras está en `ESPERANDO_AUTORIZACION` o `RECHAZADO`, el asesor dueño puede **corregir**
  sus datos (permiso `vales.corregir`): cliente, talleres, fechas, venta, descripción y
  archivos. El vale conserva su id, correlativo y estado; el PDF se regenera y la
  corrección queda en el historial. Una vez autorizado ya no es posible (después solo
  existe la solicitud de modificación).
- Un vale que el asesor no acepta en `PENDIENTE_CONFIRMACION` **no tiene
  acción "rechazar"**: sigue el mismo camino que una modificación.
- La propuesta/fusión **nunca se pega dentro del PDF del vale**. El PDF es el
  documento administrativo del vale (encabezado, cliente, venta, firma); la
  propuesta queda aparte, accesible con "Ver propuesta".
- El PDF se genera al crear el vale y se regenera al autorizar (firma roja),
  al aprobar una modificación y al fusionar. Se sube a Supabase Storage; en
  MySQL solo se guarda la URL.

### 1.1 Modificación (una sola por vale)

```
 Asesor solicita modificación (desde PENDIENTE_CONFIRMACION o RECIBIDO)
   · usa el mismo formulario de "Corregir", con los archivos precargados y
     los talleres FIJOS: la modificación siempre va a los mismos talleres del
     original (no se puede elegir otro ni un subconjunto)
   · debe escribir una justificación (va en la descripción: máx. 600 caracteres)
   · se valida el cupo diario de los talleres destino (como aviso)
   · se crea YA el vale nuevo "MOD-<correlativo>" en ESPERANDO_AUTORIZACION
     (vale_original_id apunta al original), oculto para el asesor
   · el original pasa a SOLICITANDO_MODIFICACION
        │
        ▼  Supervisor del asesor (debe abrir "Ver" el MOD-; ve la justificación)
 ┌──────────────┴───────────────────────────────┐
 │ RECHAZA                                      │ APRUEBA
 ▼                                              ▼
 El vale MOD- pendiente se BORRA (documentos    El MOD- pasa a MODIFICADO:
 e historial en cascada; los archivos de        · YA autorizado (autorizado_por/en,
 Storage que comparte el original NO se           tipo MODIFICACION): aprobar la
 tocan). El original vuelve al estado que         modificación ES la autorización
 tenía antes (PENDIENTE_CONFIRMACION o          · fan-out INMEDIATO a los talleres
 RECIBIDO, recuperado del historial).             elegidos (cupo revalidado ahora)
 No consume la modificación.                    · la justificación pasa a ser su
                                                  "Boceto y Descripción"
                                                · el PDF muestra primero la
                                                  "Propuesta original"
                                                El original: queda RECIBIDO,
                                                `modificado = 1` y su atraso se
                                                congela si aún no lo estaba.
                                                        │
                                                        ▼
                      el MOD- corre el ciclo de taller normal (§2). Al terminar:
                      · si el ORIGINAL fue a 1 solo taller → PENDIENTE_CONFIRMACION
                      · si el ORIGINAL fue a 2+ talleres → APROBADO_DEPARTAMENTO
                        (fusión), pues el MOD fue a todos esos talleres
                      Luego el asesor lo confirma → RECIBIDO.
```

- Son **dos registros y dos PDF independientes**: el original nunca se
  sobreescribe; "Ver PDF" del original sirve siempre el del original.
- Solo se permite **una** modificación: no puede modificarse un vale con
  `modificado = 1` ni un vale `MOD-` (`vale_original_id` no nulo).
- Las tablas `vale_solicitudes_modificacion` y `estados_solicitud_modificacion`
  (`PENDIENTE`/`APROBADA`/`RECHAZADA`) **ya no se usan**: la solicitud
  pendiente es el propio vale `MOD-` en `ESPERANDO_AUTORIZACION`. Pueden
  retirarse más adelante y no hay que renombrar nada en ellas.
- Al asesor, el estado de un vale `MOD-` se le muestra como `MODIFICADO` hasta
  que llega a `PENDIENTE_CONFIRMACION`, y como `CONFIRMADO` al recibirse;
  el de un vale normal `RECIBIDO` se le muestra como `CONFIRMADO`
  (`estadoVisibleAsesor`).

## 2. Estado por TALLER (`vale_talleres.estado`)

Nace cuando el Supervisor autoriza la creación (o aprueba la modificación).

```
        ┌─────────────────────────┐
        │   PENDIENTE_ASIGNACION   │
        └────────────┬─────────────┘
                     │ el encargado del taller asigna un técnico
                     │ (de su mando, o a sí mismo)
                     ▼
               ┌───────────┐ ◄────────────────────────────────────┐
               │  ASIGNADO │                                       │
               └─────┬─────┘                                       │
                     │ técnico "comenzar"                          │ encargado DESAPRUEBA:
                     │ (solo 1 vale EN_PROCESO por técnico)        │ debe indicar a qué técnico
                     ▼                                             │ reasignar (puede ser él mismo)
          ┌───────────────────┐   pausar    ┌────────────┐         │
          │    EN_PROCESO     │────────────►│  EN_PAUSA  │         │
          │                   │◄────────────│            │         │
          └───┬───────────┬───┘  reanudar   └────────────┘         │
              │           │   (también exige no tener otro        │
              │           │    EN_PROCESO)                        │
   entrega    │           │ cancela el proceso                    │
   propuesta  │           │ (sin propuesta, alerta roja)          │
              ▼           ▼                                       │
          ┌─────────────────────┐                                 │
          │     EN_REVISION     │─────────────────────────────────┘
          └──────────┬──────────┘
                     │ encargado APRUEBA
                     │ (exige una propuesta con archivo: no se puede
                     │  aprobar una propuesta en blanco)
                     ▼
               ┌───────────┐
               │ APROBADO  │
               └───────────┘
```

Reglas:

- **Entregar con archivo vs. sin archivo:** si el técnico entrega sin archivo,
  se dispara una alerta roja y el encargado no podrá aprobar, solo
  desaprobar/reasignar. Cancelar el proceso deja el taller en `EN_REVISION`
  igual que una entrega vacía (no crea fila en `vale_propuestas`; solo queda
  en el historial).
- **Autoasignación:** un encargado puede asignarse el vale (o reasignárselo
  tras desaprobar) a sí mismo. Si luego entrega **con archivo**, su trabajo se
  **autoaprueba** en el mismo paso (no pasa por revisión de sí mismo).
- **Asistente de Diseño:** opera como "clon" del encargado del taller al que
  esté vinculado (`taller_tecnicos`), para asignar, revisar y ver el buzón.
- Un encargado solo actúa sobre la fila de **su propio** taller; el
  Administrador, si el vale tiene un solo taller, sobre esa fila, y si tiene
  varios debe indicar el taller.

## 3. Roles y permisos

Permisos del seed (`database/seed.sql`) por rol. El backend valida el
**permiso**; cambiar los permisos de un rol desde el panel de administración
cambia quién puede hacer cada acción.

| Rol (id) | Permisos de vales | Qué hace |
|---|---|---|
| Administrador (1) | `vales.ver` (+ `admin.*`) | Ve todo el buzón. **No** tiene permisos de escritura sobre vales: no puede autorizar, asignar, aprobar ni confirmar. |
| Asesor de Ventas (2) | `ver`, `crear`, `editar`, `confirmar`, `solicitar_modificacion`, `dar_de_baja`, `corregir` | Crea vales; los corrige o da de baja antes de ser autorizados; confirma el recibido o solicita la modificación. |
| Supervisor de Ventas (3) | `ver`, `autorizar_creacion`, `aprobar_modificacion`, `supervisar`, `ver_gerencia` | Autoriza/rechaza creaciones y aprueba/rechaza modificaciones **solo de los asesores bajo su mando** (`usuarios.encargado_id`). Puede haber varios supervisores por tienda (rotativos). Ve su vista Rendimiento. |
| Encargado de Diseño (4) | `ver`, `asignar`, `revisar`, `trabajar`, **`aprobar_general`** | Dueño del taller "Diseño". Asigna y revisa, puede trabajar vales él mismo, y **fusiona** los vales multi-taller. |
| Encargado de Diseño UV/3D (5) | `ver`, `asignar`, `revisar`, `trabajar` | Dueño del taller "Diseño UV/3D". Sin fusión. |
| Técnico (6) | `ver`, `trabajar` | Comienza, pausa, reanuda, cancela y entrega sus vales. |
| Asistente de Diseño (7) | `ver`, `asignar`, `revisar`, `trabajar`, **`aprobar_general`** | Clon operativo completo del Encargado de Diseño. |
| Gerente (8) | `ver`, `ver_gerencia` | Solo lectura (ver §6). |
| Encargado de Protextil (9) | `ver`, `asignar`, `revisar` | Encargado de su taller; sin fusión. |
| Diseño Local (10) | `ver`, `asignar`, `revisar`, `trabajar` | Encargado de un taller de Diseño Local (ligado a una tienda); sin fusión. |

### Quién fusiona

La acción de fusionar **no está amarrada a un rol**, sino al permiso
`vales.aprobar_general` (`POST /:id/aprobar-general`): el backend solo exige
ese permiso. Hoy lo tienen los roles 4 y 7. Ojo: la **cola** de
`APROBADO_DEPARTAMENTO` se arma en el buzón de los roles de encargado de taller
(4, 5, 7, 9, 10), así que quien tenga el permiso y esté en uno de esos roles la
verá mezclada en su buzón de taller (no es un buzón aparte). Un rol de otro tipo
(asesor, supervisor, técnico, gerente) con el permiso no vería la cola. No existe un rol
"Encargado General".

Detalles de esa cola:

- Es **global**: se ve todo vale `APROBADO_DEPARTAMENTO`, sin importar si el
  taller de quien fusiona participó.
- "Trabajo realizado" de quien fusiona muestra, además de sus aprobaciones de
  taller, una fila por cada fusión que **él** hizo (`fusionado_por`).
- El aviso en tiempo real de "listo para fusión" va a la sala `vales:fusion`, a la
  que se une cualquiera con el permiso `vales.aprobar_general` (el servidor lo
  valida contra el JWT), sin importar su rol o taller.
- El botón "Aprobar y fusionar" y las tarjetas de fusión del buzón y de "Trabajo
  realizado" también dependen del permiso, no del rol.

## 4. Buzón y "Trabajo realizado" por rol

Cada rol tiene dos vistas en la barra lateral: **Buzón** (lo pendiente /
activo) y **Trabajo realizado** (lo ya hecho, ordenado por fecha). Las tablas
tienen las mismas columnas para todos; cambian filtros, orden y acciones.

| Rol | Buzón (contadores) | Trabajo realizado |
|---|---|---|
| Asesor | Rechazados · Esperando autorización · Pendientes de confirmación · Solicitando modificación · Atrasados. Excluye RECIBIDO. | Vales `RECIBIDO` y `SOLICITANDO_MODIFICACION` (un vale confirmado sigue ahí aunque tenga una modificación en curso). Total y recibidos hoy. |
| Supervisor | Por autorizar creación (con contador N/M del cupo colectivo) · Por autorizar modificación · Modificados · Pendientes de confirmación del asesor · Atrasados. | Dos grupos: lo que **él** autorizó (por fecha de autorización) y lo que sus asesores confirmaron (por `confirmado_en`). Un vale que cae en ambos aparece una vez. |
| Encargado de taller | Pendiente de asignación · Asignados · En proceso · **En pausa** · En revisión · Atrasados (+ **Por fusionar** si tiene `aprobar_general`). Muestra el estado **de la fila de su taller**, no el general. | Vales con fila `APROBADO` en su taller (con "Ver propuesta" de su técnico), + sus fusiones si fusiona. |
| Técnico | Asignados sin atraso · Asignados con atraso · Vale en proceso (ve también `EN_PAUSA` y `EN_REVISION` en la lista). | Vales que su taller aprobó, con su propuesta. |
| Administrador | Todo, con contadores generales (total, atrasados, recibidos hoy, pendientes de confirmación, por fusionar). | — |
| Gerente | **No tiene buzón**: ver §6. | — |

"Atrasados" es el único contador que se **combina** con cualquier otro filtro
activo (los demás contadores son mutuamente excluyentes). Además hay filtro
por estado, búsqueda por correlativo/cliente/empresa, orden por columna
(reemplaza la jerarquía de negocio mientras está activo), ventana de tiempo
por **fecha de entrega** (`Todo`, navegador de mes —arranca en el mes actual— o rango
Desde/Hasta; con un rango el mes se desactiva) y paginación por cursor de 50 en 50.

## 5. Límites y cupos

| Límite | Dónde se valida | Efecto |
|---|---|---|
| **Cupo colectivo diario del Supervisor** = nº de asesores activos bajo su mando; cuenta las autorizaciones de **creación** que hizo hoy | Al **autorizar** (no al crear) | Al llegar al límite no puede autorizar más ese día. Al Administrador no le aplica. Crear un vale nunca se bloquea ni se pospone por esto. Leer el cupo y sellar la autorización van en el mismo turno de la cola del supervisor, así que dos autorizaciones simultáneas no pueden pasarlo. La tarjeta "Autorizados hoy (equipo)" (N/M) la calcula el servidor con este mismo conteo. |
| **Cupo diario por taller** (`talleres.limite_diario`, opcional; NULL = sin límite), sobre la fecha de **entrega** (no la de evento) | Al **crear**, al **solicitar** la modificación y al **aprobar** la modificación | Bloquea con un mensaje amigable ("el taller X ya no tiene cupo para el día…"). Las verificaciones + inserción son atómicas entre asesores (`conColaDeCapacidad`). El calendario del frontend solo lo anticipa. |
| Un técnico = un vale `EN_PROCESO` | `comenzar` y `reanudar` (en la cola del técnico: dos acciones simultáneas no lo superan) | Debe entregar, cancelar o pausar el actual antes. |
| Una sola modificación por vale | `solicitarModificacion` | Ver §1.1. |
| Adjuntos | `routes.js` | Máx. 3 MB por archivo; JPEG/PNG/WebP/PDF; hasta 10 imágenes y 5 documentos al crear. Un tipo no permitido se **rechaza** con un 400 (no se descarta en silencio). |

Validaciones de formulario (creación y modificación): cliente (nombre,
teléfono y correo válido) obligatorio, producto y material obligatorios,
cantidad > 1, cotización > 0, fecha de evento posterior a la de entrega y
entrega igual o posterior a hoy. Técnica y acabado son opcionales. Un vale es
**urgente** automáticamente si faltan menos de 3 días para la entrega.

> Nota: esto reemplaza al antiguo límite diario por asesor
> (`asesor_limites`), que ya no existe: crear nunca se pospone.

## 6. Gerente y Administrador

- **Gerente** (solo lectura, nunca ejecuta una acción sobre un vale): ve la
  vista **Rendimiento** (KPIs y gráficas por estado, tienda y taller; ciclo de
  vida; atrasos), filtrable por tienda y ventana de tiempo, y **"Encontrar
  vale"**, que busca **un** vale por correlativo exacto (con sugerencias si no
  existe; solo el rol Gerente, aunque `vales.ver_gerencia` también lo tenga el
  Supervisor). Puede ver el detalle y el PDF de cualquier vale.
- **Supervisor**: tiene la vista Rendimiento acotada a las tiendas de sus
  asesores.
- **Administrador**: ve el buzón completo y el detalle de cualquier vale, pero
  su rol solo tiene `vales.ver`, así que no puede ejecutar las acciones de
  escritura (aceptado como limitación conocida).

## 7. "Atraso" no es un estado

Es una condición **derivada** de `fecha_entrega`, calculada al vuelo
(`calcularAtraso`) en cada consulta; no se guarda como estado. Puede
combinarse con cualquier filtro de estado.

- Mientras el vale está activo, el atraso corre en vivo.
- Se **congela** (se detiene de forma permanente) en dos momentos:
  1. el asesor confirma de recibido (`confirmarRecibido`),
  2. el supervisor aprueba una modificación (el atraso del **original** se
     congela aquí si aún no lo estaba).

  Después de congelado se queda fijo, aunque el vale pase luego a
  `SOLICITANDO_MODIFICACION` (`vales.atraso_congelado_en`). Los vales ya
  `RECIBIDO` sin sello de congelamiento usan `actualizado_en` como respaldo.
- **Alerta en vivo:** `atrasoWatcher.js` corre cada 60 s en el mismo proceso
  y detecta los vales con **1 día completo o más** de atraso (pasadas 24 h de
  su `fecha_entrega`; antes solo se muestra "vence hoy"). Dispara
  una alerta roja **una sola vez por vale** (`atraso_notificado_en`) solo a
  quien lo tiene "en su vista": el asesor, sus supervisores, los talleres con
  fila activa (pendiente, asignado, en proceso o en revisión), los técnicos con
  vale activo, y la sala `vales:fusion` si el vale está `APROBADO_DEPARTAMENTO`.

## 8. Tiempo real

Todos los eventos pasan por `valeEvents.notificar` (`events.js`) y se envían
**solo a las salas a quienes concierne**, ya formateados:
`{dd/mm/aaaa hh:mm} – Vale: {correlativo} fue {acción} por {actor}[ a {destino}]`.

- Salas: `asesor:<id>`, `supervisor:<id>`, `taller:<id>`, `tecnico:<id>`,
  `vales:fusion` (quien tenga `vales.aprobar_general`) y `vales:admin` (el
  Administrador ve todo).
- El servidor valida en cada conexión que el usuario tenga derecho a la sala
  que pide; no confía en la lista que arma el cliente.
- Nivel `alerta` (toast rojo): atrasos, propuesta entregada sin archivo y
  cancelación de proceso.
- Al recibir un evento, el cliente refresca su buzón.

## 9. Guía para renombrar estados

Un estado tiene **tres capas** y hay que decidir cuáles tocar:

| Capa | Dónde | ¿Qué cambia si la renombras? |
|---|---|---|
| **1. Etiqueta en pantalla** | `public/modules/vales/js/config/estados.js` (`ESTADOS_LABEL`, `ESTADOS_VISIBLES_LABEL`) | Solo lo que lee la gente. **Cero riesgo**: no toca la lógica, la base ni los permisos. |
| **2. Código interno** | Constante `ESTADOS` / `ESTADOS_TALLER` en `src/modules/vales/services/valeHelpers.js` y todos los sitios que usan el literal | Nada visible, pero es el contrato entre backend, base y frontend. |
| **3. Valor en la base** | Tablas `estados_vale` / `estados_taller` (`nombre`), seed y `vale_historial.estado_anterior/estado_nuevo` | Datos existentes: hay que migrarlos. |

### Recomendación

**Cambiar solo la capa 1** (la etiqueta). Gerencia se queja de lo que *ve*, y
las etiquetas ya están centralizadas en un solo archivo: renombrar `CREADO` a
"En taller" o `PENDIENTE_CONFIRMACION` a "Por confirmar" es editar una línea y
no puede romper nada. Los códigos (`CREADO`, `RECIBIDO`...) son identificadores
internos como una clave primaria; nadie los ve. Renombrarlos también (capas 2 y
3) solo se justifica si quieres que código y pantalla hablen igual, y tiene un
costo alto y riesgo real (ver abajo).

Para renombrar solo la etiqueta (capa 1):

1. Edita `ESTADOS_LABEL` (lo ven Administrador, Gerente, encargados, técnicos y
   el Supervisor) **y** `ESTADOS_VISIBLES_LABEL` (lo ven Asesor y el Supervisor en
   "Trabajo realizado"). Un mismo estado figura en ambos diccionarios: cámbialo
   en los dos o el asesor y el supervisor verán nombres distintos.
2. Revisa los textos que **no** salen de esos diccionarios y mencionan el
   estado en prosa: contadores y títulos de tarjetas del buzón (p. ej.
   "Pend. confirmación asesor", "Por autorizar creación", "Solicitando
   modificación"), los botones/modales, los mensajes de error de los servicios
   y las notificaciones (`events.js`, `valeCreacionService`, etc.). Búscalos con
   el texto actual, p. ej. `grep -rn "Pendiente Confirmación" src public`.
3. Los textos del **historial** del vale (`vale_historial.accion`) son frases ya
   guardadas: no se actualizan solas; las nuevas saldrán con el texto nuevo.
4. Actualiza este documento (columna "Etiqueta en pantalla" del §0.1).

### Si de verdad quieres renombrar el código y la base (capas 2 y 3)

Dónde aparece cada código (búscalo con `grep -rnw CODIGO src public database`):

- `database/seed.sql` (tablas `estados_vale` / `estados_taller`) y la base viva.
- `src/modules/vales/services/valeHelpers.js` (`ESTADOS`, `ESTADOS_TALLER`,
  `estadoVisibleAsesor`) y casi todos los `vale*Service.js` y
  `vale*Repository.js` (consultas con el literal, p. ej. `valeRepository`,
  `valeTallerRepository`, `tallerAdminRepository`).
- `atrasoWatcher.js`, `vigenciaWatcher.js`, `valeBuzonService.js` (contadores y
  filtros), `valeRendimientoService.js` (KPIs y embudo).
- Frontend: `config/estados.js`, `permisos.js`, `views/buzon.js` (condiciones
  como `v.estado === 'ESPERANDO_AUTORIZACION'`), `actions/*.js`,
  `forms/valeForm.js`.
- **CSS:** las píldoras usan la clase `estado-<CODIGO>` (`public/modules/vales/css/styles.css`,
  clase generada por `claseEstado()`): si cambias un código, cambia también su clase.
- **`vale_historial`:** guarda el código como texto (`estado_anterior`,
  `estado_nuevo`) y **el código lo lee**: `valeDetalleService` clasifica cada
  fila del historial por el par de estados, y el rechazo de una modificación
  recupera el "estado anterior" desde ahí (`valeModificacionService`). Aprobar y rechazar una modificación dejan ambos `SOLICITANDO_MODIFICACION → RECIBIDO` cuando el original estaba recibido: se distinguen por el texto de `accion`. Si
  renombras un código hay que hacer un `UPDATE vale_historial` por cada uno
  (en `estado_anterior` **y** `estado_nuevo`) en la misma migración, o el
  historial viejo dejará de clasificarse y un rechazo de modificación podría
  restaurar un estado inexistente.
- Los estados se referencian por **nombre** y por **id** (`estados_vale.id`,
  FK en `vales.estado_id`): renombrar solo cambia el `nombre`; **no cambies
  los ids**.

Orden seguro: (1) migración SQL que renombra `estados_*.nombre` y actualiza
`vale_historial`; (2) cambio del código y del seed en el mismo despliegue;
(3) probar un vale de punta a punta (crear → autorizar → talleres → fusión →
confirmar, una modificación y un rechazo). No hay compatibilidad hacia atrás:
código y base deben cambiar juntos.

### Atención con los homónimos

- `APROBADO` (taller) está contenido en `APROBADO_DEPARTAMENTO` (general):
  un buscar-y-reemplazar de `APROBADO` rompe el segundo. Usa búsqueda por
  palabra completa (`grep -w`).
- `CONFIRMADO` (etiqueta visible al asesor) y `RECIBIDO` (estado real) son el
  **mismo momento**: si cambias el nombre de uno, decide si el otro debe
  cambiar igual para no volver a confundir.
- `CREADO` es a la vez el estado general y el nombre visible que el asesor ve
  también para `APROBADO_DEPARTAMENTO`; `MODIFICADO` se usa para dos cosas
  (estado real del `MOD-` y etiqueta del asesor). Si gerencia quiere nombres
  más claros, estos son los que más conviene separar.
