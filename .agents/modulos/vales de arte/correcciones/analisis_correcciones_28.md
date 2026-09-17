# Archivo No. 28 de Correcciones

1. Necesito aplicar un límite diario de vales de arte que pueden entrar al buzón del taller. Este límite es opcional, por lo que, algunos talleres lo tendrán y otros directamente no lo tendrán. Lo haremos de la siguiente manera:
    - En la misma tabla de `talleres` quiero que pongas una columna `limite_diario`
        * esta columna aceptará valores nulos
        * por default esta columna será nula
    - Los formularios de `gestión de talleres`, permitirán añadir esta restricción a alguno de los talleres y modificar el límite diario
    - Si se añade el límite diario a los talleres, no debe permitir que el límite sea menor a 3. Quiere decir, que si un taller optara por un límite diario tiene que ser mayor o igual a 3 vales por día  
    - Este límite diario **solo** afecta la fecha de entrega. La fecha de evento no tendrá límite diario.

    Surgirá la duda de cómo afecta esto al momento de crear vales de arte. Cuando el asesor desee crear vales de arte, al momento de escoger una fecha de entrega, en ese mismo calendario se le mostrará la cantidad de cupos disponibles para los días. Por lo tanto, un asesor no podrá meter un vale de arte un día que ya el taller haya alcanzado su límite diario, directamente que no lo deje seleccionar esa fecha. Eso obliga a los asesores a seleccionar otra fecha de entrega.  

    Este límite diario no afecta el ordenamiento y jerarquía actual designada para los vales de arte.  

    **Recuerda**, esto solo limita la cantidad de vales **entrantes** por día para el buzón del taller. **NO** afecta la cantidad de vales mostrados en su buzón. Tampoco agrega un nuevo contador o algo parecido a la vista de los encargados de taller. Mucho menos altera el flujo establecido de los vales de arte.  

    Usarás el diseño descrito en la carpeta de `pruebas`. Ahí, encontrarás una imágen guía y un prompt descriptivo del diseño.  

    Esta restricción no solo debe ser validad en el frontend, hay que validarla en el backend. No quiero que los asesores se pongan de curiosos a plicar truquitos para meter más vales.
