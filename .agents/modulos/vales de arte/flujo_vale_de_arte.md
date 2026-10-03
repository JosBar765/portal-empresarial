# Flujo del módulo "Vales de Arte" (estado real del sistema)

Referencia del flujo tal como lo implementa el código en `src/modules/vales/`
(verificado contra los servicios el 2026-10-02). Si este archivo y el código
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
- Toda transición se serializa con un lock por vale (`valeMutex`) y se anota en
  `vale_historial`.
- Hora de referencia: UTC-6 fijo (Guatemala), calculado por offset, no por la
  zona horaria del servidor.
- Correlativo: `{CÓDIGO TIENDA}-{INICIALES ASESOR}-{id autoincremental}`. El
  vale de modificación lleva el prefijo `MOD-` delante del correlativo del
  original.

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
 El vale se BORRA por completo            │  diario de su equipo, ver §5)
 (fila, adjuntos y PDF). No hay           │ → crea 1 fila en vale_talleres
 estado "rechazado".                      │   por taller solicitado
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

- Mientras está en `ESPERANDO_AUTORIZACION`, el **asesor dueño** también puede darlo
  de baja (permiso `vales.dar_de_baja`): se borra igual que en el rechazo del
  supervisor. Una vez autorizado ya no es posible. Si el supervisor autoriza o
  rechaza un vale ya dado de baja, o el asesor da de baja uno ya autorizado, el
  sistema avisa con un mensaje claro y no cambia nada.
- También mientras está en `ESPERANDO_AUTORIZACION`, el asesor dueño puede **corregir**
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
   · debe escribir una justificación (máx. 2000 caracteres)
   · reenvía el formulario completo con los datos corregidos
   · destino: si el original fue a 1 taller, es ese mismo; si fue a 2+, el
     asesor elige un subconjunto NO vacío de ESOS talleres (nunca uno nuevo)
   · se valida el cupo diario de los talleres destino
   · se guarda en vale_solicitudes_modificacion (estado PENDIENTE)
   · el original pasa a SOLICITANDO_MODIFICACION
        │
        ▼  Supervisor del asesor (ve la justificación)
 ┌──────────────┴───────────────────────────────┐
 │ RECHAZA                                      │ APRUEBA
 ▼                                              ▼
 La solicitud queda RECHAZADA.        Se crea un VALE NUEVO "MOD-<correlativo>":
 El original vuelve al estado que     · estado MODIFICADO, vale_original_id apunta
 tenía antes de la solicitud          · YA autorizado (autorizado_por/en, tipo
 (PENDIENTE_CONFIRMACION o RECIBIDO,    MODIFICACION): aprobar la modificación ES
 recuperado del historial).             la autorización, sin paso extra
 No consume la modificación.          · fan-out INMEDIATO a los talleres elegidos
                                        (cupo diario revalidado en este momento)
                                      · la justificación pasa a ser su
                                        "Boceto y Descripción"
                                      · se le adjunta la propuesta aprobada del
                                        original como documento
                                      El original: queda RECIBIDO, `modificado = 1`
                                      y su atraso se congela si aún no lo estaba.
                                              │
                                              ▼
                      el MOD- corre el ciclo de taller normal (§2). Al terminar:
                      · si el ORIGINAL fue a 1 solo taller → PENDIENTE_CONFIRMACION
                      · si el ORIGINAL fue a 2+ talleres → APROBADO_DEPARTAMENTO
                        (fusión), aunque la modificación solo toque 1 taller
                      Luego el asesor lo confirma → RECIBIDO.
```

- Son **dos registros y dos PDF independientes**: el original nunca se
  sobreescribe; "Ver PDF" del original sirve siempre el del original.
- Solo se permite **una** modificación: no puede modificarse un vale con
  `modificado = 1` ni un vale `MOD-` (`vale_original_id` no nulo).
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
| Asesor | Esperando autorización · Pendientes de confirmación · Solicitando modificación · Atrasados. Excluye RECIBIDO. | Vales `RECIBIDO` y `SOLICITANDO_MODIFICACION` (un vale confirmado sigue ahí aunque tenga una modificación en curso). Total y recibidos hoy. |
| Supervisor | Por autorizar creación (con contador N/M del cupo colectivo) · Por autorizar modificación · Modificados · Pendientes de confirmación del asesor · Atrasados. | Dos grupos: lo que **él** autorizó (por fecha de autorización) y lo que sus asesores confirmaron (por `confirmado_en`). Un vale que cae en ambos aparece una vez. |
| Encargado de taller | Pendiente de asignación · Asignados · En proceso · **En pausa** · En revisión · Atrasados (+ **Por fusionar** si tiene `aprobar_general`). Muestra el estado **de la fila de su taller**, no el general. | Vales con fila `APROBADO` en su taller (con "Ver propuesta" de su técnico), + sus fusiones si fusiona. |
| Técnico | Asignados sin atraso · Asignados con atraso · Vale en proceso (ve también `EN_PAUSA` y `EN_REVISION` en la lista). | Vales que su taller aprobó, con su propuesta. |
| Administrador | Todo, con contadores generales (total, atrasados, recibidos hoy, pendientes de confirmación, por fusionar). | — |
| Gerente | **No tiene buzón**: ver §6. | — |

"Atrasados" es el único contador que se **combina** con cualquier otro filtro
activo (los demás contadores son mutuamente excluyentes). Además hay filtro
por estado, búsqueda por correlativo/cliente/empresa, orden por columna
(reemplaza la jerarquía de negocio mientras está activo), ventana de tiempo
(día/semana/mes/rango) y paginación por cursor de 50 en 50.

## 5. Límites y cupos

| Límite | Dónde se valida | Efecto |
|---|---|---|
| **Cupo colectivo diario del Supervisor** = nº de asesores activos bajo su mando; cuenta las autorizaciones de **creación** que hizo hoy | Al **autorizar** (no al crear) | Al llegar al límite no puede autorizar más ese día. Al Administrador no le aplica. Crear un vale nunca se bloquea ni se pospone por esto. |
| **Cupo diario por taller** (`talleres.limite_diario`, opcional; NULL = sin límite), sobre la fecha de **entrega** (no la de evento) | Al **crear**, al **solicitar** la modificación y al **aprobar** la modificación | Bloquea con un mensaje amigable ("el taller X ya no tiene cupo para el día…"). Las verificaciones + inserción son atómicas entre asesores (`conColaDeCapacidad`). El calendario del frontend solo lo anticipa. |
| Un técnico = un vale `EN_PROCESO` | `comenzar` y `reanudar` | Debe entregar, cancelar o pausar el actual antes. |
| Una sola modificación por vale | `solicitarModificacion` | Ver §1.1. |
| Adjuntos | `routes.js` | Máx. 3 MB por archivo; JPEG/PNG/WebP/PDF; hasta 10 imágenes y 5 documentos al crear. |

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
  y detecta el momento exacto en que un vale cruza su `fecha_entrega`. Dispara
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
