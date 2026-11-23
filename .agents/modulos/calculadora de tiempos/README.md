# Calculadora de Tiempos (`tiempos`)

Módulo del portal que convierte la **Tabla de tiempos** (hoy Ver. 5.0, 27/07/2026) en una herramienta: el usuario elige producto y cantidad y recibe los **días por etapa**, los **días que se prometen al cliente** y la **fecha de entrega**. El administrador mantiene la tabla desde el portal, por versiones.

Estado: **terminado en local** (idea, mockup aprobado, base de datos, motor, API, pantallas de usuario y de administración). Falta el PR a `dev`.
Mockup (Figma, aprobado 2026-11-23): https://www.figma.com/design/b0CqDb0IHG3IpXRzGesFI5. Tablas de origen: `referencias/`.

## 1. Qué hace

| Pantalla | Quién | Ruta |
|---|---|---|
| **Calculadora**: línea → producto → cantidad → colores, fecha y extras; resultado con desglose; pedido con varias piezas; «Copiar resumen» | `tiempos.ver` | `#/calculadora` |
| **Tabla de referencia**: todos los productos, con buscador (también por avisos) | `tiempos.ver` | `#/referencia` |
| **Administración**: rangos y días, extras, avisos, etapas y líneas; publicar | `tiempos.administrar` | `#/administracion` |
| **Historial de versiones**: qué cambió, reutilizar una versión, descartar el borrador | `tiempos.administrar` | `#/administracion/historial` |

En celular la calculadora y la referencia funcionan completas; la administración se explica y lleva a Referencia (la tabla es muy ancha).

## 2. Reglas de negocio (ver `documentacion/calculo_y_api.md`)
- **Pieza**: días de cada etapa del rango de su cantidad + extras + **1 día de margen** = días al cliente («Cliente» no se guarda, se calcula).
- **Extras**: colores (la tabla incluye 2; desde el 3.º, +1 día por cada 2), moldes (+2 días en piezas fundidas de más de 3.5"), costura del lanyard (columna Costura del Lanyard según la cantidad), impresión UV (tipo y cantidad).
- **Pedido**: las piezas se hacen a la vez; la entrega es la de la **pieza más larga** (no se suman). Si una pieza queda «a convenir», todo el pedido queda a convenir.
- **Fecha**: solo lunes a viernes, sin festivos de Guatemala (tabla `feriados` del portal); el día de la orden no cuenta.
- **Urgente**: solo avisa que lo autoriza el gerente; no acorta tiempos.
- Cantidad menor al mínimo del producto o en «tiempo a convenir»: no se calcula y se explica.

## 3. Cómo se mantiene la tabla
Todo cambio va a un **borrador** (copia de la versión en uso); los usuarios ven lo nuevo solo cuando el administrador **publica** una versión. Cada guardado y publicación queda en el historial. Detalle en `documentacion/administracion.md`.

## 4. Piezas del código
| Parte | Dónde |
|---|---|
| Migración | `database/migrations/54_tiempos_nucleo.sql` (tablas `tiempos_*` y permisos) |
| Carga inicial (Ver. 5.0) | `src/modules/tiempos/datos/tablaV5.js` + `services/cargaInicialService.js` (al arrancar, si no hay versiones) |
| Motor de cálculo (funciones puras) | `src/modules/tiempos/calculo/` (`motor.js`, `fechas.js`, `resumen.js`, `validacion.js`, `diferencias.js`) |
| API | `src/modules/tiempos/` (`routes.js`, `controllers/`, `services/`, `repositories/`), montada en `/api/tiempos` |
| Pantallas | `public/modules/tiempos/` |
| Registro del módulo | `src/core/permissions/modulesCatalog.js` (id `tiempos`, permiso `tiempos.ver`) |

## 5. Poner el módulo en marcha
1. Aplicar la migración (automática en staging y producción; en desarrollo `npm run migrate`). Al arrancar, el servidor carga la Ver. 5.0 si no hay ninguna versión.
2. Dar los permisos desde Administración → Roles (se crean **sin asignar**): `tiempos.ver` a los roles que consultan (asesores, supervisores, gerencia…) y `tiempos.administrar` solo al administrador.
3. Revisar con producción las diferencias de la carga inicial (`documentacion/carga_inicial.md`).

## 6. Verificación
`scripts/tiempos/` (cada uno dice cómo correrlo): `verificar-datos.js` (tabla impresa sin base de datos), `verificar-motor.js` (38 pruebas del cálculo), `verificar-api.js` (API de usuario) y `verificar-admin.js` (administración; escribe en la base: solo una base desechable).

## 7. Documentos
`documentacion/`: `calculo_y_api.md`, `administracion.md`, `carga_inicial.md`, `pantallas.md` (acciones del mockup), `auditoria_textos.md`, `mejoras_ui_ux.md` (selector por categorías, duplicar producto).

## 8. Decisiones (2026-11-21 a 2026-11-23)
| Tema | Decisión |
|---|---|
| Varias piezas | Cada una aparte; entrega = la más larga. |
| Resultado | Días por etapa, días al cliente y fecha de entrega. |
| Quién mantiene la tabla | El administrador, desde el portal, con versiones e historial. |
| Historial de cálculos | No se guarda nada por usuario; botón «Copiar resumen». |
| Festivos | Se descuentan los del calendario del portal (Guatemala). |
| Urgente | Solo avisa que requiere autorización del gerente. |
| UV | Suma a la etapa y al total al cliente; selector del tipo de UV al activarlo. |
| Margen | +1 día una sola vez por pieza, al final. |
| Ayuda por etapa | Por ahora no se incluye. |
| Producto nuevo | Nace oculto hasta tener rangos con días. |
| Etapas y líneas | Se renombran y se agregan; no se borran. |

## 9. Pendiente
- Confirmar con producción las 3 diferencias de la tabla impresa (`documentacion/carga_inicial.md`).
- Probar la migración en MariaDB 11.8.
- PR a `dev`.
