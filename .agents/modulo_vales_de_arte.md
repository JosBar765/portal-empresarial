# Prompt para Antigravity — Módulo Vales de Arte

## Objetivo

Implementa el módulo **Vales de Arte** dentro del Portal Web de Herramientas Empresariales.

Este documento es la especificación funcional y técnica que debes seguir para construir el módulo. Antes de modificar código, **inspecciona el repositorio existente**, especialmente:

- `README.md` de la raíz.
- `.agents/arquitectura_reglas.md`.
- `.agents/autenticacion_jwt.md`.
- La implementación actual de login, dashboard, autenticación, permisos, WebSocket/Socket.IO, configuración de base de datos y manejo de archivos.
- El esquema/migraciones/seeds actuales de la base de datos.

No reemplaces ni reinventes funcionalidades que ya existen.

---

## 1. Reglas arquitectónicas obligatorias

El proyecto debe conservar su arquitectura de **monolito modular**. El módulo debe vivir de forma independiente y seguir la estructura establecida por el proyecto.

La arquitectura esperada para backend es:

```text
src/
└── modules/
    └── vales/
        ├── controllers/
        ├── services/
        ├── repositories/
        ├── routes.js
        └── events.js
```

La parte frontend debe mantenerse dentro de:

```text
public/
└── modules/
    └── vales/
```

Si la implementación existente utiliza una estructura equivalente ya establecida, reutilízala en lugar de crear una estructura paralela.

No coloques lógica de negocio en `server.js` ni en `app.js`.

Los controllers deben ser delgados.

Los services deben contener las reglas de negocio.

Los repositories deben contener las consultas SQL y acceso a persistencia.

Las rutas deben encargarse únicamente de declarar endpoints y aplicar autenticación/autorización.

No mezcles lógica de Vales de Arte con otros módulos.

No crees una aplicación Node.js independiente para Vales.

No introduzcas Docker, microservicios, frameworks frontend pesados ni infraestructura que requiera VPS.

Mantén compatibilidad con el hosting Node.js administrado existente.

---

## 2. Autenticación y autorización

Debes utilizar exclusivamente el sistema JWT/RBAC ya existente.

El JWT es la fuente de verdad para identificar al usuario autenticado. Nunca confíes en un `userId`, nombre, correo o rol enviado por el frontend para determinar quién ejecuta una operación.

Utiliza los middlewares existentes, especialmente:

- `authenticateJWT`
- `requireAuth`
- `requirePermission`
- `requireModule`

No crees un segundo sistema de autenticación.

Las autorizaciones deben estar basadas en permisos, no únicamente en nombres de roles.

Los permisos sugeridos para el módulo son:

```text
vales.ver
vales.crear
vales.editar
vales.asignar
vales.reasignar
vales.propuesta.ver
vales.propuesta.subir
vales.aprobar
vales.desaprobar
vales.cancelar
vales.modificacion
vales.catalogos.ver
```

Antes de crear permisos nuevos, revisa los existentes y reutilízalos si ya existen.

Todo permiso debe validarse en backend. Deshabilitar u ocultar botones en frontend nunca debe considerarse una medida de seguridad.

---

# 3. Objetivo funcional del módulo

El módulo administra el flujo completo de un **Vale de Arte** desde que un asesor de ventas lo crea hasta que un encargado de diseño aprueba o desaprueba la propuesta y el resultado regresa al asesor.

El flujo principal es:

```text
INGRESADO
   ↓
EN ESPERA
   ↓
ASIGNADO
   ↓
EN PROCESO
   ↓
EN REVISIÓN
   ↓
APROBADO
```

Si una propuesta es desaprobada:

```text
EN REVISIÓN
   ↓
DESAPROBADO
   ↓
EN ESPERA
```

El estado de **atrasado NO es un estado**. Es una condición calculada a partir de la fecha de entrega y el flujo actual.

No implementes `ATRASADO` como estado persistente.

---

# 4. Actores

El módulo debe contemplar estos actores:

1. Asesor de ventas.
2. Encargado de diseño.
3. Encargado de diseño UV/3D.
4. Técnico de diseño.
5. Técnico de diseño UV/3D.

Los encargados de diseño comparten un buzón.

Cada técnico posee su propio buzón.

Cada usuario únicamente debe acceder a la información que sus permisos y contexto permitan.

---

# 5. Base de datos — MOCK obligatorio

Construye un **mock funcional de base de datos** para que el módulo pueda probarse completamente sin depender inicialmente de datos reales.

IMPORTANTE:

La arquitectura general del proyecto especifica **MySQL** como base de datos principal. Por lo tanto, el mock debe ser compatible con MySQL y con la capa de repositories existente.

El análisis funcional menciona almacenamiento de documentos y PDFs en Supabase. No cambies por tu cuenta la arquitectura de persistencia existente. Primero inspecciona el proyecto. La solución debe abstraer el almacenamiento de archivos para que posteriormente pueda utilizarse Supabase Storage u otro proveedor sin modificar la lógica de negocio.

No almacenes imágenes/PDF como BLOB si la arquitectura existente no lo requiere. La base de datos debe almacenar metadatos y referencias/rutas.

## 5.1 Entidades mínimas

Implementa únicamente las entidades necesarias para que el módulo funcione.

Como mínimo deben existir conceptualmente:

### Usuarios

Si ya existe una tabla de usuarios, **reutilízala**.

Debe poder obtenerse:

```text
id
nombre
email
telefono
rol
permisos
localidad
activo
```

No dupliques usuarios dentro del módulo.

### Vales de arte

Debe contener como mínimo:

```text
id
correlativo
asesor_id
cliente_id
fecha_creacion
hora_creacion
fecha_entrega
fecha_evento
urgente
codigo_producto
material_id
tecnica_id
acabado_id
cantidad
cotizacion
descripcion
estado
created_at
updated_at
```

La fecha y hora de creación deben ser generadas por backend.

### Clientes

Debe contener:

```text
id
empresa
telefono
correo
nombre
created_at
updated_at
```

Un vale pertenece a un cliente.

### Materiales

Catálogo para los combobox.

```text
id
nombre
activo
```

### Técnicas

Catálogo para los combobox.

```text
id
nombre
activo
```

### Acabados

Catálogo para los combobox.

```text
id
nombre
activo
```

### Asignaciones

Registra qué técnico tiene un vale asignado.

```text
id
vale_id
tecnico_id
encargado_id
fecha_asignacion
fecha_inicio
fecha_finalizacion
activo
created_at
updated_at
```

Debe permitir conservar historial de reasignaciones.

### Propuestas

Registra las propuestas producidas por los técnicos.

```text
id
vale_id
tecnico_id
archivo_id
fecha_subida
observaciones
estado
created_at
updated_at
```

### Archivos

Metadatos de archivos.

```text
id
vale_id
tipo_entidad
nombre_original
nombre_documento
ruta
tipo_mime
extension
tamano
usuario_id
created_at
```

`tipo_entidad` puede diferenciar, por ejemplo:

```text
VALE_PDF
IMAGEN_VALE
DOCUMENTO_VALE
PROPUESTA
```

### Historial del vale

Es necesario conservar trazabilidad de cambios.

```text
id
vale_id
usuario_id
estado_anterior
estado_nuevo
accion
comentario
created_at
```

No dependas únicamente de la tabla principal para reconstruir el historial.

### Catálogos de localidad

El correlativo utiliza la localidad, por lo que debe poder obtenerse desde el usuario o desde una entidad relacionada.

No dupliques la localidad en el vale si puede derivarse correctamente del usuario, salvo que el modelo existente requiera conservar una fotografía histórica.

### Configuración de límites diarios

El asesor tiene un límite diario arbitrario obtenido desde base de datos.

Crea una estructura de configuración que permita determinar:

```text
asesor_id
limite_diario
activo
```

Si el proyecto ya tiene una tabla/configuración equivalente, reutilízala.

---

# 6. Seed/mock data

Crea seeds suficientes para probar todos los flujos.

Como mínimo incluye:

## Usuarios

Usuarios mock representando:

```text
1 asesor de ventas
1 encargado de diseño
1 encargado de diseño UV/3D
2 técnicos de diseño
2 técnicos UV/3D
1 administrador
```

Los usuarios deben integrarse con el sistema de autenticación existente. No inventes un mecanismo paralelo de login.

## Catálogos

Incluye varios:

```text
materiales
técnicas
acabados
```

Ejemplo de datos suficientes:

```text
Material:
- Lona
- Vinil
- Acrílico
- MDF
- PVC

Técnica:
- Impresión
- Corte
- Grabado
- UV
- 3D

Acabado:
- Mate
- Brillante
- Laminado
- Barniz
- Natural
```

Estos valores son únicamente datos de prueba; si el repositorio ya posee catálogos reales, utiliza los existentes.

## Vales mock

Crea vales en diferentes situaciones para poder comprobar visualmente el buzón:

```text
- ingresado
- en espera
- en espera urgente
- en espera atrasado
- asignado
- asignado atrasado
- en proceso
- en proceso atrasado
- en revisión
- en revisión atrasado
- aprobado
- desaprobado
```

También incluye:

- Vales de distintos asesores.
- Vales con propuestas.
- Vales sin propuestas.
- Vales con imágenes.
- Vales con documentos.
- Vales con diferentes fechas.

El objetivo es que el frontend pueda probar todos los estados sin tener que crear manualmente decenas de registros.

---

# 7. Correlativo

El correlativo debe seguir:

```text
LOCALIDAD-ASESOR-CONTEO_INDIVIDUAL_ASESOR
```

Ejemplo conceptual:

```text
GUA-JBAR-0001
```

No copies literalmente este ejemplo si la aplicación ya tiene una convención de localidad/asesor.

El contador debe ser individual por asesor.

El correlativo debe generarse en backend.

No permitas que el frontend envíe el correlativo final.

La generación debe ser segura ante solicitudes simultáneas para evitar duplicados.

El correlativo no debe modificarse durante el flujo normal.

Cuando un vale sea aprobado, el frontend debe mostrar un símbolo de aprobación antes del correlativo.

Cuando sea cancelado/desaprobado definitivamente, debe mostrarse un símbolo de cancelación antes del correlativo.

No destruyas el valor original del correlativo en la base de datos.

---

# 8. Creación del Vale — Asesor de Ventas

Crear una vista para registrar un vale.

El formulario debe estar dividido visualmente en:

## Información del asesor

Campos:

```text
Nombre
Correo
Teléfono
```

Estos valores se obtienen exclusivamente del usuario autenticado.

No deben ser editables.

No deben recibirse como fuente de identidad desde el frontend.

## Información del cliente

Campos:

```text
Empresa
Teléfono
Correo
Nombre del cliente
```

Estos datos sí los introduce el asesor.

## Información de venta

Campos:

```text
Fecha de creación
Hora de creación
Fecha de entrega
Fecha del evento
Urgente
Código de producto
Material
Técnica
Acabado
Cantidad
Cotización
```

Reglas:

- Fecha de creación: automática.
- Hora de creación: automática.
- Fecha de entrega: editable.
- Fecha de evento: editable.
- Urgente: checkbox.
- Material: combobox desde BD.
- Técnica: combobox desde BD.
- Acabado: combobox desde BD.
- Cantidad: debe ser mayor que 1.
- Cotización: numérica.
- No comprobar por ahora que la cotización exista realmente.
- Debe cumplirse:

```text
fecha_evento > fecha_entrega >= fecha_creacion
```

El backend debe validar esta regla.

## Boceto y descripción

Campos:

```text
Descripción
Imágenes
Documentos
```

Descripción:

```text
textarea
```

Imágenes:

Permitir formatos de imagen habituales, por ejemplo:

```text
webp
jpg
jpeg
png
```

Documentos:

```text
PDF
máximo 5 MB
```

Cada documento debe tener un nombre arbitrario de máximo 50 caracteres.

El backend debe validar MIME type, extensión y tamaño.

No confíes únicamente en las validaciones HTML.

---

# 9. Límite diario del asesor

Antes de crear un vale, el sistema debe consultar el límite diario del asesor.

Debe mostrar:

```text
Vales restantes
```

El límite debe provenir de base de datos/configuración.

No hardcodees el límite en JavaScript.

El backend debe impedir crear un vale cuando el límite diario haya sido alcanzado.

El frontend solamente representa la información.

Considera correctamente la zona horaria configurada por la aplicación.

---

# 10. Generación del PDF

Después de crear el vale, genera su PDF.

El PDF debe:

```text
Tamaño carta
Márgenes de 1 cm
```

Debe tener dos grandes secciones.

## Primera sección — aproximadamente 2/5 de página

Debe contener:

- Encabezado.
- Texto "Vale de Arte".
- Correlativo.
- Logo.
- Información del asesor.
- Información del cliente.
- Información de venta.

El encabezado debe estar en una fila.

Conceptualmente:

```text
┌──────────┬────────────────────┬────────────────────┐
│   LOGO   │    VALE DE ARTE    │    CORRELATIVO     │
│   1/5    │        2/5         │        2/5         │
└──────────┴────────────────────┴────────────────────┘
```

## Segunda sección — aproximadamente 3/5

Debe contener:

- Descripción.
- Imágenes.

Las imágenes deben organizarse máximo:

```text
3 imágenes por fila
```

Si hay demasiadas imágenes o la descripción requiere más espacio:

- crear páginas adicionales;
- mantener el mismo formato;
- mostrar numeración:

```text
actual/total
```

El PDF generado debe quedar asociado al vale.

El almacenamiento físico debe estar abstraído.

La especificación funcional indica Supabase para almacenamiento de objetos. Si el proyecto ya cuenta con integración de Supabase, úsala a través de la capa de almacenamiento existente. Si todavía no existe, implementa una abstracción/mock y deja preparada la integración sin acoplarla al service del vale.

---

# 11. Buzón del asesor

El asesor únicamente debe visualizar sus propios vales.

Crear un mini dashboard horizontal con:

```text
Vales restantes
Vales por revisar
Vales aprobados
Vales desaprobados
Vales pendientes de modificación
Vales atrasados
```

Reglas:

### Vales restantes

Cantidad disponible para crear durante el día.

### Vales por revisar

Propuestas recibidas que el asesor todavía no ha revisado.

Disminuye cuando las revisa.

### Vales aprobados

Aprobaciones realizadas durante el día.

Se reinicia conceptualmente al cambiar de día.

### Vales desaprobados

Desaprobaciones/cancelaciones durante el día.

Se reinicia conceptualmente al cambiar de día.

### Pendientes de modificación

Contador acumulado.

Cuando llega una nueva propuesta relacionada con una modificación:

```text
pendientes de modificación --
vales por revisar ++
```

### Vales atrasados

Aumentan cuando un vale supera su fecha de entrega sin haber cerrado el caso.

Disminuyen cuando el caso termina como aprobado o desaprobado.

Si se solicita modificación, el vale conserva su condición de atrasado.

---

# 12. Ventana temporal

El buzón y sus métricas deben permitir:

```text
Día
Semana
Mes
```

El usuario puede seleccionar una fecha de referencia.

Se permiten fechas pasadas.

No se permiten fechas futuras.

El período seleccionado debe afectar también las métricas del dashboard.

No implementes métricas independientes del filtro temporal.

---

# 13. Orden del buzón del asesor

El orden debe ser:

1. Propuestas pendientes de aprobación/desaprobación.
2. Vales atrasados.
3. Vales urgentes.
4. Vales próximos a vencer.
5. Desaprobados.
6. Aprobados.

El sistema debe mostrar días de atraso cuando corresponda.

Columnas:

```text
Correlativo
Fecha ingreso
Fecha egreso
Atraso
Fecha evento
Estado
Acciones
```

---

# 14. Acciones del asesor

Utiliza botones principalmente con iconos para optimizar espacio.

Debe poder:

### Ver vale

Abre el PDF generado en otra ventana.

### Ver documentos

Abre un desplegable con documentos.

Cada documento debe abrirse en otra ventana.

### Ver propuesta

Antes de existir propuesta:

- botón visible;
- botón deshabilitado;
- backend también debe rechazar la operación.

Cuando llega una propuesta:

- habilitar botón;
- reproducir sonido;
- mostrar toast.

### Aprobar

No implementes el proceso comercial real.

Al pulsar:

- mostrar confirmación;
- marcar el vale como aprobado;
- mostrar notificación;
- mostrar símbolo de aprobación junto al correlativo.

### Desaprobar

Mostrar opciones según el alcance actual:

```text
Solicitar modificación
Cancelar vale
```

Por ahora, solicitar modificación únicamente debe mostrar la notificación y preparar/cambiar la condición correspondiente sin implementar un flujo complejo.

Cancelar:

- no elimina el registro;
- cierra el caso;
- muestra notificación;
- muestra símbolo de cancelación junto al correlativo.

---

# 15. Buzón compartido de encargados

El encargado de diseño y el encargado UV/3D comparten el buzón de vales.

Sin embargo, sus métricas deben ser independientes.

El buzón debe mostrar:

1. Pendientes de revisión.
2. Pendientes de asignación atrasados y urgentes.
3. Pendientes de asignación sin atraso y urgentes.
4. Pendientes de asignación atrasados.
5. Pendientes de asignación sin atraso.
6. Aprobados.

Los vales asignados y en proceso no aparecen en este buzón.

Deben existir en una vista/modal separada llamada:

```text
Carga de trabajo
```

Columnas del buzón:

```text
Correlativo
Fecha ingreso
Fecha egreso
Atraso
Fecha evento
Estado
Acciones
```

Estados visibles principales:

```text
En revisión
Sin asignar
Aprobado
```

---

# 16. Dashboard del encargado

Las métricas son individuales por encargado.

No mezclar las métricas del encargado de diseño con las del encargado UV/3D.

Debe existir:

```text
Pendientes de asignación
Pendientes de asignación atrasados

En asignación atrasados
En asignación sin atraso

En proceso atrasados
En proceso sin atraso

En revisión atrasados
En revisión sin atraso

Aprobados sin atraso
Aprobados con atraso
```

Las métricas deben calcularse a partir de los datos reales del período seleccionado.

No mantengas contadores duplicados que puedan quedar inconsistentes si pueden calcularse de forma segura a partir del estado, asignación, fechas y eventos.

Si se requieren consultas agregadas para rendimiento, encapsúlalas en repository/service.

---

# 17. Acciones del encargado

## Asignar vale

Mostrar técnicos que estén a cargo del encargado.

El encargado puede seleccionar un técnico.

Registrar la asignación.

## Reasignar vale

Solo permitido cuando:

```text
vale asignado
AND
técnico todavía NO inició el trabajo
```

Si ya está en proceso, no se permite reasignar.

Validar esta regla también en backend.

## Ver vale

Abrir PDF.

## Ver propuesta

Antes de que exista propuesta:

- visible;
- deshabilitado.

Después de que exista:

- habilitado.

Al abrir debe permitir:

```text
Ver propuesta
Aprobar
Desaprobar
```

## Aprobar

Cambiar a:

```text
APROBADO
```

El vale regresa al flujo del asesor.

## Desaprobar

El vale debe regresar al flujo:

```text
EN ESPERA
```

Debe abrir el mismo mecanismo/modal de reasignación.

La desaprobación no elimina el vale.

---

# 18. Carga de trabajo

Crear botón:

```text
Carga de trabajo
```

Debe abrir un modal.

Dentro:

```text
Carga de trabajo

[Técnico A] █████████
Asignaciones: 5
En proceso: Vale GUA-...

[Técnico B] █████
Asignaciones: 3
En proceso: Vale GUA-...

[Técnico C] ███████
Asignaciones: 4
En proceso: Ninguno
```

La gráfica debe:

- ser horizontal;
- mostrar técnicos del encargado;
- representar cantidad de asignaciones;
- ser responsiva;
- mostrar una lista vertical de barras;
- debajo de cada técnico mostrar la tarea actualmente en proceso.

Debe tener botón para cerrar.

---

# 19. Buzón del técnico

Cada técnico posee un buzón individual.

Solo puede ver los vales asignados a él.

Dashboard:

```text
Vales asignados atrasados
Vales asignados sin atraso
```

El buzón:

1. Atrasados.
2. Sin atraso.
3. Al final, vales realizados.

Aplicar ventana:

```text
día
semana
mes
```

No permitir fechas futuras.

Columnas:

```text
Correlativo
Fecha ingreso
Fecha egreso
Atraso
Fecha evento
Estado
Acciones
```

---

# 20. Acciones del técnico

## Ver vale

Abrir PDF para conocer requerimientos.

## Marcar en proceso

El técnico puede iniciar un vale.

REGLA CRÍTICA:

Un técnico no puede tener más de un vale simultáneamente en estado:

```text
EN PROCESO
```

Si ya tiene uno en proceso, no puede comenzar otro hasta enviar una propuesta.

Esta regla debe validarse en backend.

## Cancelar proceso sin propuesta

Si el técnico decide no continuar:

- puede finalizar el proceso sin adjuntar propuesta;
- mostrar confirmación;
- permitir enviar propuesta vacía.

No elimines el vale.

Debe volver al flujo apropiado según las reglas de negocio.

## Subir propuesta

El técnico adjunta el trabajo realizado.

Al enviar:

```text
EN PROCESO → EN REVISIÓN
```

La propuesta debe quedar asociada al vale y al técnico.

Debe emitir evento para actualizar el buzón del encargado.

---

# 21. WebSocket / tiempo real

Toda actualización de buzones debe utilizar el sistema WebSocket/Socket.IO existente.

No implementar polling como solución principal.

Flujo esperado:

```text
Usuario ejecuta acción
        ↓
Controller
        ↓
Service
        ↓
Repository
        ↓
Base de datos
        ↓
Evento de dominio/módulo
        ↓
Socket.IO
        ↓
Usuarios correspondientes
        ↓
Actualización automática
```

Eventos conceptuales que deben contemplarse:

```text
vale.creado
vale.asignado
vale.reasignado
vale.en_proceso
vale.propuesta_subida
vale.aprobado
vale.desaprobado
vale.cancelado
vale.modificacion_solicitada
```

No dupliques el sistema global de WebSocket.

Utiliza la capa existente.

Cuando un evento corresponda al usuario conectado:

- actualizar el buzón;
- actualizar métricas;
- mostrar toast;
- reproducir sonido.

No exigir al usuario presionar F5.

---

# 22. Notificaciones

Toda notificación relacionada con llegada de trabajo/propuesta debe:

```text
mostrar toast
+
reproducir sonido
```

Casos importantes:

- nuevo vale para encargados;
- vale asignado cuando corresponda;
- propuesta enviada por técnico;
- respuesta de encargado para asesor;
- aprobación/desaprobación;
- modificaciones.

Reutiliza el sistema de notificaciones existente si existe.

No crear otro sistema global de notificaciones.

---

# 23. Cálculo de atraso

El atraso es una condición derivada.

Conceptualmente:

```text
si fecha_actual > fecha_entrega
y el caso todavía no está cerrado:
    atrasado = true
```

Los días de atraso deben calcularse correctamente.

No conviertas atraso en un estado.

Los filtros, ordenamientos y métricas deben poder consultar esta condición.

Presta especial atención a:

- asignado y atrasado;
- en proceso y atrasado;
- en revisión y atrasado;
- aprobado con atraso;
- desaprobado/cancelado con atraso.

---

# 24. API sugerida

Adapta los endpoints a las convenciones existentes del proyecto.

Como referencia:

```text
GET    /api/vales
GET    /api/vales/:id
POST   /api/vales

GET    /api/vales/dashboard
GET    /api/vales/catalogos
GET    /api/vales/:id/documentos
GET    /api/vales/:id/propuesta

POST   /api/vales/:id/asignar
POST   /api/vales/:id/reasignar
POST   /api/vales/:id/en-proceso
POST   /api/vales/:id/propuesta
POST   /api/vales/:id/aprobar
POST   /api/vales/:id/desaprobar
POST   /api/vales/:id/modificacion
POST   /api/vales/:id/cancelar

GET    /api/vales/tecnicos
GET    /api/vales/carga-trabajo
```

No es obligatorio utilizar exactamente estos endpoints si el proyecto tiene una convención distinta.

---

# 25. Mock de almacenamiento

Como el módulo necesita PDF, imágenes, documentos y propuestas, crea una abstracción de almacenamiento.

Conceptualmente:

```text
src/core/files/
```

o reutiliza la existente.

Debe permitir operaciones equivalentes a:

```text
upload()
getUrl()
delete()
```

El repository de archivos debe almacenar únicamente metadatos/referencias.

El service del módulo no debe estar acoplado directamente a Supabase SDK, filesystem o cualquier proveedor específico.

Esto permitirá cambiar el proveedor posteriormente.

---

# 26. Frontend

Mantén exactamente el lenguaje visual existente.

Antes de construir la interfaz:

1. Inspecciona login.
2. Inspecciona dashboard.
3. Identifica:
   - tipografías;
   - colores;
   - variables CSS;
   - botones;
   - tarjetas;
   - tablas;
   - modales;
   - iconos;
   - espaciados;
   - clases reutilizables.
4. Reutiliza componentes/clases existentes.

No inventes una nueva identidad visual.

La interfaz debe sentirse como una extensión natural del dashboard.

Debe ser responsive.

No agregues un framework CSS si ya existe un sistema de estilos funcional.

---

# 27. Vistas mínimas

Implementa como mínimo:

```text
1. Vista de creación de vale.
2. Vista/buzón del asesor.
3. Vista/buzón compartido de encargados.
4. Vista de carga de trabajo.
5. Vista/buzón del técnico.
6. Vista/modal de detalle del vale.
7. Vista/modal de documentos.
8. Vista/modal de propuesta.
9. Modales de confirmación de acciones.
```

Las vistas deben adaptarse dinámicamente según permisos.

No hagas que un usuario pueda acceder manualmente por URL a una vista que no le corresponde.

---

# 28. Manejo de errores

Todas las operaciones críticas deben tener manejo de errores.

Ejemplos:

```text
Límite diario alcanzado.
Vale inexistente.
Usuario sin permiso.
Vale ya asignado.
Vale ya iniciado.
Técnico ocupado.
Propuesta inexistente.
Archivo inválido.
PDF no generado.
Fecha inválida.
Transición de estado inválida.
```

Las reglas deben validarse en backend.

Los errores deben devolver respuestas consistentes con la API existente.

---

# 29. Transiciones de estado

Implementa una lógica centralizada para validar transiciones.

No permitas que cualquier endpoint pueda cambiar arbitrariamente un estado.

Como referencia:

```text
INGRESADO → EN ESPERA
EN ESPERA → ASIGNADO
ASIGNADO → EN PROCESO
EN PROCESO → EN REVISIÓN
EN REVISIÓN → APROBADO
EN REVISIÓN → EN ESPERA
```

No permitas saltos arbitrarios como:

```text
INGRESADO → APROBADO
ASIGNADO → APROBADO
APROBADO → EN PROCESO
```

salvo que una regla explícita del negocio posteriormente lo permita.

---

# 30. Consistencia y concurrencia

Las operaciones sensibles deben evitar duplicados o estados inconsistentes.

Especialmente:

- generación de correlativos;
- límite diario;
- asignación;
- reasignación;
- inicio de proceso;
- subida de propuesta;
- aprobación;
- desaprobación.

Si la operación requiere varias escrituras relacionadas, utiliza transacciones cuando corresponda.

El mock debe respetar estas reglas aunque inicialmente se utilice para desarrollo.

---

# 31. Qué NO hacer

No:

- crear login nuevo;
- crear JWT nuevo;
- crear WebSocket nuevo;
- poner SQL en controllers;
- poner lógica de negocio en routes;
- poner lógica de negocio en frontend como única validación;
- guardar secretos en código;
- guardar `.env` en Git;
- crear base de datos separada;
- crear microservicios;
- introducir Docker;
- almacenar archivos pesados directamente como BLOB sin justificación;
- permitir que el frontend decida el usuario autenticado;
- confiar en el estado enviado por el frontend;
- crear un estado `ATRASADO`;
- permitir dos trabajos simultáneos al mismo técnico;
- permitir reasignación después de iniciado el trabajo;
- eliminar físicamente un vale al cancelarlo;
- exigir refresh manual para actualizar buzones.

---

# 32. Implementación progresiva

No intentes resolver todo en un único archivo.

Implementa en este orden:

## Fase 1 — inspección

Revisa:

```text
README.md
.agents/arquitectura_reglas.md
.agents/autenticacion_jwt.md
src/
public/
database/
```

Identifica qué componentes ya existen y cuáles pueden reutilizarse.

## Fase 2 — persistencia

Crear:

```text
migrations
seeds
repositories
```

con el mock necesario.

## Fase 3 — dominio

Crear services para:

```text
creación
validaciones
límite diario
correlativo
transiciones
asignación
reasignación
proceso
propuesta
aprobación
desaprobación
métricas
atrasos
```

## Fase 4 — API

Crear controllers/routes.

## Fase 5 — WebSocket

Integrar eventos con el sistema existente.

## Fase 6 — frontend

Crear las vistas y conectarlas con la API.

## Fase 7 — archivos/PDF

Implementar generación y abstracción de almacenamiento.

## Fase 8 — seeds de prueba

Poblar escenarios suficientes para probar todos los buzones.

## Fase 9 — validación

Probar:

- permisos;
- aislamiento por usuario;
- estados;
- atrasos;
- filtros;
- métricas;
- asignaciones;
- propuestas;
- notificaciones;
- WebSocket;
- PDF;
- archivos;
- errores.

---

# 33. Criterios de aceptación

El módulo se considera funcional cuando:

- Un asesor puede crear un vale.
- El sistema obtiene automáticamente sus datos.
- Se genera un correlativo único.
- Se respeta el límite diario.
- Se validan fechas.
- Se cargan catálogos desde BD.
- Se pueden adjuntar imágenes/documentos válidos.
- Se genera el PDF.
- El vale aparece en el buzón correspondiente.
- Los encargados reciben el vale en tiempo real.
- Pueden asignarlo.
- Un técnico puede comenzar el trabajo.
- Un técnico no puede tener dos trabajos en proceso.
- Puede subir una propuesta.
- El encargado recibe la propuesta en tiempo real.
- Puede aprobarla.
- Puede desaprobarla y devolver el vale al flujo de asignación.
- El asesor recibe la respuesta en tiempo real.
- Las métricas se actualizan.
- El atraso se calcula correctamente.
- Los filtros día/semana/mes afectan buzón y dashboard.
- Los permisos se validan en backend.
- Los usuarios no pueden consultar vales ajenos sin autorización.
- No se rompe la autenticación existente.
- No se rompe el dashboard existente.
- No se crea una arquitectura paralela.

---

# 34. Entregables esperados

Al finalizar, deja implementado y documentado:

```text
src/modules/vales/
public/modules/vales/
database/migrations/
database/seeds/
```

y cualquier modificación mínima necesaria en:

```text
src/app.js
src/server.js
src/core/
database/
```

No modifiques archivos existentes innecesariamente.

Incluye:

- schema/migration;
- seeds/mock;
- repositories;
- services;
- controllers;
- routes;
- eventos;
- frontend;
- integración JWT/RBAC;
- integración Socket.IO;
- generación de PDF;
- abstracción de almacenamiento;
- documentación básica del módulo.

Si detectas una discrepancia entre esta especificación y la implementación existente, **prioriza la arquitectura real del proyecto y documenta la discrepancia antes de realizar cambios estructurales**.

---

# 35. Regla final para Antigravity

No asumas que debes construir todo desde cero.

Primero entiende el proyecto existente.

Reutiliza.

Mantén la arquitectura.

Mantén el estilo visual.

Mantén la autenticación.

Mantén el sistema de permisos.

Mantén el WebSocket existente.

Mantén la capa de persistencia desacoplada.

El objetivo es agregar **Vales de Arte como un módulo nuevo**, no reconstruir el Portal Web de Herramientas Empresariales.

Antes de comenzar a modificar archivos, presenta brevemente:

1. Qué archivos existentes vas a reutilizar.
2. Qué archivos nuevos crearás.
3. Qué tablas/migraciones/seeds agregarás.
4. Qué permisos agregarás.
5. Qué endpoints crearás.
6. Cómo integrarás Socket.IO.
7. Cómo resolverás el almacenamiento de archivos/PDF.

Después de esa revisión, implementa el módulo de forma incremental.
