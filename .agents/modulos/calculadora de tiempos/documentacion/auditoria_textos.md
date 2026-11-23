# Calculadora de Tiempos — auditoría de textos

Revisión de todos los textos del mockup para que sean claros y útiles para quien promete un tiempo al cliente. Ya aplicada en Figma.

## Criterios
1. **Dicen qué hacer o qué significa**, no solo nombran: «Elige un producto para empezar», no «Sin datos».
2. **Números con unidad y contexto**: «11 días hábiles», «Cae en el rango de 101 a 250 piezas».
3. **Fechas completas** donde se promete algo: «martes 8 de diciembre de 2026».
4. **Una sola palabra por cosa**: «Pedido» (varias piezas), «Pieza», «Extras», «Borrador», «Versión».
5. **Las advertencias dicen qué hacer**: «Pide la autorización antes de prometer una fecha al cliente».
6. **Los avisos de error dicen cómo corregir**: «Cámbialo a 501 o más».
7. Tuteo, frases cortas, sin jerga interna.

## Cambios principales (antes → después)
| Dónde | Antes | Después |
|---|---|---|
| Subtítulo | Elige el producto y la cantidad: te damos los días y la fecha de entrega. | Elige el producto y la cantidad. Te decimos cuántos días hábiles tarda y qué día se entrega. |
| Versión | Tabla Ver. 5.0 | Tabla de tiempos v5.0 · 27/07/2026 |
| Cantidad | Rango 101 – 250 | Cae en el rango de 101 a 250 piezas |
| Colores | 2 (incluidos) · Del 3.º color: +1 día por cada 2 | 2 colores (incluidos) · Del 3.er color en adelante: +1 día por cada 2 colores |
| Fecha | Los días se cuentan desde el siguiente día hábil | Se cuenta desde el siguiente día hábil: el día de la orden no cuenta |
| Extras | Complementos | Extras que cambian el tiempo |
| UV | Suma días a la producción de la pieza | Agrega de 1 a 13 días según la cantidad |
| Urgente | Urgente · Requiere autorización del gerente | Pedido urgente · Lo autoriza el gerente; aquí verás los tiempos normales |
| Resultado | Tiempo al cliente | Tiempo para prometer al cliente |
| Fecha de entrega | Entrega estimada: miércoles 2 dic 2026 | Entrega: miércoles 2 de diciembre de 2026 |
| Cómo cuenta | Cuenta desde el martes 24 nov · lunes a viernes, sin festivos | Se cuenta desde el martes 24 de noviembre, de lunes a viernes y sin festivos |
| Desglose | Cómo se compone · Margen de seguridad | Qué incluye este tiempo · Margen por imprevistos |
| Aviso general | El tiempo no incluye la elaboración del arte interno… | No incluye el tiempo de diseño del arte interno. Está calculado para piezas de tamaño estándar y detalle medio. |
| Botones | Limpiar · Limpiar pedido | Empezar de nuevo · Empezar un pedido nuevo |
| Pedido | La más larga · Regla del pedido | Define la entrega · Cómo se calcula el pedido (las piezas se hacen al mismo tiempo, por eso la entrega es la de la que más tarda) |
| A convenir | A convenir · Cantidad fuera de la tabla (3001+) | Tiempo a convenir · Esta cantidad (3001 o más) no está en la tabla · Pregunta a producción… antes de prometerla al cliente |
| Urgente (aviso) | Urgente: requiere autorización del gerente | Pedido urgente: necesita autorización del gerente · La calculadora no acorta tiempos. Pide la autorización antes de prometer una fecha al cliente. |
| Referencia | Avisos de este producto | Antes de prometer, revisa |
| Admin | Edita los días por etapa… | Los cambios se guardan como borrador. Los usuarios los ven cuando publicas una versión nueva. |
| Admin | Guardar cambios · Versión 5.0 · vigente | Guardar borrador · Versión 5.0 · en uso |
| Admin | Cliente = piloto + fundición… | «Cliente» se calcula solo: suma de las etapas + 1 día de margen. No hace falta escribirlo. |

## Textos nuevos (pantallas agregadas)
- **Vacío:** «Elige un producto para empezar» con tres pasos.
- **Copiar resumen:** «Resumen copiado. Pégalo en la cotización o en el chat.» y el texto que se copia.
- **Quitar pieza:** «¿Quitar la pieza 3? … Los demás tiempos no cambian.»
- **Estados:** «Cargando la tabla», «No pudimos cargar la tabla», «No tienes acceso a esta calculadora», «Todavía no hay una tabla publicada».
- **Admin:** confirmaciones («¿Eliminar este rango?», «¿Descartar los cambios?», «¿Ocultar el producto?», «¿Descartar el borrador?») y errores con la corrección sugerida.

## Pendiente de definir con el dueño
- **Qué es cada etapa** (Piloto, Fundición, Fábrica, Ensamble, Diseño, Producción, Costura, Molde, Corte, 3D): una frase por etapa para mostrarla como ayuda junto al nombre.
