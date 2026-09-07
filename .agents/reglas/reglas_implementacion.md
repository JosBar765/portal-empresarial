# REGLAS DE IMPLEMENTACIÓN — MediSistema

Este documento establece los principios y criterios que deben seguirse durante la implementación de MediSistema, tanto en el Backend como en el Frontend.

El objetivo principal es desarrollar código **mantenible, simple, reutilizable, cohesivo y con bajo acoplamiento**, evitando complejidad innecesaria.

---

# 1. PRINCIPIOS GENERALES

Toda implementación debe priorizar los siguientes principios:

1. **SOLID**
2. **DRY — Don't Repeat Yourself**
3. **KISS — Keep It Simple, Stupid**
4. **Alta cohesión**
5. **Bajo acoplamiento**
6. **Separación de responsabilidades**
7. **Legibilidad y mantenibilidad**

Estos principios deben aplicarse de manera práctica y no deben utilizarse como justificación para sobrearquitecturar el sistema.

La solución más compleja no es necesariamente la mejor solución.

---

# 2. PRINCIPIO SOLID

Todo código nuevo debe diseñarse siguiendo los principios SOLID.

## 2.1 Single Responsibility Principle — SRP

Cada clase, componente, servicio o módulo debe tener una responsabilidad clara.

Una clase no debe encargarse simultáneamente de múltiples responsabilidades no relacionadas.

### Incorrecto

```text
PacienteService
├── Gestionar pacientes
├── Generar PDF
├── Enviar correos
├── Validar JWT
└── Registrar auditoría
````

### Preferido

```text
PacienteService
        │
        └── Gestión de pacientes

PdfService
        │
        └── Generación de PDF

EmailService
        │
        └── Envío de correos

AuthService
        │
        └── Autenticación
```

Cada responsabilidad debe permanecer en el componente que corresponda.

---

# 3. Open/Closed Principle — OCP

Las funcionalidades deben diseñarse de manera que puedan extenderse sin modificar innecesariamente código estable.

Evitar estructuras donde agregar una nueva variante requiera modificar grandes bloques de código existentes.

Sin embargo, no crear abstracciones anticipadamente.

Las abstracciones deben introducirse cuando exista una necesidad real.

---

# 4. Liskov Substitution Principle — LSP

Cuando se utilicen herencias o implementaciones de interfaces, las implementaciones concretas deben poder utilizarse donde se espera el tipo abstracto sin alterar el comportamiento esperado.

No utilizar herencia únicamente para reutilizar código.

Preferir composición cuando resulte más sencilla y apropiada.

---

# 5. Interface Segregation Principle — ISP

Las interfaces deben ser pequeñas y específicas.

Evitar interfaces gigantes que obliguen a una clase a implementar métodos que no necesita.

### Evitar

```java
interface SistemaService {
    registrarUsuario();
    registrarPaciente();
    registrarMedico();
    crearCita();
    registrarConsulta();
    subirDocumento();
}
```

### Preferir

```java
interface UsuarioService {
    ...
}

interface PacienteService {
    ...
}

interface CitaService {
    ...
}
```

Cada interfaz debe representar una responsabilidad coherente.

---

# 6. Dependency Inversion Principle — DIP

Las clases de alto nivel no deben depender directamente de implementaciones concretas cuando exista una abstracción apropiada.

En Spring Boot se debe aprovechar la inyección de dependencias.

Preferir:

```text
Controller
    ↓
Service
    ↓
Repository
```

mediante dependencias administradas por Spring.

Evitar crear manualmente dependencias mediante:

```java
new PacienteService();
new PacienteRepository();
```

cuando dichas dependencias deban ser administradas por Spring.

---

# 7. DRY — DON'T REPEAT YOURSELF

No duplicar lógica que representa el mismo comportamiento.

Si una misma función, validación, transformación o lógica de negocio aparece repetida, debe evaluarse la posibilidad de extraerla a una abstracción reutilizable.

## Regla específica de MediSistema

Si una función, método, validación o lógica de servicio se repite **4 o más veces**, se debe considerar obligatoriamente su extracción a un método, servicio, utilidad o abstracción reutilizable.

Ejemplo:

```text
Código repetido:

Feature A → validar DPI
Feature B → validar DPI
Feature C → validar DPI
Feature D → validar DPI
```

Debe evaluarse una solución reutilizable:

```text
DpiValidator
```

o una abstracción equivalente adecuada a la arquitectura.

---

## Excepción

No extraer código únicamente porque dos fragmentos se parecen superficialmente.

La reutilización debe realizarse cuando:

* El comportamiento es realmente el mismo.
* La lógica representa una misma responsabilidad.
* La abstracción mejora la mantenibilidad.

No convertir pequeñas diferencias de lógica en una abstracción excesivamente genérica.

---

# 8. KISS — KEEP IT SIMPLE, STUPID

Toda nueva funcionalidad debe implementarse utilizando la solución más sencilla que cumpla correctamente los requisitos.

Antes de implementar una solución compleja, evaluar si puede resolverse mediante:

* Una clase existente.
* Un método sencillo.
* Un servicio existente.
* Una consulta directa.
* Una validación simple.
* Una estructura de control clara.
* Una funcionalidad existente.

Evitar introducir complejidad que no aporte valor.

---

# 9. EVITAR SOBREARQUITECTURA

No crear elementos únicamente porque podrían ser útiles en el futuro.

Evitar agregar anticipadamente:

```text
Factories
Builders
Strategies
Adapters
Facades
Managers
Wrappers
Interfaces
Abstracciones genéricas
```

cuando una implementación directa y clara sea suficiente.

Las abstracciones deben responder a una necesidad real del sistema.

### Regla

> No implementar una solución para un problema que todavía no existe.

---

# 10. ALTA COHESIÓN

Los elementos relacionados deben permanecer juntos.

Por ejemplo, en Angular:

```text
features/
└── pacientes/
    ├── components/
    ├── pages/
    ├── services/
    ├── models/
    └── pacientes.routes.ts
```

En Spring Boot, las responsabilidades relacionadas con una funcionalidad deben mantenerse organizadas de manera coherente con la arquitectura definida para el Backend.

No distribuir arbitrariamente una misma responsabilidad entre múltiples módulos.

---

# 11. BAJO ACOPLAMIENTO

Los componentes deben depender lo menos posible de implementaciones internas de otros componentes.

Evitar dependencias innecesarias entre features.

Preferir:

```text
Feature
   ↓
Service
   ↓
API
```

en lugar de:

```text
Feature A
   ↓
Feature B
   ↓
Feature C
   ↓
Feature D
```

Los cambios realizados en una funcionalidad no deberían provocar modificaciones innecesarias en funcionalidades no relacionadas.

---

# 12. SEPARACIÓN DE RESPONSABILIDADES

Cada capa debe cumplir una función específica.

Para el Backend:

```text
Controller
    │
    │ Recibe solicitudes HTTP
    ▼
Service
    │
    │ Ejecuta lógica de negocio
    ▼
Repository
    │
    │ Accede a datos
    ▼
Database
```

El Controller no debe contener lógica de negocio compleja.

El Repository no debe contener reglas de negocio.

El Service debe encargarse de las reglas de negocio correspondientes.

---

# 13. COMUNICACIÓN EN TIEMPO REAL MEDIANTE WEBSOCKET

MediSistema utilizará WebSocket como mecanismo de comunicación en tiempo real cuando una funcionalidad requiera que los cambios realizados por un usuario sean reflejados inmediatamente en otros clientes conectados.

WebSocket NO reemplaza la API REST.

La comunicación debe utilizarse de acuerdo con la responsabilidad de cada mecanismo:

```text
REST
→ Operaciones de consulta y modificación de información.

WebSocket
→ Notificaciones y actualizaciones en tiempo real.
````

## 13.1 Responsabilidad de REST

Las operaciones normales del sistema deben continuar utilizando la API REST.

Por ejemplo:

```text
POST   /api/citas
GET    /api/citas
GET    /api/citas/{id}
PUT    /api/citas/{id}
PATCH  /api/citas/{id}/estado
```

La creación, modificación, consulta y eliminación lógica de información debe continuar siendo responsabilidad de los endpoints REST correspondientes.

WebSocket no debe utilizarse para reemplazar estas operaciones.

---

## 13.2 Responsabilidad de WebSocket

WebSocket debe utilizarse únicamente cuando sea necesario comunicar eventos en tiempo real a otros usuarios conectados.

Ejemplo:

```text
Secretaria
    │
    │ POST /api/citas
    ▼
Spring Boot
    │
    ├── valida la operación
    ├── guarda la cita
    │
    └── publica evento WebSocket
             │
             ▼
        Médicos conectados
```

Por ejemplo, cuando una secretaria registra una nueva cita para el día actual, el Backend puede notificar mediante WebSocket a los médicos que tengan una sesión activa y deban recibir dicha actualización.

El Frontend del médico recibirá el evento y actualizará la información correspondiente sin necesidad de realizar una recarga manual de la página.

---

## 13.3 WebSocket como mecanismo de notificación

Los eventos enviados mediante WebSocket deben representar acontecimientos relevantes del sistema.

Ejemplos:

```text
CITA_CREADA
CITA_ACTUALIZADA
CITA_CANCELADA
CITA_ATENDIDA
```

Los eventos deben contener únicamente la información necesaria para que el Frontend pueda reaccionar correctamente.

Ejemplo conceptual:

```text
{
    "tipo": "CITA_CREADA",
    "citaId": 15,
    "medicoId": 3
}
```

El evento no debe utilizarse como sustituto de la respuesta REST ni como mecanismo principal para transportar grandes cantidades de información.

Cuando sea necesario obtener información completa o actualizada, el Frontend podrá realizar una consulta REST después de recibir el evento.

Ejemplo:

```text
WebSocket
    │
    │ CITA_CREADA
    ▼
Angular
    │
    │ GET /api/citas/15
    ▼
Spring Boot
```

---

## 13.4 Ubicación de la lógica WebSocket

La implementación WebSocket debe respetar la arquitectura existente.

En el Backend, la configuración y componentes relacionados con WebSocket deben permanecer dentro de la configuración y responsabilidades correspondientes de Spring Boot.

La lógica de negocio NO debe colocarse directamente dentro del mecanismo de WebSocket.

Debe mantenerse el flujo:

```text
Controller REST
      │
      ▼
   Service
      │
      ├── ejecuta regla de negocio
      ├── persiste información
      │
      └── publica evento
                │
                ▼
          WebSocket
                │
                ▼
          Clientes Angular
```

El componente encargado de publicar eventos debe tener una responsabilidad específica y no debe convertirse en un servicio que concentre lógica de negocio.

---

## 13.5 WebSocket en Angular

La conexión WebSocket debe manejarse como una preocupación transversal cuando pueda ser utilizada por diferentes funcionalidades.

La conexión global puede permanecer dentro de:

```text
core/services/
```

Por ejemplo:

```text
core/
└── services/
    ├── auth.service.ts
    ├── notification.service.ts
    └── websocket.service.ts
```

El `WebSocketService` será responsable de:

* Establecer la conexión.
* Mantener la conexión mientras corresponda.
* Recibir eventos.
* Exponer los eventos a los features interesados.
* Gestionar el cierre de la conexión.
* Gestionar la reconexión cuando sea necesaria.

Los features no deben implementar conexiones WebSocket independientes si pueden utilizar la conexión global existente.

---

## 13.6 Comunicación entre WebSocket y Features

Los features deben reaccionar únicamente a los eventos que sean relevantes para ellos.

Por ejemplo:

```text
WebSocketService
        │
        ▼
   CITA_CREADA
        │
        ▼
Feature Citas
        │
        ▼
Actualiza la agenda
```

El feature de citas no debe conocer los detalles internos de cómo se establece la conexión WebSocket.

Debe depender de la información proporcionada por el servicio correspondiente.

---

## 13.7 Autenticación de WebSocket

Las conexiones WebSocket deben respetar las reglas de seguridad definidas para MediSistema.

La comunicación en tiempo real no debe permitir que un usuario autenticado reciba información para la cual no tiene autorización.

Los eventos deben enviarse considerando:

```text
Usuario
   │
   ▼
JWT / autenticación
   │
   ▼
Rol y permisos
   │
   ▼
Eventos permitidos
```

El Backend continúa siendo la autoridad responsable de determinar qué información puede recibir cada usuario.

El Frontend no debe utilizar filtros locales como mecanismo de seguridad.

---

## 13.8 No duplicar conexiones

No crear una conexión WebSocket por cada componente o página.

Evitar:

```text
CitasPage
   └── WebSocket

AgendaPage
   └── WebSocket

DashboardPage
   └── WebSocket
```

Preferir:

```text
                 WebSocket
                     │
                     ▼
              WebSocketService
                /     |      \
               /      |       \
              ▼       ▼        ▼
           Citas   Dashboard  Agenda
```

Debe existir una conexión compartida siempre que las necesidades funcionales lo permitan.

---

## 13.9 WebSocket no debe contener lógica de negocio

El WebSocket debe comunicar eventos, no ejecutar reglas de negocio complejas.

Incorrecto:

```text
WebSocket
    │
    ├── valida disponibilidad
    ├── modifica cita
    ├── actualiza paciente
    ├── registra auditoría
    └── modifica base de datos
```

Preferido:

```text
REST
 │
 ▼
Service
 │
 ├── ejecuta reglas de negocio
 ├── modifica base de datos
 └── publica evento
              │
              ▼
          WebSocket
              │
              ▼
           Angular
```

La lógica de negocio debe permanecer en los servicios correspondientes.

---

## 13.10 Uso de WebSocket únicamente cuando aporte valor

No utilizar WebSocket para operaciones que no necesiten comunicación en tiempo real.

Por ejemplo, una consulta normal:

```text
GET /api/pacientes
```

debe continuar utilizando REST.

WebSocket debe utilizarse cuando exista una necesidad real de actualización inmediata, como:

```text
Nueva cita registrada
Cambio de estado de una cita
Cancelación de una cita
Actualización de información que otros usuarios deban visualizar inmediatamente
```

No implementar WebSocket únicamente por utilizar una tecnología adicional.

Debe aplicarse el principio KISS.

---

# 14. VALIDACIONES

Las validaciones deben realizarse en el lugar apropiado.

Las validaciones relacionadas con la entrada de datos pueden realizarse en los DTOs o mecanismos correspondientes.

Las reglas de negocio deben permanecer en la capa de negocio.

Ejemplo:

```text
DTO
│
└── ¿El correo tiene formato válido?

Service
│
└── ¿El usuario puede realizar esta operación?

Repository
│
└── Acceso a PostgreSQL
```

No trasladar reglas de negocio importantes únicamente al Frontend.

El Backend siempre debe validar las reglas críticas.

---

# 15. NO DUPLICAR LÓGICA ENTRE FRONTEND Y BACKEND INNECESARIAMENTE

El Frontend puede realizar validaciones para mejorar la experiencia del usuario.

Sin embargo, las reglas de negocio importantes deben existir en el Backend.

Ejemplo:

```text
Angular
└── Validación visual del formulario

Spring Boot
└── Validación real de la regla de negocio
```

Nunca asumir que una validación realizada por Angular garantiza la seguridad del sistema.

---

# 16. MANEJO DE ERRORES

Los errores deben manejarse de manera consistente.

Evitar:

```java
try {
    ...
} catch (Exception e) {
    e.printStackTrace();
}
```

sin una estrategia clara de manejo.

El Backend debe utilizar el mecanismo de manejo global de excepciones definido para el proyecto.

Los errores enviados al Frontend deben ser claros y apropiados para el contexto de la API.

No exponer información sensible como:

* Contraseñas.
* Tokens.
* Credenciales.
* Stack traces.
* Información interna de la base de datos.

---

# 17. CÓDIGO LEGIBLE

El código debe ser comprensible sin depender excesivamente de comentarios.

Preferir nombres descriptivos:

```java
registrarPaciente()
consultarPaciente()
actualizarEstadoPaciente()
```

en lugar de:

```java
proc()
doIt()
handle()
processData()
```

Los métodos deben ser pequeños y tener una responsabilidad clara.

---

# 18. COMENTARIOS

No utilizar comentarios para explicar código innecesariamente complejo cuando el código puede hacerse más claro.

Evitar:

```java
// Incrementamos i en uno
i++;
```

Preferir código autoexplicativo.

Los comentarios deben utilizarse cuando exista una decisión de diseño, regla de negocio o comportamiento que no resulte evidente.

---

# 19. LÓGICA DE NEGOCIO

La lógica de negocio debe implementarse de forma:

* Clara.
* Simple.
* Cohesiva.
* Reutilizable cuando corresponda.
* Fácil de probar.
* Independiente de detalles de infraestructura cuando sea posible.

Ejemplo:

```text
Controller
    ↓
Service
    ↓
Regla de negocio
    ↓
Repository
```

No colocar reglas de negocio importantes directamente en:

* Controllers.
* Componentes Angular.
* Repositories.
* Consultas SQL innecesariamente complejas.

---

# 20. ANTES DE CREAR UNA NUEVA CLASE O SERVICIO

Antes de crear una nueva abstracción, verificar:

1. ¿Ya existe una clase que tenga esta responsabilidad?
2. ¿Existe un servicio que pueda reutilizarse?
3. ¿La funcionalidad pertenece realmente a este módulo?
4. ¿La nueva clase reduce complejidad?
5. ¿La nueva abstracción tiene una responsabilidad clara?
6. ¿Se está creando por una necesidad real o solamente por anticipación?

Si una solución sencilla es suficiente, utilizar la solución sencilla.

---

# 21. REUTILIZACIÓN DE CÓDIGO

La reutilización debe seguir este criterio:

```text
1 vez
→ Implementación normal.

2 veces
→ Evaluar si realmente existe código común.

3 veces
→ Considerar extracción.

4 o más veces
→ Extraer y reutilizar obligatoriamente,
  salvo que exista una justificación técnica.
```

La reutilización debe mantener la cohesión.

No crear una clase `Utils` gigantesca que contenga funcionalidades sin relación.

Preferir utilidades específicas:

```text
DpiValidator
DateUtils
ValidationUtils
```

cuando realmente correspondan.

---

# 22. PRINCIPIO DE MÍNIMO CAMBIO

Cuando se corrija un problema, modificar únicamente lo necesario para solucionarlo.

Evitar aprovechar una corrección pequeña para realizar refactorizaciones masivas no relacionadas.

Ejemplo:

```text
Problema:
La actualización de pacientes falla.

Correcto:
Corregir la actualización de pacientes.

Evitar:
Reestructurar todo el módulo de pacientes,
cambiar todos los DTOs y modificar otros módulos
sin relación con el problema.
```

Si una refactorización adicional es necesaria, debe documentarse.

---

# 23. COMPATIBILIDAD CON LA ARQUITECTURA

Toda implementación debe respetar las reglas existentes en:

```text
.agents/
├── analisis/
│   └── analisis_medisistema.md
├── reglas_despliegue.md
├── reglas_estructura_y_features.md
└── reglas_documentacion.md
```

Estas reglas no deben considerarse independientes.

Antes de implementar una funcionalidad:

```text
Análisis
   ↓
Reglas de estructura
   ↓
Reglas de implementación
   ↓
Implementación
   ↓
Documentación
```

Si existe un conflicto entre una implementación propuesta y las reglas arquitectónicas existentes, se debe priorizar la arquitectura definida y evaluar el cambio antes de modificarla.

---

# 24. NO INVENTAR REQUISITOS

La implementación debe basarse en:

1. El análisis funcional.
2. Los casos de uso.
3. El modelo de datos.
4. Las reglas de arquitectura.
5. Los requisitos proporcionados.

No agregar funcionalidades, reglas de negocio o comportamientos que no hayan sido definidos.

Si una decisión técnica es necesaria pero no está especificada, elegir la solución más simple y coherente con la arquitectura existente.

---

# 25. CRITERIO GENERAL DE IMPLEMENTACIÓN

Ante varias soluciones posibles, priorizar en este orden:

```text
1. Correctitud
       ↓
2. Simplicidad
       ↓
3. Cohesión
       ↓
4. Bajo acoplamiento
       ↓
5. Reutilización
       ↓
6. Extensibilidad
```

No sacrificar simplicidad únicamente para obtener una supuesta extensibilidad futura.

---

# 26. REGLA PRINCIPAL

Toda implementación nueva en MediSistema debe poder responder afirmativamente a las siguientes preguntas:

* ¿Respeta SOLID?
* ¿Evita duplicación innecesaria?
* ¿Aplica DRY cuando existe repetición significativa?
* ¿Utiliza KISS?
* ¿Mantiene alta cohesión?
* ¿Mantiene bajo acoplamiento?
* ¿Tiene responsabilidades claramente separadas?
* ¿Evita sobrearquitectura?
* ¿Es fácil de entender y mantener?
* ¿Respeta el análisis funcional?
* ¿Respeta la arquitectura existente?

La prioridad es:

> **Código simple, correcto, cohesivo, poco acoplado y mantenible.**

No se debe agregar complejidad técnica si una solución más sencilla cumple correctamente con los requisitos.
