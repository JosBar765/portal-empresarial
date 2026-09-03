# Archivo No. 16 de correcciones

1. En el modal de `Revisar propuesta`, hay un combobox que se usa para reasignar a alguien más el vale de arte. Así como la asignación, que el encargado puede asignarse a sí mismo el vale de arte. En la reasignación también tenga la posibilidad de asignarle el vale da arte a alguien más o a él mismo.

2. Para los **encargados**, pasa lo siguiente:
    - les llega un vale de arte autorizado a su buzón
    - el encargado se lo asigna a sí mismo
    - el encargado comienza el proceso de realización del vale de arte
    - el encargado pausa el proceso <-- OJO!   
    En esta parte, al momento de pausarlo por PRIMERA VEZ, el vale de arte desaparece de la vista del buzón. Reaparece al recargar la página. No sé a qué se deba este error.

3. Para los **encargados**, pasa lo siguiente:
    - les llega un vale de arte autorizado a su buzón
    - el encargado se lo asigna a sí mismo
    - el encargado comienza el proceso de realización del vale de arte
    - el encargado pausa el proceso   
    - el encargado reanuda el proceso y sigue trabajando  
    Hasta acá todo bien, el problema es en la acción `historial` y los logs que muestra. Por ejemplo, si el encargado lo pone en pausa me sale el siguiente mensaje:

    ```text
    ...
    03/09/2026 09:00 Encargado de: Técnico marcó el vale como en proceso
    03/09/2026 09:00 Encargado de: Técnico pausó el proceso
    03/09/2026 09:00 Encargado de: Técnico reanudó el proceso
    03/09/2026 09:00 Encargado de: Técnico pausó el proceso
    ...
    ```

    Nota como me dice `Técnico`, pero, en realidad es el encargado el que anda poniendo pausa y reanudando. ya que, se lo asignó a sí mismo. 
    Ojo, esos logs están correctos para cuando se asignó a un técnico en específico la tarea. Pero, para cuando el encargado es el que tiene que realizar el vale de arte, el que realiza las acciones es el encargado.

4. Actualmente, el encargado de taller que se encargue de realizar la fusión, en `Trabajo Realizado` debe ser capaz de ver:
    - La fusión final de las propuestas
    - La propuesta que el llegó a hacer (si es que el la realizó)   
      
    Actualmente pasa lo siguiente:
    - Supongamos un vale de arte que llega para dos talleres: diseño y protextil.
    - El encargado de diseño se asigna a sí mismo el vale de arte
    - Realiza la propuesta del vale de arte
    - En `Trabajo Realizado` puede ver la propuesta que realizó para ese vale de arte
    - El encargado de protextil se asigna a sí mismo el vale de arte
    - Realiza la propuesta del vale de arte
    - En `Trabajo Realizado` puede ver la propuesta que realizó para ese vale de arte
    - Ahora, el encargado de diseño recibe el vale de arte `APROBADO POR TALLERES`. Listo para fusionar
    - El encargado de diseño fusiona <-- OJO!    
      
    Para este punto, el encargado de diseño (actual encargado de la fusión) debería poder ver ambos registros:
    - La fusión
    - La propuesta que realizó    
      
    Y la acción de `Ver Propuesta` muestra la propuesta individual de cada vale. Quiere decir, que para la fusión la propuesta que debería ver es la fusión. Y para la propuesta que realizó por parte de su taller.  
      
    Sin embargo, actualmente el sistema lo que muestra es únicamente la fusión. Cuando si necesito los dos registros. Recordá, que esto también aplica para los vales MOD: mostrar fusión y la propuesta de modificación.  
      
    Aplica las correcciones necesarias para que estos dos registro funcionen.

5. En la vista de `Trabajo Realizado` de los **encargados**, aún me siguen apareciendo vales de otros estados tales y como: `RECIBIDO` y `PENDIENTE DE CONFIRMACIÓN`. Creo que aún no comprendes lo que debe mostrar esta pestaña:
    - El trabajo realizado es ver lo que han hecho los encargados: su **aprobaciones**
    - NO me improta si un vale posterior a ser aprobado, falta que sea confirmado de recibido, es recibido, se solicita una modificación, lo que sea. El encargado verá únicamente un registro del vale de arte como `APROBADO`. `Trabajo Realizado` actúa como un récord histórico de las aprobaciones hechas por el encargado.
    - Ejemplo:
        * Asesor crea un vale de arte GUA-001-002
        * Supervisor autoriza GUA-001-002
        * Encargado recibe el vale GUA-001-002
        * El vale es trabajado por un técnico o por el mismo encargado GUA-001-002
        * Encargado aprueba la propuesta para el vale GUA-001-002
        * Asesor solicita modificación de vale GUA-001-002
        * Asesor confirma modificación de vale MOD-GUA-001-002
        * El vale GUA-001-002 se marca como recibido de nuevo  
          
    **Desde el momento** que el vale es aprobado por el encargado, él en la vista de `Trabajo Realizado` solo mira un único vale GUA-001-002 como `APROBADO`, y puede consultar la propuesta que aprobó para ese vale usando la acción de `Ver Propuesta`. Él no ve otro registro con el mismo correlativo para ningún estado. La única excepción, será el nuevo registro que se creará en base a la corrección número 4 de este documento, el registro de propuesta del vale fusionado.   
    Para este caso si pueden haber dos registros del mismo correlativo, pero se tienen que indicar al lado del número de correlativo cuál es de fusión (F) y cuál es de propuesta (P). Este indicativo también se da mediante un tooltip al hacer hover sobre el correlativo.

6. El **punto 5** aplica exactamente igual para la vista de `Trabajo Realizado` de los **técnicos**, ellos verán un historial del trabajo que han hecho y fue aprobado por sus encargados. Siempre el técnico podrá ver las propuestas aprobadas usando la acción de `Ver Propuesta`.

7. Quiero que elimines COMPLETAMENTE los siguientes roles de la base de datos:
    - Encargado general
    - Diseñador  
      
    Haz el ajuste de IDs para que sigan la secuencia.

8. Quiero que elimines los siguientes usuarios:
    - Diseñador Creativo
    - Asesor comercial
    - Supervisor de ventas  
      
    Estos eran los usuarios que usamos para ir probando el funcionamiento del sistema. Ahora, ya tenemos usuarios de asesores y supervisores, por lo que estos usuarios genéricos ya no son de utilidad.

9. Sigue las instrucciones de **INDICACIONES ARCHIVOS SQL**

---

### INDICACIONES ARCHIVOS SQL

Quiero que limpies y reorganices el/los scripts SQL de este proyecto. NO quiero que rediseñes la base de datos ni cambies su comportamiento. El objetivo es únicamente dejar el SQL profesional, ordenado y mantenible.

Primero analiza COMPLETAMENTE el SQL actual y determina qué partes corresponden a:

1. ESQUEMA DE BASE DE DATOS

   * CREATE DATABASE / USE, si existen.
   * CREATE TABLE.
   * Claves primarias.
   * Claves foráneas.
   * Índices.
   * UNIQUE.
   * ENUM.
   * Constraints.
   * Defaults.
   * Triggers, procedures, views, etc., si existen.
   * Cualquier otro objeto estructural de la base de datos.

2. DATOS SEMILLA / SEED
   Conserva aquí únicamente los datos mínimos y legítimos que la aplicación necesita para funcionar correctamente desde una instalación limpia.

   Ejemplos:

   * Roles.
   * Estados o catálogos necesarios.
   * Países/departamentos/subdivisiones si realmente son datos base del sistema.
   * Catálogos utilizados por la aplicación.
   * Usuarios iniciales únicamente si son necesarios para poder iniciar sesión por primera vez.

   Los datos seed deben ser genéricos y representar datos reales de configuración del sistema, NO escenarios de demostración.

3. DATOS MOCK / DEMO
   Identifica todos los INSERT, UPDATE u otras operaciones que existan únicamente para:

   * Probar funcionalidades.
   * Simular flujos.
   * Crear vales ficticios.
   * Simular aprobaciones.
   * Simular modificaciones.
   * Simular historiales.
   * Poblar dashboards.
   * Crear usuarios ficticios para probar roles.
   * Crear documentos/propuestas ficticias.
   * Hacer backfill de datos únicamente para que una pantalla de demostración tenga información.
   * Cualquier dato relacionado con pruebas, análisis de correcciones o escenarios específicos.

   NO mezcles estos datos con el seed.

Quiero que generes una estructura limpia, preferiblemente:

```text
database/
├── schema.sql
├── seed.sql
└── mock.sql
```

Si consideras que los nombres pueden ser mejores, puedes proponerlos, pero mantén esta separación conceptual.

#### REGLAS IMPORTANTES:

* NO cambies nombres de tablas.
* NO cambies nombres de columnas.
* NO cambies tipos de datos.
* NO cambies relaciones.
* NO agregues tablas que no existan.
* NO elimines columnas ni relaciones que actualmente sean utilizadas por la aplicación.
* NO cambies IDs, FK, índices o constraints simplemente por "mejorarlos".
* NO hagas refactors del modelo de datos.
* NO cambies lógica de negocio.
* NO inventes datos nuevos salvo que sea estrictamente necesario para completar un seed funcional.
* Conserva el orden correcto de creación de tablas para respetar dependencias entre Foreign Keys.
* Conserva el orden correcto de INSERTs en seed.sql y mock.sql para respetar Foreign Keys.
* Si algún dato no está claro si es seed o mock, analiza primero cómo lo utiliza el código de la aplicación antes de decidir.
* Busca referencias en backend, frontend, repositories, services y controllers para determinar si un dato es realmente necesario para el funcionamiento del sistema.
* Si encuentras datos que parecen haber sido agregados únicamente durante desarrollo o correcciones, clasifícalos como mock salvo que el código demuestre que son necesarios como configuración inicial.
* NO ejecutes DELETE destructivos sobre una base existente.

#### LIMPIEZA DE COMENTARIOS:

Elimina TODOS los comentarios que sean historial de desarrollo, por ejemplo:

```text
-- analisis_correcciones_12.md #12
-- desde analisis_correcciones_3.md
-- Backfill de demostración
-- vale de demostración recién creado
-- se agregó...
-- se quitó...
-- corrección...
-- fix...
-- análisis...
-- prueba...
-- temporal...
-- para poblar...
-- para probar...
-- reemplaza...
-- según análisis...
```

No quiero que el SQL final parezca un registro de commits o de conversaciones con otro desarrollador.

También elimina comentarios excesivamente largos que expliquen decisiones históricas que ya no son necesarias para entender el esquema.

SÍ puedes conservar comentarios extremadamente breves y técnicos cuando aporten valor permanente al esquema, por ejemplo:

```text
-- Documento asociado al vale
```

Pero incluso esos comentarios deben ser mínimos. Si el nombre de la columna ya explica perfectamente su propósito, elimina el comentario.

También revisa los COMMENT dentro de columnas. Elimina los COMMENT que simplemente repitan información obvia o que contengan explicaciones históricas.

#### FORMATO:

Quiero SQL limpio, consistente y profesional.

Usa una convención uniforme para:

* Indentación.
* Mayúsculas/minúsculas de keywords SQL.
* Orden de columnas.
* Foreign Keys.
* Índices.
* INSERTs.
* Separación entre bloques.

Evita comentarios decorativos como:

```text
---

-- 8. Módulo Vales de Arte

---
```

No quiero separadores gigantes ni encabezados innecesarios.

El resultado debe poder ser leído por otro desarrollador sin tener que conocer el historial del proyecto.

#### IMPORTANTE SOBRE LOS DATOS MOCK:

No los borres.

Muévelos a mock.sql.

Quiero poder tener una instalación limpia:

1. Ejecutar schema.sql → crea únicamente la estructura.
2. Ejecutar seed.sql → deja la BD en un estado inicial funcional.
3. Ejecutar mock.sql → agrega datos ficticios para desarrollo/demostración.

Por lo tanto, mock.sql debe poder ejecutarse DESPUÉS de schema.sql + seed.sql y respetar todas las Foreign Keys.

Si los datos mock actuales dependen de IDs específicos del seed, mantén esa dependencia de forma controlada y documenta únicamente lo estrictamente necesario en la carpeta de documentación, no en los comentarios.

#### VALIDACIÓN:

Antes de terminar:

1. Busca en todo el proyecto referencias a las tablas y columnas para asegurarte de que no eliminaste accidentalmente algo utilizado por la aplicación.
2. Comprueba que todas las Foreign Keys sigan siendo válidas.
3. Comprueba que el orden de creación de tablas sea correcto.
4. Comprueba que seed.sql pueda ejecutarse sobre una BD recién creada.
5. Comprueba que mock.sql pueda ejecutarse después de seed.sql.
6. Comprueba que no queden INSERT/UPDATE de demostración dentro de schema.sql.
7. Comprueba que no queden comentarios de historial de desarrollo.
8. Comprueba que no haya datos mock escondidos en seed.sql.
9. Busca también INSERTs, UPDATEs, procedimientos, triggers o cualquier otro mecanismo que pueda estar generando o modificando datos de prueba.
10. Si tienes acceso a ejecutar MySQL, valida sintaxis y dependencias. Si no puedes ejecutarlo, realiza una validación estática exhaustiva.

NO quiero solamente que me expliques qué cambiarías.

Quiero que HAGAS LA LIMPIEZA directamente sobre los archivos del proyecto.

Al finalizar, muéstrame:

* Qué archivos SQL quedaron.
* Qué contenía cada uno.
* Qué datos clasificaste como seed.
* Qué datos clasificaste como mock/demo.
* Qué comentarios de historial eliminaste.
* Cualquier caso ambiguo que hayas encontrado.
* Cualquier cambio que hayas considerado necesario para mantener las Foreign Keys funcionando.

Y, sobre todo, NO MODIFIQUES LA LÓGICA DE LA APLICACIÓN. El objetivo de esta tarea es ordenar y limpiar el SQL existente, no rediseñarlo.

#### DOCUMENTACIÓN

Al final del todo, quiero que hagas un archivo en: `.agents\reglas\` llamado `reglas_archivosSQL.md`. Donde documentes la estructura de los archivos SQL y las divisiones que se tienen que hacer para tener código más limpio y mantenible. El propósito de este archivo es mejorar la generación y organización de los archivos .SQL para no tener todo en un mismo script con comentarios inlegibles.