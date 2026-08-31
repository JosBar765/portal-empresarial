# ARCHIVO DE ARREGLO No. 13 AL MÓDULO DE: VALES DE ARTE

1. En la opción de `Dashboard` del sidebar de los **supervisores/gerentes**, modificaremos el funcionamiento del contador de atrasados:
    - Se mostrará eñ número de vales atrasados totales SOLO si no se ha combinado el contador de atrasados con algún otro contador
    Quiere decir, que si yo selecciono el número de vales "Modificados" el contador de atrasados cambiará al número de vales modificados atrasados. Esto no solo actualiza el número, también actualiza el label de %. Al momento de deseleccionar los vales "Modificados" el contador de atrasados vuelve a mostrar el número total de vales atrasados, lo mismo para el label.

2. Actualmente, el modal de `Aprobar y Fusionar` SOLO muestra la(s) corrección(es) del(los) taller(es). Lo que haremos es lo siguiente, supongamos que un vale fue realizado por Diseño 3d y protextil y la modificación se manda solo a Diseño 3d:
    - El modal mostrará las propuestas originales del vale de arte original (serían la de diseño 3d y protextil)
    - Se sobreescribirá toda propuesta que llegue como corección (en este caso, se sobreescribiría la de Protextil)
    - Al lado del label que indica el taller, se colocará un * (En este caso: Protextil*)
    Así será más cómodo para el encargado que fusione, ver todas las propuestas sumado a la corrección, así hace la fusión cómodamente. Siempre dejemos el hipervínculo de "Ver vale", me agrada que esté ahí

3. Actualmente, cuando se autoriza una modificación el vale de arte pasa a estado `MODIFICADO`, sin embargo, cuando lo marca como recibido el asesor no cambiar a `RECIBIDO`. Esto causa que el superisor cuando mire su trabajo realizado, le aparezca los vales MOD-... con estado `MODIFICADO` aun cuando estos ya han sido confirmados de `RECIBIDO`

4. Para el **Supervisor**, en el modal de `Ver info` al momento de presionar la acción de `Ver vale` no sale la informacipon de los talleres, el label si está pero siempre me sale el texto: "-". Arreglar esto, para que me salgan los talleres a los que se debe mandar el vale de arte

5. Actualmente, los **técnicos** pueden ver todos los estados del vale de arte en la pestaña de `Trabajo Realizado`. Hagamos que en su buzón vean sólamente los estados de: `ASINGADO`, `EN PROCESO`, `EN REVISIÓN`. Los `APROBADOS` solo se verán en la vista de `trabajo realizado`, agregar la acción de ver propuesta para este tipo de vales, ya que si se le aprobó el trabajo al técnico que siempre tenga la referencia para poder ver el vale de arte.

6. Crearemos una vista de Administrador. Actualmente el rol de administrador no hace nada bueno, por lo que crearemos una vista que sea similar a las instrucciones que te dejaré de último. Antes de crear esta vista, commitea y pushea todo lo que hagas con las correcciones 1-5. Ya luego, haces la vista administrador. La vista administrador reemplaza al dashboard SOLO para el administrador, quiere decir, el administrador ya no verá el dashboard con los módulos, verá el panel de administrador con las pestañas indicadas en **INSTRUCCIONES VISTA ADMINISTRADOR**.

## INSTRUCCIONES VISTA ADMINISTRADOR

## Pestañas del Panel de Administración — eventos_mt

> **Propósito de este documento**: describir, en términos puramente
> funcionales y de contenido, **qué hay y qué se puede hacer** en cada
> pestaña del panel de administración. No explica cómo funciona por
> dentro (sin permisos, código, endpoints ni base de datos) — es una guía
> de "qué encuentra un usuario al abrir cada sección", pensada para que
> cualquier agente de IA entienda el propósito de cada pantalla sin
> necesitar contexto técnico.

---

### Acceso al panel

El **sidebar** del rol de administrador tiene 6 pestañas, más un enlace 
de "Volver al inicio" para regresar al dashboard principal. 

Las pestañas, en el orden en que aparecen en el menú:

1. Gestionar Usuarios
2. Roles y Permisos
3. Actividad de Usuarios
4. Gestionar Categorías
5. Gestionar Tiendas
6. Modo Mantenimiento

---

### 1. Gestionar Usuarios

**Qué es**: el listado y la administración de todas las cuentas del
sistema (asesores, supervisores, administradores, gerencia, etc.).

**Qué muestra**:
- 4 tarjetas de resumen en la parte superior: Total de Usuarios, Activos,
  Inactivos y Roles en uso.
- Una tabla con buscador (por nombre, correo o rol) con las columnas:
  Nombre, Correo electrónico, Rol (con la tienda debajo, si aplica), Países
  asignados, Estado (Activo/Inactivo) y Acciones.

**Qué se puede hacer**:
- **Crear un nuevo usuario**: nombre completo, correo, contraseña, rol,
  tienda (para asesores/encargados de taller/técnico, una sola) o varias tiendas supervisadas (para el
  rol Supervisor).
- **Editar un usuario existente**: los mismos campos, con la contraseña
  opcional (se deja vacía si no se quiere cambiar).
- **Activar / Desactivar** una cuenta (no se puede desactivar la propia
  cuenta con la que se tiene la sesión abierta).

---

### 2. Roles y Permisos

**Qué es**: el catálogo de roles del sistema (Admin, Asesor, Supervisor, Supervisor/Gerencia, Gerencia, etc.) y qué puede hacer cada uno.

**Qué muestra**:
- 2 tarjetas de resumen: Roles Configurados y Permisos Disponibles.
- Una cuadrícula de tarjetas, una por rol, cada una con: nombre del rol,
  una etiqueta "Base" si es uno de los dos roles protegidos del sistema
  (Admin y Asesor), cuántos usuarios tienen ese rol, su descripción, y
  cuántos permisos tiene asignados.

**Qué se puede hacer**:
- **Crear un rol nuevo**, con nombre, descripción y la selección de
  permisos que tendrá.
- **Editar los permisos de cualquier rol** (incluidos Admin,
  aunque a ese no se le puede cambiar el nombre) desde un modal que
  lista todos los permisos disponibles agrupados por módulo y secciones, cada
  uno con su casilla individual y un botón para marcar/desmarcar todos los
  de una sección de una sola vez.
- **Eliminar un rol personalizado** (los roles base no se pueden eliminar,
  y uno con usuarios asignados tampoco se puede eliminar hasta
  reasignarlos).

---

### 3. Actividad de Usuarios

**Qué es**: un panel de presencia en vivo que muestra quién está
conectado al sistema en este momento y desde dónde.

**Qué muestra** (se actualiza automáticamente cada que se inicia sesión):
- 3 tarjetas de resumen: En línea ahora, Inactivos, Total de usuarios
  activos.
- Una tabla con las columnas: Nombre, Rol, Ciudad (de conexión), Estado
  (En línea / Inactivo / Sin datos), Conectado desde (hace cuánto inició
  sesión) y Última actividad (hace cuánto fue su última acción).

**Qué se puede hacer**:
- Es una pantalla de solo consulta — no tiene formularios ni acciones de
  edición. Sirve para ver, de un vistazo, quién está trabajando en el
  sistema en este momento y desde qué ciudad/país se conectó cada quien.

---

### 4. Gestionar Tiendas

**Qué es**: el catálogo de tiendas físicas usado por los módulos,
y el personal (asesores/supervisores/encargados de taller/técnicos) ligado a cada una.

**Qué muestra**:
- 2 tarjetas de resumen: Tiendas Activas y Tiendas Inactivas.
- Una tabla con las columnas: Orden, Tienda, País,
  Personal (nombres de quienes están ligados a esa tienda), Estado
  (Activa/Inactiva) y Acciones.

**Qué se puede hacer**:
- **Crear una tienda nueva**: código, nombre, país.
- **Editar una tienda existente**: los mismos campos, más marcarla
  activa/inactiva.
- **Gestionar el personal de una tienda**: desde un modal por tienda, ver
  quién está ligado a ella, agregar a alguien (cualquier rol) desde
  una lista de personas disponibles, o quitar a alguien de esa tienda.
- **Reordenar el catálogo de tiendas**: un modal dedicado ("Ordenar")
  donde se puede mover cada tienda hacia arriba o abajo con flechas y
  guardar el nuevo orden — ese es el orden en que las tiendas aparecen
  después en toda la pantalla de Gestión de Venta.

---

### 6. Modo Mantenimiento

**Qué es**: el interruptor para bloquear el acceso al sistema a todos los
usuarios que no sean administradores, típicamente mientras se aplican
cambios o actualizaciones.

**Qué muestra**:
- Un banner de estado grande que indica si el mantenimiento está
  **activo** (en rojo) o si el **sistema opera con normalidad** (en
  verde).
- Un campo de texto para el mensaje que verán las personas bloqueadas
  mientras el mantenimiento esté activo (si se deja vacío, se muestra un
  mensaje genérico).
- Una nota explicando que, mientras está activo, solo las cuentas
  administradoras pueden seguir usando el sistema; el resto ve una
  pantalla de aviso en su lugar.

**Qué se puede hacer**:
- **Activar el modo mantenimiento** (pide una confirmación explícita,
  porque bloquea de inmediato a cualquiera que ya tenga sesión abierta).
  Para esto que pida meter la contraseña del usuario de administrador, que 
  no baste con solo cambiar de posición el interruptor.
- **Desactivar el modo mantenimiento**, para devolver el acceso normal a
  todos.
