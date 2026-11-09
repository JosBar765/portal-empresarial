# Módulo Proyectos

Proyectos de venta por nicho: una base global de empresas (bancos, colegios, hospitales…) que se reparte de forma equitativa entre los asesores cuando un supervisor o el administrador activa el proyecto del mes; cada asesor gestiona las suyas (contactos, muestras, cotizaciones, ventas) y el supervisor da seguimiento y cierra con informe. El administrador ajusta casi todo el flujo desde el Centro de configuración, sin programar.

**Estado:** el mockup está aprobado (2026-11-07) y la **fase 1** está programada: base de datos, catálogos y Centro de configuración del administrador (pantallas A0, A1, A3, A5 y A10). Las demás pantallas llegan por fases (ver `plan_implementacion.md`).

## Dependencias

- **Montaje:** `/api/proyectos` en `src/app.js`, detrás de `requireAuth` y `requirePermission('proyectos.ver')`; las rutas de administración exigen además `proyectos.administrar`. El estático `public/modules/proyectos/` lo sirve `/modules` con la entrada `proyectos` de `MODULOS` (`modulesCatalog.js`).
- **Servicios del core:** `permissionMiddleware`, `erroresHttp` (`ErrorDeNegocio`, `responderError`), `validar` (`aEntero`, `idObligatorio`), `config/database` (`db.query`, `db.transaccion`), `notificaciones` (columnas `referencia_tipo` y `referencia_id`) y `socketManager`.
- **Reutiliza del frontend:** `public/css/global.css` (incluye los tokens `--modulo-proyectos` y `--modulo-proyectos-light`), `public/css/dashboard.css`, `sessionGuard.js`, `toast.js` y `notificaciones.js`.
- **Tablas:** 32 tablas `proy_*` y la columna nueva de `notificaciones`. Reutiliza `usuarios`, `paises`, `tiendas`, `permisos`, `rol_permisos` y `parametros_sistema` (los ajustes llevan el prefijo `proyectos.`).
- **Permisos:** `proyectos.ver`, `proyectos.clientes.registrar`, `proyectos.clientes.importar`, `proyectos.gestionar`, `proyectos.activar`, `proyectos.reasignar`, `proyectos.supervisar`, `proyectos.ver_gerencia`, `proyectos.dar_visto_bueno`, `proyectos.ver_reportes`, `proyectos.corregir`, `proyectos.aprobar_activacion`, `proyectos.confirmar_ventas` y `proyectos.administrar`. Se crean **sin asignar a ningún rol**.
- **Variables de entorno:** ninguna.
- **Sockets:** solo el centro de notificaciones y `permisos_actualizados`; los avisos propios del módulo llegan en la fase 6.

## Dónde está el código

- **Backend:** `src/modules/proyectos/`
  - `routes.js`, `controllers/` (`configController.js`, `catalogoController.js`, `clienteController.js`).
  - `telefonos.js` y `duplicados.js` (puros: normalizar teléfonos por país; nombre normalizado y similitud), `repartoService.js` (el reparto equitativo, puro y aislado), `csv.js` (lector CSV puro), `camposPropios.js` (validación de los campos propios), `services/clienteService.js`, `importacionService.js` y `alcanceService.js` (países que ve cada persona). Detalle en `documentacion/clientes.md`.
  - `parametros.js`: **registro de ajustes** (clave, grupo, tipo, rango, valor por defecto, etiqueta y ayuda). Un ajuste nuevo es una entrada más; la pantalla A3 se dibuja desde ahí. Contiene también la validación pura.
  - `catalogos.js`: **registro de catálogos** (nichos, artículos, áreas, canales, resultados, motivos, estructuras y monedas). Los nombres de tabla y columna del SQL genérico salen solo de este archivo.
  - `services/configService.js` (lectura con caché, guardado, restaurar y configuración por país), `catalogoService.js`, `historialService.js` (listado con filtros y restauración) y `resumenService.js` (inicio).
  - `repositories/` (`configRepository.js`, `catalogoRepository.js`) con todo el SQL, y `errores.js`.
- **Base de datos:** migraciones `proyectos_catalogos_configuracion` (catálogos, configuración, permisos y semillas), `proyectos_empresas_y_reparto` (empresas, proyectos y reparto, con los dos índices únicos sobre columnas `VIRTUAL`), `proyectos_trabajo_asesor` (gestiones, muestras, cotizaciones, ventas, soporte y la referencia en notificaciones) y `proyectos_parametro_valor_largo` (el valor de un ajuste admite 255 caracteres).
- **Frontend:** `public/modules/proyectos/`
  - `index.html` (con las marcas `importmap` del versionado), `css/styles.css`, `js/app.js` (sesión y rutas por `#/`).
  - `js/views/`: `proyectos.js` (lista, borradores y detalle) y `proyectoAsistente.js` (asistente de 4 pasos), `plantillas.js` (A4/A4b), `aprobaciones.js` (G5), `campos.js` (A6), `alcance.js` (A7), `importar.js` (importación), `clientes.js`, `clienteFormulario.js` y `clienteFicha.js` (base de clientes), `inicio.js` (A0), `catalogos.js` y `catalogosConfig.js` (A1), `parametros.js` (A3), `reglas.js` (A5), `historial.js` (A10) y `cambios.js`.
  - `js/api/api.js`, `js/components/` (`ui.js`, `modal.js`, `salida.js` para avisar de cambios sin guardar), `js/layout/sidebar.js`, `js/utils/`.
- **Verificación:** `scripts/proyectos/` (`verificar-configuracion.js`, `verificar-api-configuracion.js` y `verificar-clientes.js`, `verificar-importacion.js`, `verificar-campos-alcance.js`, `verificar-reparto.js`, `verificar-plantillas-aprobacion.js`, `verificar-gestion.js`, `verificar-seguimiento.js`; ver «Probar en local»).

## Reglas clave

- **Se configura, no se programa.** Catálogos, ajustes, reglas e interruptores se editan desde A0 a A10. Quedan fijos a propósito: un proyecto activo por tienda y por empresa (índices únicos), los 7 estados de la empresa, anular en vez de borrar, la identidad siempre desde la sesión, los datos vacíos de «Otra tienda» desde el servidor y el orden de bloqueo al activar (detalle en `documentacion/configuracion_administrador.md`).
- Los cambios de configuración **aplican a proyectos nuevos**: cada proyecto guardará su foto de configuración al activarse (`config_snapshot`, fase 3).
- Nunca se borra un catálogo: se desactiva. Desactivar una fila en uso pide confirmación y no toca lo ya registrado.
- Un resultado de gestión solo puede empujar el estado a `ninguno`, `en_gestion` o `interesada`; `cotizada` y `vendida` salen de la cotización y la venta.
- El código de una moneda se escribe al crear y no se cambia.
- Todo cambio de configuración (ajuste, país o catálogo) escribe una fila en `proy_config_historial` con el antes y el después, dentro de la misma transacción. «Restaurar» desde A10 es un cambio nuevo, también auditado; un alta no se restaura.
- Los ajustes se validan contra el registro: tipo, rango y reglas entre ajustes (el verde del semáforo siempre mayor que el ámbar). Un guardado con un valor inválido se rechaza completo, sin guardar nada.
- Un país sin moneda local (hoy Belice) se avisa en A0 y en A1 › Países; sus cotizaciones y ventas saldrán en dólares (se programa en la fase 4).
- MariaDB entrega las columnas `JSON` como texto y MySQL ya convertidas: todo lector (por ejemplo, el historial) acepta ambas formas.
- Las columnas generadas son `VIRTUAL`, no `STORED`: con claves foráneas en cascada MariaDB 11 dio el error 1901 en Eventos.
- UI en español neutro (tú). Estados en palabras completas. Los textos de las pantallas salen del mockup aprobado.

## Roles

- **Administrador** (rol 1): `proyectos.administrar` (todo el Centro de configuración) y los permisos operativos que se le asignen.
- Los permisos viajan en el token: tras asignarlos desde la pantalla Roles de Administración (que refresca la sesión de quien ya está conectado), quien tenga la sesión abierta debe volver a entrar. Una migración SQL no refresca la sesión.
- Sin `proyectos.administrar`, el módulo muestra «Todavía no hay pantallas para tu rol» hasta que lleguen las pantallas del asesor y del supervisor.

## Probar en local

1. Detener el servidor y encender la base (Docker). `npm run migrate` aplica las migraciones `proyectos_*`.
2. Asignar `proyectos.ver` y `proyectos.administrar` al rol que vas a usar desde Administración › Roles (o con SQL en `rol_permisos` en una base de prueba) y volver a iniciar sesión.
3. Abrir `/modules/proyectos/`.
4. Verificar con datos de prueba, **solo contra una base desechable** (borran lo que crean al terminar):
   - `node scripts/proyectos/verificar-configuracion.js` (solo el registro, sin base de datos) o con `--db` (también el servicio).
   - `node scripts/proyectos/verificar-api-configuracion.js` (recorre las rutas reales por HTTP).
5. `npm run ci:migraciones` y `npm run ci:sintaxis` antes del pull request.

## Documentación

- `propuesta_modulo.md`: propuesta completa (flujo, permisos, modelo de datos, informe, fases). Fuente de verdad del diseño.
- `documentacion/clientes.md`: base de clientes (alcance, duplicados, estados, contactos, API y pantallas).
- `documentacion/importacion.md`: importación de empresas por CSV.
- `documentacion/plantillas_y_aprobacion.md`: plantillas de proyecto (A4/A4b), foto de la configuración y aprobación del gerente.
- `documentacion/seguimiento_supervisor.md`: alcance de tres niveles, avance, reasignación, anulaciones y ventas por confirmar (servidor de la fase 5).
- `documentacion/gestion_del_asesor.md`: gestiones, muestras, cotizaciones, ventas, perdida y descartada, «Para hoy» y reglas de estado (servidor de la fase 4).
- `documentacion/proyectos_y_reparto.md`: proyectos del mes, reparto equitativo, activar y cancelar.
- `documentacion/campos_y_alcance.md`: campos propios (A6) y alcance de usuarios por país (A7).
- `documentacion/configuracion_administrador.md`: inventario de lo configurable, diseño interno, matriz de trazabilidad y lo que queda fijo.
- `plan_implementacion.md`: fases, casillas de avance y decisiones resueltas.
- `acople_flujo_eventos.md` y `decisiones_acople_eventos.md`: qué se toma de Eventos y por qué.
- `Idea_Modulo_Proyectos.md` y `Documento_Idea_Modulo_Proyectos.docx`: la idea original y el documento para el dueño.
- Mockup en Figma: `https://www.figma.com/design/3OvP90pDHgudd6fVYjsoZu` (la página «08 · Revisión» lista los cambios).
