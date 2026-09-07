# Reglas de implementación — Portal Empresarial

Este documento reemplaza una versión anterior que describía un proyecto
distinto (una plantilla genérica de "MediSistema" en Spring Boot/Angular) sin
relación con este repositorio. El contenido de aquí en adelante refleja los
criterios usados realmente en la refactorización de
`public/modules/vales/js/app.js` (ver
`.agents/modulos/vales de arte/documentacion/refactor_app_js.md`) y está
pensado para aplicarse igual al resto de archivos grandes del proyecto (el
candidato más obvio hoy es `public/modules/admin/js/app.js`).

## Contexto técnico real de este proyecto

- Node/Express **modular monolito**, sin microservicios, sin build step.
- Frontend: HTML/CSS/JS vanilla servido como archivos estáticos
  (`express.static`), sin framework, sin bundler, sin TypeScript.
- Backend: `controllers → services → repositories`, SQL vive solo en
  repositorios, `db.query(sql, params, tag)` con fallback a una base de datos
  en memoria (mock) que dispatch por `tag`, no por SQL real.
- Comunicación en tiempo real vía Socket.IO (`src/core/websocket`), rooms por
  rol/usuario/taller.
- No hay test suite ni linter configurado — la única verificación disponible
  es manual (navegador) + `node --check` para sintaxis + inspección de
  imports/exports.

Cualquier regla de abajo que entre en conflicto con esta realidad pierde:
nunca introduzcas un framework, un bundler, TypeScript o una arquitectura de
microservicios para "cumplir" un principio de diseño.

## Regla principal

> Si una decisión de arquitectura entra en conflicto con mantener el
> funcionamiento actual, prioriza mantener el funcionamiento actual.

Una refactorización estructural nunca cambia: endpoints, métodos HTTP,
nombres de parámetros, estructura de payloads/FormData, ids/clases/`data-*`
del DOM, textos visibles, permisos, ni el comportamiento observable de
ninguna función. Si separar una pieza es riesgoso, se deja donde está y se
explica por qué — no se fuerza la separación por completitud.

## Cuándo modularizar un archivo

Señal para dividir un archivo (no una regla de líneas exacta, pero como
referencia: el disparador real en este proyecto fue un archivo de ~2700
líneas en un único `(() => {...})()`):

- Mezcla claramente responsabilidades no relacionadas (fetch + render +
  validación de formularios + tiempo real + lógica por rol, todo en el mismo
  scope).
- Cuesta trabajo encontrar una función porque hay que leer cientos de líneas
  no relacionadas para llegar a ella.
- Varias personas/tareas tocan partes distintas del mismo archivo con
  frecuencia (fricción de merge, aunque no haya conflicto real de lógica).

Señal para **NO** dividir:

- El archivo es pequeño o ya tiene una sola responsabilidad clara.
- La única motivación es "seguir la regla" de una carpeta como `utils/` o
  `components/` — un archivo de 5 líneas no necesita su propio módulo.
- Separar exigiría inventar una capa de indirección (una clase, un patrón)
  que nadie más en el proyecto usa, solo para lucir "más arquitectónico".

## Cómo cargar módulos en el frontend sin build step

Este proyecto no tiene bundler. La opción usada y recomendada es **módulos ES
nativos del navegador**:

```html
<!-- antes -->
<script src="/modules/<modulo>/js/app.js"></script>
<!-- después -->
<script type="module" src="/modules/<modulo>/js/app.js"></script>
```

Un solo cambio de una línea en el HTML de esa página. Cada archivo usa
`import`/`export` reales, sin bundler ni transpilación. Antes de aplicar este
cambio, verifica el orden de scripts existente en el HTML: cualquier variable
global que otros scripts clásicos (no-módulo) esperen encontrar (p. ej.
`window.toast`, `io` de socket.io) debe seguir estando disponible — los
scripts clásicos sin `defer` se ejecutan durante el parseo, antes de que
corra cualquier script de módulo, así que en la práctica no requiere más
cambios. Nunca hagas este cambio de HTML sin explicárselo antes al usuario.

El IIFE (`(() => {...})()`) que aislaba el scope en el archivo monolítico deja
de ser necesario: cada módulo ES ya tiene su propio scope de archivo.

## Criterios para agrupar código en módulos

Usa estas categorías como referencia; adáptalas al archivo real en vez de
forzarlas todas:

- **`state.js`** — un único objeto de estado mutable, exportado tal cual (sin
  getters/setters ni copias). Todo lo demás lo importa y lo lee/escribe
  directamente, exactamente como antes de dividir el archivo. No inventes un
  patrón de store/reducer que el proyecto no tenía.
- **`config/`** — constantes puras sin lógica: diccionarios de etiquetas,
  mapas de roles/ids, configuración declarativa por rol. Si una constante
  depende de otra constante (p. ej. un mapa que se indexa por un enum de
  roles), esa dependencia se declara con un `import`, nunca duplicando el
  valor.
- **`utils/`** — funciones puras sin efectos secundarios ni dependencia de
  `state` salvo lectura de catálogos ya cargados (p. ej. `nombreCatalogo`).
  Formateo de fechas/números, helpers de DOM genéricos (`$`/`$$`).
- **`permisos.js`** (o equivalente) — un único lugar para "¿este rol puede
  hacer X?" y "¿qué debo mostrarle a este rol?". Si esta lógica se separara
  por archivo, se volvería difícil auditar qué puede hacer cada rol.
- **`api/`** — un archivo por dominio de endpoints, una función por
  endpoint. Cada función hace `fetch` + valida la respuesta **exactamente
  igual** que el call site original (algunos endpoints lanzan con el mensaje
  del servidor, otros con un mensaje fijo, otros ni siquiera verifican
  `res.ok` porque el llamador ya envuelve la llamada en un `try/catch` con un
  valor de respaldo). No uniformices ese comportamiento "para que quede más
  limpio" — es un cambio de comportamiento disfrazado de refactor.
- **`components/`** — piezas de UI reutilizables en más de un lugar (modal
  genérico, selector de fecha, dropzone de archivos, validación inline). Si
  algo se usa en un solo lugar y no es conceptualmente un componente
  reutilizable, no lo saques de su vista.
- **`layout/`** — cosas de la cáscara de la página que no son datos de
  negocio: sidebar, toolbar, menú de cuenta.
- **`views/`** — carga de datos + render de una pantalla completa (el buzón,
  un dashboard). Puede depender de `api/`, `components/`, `utils/`,
  `permisos.js` y de `actions/`/`forms/` (para construir los botones de
  acción de cada fila).
- **`forms/`** — un formulario complejo compartido entre flujos (crear/editar
  una misma entidad).
- **`actions/`** — modales y llamadas de una acción específica de negocio,
  agrupadas por quién las usa cuando eso mejora la cohesión (p. ej. todas las
  acciones exclusivas de un rol en un archivo) — nunca un archivo por función
  de 5 líneas.

No crees una carpeta si el archivo real no tiene contenido para ella. La
lista de arriba es un menú, no una checklist obligatoria.

## Dependencias circulares entre módulos

Un ciclo de imports entre dos módulos (p. ej. la vista que arma las acciones
de una fila importa las acciones, y cada acción importa la función de
refresco de esa misma vista) **no es un error** si:

1. Ya existía como "dos funciones en el mismo scope que se llaman entre sí"
   antes de dividir el archivo.
2. Lo que se importa son declaraciones de función (no valores calculados en
   el top-level del módulo).
3. Ninguna de las dos partes del ciclo se ejecuta durante la carga del
   módulo — solo dentro de manejadores de eventos, después de que todo ya
   terminó de cargar.

Documenta el ciclo explícitamente en la documentación del refactor (qué dos
módulos se importan mutuamente y por qué), en vez de reestructurar el código
para eliminarlo artificialmente. Sí evita cualquier ciclo que **no** cumpla
las tres condiciones de arriba.

## Estado compartido

`state` sigue siendo un único objeto mutable exportado desde un solo módulo.
No lo dividas en varios objetos de estado ni le agregues una capa de
suscripción/eventos que el proyecto no tenía — la prioridad, en este orden,
es: funcionamiento actual → integridad de los datos → compatibilidad →
mantenibilidad. Un patrón de estado "más correcto" que rompa alguno de los
tres primeros puntos no vale la pena.

## Comentarios

- Nunca comentes qué hace el código si el nombre de la función/variable ya lo
  dice.
- Nunca referencies un ciclo de correcciones en un comentario nuevo o movido
  (`// analisis_correcciones_X.md`, `// corrección #N`). Esa información va
  en el changelog de la corrección (`.agents/documentacion/` o el archivo
  específico del módulo bajo `.agents/modulos/<módulo>/documentacion/`), no
  en el código — un comentario de este tipo no le sirve a nadie leyendo el
  código seis meses después y solo agrega ruido.
- Sí vale un comentario corto cuando el porqué NO es obvio leyendo el código:
  una restricción de negocio no evidente, un workaround de un bug específico,
  un orden de eventos del DOM que rompe si se cambia, una decisión que ya se
  intentó hacer distinto y se revirtió.
- Al mover una función a un módulo nuevo, aprovecha para limpiar cualquier
  comentario de este tipo que traiga encima — no hace falta una pasada aparte
  sobre comentarios que no se tocaron, pero cualquier línea movida por el
  refactor sí debe llegar limpia.

## Proceso para refactorizar un archivo grande

1. **Analiza antes de tocar nada.** Lee el archivo completo (en trozos si
   hace falta) y anota: todas las funciones y constantes, el objeto de
   estado, todas las dependencias función→función y función→estado, todos
   los elementos del DOM referenciados, todos los endpoints usados, todos los
   eventos registrados, el flujo de inicialización, las diferencias de
   comportamiento por rol, y cualquier función que parezca no usarse pero
   tenga una referencia indirecta (un callback pasado a otra función, un
   listener que se engancha dinámicamente). No asumas que algo es eliminable
   sin verificar todas sus referencias.
2. **Propón la estructura antes de escribir código** — qué carpetas/archivos,
   qué función va a cada uno, qué se queda en el orquestador, qué riesgos hay,
   qué cambios (si alguno) hacen falta fuera del archivo. Espera aprobación
   antes de implementar si el usuario lo pidió explícitamente para esa tarea.
3. **Implementa de abajo hacia arriba**: primero los módulos sin
   dependencias (config/utils/state), después los que dependen de esos
   (permisos, api, components), después layout/views, y al final el
   orquestador que los conecta a todos.
4. **No borres el archivo original** hasta comprobar que la versión nueva
   funciona igual.
5. **Verifica**: cada `import` resuelve a un archivo real, cada símbolo
   importado existe como `export`, `node --check` sin errores de sintaxis
   sobre cada archivo nuevo, y una pasada manual en el navegador cubriendo
   cada rol/flujo que el archivo original manejaba — sin errores en la
   consola del navegador ni en el log del servidor.
6. **Documenta** qué archivos se crearon, qué responsabilidad tiene cada uno,
   qué funciones se movieron, qué quedó en el orquestador y por qué, qué
   dependencias existen entre módulos (incluidos ciclos intencionales), qué
   cambió fuera del archivo, y cómo verificar manualmente que todo sigue
   funcionando.

## Qué no hacer

- No reescribas lógica de negocio "de paso" mientras separas archivos.
- No cambies endpoints, métodos HTTP, nombres de parámetros, estructura de
  payloads, ids/clases/`data-*` del DOM, ni textos visibles al usuario.
- No introduzcas un framework, TypeScript, o dependencias nuevas para
  modularizar código vanilla JS.
- No crees una abstracción (clase, patrón de diseño) que ningún otro archivo
  del proyecto usa, solo para este refactor.
- No optimices prematuramente ni agregues funcionalidad nueva aprovechando
  que ya estás tocando el archivo.
