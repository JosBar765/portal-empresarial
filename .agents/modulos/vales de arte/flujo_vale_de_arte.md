# Flujo del módulo "Vales de Arte" (estado actual, post `analisis_correcciones_7.md`)

Diagrama de referencia rápida. La especificación funcional completa sigue
siendo `analisis_modulo.md` + los `analisis_correcciones_N.md`; este archivo
es solo un mapa visual para no perder el hilo de cómo se conectan los
estados.

## 1. Vista general (estado del VALE)

```
                                   ┌────────────────────────────┐
                                   │  ASESOR crea el vale        │
                                   │  (elige 1 o varios talleres)│
                                   └──────────────┬───────────────┘
                                                  │
                                                  ▼
                                            ┌───────────┐
                                            │  CREADO   │
                                            └─────┬─────┘
                                                  │ fan-out: se crea 1 fila en
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
              │  el documento oficial) │  aprueba      │  de talleres es manual, fuera │
              └───────────┬────────────┘               │  del alcance del sistema)     │
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
```

Nota: solo se permite **una** modificación por vale original
(`vales.modificado`); el vale `MOD-` resultante no puede volver a
modificarse.

## 2. Vista por TALLER (estado de cada fila en `vale_talleres`)

Cada taller involucrado en un vale corre este ciclo de forma independiente
— un vale con 2 talleres tiene 2 filas avanzando en paralelo, cada una en su
propio punto de este diagrama:

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
                          (buzón: Pend. confirmación, Solicitando
                          modificación, Atrasados)

 Encargado de un taller ─► asigna técnicos · revisa/aprueba propuestas de
 (Diseño / Diseño UV-3D)   SU taller (buzón: Pend. asignación, Asignados,
                          En proceso, En revisión, Aprobados hoy, Atrasados)

 Técnico ────────────────► trabaja un vale asignado, entrega su propuesta
                          (buzón: Asignados sin atraso, Asignados con
                          atraso, Vale en proceso)

 Encargado General ──────► fusiona/aprueba vales multi-taller Y todo vale
 (o su Asistente)          de modificación · decide a qué taller(es)
                          reenviar una modificación aprobada
                          (buzón: Vales por fusionar, Vales Modificados,
                          Atrasados)

 Supervisor de Ventas ───► autoriza (o no) las solicitudes de modificación
                          de los asesores, viendo su justificación
                          (buzón: Por autorizar modificación, Modificados,
                          Pend. confirmación asesor, Atrasados)

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
en cada consulta — no se guarda en la base de datos. Se congela en el
momento en que el vale llega a `RECIBIDO` (deja de recalcularse); mientras
el vale sigue activo, se recalcula en cada carga del buzón. Por eso puede
combinarse como filtro con cualquier otro contador de estado: es
independiente del estado del vale.
