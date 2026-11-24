# Calculadora de Tiempos — carga inicial (Ver. 5.0)

Fuente: las dos imágenes de `referencias/`. Datos en `src/modules/tiempos/datos/tablaV5.js`; la carga la hace el servidor al arrancar si no hay ninguna versión (`cargaInicialService`), y `node scripts/tiempos/verificar-datos.js` comprueba los datos sin tocar la base.

## Qué se cargó
38 productos (173 rangos, 353 días por etapa), 3 líneas (Producción, Mundi, Protextil), 10 etapas, 3 tipos de UV (15 rangos), 5 reglas generales y los avisos. «Cliente» no se guarda: se calcula (etapas + 1 día).

## Comprobación
135 filas con «Cliente» impreso coinciden con la suma de las etapas + 1 día de margen.

## Diferencias con la tabla impresa (por confirmar)
| Dónde | Impreso | Cargado | Motivo |
|---|---|---|---|
| Piezas fundidas · Brillante con accesorio o giratoria, sin color · 1501–3000 | Fábrica 16 y Cliente 25 (la suma da 24) | Fábrica 17 (Cliente 25) | No coinciden entre sí; se respetó el Cliente impreso, que es el más largo. |
| Fotograbado · Vinil con revestimiento · segundo rango | «150 – 500» | 151 – 500 | El 150 ya está en el rango anterior (25–150). |
| Mundi · Plaquetas / Vidrio con lámina · último rango | «350+» | 351 en adelante | El 350 ya está en el rango anterior (201–350). |

## Para revisar fila por fila
Abrir `tablaV5.js` junto a las imágenes: cada producto trae sus rangos como `[desde, hasta, [días por etapa], cliente impreso]`.
