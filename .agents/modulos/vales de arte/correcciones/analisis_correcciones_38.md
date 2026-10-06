1. Nuevo formato del correlativo del vale de arte. Pasa de `{TIENDA}-{INICIALES}-{id}` a:

    `{código de país de 2 letras}-{código de tienda}-{mes}{año}-{número}`

    Ejemplos: `GT-MTC-1026-1`, `SV-MTS-1125-15`.

    - El país es el país donde se encuentra la tienda: el de la empresa a la que pertenece (MTC es de Munditrofeos, y Munditrofeos es de Guatemala: `GT`).
    - El mes (`01` enero … `12` diciembre) y los dos últimos dígitos del año son los de la creación del vale: `1026` = octubre de 2026, `1125` = noviembre de 2025.
    - El número es un correlativo general del sistema: no se reinicia por mes ni por tienda y no se reutiliza.
    - Los vales ya creados conservan su correlativo. Los datos de prueba pueden quedar como queden.
    - No debería existir una tienda sin país; si ocurre, se muestra un error y no se crea el vale.
