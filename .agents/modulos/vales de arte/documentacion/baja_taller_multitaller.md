# Baja de un solo taller en un vale multitaller

## Qué es
En un vale con 2 o más talleres, cuando un taller rechaza los adjuntos, el asesor dueño puede dar de baja **solo a ese taller** en vez de eliminar el vale completo. El vale sigue para los demás talleres.

## Por qué
Antes, si un asesor mandaba el vale a un taller equivocado y este rechazaba los adjuntos, la única salida era dar de baja todo el vale o esperar a que venciera el plazo (que borra el vale entero si ningún otro taller lo protege). Quitar el taller sobrante se hacía a mano en la base de datos.

## Reglas
- Solo el asesor dueño del vale (permiso `vales.dar_de_baja`).
- El taller debe estar en «Adjuntos rechazados» o «Adjuntos respondidos» (los mismos estados que permiten dar de baja el vale completo).
- El vale debe tener 2 o más talleres activos; con uno solo se usa «Dar de baja» del vale.
- No aplica a una solicitud de modificación (`MOD-`): se da de baja la solicitud completa.
- Se revalida bajo el candado del vale: si el taller verificó o respondió entretanto, la baja se rechaza con un mensaje claro.
- Efecto: la fila de `vale_talleres` queda con `activo = 0`, `vales.talleres_solicitados` se actualiza, el estado general se recalcula con la lógica normal (`_recalcularEstadoVale`) y se escribe una fila en `vale_historial`. No se borra el vale ni a los demás talleres.
- Avisos: el taller dado de baja, el asesor y sus supervisores reciben la notificación; los talleres que siguen (y quienes fusionan) solo refrescan la pantalla.
- No hace falta ningún script SQL.

## Cómo verificarlo a mano
1. Crear y autorizar un vale con 2 o más talleres; con el encargado de un taller, rechazar los adjuntos.
2. Como asesor dueño, abrir la ventana de adjuntos del vale: la tarjeta del taller rechazado muestra «Dar de baja a este taller».
3. Confirmar: el taller desaparece del vale, su encargado deja de verlo, el vale sigue en el buzón del asesor y de los otros talleres.
4. Si los talleres restantes ya estaban aprobados, el vale pasa a fusión (2 o más) o a confirmación del asesor (uno).
5. Comprobar que con un vale de un solo taller el botón no aparece y que otro asesor no puede hacerlo (error claro).
