# Ruta de visitas y clientes ganados (fase 9c)

Mockups aprobados en Figma: **M13** (Para hoy con ruta de visitas) y **M14** (Clientes ganados), página «02 · Asesor — celular».

## Ruta de visitas

- **«Cómo llegar»:** cada empresa de «Para hoy» con dirección registrada muestra el botón que abre Google Maps con su dirección (`dirección, ciudad, país`). Sin dirección el botón no aparece.
- **Ruta de hoy:** la tarjeta arriba de «Para hoy» reúne las empresas con seguimiento **hoy** y dirección, en el orden de su hora, con «Abrir ruta en Google Maps» (la última parada es el destino; las demás, paradas intermedias). Las empresas de hoy sin dirección no entran y se cuentan aparte («complétala para incluirla en la ruta»).
- **Límite:** Maps admite 10 lugares; si hay más, van los primeros diez y la tarjeta lo dice.
- **Privacidad:** el sistema no llama a Google. Los enlaces se arman en `src/modules/proyectos/mapas.js` (funciones puras) y la dirección solo viaja a Google cuando la persona hace clic.
- **Dónde se arma:** `gestionService._rutaDeHoy`; `GET /api/proyectos/mi-proyecto/para-hoy` devuelve `ruta { paradas, sinDireccion, recortada, enlace }` y, por empresa, `tieneDireccion` y `enlaceMapa`.

## Clientes ganados

- **Qué es:** las empresas con venta **confirmada y vigente** (no anulada ni rechazada) en cualquier proyecto, una fila por empresa: última venta, número de ventas, total vendido **por moneda sin mezclar**, asesor de la última venta y recompra sugerida.
- **Recompra sugerida:** fecha de la última venta + `ganados.meses_recompra` meses (parámetro del grupo «Empresas», 6 por defecto, de 1 a 36). Estado: `vencida` (ya pasó), `proxima` (en los próximos 30 días) o `lejana`. La lista va ordenada por esa fecha, primero lo que ya toca.
- **Quién ve qué** (decide el servidor, `ganadosService`): el asesor, las ventas que hizo él; el supervisor, las suyas y las de sus tiendas; gerencia y administración, todas. Con solo `proyectos.ver` no se entra (403). No hay permiso nuevo.
- **Filtros:** búsqueda por nombre, nicho, últimos 3/6/12/24 meses y recompra (vencida o próxima). Un valor inválido se ignora.
- **Pantalla:** `#/ganados`, en el menú lateral bajo «Cartera». Tabla en escritorio y tarjetas en el celular, con Llamar, WhatsApp y «Crear vale».
- **Exportar:** «Exportar CSV» (con `proyectos.ver_reportes`) descarga lo que se ve, con los mismos filtros.
- **Crear vale de recompra:** abre Vales con `?prellenar=clientes:<id>` (solo el id, nunca datos personales). Vales pide `GET /api/proyectos/clientes-ganados/:clienteId/prefill-vale` con la sesión del asesor (exige `proyectos.gestionar` y que la empresa esté en sus clientes ganados; si no, 404) y muestra el aviso «Recompra de un cliente ganado: este vale no se liga a ningún proyecto». No se crea vínculo en `proy_vales`: la recompra no pertenece a un proyecto.

## API

| Ruta | Quién | Qué |
|---|---|---|
| `GET /clientes-ganados` | asesor, supervisor, gerencia, administración | lista paginada (100) con filtros `busqueda`, `nicho`, `periodo`, `recompra`, `pagina` |
| `GET /clientes-ganados/exportar.csv` | `proyectos.ver_reportes` | CSV de lo mismo, sin paginar |
| `GET /clientes-ganados/:clienteId/prefill-vale` | `proyectos.gestionar` | datos del vale de recompra |

## Código

`mapas.js` · `services/ganadosService.js` · `repositories/ganadosRepository.js` · `controllers/ganadosController.js` · `valeVinculoService.prefillRecompra` · frontend `views/clientesGanados.js`, `views/paraHoy.js`, `views/miProyecto.js` (`accionesDeContacto`) y, en Vales, `forms/valeForm.js` (`abrirModalCrearValeRecompra`).

## Verificación

`node scripts/proyectos/verificar-ganados.js` (base desechable; 37 comprobaciones): enlaces de Maps, ruta de hoy (orden por hora, sin dirección aparte), alcance por rol, lo anulado no cuenta, totales por moneda, recompra, filtros, exportación y el prellenado del vale de recompra.
