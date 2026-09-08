# Archivo de correcciones No. 22

1. Me pasa lo siguiente, para centro américa tengo varios supervisores. Todos pueden autorizar creación o modificación, por lo tanto supongamos la siguiente situación: 
    - Supervisor 1, 2 y 3 presionan para autorizar la creación/modificación de un vale de arte
    - Se registra la acción del supervisor 2
    - Al supervisor 1 y 3 les sale un mensaje de error <-- OJO!  
  
  Después de este mensaje de error, quiero que ese vale de arte ya no salga en su buzón. Actualmente, la solución es actualizar la página, pero me gustaría que fuera automático.

2. Gerencia me acaba de avisar que no existe catálogo de productos ni de material. Quita la tabla de la DB, las columnas que las referencien, relaciones y cambia los campos del formulario de crear vale de arte a que sean de text fields y no combobox.

3. Quitemos los datos MOCK, vamos a levantar ahora una base de datos que tengo localmente. Ya puse las credenciales en el .env. Quiero, que me quites el fallback y mejor que lance una excepción o algún modal que me indique que hubo un fallo al levantar la base de datos. Ya no será necesario, en producción no me sirve un fallback.

# Análisis de Proyecto

Las reglas y lineamientos que debes utilizar como referencia se encuentran dentro de:

`.\\.agents\reglas`

Ahí encontrarás las reglas correspondientes a:

* Archivos SQL y diseño de la base de datos.
* Arquitectura del sistema.
* Autenticación mediante tokens JWT.
* Diseño y estructura de la UI.
* Implementación y calidad del código.
* Construcción y organización de módulos.

El objetivo es realizar una auditoría del proyecto tomando estas reglas como fuente principal de referencia.

Durante el análisis debes:

1. Revisar primero todas las reglas disponibles para comprender los criterios que debe cumplir el proyecto.

2. Analizar la estructura y el código actual del proyecto, identificando archivos, módulos, servicios, controladores, rutas, componentes y demás elementos que no estén alineados con las reglas.

3. Identificar inconsistencias entre diferentes partes del proyecto. No te limites a buscar errores de sintaxis o funcionalidad; también revisa problemas de arquitectura, organización, responsabilidades, nomenclatura, duplicación de lógica, seguridad, mantenibilidad y cumplimiento de los patrones establecidos.

4. Prestar especial atención a los archivos de `services`. Algunos actualmente son demasiado extensos, contienen comentarios innecesarios o de mala calidad y resultan difíciles de leer y mantener. Cuando las reglas lo permitan, deben ser refactorizados para mejorar su estructura, legibilidad, separación de responsabilidades y mantenibilidad, sin alterar innecesariamente su comportamiento.

5. Verificar que la implementación actual sea coherente con las reglas de autenticación mediante JWT, arquitectura, SQL, UI, implementación de código y construcción de módulos.

6. Determinar también si alguna de las reglas existentes está desalineada con la arquitectura o implementación actual del proyecto. No asumas que las reglas son necesariamente correctas. Si encuentras una regla que contradice otras reglas, genera una arquitectura innecesariamente compleja, no corresponde con la implementación actual o debería modificarse, debes señalarlo explícitamente en lugar de aplicar ciegamente dicha regla.

7. Diferenciar claramente entre:

   * Incumplimientos de las reglas.
   * Problemas de implementación que las reglas no contemplan.
   * Duplicación o código innecesario.
   * Problemas de arquitectura o diseño.
   * Reglas que deberían revisarse o modificarse.
   * Aspectos que ya cumplen correctamente las reglas.

8. No realices cambios arbitrarios únicamente por preferencias personales o por aplicar patrones de diseño innecesarios. Toda corrección debe estar justificada por una regla existente, una inconsistencia detectada o una mejora técnica claramente necesaria.

9. Antes de modificar código, analiza las dependencias entre los archivos afectados para evitar introducir inconsistencias en otros módulos.

10. Después de realizar el análisis, aplica las correcciones necesarias en los archivos que correspondan, priorizando:

    * Cumplimiento de las reglas.
    * Seguridad.
    * Consistencia arquitectónica.
    * Separación de responsabilidades.
    * Legibilidad.
    * Mantenibilidad.
    * Eliminación de código innecesario o duplicado.

Finalmente, documenta las conclusiones de la auditoría en:

`.\\.agents\modulos\vales de arte\documentacion\correcciones_22.md`

El documento debe servir como informe para que posteriormente yo y mi equipo podamos revisar las correcciones realizadas. **Pero** todavía no lleves a cabo el plan de acción, necesitamos verificar que es lo que vas a hacer.

En `correcciones_22.md` incluye, como mínimo:

* Problemas encontrados.
* Archivos afectados.
* Regla relacionada, cuando exista.
* Qué estaba incorrecto.
* Qué se corrigirá.
* Qué problemas quedarán pendientes y por qué.
* Reglas que consideres desalineadas o que deberían revisarse.
* Recomendaciones adicionales que consideres importantes.

No te limites a generar el documento: el propósito principal de esta tarea es analizar el proyecto y aplicar las correcciones necesarias. El documento debe reflejar lo que realmente encontraste y modificaste durante la auditoría.  
  
**Recuerda** aún no apliques las correcciones, déjanos validad primero.
