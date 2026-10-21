# Baja de un solo taller en un vale multitaller

## Qué es
En un vale con 2 o más talleres, cuando un taller rechaza los adjuntos, el asesor dueño puede dar de baja **solo a ese taller** en vez de eliminar el vale completo. El vale sigue para los demás talleres.

## Por qué
Antes, si un asesor mandaba el vale a un taller equivocado y este rechazaba los adjuntos, la única salida era dar de baja todo el vale o esperar a que venciera el plazo (que borraba el vale entero si ningún otro taller lo protegía). Quitar el taller sobrante se hacía a mano en la base de datos.

## Reglas
- Solo el asesor dueño del vale (permiso `vales.dar_de_baja`).
- El taller debe estar en «Adjuntos rechazados» o «Adjuntos respondidos» (los mismos estados que permiten dar de baja el vale completo).
- El vale debe tener 2 o más talleres activos; con uno solo se usa «Dar de baja» del vale.
- No aplica a una solicitud de modificación (`MOD-`): se da de baja la solicitud completa.
- Se revalida bajo el candado del vale: si el taller verificó o respondió entretanto, la baja se rechaza con un mensaje claro.
- Efecto: la fila de `vale_talleres` queda con `activo = 0`, `vales.talleres_solicitados` se actualiza, el estado general se recalcula con la lógica normal (`_recalcularEstadoVale`) y se escribe una fila en `vale_historial`. No se borra el vale ni a los demás talleres.
- Avisos: el taller dado de baja, el asesor y sus supervisores reciben la notificación; los talleres que siguen (y quienes fusionan) solo refrescan la pantalla.
- No hace falta ningún script SQL.

## Baja automática al vencer el plazo
Cuando vence el plazo de adjuntos de un taller (`vale_talleres.adjuntos_vence_en`) que sigue en «Adjuntos rechazados», `adjuntosWatcher.js` (cada 60 s) reutiliza esta misma baja con el sistema como actor, sin comprobar dueño:
- Vale con 2 o más talleres activos: se da de baja **solo** a ese taller (uno por uno, releyendo las filas activas), aunque otro taller ya haya aceptado el vale o esté en «Adjuntos respondidos». Antes se borraba el vale o no pasaba nada.
- Si el taller vencido es el **último activo** (también tras bajas previas del mismo ciclo), se borra el vale completo como siempre. Un vale de un solo taller y las solicitudes `MOD-` no cambian.
- El aviso del 25 % del plazo se envía siempre en un vale multitaller («… si no, ese taller se dará de baja del vale»); en un vale de un taller o `MOD-` sigue igual.
- La baja se revalida bajo el candado: si el asesor respondió entretanto, no se hace nada.
- Historial: `vale_historial.usuario_id` es obligatorio, así que se registra el asesor dueño con el texto «… (automático)». Notificación de tipo `TALLER_DADO_DE_BAJA_AUTOMATICA` al taller, al asesor y a sus supervisores; los demás talleres solo refrescan.
- Límite conocido: si el taller rechaza otra vez con el plazo ya vencido, la siguiente pasada lo da de baja de inmediato (el plazo no se reinicia).

## Cómo verificarlo a mano
1. Crear y autorizar un vale con 2 o más talleres; con el encargado de un taller, rechazar los adjuntos.
2. Como asesor dueño, abrir la ventana de adjuntos del vale: la tarjeta del taller rechazado muestra «Dar de baja a este taller».
3. Confirmar: el taller desaparece del vale, su encargado deja de verlo, el vale sigue en el buzón del asesor y de los otros talleres.
4. Si los talleres restantes ya estaban aprobados, el vale pasa a fusión (2 o más) o a confirmación del asesor (uno).
5. Comprobar que con un vale de un solo taller el botón no aparece y que otro asesor no puede hacerlo (error claro).
