# ARCHIVO DE ARREGLO No. 14 AL MÓDULO DE: VALES DE ARTE

1. Actualmente, el permiso de `Trabajar Vales` permite trabajar los vales, pero, supongamos se lo activo a un encargado de taller. El encargado de taller debe ser capaz de poderse asignar a sí mismo el vale de arte. Claro, como él es el que reliza la tarea no pasa por su revisión. Modifica el permiso para que **si el encargao de vales de arte se asigna a sí mismo un vale de arte, pueda trabajarlo** como es él mismo encargado que realiza la tarea, no para por un período de aprobación

2. En la vista administrador, el cambio de contraseña para el administrador no debe ser permitido.

3. En la pestaña de `Gestionar tiendas` que haya mejor una acción para ver el personal, que no se liste todo. Que esta acción abra un modal mostrando al personal divido por categoría

4. En la pestaña de `Gestionar tiendas` y la acción de `Gestionar personal`, el combobox de `Agregar Personal` cambiemoslos por un menù contextual que permita categorizar al personal por rol

5. En la pestaña de `Gestionar roles` que no permita borrar el rol, que lo desactive

6. En la pestaña de `Gestiòn de usuarios` permita filtrar por tienda y por rol

7. En la pestaña de `Actividad de usuarios` permita filtrar por tienda y por rol

8. En la pestaña de `Gestiòn de usuarios` y la acciòn de `Nuevo usuario` en el combobox de `Tienda` que sea un menù contextual que permita categorizar por paìs.

9. En el tema de los roles, el rol de `Asesor Comercial` dice "Base" no sé que es eso quitale eso de rol Base. Según entiendo es algo que no permite modificar, y el único que tiene esa posibilidad es el rol de Admin

10. Modifiquemos el flujo del rol de los `Técnicos`, necesito que los técnicos puedan pausar el proceso de un vale de arte. Aplica las siguientes reglas:
    - Un técnico puede comenzar a trabajar un vale de arte
    - El técnico solo puede trabajar un vale de arte a la vez, quiere decir que si hay un vale de arte en proceso no pueda poner otro en proceso si no pone el que está trabajando en pausa o lo termina
    - La pausa genera un log, de que lo pausó. Lo mismo al reanudar el prceso
    - La pausa no exige una propuesta
    Esto sucede ya que me contaban que aveces los técnicos andan trabajando algo complicado, pero llega algo más fácil y pausan el trabajo para continuar con otro vale de arte y sacarlo, luego reanudan su trabajo

11. Actualmente hay un bug, no sé si pasa debido a algún permiso o por culpa de un rol, pero en la vista de `Trabajo Realizado` del `Encargado de Taller` me pasa que el encargado puede ver los vales recibidos, èl solo deberìa poder ver los aprobados, recordemos que en trabajo realizado ve sus aprobaciones o en su defecto los vales que èl realiza.