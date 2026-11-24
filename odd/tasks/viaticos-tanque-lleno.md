# Viáticos: tanque lleno

Rama: `feat/viaticos-tanque-lleno` (desde `dev` con la PR #209 fusionada). Migración: `56_viaticos_tanque_lleno`.

## Objetivo
Algunos pilotos reciben la panel con el tanque lleno y solo se les paga la diferencia de galones. Ejemplo: ruta de 14 galones y tanque de 8 galones: se pagan 6 galones.

## Reglas (decididas con el dueño)
- El vehículo tiene `capacidad_tanque_galones` opcional (Configuración → Vehículos): unos salen con el tanque lleno y otros piden viáticos completos.
- La solicitud de más de 1 día tiene la casilla «Sale con el tanque lleno». Solo se ofrece si el vehículo elegido tiene capacidad.
- Galones a pagar = `max(0, galones de la ruta − capacidad)`, calculado exacto antes de redondear; el importe es esos galones × precio por galón. Si la capacidad cubre la ruta, el combustible es 0.
- Marcada la casilla y sin capacidad en el vehículo: error explicativo (qué configurar).
- La solicitud guarda `tanque_lleno` y la capacidad vigente al crearla (`capacidad_tanque_galones`), para que cambiar el vehículo después no altere PDF, liquidación ni reportes.
- Las solicitudes existentes no cambian (`tanque_lleno` = 0).
- El viaje de 1 día o menos no aplica.
- El PDF muestra la fórmula con el descuento del tanque.

## Alcance autorizado
Backend, frontend y docs del módulo viáticos, y la migración 56. Sin tocar otros módulos.

## Tareas
- [x] T1 Migración 56 (vehículos y solicitudes) y vehículo: servicio, repositorio, catálogo de la solicitud y formulario de Configuración.
- [x] T2 Cálculo: `calcularCombustible` con tanque lleno y sus 5 llamadores (cálculo, validación y guardado, liquidación, reportes, PDF) y persistencia.
- [x] T3 Formulario de solicitud: casilla, payload, modificar y borradores (ambas direcciones).
- [x] T4 Docs: `modelo_datos.md`, `contrato_api.md`, README.
- [x] T5 Verificación: `node --check`, fórmula (14/8 → 6, capacidad mayor → 0), API `calcular` y crear 400 sin capacidad. Sin probar: PDF, liquidación, reportes y formulario en el navegador.

## Ruta y evidencia
Exploración delegada (mapeo de más de 5 consultas): fórmula en `calculoService.js:18`; llamadores en `calculoService`, `liquidacionCalculoService`, `reporteCalculoService`, `solicitudPdfService`; solo `rendimiento_km_galon`, `precio_galon` y `total_solicitado` se persisten, galones e importe se recalculan. Implementación: un escritor delegado (más de 2 archivos no triviales). Sin runner de pruebas: RED/GREEN no aplica; se verifica con scripts de un solo uso y la API.

## Progreso
- T1 a T4 escritas por el escritor delegado (sin commits todavía). Verificado: `node --check` en los 23 .js tocados; script de un solo uso sobre `calcularCombustible`: ruta 14 gal con capacidad 8 paga 6 gal (importe 180 con precio 30), capacidad 20 paga 0, sin tanque lleno igual que antes (420 y 238.87), caso fraccionario 215 km / 30 / capacidad 5 redondea una sola vez (72.22).
- Migración 56 aplicada en la base local. API probada (cuenta de desarrollo, vehículos temporales borrados): sin casilla igual que antes; ruta 14.33 gal con capacidad 8 paga 6.33 gal (importe 190); capacidad mayor que la ruta paga 0; casilla sin capacidad en el vehículo: 400 explicativo en `tanqueLleno` (calcular y crear).
- Pendiente de probar: PDF, liquidación, reportes y formulario en el navegador (la casilla reutiliza `vi-ayuda`, sin CSS propio).

# Ampliación: registro de pilotos (misma rama, a pedido del dueño)

Los supervisores tramitan los viáticos de sus pilotos (repartidores); hoy el sistema valida la licencia del supervisor y el PDF no dice quién maneja. Los pilotos no son usuarios del portal.

## Reglas (decididas con el dueño)
- Tabla propia `viaticos_pilotos` (nombre, tipo de licencia, número, vencimiento, activo); no se crean usuarios. Se desactivan, no se borran. Se administran en Configuración → «Pilotos» (permiso `viaticos.configurar`).
- Registro compartido: cualquier solicitante con `viaticos.ver` elige entre todos los pilotos activos (la asignación supervisor→pilotos queda para después, si hace falta).
- Campo «Conductor» en la solicitud (ambas modalidades): «Yo» (por defecto) o un piloto. Solo se muestra si hay pilotos activos. Con piloto elegido: franja «Tramitando para: <nombre>», y la licencia que se valida es la del piloto (mismas reglas de placa y vigencia; la que vence durante el viaje es advertencia); la licencia del solicitante no se exige. El solicitante sigue necesitando países en Personas.
- `viaticos_solicitudes.piloto_id` (NULL = maneja el solicitante). Modificar y borradores lo conservan.
- PDF y detalle: «Solicitante: <supervisor> · Conductor: <piloto> (licencia, número)».
- Migración 57.

## Progreso de la ampliación
- T6 a T9 escritas por el escritor delegado (sin commits). Verificado: `node --check` en los 26 .js tocados (los del front copiados a .mjs); script de un solo uso sobre `erroresDeLicencia` y `evaluar`: piloto con licencia válida sin errores; tipo que no sirve para la placa, error en `vehiculoId` que nombra al piloto; licencia vencida, error en `pilotoId`; por vencer durante el viaje, advertencia `licencia` con el nombre del piloto; piloto inexistente o desactivado, error en `pilotoId`; sin piloto, las reglas del solicitante quedan igual (faltante, vencida, no sirve, por vencer).
- Decisiones: el catálogo trae por piloto `bloqueos` (vehículo -> motivo) para que el formulario deshabilite los vehículos que la licencia del piloto no permite; el campo «Conductor» vive dentro de la sección de vehículo de ambas modalidades; si el piloto elegido deja de estar activo, el formulario vuelve a «Yo». No se tocó la lista ni el detalle de Gestiones (el PDF sí muestra «CONDUCTOR»); `viaticos_movimientos` no registra al conductor.
- Pendiente (T10): aplicar la migración 57 en la base local, probar la API (CRUD, calcular, crear, modificar, borrador) y el formulario y la pestaña «Pilotos» en el navegador; el PDF con conductor tampoco se ha generado aún.

## Tareas
- [x] T6 Migración 57 + CRUD de pilotos (servicio, repositorio, rutas, validación) y catálogo de la solicitud con los pilotos activos.
- [x] T7 Validación de la solicitud con el piloto como conductor (licencia, vigencia, salvedad) y guardado de `piloto_id`.
- [x] T8 Front: subpestaña «Pilotos» en Configuración y campo «Conductor» en el formulario (payload, modificar, borradores en ambos sentidos).
- [x] T9 PDF y detalle con el conductor; docs (`modelo_datos.md`, `contrato_api.md`, README).
- [x] T10 Verificación: `node --check` en los 26 .js; API con la cuenta de desarrollo (migración 57 aplicada): sin piloto y sin licencia del solicitante falla como antes; piloto GT-B con placa P pasa; GT-C con placa C falla nombrando al piloto; piloto vencido, inactivo e inexistente fallan con 400 explicativo en `pilotoId`; el catálogo trae `bloqueos` por piloto. Formulario visto en el navegador (campo «Conductor» y franja «Tramitando para»). Sin probar: crear la solicitud con piloto y su PDF, la pestaña «Pilotos» de Configuración, modificar y borradores con piloto, y Gestiones (no muestra el conductor).
