# Archivo de correcciones No. 21

Quiero que refactorices el archivo `public/modules/vales/js/app.js`

IMPORTANTE: Este archivo actualmente controla el funcionamiento completo del módulo de vales y está en desarrollo activo. **NO debes romper absolutamente ninguna funcionalidad existente.** El comportamiento externo del módulo debe permanecer exactamente igual después de la refactorización.

El objetivo NO es reescribir el sistema ni cambiar su arquitectura funcional, sino dividir este archivo monolítico en módulos pequeños, cohesivos y fáciles de mantener.

Quiero aplicar, en la medida en que sea apropiado:

* SOLID
* DRY
* KISS
* Alta cohesión
* Bajo acoplamiento
* Separación de responsabilidades
* Single Responsibility Principle
* Legibilidad
* Mantenibilidad
* Reutilización de código

### REGLA PRINCIPAL: NO CAMBIAR EL COMPORTAMIENTO

Antes de modificar el código, analiza completamente `app.js`.

Identifica:

1. Todas las funciones existentes.
2. Todas las variables y estados globales.
3. Todas las dependencias entre funciones.
4. Todos los elementos del DOM utilizados.
5. Todos los endpoints `/api/...` utilizados.
6. Todos los eventos registrados.
7. Todas las funciones que dependen de otras funciones.
8. Todas las funciones que dependen de `state`.
9. Todas las funciones utilizadas desde otras partes del módulo.
10. El flujo de inicialización del módulo.
11. Las diferencias de comportamiento según roles.
12. Cualquier función que pueda parecer redundante pero que tenga una dependencia indirecta.

No asumas que una función puede eliminarse simplemente porque parece no utilizarse directamente. Antes de eliminar, verifica todas sus referencias.

### ARQUITECTURA PROPUESTA

Quiero que `app.js` deje de ser un archivo gigantesco y se convierta principalmente en un punto de entrada/orquestador.

Por ejemplo, puedes proponer una estructura similar a:

public/modules/vales/js/
│
├── app.js
│
├── state/
│   └── state.js
│
├── config/
│   ├── estados.js
│   └── roles.js
│
├── api/
│   └── valesApi.js
│
├── utils/
│   ├── fechas.js
│   ├── formato.js
│   └── dom.js
│
├── components/
│   ├── modal.js
│   ├── dropzone.js
│   └── ...
│
├── views/
│   ├── buzon.js
│   ├── dashboard.js
│   ├── historial.js
│   └── ...
│
├── actions/
│   ├── asesor.js
│   ├── supervisor.js
│   ├── tecnico.js
│   └── ...
│
└── forms/
└── valeForm.js

**NO tienes que utilizar exactamente esta estructura.**

Primero analiza el código y determina una estructura que tenga sentido para ESTE proyecto.

No quiero crear carpetas o archivos innecesarios solamente para cumplir una regla de arquitectura.

### PRINCIPIO DE RESPONSABILIDAD ÚNICA

Cada módulo debe tener una responsabilidad clara.

Por ejemplo:

* Las funciones relacionadas con llamadas HTTP deben estar separadas de la manipulación del DOM.
* Las funciones que generan HTML deben estar separadas de las funciones que realizan `fetch`.
* Las utilidades de fechas deben estar separadas de las funciones de negocio.
* Los modales reutilizables deben estar separados de los modales específicos de una funcionalidad.
* El estado global debe tener una ubicación claramente definida.
* Las constantes/configuraciones deben estar separadas de la lógica.
* Las acciones específicas de un rol deben estar separadas cuando esto mejore realmente la cohesión.

Pero evita sobre-ingeniería.

NO quiero convertir cada función de 5 líneas en un archivo independiente.

### DEPENDENCIAS

Ten especial cuidado con las dependencias existentes.

Si actualmente existe algo como:

funcionA()
↓
funcionB()
↓
state
↓
renderTabla()

la refactorización debe conservar ese flujo.

Si una función necesita otra función, importa explícitamente esa dependencia o utiliza una estrategia equivalente.

NO dependas de variables globales accidentales.

NO cambies nombres de funciones públicas o utilizadas desde HTML, otros scripts o eventos externos sin comprobar primero sus referencias.

### JAVASCRIPT

Mantén el mismo entorno tecnológico actual.

No introduzcas frameworks nuevos.

No conviertas el proyecto a TypeScript.

No introduzcas React, Vue, Angular, etc.

No agregues dependencias externas salvo que exista una razón absolutamente necesaria.

Si el proyecto actualmente utiliza IIFE, módulos ES, funciones globales, `window`, `document`, `fetch`, etc., analiza primero cómo se está cargando el código y adapta la modularización al entorno existente.

Si para utilizar `import/export` es necesario modificar el HTML, explica exactamente qué modificación sería necesaria antes de realizarla.

### API

No cambies:

* URLs de endpoints.
* Métodos HTTP.
* nombres de parámetros.
* nombres de campos enviados.
* estructura de `FormData`.
* estructura esperada de respuestas.
* lógica de autenticación.
* manejo de sesiones.
* permisos.

Puedes encapsular las llamadas HTTP en módulos como `valesApi.js`, pero deben comportarse exactamente igual que antes.

### DOM Y HTML

No cambies arbitrariamente:

* IDs.
* clases CSS.
* atributos `data-*`.
* nombres de inputs.
* estructura esperada por CSS.
* selectores utilizados por eventos.

No modifiques el diseño visual.

No cambies textos visibles al usuario salvo que sea estrictamente necesario.

### ESTADO

Analiza cuidadosamente el objeto `state`.

Quiero evitar que diferentes módulos manipulen el estado de forma descontrolada.

Si tiene sentido, centraliza el estado en un módulo.

Sin embargo, NO cambies la estructura ni el comportamiento del estado solamente por aplicar un patrón arquitectónico.

La prioridad es:

1. Funcionamiento actual.
2. Integridad de datos.
3. Compatibilidad.
4. Mantenibilidad.

### PROCESO DE REFACTORIZACIÓN

NO hagas toda la refactorización a ciegas de una sola vez.

Primero entrégame:

1. Un análisis de `app.js`.
2. Las responsabilidades que actualmente contiene.
3. Las principales dependencias entre funciones.
4. Una propuesta de estructura de carpetas/archivos.
5. Qué funciones moverías a cada archivo.
6. Qué debería permanecer en `app.js`.
7. Riesgos potenciales de la refactorización.
8. Qué cambios serían necesarios fuera de `app.js`, si los hubiera.

Después de ese análisis, realiza la refactorización.

### REGLA DE CONSERVACIÓN

La siguiente regla es fundamental:

> Si una decisión de arquitectura entra en conflicto con mantener el funcionamiento actual, prioriza mantener el funcionamiento actual.

Prefiero una arquitectura ligeramente menos "perfecta" pero funcional antes que una arquitectura teóricamente excelente que rompa el módulo.

### COMPATIBILIDAD

Después de separar los archivos, verifica:

* Que todas las funciones utilizadas sigan existiendo.
* Que todos los imports/exports sean correctos.
* Que no existan referencias circulares innecesarias.
* Que todas las variables tengan el scope correcto.
* Que `state` siga funcionando.
* Que los eventos sigan registrándose.
* Que los modales sigan funcionando.
* Que los formularios sigan enviando exactamente la misma información.
* Que los archivos sigan subiendo correctamente.
* Que las llamadas API sigan funcionando.
* Que los diferentes roles sigan teniendo exactamente los mismos permisos.
* Que el dashboard siga funcionando.
* Que el buzón siga funcionando.
* Que las acciones sobre los vales sigan funcionando.

### NO HACER

No quiero:

* Reescritura completa.
* Cambios de lógica de negocio.
* Cambios de endpoints.
* Cambios de base de datos.
* Cambios de UI.
* Cambios de CSS.
* Cambios de permisos.
* Cambios de comportamiento.
* Optimizaciones prematuras.
* Nuevas funcionalidades.
* Frameworks nuevos.
* Dependencias innecesarias.
* Archivos creados únicamente para contener una función trivial.
* Abstracciones excesivas.
* Patrones de diseño utilizados únicamente "porque sí".

### VALIDACIÓN

Una vez terminada la refactorización, realiza una revisión completa del resultado.

Genera un checklist indicando:

[ ] Todas las funciones originales fueron conservadas o trasladadas correctamente.
[ ] No se cambiaron endpoints.
[ ] No se cambiaron métodos HTTP.
[ ] No se cambiaron nombres de parámetros.
[ ] No se cambió la estructura de los datos enviados.
[ ] No se rompió el estado.
[ ] No se rompieron eventos.
[ ] No se rompieron modales.
[ ] No se rompieron formularios.
[ ] No se rompió la carga de archivos.
[ ] No se rompió el dashboard.
[ ] No se rompieron las funciones específicas de cada rol.
[ ] No existen referencias/importaciones faltantes.
[ ] No existen dependencias circulares innecesarias.
[ ] `app.js` quedó como orquestador y punto de entrada.
[ ] Cada módulo tiene una responsabilidad clara.
[ ] No existe duplicación innecesaria.
[ ] La solución sigue siendo sencilla de entender.

Al final, explícame:

1. Qué archivos nuevos creaste.
2. Qué responsabilidad tiene cada uno.
3. Qué funciones fueron trasladadas.
4. Qué quedó dentro de `app.js` y por qué.
5. Qué dependencias existen entre los módulos.
6. Qué cambios, si alguno, fueron necesarios fuera de `app.js`.
7. Cómo verificar manualmente que el módulo sigue funcionando.

En la carpeta de documentación `'.agents\modulos\vales de arte\documentacion'`

IMPORTANTE:

No elimines el `app.js` original hasta comprobar que la nueva estructura funciona.

Si detectas una parte del código cuya separación podría romper el comportamiento, déjala temporalmente en `app.js` y explícame por qué.

Quiero una refactorización conservadora, incremental y segura, no una reescritura. **IMPORTANTE** apegate a las reglas en `.agents\reglas\reglas_implementacion.md`.

**Por último** quiero que documentes la estructura que usaste y los criterios que usaste para modularizar y simplificar el archivo  en `.agents\reglas\reglas_implementacion.md`. El propósito de esto, es que el archivo de reglas de implementación nos sirva para aplicarselo a todos los demás archivos. Ya que, hay mucho código espagueti y comentarios sin sentido. **Sobre todo eso** quita los comentarios que sean en base a las correcciones, eso no me sirve y agregan líneas a lo bruto.