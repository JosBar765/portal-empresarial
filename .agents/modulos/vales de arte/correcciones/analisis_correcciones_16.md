# Archivo No. 16 de correcciones

1. En la vista de `Trabajo Realizado` de los **encargados**, aún me siguen apareciendo los vales que están pendientes de confirmación de recibido. Creo que aún no comprendes bien este funcionamiento:
    - El trabajo realizado es ver lo que han hecho los encargados: su **aprobaciones**
    - NO me improta si un vale posterior a ser aprobado, falta que sea confirmado. El encargado verá únicamente como aprobado. Aunque se confirme de recibido, aunque se solicite modificación, al encargado no le importa.    
    - Ejemplo:
        * Encargado apruba vale GUA-001-002
        * Asesor solicita modificación de vale GUA-001-002
        * Asesor confirma modificación de vale GUA-001-002
        * El vale se marca como confirmado
    Para **todo** esto, el encargado solo mira un único vale GUA-001-002 como `APROBADO`, y puede consultar su propuesta usando la acción de `Ver Propuesta`

2. El **punto 1** aplica exactamente igual para la vista de `Trabajo Realizado` de los **encargados**, ellos verán un historial del trabajo que han hecho y fue aprobado. No les importa ver los demás estados. Al momento de un encargado aprobar la propuesta enviada por el técnico, el técnico verá las propuestas aprobadas y podrá consultarlas usando la acción de `Ver Propuesta`

3. Quitar por completo los roles de diseñador y encargado general. Borralos, quita sus referencias y haz el ajuste de los IDs de los roles.

4. Sigue las instrucciones de **INDICACIONES ARCHIVOS SQL**

## INDICACIONES ARCHIVOS SQL

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

database/
├── schema.sql
├── seed.sql
└── mock.sql

Si consideras que los nombres pueden ser mejores, puedes proponerlos, pero mantén esta separación conceptual.

REGLAS IMPORTANTES:

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

LIMPIEZA DE COMENTARIOS:

Elimina TODOS los comentarios que sean historial de desarrollo, por ejemplo:

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

No quiero que el SQL final parezca un registro de commits o de conversaciones con otro desarrollador.

También elimina comentarios excesivamente largos que expliquen decisiones históricas que ya no son necesarias para entender el esquema.

SÍ puedes conservar comentarios extremadamente breves y técnicos cuando aporten valor permanente al esquema, por ejemplo:

-- Documento asociado al vale

Pero incluso esos comentarios deben ser mínimos. Si el nombre de la columna ya explica perfectamente su propósito, elimina el comentario.

También revisa los COMMENT dentro de columnas. Elimina los COMMENT que simplemente repitan información obvia o que contengan explicaciones históricas.

FORMATO:

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

---

-- 8. Módulo Vales de Arte

---

No quiero separadores gigantes ni encabezados innecesarios.

El resultado debe poder ser leído por otro desarrollador sin tener que conocer el historial del proyecto.

IMPORTANTE SOBRE LOS DATOS MOCK:

No los borres.

Muévelos a mock.sql.

Quiero poder tener una instalación limpia:

1. Ejecutar schema.sql → crea únicamente la estructura.
2. Ejecutar seed.sql → deja la BD en un estado inicial funcional.
3. Ejecutar mock.sql → agrega datos ficticios para desarrollo/demostración.

Por lo tanto, mock.sql debe poder ejecutarse DESPUÉS de schema.sql + seed.sql y respetar todas las Foreign Keys.

Si los datos mock actuales dependen de IDs específicos del seed, mantén esa dependencia de forma controlada y documenta únicamente lo estrictamente necesario en la carpeta de documentación, no en los comentarios.

VALIDACIÓN:

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

Al final del todo, quiero que hagas un archivo en: `.agents\reglas\` llamado `reglas_archivosSQL.md`. Donde documentes la estructura de los archivos SQL y las divisiones que se tienen que hacer para tener código más limpio y mantenible. El propósito de este archivo es mejorar la generación y organización de los archivos .SQL para no tener todo en un mismo script con comentarios inlegibles.