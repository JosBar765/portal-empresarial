# Flujo del módulo "Vales de Arte" (estado actual, post `analisis_correcciones_10.md`)

Diagrama de referencia rápida. La especificación funcional completa sigue
siendo `analisis_modulo.md` + los `analisis_correcciones_N.md`; este archivo
es solo un mapa visual para no perder el hilo de cómo se conectan los
estados.

## 1. Vista general (estado del VALE)

```
                                   ┌────────────────────────────┐
                                   │  ASESOR crea el vale        │
                                   │  (elige 1 o varios talleres,│
                                   │  quedan guardados como      │
                                   │  "talleres_solicitados")    │
                                   └──────────────┬───────────────┘
                                                  │
                                                  ▼
                                     ┌───────────────────────┐
                                     │ ESPERANDO_AUTORIZACION │  buzón del SUPERVISOR
                                     │ (SIN filas todavía en  │  (el de LA TIENDA del
                                     │   vale_talleres)        │  asesor — cada tienda
                                     └──────────────┬──────────┘  tiene el suyo)
                                                  │ Supervisor autoriza
                                                  │ (autorizarCreacion — gated
                                                  │  por el cupo colectivo diario
                                                  │  de su equipo, ver diagrama 3)
                                                  │ → sella autorizado_por/
                                                  │   autorizado_en/CREACION,
                                                  │   firma roja en el PDF
                                                  ▼
                                            ┌───────────┐
                                            │  CREADO   │
                                            └─────┬─────┘
                                                  │ fan-out: RECIÉN AQUÍ se crea 1 fila en
                                                  │ vale_talleres por cada taller
                                                  │ elegido (ver diagrama 2)
                                                  ▼
                       ┌──────────────────────────────────────────────────┐
                       │   cada taller corre SU PROPIO ciclo interno       │
                       │   (diagrama 2) hasta llegar a APROBADO            │
                       └──────────────────────────┬─────────────────────────┘
                                                  │ cuando TODOS los talleres
                                                  │ del vale están APROBADO:
                                                  │
                            ┌─────────────────────┴─────────────────────┐
                            │                                           │
                 ¿1 solo taller Y                              ¿2+ talleres  O
                 el vale NO es una                             el vale SÍ es una
                 modificación (MOD-)?                          modificación (MOD-)?
                            │                                           │
                            ▼                                           ▼
              ┌───────────────────────┐               ┌──────────────────────────────┐
              │  PENDIENTE_CONFIRMACION│◄─────────────┤     APROBADO_DEPARTAMENTO     │
              │  (salta directo,       │  Encargado    │  buzón del ENCARGADO GENERAL  │
              │  la propuesta del      │  General      │  fusiona/aprueba (adjunta su  │
              │  único taller ya es    │  fusiona y    │  propio documento — la fusión │
              │  el documento oficial, │  aprueba      │  de talleres es manual, fuera │
              │  NUNCA se pega dentro  │               │  del alcance del sistema — Y  │
              │  del PDF del vale)     │               │  NUNCA se pega dentro del PDF │
              └───────────┬────────────┘               │  del vale — analisis_         │
                          │                            │  correcciones_10.md #3)       │
                          │                            └───────────────┬───────────────┘
                          │                                            │
                          │            (todo vale de modificación pasa │
                          │             SIEMPRE por acá, aunque haya   │
                          │             ido a un solo taller — es la   │
                          │             corrección #2 de este archivo) │
                          │                                            │
                          └───────────────────┬────────────────────────┘
                                              ▼
                                   ┌────────────────────┐
                                   │ PENDIENTE_CONFIRMACION│
                                   │  (buzón del ASESOR)  │
                                   └──────────┬────────────┘
                                              │
                          ┌───────────────────┴────────────────────┐
                          │                                        │
                 asesor confirma                         asesor solicita modificación
                 (sella confirmado_en)                             │
                          │                                        │
                          ▼                                        ▼
                    ┌───────────┐                       ┌────────────────────────┐
                    │ RECIBIDO  │                       │ SOLICITANDO_MODIFICACION│
                    │(terminal) │                       │   (buzón del SUPERVISOR)│
                    └─────┬─────┘                       └────────────┬────────────┘
                          │                                          │
             el asesor AÚN puede                          supervisor autoriza
             solicitar una modificación                    (ve la justificación)
             sobre un vale ya RECIBIDO ────────────────────────────┐│
                                                                    ▼▼
                                                     ┌──────────────────────────────┐
                                                     │  se crea un VALE NUEVO        │
                                                     │  correlativo "MOD-<original>" │
                                                     │  estado = MODIFICADO          │
                                                     │  SIN talleres asignados aún   │
                                                     │  YA AUTORIZADO (autorizado_por│
                                                     │  /autorizado_en/MODIFICACION, │
                                                     │  firma roja en su PDF desde   │
                                                     │  ya — la aprobación de la     │
                                                     │  modificación ES la           │
                                                     │  autorización, sin paso extra)│
                                                     │  (buzón del ENCARGADO GENERAL)│
                                                     └───────────────┬───────────────┘
                                                                    │ Encargado General
                                                                    │ decide a qué
                                                                    │ taller(es) reenviar
                                                                    ▼
                                                     (vuelve a fan-out → diagrama 2,
                                                      mismo ciclo de arriba — y este
                                                      vale, al terminar, SIEMPRE
                                                      retorna a APROBADO_DEPARTAMENTO
                                                      sin importar cuántos talleres)

    ¡IMPORTANTE! El vale ORIGINAL nunca se sobreescribe ni se "tapa" por el MOD-
    (analisis_correcciones_10.md #4): son dos registros y dos PDF independientes,
    cada uno consultable por su propio id — "Ver PDF" del original SIEMPRE sirve
    el PDF del original, nunca lo sustituye por el del MOD-.
```

Nota: solo se permite **una** modificación por vale original
(`vales.modificado`); el vale `MOD-` resultante no puede volver a
modificarse.

## 2. Vista por TALLER (estado de cada fila en `vale_talleres`)

Cada taller involucrado en un vale corre este ciclo de forma independiente
— un vale con 2 talleres tiene 2 filas avanzando en paralelo, cada una en su
propio punto de este diagrama. Estas filas **no existen** mientras el vale
está en `ESPERANDO_AUTORIZACION` (diagrama 1) — nacen recién cuando el
Supervisor autoriza:

```
              ┌─────────────────────────┐
              │   PENDIENTE_ASIGNACION   │   (recién repartido a este taller)
              └────────────┬─────────────┘
                           │ encargado del taller asigna un técnico
                           ▼
                     ┌───────────┐
                     │  ASIGNADO │
                     └─────┬─────┘
                           │ técnico marca "comenzar"
                           │ (1 solo vale EN_PROCESO por técnico a la vez)
                           ▼
                   ┌───────────────┐
                   │  EN_PROCESO   │
                   └───────┬───────┘
                           │ técnico entrega su propuesta (PDF/imagen)
                           ▼
                  ┌────────────────┐
                  │  EN_REVISION   │
                  └───────┬────────┘
                          │
              ┌───────────┴────────────┐
              │                        │
    encargado aprueba          encargado desaprueba
              │                (reasigna a otro técnico)
              ▼                        │
        ┌───────────┐                  │
        │ APROBADO  │                  ▼
        └───────────┘            (vuelve a ASIGNADO)
```

## 3. Roles y en qué punto participa cada uno

```
 Asesor de Ventas ──────► crea el vale · confirma o solicita modificación
                          (buzón: Esperando autorización, Pend. confirmación,
                          Solicitando modificación, Atrasados)

 Supervisor de Ventas ───► por TIENDA: cada supervisor tiene sus propios
 (uno por tienda)          asesores a cargo (usuarios.encargado_id) y SOLO ve
                          y autoriza los vales de ESOS asesores — autoriza la
                          creación (envío a talleres) Y las solicitudes de
                          modificación, viendo su justificación; ambas
                          autorizaciones quedan firmadas en rojo en el PDF
                          (analisis_correcciones_10.md #5/#6/#11)
                          (buzón: Por autorizar creación, Por autorizar
                          modificación, Modificados, Pend. confirmación
                          asesor, Atrasados · Trabajo Realizado: lo que él
                          autorizó + lo que sus asesores confirmaron)

 Encargado de un taller ─► asigna técnicos · revisa/aprueba propuestas de
 (Diseño / Diseño UV-3D)   SU taller (buzón: Pend. asignación, Asignados,
                          En proceso, En revisión, Aprobados hoy, Atrasados ·
                          Trabajo Realizado: vales aprobados por su taller —
                          analisis_correcciones_10.md #8)

 Técnico ────────────────► trabaja un vale asignado, entrega su propuesta
                          (buzón: Asignados sin atraso, Asignados con
                          atraso, Vale en proceso)

 Encargado General ──────► fusiona/aprueba vales multi-taller Y todo vale
 (o su Asistente)          de modificación · decide a qué taller(es)
                          reenviar una modificación aprobada
                          (buzón: Vales por fusionar, Vales Modificados,
                          Atrasados)

 Gerente ────────────────► solo lectura — nunca ejecuta ninguna acción sobre
                          un vale. Ve el Dashboard (KPIs y gráficas: por
                          estado, por tienda) y la vista "Vales de Arte"
                          (mismo listado/jerarquía que Administrador),
                          ambas filtrables por tienda y por ventana de
                          tiempo (analisis_correcciones_7.md, Vista
                          Gerencia)
```

## 4. "Atraso" no es un estado

El atraso (columna "ATRASO" en la tabla, contador "Atrasados" en cada
buzón) es una condición **derivada** de `fecha_entrega`, calculada al vuelo
en cada consulta — no se guarda en la base de datos como tal. Mientras el
vale sigue activo, se recalcula en cada carga del buzón. Por eso puede
combinarse como filtro con cualquier otro contador de estado: es
independiente del estado del vale.

Lo que sí se guarda es el MOMENTO del congelamiento (`atraso_congelado_en`),
fijado una única vez cuando el vale se confirma de recibido o se aprueba su
modificación — y se queda fijo para siempre desde ahí, aunque el vale
después pase a `SOLICITANDO_MODIFICACION` (analisis_correcciones_8.md #7):
antes solo se congelaba mientras el estado seguía siendo `RECIBIDO`, así que
pedir una modificación sobre un vale ya entregado hacía que su atraso
volviera a correr en vivo, cosa que ya no pasa.

Desde `analisis_correcciones_10.md #10`, un vigilante en el servidor
(`atrasoWatcher.js`, corre cada 60s) detecta el MOMENTO exacto en que un
vale cruza su `fecha_entrega` y dispara una alerta roja a todos los actores
que actualmente lo tienen "en su vista" (asesor, su Supervisor, taller(es)
y técnico(s) activos, Encargado General si ya está en su buzón) — una sola
vez por vale (`atraso_notificado_en`).
