# Calculadora de Tiempos — plan de pruebas de caja negra

Se escribe **antes del código**, a partir de la tabla de referencia y de las reglas de `README.md`. Cada caso tiene su resultado esperado calculado a mano desde las imágenes de `referencias/`; cuando exista el motor, estos casos se convierten en `scripts/tiempos/verificar-*.js` (misma costumbre que los demás módulos) y se repiten a ojo en el navegador, en escritorio y a 390 px.

Los casos marcados **(supuesto)** dependen de una decisión aún abierta (ver README §6). Se corrigen cuando se decida.

## 1. Técnicas

| Técnica | Dónde se aplica |
|---|---|
| Clases de equivalencia | Cantidad (dentro de un rango, fuera de tabla, a convenir), colores, tamaño, tipo de producto. |
| Valores límite | Primer y último valor de cada rango y el siguiente. |
| Tabla de decisión | Complementos combinados (UV, costura, moldes, colores) y pedido con varias piezas. |
| Transición de estado | Pedido: vacío → una pieza → varias → pieza «a convenir» → pieza quitada. |
| Datos de la tabla | La carga inicial cumple las reglas de la propia tabla (§3). |
| Permisos y seguridad | Quién entra a qué (§6). |
| Interfaz | Escritorio, celular, teclado, errores visibles, copiar resumen (§7). |

## 2. Motor de cálculo (pruebas por servicio, sin interfaz)

Fórmula: **días al cliente = suma de etapas + complementos + 1**; pedido = **la pieza más larga**.

### 2.1 Valores límite de rangos
Piezas fundidas · «Antique sin color» (Piloto 2, Fundición 2, Fábrica 3, Ensamble 1):

| Cantidad | Esperado |
|---|---|
| 74 | Fuera de tabla: por debajo del mínimo (75). No calcula; avisa **(supuesto)**. |
| 75 | Rango 75–500: 2+2+3+1 = 8 → **9** al cliente |
| 500 | 9 |
| 501 | Rango 501–1000: 2+2+4+1 = 9 → **10** |
| 1000 | 10 |
| 1001 | Rango 1001–2000: 2+2+4+2 = 10 → **11** |
| 2000 | 11 |
| 2001 | Rango 2001–3000: 2+3+5+2 = 12 → **13** |
| 3000 | 13 |
| 3001 | «Tiempo a convenir»: sin días ni fecha |

Mundi · «Medallas, láminas, stickers y botones» (Diseño, Ensamble): 1 → 3 · 100 → 3 · 101 → 4 · 200 → 4 · 201 → 5 · 500 → 5 · 501 → 6 · 1000 → 6 · 1001 → a convenir.

Protextil · «Lanyard» (Producción, Costura): 49 → fuera de tabla (mínimo 50) · 50 → 7 (5+1+1) · 250 → 7 · 251 → 8 (6+1+1) · 1001 → 13 (9+3+1) · 2500 → 13 · 2501 → a convenir.

### 2.2 Entradas inválidas de cantidad
Vacío, 0, negativo, decimal (12.5), texto, espacios, número enorme (999999999999), `null`: ninguna calcula; cada una muestra un mensaje claro junto al campo y la API responde 400 (nunca 500).

### 2.3 Complementos (tabla de decisión)
| Caso | Esperado |
|---|---|
| «Antique con color» 300 pzas (75–500 = 2+2+5+1) | 10 → **11** |
| + UV Impresión 300 (251–500 = +3 a Fábrica) | 13 → **14** **(supuesto: el UV entra al cálculo)** |
| UV, límites: 75 → +2 · 250 → +2 · 251 → +3 · 500 → +3 · 501 → +5 · 1500 → +5 · 1501 → +7 · 3000 → +7 · 3001 → a convenir | |
| Colores: 1 y 2 → +0 · 3 → +1 · 4 → +1 · 5 → +2 · 6 → +2 · 7 → +3 | «a partir del tercero, +1 por cada 2 colores» |
| Fundición mayor a 3.5" | +2 días (moldes) |
| Pieza fundida con listón o lanyard cosido | Suma la costura de Protextil de la cantidad del listón o lanyard |
| Todos juntos (fundida con color 300, UV, 4 colores, 4", lanyard cosido 300) | Se suman todos los complementos en la misma pieza; el +1 se cuenta **una vez** **(supuesto)** |
| Vinil sin revestimiento (UV hoja 2): 300 → +1 · 301 → +2 · 600 → +2 · 601 → +3 · 1000 → +3 · 1001 → a convenir | |

### 2.4 Pedido con varias piezas
| Caso | Esperado |
|---|---|
| Pieza A = 11 días, pieza B = 8 días | Pedido **11** (la más larga) |
| Dos piezas iguales | Mismos días, no se duplican |
| Una pieza «a convenir» | El pedido completo es «a convenir» |
| Quitar la pieza «a convenir» | El pedido vuelve a calcularse |
| Pieza A 11 + otra sin cantidad | No calcula hasta completar; el mensaje señala cuál pieza |
| Pedido de 1 pieza | Igual que la calculadora simple |
| Máximo de piezas por pedido (propuesta: 20) | La 21 se rechaza con mensaje |
| Cada pieza se calcula con **su** cantidad, no con la suma de cantidades | Regla 8 de las observaciones |

### 2.5 Fecha de entrega (lunes a viernes, sin contar el día de la orden)
| Inicio | Días al cliente | Esperado |
|---|---|---|
| Lun 2026-11-23 | 9 | Vie **2026-12-04** |
| Vie 2026-11-27 | 1 | Lun 2026-11-30 |
| Sáb 2026-11-28 (orden en fin de semana) | 1 | Lun 2026-11-30 **(supuesto: el día 1 es el siguiente hábil)** |
| Cualquier inicio | «A convenir» | Sin fecha |
| Con feriados cargados (si se decide) | | Se saltan además de sábados y domingos |
| Cambio de año (inicio 2026-12-30, 5 días) | | Cuenta bien a enero |

## 3. Datos de la tabla (se prueban con la carga inicial)
Para **cada** producto de la carga inicial (unas 50 tablas):
1. Los rangos están en orden, sin huecos ni traslapes.
2. El último rango es «a convenir», sin días.
3. Los días son enteros, no negativos, y cada etapa pertenece al catálogo.
4. **«Cliente» de la imagen = suma de etapas + 1** (si alguna fila no lo cumple, se reporta como discrepancia de la tabla original, no se «corrige» sola).
5. Cantidad de productos, rangos y celdas = la de las imágenes (conteo manual, firmado por quien revisa).
6. Los avisos por producto (existencias, 8", molde nuevo) están en el producto correcto.

## 4. Administración de tablas
- Crear, editar, desactivar producto; **no se borra** un producto usado.
- Rangos traslapados, con hueco, desde > hasta, cantidad 0, días negativos o decimales → rechazados con mensaje.
- Cambiar días de un rango **no altera** cálculos ya copiados como texto.
- Nueva versión con fecha; solo una vigente; la anterior consultable.
- Cada cambio queda en historial (quién, qué, antes y después); el historial no se puede editar.
- Dos administradores guardan a la vez: gana el último y el otro recibe aviso de que la tabla cambió.
- Editar un producto muestra el cálculo de ejemplo antes de guardar (propuesta).

## 5. Estados y errores de la API
Cada ruta: 200 correcto · 400 datos inválidos (con el campo) · 403 sin permiso (nunca 401 por reglas de negocio) · 404 producto inexistente · sin mensajes crudos de MySQL. La identidad sale de la sesión, nunca del cuerpo o la URL.

## 6. Permisos y seguridad
| Quién | Esperado |
|---|---|
| Sin `tiempos.ver` | El módulo no aparece; la ruta y la API responden 403. |
| Con `tiempos.ver` | Calcula y consulta; **no** ve ni llama a administración (403). |
| Con `tiempos.administrar` | Todo. |
| Entradas con HTML o `<script>` en nombres de producto | Se escapan al mostrarse (sin ejecución). |
| Inyección SQL en cantidad o búsqueda | Sin efecto (consultas parametrizadas). |
| Límite de peticiones al calcular | Una ráfaga razonable no se bloquea; un abuso sí. |

## 7. Interfaz (escritorio y 390 px)
- Elegir línea → solo salen sus productos; cambiar de producto limpia lo que no aplica.
- Las opciones (UV, costura, tamaño, colores) aparecen solo donde aplican.
- Resultado: etapas, días al cliente y fecha; en «a convenir», aviso claro y sin fecha.
- «Copiar resumen» copia el texto completo (pieza, cantidad, etapas, días, fecha, avisos, versión de la tabla); funciona con teclado y avisa si el navegador lo bloquea.
- Pedido con varias piezas: agregar, editar y quitar; resalta la que determina la entrega.
- Teclado: todo alcanzable con Tab, foco visible, Enter calcula; lectores de pantalla anuncian el resultado.
- Celular: sin desplazamiento horizontal, botones de al menos 44 px, resultado visible sin esconderlo tras el teclado.
- Estados: cargando, sin datos, sin conexión (no pierde lo escrito).
- Tabla de referencia: búsqueda sin acentos ni mayúsculas, filtros por línea, sin resultados.

## 8. Regresión del portal
La instalación del módulo no cambia a los demás: el catálogo de módulos, los permisos de los roles existentes y la campana de notificaciones siguen igual; `ci:sintaxis`, `ci:migraciones` (escenarios A y B) y las verificaciones de los otros módulos siguen en verde; migración probada en MySQL 8.4 y MariaDB 11.8.

## 9. Criterio de aprobado
- Todos los casos de §2 y §3 pasan; los **(supuesto)** se vuelven definitivos antes de dar el módulo por terminado.
- Cero errores 500 en las pruebas de §2.2 y §5.
- Recorrido manual por rol (administrador, usuario con `tiempos.ver`, sin permiso) en escritorio y celular, sin errores en consola.
- Informe corto al final: cuántos casos, cuáles fallaron y qué se corrigió.
