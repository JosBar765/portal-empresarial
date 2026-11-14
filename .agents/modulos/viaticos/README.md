# Módulo Calculadora de Viáticos

Solicita, autoriza y liquida los viáticos de viajes de trabajo. Hay dos modalidades: **más de 1 día** (ruta por tramos, combustible, depreciación del vehículo propio, hospedaje, comidas y otros gastos, con importes en la moneda elegida) y **1 día o menos** (checklist previo: fluidos, odómetro, kit de emergencia y defectos con foto, sin importes). Cada solicitud genera un PDF «SOLICITUD DE VIÁTICOS». Todo lo que puede cambiar (tramos, vehículos, licencias, valores de comida, motivos, tipos de gasto y de defecto, monedas) se administra desde la pestaña `Configuración`, sin tocar código.

## Dependencias

- **Montaje:** `/api/viaticos` en `src/app.js`, detrás de `requireAuth` y `requirePermission('viaticos.ver')`. El estático `public/modules/viaticos/` lo sirve `/modules` con la entrada `viaticos` de `MODULOS`. `viaticos.ver` es el permiso que muestra el módulo en el dashboard y abre sus páginas: quien use `gestionar`, `autorizar`, `liquidar` o `configurar` necesita también `ver`.
- **Servicios del core:** `permissionMiddleware`, `erroresHttp` (`ErrorDeNegocio`, `responderError`), `validar`, `config/database` (`db.query`, `db.transaccion`), `notifications` (`notificacionService`), `websocket` (`socketManager`), `files` (`supabaseStorage`, `nombreArchivo`, `subirYRegistrarArchivo`), `idempotency` y `calendario` (`ahoraUTC6`, hora de Guatemala).
- **Tablas:** 33 tablas `viaticos_*` (modelo en [`documentacion/modelo_datos.md`](documentacion/modelo_datos.md)). Lee `usuarios`, `roles`, `permisos` y `paises`. Las notificaciones usan la tabla compartida con `modulo = 'viaticos'` y sin `vale_id`.
- **Permisos:** `viaticos.ver` (módulo y pestaña `Solicitudes`), `viaticos.gestionar` (pestaña `Gestiones`: ver todas las solicitudes), `viaticos.autorizar` (autorizar y rechazar), `viaticos.liquidar` (ver la liquidación en `Gestiones`) y `viaticos.configurar` (pestaña `Configuración`). `autorizar` y `liquidar` controlan solo la acción: sin `gestionar` no se ve la lista. Para solicitar basta `viaticos.ver` (no hace falta `gestionar`, que muestra las solicitudes de todos) y el usuario debe tener países en `Configuración → Personas`. El rol **Piloto** (lo crea la migración) tiene `viaticos.ver`; el Administrador tiene los cinco; cualquier otro rol se asigna desde Administración.
- **Variables de entorno:** `SUPABASE_STORAGE_BUCKET_VIATICOS` (obligatoria; bucket propio, distinto entre staging y producción).
- **Sockets:** `events.js` define la sala `viaticos:gestion` (solo con `viaticos.gestionar`) y emite `viaticos_actualizada` `{ id, correlativo, estado, solicitanteId, accion }` a esa sala y al solicitante.

## Dónde está el código

- **Backend:** `src/modules/viaticos/`
  - `routes.js`, `controllers/`, `services/`, `repositories/` (todo el SQL), `constantes.js`, `mensajes.js` (catálogo central de textos y errores), `errores.js`, `validacion.js`, `catalogos.js` (definiciones declarativas de los catálogos simples) y `events.js`.
  - `services/calculoService.js` y `dinero.js` (importes exactos en centavos), `validacionSolicitudService.js` (reglas y advertencias), `pipelineService.js` (estado visible derivado de las fechas), `solicitudGuardadoService.js` (crear, modificar y dar de baja con transacción), `gestionService.js` (listar, autorizar y rechazar), `liquidacionService.js` y `liquidacionCalculoService.js`, `documentoService.js` y `pdf/` (generación del PDF con `pdf-lib`).
- **Base de datos:** solo migraciones (no se tocan `schema.sql` ni `seed.sql`): `viaticos_esquema` (las 33 tablas) y `viaticos_semilla` (permisos, rol Piloto, monedas, estados, catálogos iniciales y 14 tramos de prueba que se reemplazan desde `Configuración`).
- **Frontend:** `public/modules/viaticos/` — `js/app.js` (arranque), `js/views/` (`solicitudes`, `gestiones`, `configuracion/`), `js/forms/` (modal de solicitud de ambas modalidades), `js/actions/` (liquidación, autorizar, rechazar, dar de baja), `js/components/` (copias adaptadas del vale de arte: barra de período, calendario, visor de documentos; pipeline propio), `js/api/viaticosApi.js` (una función por endpoint) y `css/`. Plano y convenciones en [`documentacion/plano_frontend.md`](documentacion/plano_frontend.md).

## Reglas clave

- **Estados y pipeline:** se guardan `esperando autorización`, `rechazada`, `autorizada` y `liquidada`. «En curso», «Terminado» y «Vencida» se calculan con las fechas (hora de Guatemala) y no se guardan. Más de 1 día: Esperando autorización → Autorizado → En curso/Terminado → Liquidado. 1 día o menos: Esperando autorización → Autorizado.
- **Modificar y dar de baja** solo en solicitudes esperando autorización, rechazadas o vencidas. Modificar vuelve a «esperando autorización» y regenera el PDF; dar de baja borra el registro y sus archivos (el borrado en Storage solo actúa en producción).
- **Todo por país:** cada persona tiene una lista de países; al crear la solicitud elige país y, en más de 1 día, moneda (dólar y monedas centroamericanas). El valor de cada comida depende solo de la moneda. En el formulario las comidas de cada día vienen marcadas por defecto (solo las que tienen valor en la moneda elegida); lo que el usuario desmarca se respeta aunque cambien las fechas o la moneda, y al modificar una solicitud guardada no se marca nada solo. Los tramos son pares no ordenados que valen en ambos sentidos y pueden unir países distintos.
- **Restricciones:** licencia registrada y vigente; la licencia limita el tipo de placa según reglas configurables por país; fechas no pasadas; sin traslape con otra solicitud activa; el viaje corto exige vehículo de la empresa con tarjeta de circulación vigente. Licencia, tarjeta o seguro que vencen durante el viaje son advertencias (quedan como salvedades en el PDF).
- **Importes:** los calcula siempre el servidor (el cliente solo los muestra). El precio por galón y el rendimiento los ingresa el usuario; la depreciación solo aplica a vehículo propio.
- **Correlativo:** `VIA-<código de país>-<n de 6 dígitos>`, secuencia independiente por país (provisional hasta que gerencia defina otro).
- **Liquidación:** solo viajes de más de 1 día, autorizados y terminados. Un comprobante por noche de hotel, uno de combustible y uno por cada renglón de otros gastos; las comidas y la depreciación no se liquidan. El solicitante marca «Liquidar» cuando quiere, aunque falten comprobantes (solo se le avisa). Contabilidad ve la liquidación en solo lectura, con la diferencia.
- **PDF:** una hoja en el caso normal; si las listas no caben sigue en otra con el mismo encabezado, el total y las firmas siempre juntos, y «n/total» al pie. Al autorizar se regenera con el nombre de quien autorizó sobre la línea de Administración (**tentativo**: gerencia aún no define el proceso).
- **Archivos en Storage** (bucket propio, nombres como en el vale de arte): `<CORR>_CREACION`, `<CORR>_CORRECCION_PRE_AUTORIZACION_X`, `<CORR>_AUTORIZACION`, `<CORR>_DEFECTO_CREACION_X` y `_CORRECCION_X`, `<CORR>_LIQUIDACION_<RUBRO>_X`. Tipos y tamaño permitidos en `viaticos_ajustes`.
- **Entornos:** el borrado de archivos pasa por `supabaseStorage.eliminar`, que solo actúa con `NODE_ENV=production` (ver `reglas_entornos.md`). En desarrollo y staging los archivos reemplazados quedan en el bucket.
- **Errores:** de negocio con 400 (con `campos`) o 403, nunca 401; los internos salen genéricos.

## Documentos

- [`analisis_modulo.md`](analisis_modulo.md): análisis funcional original (vistas, permisos, restricciones).
- [`tabla_tramos.md`](tabla_tramos.md): tramos de prueba iniciales.
- [`documentacion/modelo_datos.md`](documentacion/modelo_datos.md): las 33 tablas y la normalización.
- [`documentacion/contrato_api.md`](documentacion/contrato_api.md): endpoints, payloads, errores y reglas del servidor.
- [`documentacion/plano_frontend.md`](documentacion/plano_frontend.md): estructura y convenciones del frontend.
