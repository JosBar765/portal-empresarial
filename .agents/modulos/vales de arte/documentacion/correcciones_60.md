# Correcciones 60 — Modificaciones: propuesta única, errores 403 y baja atómica

Rama: `fix/correcciones` (desde `dev`).

## Qué cambia

- **Propuesta original única:** al modificar un MOD (MOD2, MOD3…), `solicitarModificacion` ya no hereda las «Propuesta original» anteriores; el nuevo MOD lleva solo la del vale directamente modificado. Esas propuestas heredadas tampoco cuentan para el límite de documentos. Antes el MOD3 llevaba dos.
- **Errores de permiso en 403:** vale ajeno, asesor que no está a cargo del supervisor y rol sin permiso (corregir, solicitar modificación, dar de baja, reenviar, autorizar y rechazar) ahora usan `ErrorDeNegocio(..., 403)`. Los mensajes no cambian y los conflictos de estado siguen en 400. Nunca 401: `sessionGuard.js` lo toma como sesión vencida. El frontend no depende del 400 de estos casos.
- **Baja de un MOD atómica:** `eliminarValeConArchivos` delega en `valeRepository.eliminarYReabrirOriginal`, que borra el vale, reabre el original (`modificado = 0`) y escribe su historial en una transacción, con el original bloqueado (`FOR UPDATE` y lock de vale). Storage se borra solo tras el commit, sin tocar archivos compartidos con el original. Aplica a baja, vencimiento, rechazo y plazo de adjuntos.
- **Plazo de modificación pasada la hora máxima:** si la solicitud se hace desde la hora máxima del taller, cuenta como del siguiente día que recibe vales y desde ahí corren +1/+2/+3 días hábiles (`calendarioLaboral.diaDeSolicitud`). Fines de semana y feriados siguen sin contar. Antes solo se corría el piso de «hoy», así que +2/+3 no cambiaban.

## Por qué

Evitar PDFs de MOD con propuestas duplicadas, respuestas HTTP coherentes y que un fallo a mitad de la baja no deje el original sin poder modificarse ni un vale apuntando a archivos ya borrados.
