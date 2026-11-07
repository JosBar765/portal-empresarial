# Base de clientes (fase 2a)

Las empresas de la base global, siempre abierta: cualquier asesor las registra y las ve según los países de su alcance.

## Reglas

- **Alcance por país.** Una persona ve los países de su tienda (asesor) o de sus tiendas (supervisor), más las excepciones que el administrador le ponga (`proy_usuario_paises`). Quien tiene `proyectos.ver_gerencia` o `proyectos.administrar` ve todos. Una empresa de otro país responde **404**, no 403, para no confirmar que existe.
- **Permisos.** Ver: `proyectos.ver`. Crear, editar, contactos, «No contactar» e inactiva: `proyectos.clientes.registrar`. **Reactivar: `proyectos.corregir`** (supervisor y administrador) con un motivo obligatorio. La importación (`proyectos.clientes.importar`) llega en la fase 2b.
- **Teléfono.** Se guarda canónico (`+50277654400`) según el prefijo y el formato del país (`proy_pais_config`) y se muestra con formato (`+502 7765 4400`). Se aceptan espacios, guiones, `+502`, `502` y `00502`. Un prefijo de otro país se rechaza.
- **Duplicados: solo avisan.** Coincide si es del mismo país con nombre parecido y la misma ciudad (si falta una ciudad, basta el nombre), o con el mismo teléfono. El nombre se compara sin acentos, mayúsculas, puntuación ni «S.A.», «R.L.»… con similitud de bigramas contra `empresas.similitud_minima`. Cada criterio se apaga con `empresas.duplicado_por_nombre_ciudad` y `empresas.duplicado_por_telefono`. El servidor responde **409 `POSIBLE_DUPLICADO`** con las coincidencias; se guarda de todos modos con `confirmarDuplicado: true` («Es otra empresa»).
- **Obligatorios** (ajustes `empresas.*`): ciudad, contacto, teléfono o correo, sitio web.
- **Estados** `activa`, `inactiva`, `no_contactar`. Marcar `no_contactar` o inactiva pide un motivo del catálogo «No contactar» (A1). Cada cambio queda en `proy_cliente_eventos` (quién, cuándo, motivo, nota).
- **Contactos.** Por área; uno solo es el principal (se cambia en una transacción). Con `empresas.contacto_obligatorio` no se puede desactivar el último contacto activo.
- **Lista.** De 50 en 50 con «Cargar más»; búsqueda por nombre o teléfono; filtros de nicho, país y estado (por defecto, activas).

## API (`/api/proyectos/clientes`)

`GET /opciones`, `GET /`, `POST /duplicados`, `POST /`, `GET /:id`, `PUT /:id`, `POST /:id/estado` (`no_contactar`, `inactivar`, `reactivar`), `POST /:id/contactos`, `PUT /contactos/:id`, `PATCH /contactos/:id/activo`.

## Pantallas

`#/clientes` (lista: tarjetas en celular, tabla en escritorio), `#/clientes/nuevo` (registro con aviso de duplicados mientras se escribe) y `#/clientes/<id>` (ficha con contactos por área, cambios de estado y ventanas para editar, «No contactar» y contactos). Cada pantalla pide su propio permiso; el menú muestra solo lo permitido.

## Verificación

`node scripts/proyectos/verificar-clientes.js` en una base desechable con las migraciones aplicadas (pruebas puras de teléfono, nombre y similitud, más un recorrido HTTP con varios roles y países; limpia lo que crea).
