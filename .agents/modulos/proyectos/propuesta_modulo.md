# Propuesta del módulo Proyectos

Estado: **propuesta para aprobación** (actualizada el 2026-11-06). El mockup está en Figma (`https://www.figma.com/design/3OvP90pDHgudd6fVYjsoZu`); aún no hay código.
Fuentes: `Idea_Modulo_Proyectos.md` (idea dictada el 2026-11-04) y `Formato de Proyecto Listado- Visitas- Cierre TX-PX 2020.xlsx` (el formato en papel que se usaba en 2020).
Rama de trabajo: `module/proyectos`. Este documento nació en `docs/proyectos-especificacion`.
Actualización del 2026-11-05 (2): se aplicaron tus respuestas y los ajustes tomados del flujo de Eventos (`acople_flujo_eventos.md`). Qué se adoptó, qué se adaptó y por qué: `decisiones_acople_eventos.md`.
Actualización del 2026-11-06: todo lo que el flujo permite ajustar pasa a ser **configurable por el administrador sin programar**. Resumen en la sección 20 y detalle en `documentacion/configuracion_administrador.md`; cambios en las secciones 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16 y 18.

Cómo usar este documento: léelo de arriba abajo y edita lo que no coincida con lo que quieres. Todas las preguntas de la sección 18 están resueltas: unas con tu respuesta y otras como **parámetro con un valor por defecto** que el administrador puede cambiar sin programar.

## 1. Resumen

**Proyectos** es el módulo con el que Grupo Premia va a vender, mes a mes, a un nicho de mercado concreto (bancos, hospitales, colegios, farmacias…). Funciona en dos tiempos:

1. **Siempre abierta: la base de clientes.** Los asesores registran empresas con sus contactos cuando quieran, sin importar el mes. También se pueden importar listas completas.
2. **Cada mes: el proyecto.** Un supervisor (o el Administrador) elige un nicho y activa el proyecto. El sistema reparte **equitativamente** las empresas de ese nicho entre los asesores participantes. Cada asesor contacta a sus empresas, entrega muestras, cotiza y vende, y todo queda registrado.
3. **Al terminar:** el supervisor cierra el proyecto, el sistema arma el informe (contactados, interesados, cotizados, vendidos, efectividad) y el gerente da su visto bueno.

Propósito: **que los asesores se acerquen a clientes nuevos de forma ordenada y que se pueda medir cuánto se vendió**. Todo lo demás (informes, reasignaciones, plan del año) existe para servir a eso.

Por qué un módulo propio y no una pestaña de Vales: tiene su propio ciclo de vida (proyecto), sus propios datos (empresas, contactos, gestiones) y sus propios actores. Sigue la regla de `reglas_arquitectura.md`: módulo independiente, con su carpeta, sus rutas y sus tablas.

### Decisiones ya confirmadas (2026-11-05)

| Tema | Decisión |
|---|---|
| Alcance de un proyecto | **Configurable al activar**: quien activa elige las tiendas participantes (una tienda, un país o toda Centroamérica). |
| Ritmo | **Un proyecto por nicho y mes, con 4 etapas semanales**: preparar, contactar, dar seguimiento y cerrar. Las fechas se pueden ajustar. |
| Base de clientes | **Una base global**: cada empresa se registra una sola vez y se reutiliza en los meses siguientes. las empresas siempre se registrarán y filtrarán por país, para que cada asesor solo tenga clientes de su propio país, o los países que tenga asignados. |
| Quién la alimenta | **Asesores (en cualquier momento) + importación desde Excel** por Supervisor o Administrador. |
| Qué registra el asesor | Contactos (llamada, WhatsApp, visita, correo), muestra entregada, interés y cotización con monto, venta cerrada con monto y motivo de pérdida. |
| Conexión con Vales de Arte | Botón **«Crear vale»** con los datos del cliente prellenados, y el vale queda vinculado. esto es una idea, se aplicará al final si es aprobado|
| Clientes sin atender | **El supervisor reasigna con un clic** (un cliente o todos los de un asesor); se marcan los «estancados». |
| Cierre | **Informe automático + conclusiones del supervisor + visto bueno del gerente**, con PDF. |
| Moneda | **Moneda local por defecto** (según el país de la tienda). En cada cotización o venta se puede cambiar a dólares (US$). Los informes no mezclan monedas. |
| Tiendas | **Una tienda, un proyecto activo a la vez.** No pueden ser dos. Lo garantiza un índice único en la base de datos. |
| Importación | **CSV (UTF-8)** con plantilla descargable. Sin dependencias nuevas. |
| Flujo de Eventos | Se adoptan los ajustes B1 a B10 de `acople_flujo_eventos.md`, adaptados al portal (ver `decisiones_acople_eventos.md`). |
| Quién confirma una venta | **Por defecto la registra el asesor**, con referencia (número de OV) obligatoria, y el supervisor puede anularla con motivo. El administrador puede **encender** la confirmación del supervisor: la venta queda «por confirmar» hasta entonces. |
| Proyecto vencido | Pasa a «vencido» **3 días hábiles** después de su `fecha_fin`: se avisa y las tiendas no pueden iniciar otro; no se cierra solo. |
| Referencias de cotización y venta | **Obligatorias por defecto en todos los países**; el administrador puede volverlas opcionales **país por país** desde la pantalla de Reglas (A5). |
| Semáforo | **Cobertura durante el proyecto y efectividad al cierre**, con verde desde 75 %, ámbar de 50 a 74 % y rojo por debajo de 50 %. Los umbrales son parámetros que el administrador ajusta. |
| Todo lo configurable | **El administrador maneja el flujo sin programar**: catálogos, parámetros, plantillas de proyecto, interruptores de aprobación, campos propios de la empresa, alcance por país, avisos y plan del año (sección 20 y `documentacion/configuracion_administrador.md`). |
| Embudo | Los **7 estados** de la empresa son fijos; el administrador configura los **resultados de gestión** y a qué estado empuja cada uno. |
| Plantillas | El supervisor crea proyectos desde **plantillas** definidas por el administrador (etapas, valores y qué puede cambiar). |
| Aprobaciones | El administrador puede encender o apagar: visto bueno del gerente al cerrar (encendido), aprobación del gerente antes de activar (apagado), confirmación de ventas por el supervisor (apagado) y referencia obligatoria por país (encendida). |
| Cambios de configuración | Solo aplican a **proyectos nuevos**: cada proyecto guarda una foto de su configuración al activarse. Todo cambio queda en un historial. |
| Alcance por país | Cada persona recibe el país de su tienda; el administrador puede ampliarlo o quitarlo. |
| Avisos | **Configurables**: matriz de eventos por destinatario y anticipación de recordatorios. |
| Asesor en laptop | El asesor usa también laptop: hay versión de escritorio de «Mi proyecto» y de la ficha. |

## 2. Qué dicen las fuentes y cómo se resolvió

### 2.1 La idea del 4 de noviembre de 2026

| Lo que dice | Cómo lo recoge este diseño |
|---|---|
| Se pueden registrar datos de clientes en cualquier mes; el nicho cambia (bancos, hospitales, farmacias…). | Base global de empresas con un **nicho** (catálogo editable). Sección 10. |
| El proyecto del mes lo inician supervisores o administradores al elegir mes y nicho. | Estado `borrador` → `activo`, con permiso propio. Secciones 5 y 7. |
| Al elegir el nicho se reparte toda la base entre los asesores de esa tienda. | Distribución equitativa con vista previa antes de activar. Sección 8. |
| Cada tienda o supervisor tendría su propia gestión; «por confirmar» si Centroamérica trabaja unida. | Alcance **configurable**: el módulo soporta cualquiera de los dos sin cambios. Sección 4.3. |
| Cada asesor contacta, genera cotizaciones y registra. | Gestiones, cotizaciones y ventas por cliente. Sección 5. |
| «Es básicamente el mismo flujo que el evento.» | Se tradujo con `acople_flujo_eventos.md` (equivalencias y ajustes) y se evaluó contra el portal en `decisiones_acople_eventos.md`. |
| El inicio puede ser «automático o manual». | Manual en la primera versión; la activación automática con el plan del año se enciende desde la pantalla A2 (fase 9). |
| Base completa con contactos, teléfonos y nombres. | Empresa + varios contactos por empresa. Sección 10. |

Puntos ambiguos que resolví con una propuesta (ahora son parámetros que el administrador cambia; sección 20): qué pasa con la tienda de origen de una empresa, cuántos proyectos puede tener una tienda a la vez y cuánto tiempo «descansa» un cliente entre proyectos.

### 2.2 El Excel de 2020

Es la parte más valiosa: muestra **cómo trabajaban de verdad**. Tiene 4 hojas:

| Hoja | Qué contiene | Dónde queda en el módulo |
|---|---|---|
| **Enero–Abril Proyectos** | Un calendario de 16 semanas. Cada semana arranca un nicho (Colegios, Municipalidades, Iglesias, Gasolineras, Bancos y Cooperativas, Universidades, Gimnasios, Hoteles, Bomberos y Policía, Funerarias, Librerías, Restaurantes…) con **tres momentos**: definir/informar, visitar y dar seguimiento/cerrar. Cada nicho lleva un **producto** (Medalla, Posavaso, Llavero). | **Plan del año** (nicho + mes + artículo), **etapas** del proyecto y **artículo de muestra**. |
| **1 Listado** | Clientes por nicho y sucursal: cliente, página web, teléfono, **tipo** (una empresa, varias empresas o varias sucursales), **muestra física** sí/no; encabezado con artículo a entregar y cantidad en existencia. | Empresa con su estructura, sitio web y teléfono; **control de existencias** del artículo. |
| **2 Visitas a Clientes** | Por cliente: contacto por **departamento** (Gerencia general, Mercadeo, Compras, Recursos humanos, Recepción, Ventas), nombre, correo, teléfono, y si se hizo **visita** o **telemarketing**; quién buscó la información y quién visitó; dirección. | **Contactos por área**, **canal** de cada gestión (visita = presencial; llamada, WhatsApp y correo = remoto) y dirección. |
| **3 Cierre y Conclusión** | Cantidad de empresas, artículo entregado, **muestras por departamento**, conclusiones escritas, **clientes interesados** y **cotizados** con % de efectividad y monto cotizado, separados entre comercial y telemarketing; fechas de inicio, visitas y control; firmas del responsable, supervisor y gerente de ventas. | **Informe de cierre** (sección 11), conclusiones del supervisor y **visto bueno** del gerente. |

Lo que la idea nueva agrega y el Excel no tenía: la base global reutilizable, el reparto automático y equitativo entre asesores, el seguimiento en vivo y la medición de ventas reales.

## 3. Glosario

| Término | Significado |
|---|---|
| **Nicho** | Tipo de cliente al que se dirige un proyecto (Bancos, Hospitales…). Es un catálogo que administra el Administrador. En el Excel se llamaba «segmento» o «mercado». |
| **Empresa (cliente)** | Organización de la base global. Se registra una vez. |
| **Contacto** | Persona de una empresa, con su área (Compras, Mercadeo…), teléfono y correo. |
| **Proyecto** | Trabajo de un nicho durante un periodo (normalmente un mes) para un conjunto de tiendas. |
| **Etapa** | Cada tramo del proyecto: preparación, contacto, seguimiento y cierre. |
| **Alcance** | Las tiendas que participan en un proyecto. |
| **Participante** | Asesor que recibe empresas en un proyecto. |
| **Participación** | La empresa ya asignada a un asesor dentro de un proyecto. Es la pieza central del módulo. |
| **Gestión** | Cada intento de contacto que el asesor registra (llamada, WhatsApp, visita, correo). |
| **Artículo de muestra** | Lo que se entrega para abrir la puerta (medalla, llavero, posavasos). |
| **Estancado** | Participación sin ninguna gestión en los últimos días que se definan. |

## 4. Actores, roles y permisos

### 4.1 Quién hace qué

| Actor (rol del portal) | Qué hace en Proyectos |
|---|---|
| **Asesor de Ventas** (rol 2) | Registra empresas y contactos; gestiona **solo** las empresas que le tocaron; registra gestiones, muestras, cotizaciones y ventas; crea el vale. |
| **Supervisor de Ventas** (rol 3) | Todo lo del asesor sobre su propio trabajo, más: importa listas, crea y activa proyectos para **sus tiendas**, ve el avance de su equipo, reasigna, cierra y escribe las conclusiones. |
| **Gerente** (rol 8) | Solo lectura de todos los proyectos y tiendas; da el visto bueno al cierre; compara nichos y meses. |
| **Administrador** (rol 1) | Todo, incluido el **Centro de configuración**: catálogos, parámetros, plantillas de proyecto, reglas, campos propios, alcance por país, avisos y plan del año. |
| Resto de roles (diseñadores, encargados de taller…) | Sin acceso. |

### 4.2 Permisos (se validan en el backend)

Siguen la convención `<modulo>.<accion>`. Se crean con una migración nueva. **No se asignan a ningún rol hasta el final** del desarrollo, así el módulo no aparece en el portal antes de tiempo (sección 14).

| Permiso | Para qué | Roles al activar el módulo |
|---|---|---|
| `proyectos.ver` | Entrar al módulo | Asesor, Supervisor, Gerente, Administrador |
| `proyectos.clientes.registrar` | Crear y editar empresas y contactos | Asesor, Supervisor, Administrador |
| `proyectos.clientes.importar` | Importar listas | Supervisor, Administrador |
| `proyectos.gestionar` | Gestionar mis empresas asignadas | Asesor, Supervisor |
| `proyectos.activar` | Crear, activar, cancelar y cerrar proyectos | Supervisor, Administrador |
| `proyectos.reasignar` | Pasar empresas de un asesor a otro | Supervisor, Administrador |
| `proyectos.supervisar` | Ver el avance de mi equipo | Supervisor |
| `proyectos.ver_gerencia` | Ver todo en solo lectura | Gerente, Administrador |
| `proyectos.dar_visto_bueno` | Dar el visto bueno al cierre | Gerente |
| `proyectos.ver_reportes` | Ver y exportar informes en PDF | Supervisor, Gerente, Administrador |
| `proyectos.corregir` | Anular una cotización, venta o gestión equivocada y reabrir una participación `perdida` o `vendida` mientras el proyecto siga activo | Supervisor, Administrador |
| `proyectos.aprobar_activacion` | Aprobar o rechazar la activación de un proyecto (solo si el administrador encendió esa aprobación) | Gerente, Administrador |
| `proyectos.confirmar_ventas` | Confirmar o rechazar ventas «por confirmar» (solo si el administrador encendió esa confirmación) | Supervisor, Administrador |
| `proyectos.administrar` | Todo el **Centro de configuración**: catálogos, parámetros, plantillas, reglas, campos propios, alcance de usuarios, avisos, kit del nicho, plan del año e historial | Administrador |

La interfaz decide qué mostrar por permiso, nunca por el nombre del rol (regla de `CLAUDE.md`). Ningún servicio pregunta por el nombre del rol: el alcance global es un permiso (`proyectos.ver_gerencia`). Todos los permisos nuevos llevan `modulo = 'proyectos'`, porque el portal solo da por «permitido» un módulo cuando el usuario tiene `<módulo>.ver`.

En este portal los permisos viajan en el token de sesión. Un permiso que se asigna a un rol con una migración SQL se nota cuando el usuario vuelve a iniciar sesión o al refrescar el token; el refresco inmediato solo ocurre al editar los permisos desde la pantalla de roles de Administración (ver fase 8). **Quién puede hacer cada cosa se asigna siempre en esa pantalla Roles** (los permisos nuevos aparecen ahí solos); el Centro de configuración no duplica esa asignación.

### 4.3 Alcance de un supervisor

Un supervisor **no tiene una tienda propia**: cubre varias, y el portal ya sabe cuáles (tabla `supervisor_tiendas`). Eso resuelve la duda de Centroamérica **sin código especial**:

- En los datos de desarrollo, dos supervisores (usuarios 16 y 17) tienen las mismas 10 tiendas de Centroamérica. Cualquiera de los dos puede activar un proyecto para esas tiendas; no hace falta decidir «unidos o separados».
- Un supervisor solo puede incluir en el alcance tiendas que supervisa. El Administrador puede incluir cualquiera: en el paso 2 del asistente (S3) ve todas las tiendas del portal y, al activar, crea el proyecto con el mismo flujo que el supervisor (permiso `proyectos.activar`); el mockup lo anota con un aviso en S3.
- Un proyecto puede ser de una sola tienda, de un país o de toda la región; es solo una selección de tiendas.

Como un proyecto abarca varias tiendas, **ver no da poder de actuar**. Son tres niveles separados:

| Nivel | Regla |
|---|---|
| **Lectura del proyecto** | Un supervisor ve el proyecto completo si al menos una de **sus** tiendas está en el alcance. |
| **Acción** | Solo reasigna, anula o corrige participaciones de asesores de **sus** tiendas. |
| **Fila** | Un asesor ve solo **sus** participaciones. |

Las participaciones de otras tiendas aparecen como **«Otra tienda»** (nombre de la empresa y etapa), **sin contactos, referencias ni montos**, y ninguna acción las acepta. El servidor envía esos datos vacíos; no basta con ocultarlos en pantalla.

## 5. Flujo de trabajo

### 5.1 Vista general

```text
SIEMPRE ABIERTO                      CADA MES
┌──────────────────────┐   ┌───────────────────────────────────────────────────────────┐
│ A. Base de clientes  │   │ 1 Planificar → 2 Crear → 3 Vista previa → 4 Activar        │
│ Asesores registran;  │──▶│   (plan del año)  (borrador)  (reparto)    (se reparte)    │
│ supervisor importa   │   │                                                            │
└──────────────────────┘   │ 5 Gestionar (asesores) → 6 Seguimiento (supervisor)        │
                           │ 7 Cerrar (informe + conclusiones) → 8 Visto bueno (gerente)│
                           └───────────────────────────────────────────────────────────┘
```

### 5.2 Paso a paso

**A. Alimentar la base (permanente).**
1. Un asesor abre «Base de clientes» y registra una empresa: nombre, nicho, país, ciudad, teléfono, sitio web, estructura (una empresa, varias empresas o varias sucursales) y al menos un contacto con su área.
2. Antes de guardar, el sistema busca duplicados (mismo país, nombre parecido y ciudad; o mismo teléfono) y avisa. Si es la misma empresa, abre la existente en vez de crear otra.
3. Un supervisor puede importar una lista completa. El sistema muestra una vista previa (nuevas, duplicadas, con errores) y solo crea lo que se confirma.
4. Cualquier empresa puede marcarse «no contactar» (por pedido del cliente); desde ese momento no entra en ningún reparto.

**B. Preparar el proyecto (supervisor o Administrador).**
1. Elige la **plantilla** (por defecto, la predeterminada), el **mes** y el **nicho** (el plan del año sugiere el nicho del mes, si existe).
2. Elige el **alcance** (tiendas) y ve qué asesores participan. Puede excluir a quien esté de vacaciones o ausente.
3. Ajusta lo que la plantilla permita: **artículo de muestra** y su existencia, **meta** y **fechas de las etapas** (el sistema las propone con el calendario laboral). Lo que el administrador bloqueó aparece con candado.
4. Ve la **vista previa del reparto**: cuántas empresas recibe cada asesor y cada tienda, y avisos (por ejemplo, «12 empresas de Honduras sin asesor participante»).
5. **Activa**. En una sola transacción se crean las participaciones y se avisa a cada asesor. Si el administrador encendió la aprobación del gerente, el proyecto pasa a «esperando aprobación» y se reparte cuando el gerente lo aprueba.

**C. Gestionar (asesor).** Abre «Mi proyecto» y ve su lista de empresas con filtros por estado. Por cada empresa:
1. Ve la ficha: contactos por área, historial, notas.
2. **Contacta**: llama o abre WhatsApp con un toque (el portal no envía nada por sí solo). Registra la gestión: canal, con quién habló, resultado, nota y, si aplica, la fecha del próximo seguimiento.
3. Si entregó la **muestra**, la registra (cantidad y área). El stock del artículo baja solo.
4. Si hay interés, registra la **cotización** con su monto, moneda y número (la referencia es obligatoria salvo que el país la haya vuelto opcional).
5. Si compra, registra la **venta** (monto y número de orden de venta). Si el administrador encendió la confirmación de ventas, la venta queda **por confirmar** hasta que el supervisor la confirme.
6. «Para hoy» le muestra los seguimientos que vencen y los clientes que lleva días sin tocar.

**D. Dar seguimiento (supervisor).**
1. Ve el avance por asesor y por tienda: asignadas, gestionadas, interesadas, cotizadas, vendidas, con semáforo.
2. Ve los **estancados** y los atrasados respecto a la etapa vigente.
3. **Reasigna** una empresa o todas las de un asesor a otro; queda en el historial con el motivo.
4. Los cambios llegan en tiempo real (el asesor ve la nueva empresa sin recargar).

**E. Cerrar (supervisor).**
1. Cierra el proyecto. El sistema muestra el informe calculado y avisa de lo que quedó sin gestionar.
2. El supervisor escribe las **conclusiones** (qué funcionó, qué no, qué recomienda).
3. Confirma el cierre. El proyecto pasa a solo lectura; las empresas sin gestionar vuelven a estar disponibles para otro proyecto; el resultado de las demás se conserva.

**F. Visto bueno (gerente).** Revisa el informe y las conclusiones y da su visto bueno (o devuelve un comentario). El informe se puede exportar a PDF en cualquier momento. Si el administrador apagó el visto bueno, el cierre termina en el paso E.

**Caminos opcionales (los enciende el administrador en la pantalla A5; con todo apagado el flujo es el de arriba).**
- *Aprobación antes de activar.* El supervisor pide la activación; el proyecto queda en `pendiente_aprobacion`; el gerente la aprueba (y entonces se reparte) o la rechaza con comentario (y vuelve a `borrador`).
- *Confirmación de ventas.* La venta nace `por_confirmar`; el supervisor la confirma o la rechaza con motivo; solo la confirmada lleva la empresa a `vendida` y cuenta en los informes.
- *Referencia opcional.* En un país con la referencia desactivada, la cotización y la venta se guardan sin número.

### 5.3 Etapas dentro del mes

| Etapa | Semana sugerida | Qué se espera |
|---|---|---|
| Preparación | 1 | ¿Los **supervisores** también reciben empresas en el reparto, o solo los asesores? | **Resuelta:** parámetro `reparto.reciben_supervisores`; por defecto solo asesores. |
| Contacto | 2 | ¿Quién puede crear un **nicho nuevo**? | **Resuelta:** quien tenga `proyectos.administrar` (por defecto solo el Administrador; se amplía desde Roles). |
| Seguimiento | 3 | ¿Datos mínimos para registrar una empresa? | **Resuelta:** nombre, nicho y país son fijos; el resto son parámetros (`empresas.*`). Por defecto, además, un contacto y un teléfono o correo. |
| Cierre | 4 | Cerrar ventas, registrar motivos de pérdida y entregar conclusiones. |

Las etapas **orientan, no bloquean**: el asesor puede registrar en cualquier etapa mientras el proyecto esté activo. Sirven para el semáforo y para decir «vas atrasado respecto a la etapa». Las cuatro de la tabla son las de la plantilla «Proyecto mensual estándar»: el administrador puede cambiar sus nombres, su número, su duración y lo que se espera de cada una.

## 6. Reglas de negocio

1. Una empresa aparece **una sola vez** en la base. Los duplicados se advierten antes de crear.
2. Una empresa tiene **una sola participación** por proyecto, y no puede estar en dos proyectos activos a la vez. La base de datos lo garantiza con un índice único (sección 10.3); no depende solo del servicio.
3. Una **tienda** está en **un solo proyecto activo** a la vez, para no saturar a los asesores (decidido). Si hay conflicto —por ejemplo, dos supervisores que activan a la vez—, solo uno gana y el sistema dice qué tienda falló y qué proyecto la bloquea. Lo garantiza un índice único en la base de datos.
4. El reparto lo calcula **solo el backend**, en una transacción. El navegador nunca decide a quién le toca qué.
5. Un asesor ve y gestiona **solo sus participaciones**. Un supervisor ve las de sus tiendas. El gerente ve todas, sin poder editar.
6. Las **gestiones, cotizaciones, ventas y reasignaciones no se editan ni se borran**. Una cotización o venta equivocada se **anula** (con motivo, quién y cuándo; permiso `proyectos.corregir`) y se registra otra: lo anulado no cuenta en ningún informe pero queda en el historial. Es lo que permite medir con confianza (mismo criterio que el historial de Vales).
7. Cambiar de asesor una participación solo se hace con **reasignación**, que guarda quién, cuándo, de quién a quién y por qué.
8. La identidad sale siempre de `req.user`, nunca del cuerpo de la petición.
9. Un proyecto **cerrado o cancelado es de solo lectura**.
10. Al cerrar, las participaciones sin gestionar **vuelven a estar disponibles**; las que tienen resultado (vendida, perdida, descartada) conservan su estado.
11. Una empresa en «no contactar» o «inactiva» nunca entra en un reparto.
12. Los clientes con venta **no se reparten otra vez** en el siguiente proyecto del mismo nicho si todavía están dentro del periodo de descanso (parámetro `reparto.descanso_meses`; por defecto 3 meses, 0 lo apaga).
13. El monto de una cotización o venta lleva **moneda**. Por defecto es la **moneda local del país de la tienda** (GTQ, USD en El Salvador, HNL, NIO, CRC); quien registra puede cambiarla a dólares (US$) en ese registro. Los informes **no mezclan ni convierten monedas**: muestran un total por moneda.
14. El artículo de muestra tiene **existencia por proyecto**; una entrega que la deje en negativo se rechaza con un mensaje claro.
15. Los datos de contacto (teléfono, correo) solo los ven quienes tengan permiso `proyectos.ver`; no salen en URLs ni en registros de log.
16. Cuando un asesor registra una empresa **del nicho del proyecto activo**, se le asigna a él automáticamente si participa; si no, queda disponible para que el supervisor la incorpore.
17. Una **venta no se guarda sin referencia** (el número de orden de venta) y una **cotización lleva su número de cotización**, salvo en los países donde el administrador desactivó la referencia obligatoria. Si la referencia ya existe en otra venta no anulada, se avisa y se pide confirmar.
18. Un proyecto `activo` cuya `fecha_fin` ya pasó, más los **días hábiles de gracia** (parámetro `vencimiento.gracia_dias_habiles`; por defecto 3), está **vencido**: se avisa al supervisor y al gerente, y mientras no se cierre sus tiendas no pueden iniciar otro. **No se cierra solo**, porque el cierre pide las conclusiones.
19. Una acción **notifica solo si quien la hace es distinto del destinatario**. En una reasignación se avisa a quien recibe y a quien pierde la empresa.
20. Las cifras salen de **una sola función** de informe y son acumulativas (sección 11).
21. Todo lo que el administrador configura aplica a **proyectos nuevos**: cada proyecto guarda una foto de su configuración al activarse y la lee de ahí (sección 20).
22. Los **7 estados** de la empresa son fijos; los **resultados de gestión** son configurables y solo pueden subir el estado hasta `interesada`. `cotizada` y `vendida` las fijan la cotización y la venta.
23. Con la confirmación de ventas encendida, una venta cuenta en los informes y lleva la empresa a `vendida` solo cuando está `confirmada`.

## 7. Estados

Los estados se guardan como texto (`VARCHAR`), escritos completos y en minúsculas. Agregar un estado en el futuro es un cambio de código, no de base de datos.

### 7.1 Proyecto

```text
borrador ──activar──▶ activo ──cerrar──▶ cerrado
   │  ╲                  │
   │   ╲ pedir aprobación (opcional)
   │    ▼
   │  pendiente_aprobacion ──aprobar──▶ activo
   └──cancelar──▶ cancelado ◀──cancelar──┘
```

| Estado | Significado | Quién lo cambia |
|---|---|---|
| `borrador` | Se está preparando; aún no hay reparto. | `proyectos.activar` |
| `pendiente_aprobacion` | Solo existe si el administrador encendió la aprobación antes de activar: el supervisor pidió activar y espera al gerente. Rechazada, vuelve a `borrador` con comentario. | Pedir: `proyectos.activar`. Aprobar o rechazar: `proyectos.aprobar_activacion`. |
| `activo` | Ya se repartió; los asesores gestionan. | `proyectos.activar` |
| `cerrado` | Terminado, con informe y conclusiones. | `proyectos.activar` |
| `cancelado` | Se canceló antes de cerrar; las empresas quedan disponibles. | `proyectos.activar` |

El **visto bueno** del gerente no es un estado: son campos aparte (`visto_bueno_por`, `visto_bueno_en`, `visto_bueno_comentario`), para que se pueda pedir, dar o devolver sin cambiar el ciclo del proyecto. Con el visto bueno apagado (pantalla A5), el cierre no queda a la espera de nadie.

### 7.2 Participación (una empresa dentro de un proyecto)

```text
pendiente ─▶ en_gestion ─▶ interesada ─▶ cotizada ─▶ vendida
                │              │            │
                └──────────────┴────────────┴──▶ perdida
pendiente ──▶ descartada  (dato inválido, ya no existe, no contactar)
```

| Estado | Significado |
|---|---|
| `pendiente` | Asignada, sin ninguna gestión. |
| `en_gestion` | Hay al menos una gestión. |
| `interesada` | El cliente mostró interés. |
| `cotizada` | Hay al menos una cotización. |
| `vendida` | Hay una venta registrada. |
| `perdida` | No compró; lleva motivo de pérdida. |
| `descartada` | No se puede trabajar (dato inválido, cerró, pidió no ser contactado). |

El estado **sube** por las acciones que el asesor registra (no se elige a mano), salvo `perdida` y `descartada`, que se marcan de forma explícita. Una empresa `perdida` puede reabrirse con una gestión nueva mientras el proyecto siga activo. El **resultado** de cada gestión (catálogo configurable) decide si empuja la empresa a `en_gestion` o a `interesada`; nunca la baja ni la lleva a `cotizada` o `vendida`, que fijan la cotización y la venta.

### 7.3 Venta

| Estado | Significado |
|---|---|
| `confirmada` | Valor por defecto: cuenta en los informes y lleva la empresa a `vendida`. |
| `por_confirmar` | Solo con la confirmación de ventas encendida: espera al supervisor; no cuenta todavía. |
| `rechazada` | El supervisor no la confirmó (con motivo); vuelve al asesor y no cuenta. |

Una venta equivocada no se edita: se **anula** con motivo (columnas `anulada_*`).

## 8. Distribución equitativa

### 8.1 Qué empresas entran

Las empresas **elegibles** son las que cumplen todo esto:

- Estado `activa` y no marcadas «no contactar».
- Nicho igual al del proyecto.
- País igual a alguno de los países de las tiendas del alcance.
- Sin participación en otro proyecto activo.
- Fuera de su periodo de descanso (regla 12).

### 8.2 Cómo se reparte

1. Se separa por **país**: las empresas de cada país se reparten entre los asesores participantes de ese país.
2. Dentro del país, se asigna **una por una al asesor que tenga menos empresas**. Así la diferencia entre dos asesores nunca pasa de **una**.
3. Cuando varios asesores empatan, se prefiere al de la **tienda que registró la empresa** (afinidad). Es solo un desempate: no rompe la equidad. Se puede apagar con el parámetro `reparto.afinidad_tienda`.
4. El orden es determinista (por identificador), así la vista previa y el resultado final son idénticos.
5. Tope opcional por asesor (por ejemplo 40). Lo que sobra queda **en reserva** y se puede repartir después en una segunda ronda. El tope y las rondas son parámetros (`reparto.tope_por_asesor`, `reparto.rondas`): la plantilla propone el tope y el supervisor lo ajusta si se lo permite.

**Quién participa.** Los asesores con tienda en el alcance; los supervisores solo si el parámetro `reparto.reciben_supervisores` está encendido (por defecto no).

### 8.3 Vista previa

Antes de activar se muestra, sin guardar nada:

- Empresas por asesor y por tienda.
- Empresas sin asesor (país sin participantes) y empresas en reserva.
- Asesores excluidos y por qué.
- Cantidad total, nicho, alcance y fechas.

### 8.4 Después de activar

- **Asesor nuevo o que vuelve:** el supervisor lo agrega y puede «tomar» empresas de otros para equilibrar.
- **Asesor ausente:** reasignación masiva de todas sus empresas pendientes.
- **Empresa nueva del nicho:** regla 16.
- Toda reasignación queda auditada.

## 9. Pantallas por rol (para el mockup)

Todo en el diseño actual del portal: tokens de `public/css/global.css`, encabezado de 70 px, menú lateral oscuro, contadores, tarjetas y tablas con scroll solo en la tabla (patrón del Buzón), Ionicons y las reglas de `reglas_disenoUI.md`. Celular primero para el asesor (llama, escribe y registra desde el teléfono); escritorio para supervisor, gerente y administrador.

**Asesor**
1. **Mi proyecto** (inicio): proyecto activo y etapa vigente, mis cifras (asignadas, gestionadas, interesadas, cotizadas, vendidas), «Para hoy» y mi lista de empresas con filtros.
2. **Ficha de la empresa**: datos, contactos por área, línea de tiempo de gestiones, cotizaciones, muestras, botones Llamar, WhatsApp, Registrar gestión y Crear vale.
3. **Registrar gestión** (hoja en celular, ventana en escritorio): canal, contacto, resultado, nota, próximo seguimiento, muestra, cotización.
4. **Base de clientes**: buscador global por nicho, país y nombre; registrar empresa con aviso de duplicados.
5. **Mis proyectos anteriores**: resultados históricos propios.

**Supervisor**
6. **Proyectos**: lista por mes con estado y avance.
7. **Crear y activar proyecto**: asistente de 4 pasos (nicho y mes → alcance y participantes → artículo, meta y etapas → vista previa y activación).
8. **Seguimiento**: avance por asesor y tienda, semáforo, estancados, reasignar (una o masivo).
9. **Importar clientes**: plantilla, vista previa, errores y confirmación.
10. **Cierre**: informe, conclusiones, estado del visto bueno y PDF.

**Gerente**
11. **Panel gerencial**: proyectos por mes, efectividad por tienda y país, ventas, comparación entre nichos; cola de «por dar visto bueno».

**Administrador**
12. **Centro de configuración** (inicio, A0): una tarjeta por área con el último cambio y avisos.
13. **Catálogos** (A1): nichos, artículos, áreas de contacto, canales, resultados de gestión (con el estado al que empuja cada uno), motivos de pérdida, estructuras de empresa, monedas y países.
14. **Plan del año** (A2): calendario de nichos por mes (el «Enero–Abril» del Excel de 2020, pero editable) y activación automática.
15. **Parámetros** (A3): reparto, seguimiento, semáforo, importación, empresas, código del proyecto e informe.
16. **Plantillas de proyecto** (A4): lista y editor con etapas, valores y qué puede cambiar el supervisor.
17. **Reglas y aprobaciones** (A5): interruptores globales y tabla por país (referencia y confirmación de ventas).
18. **Campos propios** (A6): lista y editor por nicho.
19. **Alcance de usuarios** (A7): países por persona.
20. **Notificaciones** (A8): matriz de eventos por destinatario.
21. **Kit del nicho** (A9) e **Historial de cambios** (A10).

**Se suman con la configuración**: selector de plantilla y campos bloqueados con candado en el paso 1 del asistente; «esperando aprobación» y la pantalla del gerente para aprobar la activación; venta «por confirmar» y la cola de confirmación del supervisor; campos propios en los formularios de empresa y en la plantilla CSV; referencia opcional en cotización y venta.

**Transversales (se diseñan en el mockup)**: entrada desde el portal, fila «Otra tienda» (sin datos sensibles), aviso de proyecto vencido, anular un registro con motivo, notificaciones de la campana, estados vacío / cargando / error / sin permiso, confirmaciones (activar, reasignar, cerrar), validaciones en formularios y las variantes por rol.

## 10. Modelo de datos (borrador)

Prefijo `proy_`, igual que `vale_` y `prompt_`. Estados completos. Charset y motor como el resto de `schema.sql`. Las tablas nuevas van en una **migración** (`database/migrations/`), nunca editando `schema.sql` ni `seed.sql` (regla de `CLAUDE.md`). Se reutilizan `usuarios`, `paises`, `tiendas`, `roles`, `permisos` y `notificaciones`; no se copia nada de ellas.

### 10.1 Catálogos (los administra el Administrador)

```sql
proy_nichos             (id, nombre UNIQUE, descripcion, activo, orden)
proy_areas_contacto     (id, nombre UNIQUE, activo, orden)   -- Gerencia general, Mercadeo, Compras,
                                                              -- Recursos humanos, Recepción, Ventas, Otra
proy_canales            (id, nombre UNIQUE, presencial, activo)   -- Llamada, WhatsApp, Visita, Correo
proy_resultados_gestion (id, nombre, contacto_logrado, requiere_proxima,
                         efecto_estado,              -- ninguno | en_gestion | interesada (nunca baja el estado)
                         activo, orden)
proy_motivos_perdida    (id, nombre, activo, orden)
proy_articulos          (id, nombre UNIQUE, descripcion, activo)  -- Medalla, Llavero, Posavasos…
proy_monedas            (codigo PK, nombre, simbolo, activa)       -- GTQ, USD, HNL, NIO, CRC
proy_estructuras        (id, nombre UNIQUE, activa, orden)         -- Una empresa, Varias empresas, Varias sucursales
proy_pais_config        (pais_id PK, moneda_codigo, prefijo_telefono, formato_telefono,
                         referencia_obligatoria,                    -- 1 por defecto
                         confirmacion_ventas)                       -- NULL = usa el valor global
```

Los canales y resultados son **tablas, no listas fijas en el código**: agregar «Redes sociales» o «Cita agendada» mañana es una fila nueva, sin tocar el programa.

### 10.2 Base global

```sql
CREATE TABLE IF NOT EXISTS `proy_clientes` (
  `id`                  INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`              VARCHAR(150) NOT NULL,
  `nombre_normalizado`  VARCHAR(150) NOT NULL,
  `nicho_id`            INT NOT NULL,
  `pais_id`             INT NOT NULL,
  `ciudad`              VARCHAR(100) DEFAULT NULL,
  `direccion`           VARCHAR(255) DEFAULT NULL,
  `sitio_web`           VARCHAR(255) DEFAULT NULL,
  `telefono`            VARCHAR(30)  DEFAULT NULL,
  `datos_extra`         JSON DEFAULT NULL,                             -- valores de los campos propios (proy_campos)
  `estructura_id`       INT NOT NULL,                                  -- catálogo proy_estructuras
  `estado`              VARCHAR(20)  NOT NULL DEFAULT 'activa',        -- activa | inactiva | no_contactar
  `origen`              VARCHAR(20)  NOT NULL DEFAULT 'asesor',        -- asesor | importacion
  `tienda_origen_id`    INT DEFAULT NULL,
  `creado_por`          INT NOT NULL,
  `creado_en`           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`nicho_id`) REFERENCES `proy_nichos` (`id`),
  FOREIGN KEY (`estructura_id`) REFERENCES `proy_estructuras` (`id`),
  FOREIGN KEY (`pais_id`) REFERENCES `paises` (`id`),
  FOREIGN KEY (`tienda_origen_id`) REFERENCES `tiendas` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`),
  INDEX `idx_proy_clientes_reparto` (`nicho_id`, `pais_id`, `estado`),
  INDEX `idx_proy_clientes_busqueda` (`pais_id`, `nombre_normalizado`)
);

proy_contactos (id, cliente_id, area_id, nombre, cargo, telefono, correo, principal, activo, creado_por, creado_en)
```

No hay clave única sobre el nombre: dos colegios distintos pueden llamarse igual en ciudades distintas. El duplicado se detecta **en el servicio** (país + nombre normalizado + ciudad, o mismo teléfono) y se resuelve con una confirmación.

### 10.3 Proyecto y reparto

```sql
proy_proyectos        (id, codigo UNIQUE, nombre, nicho_id, anio, mes, articulo_id, existencia_muestras,
                       plantilla_id,                  -- plantilla con la que se creó (NULL si no hubo)
                       config_snapshot JSON,          -- FOTO de la configuración al activar (sección 20)
                       aviso_vencido_en,              -- para avisar una sola vez (como atraso_notificado_en en Vales)
                       meta_monto, meta_moneda, estado, fecha_inicio, fecha_fin, tope_por_asesor,
                       aprobacion_pedida_por, aprobacion_pedida_en,         -- solo si la aprobación está encendida
                       aprobada_por, aprobada_en, aprobacion_comentario,
                       activado_por, activado_en, cerrado_por, cerrado_en, conclusiones,
                       resumen_cierre JSON,           -- foto de las cifras al cerrar
                       visto_bueno_por, visto_bueno_en, visto_bueno_comentario,
                       creado_por, creado_en)
proy_proyecto_etapas  (id, proyecto_id, orden, nombre, descripcion, fecha_inicio, fecha_fin)  -- copia de la plantilla; editable si se permite
proy_proyecto_tiendas (proyecto_id, tienda_id,                          -- el alcance
                       proyecto_abierto,                   -- 1 solo mientras el proyecto está activo
                       tienda_abierta_id,                  -- VIRTUAL: IF(proyecto_abierto = 1, tienda_id, NULL), índice ÚNICO
                       UNIQUE (tienda_abierta_id))
proy_participantes    (proyecto_id, usuario_id, tienda_id, estado, motivo) -- activo | excluido
proy_participaciones  (id, proyecto_id, cliente_id, asesor_id, tienda_id, estado,
                       asignada_en, asignada_por,     -- NULL = reparto automático
                       ultima_gestion_en,
                       proxima_gestion_en,            -- ÚNICA fuente de la fecha del próximo seguimiento
                       motivo_perdida_id,
                       abierta,                       -- 1 mientras el proyecto está activo; 0 al cerrar o cancelar
                       cliente_abierto_id,            -- VIRTUAL: IF(abierta = 1, cliente_id, NULL), índice ÚNICO
                       UNIQUE (proyecto_id, cliente_id), UNIQUE (cliente_abierto_id),
                       INDEX (proyecto_id, asesor_id, estado), INDEX (asesor_id, abierta, proxima_gestion_en))
```

`resumen_cierre` guarda las cifras tal como estaban al cerrar. Así un informe histórico no cambia aunque después se corrija un dato (mismo criterio de «foto» que usa `prompt_propuestas`). MariaDB trata `JSON` como `LONGTEXT`: se lee y escribe completo, sin consultar por rutas.

**Unicidad en la base de datos.** Las reglas 2 y 3 se respaldan con índices únicos sobre columnas generadas `VIRTUAL` (no `STORED`: con claves foráneas en cascada MariaDB 11 dio el error 1901 en el sistema de Eventos). Los `NULL` repetidos no chocan en un índice único, así que las filas de proyectos cerrados no estorban. Importa porque dos supervisores comparten las mismas tiendas y pueden activar a la vez: sin el índice, los dos repartirían las mismas empresas.

- Activar es **idempotente**: compara el estado en la misma sentencia (`UPDATE … WHERE estado = 'borrador'`) y acepta `idempotencyKey`. Un doble clic o un reintento no reparte dos veces.
- Bloquea siempre en el mismo orden: `proy_proyectos` → `proy_proyecto_tiendas` → `proy_clientes` → `proy_participaciones`.
- No usa `INSERT IGNORE`: el servicio captura el error de duplicado y responde con claridad qué tienda o empresa ya está en otro proyecto.
- Es la primera columna generada del portal: se prueba en `staging` (MariaDB) antes de depender de ella. Si diera problemas, la alternativa es una tabla `proy_clientes_abiertos` con el cliente como clave primaria, mantenida en la misma transacción.

### 10.4 Trabajo del asesor (solo se agregan filas)

```sql
proy_gestiones         (id, participacion_id, usuario_id, canal_id, contacto_id, resultado_id,
                        nota,
                        proxima_en,   -- dato histórico del registro; la fecha vigente está en proy_participaciones
                        creado_en,
                        INDEX (participacion_id, creado_en), INDEX (usuario_id, creado_en))
proy_entregas_muestra  (id, participacion_id, area_id, cantidad, entregada_por, creado_en)
proy_cotizaciones      (id, participacion_id, monto DECIMAL(12,2), moneda, referencia, nota, vale_id,
                        creado_por, creado_en, anulada_en, anulada_por, anulacion_motivo)
proy_ventas            (id, participacion_id, monto DECIMAL(12,2), moneda, referencia, vale_id,
                        estado,       -- confirmada (por defecto) | por_confirmar | rechazada
                        revisada_por, revisada_en, revision_motivo,
                        creado_por, creado_en, anulada_en, anulada_por, anulacion_motivo)
proy_reasignaciones    (id, participacion_id, de_usuario_id, a_usuario_id, motivo, por_usuario_id, creado_en)
```

La **referencia** es el número de cotización y de orden de venta del sistema contable: permite comprobar cada venta. Es obligatoria o no según el país (configuración): la base de datos la admite vacía y **el servicio decide** con la configuración del país. `monto` usa `DECIMAL(12,2)` porque el colón costarricense maneja cifras mayores que las de Vales (`DECIMAL(10,2)`). **Anular** llena `anulada_en`, `anulada_por` y `anulacion_motivo` (nunca se borra) y el estado de la participación se **recalcula** con esta precedencia, ignorando lo anulado: `vendida` > `cotizada` > `interesada` > `en_gestion` > `pendiente`. `perdida` y `descartada` son marcas explícitas que se quitan al reabrir.

### 10.5 Soporte

```sql
proy_historial       (id, proyecto_id, usuario_id, accion, detalle JSON, creado_en)   -- activar, cerrar, cancelar, visto bueno…
proy_importaciones   (id, usuario_id, archivo, filas, creadas, duplicadas, con_error, creado_en)
proy_plan_nichos     (id, anio, mes, pais_id NULL, nicho_id, articulo_id, plantilla_id)   -- fase 9
```

`notificaciones` ya tiene la columna `modulo` (los avisos de Proyectos usan `proyectos`), pero hoy su única referencia es `vale_id`. Para avisar «te asignaron 14 empresas» sin tocar Vales, una migración **aditiva** agrega dos columnas opcionales (`referencia_tipo`, `referencia_id`). Es el único cambio a una tabla compartida y no afecta lo existente.

### 10.6 Configuración del administrador

```sql
proy_plantillas         (id, nombre UNIQUE, descripcion, activa, predeterminada, duracion_semanas,
                         articulo_id, existencia_sugerida, tope_por_asesor, meta_monto, meta_moneda,
                         controles JSON)                            -- por campo: editable | bloqueado | obligatorio
proy_plantilla_etapas   (id, plantilla_id, orden, nombre, descripcion, duracion_dias_habiles)
proy_campos             (id, nicho_id NULL, clave UNIQUE, etiqueta, tipo, opciones JSON,
                         obligatorio, visible_en_lista, orden, activo)   -- tipo: texto | numero | lista | si_no | fecha
proy_usuario_paises     (usuario_id, pais_id, accion, creado_por, creado_en)   -- agregar | quitar (solo excepciones)
proy_notificaciones_config (evento, destinatario, activo, anticipacion_horas)
proy_kits               (id, nicho_id, guion, activo)               -- fase 9
proy_kit_mensajes       (id, kit_id, canal_id, titulo, texto, activo, orden)
proy_config_historial   (id, usuario_id, entidad, clave, accion, antes JSON, despues JSON, creado_en)
```

Los **parámetros** (reparto, seguimiento, semáforo, importación, empresas, código, informe y los interruptores de aprobación) no llevan tabla propia: se guardan en `parametros_sistema` con el prefijo `proyectos.` y los describe un registro en código (`parametros.js`). Cada proyecto guarda en `config_snapshot` la configuración con la que se activó. El detalle de cada parámetro, plantilla, campo y aviso está en `documentacion/configuracion_administrador.md`.

### 10.7 Semillas iniciales

Los nichos del Excel de 2020 (Colegios, Municipalidades, Iglesias, Gasolineras, Canchas deportivas, Bancos y cooperativas, Universidades, Gimnasios, Medios de comunicación, Hostales y hoteles, Estaciones de bomberos y policía, Serigrafías, Funerarias y cementerios, Librerías, Restaurantes) más Hospitales y Farmacias de la idea nueva; los artículos Medalla, Llavero y Posavasos; las seis áreas de contacto; los cuatro canales; y motivos de pérdida y resultados de gestión básicos (cada uno con el estado al que empuja); las tres estructuras de empresa; la configuración por país (moneda local y referencia obligatoria); la plantilla «Proyecto mensual estándar»; y el campo propio «¿Ya es cliente de Premia?». Todo editable.

## 11. Informe de cierre y métricas

Se calcula al vuelo mientras el proyecto está activo y se **congela** al cerrar. Es la hoja 3 del Excel de 2020, ahora automática.

| Métrica | Cálculo |
|---|---|
| Empresas asignadas | Participaciones del proyecto |
| Gestionadas | Todas menos las pendientes (acumulativo) |
| Contactadas | Con al menos una gestión cuyo resultado tiene `contacto_logrado` |
| Interesadas | Estado `interesada`, `cotizada` o `vendida` → **% = interesadas ÷ asignadas** (como «% efectividad» del Excel) |
| Cotizadas | Con al menos una cotización **o** una venta → cantidad, **monto cotizado por moneda** y % |
| Vendidas | Con al menos una venta → cantidad, **monto vendido por moneda** y % |
| Perdidas | Con motivo de pérdida, agrupadas por motivo |
| Por canal | **Presencial** (visita, el «COMER» del Excel) frente a **remoto** (llamada, WhatsApp, correo: el «TMKT») |
| Muestras | Entregadas por área de contacto (la tabla «3A» del Excel) y existencia restante |
| Por asesor y por tienda | Todo lo anterior desglosado |
| Fechas | Inicio, primera gestión y cierre |

**Una sola fuente.** Una única función de informe calcula todas las cifras; la pantalla, el PDF y la exportación solo la llaman, así nunca dicen cosas distintas. Las tasas son **acumulativas**: una venta sin cotización previa cuenta como cotizada, para que el embudo no quede invertido. Lo **anulado** no cuenta. Con la confirmación de ventas encendida, solo cuentan las ventas **confirmadas**. Las cifras con dinero muestran **un total por moneda**.

**Semáforo.** Durante el proyecto mide la **cobertura** (gestionadas ÷ asignadas, frente a lo esperado para la etapa); al cierre, la **efectividad** (interesadas ÷ asignadas, como la hoja de 2020). Verde desde 75 %, ámbar de 50 a 74 %, rojo por debajo de 50 %. Los umbrales son parámetros (A3): el administrador los ajusta y cada proyecto usa los que tenía al activarse.

**Tiempo de reacción.** Días entre la asignación y la primera gestión de cada asesor: dice si de verdad empezó.

**Seguimiento.** La fecha del próximo seguimiento vive solo en `proxima_gestion_en` de la participación. Está **vencida** si es anterior a hoy; «hoy» sale de `calendario.ahoraUTC6()` (toda la región usa UTC-6, sin zonas por país). Orden de «Mi proyecto» y «Para hoy»: cerradas al final → vencidas primero → fecha más próxima → sin contactar antes que contactadas.

**Corte en el PDF.** Las tablas largas se cortan en 20 filas (parámetro `informe.filas_por_tabla`) con «y N más»; la lista completa va en la exportación (mejora 10). Qué secciones lleva el informe también es un parámetro.

El PDF del informe incluye: encabezado del proyecto (nicho, periodo, alcance, artículo), las cifras, el desglose, las conclusiones del supervisor y el visto bueno del gerente con nombre y fecha (reemplaza las firmas del formato en papel).

## 12. Integración con el portal

| Aspecto | Cómo queda |
|---|---|
| **Backend** | `src/modules/proyectos/` con `controllers/`, `services/`, `repositories/`, `routes.js`, `events.js`, `constantes.js`. Controllers delgados, reglas en services, SQL en repositories parametrizado con `db.query(sql, params, tag)`. Errores con `responderError`; ids con `idObligatorio`/`idOpcional`. |
| **Montaje** | `app.use('/api/proyectos', requireAuth, requirePermission('proyectos.ver'), proyectosRoutes)` **después** de `authenticateJWT` y de la puerta de mantenimiento. |
| **Catálogo de módulos** | Una entrada en `MODULOS` (`src/core/permissions/modulesCatalog.js`): `id: 'proyectos'`, ruta `/modules/proyectos`, permiso `proyectos.ver`, un color propio. Va **desde la primera subrama**: el servicio de notificaciones valida el módulo contra este catálogo. No lo expone: la tarjeta del portal solo aparece a quien tenga `proyectos.ver`, y nadie lo tiene hasta la última rama. |
| **Frontend** | `public/modules/proyectos/` con `index.html`, `css/styles.css` y `js/` en módulos ES (`api/`, `components/`, `layout/`, `views/`, `state.js`), como Vales y Prompts. Vanilla JS, `global.css`, Ionicons. Sin frameworks. Se respetan los marcadores del importmap. |
| **Permisos** | Migración con los permisos de la sección 4.2. Nada asignado a roles hasta el final. |
| **Notificaciones** | `core/notifications` con `modulo = 'proyectos'`: reparto recibido, reasignación, seguimiento que vence, proyecto vencido o por cerrar, visto bueno pedido o dado. Solo se notifica a un destinatario **distinto del autor**; en una reasignación se avisa a quien recibe y a quien pierde. El aviso de proyecto vencido sale una sola vez (columna `aviso_vencido_en`) desde una revisión periódica con el patrón de los vigilantes de Vales; no es una acción crítica porque no envía correos ni push. Hoy `notificaciones` solo referencia `vale_id`: una migración **aditiva** suma `referencia_tipo` y `referencia_id` opcionales y un parámetro opcional en `crearParaUsuarios`. Las notificaciones se purgan a los 30 días. Qué eventos avisan, a quién y con cuánta anticipación lo configura el administrador (A8). |
| **Tiempo real** | `socketManager.sendToModule('proyectos', …)` y salas por proyecto para el seguimiento del supervisor. Los clientes se registran con `register_module`. |
| **Calendario** | Se reutiliza `src/core/calendario/` (horario laboral y feriados por país) para proponer fechas de etapas, contar los días de gracia y calcular «seguimientos vencidos». Toda la región usa UTC-6: «hoy» sale de `ahoraUTC6()`. No hay calendario ni zonas horarias nuevas. |
| **Vales de Arte** | El botón «Crear vale» abre Vales con `?prellenar=proyectos:<id>`; **no viajan datos personales por la URL**. El formulario de Vales pide los datos a `GET /api/proyectos/participaciones/:id/prefill-vale` (verifica permiso y dueño) y, al guardar, avisa a `POST /api/proyectos/participaciones/:id/vincular-vale`. Vales solo gana un cambio pequeño de interfaz; el backend de Vales no depende de Proyectos. Va en su propia subrama. |
| **Entornos** | La primera versión **no envía mensajes ni correos ni llama a servicios externos**: llamar y WhatsApp son enlaces `tel:` y `wa.me` que abre el navegador del asesor. Por eso no hay acciones críticas nuevas (`reglas_entornos.md`). Si en el futuro se envía WhatsApp o correo desde el servidor, será una acción crítica solo en producción y se agrega al inventario. |
| **Archivos** | No se guardan archivos en MySQL. El informe PDF se genera al pedirlo con `pdf-lib` (ya instalada), igual que los reportes de Vales, y **no se almacena**. |
| **Importación** | Decidido: **CSV (UTF-8)** con plantilla descargable y sin dependencias nuevas. Leer `.xlsx` queda fuera; si algún día se pide, será una mejora aparte que exige evaluar una librería. Los límites de filas y de tamaño son parámetros. |
| **Configuración** | Registro de parámetros (`parametros.js`) y de eventos (`eventos.js`) en código; valores en `parametros_sistema` (prefijo `proyectos.`) y en las tablas `proy_*`; `configService` con caché; historial en `proy_config_historial`; foto por proyecto en `config_snapshot`. Las pantallas A0 a A10 exigen `proyectos.administrar`. Detalle en `documentacion/configuracion_administrador.md`. |
| **Seguridad** | `express-rate-limit` en importación y exportación; límites de tamaño y de filas; validación de cada fila; permisos solo en el backend. |
| **Reintentos** | Activar y registrar gestión, cotización, venta o importación aceptan `idempotencyKey` (tabla `idempotency_keys` del core), como pide `CLAUDE.md`: con señal débil en el celular, reintentar no duplica. |
| **Listas largas** | «Base de clientes» y «Mi proyecto» cargan **de 50 en 50** con scroll infinito (el mismo tamaño y patrón que el Buzón de Vales). El informe tiene tope de filas y de rango. |
| **Documentación** | Al implementar: `README.md` y `documentacion/` del módulo, fila en el mapa de `CLAUDE.md` y en `README.md` sección 4. Los cambios de comportamiento actualizan la documentación (regla del proyecto). |

## 13. Mejoras propuestas y cómo crecer solo por adición

### 13.1 Mejoras que sugiero

| # | Mejora | Valor | Fase |
|---|---|---|---|
| 1 | **Plan del año** (nicho + mes + artículo), heredado del «Enero–Abril» de 2020. Sugiere el nicho al crear el proyecto. | Planificar con tiempo y comparar años. | 9 |
| 2 | **Activación automática** el primer día hábil del mes usando el plan, con el supervisor avisado y el reparto ya calculado. Responde al «automático o manual» de la idea. | Que el mes arranque aunque nadie se acuerde. | 9 |
| 3 | **Para hoy**: seguimientos con fecha y empresas sin tocar. | Evita que se enfríen los clientes. | 4 |
| 4 | **Kit del nicho**: guion de llamada y plantillas de mensaje (WhatsApp, correo) con variables `{empresa}` `{contacto}` `{asesor}`. El mensaje se abre prellenado en WhatsApp; el asesor lo envía. | Calidad pareja y menos tiempo escribiendo. | 9 |
| 5 | **Detección de duplicados** y normalización de teléfonos por país (+502, +503, +504, +505, +506). | Base limpia desde el inicio. | 2 |
| 6 | **Semáforo** por asesor y tienda frente a la etapa vigente. | Supervisar de un vistazo. | 5 |
| 7 | **Periodo de descanso** entre proyectos para no saturar a un cliente. | Mejor trato al cliente. | 3 |
| 8 | **Tope por asesor y rondas**: repartir por tandas conforme se avanza. | Evita listas imposibles de trabajar. | 9 |
| 9 | **Control de existencias** del artículo con alerta cuando quede poco. | Hoy el Excel lo anotaba a mano. | 4 |
| 10 | **Exportar a Excel/CSV** la base y los resultados. | Análisis fuera del portal. | 9 |
| 11 | **Comparación de nichos**: cuál rindió más (cotizado, vendido, efectividad) para decidir el próximo. | Elegir mejor cada mes. | 9 |
| 12 | **Metas** por asesor y tienda con avance visible. | Motivación y seguimiento. | 9 |
| 13 | **Cartera de clientes ganados** para posventa y recompra. | Vender más al mismo cliente. | 9 |
| 14 | **Ruta de visitas**: enlace a Google Maps por dirección. | Ahorra tiempo al visitar. | 9 |

### 13.2 Puntos de extensión (para que los cambios sean solo aditivos)

- **Catálogos como tablas**: nichos, canales, resultados, motivos, áreas y artículos crecen con filas, no con código.
- **Estados como texto**: un estado nuevo es un cambio de código, no de base de datos.
- **Historial de solo agregar**: nuevas métricas se calculan sobre datos que ya existen y no se pierde nada.
- **`resumen_cierre` y `detalle` en JSON**: se les pueden agregar campos sin migrar.
- **Alcance como lista de tiendas**: sirve igual para una tienda, un país o la región.
- **Permisos granulares**: una función nueva trae un permiso nuevo y no obliga a repartir de nuevo los existentes.
- **Referencias genéricas en notificaciones** (`referencia_tipo`, `referencia_id`): otros módulos podrán usarlas sin más cambios.
- **Registro de parámetros y de eventos**: un parámetro o un aviso nuevo es una línea en el registro; la pantalla del administrador se dibuja sola.
- **Plantillas, campos propios y resultados de gestión**: nuevas formas de trabajar sin migrar ni programar.
- **Foto de configuración por proyecto**: se pueden agregar ajustes nuevos sin alterar proyectos ya activos ni sus informes.
- **Reparto como servicio con una sola función**: cambiar la regla (por tienda, por ciudad, por tamaño) toca un archivo.

## 14. Trabajo con git y fases de entrega

### 14.1 Ramas

El módulo se desarrolla **aislado** y llega a `dev` solo cuando esté completo (como `module/generador-prompts`).

```text
dev
 └── module/proyectos                       ← rama del módulo (se crea desde dev al día; nadie la usa para otra cosa)
      ├── docs/proyectos-especificacion     ← esta etapa: documentos
      ├── design/proyectos-mockup           ← mockup y documentos de diseño
      ├── feature/proyectos-01-base-datos
      ├── feature/proyectos-02-catalogos-clientes
      ├── feature/proyectos-03-proyectos-reparto
      ├── feature/proyectos-04-gestion-asesor
      ├── feature/proyectos-05-seguimiento-supervisor
      ├── feature/proyectos-06-cierre-informe-gerencia
      ├── feature/proyectos-07-integracion-vales
      └── feature/proyectos-08-activacion       ← asigna los permisos a los roles
```

- Cada subrama sale de `module/proyectos` **actualizada** y vuelve a ella por pull request. Nunca se comitea directo en `dev`, `staging`, `main` ni en `module/proyectos`.
- Cada cierto tiempo se trae `dev` a `module/proyectos` para que no se aleje.
- **Invisible hasta el final**: el módulo se registra en `MODULOS` desde la primera subrama (lo exigen las notificaciones), pero nadie tiene el permiso `proyectos.ver` hasta `feature/proyectos-08-activacion`; sin ese permiso no aparece la tarjeta ni se puede entrar.
- Las migraciones de cada subrama son aditivas e idempotentes y usan el siguiente número libre al momento de crearlas (la fase 1 usa de la 33 a la 36). Una migración ya aplicada nunca se edita.
- Commits en español con Conventional Commits, sin atribución de IA. No se hacen commits ni push sin que lo pidas.

### 14.2 Fases

| Fase | Entrega | Cómo sabemos que terminó |
|---|---|---|
| **0. Especificación** | Este documento aprobado + documentos de detalle (sección 15). | Respondiste las preguntas y aprobaste el documento. |
| **0b. Mockup** | Archivo de Figma con todas las pantallas, estados y variantes por rol; escritorio 1366×768, 1920×1080 y celular. | Apruebas el mockup pantalla por pantalla. |
| **1. Base de datos y catálogos** | Migración con tablas, semillas y permisos (sin asignar) y registro del módulo en `MODULOS`. Catálogos administrables, registro de parámetros, historial de cambios y pantallas A0, A1, A3, A5 y A10. | La migración corre dos veces sin error, **los índices únicos funcionan en `staging`** y los catálogos se editan. |
| **2. Clientes** | Base global: registrar, buscar, duplicados, importación CSV, **campos propios (A6) y alcance de usuarios por país (A7)**. | Un asesor registra una empresa; una importación de prueba muestra duplicados y errores. |
| **3. Proyectos y reparto** | Crear desde **plantillas (A4)**, vista previa, activar (con la **aprobación opcional del gerente**), cancelar. Algoritmo y pruebas del reparto. | Con datos de prueba la diferencia entre asesores nunca pasa de una empresa. |
| **4. Gestión del asesor** | Mi proyecto, ficha, gestiones, muestras, cotizaciones, ventas (**por confirmar** si está encendido), Para hoy. | Un asesor recorre una empresa desde pendiente hasta vendida. |
| **5. Seguimiento del supervisor** | Avance por asesor y tienda, semáforo, estancados, reasignación, cola de **confirmación de ventas**, tiempo real. | Reasignar una empresa se ve al instante en el asesor. |
| **6. Cierre, informe y gerencia** | Cierre con conclusiones, visto bueno (opcional), PDF, panel del gerente y **matriz de notificaciones (A8)**. | El informe coincide con un conteo a mano de los mismos datos. |
| **7. Integración con Vales** | «Crear vale» prellenado y vínculo. | Un vale creado desde Proyectos queda ligado a su cliente. |
| **8. Activación** | Permisos asignados a roles y pruebas finales en `staging`. Lista de verificación: quien tenga sesión abierta debe volver a entrar (o esperar al refresco del token) para ver el módulo, salvo que la asignación se haga desde la pantalla de roles; probar con cada rol; confirmar el reparto con dos supervisores activando a la vez. | Aparece en el portal solo para los roles previstos. |
| **9. Mejoras** | Plan del año con activación automática (A2), kit del nicho (A9), metas, etc. (sección 13). | Una por una, cada una en su subrama. |

Cada fase se prueba en el navegador con los roles que corresponden (Asesor, Supervisor, Gerente, Administrador) y deja su documentación actualizada.

## 15. Estructura de carpetas

```text
src/modules/proyectos/
  controllers/        clienteController.js  proyectoController.js  participacionController.js
                      seguimientoController.js  catalogoController.js  informeController.js
                      configController.js  plantillaController.js  campoController.js
  services/           clienteService.js  importacionService.js  proyectoService.js
                      repartoService.js  participacionService.js  informeService.js  pdfInformeService.js
                      configService.js  plantillaService.js  campoService.js  notificacionConfigService.js
  repositories/       clienteRepository.js  proyectoRepository.js  participacionRepository.js
                      gestionRepository.js  catalogoRepository.js  informeRepository.js
  routes.js   events.js   constantes.js   errores.js   mensajes.js
  parametros.js   eventos.js                    registros de parámetros y de avisos (alimentan A3 y A8)

public/modules/proyectos/
  index.html   css/styles.css
  js/  app.js  state.js  api/  components/  layout/  views/  utils/

.agents/modulos/proyectos/
  Idea_Modulo_Proyectos.md                      (original, no se toca)
  Formato de Proyecto ... .xlsx                 (original, no se toca)
  propuesta_modulo.md                           (este documento)
  README.md                                     (al implementar)
  documentacion/
    flujo_de_trabajo.md          los 6 recorridos con pantallas y reglas
    esquema_y_contrato.md        SQL final y endpoints
    reparto_equitativo.md        algoritmo, casos límite y pruebas
    permisos_y_alcance.md        matriz de permisos y alcance por tienda
    informe_de_cierre.md         fórmulas, ejemplo numérico y PDF
    mockup_pantallas.md          lista de pantallas y estados, con enlaces a Figma
    configuracion_administrador.md   todo lo que configura el administrador y cómo
```

## 16. Seguridad y datos personales

- Los contactos de las empresas son datos personales de terceros: solo se muestran a quien tiene `proyectos.ver`, nunca en URLs ni en `console.log`, y la exportación exige `proyectos.ver_reportes` y queda en `proy_historial`.
- Un asesor **no puede consultar** participaciones ajenas aunque cambie el identificador en la petición: el repositorio siempre filtra por el asesor de la sesión.
- La importación valida tipo y tamaño del archivo, número de filas, longitud de cada campo y formato de teléfono y correo. Nada se ejecuta ni se interpreta como fórmula.
- Los textos libres (notas, conclusiones) se guardan como texto y se pintan escapados.
- Una empresa marcada «no contactar» no se puede reactivar sin dejar registro de quién y por qué.
- Las pantallas de configuración exigen `proyectos.administrar` en cada endpoint; todo cambio se valida contra el registro de parámetros y queda auditado con su valor anterior (sección 20).

## 17. Fuera de alcance de la primera versión

Envío automático de WhatsApp, SMS o correo desde el servidor; integración con telefonía o con un CRM externo; geolocalización en vivo; facturación; cartera de posventa; conversión de monedas; aplicación móvil nativa. Algunas están en las mejoras de la sección 13 como fases posteriores.

## 18. Preguntas y su resolución

Todas están resueltas: unas con tu respuesta y otras como **parámetro con valor por defecto**, para que el administrador pueda cambiarlas sin programar. Si alguna no te convence, se cambia el valor por defecto aquí y en `documentacion/configuracion_administrador.md`.

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿Los **supervisores** también reciben empresas en el reparto, o solo los asesores? | **Resuelta:** parámetro `reparto.reciben_supervisores`; por defecto solo asesores. |
| 2 | ¿Quién puede crear un **nicho nuevo**? | **Resuelta:** quien tenga `proyectos.administrar` (por defecto solo el Administrador; se amplía desde Roles). |
| 3 | ¿Datos mínimos para registrar una empresa? | **Resuelta:** parámetros `empresas.*`; por defecto nombre, nicho, país y teléfono o correo. |
| 4 | ¿La **moneda** de cotizaciones y ventas es la local de cada país, o todo en dólares? | **Respondida:** local por defecto; en cada registro se puede cambiar a US$. |
| 5 | ¿Una tienda puede tener **más de un proyecto activo** a la vez? | **Respondida:** no; un solo proyecto activo por tienda. |
| 6 | ¿Cuántos meses «descansa» un cliente ya contactado antes de volver a repartirse? | **Resuelta:** parámetro `reparto.descanso_meses`; por defecto 3; 0 lo apaga. |
| 7 | ¿Qué cuenta como **estancado**? | **Resuelta:** parámetro `seguimiento.dias_estancado`; por defecto 7 días naturales sin gestión. |
| 8 | ¿El **gerente** puede devolver el cierre con comentarios para que el supervisor lo corrija? | **Resuelta:** sí (pantalla G2); el supervisor corrige y reenvía. |
| 9 | **Importación**: ¿solo CSV o también `.xlsx`? | **Respondida:** CSV. |
| 10 | ¿Dónde está el documento del módulo de **Eventos** al que se refiere la idea? | **Respondida:** `acople_flujo_eventos.md`; evaluado en `decisiones_acople_eventos.md`. |
| 11 | ¿Qué otros **datos de la empresa** importan (número de empleados, si ya es cliente de Premia)? | **Resuelta:** campo propio sembrado «¿Ya es cliente de Premia?»; cualquier otro dato se agrega desde A6. |
| 12 | ¿Los proyectos pasados de **2020** se cargan como histórico o se empieza desde cero? | **Resuelta:** se empieza desde cero; el Excel sirvió para diseñar. |
| 13 | ¿Quién confirma una **venta**? En Eventos el asesor sin permiso de cierre solicita y el supervisor aprueba. | **Respondida:** el asesor la registra con la referencia obligatoria y el supervisor puede anularla. Sin aprobación previa. |
| 14 | ¿Cuántos **días de gracia** tras la `fecha_fin` antes de marcar un proyecto como vencido? | **Respondida:** 3 días hábiles. |
| 15 | ¿Todas las tiendas, incluida Centroamérica, cotizan y facturan en el mismo sistema, de modo que siempre hay número de cotización y de orden de venta? | **Resuelta:** referencia obligatoria por defecto; el administrador la desactiva país por país (pantalla A5). |
| 16 | ¿Desde qué porcentaje el semáforo es verde o ámbar? | **Respondida:** parámetros de cobertura y de efectividad: verde desde 75 % y ámbar desde 50 %; el administrador los ajusta en A3. |
| 17 | ¿Qué tanto puede cambiar el administrador el embudo? | **Respondida:** los 7 estados son fijos; los resultados de gestión son configurables y deciden a qué estado empuja cada uno. |
| 18 | ¿Puede agregar campos propios a la empresa por nicho? | **Respondida:** sí, desde la primera versión (fase 2). |
| 19 | ¿Cómo controla la creación de proyectos? | **Respondida:** plantillas de proyecto (A4) que también definen qué puede cambiar el supervisor. |
| 20 | ¿Qué aprobaciones puede encender o apagar? | **Respondida:** visto bueno al cerrar, aprobación antes de activar, confirmación de ventas y referencia obligatoria por país. |
| 21 | ¿De dónde sale el alcance por país de cada persona? | **Respondida:** el país de su tienda, ampliable o reducible por el administrador (A7). |
| 22 | ¿Qué pasa con proyectos activos si cambia la configuración? | **Respondida:** nada; cada proyecto conserva la foto de su configuración y los cambios aplican a los nuevos. |
| 23 | ¿Las notificaciones son configurables? | **Respondida:** sí, matriz de eventos por destinatario (A8). |
| 24 | ¿El asesor trabaja también desde laptop? | **Respondida:** sí; hay versión de escritorio de «Mi proyecto» y de la ficha. |

## 19. Siguientes pasos

1. Tú: revisar esta propuesta y `documentacion/configuracion_administrador.md`.
2. Yo: corregir el mockup y sumar el **Centro de configuración** (A0 a A10) y las variantes que dependen de la configuración, para tu aprobación **antes de programar**.
3. Yo: dejar al día `plan_implementacion.md`, `decisiones_acople_eventos.md` y el documento Word.
4. Con todo aprobado: abrir la subrama `feature/proyectos-01-base-datos` y empezar la fase 1.

## 20. Configuración por el administrador (resumen)

**Regla: se configura, no se programa.** El administrador maneja desde el módulo (grupo «Configuración», permiso `proyectos.administrar`) todo lo que el flujo permite ajustar sin poner en riesgo los datos. El detalle completo, con cada parámetro, rango, valor por defecto, pantalla, tabla y permiso, está en `documentacion/configuracion_administrador.md`.

| Nivel | Qué es | Ejemplos |
|---|---|---|
| 1. Catálogos | Filas editables | Nichos, artículos, áreas, canales, resultados de gestión, motivos de pérdida, estructuras, monedas, países |
| 2. Parámetros | Valor con rango y valor por defecto | Días de estancado, gracia de vencido, descanso, semáforo, tope, límites de importación, datos obligatorios de la empresa, código del proyecto, informe |
| 3. Plantillas | Conjuntos de valores para crear proyectos | Etapas (nombre, duración, qué se espera), artículo, tope, meta y qué puede cambiar el supervisor |
| 4. Reglas e interruptores | Pasos que se encienden o apagan | Visto bueno al cerrar, aprobación antes de activar, confirmación de ventas, referencia obligatoria por país |
| 5. Estructura de datos | Campos que se suman a la empresa | «Número de agencias» para bancos |

**Siguen fijos a propósito** (integridad): un proyecto activo por tienda y por empresa (índices únicos), los 7 estados de la empresa y sus reglas de dinero, anular en vez de borrar, la identidad de la sesión, los datos vacíos de «Otra tienda», el orden de bloqueo al activar y que el portal no envía mensajes por sí solo.

**Cómo se mantiene seguro.** Cada valor se valida contra un registro en código; cada proyecto guarda una **foto de su configuración** al activarse (los cambios solo aplican a proyectos nuevos); todo cambio queda en un **historial** con su valor anterior y se puede restaurar; con todos los interruptores en su valor por defecto el flujo es el descrito en las secciones 5 a 8.

**Quién puede hacer cada cosa** no se configura aquí: se asigna en la pantalla **Roles** de Administración Central, que ya lista los permisos nuevos.
