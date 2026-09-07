# Archivo No. 19 de correcciones

En este archivo, lo que haremos es verificar que las correcciones No. 18 satisfagan las siguientes necesidades:  

1. Los supervisores administran los vales de arte de las tiendas asignadas

2. A los supervisores se le puede desagsignar tiendas y asignar nuevas tiendas

3. Los vales de arte creados por los asesores de ventas pueden ser:
	- Enviados a su taller de diseño local
	- Enviarlos a los talleres de Munditrofeos (comercialización y sala de ventas): (diseño, diseño 3d o protextil)

4. Un asesor de ventas **NO** puede enviar un vale de arte a diseño local combinado con algún taller de Munditrofeos. Ej: Diseño local y Protextil, eso **NO** se puede. O lo envía a diseño loca, o los envía a uno (o más) de los talleres de Munditrofeos

5. Cada taller tiene su encargado de taller, este es el encargado de administrar los vales de arte de **su** taller. Quiere decir, que el encargado de diseño local de SSV NO puede ver ni administrar los vales de arte de SAA, mucho menos alguno de MTC y MTS. Esto **aplica para TODOS los encargados**. A **excepción** de los encargados de los talleres de Munditrofeos, ellos sí administran los de MTC y MTS como uno solo. Esto es debido a que es una sola tienda física que tiene dos departamentos (comercialización y sala de ventas), pero ambos acuden a los mismos talleres

6. Los asesores de ventas trabajan físicamente en una tienda, quiere decir, que un asesor de SSV **NO** puede trabajar para CMY. Para los asesores, no aplica la misma regla de los encargados, de que los que trabajan para Munditrofeos trabajan tanto para MTC y MTS como uno solo. Los asesores **si** tienen esa división clara: asesores de ventas de comercialización (MTC) y asesores de ventas de sala de ventas (MTS).

7. La única manera de que un asesor de ventas trabaje en otra tienda será siendo desasignando de su tienda actual para asignarlo a alguna otra. Aun los de MTC y MTS, se tienen que desasignar para asignarlos a alguna otra. Esto es debido a que es físicamente imposible que un asesor de ventas trabaje para dos tiendas a la vez

8. Los técnicos, funcionan similar a los asesores de ventas. Ellos trabajan exclusivamente para el **TALLER**, y no pueden trabajar para **DOS TALLERES A LA VEZ**

9. Al momento de crear una tienda, se puede tener la disponibilidad de crear un nuevo departamento y/o subdivisión junto con la tienda o usar alguno existente. Si se usa alguno existente, tiene que ser de los departamentos que existen en el país

10. El asistente, existe únicamente para Munditrofeos y es un clon (mismos permisos) de alguno de los encargados de algún taller, en este caso, el asistente es clon del encargado del taller de diseño. Esto es una decisión de negocio, por lo que es importante que se puedan cambiar los permisos de este asistente. Ya que, hoy es clon del encargado del taller de diseño, sin embargo, en un futuro puede ser clon del encargado de protextil. **NUNCA** será clon de algún encargado de diseño local, porque él trabaja para Munditrofeos, las otras empresas NO tienen encargado NI tendrán

11. De momento, solo hay un encargado por taller. Esto permanecerá así por bastante tiempo según gerencia

12. Los encargados de taller funcionan igual que con los asesores, ellos ya administran un taller, por lo que NO pueden asignarse a algún otro taller. El encargado de diseño local de Premia z13 NO puede encargarse del taller de San José. Suponiendo que sí se pudiera, fuera desasignándolo y asignándolo a algún otro taller, eso es MUY IMPROBABLE en el negocio

13. Los cambios que busco con esto es que SOLO los supervisores pueden ser aquellos que administren muchas tiendas, de los contrario: 
	- Los encargados se encargan de **SU** taller
	- Los asesores envían los vales a **SU** taller de diseño local **O** al alguno(s) de los talleres de Munditrofeos
	- Los técnicos solo trabajen para **UN** taller
Porque actualmente el sistema me deja asignar el mismo técnico para dos talleres diferentes, y esos talleres puede ser que no estén en el mismo país, por lo que es imposible que esto suceda. Además, quiero que cada usuario **vea lo que tiene que ver**, porque no me sirve que un encargado de taller por ejemplo, pueda ver en su buzón vales de arte que son de algún otro taller.

14. El administrador **NO** es empleado de alguna tienda, es un rol que administra TODO el SISTEMA. Por lo que, **NO** debería poderse asignar como nu empleado de alguna tienda ni se debería mostrar

15. El rol de gerente tiene el dashboard de gerencia. Este rol es exclusivo para la generación de reportes. No tiene más acciones que las de: ver vale de arte (modal del supervisor -> ver info o ver vale), ver propuesta (si es que ya hay) y ver el historial.

16. El formulario de modificar usuario, cambia por rol, ya que ahora te das cuenta que algunos roles tienen más campos o diferentes campos que los otros

**NOTA**: Cuando digo *administran* me refiero a las acciones que ya hacen los roles y las vistas que ya tienen.