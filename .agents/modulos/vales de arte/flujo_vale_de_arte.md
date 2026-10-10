# Flujo del módulo "Vales de Arte" (estado real del sistema)

Referencia del flujo tal como lo implementa el código en `src/modules/vales/`
(verificado contra los servicios el 2026-10-09). Si este archivo y el código
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
- Toda transición se serializa con un lock por vale (`valeMutex`); además, el cupo del supervisor y el "un solo vale en proceso" del diseñador se serializan en colas por supervisor y por diseñador (`conColaDeSupervisor`, `conColaDeDisenador`). Se anota en
  `vale_historial`.
- Hora de referencia: UTC-6 fijo (Guatemala), calculado por offset, no por la
  zona horaria del servidor.
- Correlativo: `{PAÍS}-{TIENDA}-{MM}{AA}-{N}`, p. ej. `GT-MTC-1026-337`. El país es
  el de la **empresa** de la tienda (`paises.codigo`, 2 letras); `MM` y `AA` son
  el mes (`01`–`12`) y los dos últimos dígitos del año de la creación; `N` es el
  `id` autoincremental del vale: global, no se reinicia y nunca se reutiliza
  (los vales `MOD-` también consumen `id`, por eso puede haber saltos). Sin país
  configurado en la tienda no se puede crear el vale. El vale de modificación lleva
  el prefijo `MOD-` delante del correlativo **idéntico** al del original
  (`MOD-GT-MTC-1026-337`). Los vales anteriores conservan su correlativo
  (`MTC-KO-245`); el Buzón ordena por el último número.

## 0.1 Máquina de estados: catálogo completo

Un vale tiene **dos máquinas de estados** que viven en tablas distintas. Los
nombres técnicos (la columna "Código") son los que usa el código y la base de
datos; la columna "Etiqueta" es lo que se muestra hoy en pantalla
(`public/modules/vales/js/config/estados.js`). Para renombrar, ver §9.

### A. Estado GENERAL (`vales.estado` → tabla `estados_vale`)

| id | Código | Etiqueta en pantalla | Qué significa | Entra por | Sale por |
|---|---|---|---|---|---|
| 1 | `ESPERANDO_AUTORIZACION` | Esperando Autorización | El vale existe pero ningún taller lo ve aún; espera al supervisor del asesor. No tiene filas en `vale_talleres`. Tiene vigencia de N horas laborales (§1, §5.1). Es el estado de espera de un vale **normal** (el `MOD-` espera en `SOLICITANDO_MODIFICACION`). | El asesor crea el vale · el asesor reenvía uno `RECHAZADO` | Autorizar → `CREADO` · Rechazar → `RECHAZADO` · Baja o vencimiento → **se borra** |
| 9 | `RECHAZADO` | Rechazado | El supervisor devolvió un vale **normal** al asesor con un motivo (≤ 50 palabras). El asesor puede corregirlo, reenviarlo o darlo de baja. (Una modificación rechazada no pasa por aquí: se elimina.) Conserva la vigencia original. | El supervisor rechaza la creación | Reenviar → `ESPERANDO_AUTORIZACION` · Baja o vencimiento → se borra |
| 2 | `CREADO` | Creado | Autorizado; los talleres lo trabajan en paralelo (estado por taller, §2). El estado general no cambia mientras algún taller no esté `APROBADO`. | El supervisor autoriza la creación | Todos los talleres `APROBADO` → `PENDIENTE_CONFIRMACION` (1 taller) o `APROBADO_DEPARTAMENTO` (2+) |
| 3 | `APROBADO_DEPARTAMENTO` | Aprobado por Talleres | Todos los talleres aprobaron y falta la **fusión manual** de sus propuestas (§1, cola de quien tenga `vales.aprobar_general`). | Último taller aprueba, con 2+ talleres (también un `MOD-`, que va a los mismos talleres que su original) | Se adjunta el documento de fusión → `PENDIENTE_CONFIRMACION` |
| 4 | `PENDIENTE_CONFIRMACION` | Pendiente Confirmación | El trabajo está listo; el asesor debe confirmar de recibido o pedir una modificación (al pedirla, el vale pasa a `RECIBIDO` de inmediato). | Último taller aprueba con 1 taller · se fusionó | Confirmar → `RECIBIDO` · solicitar una modificación → `RECIBIDO` |
| 5 | `RECIBIDO` | Recibido (al asesor se le muestra **Confirmado**) | Terminal. El asesor confirmó o solicitó una modificación: el atraso queda congelado y se registra la fecha de confirmación (aparece en «Trabajo realizado»). Puede recibir otra solicitud de modificación mientras no haya una autorizada. | El asesor confirma · el asesor solicita una modificación | — |
| 6 | `SOLICITANDO_MODIFICACION` | Solicitando Modificación | Estado **del vale `MOD-`** mientras espera la decisión del supervisor (el equivalente a `ESPERANDO_AUTORIZACION` de un vale normal). Tiene vigencia de N horas laborales. El original **ya no pasa por este estado**. | El asesor solicita la modificación (el `MOD-` nace aquí) | Autorizar → `MODIFICADO` · Rechazar, baja o vencimiento → se **borra** el `MOD-` (el original ya quedó `RECIBIDO`) |
| 7 | `MODIFICADO` | Modificado | Estado del vale **`MOD-`** desde que se autoriza hasta que pasa a confirmación: lo que `CREADO` es para un vale normal. Corre el ciclo de taller. Se conserva para distinguirlo (etiqueta «Modificado» y contador «Modificados» del supervisor). | El supervisor autoriza la modificación | Mismos caminos que `CREADO` (§1.1) |
| 8 | `CONFIRMADO` | Confirmado | **No se guarda nunca en `vales.estado` ni en `vale_historial`** (el historial registra `RECIBIDO`, el estado real): existe en el catálogo y en el código, pero solo sirve como etiqueta que ve el asesor (`estadoVisibleAsesor`). En la base, un vale confirmado está en `RECIBIDO`. | — | — |

Diagrama general (flujo feliz y desvíos):

```
                       ┌──────────── asesor corrige / reenvía ────────────┐
                       ▼                                                    │
 asesor crea ─► ESPERANDO_AUTORIZACION ── supervisor rechaza ─► RECHAZADO ──┘
                       │   │                                        │
                       │   └── baja (asesor) / vence N h laborales ─► [vale borrado]
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
        asesor confirma      asesor solicita modificación (el original pasa a RECIBIDO)
                   ▼              ▼
               RECIBIDO      nace el vale MOD-:  SOLICITANDO_MODIFICACION
                   ▲                                │          │
                   │ (el original ya está           │          └── supervisor rechaza ──► se BORRA el MOD-
                   │  RECIBIDO desde la solicitud)  │ supervisor autoriza
                   │                                ▼
                   └───────────────────────────  MODIFICADO ─► ciclo de taller (§2) ─► PENDIENTE_CONFIRMACION
                                                                          / APROBADO_DEPARTAMENTO ─► RECIBIDO
        Rechazo, baja del asesor o N h laborales sin autorizar: el MOD- se borra y el original sigue RECIBIDO.
```

### B. Estado por TALLER (`vale_talleres.estado` → tabla `estados_taller`)

| id | Código | Etiqueta en pantalla | Qué significa | Entra por | Sale por |
|---|---|---|---|---|---|
| 1 | `PENDIENTE_ASIGNACION` | Pendiente Asignación | Adjuntos verificados; el encargado aún no elige diseñador. | Verificación de adjuntos (sección 2.1) | Encargado asigna diseñador → `ASIGNADO` |
| 2 | `ASIGNADO` | Asignado | Tiene diseñador, aún no empieza. | Asignación · el encargado **desaprueba** y reasigna | Diseñador comienza → `EN_PROCESO` |
| 3 | `EN_PROCESO` | En Proceso | El diseñador trabaja (solo 1 por diseñador). | Comenzar · reanudar | Entregar o cancelar → `EN_REVISION` · Pausar → `EN_PAUSA` |
| 4 | `EN_PAUSA` | En Pausa | El diseñador detuvo el trabajo. | Pausar | Reanudar → `EN_PROCESO` |
| 5 | `EN_REVISION` | En Revisión | Entregó propuesta (o canceló sin propuesta) y espera al encargado. | Entregar / cancelar | Aprobar → `APROBADO` · Desaprobar → `ASIGNADO` |
| 6 | `APROBADO` | Aprobado | El taller terminó (con propuesta con archivo). | Aprobación del encargado (o autoaprobación si se autoasignó y entregó con archivo) | — |
| 7 | `VERIFICANDO_ADJUNTOS` | Verificar adjuntos | Estado inicial de todo taller: el encargado debe confirmar que recibió los adjuntos por correo. | El supervisor autoriza (una fila por taller) | Verifica → `PENDIENTE_ASIGNACION` · Rechaza → `ADJUNTOS_RECHAZADOS` |
| 8 | `ADJUNTOS_RECHAZADOS` | Esperando adjuntos | El encargado rechazó el taller por no haber recibido los adjuntos; espera al asesor (plazo único de N horas laborales). | Rechazo del encargado | El asesor responde → `ADJUNTOS_RESPONDIDOS` · Vence → se borra el vale |
| 9 | `ADJUNTOS_RESPONDIDOS` | Adjuntos enviados, verificar | El asesor avisó que envió los adjuntos; el vale vuelve al encargado. | Respuesta del asesor | Verifica → `PENDIENTE_ASIGNACION` · Rechaza → `ADJUNTOS_RECHAZADOS` |

> Los nombres de los dos niveles **no colisionan** (por eso comparten
> diccionario de etiquetas): `APROBADO` es de taller y `APROBADO_DEPARTAMENTO`
> es general. Cuidado al renombrar uno: `APROBADO` es subcadena del otro.

### C. Lo que ve cada rol (estado "visible")

- **Asesor** (y el **Supervisor** solo en "Trabajo realizado") no ve el estado
  real, sino una versión colapsada (`estadoVisibleAsesor`, calculada en el
  servidor y enviada como `estado_visible`): `CREADO`/`APROBADO_DEPARTAMENTO` →
  **Creado**; `RECIBIDO` → **Confirmado**; el vale `MOD-` se muestra como
  **Solicitando Modificación** o **Rechazado** mientras está pendiente y como
  **Modificado** en talleres, hasta `PENDIENTE_CONFIRMACION`. El resto se muestra igual.
- **Encargado de taller y diseñador** ven el estado **de la fila de su taller**
  (`estado_taller`, sección B), no el general.
- **Administrador y Gerente** ven el estado general real.
- Un vale `MOD-` es un vale más en los listados: aparece como fila propia
  desde que se solicita (ver §1.1).

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
     ▼                                    │ (debe haber abierto "Ver"
 Pasa a RECHAZADO y vuelve al ASESOR      │  antes; sin tope diario)    
 con un motivo (≤ 50 palabras): puede     │                                 
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
          │ (sella confirmado_en y                              │ (ver §1.1; pasa a RECIBIDO y
          │  congela el atraso)                                 │  también se permite desde RECIBIDO)
          ▼                                                     │
     ┌──────────┐                                               │
     │ RECIBIDO │  (terminal)                                   │
     └────┬─────┘                                               │
          │ el asesor aún puede solicitar modificación ─────────┤
                                                                ▼
                                              ┌───────────────────────────┐
                                              │  nace el vale MOD- en     │
                                              │  SOLICITANDO_MODIFICACION │
                                              └──────────────┬────────────┘
                                                             │ (ver §1.1; el original pasa a RECIBIDO)
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
- **Vigencia de N horas laborales:** un vale nuevo en `ESPERANDO_AUTORIZACION`, una solicitud
  de modificación (`MOD-` en `SOLICITANDO_MODIFICACION`) o un vale normal
  en `RECHAZADO` se **elimina solo** (con sus archivos) cuando vence su plazo de N horas
  laborales (§5.1) si nadie lo autoriza; cuando queda el 25% del plazo (en tiempo laboral) se avisa
  una vez al asesor y a sus supervisores (`vigenciaWatcher.js`, cada 60 s). Aplica solo a vales
  creados desde que existe esta regla.
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
  acción "rechazar"**: sigue el mismo camino que una modificación (§1.1: el original pasa a
  `RECIBIDO` al pedirla).
- La propuesta/fusión **no se pega dentro del PDF de un vale normal**. El PDF es el
  documento administrativo del vale (encabezado, cliente, venta, firma); la
  propuesta queda aparte, accesible con "Ver propuesta". **Excepción:** el PDF de un
  vale `MOD-` lleva al final la propuesta del vale original (§1.1).
- **Nunca un PDF a medias:** cada PDF adjunto que se fusiona se descarga con hasta 3
  intentos; si no se puede traer o leer, **no se genera el PDF** y se muestra un error con
  el nombre del archivo (el vale no cambia). El log del servidor (`[ValePdfService]`)
  indica el correlativo, el id, el archivo, la URL y la causa: el archivo ya no existe
  (404), sin permiso (403), error del servidor (5xx), sin conexión o tiempo agotado, no es
  un PDF o está dañado. Para repararlo, se corrige la URL de la fila de `vale_documentos`
  o se vuelve a subir el archivo. Al autorizar, el PDF con la firma se genera **antes** de
  tocar la base y todo se confirma en una sola transacción.
- El PDF se genera al crear el vale y se regenera al autorizar (firma roja con
  el supervisor, CREACIÓN/MODIFICACIÓN y la fecha y hora de la autorización),
  al aprobar una modificación y al fusionar. Se sube a Supabase Storage; en
  MySQL solo se guarda la URL.

### 1.1 Modificación

La solicitud de modificación crea **un vale nuevo** (`MOD-<correlativo>`) y deja el original en
`RECIBIDO`. El `MOD-` nace completo al solicitar; su estado de espera es
`SOLICITANDO_MODIFICACION` y, al autorizarse, va a los mismos talleres del original.

```
 Asesor solicita modificación (desde PENDIENTE_CONFIRMACION o RECIBIDO)
   · el ORIGINAL pasa a RECIBIDO en ese mismo momento: se congela su atraso, se registra la
     fecha de confirmación y aparece en "Trabajo realizado"; queda con la marca "MOD en trámite"
   · mismo formulario de "Corregir", con los archivos precargados y los talleres FIJOS
   · debe escribir una justificación (va en la descripción: máx. 600 caracteres)
   · se valida el cupo diario de los talleres destino (como aviso)
   · nace el vale MOD- en SOLICITANDO_MODIFICACION, con N horas laborales de vigencia y su PDF ya armado:
     el vale con sus campos e imágenes, luego la «Propuesta original - <correlativo>.pdf»
     del vale original y por último los demás PDF adjuntos. Si la propuesta no se puede
     descargar, no se crea nada y el original no cambia.
        │
        ▼  Supervisor del asesor (debe abrir "Ver" el MOD-; ve la justificación)
 ┌──────────────┴───────────────────────────────┐
 │ RECHAZA (motivo ≤ 50 palabras)               │ AUTORIZA
 ▼                                              ▼
 El MOD- se ELIMINA con sus archivos            El MOD- pasa a MODIFICADO:
 (menos los que comparte con el original).      · autorizado (tipo MODIFICACION)
 El asesor recibe una notificación con el       · fan-out INMEDIATO a los talleres del
 motivo. El original ya está RECIBIDO y puede     original (cupo revalidado ahora)
 pedir otra modificación.                       · el PDF se regenera SOLO para estampar la
                                                  firma y la fecha de autorización
                                                · el original queda con `modificado = 1`
                                                        │
                                                        ▼
                      el MOD- corre el ciclo de taller normal (§2). Al terminar:
                      · si el ORIGINAL fue a 1 solo taller → PENDIENTE_CONFIRMACION
                      · si el ORIGINAL fue a 2+ talleres → APROBADO_DEPARTAMENTO
                        (fusión), pues el MOD- fue a todos esos talleres
                      Luego el asesor lo confirma → RECIBIDO.
```

- **Corregir un `MOD-` pendiente** (permiso `vales.corregir`, mientras espera autorización) se
  permite, pero la «Propuesta original» **no se puede quitar ni mover** y los **talleres no se
  pueden cambiar** (son los del original). Un `MOD-` ya autorizado no se puede corregir.
  No hay «reenviar» para las modificaciones: una rechazada se elimina y se pide una nueva.
- **Baja** (permiso `vales.dar_de_baja`; antes de autorizar, o ya autorizado mientras un taller
  reclama adjuntos) o **vencimiento** (N horas laborales sin autorizar, o el plazo de adjuntos): el `MOD-`
  se borra con sus archivos, **sin tocar los del original** (ni su PDF ni su propuesta). Si el
  `MOD-` ya estaba autorizado y se elimina después, el original vuelve a `modificado = 0` y
  puede pedir otra modificación (la primera nunca se trabajó); queda una fila en su historial.
- Son **dos registros y dos PDF independientes**: el original nunca se sobreescribe; "Ver PDF"
  del original sirve siempre el del original.
- Se permite **una** modificación autorizada: no puede modificarse un vale con `modificado = 1`,
  ni un vale `MOD-`, ni uno que ya tenga un `MOD-` en trámite.
- El **supervisor** autoriza o rechaza usando el id del propio `MOD-`
  (`aprobar-modificacion` / `rechazar-modificacion`), nunca el del original.
- Las notificaciones (rechazo con su motivo, aviso de «por vencer» (25% del plazo), eliminación por baja o por
  vencimiento) nombran el vale: «Vale: MOD-…» y aclaran que el original ya quedó Recibido.
- Las tablas `vale_solicitudes_modificacion` y `estados_solicitud_modificacion`
  (`PENDIENTE`/`APROBADA`/`RECHAZADA`) **ya no se usan**. Pueden retirarse más
  adelante y no hay que renombrar nada en ellas.
- Al asesor, el estado de un vale `MOD-` se le muestra como `SOLICITANDO_MODIFICACION`
  mientras está pendiente, `MODIFICADO` en talleres, y `CONFIRMADO` al recibirse; el de un
  vale normal `RECIBIDO` se le muestra como `CONFIRMADO` (`estadoVisibleAsesor`).

## 2. Estado por TALLER (`vale_talleres.estado`)

Nace cuando el Supervisor autoriza la creación (o aprueba la modificación), en `VERIFICANDO_ADJUNTOS`: el diagrama siguiente arranca cuando el encargado verifica los adjuntos (sección 2.1).

```
        ┌─────────────────────────┐
        │   PENDIENTE_ASIGNACION   │
        └────────────┬─────────────┘
                     │ el encargado del taller asigna un diseñador
                     │ (de su mando, o a sí mismo)
                     ▼
               ┌───────────┐ ◄────────────────────────────────────┐
               │  ASIGNADO │                                       │
               └─────┬─────┘                                       │
                     │ diseñador "comenzar"                          │ encargado DESAPRUEBA:
                     │ (solo 1 vale EN_PROCESO por diseñador)        │ debe indicar a qué diseñador
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

- **Entregar con archivo vs. sin archivo:** si el diseñador entrega sin archivo,
  se dispara una alerta roja y el encargado no podrá aprobar, solo
  desaprobar/reasignar. Cancelar el proceso deja el taller en `EN_REVISION`
  igual que una entrega vacía (no crea fila en `vale_propuestas`; solo queda
  en el historial).
- **Autoasignación:** un encargado puede asignarse el vale (o reasignárselo
  tras desaprobar) a sí mismo. Si luego entrega **con archivo**, su trabajo se
  **autoaprueba** en el mismo paso (no pasa por revisión de sí mismo).
- **Asistente de Diseño:** opera como "clon" del encargado del taller al que
  esté vinculado (`taller_disenadores`), para asignar, revisar y ver el buzón.
- Un encargado solo actúa sobre la fila de **su propio** taller; el
  Administrador, si el vale tiene un solo taller, sobre esa fila, y si tiene
  varios debe indicar el taller.

### 2.1 Verificación de adjuntos (antes de asignar)

Los adjuntos de un vale (vectores, fuentes, etc.) viajan por **correo**, fuera del módulo: el sistema no detecta si llegaron. Por eso cada taller que recibe un vale, normal o `MOD-`, **debe verificar los adjuntos antes de poder asignarlo**.

```
 autorización / aprobación de modificación
                  │
                  ▼
        VERIFICANDO_ADJUNTOS ◄──────────────┐
          │ verifica     │ rechaza           │ rechaza otra vez
          │              ▼                   │
          │      ADJUNTOS_RECHAZADOS         │
          │              │ el asesor responde│
          │              ▼                   │
          │      ADJUNTOS_RESPONDIDOS ───────┘
          │              │ verifica
          ▼              ▼
              PENDIENTE_ASIGNACION  →  (flujo normal de la sección 2)
```

- **Quién:** el permiso `vales.verificar_adjuntos` lo tienen los roles 4, 5, 9 y 10 (encargados de taller) y el 7 (asistente, solo Diseño). Cada uno actúa solo sobre **su** taller. **Rechazar es un rechazo general con mensaje obligatorio** (1 a 200 caracteres) para el asesor, que abre la conversación de ese taller (ver «Conversación del rechazo»). **Verificar** pide confirmación en un modal («¿Estás seguro que recibiste los adjuntos del vale de arte antes de trabajar?»); rechazar también tiene su modal.
- **Por taller:** un taller que rechaza no frena a los demás del mismo vale; el asesor responde **una vez por taller** rechazado.
- **Respuesta del asesor** (permiso `vales.corregir`, solo el dueño del vale): botón «Adjuntos enviados al correo», con un mensaje editable de hasta 200 caracteres, prellenado con «Adjuntos enviados al correo». El mensaje es **obligatorio**: vacío o solo espacios se rechaza («Escribe un mensaje.») y el botón «Enviar» se deshabilita sin texto; si falta el taller, el error dice «Indica a qué taller respondes.». El vale vuelve al encargado, que ve el mensaje y puede verificar o rechazar otra vez (el ciclo se repite). Mientras el asesor no responde, el encargado no tiene acciones; un supervisor que no es el dueño solo ve el estado, sin botón de respuesta.
- **Plazo único de N horas laborales** desde el **primer** rechazo del taller (`vale_talleres.adjuntos_vence_en`): no se reinicia con rechazos posteriores. Cuando queda el 25% del plazo (en tiempo laboral) se avisa **una sola vez por taller** al asesor, a sus supervisores y al encargado de **cada** taller del vale (encargado + asistentes, no a los diseñadores); si dos talleres tienen adjuntos rechazados en esa ventana, cada persona recibe un aviso por taller. En cambio, cuando un taller **verifica** sus adjuntos el aviso va solo a ese taller (más el asesor y los supervisores): los demás talleres no se enteran. Si vence con el taller todavía en `ADJUNTOS_RECHAZADOS`, se **borra el vale completo** (todos sus talleres, aunque otros ya trabajen) con sus archivos y se libera el cupo del supervisor; un vale `MOD-` deja el original intacto. Si el asesor ya respondió, no se borra, aunque el encargado rechace después de pasado el plazo (en ese caso el siguiente chequeo lo borra). Lo hace `adjuntosWatcher.js` (60 s), calcado de `vigenciaWatcher.js`.
- **Dar de baja:** el asesor puede dar de baja un vale **ya autorizado** mientras algún taller esté en `ADJUNTOS_RECHAZADOS` o `ADJUNTOS_RESPONDIDOS` (no en `VERIFICANDO_ADJUNTOS`). Cancela el vale completo; los talleres que ya trabajaban, sus encargados y el diseñador asignado reciben un aviso y el vale desaparece de su vista.
- **Qué ve cada uno:** el encargado conserva el vale en la lista normal de «Pendientes de asignar» (los tres estados suman al contador) con la etiqueta «Verificar adjuntos», «Esperando adjuntos» o «Adjuntos enviados, verificar». El asesor y el supervisor ven el paso 2 del pipeline **en rojo** con «Faltan adjuntos: <taller>» y, en «ver adjuntos faltantes», el motivo; el supervisor ve exactamente la misma lista que antes. El historial del vale solo lo ve quien tiene `vales.ver_historial` (hoy el Administrador); sin ese permiso el servidor devuelve el historial vacío.
- **Conversación del rechazo** (tabla `vale_taller_mensajes`, `database/mensajes_rechazo.sql`): hilo ligado al taller dentro del vale, de máximo 200 caracteres por mensaje y **sin límite de cantidad** de mensajes. Escriben el encargado/asistente del taller y el asesor dueño solo mientras el taller esté en `ADJUNTOS_RECHAZADOS` o `ADJUNTOS_RESPONDIDOS` (no cambia estados ni plazos; «Ya lo atendí: avisar al taller», verificar y rechazar de nuevo siguen disponibles). **Cuando el taller verifica los adjuntos (acuerdo) la conversación deja de verse** para el asesor y el encargado: el servidor ya no devuelve mensajes y solo queda el registro. Los mensajes se **conservan** (se eliminan junto con el vale, por llave foránea `ON DELETE CASCADE`: plazo vencido, baja o rechazo del supervisor) y los ve, dentro del historial del vale, quien tiene `vales.ver_historial`. Si tras «Ya lo atendí» el taller rechaza otra vez, continúa la misma conversación. Líneas del historial: rechazo con su mensaje, «Asesor avisó que atendió el rechazo (taller)» y, al verificar, «… Conversación cerrada: se llegó a un acuerdo (N mensajes)». Rutas: `GET/POST /api/vales/:id/mensajes`; `rechazar-adjuntos` exige `mensaje`. **Avisos:** el rechazo llega al asesor y a sus supervisores como «<encargado> (<taller>): Rechazado (ver mensaje)»; los mensajes del taller avisan solo al asesor y los del asesor solo al taller (el **supervisor no recibe aviso ni campana** de los mensajes porque no puede leer la conversación). Cuando el asesor responde con «Ya lo atendí», el supervisor y las otras pestañas del asesor **refrescan la pantalla en silencio** (evento `vale_refrescar`), sin cartel. **Límite conocido:** el servidor convierte a texto cualquier `mensaje` que no sea una cadena (un objeto llegaría como «[object Object]»); el formulario nunca lo envía, solo se logra llamando a la API a mano.
- **Avisos** (`tipo`): `ADJUNTOS_RECHAZADOS`, `ADJUNTOS_VERIFICADOS`, `ADJUNTOS_RESPONDIDOS`, `ADJUNTOS_POR_VENCER`, `ADJUNTOS_VENCIDOS`, `MENSAJE_RECHAZO`.

## 3. Roles y permisos

Permisos del seed (`database/seed.sql`) por rol. El backend valida el
**permiso**; cambiar los permisos de un rol desde el panel de administración
cambia quién puede hacer cada acción.

| Rol (id) | Permisos de vales | Qué hace |
|---|---|---|
| Administrador (1) | `vales.ver`, `vales.ver_reportes`, `vales.ver_historial` (+ `admin.*`) | Ve todo el buzón. **No** tiene permisos de escritura sobre vales: no puede autorizar, asignar, aprobar ni confirmar. |
| Asesor de Ventas (2) | `ver`, `crear`, `editar`, `confirmar`, `solicitar_modificacion`, `dar_de_baja`, `corregir` | Crea vales; los corrige o da de baja antes de ser autorizados; confirma el recibido o solicita la modificación. |
| Supervisor de Ventas (3) | `ver`, `autorizar_creacion`, `aprobar_modificacion`, `supervisar`, `ver_gerencia`, y para sus propios vales `crear`, `confirmar`, `solicitar_modificacion`, `dar_de_baja`, `corregir` | Autoriza/rechaza creaciones y aprueba/rechaza modificaciones **solo de los asesores bajo su mando** (`supervisor_tiendas`). También crea y gestiona **sus propios vales** (ver «Vales del supervisor» abajo). Puede haber varios supervisores por tienda (rotativos). Ve su vista Rendimiento. |
| Encargado de Diseño (4) | `ver`, `asignar`, `revisar`, `trabajar`, **`aprobar_general`** | Dueño del taller "Diseño". Asigna y revisa, puede trabajar vales él mismo, y **fusiona** los vales multi-taller. |
| Encargado de Diseño UV/3D (5) | `ver`, `asignar`, `revisar`, `trabajar` | Dueño del taller "Diseño UV/3D". Sin fusión. |
| Diseñador (6) | `ver`, `trabajar` | Comienza, pausa, reanuda, cancela y entrega sus vales. |
| Asistente de Diseño (7) | `ver`, `asignar`, `revisar`, `trabajar`, **`aprobar_general`** | Clon operativo completo del Encargado de Diseño. |
| Gerente (8) | `ver`, `ver_gerencia` | Solo lectura (ver §6). |
| Encargado de Protextil (9) | `ver`, `asignar`, `revisar`, `trabajar` | Encargado de su taller; puede trabajar vales él mismo, pero **sin fusión**. |
| Diseño Local (10) | `ver`, `asignar`, `revisar`, `trabajar` | Encargado de un taller de Diseño Local (ligado a una tienda); sin fusión. |

> **Nombre del rol 6.** El rol que trabaja los vales en el taller se llama **Diseñador** (antes
> «Técnico»), en pantalla, en la base y en el código: `vale_talleres.disenador_id`,
> `taller_disenadores`, `ROL.DISENADOR`, las salas `disenador:<id>` y las rutas `/disenadores`.
> Las cuentas del rol son `disenadorN@grupopremia.com` (ver `database/users.sql`).

### Historial del vale

La acción «Ver historial» y el contenido del historial dependen del permiso `vales.ver_historial`, que hoy tiene **solo el Administrador** (rol 1). Sin el permiso la acción no se muestra (Buzón, Encontrar vale y Rendimiento) y además el servidor devuelve el historial vacío en el detalle del vale (`GET /api/vales/:id`). Con el permiso, cada rol sigue viendo las categorías que le corresponden (`_filtrarHistorialPorRol`). Se asigna a otros roles desde el seed o desde el panel de administración.

### Vales del supervisor

Todo supervisor de ventas puede crear vales, además de supervisar (p. ej. el de Comercialización). Requisitos y reglas:

- **Datos:** el usuario debe tener una fila en `supervisores` **y** otra en `asesores`; esta última le da la tienda (`asesores.tienda_id`) de la que sale el correlativo y los talleres que puede elegir. Su rol sigue siendo Supervisor (3): los chequeos de servidor aceptan «asesor o supervisor» (`puedeActuarComoAsesor`) y la propiedad del vale decide qué puede tocar como asesor.
- **Permisos del rol 3** para sus vales: `crear`, `confirmar`, `solicitar_modificacion`, `dar_de_baja` y `corregir`.
- **Autoriza también los suyos:** sus vales y sus modificaciones los autoriza o rechaza **él mismo**, o cualquier otro supervisor que cubra su tienda (`supervisor_tiendas`). Rigen las mismas reglas que para un asesor (abrir «Ver» antes de autorizar, rechazo con justificación, vigencia de 24 h…).
- **Sin supervisor, no se crea:** si ningún supervisor cubre su tienda, no puede crear («Tu tienda no tiene ningún supervisor que pueda autorizar tus vales…»); el vale quedaría sin nadie que lo autorice.
- **Sin cupo colectivo:** el supervisor autoriza sin tope diario (gerencia retiró el límite colectivo). Lo único que frena una autorización es el cupo diario del taller (§5), que la fecha de entrega no esté por debajo de la mínima vigente (§5.1) y haber abierto «Ver» antes.
- **Buzón:** el Buzón del supervisor lista, además de lo de su equipo, **sus propios vales en todos sus estados activos** (esperando, rechazado, en talleres, por confirmar…), con el mismo criterio de orden, y cuentan en los contadores como los de su equipo. Sus vales confirmados salen en «Trabajo realizado» y cuentan en su Rendimiento. Sobre sus vales ve además las acciones de asesor (corregir, reenviar, dar de baja, confirmar, modificar); sobre los de su equipo, solo las de supervisión.
- **Tiempo real:** recibe lo de sus vales en la sala `asesor:<su id>` además de `supervisor:<su id>`.

### Quién fusiona

La acción de fusionar **no está amarrada a un rol**, sino al permiso
`vales.aprobar_general` (`POST /:id/aprobar-general`): el backend solo exige
ese permiso. Hoy lo tienen los roles 4 y 7. Ojo: la **cola** de
`APROBADO_DEPARTAMENTO` se arma en el buzón de los roles de encargado de taller
(4, 5, 7, 9, 10), así que quien tenga el permiso y esté en uno de esos roles la
verá mezclada en su buzón de taller (no es un buzón aparte). Un rol de otro tipo
(asesor, supervisor, diseñador, gerente) con el permiso no vería la cola. No existe un rol
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
| Asesor | Por autorizar · Por asignar · En proceso · En revisión · Por recibir (uno por paso del pipeline, §10) + los interruptores **Modificados** y **Atrasados**, que se combinan con cualquiera. Excluye RECIBIDO. | Vales `RECIBIDO` (un vale confirmado sigue ahí aunque tenga una modificación en curso). Total y recibidos hoy. |
| Supervisor | Los mismos contadores por paso, Modificados y Atrasados que el asesor, sobre **todos los vales activos de su equipo** (y los que crea él). | Dos grupos: lo que **él** autorizó (por fecha de autorización) y lo que sus asesores confirmaron (por `confirmado_en`). Un vale que cae en ambos aparece una vez. |
| Encargado de taller | Por asignar · Asignado (en manos de diseñadores: asignado, en proceso o en pausa) · Mis asignaciones (los que él mismo se asignó) · Por revisar · Atrasados (+ **Por fusionar** si tiene `aprobar_general`), y un combobox para filtrar por diseñador. Muestra el estado **de la fila de su taller**, no el general. | Vales con fila `APROBADO` en su taller (con "Ver propuesta" de su diseñador), + sus fusiones si fusiona. |
| Diseñador | Mis asignaciones (sin retraso) · Mis asignaciones (con atraso) · Vale en proceso (ve también `EN_PAUSA` y `EN_REVISION` en la lista). | Vales que su taller aprobó, con su propuesta. |
| Administrador | Todo, con contadores generales (total, atrasados, recibidos hoy, pendientes de confirmación, por fusionar). | — |
| Gerente | Buzón general en solo lectura (como el Administrador, sin acciones): ver §6. | — |

Una solicitud de modificación aparece como **fila propia** (`MOD-…`) en el Buzón
del asesor y del supervisor (contadores «Solicitando modificación» y «Por
autorizar modificación»). El vale original ya pasó a `RECIBIDO` al
solicitarse la modificación (§1.1): aparece en «Trabajo realizado» con la marca
«MOD en trámite».

**Insignia de persona** (bajo el correlativo, `badgePersona`): el supervisor ve el asesor
que creó el vale; el encargado de taller (y el asistente, Protextil y Diseño Local) ve el
diseñador asignado o «Sin asignar» (las filas de fusión no llevan insignia). Asesor,
diseñador, gerente y administrador no la ven, y tampoco aparece en «Encontrar vale» ni
en la tabla de vales críticos de Rendimiento. El servidor agrega `persona = {rol, nombre}`
a cada fila (`valeBuzonService`); el diseño está en `documentacion/correcciones_46.md`.

"Atrasados" y "Modificados" (asesor y supervisor) son los únicos contadores que se **combinan** con cualquier otro filtro
activo (los demás contadores son mutuamente excluyentes). Además hay búsqueda
por correlativo/cliente/empresa, orden por columna
(reemplaza la jerarquía de negocio mientras está activo), ventana de tiempo
por **fecha de entrega** (`Todo` —el valor por defecto—, `Hoy`, un **mes** o un **día**
elegidos en el selector de período, o rango Desde/Hasta; elegir mes o día reemplaza el
rango) y paginación por cursor de 50 en 50. El desplegable de filtro por estado ya no existe.

El selector de período abre un panel de dos niveles: el calendario del mes (un día filtra solo ese
día) y, al pulsar el título del mes, una cuadrícula de meses con flechas de año (un mes filtra todo ese
mes; también «Todo el mes» desde el calendario). Las flechas ‹ › avanzan de mes en mes o de día en día
según lo elegido. Un día viaja al servidor como un rango de un solo día.

## 5. Límites y cupos

| Límite | Dónde se valida | Efecto |
|---|---|---|
| **Cupo diario por taller** (`talleres.limite_diario`, opcional; NULL = sin límite; hoy Diseño y Diseño UV/3D = 15, Protextil = 8, Diseño Local sin límite), sobre la fecha de **entrega** (no la de evento) | Al **crear**, al **solicitar** la modificación, al **autorizar** y al **aprobar** la modificación | Solo cuentan los vales **ya autorizados**: uno pendiente de autorización no ocupa cupo. Por eso el asesor puede crear aunque el día se llene con otros pendientes; si al **autorizar** ya no hay cupo, el supervisor debe **rechazar** el vale y el asesor elige otra fecha. Bloquea con un mensaje amigable ("el taller X ya no tiene cupo para el día…"). Las verificaciones + inserción son atómicas entre asesores (`conColaDeCapacidad`). El calendario del frontend solo lo anticipa. |
| Un diseñador = un vale `EN_PROCESO` | `comenzar` y `reanudar` (en la cola del diseñador: dos acciones simultáneas no lo superan) | Debe entregar, cancelar o pausar el actual antes. |
| Una sola modificación por vale | `solicitarModificacion` | Ver §1.1. |
| Adjuntos | `routes.js` | Máx. 5 MB por archivo (imágenes, PDF, propuesta y fusión); JPEG/PNG/WebP/PDF; hasta 10 imágenes y 5 documentos al crear. Un tipo no permitido se **rechaza** con un 400 (no se descarta en silencio). |

Validaciones de formulario (creación y modificación): cliente (nombre,
teléfono y correo válido) obligatorio, producto y material obligatorios,
cantidad > 1, cotización > 0, fecha de evento posterior a la de entrega y
entrega igual o posterior a la fecha mínima de entrega (§5.1). Técnica y acabado son opcionales. Un vale es
**urgente** automáticamente si faltan menos de 3 días para la entrega (entrega hoy, mañana o pasado mañana): lo calcula el servidor (`calcularUrgente`) al crear, corregir o solicitar la modificación; el formulario no tiene casilla y solo muestra el aviso «Urgente: entrega en menos de 3 días».

> Nota: esto reemplaza al antiguo límite diario por asesor
> (`asesor_limites`), que ya no existe: crear nunca se pospone.

**Talleres del vale.** La lista de talleres que llega al crear se valida entera: cualquier id que no sea un entero positivo (`[1,"x"]`, `[0]`, `[1.5]`, `[null]`) rechaza la creación con «Alguno de los talleres elegidos no es válido», igual que un taller inexistente o inactivo.

### 5.1 Horario laboral, feriados y fecha de entrega

Todo se calcula con la **hora de Guatemala (UTC-6)** para todos los países, nunca con la del navegador. Las reglas salen de lo que el administrador carga en Administración → «Horarios y feriados» (`horarios_laborales`, `feriados`, `parametros_sistema`) y en «Gestionar Talleres» (`talleres.hora_maxima_recepcion`); el código vive en `src/core/calendario/` (reglas puras en `calendarioLaboral.js`, caché y API en `calendarioService.js`).

- **País del vale:** el del destino. Diseño, Diseño UV/3D y Protextil (sin tienda) son de **Guatemala**; un Diseño Local usa el país de **su tienda** (departamento de la tienda; si no tiene país, su subdivisión; si tampoco, el de su empresa). Un vale en espera de autorización toma los talleres de `vales.talleres_solicitados`; ya autorizado, de `vale_talleres`; un `MOD-` usa los del original.
- **Plazo único de N horas laborales** (`horas_vencimiento_vale`, entero de 1 a 48, hoy 4; lo edita el administrador): reemplaza los tres plazos antiguos de 24 h (vale en espera de autorización y su rechazado, `MOD-` y adjuntos tras el primer rechazo). Solo corre **dentro del horario laboral** de cada día (los sábados cuentan sus horas), salta noches, días no laborales y feriados del país del vale (un feriado cuenta si coincide la fecha o, con «se repite todos los años», el día y mes). Un vale creado o rechazado fuera de horario empieza a contar al inicio del siguiente día laboral. Ejemplos con 4 h y L–V 08:00–18:00, sábado 08:00–12:00: viernes 16:55 vence el sábado 10:55; lunes 19:00, el martes 12:00; sábado 11:30, el lunes 11:30; domingo 20:00, el lunes 12:00; lunes 19:00 con martes feriado, el miércoles 12:00. El vencimiento se guarda en `vigencia_hasta` y `adjuntos_vence_en` (`sumarHorasLaborales`) y los vigilantes comparan ese instante.
- **Aviso de «por vencer»:** cuando queda el **25% del plazo en tiempo laboral** (con 4 h, 1 h laboral), una sola vez por plazo, con el texto «le queda aproximadamente X de horario laboral». La etiqueta del buzón se pone ámbar con el mismo umbral.
- **Contador «Vence en N h / N min»:** es el tiempo laboral restante; se detiene fuera de horario. Las fechas absolutas que se muestran («el vale se elimina el DD/MM hh:mm») son el instante guardado.
- **Fecha de entrega:** no puede ser un día que no recibe vales («Recibe vales de arte» = no; hoy el sábado) ni un **feriado** del país del vale. Cada taller tiene una **hora máxima de recibimiento** (12:00 por defecto): si el vale se crea a esa hora o después, no puede pedirse para hoy. La **fecha mínima** es hoy si aún no pasó esa hora y hoy recibe vales y no es feriado; si no, el siguiente día válido. Con varios talleres rige la **más restrictiva** (la mínima más tardía). La fecha del evento sigue siendo posterior a la de entrega. Si ningún día recibe vales, el servidor responde «No hay ningún día configurado para recibir vales de arte».
- **Sin restricciones fuera del horario laboral:** crear, corregir, reenviar, solicitar una modificación, autorizar y aprobar una modificación se pueden hacer cualquier día y a cualquier hora. **Se conserva** que, al autorizar (creación y modificación), si la fecha de entrega es anterior a la mínima vigente sale un error y el supervisor debe **rechazar** el vale para que el asesor cambie la fecha («La fecha de entrega ya pasó…» o «La fecha de entrega ya no está disponible (mínima: …; la hora máxima de recibimiento es …). Rechaza el vale…»). Un feriado cargado **después** de crear el vale no bloquea su autorización.
- **Atraso:** no cambia; sigue contando días corridos. **Fecha de ingreso:** no cambia (`fecha_creacion`/`hora_creacion` son las reales).
- **Sin días laborales:** si todos los días están como «no laboral», el cálculo no puede avanzar y los plazos se cuentan en horas corridas (con un aviso en el log del servidor).
- **Calendario del formulario:** consulta `GET /api/vales/fechas-entrega?talleres=1,2&desde=AAAA-MM-DD&hasta=AAAA-MM-DD` (mismo permiso que `capacidad-entrega`, rango de hasta 93 días) → `{ minima, horaMaxima, noDisponibles: [{ fecha, motivo, detalle }] }` con motivos `NO_RECIBE`, `FERIADO` (con su nombre) y `PASADO`. Se vuelve a pedir al cambiar los talleres y al navegar de mes; los días no disponibles quedan deshabilitados con el motivo en `title`/`aria-label`. Al **crear**, el campo sigue deshabilitado hasta elegir un taller. El servidor revalida siempre (`validarFechaEntrega`).
- **Caché:** el calendario se guarda en memoria; los servicios de Administración lo invalidan al guardar horarios, feriados, el parámetro, la hora máxima de un taller o una tienda (TTL de respaldo de 60 s).
- **Plazos ya guardados:** `scripts/recalcular-vencimientos.js` (ver `correcciones_52.md`).

## 6. Gerente y Administrador

- **`vales.ver`** abre el módulo y la API; además, todo rol con ese permiso que no tenga una vista propia (hoy el Gerente) ve el **Buzón general** con todos los vales, en solo lectura. Las acciones siguen exigiendo sus propios permisos.
- **Gerente** (solo lectura, nunca ejecuta una acción sobre un vale): ve el **Buzón** general, la
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
  2. el asesor solicita una modificación (el atraso del **original** se
     congela en ese momento, si aún no lo estaba).

  Después de congelado se queda fijo, aunque luego se pida una
  modificación (`vales.atraso_congelado_en`). Los vales ya
  `RECIBIDO` sin sello de congelamiento usan `actualizado_en` como respaldo.
- **Alerta en vivo:** `atrasoWatcher.js` corre cada 60 s en el mismo proceso
  y detecta los vales con **1 día completo o más** de atraso (pasadas 24 h de
  su `fecha_entrega`; antes solo se muestra "vence hoy"). Dispara
  una alerta roja **una sola vez por vale** (`atraso_notificado_en`) solo a
  quien lo tiene "en su vista": el asesor, sus supervisores, los talleres con
  fila activa (pendiente, asignado, en proceso, en pausa o en revisión), los diseñadores con
  vale activo, y la sala `vales:fusion` si el vale está `APROBADO_DEPARTAMENTO`.

## 8. Tiempo real

Todos los eventos pasan por `valeEvents.notificar` (`events.js`) y se envían
**solo a las salas a quienes concierne**, ya formateados:
`{dd/mm/aaaa hh:mm} – Vale: {correlativo} fue {acción} por {actor}[ a {destino}]`.

- Salas: `asesor:<id>`, `supervisor:<id>`, `taller:<id>`, `disenador:<id>`,
  `vales:fusion` (quien tenga `vales.aprobar_general`) y `vales:admin` (el
  Administrador ve todo).
- El servidor valida en cada conexión que el usuario tenga derecho a la sala
  que pide; no confía en la lista que arma el cliente.
- Nivel `alerta` (toast rojo): atrasos, propuesta entregada sin archivo y
  cancelación de proceso.
- Al recibir un evento, el cliente refresca su buzón.
- **Quién recibe qué** (el actor nunca se avisa a sí mismo; cada persona recibe una sola notificación por movimiento):
  - **Asesor** (y su **supervisor**, por la sala `supervisor:<id>`): asignar, comenzar, entregar la propuesta, aprobación de **cada** taller (aunque el vale tenga varios), fusión y correcciones. Pausar, reanudar y cancelar el proceso **no** le llegan.
  - **Taller** (encargado + asistentes): lo que llega a su taller, la cancelación del proceso (alerta roja) y el atraso, también con el proceso en `EN_PAUSA`. La confirmación de recibido no les llega: su flujo termina en la aprobación.
  - **Diseñador:** asignación, propuesta aprobada y atraso, también en pausa.
  - **Fusión:** al fusionar, se avisa al asesor, a sus supervisores y a `vales:fusion` (los demás con `vales.aprobar_general` actualizan su cola en tiempo real).
  - **Autoaprobación** (el encargado entrega con archivo): solo el aviso de aprobación, sin el de entrega.
  - **Gerente:** nada. **Administrador:** solo carteles (`vales:admin`).
- **Textos del vale y PDF.** Los textos se validan antes de generar el PDF: caracteres que la fuente estándar no puede dibujar (emoji, flechas, Ł, chino, ✓, Ω, espacios de ancho cero…) rechazan la creación, corrección o modificación con «Se están usando caracteres innecesarios en «<campo>» (…)»; acentos, ñ, €, ™, © y los saltos de línea de la descripción sí se permiten. Máximos para que cada dato quepa en su celda del PDF (también con letras anchas): empresa, cliente y correo **100** caracteres, teléfono **8 números** (sin el código de país; ya era así), código de producto, material, técnica y acabado **40**. La **descripción** admite hasta **600** y se autoajusta en el PDF: respeta los párrafos, parte por carácter las palabras o URLs sin espacios y reduce la letra (9 → 8 → 7 pt) si es muy larga.
- **Conversación del rechazo — acceso:** solo el encargado del taller del vale y los asistentes vinculados a él; el encargado o asistente de **otro** taller del mismo vale, aunque el vale también vaya a su taller, recibe 403 («Ese taller no es el tuyo.»). Con la conversación abierta en pantalla, los mensajes nuevos no sacan cartel ni beep (la campana los guarda).
- **Asignar a un diseñador:** en el combobox cada diseñador aparece como «(**Asignaciones actuales**: N) - Nombre» (en negrita con letras Unicode, porque un `<option>` no admite HTML), con N = sus asignaciones vigentes (asignado, en proceso, en pausa o en revisión; las mismas de «Carga de trabajo»). El encargado o asistente también se ofrece como «(Asignaciones actuales: N) - Nombre (YO)»; los demás diseñadores no llevan «(YO)» con su propio conteo. Igual en el modal de reasignar al desaprobar.
- **Último taller aprobado:** cuando la aprobación de un taller deja al vale en `APROBADO_DEPARTAMENTO`, el aviso (una sola notificación por persona, a las mismas salas de siempre) dice «{actor} aprobó el taller {taller}: todos los talleres terminaron, el vale está listo para fusionar». Las demás aprobaciones conservan el texto «fue aprobado (taller)».
- **Desaprobar y reasignar:** con cartel y campana solo se entera el diseñador nuevo (y el taller). El asesor, sus supervisores y el diseñador anterior **refrescan su pantalla en silencio** (evento `vale_refrescar`, sin cartel, beep ni campana), para que el paso y los contadores no queden desfasados.
- El texto sale de `accion` («fue {acción} por {actor}») o, si el movimiento no cabe en esa frase, de `texto` (p. ej. «{actor} pausó el proceso»).

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

1. Edita `ESTADOS_LABEL` (lo ven Administrador, Gerente, encargados, diseñadores y
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
  fila del historial por el par de estados, y las entradas del **original**
  ante una modificación (la solicitud y su aprobación) se distinguen por el texto
  de `accion`, porque su estado no cambia o pasa a `RECIBIDO`. Si renombras un
  código hay que hacer un `UPDATE vale_historial` por cada uno (en
  `estado_anterior` **y** `estado_nuevo`) en la misma migración, o el historial
  viejo dejará de clasificarse.
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

## 10. Pipeline de estado (columna «Estado» de las tablas)

La columna «Estado» del Buzón, «Encontrar vale» y la tabla de vales críticos de Rendimiento muestra un
pipeline de 5 pasos numerados en vez de la píldora. El servidor lo calcula (`services/valePipeline.js`,
campo `pipeline` de cada fila) y el frontend lo dibuja (`js/components/pipeline.js`, `css/pipeline.css`).
No cambia ningún estado ni filtro: el desplegable de estado sigue usando los estados reales.

| Paso | Estado general | Estado por taller |
|---|---|---|
| 1 Autorización | `ESPERANDO_AUTORIZACION`, `SOLICITANDO_MODIFICACION`, `RECHAZADO` (paso en rojo con X) | — |
| 2 Asignación | `CREADO`, `MODIFICADO` | `VERIFICANDO_ADJUNTOS`, `ADJUNTOS_RECHAZADOS`, `ADJUNTOS_RESPONDIDOS`, `PENDIENTE_ASIGNACION` |
| 3 Producción | `CREADO`, `MODIFICADO` | `ASIGNADO`, `EN_PROCESO`, `EN_PAUSA` (ámbar) |
| 4 Revisión | `CREADO`, `MODIFICADO`, `APROBADO_DEPARTAMENTO` (fusión) | `EN_REVISION`, `APROBADO` |
| 5 Confirmación | `PENDIENTE_CONFIRMACION`, `RECIBIDO` (los cinco en verde) | — |

- Desde que el encargado **asigna** a un diseñador el vale ya figura en el paso 3 «En proceso» (aunque el diseñador todavía no haya iniciado): así lo ven asesor, supervisor, gerente y administrador, y los contadores «Por asignar»/«En proceso» de asesor y supervisor lo cuentan en «En proceso». Los estados reales del taller y los contadores del encargado y del diseñador no cambian.
- Con varios talleres se muestra el paso del taller más atrasado y «N de M talleres listos»; el tooltip lista el estado de cada uno. Encargados y diseñadores ven el paso de **su** taller.
- El atraso (≥ 1 día) tiñe de rojo el paso actual; al estar `RECIBIDO` muestra «Atraso final».
- Marcas bajo el pipeline: `MOD` (vale `MOD-`) y `Vence en N h` / `Vence en N min` (tiempo **laboral** restante, que se detiene fuera de horario; ámbar cuando queda el 25% del plazo o menos; lo calcula `valePipeline.js` con el calendario laboral a partir de `vigencia_hasta`).
- Si el vale tiene un taller en `ADJUNTOS_RECHAZADOS`, el paso 2 se dibuja en rojo con «Faltan adjuntos: <taller>» para asesor y supervisor (solo en pantalla, `pipelineConAdjuntos`).
- Un estado nuevo se agrega en `ETAPA_TALLER` o como un `case` de `calcularPipeline`; una etapa nueva del recorrido es un paso más en `PASOS`.
- Diseño: Figma, página «Pipeline de estado (Vales)» (archivo del prototipo de Incidencias).

## 11. Reportes de actividad (pestaña «Reportes»)

Pestaña de la barra lateral con el permiso `vales.ver_reportes` (Administrador, Asesor, Supervisor, Encargados de taller y Diseñador; no el Gerente). Mide la actividad de las personas a partir de `vale_historial` y se exporta a PDF (`GET /api/vales/reportes` y `/reportes/pdf`; `services/valeReporteService.js` y `valeReportePdfService.js`). El alcance lo decide el servidor por rol: Asesor y Diseñador ven solo lo suyo; el Supervisor a sus asesores; el Encargado a su taller (cada diseñador); el Administrador todo, con filtros de tienda y taller.

- **Período:** cada acción cuenta por el día en que ocurrió (no por la fecha de entrega); abre en «Hoy» y usa la barra de período (§4).
- **Acciones contadas:** crear, solicitar modificación, autorizar, rechazar, confirmar, asignar, comenzar, entregar (cancelar un proceso no cuenta), aprobar, devolver y fusionar; una devolución cuenta para quien entregó el trabajo devuelto.
- **Tiempos:** de producción (comenzar → entregar, pausas incluidas), de revisión (entregar → aprobar o devolver), hasta la autorización (crear o reenviar → autorizar o rechazar) y ciclo completo (crear → confirmar).
- Indicadores por rol, tablas por persona y listado de vales: ver `documentacion/correcciones_42.md`.

Ajustes (correcciones 43): Supervisor y Asesor solo ven Vales creados, Autorizados y Modificaciones solicitadas; no hay gráfica; quien tiene gente a su cargo puede evaluar a una o varias personas (`personaIds`), y el reporte y el PDF muestran solo a las elegidas.

Simplificación (correcciones 43): Encargado y Diseñador también quedan con tres indicadores de actividad más «Atrasados ahora».
