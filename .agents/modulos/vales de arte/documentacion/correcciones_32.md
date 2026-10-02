# Correcciones #32 — Orden del buzón por número de correlativo

Rama: `fix/orden-correlativo`.

## Problema

Al ordenar el buzón por la columna "Correlativo" (ASC/DESC), el servidor comparaba el texto completo (`valeBuzonService.obtenerBuzon`, `sortKey = 'correlativo'`). Eso ordena alfabéticamente por tienda e iniciales (`MTC-AL-100` antes que `MTC-AL-13`, y `MTC-AL-13` antes que `P13-CR-9`), no por el número del vale.

## Cambio

El correlativo es `{TIENDA}-{INICIALES}-{número}`, y el de una modificación lleva `MOD-` delante. Ahora el orden por correlativo compara el **número final** (`compararCorrelativos` en `valeBuzonService.js`):

- Se extrae el número del último segmento (`-(\d+)$`); los ceros a la izquierda de correlativos históricos (`GUA-3-0003`) no influyen.
- Un vale `MOD-` comparte número con su original (`MOD-MTC-AL-13` y `MTC-AL-13`): a igual número va primero el original y después el `MOD-`.
- Si el número es igual y los dos son del mismo tipo, desempata el texto completo, para que el orden sea estable.
- Un correlativo sin número al final (no existe hoy) se manda al final.
- Los demás criterios de orden (fecha de ingreso, entrega y evento) no cambian. DESC invierte el criterio completo.

Solo backend: el frontend ya envía `sortKey`/`sortDir` y muestra lo que el servidor devuelve.

## Verificación

Comparador probado con una lista mixta (`MTC-AL-2`, `GUA-3-0003`, `P13-CR-9`, `MTC-AL-13`, `MOD-MTC-AL-13`, `MTC-AL-100`) y, contra el servidor en desarrollo, `GET /api/vales?vista=trabajo&sortKey=correlativo&sortDir=asc|desc` con un encargado de taller: ASC empieza en `MTS-JV-6`, `MTC-MP-7`, `MOD-MTC-MP-7`, `MTC-MP-16`…; DESC empieza en `MTC-AL-181`, `MTC-AL-179`, `MTC-AL-144`…
