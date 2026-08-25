# ARCHIVO DE ARREGLO No. 7 AL MÓDULO DE: VALES DE ARTE

## DESCRIPCIÓN DE ESTE ARCHIVO

En este archivo, encontrarás las correcciones enumeradas como con normalidad. Pero, al final del documento habrá un análisis para una vista de gerencia. Dicho análisis explicará que debe verá el gerente y qué acciones podrá hacer.

## CORRECCIONES

1. Agregar contador de "Vales Modificados" para el encargado general (siempre tendrá la acción de filtro al presiona el contador)

2. Los vales los cuales sean aprobados para una modificación, quedarán en el registro de "Trabajo realizado" tanto para el asesor como para el supervisor pero con un estado de `MODIFICADO`. Actualmente, sí aparecen pero como `CONFIRMADO`. Si bien, estos sí fueron confirmados, recordemos que a partir de ellos se creo un nuevo vale, por lo que la realidad es que son MODIFICADOS.

3. Para el formulario de solicitación de modificación (el que hace el asesor) quitemos la posibilidad de poner etiquetitas de talleres. Esto será trabajo del encargado general, el verá a quién reenvía la modificación

4. Actualmente, cuando el encargado general sube el documento corregido (cuando ya recibió las correcciones de los talleres) el documento de corrección no solo se sube como propuesta, también se adjunta con el vale de arte de la modificación. Cuando el encargado general termina la corrección, no se debe adjuntar la propuesta corregida al vale de arte de la modificación

5. Sigue habiendo muy poco espacio para boceto y descripción. Mira, necesito que el tamaño actual que ocupa la cajita de cotización, le quites 1/5 de espacio horizontal, y en ese cachito que reduces la cajita de cotización pone ahí el campo de "FIRMA Y AUTORIZACIÓN"


## VISTA GERENCIA

Quiero hacer la distinción, de que esta vista no es una vista de administrador. Actualmente, tenemos una vista administrador que permite hacer de todo y de momento la mantendremos. Pero, me importa mucho la vista de gerencia, ya que, esta servirá para visualización de reportes y toma de decisiones.

Hasta este momento hemos tratado al sistema como si solo fuese una empresa local. Te comento, la empresa es a nivel centro americano, únicamente aquí en Guatemala es donde se tienen los talleres de: diseño, diseño 3d y protextil. Las demás tiendas a nivel internacional tienen su taller de diseño local (así se llama). Si bien, las sedes que están fuera del país pueden enviar un vale de arte a alguno de los talleres de Guatemala (puede ser por su complejidad) de normal los envían a su propio taller (diseño local). Es importante que hagamos esa modificación a la base de datos desde ya, porque el gerente va a poder ver métricas relacionadas con los vales y filtrarlas por las diversas tiendas. Al igual, que tendrá a su disposición la ventana de tiempo. 

Si lo analizamos bien, esta vista será similar a lo que ya se tiene, con la diferencia de que el gerente no podrá ejercer ninguna acción más que visualizar. Si queres, dejemos el sidebar con dos acciones:
	- Dashboard: acá abrá gráficas y porcentajes de los vales que se van entregando, cuantos se van atrasando, pone métricas ahí que consideras que pueden ser importantes
	- Vales de arte: la lista de los vales (respetar la jerarquía ya establecida)

Para gerencia lo más importante es ver los vales atrasados, ya que esto atrasa incluso procesos de fabricación

Creame el rol de gerente, y por ende un usuario.

