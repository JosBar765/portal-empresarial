# Configuración del módulo Proyectos por el administrador

Estado: **propuesta para aprobación** (2026-11-06). Complementa a `propuesta_modulo.md` (secciones 4, 7, 10 y 12) y es la fuente de las pantallas A0 a A10 del mockup.

**Regla de este documento: se configura, no se programa.** Cualquier ajuste del flujo que no afecte la integridad de los datos se hace desde la pantalla del administrador, sin tocar el código, sin desplegar y sin reiniciar el servidor.

## 1. Quién configura y desde dónde

- Todo vive dentro del módulo Proyectos, en el grupo **«Configuración»** del menú lateral (el grupo **«Catálogos»** queda arriba, como hoy). Entra quien tenga el permiso `proyectos.administrar`.
- Quién puede **hacer** cada cosa (entrar, activar, aprobar, confirmar ventas…) **no se configura aquí**: se asigna en la pantalla **Roles** de Administración Central, que ya existe y lista los permisos desde la base de datos. Los permisos nuevos de Proyectos aparecen ahí solos.
- El horario laboral y los feriados que usan las etapas y los días hábiles se mantienen en **Administración → Horarios y feriados** (ya existe). Proyectos no los duplica.

## 2. Los cinco niveles de configuración

| Nivel | Qué es | Ejemplos |
|---|---|---|
| 1. **Catálogos** | Filas editables | Nichos, artículos, áreas de contacto, canales, resultados, motivos de pérdida, estructuras de empresa, monedas |
| 2. **Parámetros** | Un valor con mínimo, máximo y valor por defecto | Días de estancado, gracia de vencido, descanso, umbrales del semáforo, límites de importación |
| 3. **Plantillas** | Conjuntos de valores listos para crear proyectos | «Proyecto mensual estándar», «Proyecto corto de 3 semanas» |
| 4. **Reglas e interruptores** | Pasos que se encienden o apagan | Visto bueno al cerrar, aprobación antes de activar, confirmación de ventas, referencia obligatoria por país |
| 5. **Estructura de datos** | Campos que se suman a la empresa | «Número de agencias» solo para bancos |

### 2.1 Lo que queda fijo a propósito

No es una preferencia: es lo que mantiene los datos correctos y los informes confiables.

| Se queda fijo | Por qué |
|---|---|
| Una tienda en un solo proyecto activo y una empresa en un solo proyecto activo | Lo garantizan índices únicos en la base de datos. Si fuera ajustable, dos supervisores podrían repartir las mismas empresas. |
| Los **7 estados** de la empresa (`pendiente`, `en_gestion`, `interesada`, `cotizada`, `vendida`, `perdida`, `descartada`) y sus reglas de dinero | Los informes, el semáforo y las ventas dependen de ellos. Lo que sí se configura es qué **resultado** de una gestión empuja a qué estado (sección 4.1). |
| Anular en lugar de borrar; gestiones, cotizaciones y ventas no se editan | Es lo que permite medir con confianza y auditar. |
| La identidad sale de la sesión; los datos de «Otra tienda» salen vacíos del servidor | Seguridad: no depende de un ajuste. |
| El orden de bloqueo al activar y la idempotencia | Evitan repartos dobles. |
| El portal no envía mensajes por sí solo (llamar y WhatsApp son enlaces que abre el navegador) | Mantiene el módulo sin acciones críticas nuevas (`reglas_entornos.md`). |
| Los datos mínimos que no se pueden quitar: nombre, nicho y país de la empresa | Sin ellos no hay reparto ni duplicados posibles. |

## 3. Centro de configuración: las pantallas

El administrador aterriza en **A0** y desde ahí ve una tarjeta por área con «último cambio hecho por… hace…» y un acceso directo.

| Código | Pantalla | Qué se hace |
|---|---|---|
| **A0** | Centro de configuración | Inicio: tarjetas por área, últimos cambios y avisos (por ejemplo «hay un país sin moneda configurada»). |
| **A1** | Catálogos (9 pestañas) | Nichos, Artículos, Áreas de contacto, Canales, Resultados de gestión, Motivos de pérdida, Estructuras de empresa, Monedas y Países. |
| **A2** | Plan del año | Calendario de nichos y artículos por mes; activación automática (día y hora). |
| **A3** | Parámetros | Valores agrupados (reparto, seguimiento, semáforo, importación, empresas, código e informe). |
| **A4** | Plantillas de proyecto | Lista y editor (datos generales, etapas, valores por defecto y qué puede cambiar el supervisor). |
| **A5** | Reglas y aprobaciones | Interruptores globales y tabla por país (referencia obligatoria y confirmación de ventas). |
| **A6** | Campos propios | Lista y editor de campos por nicho. |
| **A7** | Alcance de usuarios | Países que ve y en los que registra cada persona. |
| **A8** | Notificaciones | Matriz de eventos × destinatarios y anticipación. |
| **A9** | Kit del nicho | Guion de llamada y mensajes con variables (se programa en la fase 9). |
| **A10** | Historial de cambios | Quién, cuándo, antes y después; restaurar un valor. |

### 3.1 Comportamiento común de las pantallas

- Cada ajuste muestra **valor actual**, **rango permitido**, **valor por defecto** y una **ayuda** en lenguaje simple («Días sin gestión para que una empresa se marque como estancada»).
- «**Restaurar valor por defecto**» en cada ajuste y por grupo.
- Todo cambio se **valida** (rango, tipo, que verde sea mayor que ámbar…) y muestra el error junto al campo, con ícono y texto.
- Un cambio sensible (apagar el visto bueno, cambiar un umbral, desactivar un nicho con empresas) pide **confirmación** y dice el efecto: «Aplica a los proyectos que se activen desde ahora. Los 2 proyectos activos conservan su configuración».
- Los cambios se guardan juntos por grupo («Guardar cambios») y quedan en el historial (A10) en la misma transacción.
- No hay modo de solo lectura: quien tiene `proyectos.administrar` edita y quien no lo tiene no entra (el permiso se asigna desde Roles).

## 4. Inventario detallado

### 4.1 Catálogos (A1)

| Catálogo | Campos editables | Reglas |
|---|---|---|
| **Nichos** | Nombre, descripción, activo, orden | Se desactivan, no se borran. Muestra cuántas empresas tiene cada uno. Los nombres no se repiten. |
| **Artículos de muestra** | Nombre, descripción, activo | La existencia no vive aquí: se define por proyecto. |
| **Áreas de contacto** | Nombre, activa, orden | Gerencia general, Mercadeo, Compras, Recursos humanos, Recepción, Ventas, Otra (semilla). |
| **Canales** | Nombre, **presencial sí/no**, activo | «Presencial» alimenta el informe «presencial frente a remoto». |
| **Resultados de gestión** | Nombre, **contacto logrado** (sí/no), **pide próxima fecha** (sí/no), **estado al que empuja** (ninguno, `en_gestion` o `interesada`), activo, orden | El resultado nunca baja el estado; solo lo sube hasta `interesada`. `cotizada` y `vendida` las fijan la cotización y la venta, no un resultado. |
| **Motivos de pérdida** | Nombre, activo, orden | Alimenta el informe de perdidas por motivo. |
| **Estructuras de empresa** | Nombre, activa, orden | Una empresa, varias empresas, varias sucursales (semilla). |
| **Monedas** | Código, nombre, símbolo, activa | GTQ, USD, HNL, NIO, CRC (semilla). |
| **Países** | **Moneda local**, prefijo y formato del teléfono, **referencia obligatoria** (sí/no), **confirmación de ventas** (heredar / sí / no) | Un país sin moneda local se marca en A0 como pendiente. |

### 4.2 Parámetros (A3)

Los valores se guardan en `parametros_sistema` con el prefijo `proyectos.`. Si falta uno, manda el valor por defecto del registro.

| Grupo | Clave | Tipo | Por defecto | Rango | Qué afecta |
|---|---|---|---|---|---|
| Reparto | `reparto.reciben_supervisores` | sí/no | no | — | Si los supervisores también reciben empresas. |
| Reparto | `reparto.afinidad_tienda` | sí/no | sí | — | Desempate a favor de la tienda que registró la empresa. |
| Reparto | `reparto.tope_por_asesor` | número o vacío | vacío | 1–500 | Tope inicial que proponen las plantillas; lo que sobra queda en reserva. |
| Reparto | `reparto.rondas` | sí/no | no | — | Permite repartir la reserva en una segunda ronda. |
| Reparto | `reparto.descanso_meses` | número | 3 | 0–36 | Meses que una empresa con venta no vuelve a repartirse; 0 apaga la regla. |
| Seguimiento | `seguimiento.dias_estancado` | número | 7 | 1–60 | Días sin gestión para marcar una empresa como estancada. |
| Seguimiento | `vencimiento.gracia_dias_habiles` | número | 3 | 0–15 | Días hábiles tras la fecha de fin antes de marcar el proyecto como vencido. |
| Semáforo | `semaforo.cobertura_verde` y `semaforo.cobertura_ambar` | porcentaje | 75 y 50 | 0–100, verde > ámbar | Umbrales de la cobertura durante el proyecto. |
| Semáforo | `semaforo.efectividad_verde` y `semaforo.efectividad_ambar` | porcentaje | 75 y 50 | 0–100, verde > ámbar | Umbrales de la efectividad al cierre. |
| Importación | `importacion.max_filas` | número | 2,000 | 100–10,000 | Filas máximas por archivo. |
| Importación | `importacion.max_mb` | número | 5 | 1–20 | Tamaño máximo del CSV. |
| Importación | `importacion.duplicadas_por_defecto` | lista | omitir | omitir, actualizar | Qué se marca por defecto en las filas duplicadas. |
| Empresas | `empresas.ciudad_obligatoria` | sí/no | no | — | Si la ciudad es obligatoria. |
| Empresas | `empresas.contacto_obligatorio` | sí/no | sí | — | Si hace falta al menos un contacto. |
| Empresas | `empresas.telefono_o_correo_obligatorio` | sí/no | sí | — | Si hace falta un teléfono o un correo. |
| Empresas | `empresas.sitio_web_obligatorio` | sí/no | no | — | Si el sitio web es obligatorio. |
| Empresas | `empresas.duplicado_por_nombre_ciudad` y `empresas.duplicado_por_telefono` | sí/no | sí y sí | — | Criterios del aviso de posible duplicado. |
| Empresas | `empresas.similitud_minima` | porcentaje | 85 | 50–100 | Qué tan parecido debe ser el nombre para avisar. |
| Proyecto | `codigo.formato` | texto con marcadores | `PRY-{AAAA}-{MM}-{NICHO}` | Marcadores válidos: `{AAAA}`, `{MM}`, `{NICHO}`, `{N}` | Cómo se genera el código de cada proyecto. |
| Informe | `informe.filas_por_tabla` | número | 20 | 5–100 | Filas por tabla antes del «y N más» del PDF. |
| Informe | `informe.secciones` | lista de casillas | todas | embudo, montos, canal, muestras, por asesor, por tienda | Qué secciones lleva el informe y el PDF. |
| Informe | `informe.texto_encabezado` | texto | vacío | hasta 200 caracteres | Línea que aparece bajo el título del PDF. |
| Automatización | `activacion_auto.activa`, `.dia`, `.hora` | sí/no, día, hora | no, primer día hábil, 07:00 | — | Activación automática con el plan del año (fase 9). |

### 4.3 Plantillas de proyecto (A4)

El supervisor crea un proyecto **eligiendo una plantilla**. El administrador define cada plantilla y qué puede cambiar el supervisor.

| Parte | Qué contiene |
|---|---|
| Datos generales | Nombre, descripción, activa, **es la predeterminada** (una sola). |
| Duración | Semanas (se reparte entre las etapas). |
| **Etapas** | Lista ordenada: **nombre**, **qué se espera** y **duración en días hábiles**. Se pueden agregar, quitar y reordenar. Orientan, no bloquean. |
| Valores por defecto | Artículo, existencia sugerida, tope por asesor, meta (monto y moneda). |
| **Qué puede cambiar el supervisor** | Para cada campo (artículo, existencia, meta, tope, fechas de etapas): **editable**, **bloqueado** (con candado) u **obligatorio**. |

Al activar, el proyecto guarda **una copia** de la plantilla (sección 5.2); editar la plantilla después no cambia proyectos existentes.

Plantilla semilla: **«Proyecto mensual estándar»** con las 4 etapas de la propuesta (Preparación, Contacto, Seguimiento, Cierre; una semana cada una).

### 4.4 Reglas e interruptores, y referencia por país (A5)

| Regla | Ámbito | Por defecto | Efecto al encenderla |
|---|---|---|---|
| **Visto bueno del gerente al cerrar** | Global | **Encendida** | El cierre queda a la espera del gerente (pantallas S10 y G2). Apagada, el proyecto se cierra sin visto bueno. |
| **Aprobación del gerente antes de activar** | Global | Apagada | El supervisor **pide** la activación y el proyecto pasa a `pendiente_aprobacion`; al aprobar el gerente se reparte (G5). Si la rechaza, vuelve a `borrador` con comentario. |
| **Confirmación de ventas por el supervisor** | Global, con excepción por país | Apagada | La venta nace `por_confirmar` y no cuenta en informes hasta que el supervisor la confirma (S19). Rechazada, vuelve al asesor con motivo. |
| **Referencia obligatoria** | Por país | **Obligatoria** | Número de cotización y de orden de venta obligatorios. Apagada para un país: opcional. |

Quién aprueba o confirma se decide con permisos desde Roles (`proyectos.dar_visto_bueno`, `proyectos.aprobar_activacion`, `proyectos.confirmar_ventas`).

### 4.5 Campos propios de la empresa (A6)

| Elemento | Detalle |
|---|---|
| Alcance | Un nicho concreto o **todos** los nichos. |
| Campos de cada definición | Etiqueta, **tipo** (texto, número, lista, sí/no, fecha), **opciones** (si es lista), **obligatorio** (sí/no), **visible en la lista** (sí/no), orden, activo. |
| Dónde aparecen | Formulario de la empresa (celular y escritorio), ficha, filtros de la base de clientes y **columnas de la plantilla CSV** de importación. |
| Qué pasa al desactivar | El campo deja de pedirse y de mostrarse; **los datos ya guardados no se borran** y vuelven si se reactiva. |
| Semilla | **«¿Ya es cliente de Premia?»** (sí/no, todos los nichos). |

Los valores se guardan juntos en una columna JSON de la empresa (`datos_extra`). La clave del campo no se repite ni se reutiliza.

### 4.6 Alcance de usuarios por país (A7)

- Por defecto, cada persona ve y registra empresas del **país de su tienda** (asesores) o de **sus tiendas** (supervisores, según `supervisor_tiendas`).
- El administrador puede **agregar** un país (por ejemplo, un supervisor regional) o **quitar** uno. Solo se guardan las excepciones; nadie tiene que configurarse al inicio.
- La pantalla muestra, por persona, el país por defecto y las excepciones, con filtro por tienda y por rol.
- Afecta a: base de clientes, registrar empresa, importar y reparto.

### 4.7 Notificaciones (A8)

Matriz de **evento × destinatario**. Cada celda es un interruptor. Los destinatarios se resuelven **por permiso**, no por nombre de rol.

| Evento | Asesor | Supervisor | Gerente | Anticipación |
|---|---|---|---|---|
| Reparto recibido | sí | — | — | — |
| Empresa reasignada (recibe) / (pierde) | sí | — | — | — |
| Seguimiento que vence | sí | — | — | horas antes (por defecto 0: el mismo día) |
| Seguimiento vencido | sí | sí | — | — |
| Proyecto vencido | — | sí | sí | — |
| Activación pedida | — | — | sí | — |
| Activación aprobada o rechazada | — | sí | — | — |
| Cierre pendiente de visto bueno | — | — | sí | — |
| Visto bueno dado o devuelto | — | sí | — | — |
| Venta por confirmar | — | sí | — | — |
| Venta confirmada o rechazada | sí | — | — | — |
| Existencia de muestras baja (fase 9) | — | sí | — | umbral en unidades |

Reglas fijas: no se notifica al autor de la acción (regla 19); las notificaciones se purgan a los 30 días; todo viaja por la campana y el socket del portal, nunca por correo ni mensajería.

### 4.8 Kit del nicho (A9, se programa en la fase 9)

Por nicho: **guion de llamada** (texto) y **mensajes** por canal (título, texto, activo, orden) con variables `{empresa}`, `{contacto}`, `{asesor}`, `{articulo}` y `{nicho}`. El asesor abre el mensaje prellenado en WhatsApp o en el correo; el portal no lo envía.

### 4.9 Plan del año y activación automática (A2)

12 meses con nicho, artículo y plantilla; un mes sin plan se marca «Sin plan». Sugiere el nicho al crear el proyecto. La **activación automática** (fase 9) crea el proyecto del plan el primer día hábil (o el día elegido) a la hora configurada; si la aprobación del gerente está encendida, queda en `pendiente_aprobacion`.

## 5. Cómo funciona por dentro

### 5.1 Registro de parámetros

Un archivo del código (`src/modules/proyectos/parametros.js`) lista cada parámetro con: **clave, grupo, tipo, mínimo, máximo, valor por defecto, etiqueta y ayuda**. La pantalla A3 se dibuja desde ese registro y valida contra él. Agregar un parámetro nuevo en el futuro = **una línea** en el registro y el código que lo lea; no hay que tocar la pantalla ni crear tablas.

El servicio `configService` lee los valores (con caché que se invalida al guardar), usa el valor por defecto si no hay fila y rechaza cualquier valor fuera de rango. De la misma forma, un registro de **eventos** (`eventos.js`) alimenta la matriz A8.

### 5.2 Foto de la configuración (`config_snapshot`)

Al **activar**, el proyecto guarda una copia de la configuración con la que nació:

- Parámetros que usa el proyecto (estancado, gracia, semáforo, descanso, tope, afinidad, secciones del informe…).
- La plantilla completa (etapas, valores y controles).
- Las reglas vigentes (visto bueno, aprobación, confirmación de ventas) y la referencia obligatoria de cada país del alcance.

El semáforo, los estancados, el vencimiento, el informe y el cierre del proyecto **leen la foto**, no la configuración viva. Así un cambio de configuración **solo aplica a proyectos nuevos**; los informes antiguos y los proyectos en curso no cambian por sorpresa. Lo que sí es «vivo»: catálogos (un nicho desactivado deja de ofrecerse), campos propios, alcance de usuarios y notificaciones.

### 5.3 Auditoría

Todo cambio de configuración escribe una fila en `proy_config_historial` (quién, cuándo, qué ajuste, **antes** y **después**) en la misma transacción que el cambio. A10 permite filtrar por área, persona y fechas y **restaurar** un valor anterior (que es un cambio nuevo, también auditado).

### 5.4 Efecto en el flujo

Con todos los interruptores en su valor por defecto el flujo es el ya aprobado. Los caminos opcionales agregan **dos estados**, que solo existen cuando se encienden:

| Interruptor | Estado nuevo | Quién lo mueve |
|---|---|---|
| Aprobación antes de activar | Proyecto `pendiente_aprobacion` (entre `borrador` y `activo`) | Pedir: `proyectos.activar`. Aprobar o rechazar: `proyectos.aprobar_activacion`. |
| Confirmación de ventas | Venta `por_confirmar` (antes de `confirmada` o `rechazada`) | Registrar: `proyectos.gestionar`. Confirmar o rechazar: `proyectos.confirmar_ventas`. |

El estado de la empresa solo pasa a `vendida` con una venta `confirmada`; mientras esté `por_confirmar`, la empresa sigue `cotizada` y el informe no cuenta esa venta.

## 6. Permisos de la configuración

| Permiso | Para qué | Por defecto |
|---|---|---|
| `proyectos.administrar` | Todas las pantallas A0 a A10 | Administrador |
| `proyectos.aprobar_activacion` | Aprobar o rechazar la activación de un proyecto | Gerente, Administrador |
| `proyectos.confirmar_ventas` | Confirmar o rechazar ventas | Supervisor, Administrador |
| `proyectos.dar_visto_bueno` | Dar o devolver el visto bueno al cierre | Gerente |

Los permisos se asignan **desde la pantalla Roles** de Administración Central. Como esa pantalla refresca la sesión de quien ya está conectado, es preferible a asignarlos con una migración.

## 7. Trazabilidad: qué se configura, dónde y con qué

| Configurable | Pantalla | Tabla o almacén | Permiso | Fase |
|---|---|---|---|---|
| Nichos, artículos, áreas, canales, motivos, estructuras, monedas | A1 | `proy_nichos`, `proy_articulos`, `proy_areas_contacto`, `proy_canales`, `proy_motivos_perdida`, `proy_estructuras`, `proy_monedas` | `proyectos.administrar` | 1 |
| Resultados de gestión y su efecto en el estado | A1 | `proy_resultados_gestion` | idem | 1 |
| Moneda local, teléfono y referencia por país | A1 (Países) y A5 | `proy_pais_config` | idem | 1 |
| Parámetros de reparto, seguimiento, semáforo, importación, empresas, código e informe | A3 | `parametros_sistema` (`proyectos.*`) | idem | 1 |
| Interruptores de aprobación | A5 | `parametros_sistema` | idem | 1 (se usan en 3, 4 y 6) |
| Plantillas de proyecto | A4 | `proy_plantillas`, `proy_plantilla_etapas` | idem | 3 |
| Campos propios | A6 | `proy_campos`, `proy_clientes.datos_extra` | idem | 2 |
| Alcance de usuarios | A7 | `proy_usuario_paises` | idem | 2 |
| Notificaciones | A8 | `proy_notificaciones_config` | idem | 6 |
| Kit del nicho | A9 | `proy_kits`, `proy_kit_mensajes` | idem | 9 |
| Plan del año y activación automática | A2 | `proy_plan_nichos`, `parametros_sistema` | idem | 9 |
| Historial de cambios | A10 | `proy_config_historial` | idem | 1 |
| Quién puede hacer cada cosa | Roles (ya existe) | `rol_permisos` | `admin.roles.gestionar` | 8 |
| Horario laboral y feriados | Horarios y feriados (ya existe) | `horarios_laborales`, `feriados` | `admin.horarios.gestionar` | — |

## 8. Seguridad de la configuración

- Solo `proyectos.administrar` entra a las pantallas A; el servidor lo comprueba en cada endpoint (no basta ocultar el menú).
- Cada valor se valida contra el registro (tipo, rango, relaciones como verde > ámbar). Un valor inválido no se guarda.
- Todo cambio queda auditado con su valor anterior y es reversible desde A10.
- Las acciones destructivas no existen: se desactiva, no se borra.
- Los textos libres (guiones, mensajes, encabezado del informe) se guardan como texto y se pintan escapados.
- Los ajustes de la lista de «fijo a propósito» (sección 2.1) no tienen pantalla, para que nadie pueda romper la integridad por error.
