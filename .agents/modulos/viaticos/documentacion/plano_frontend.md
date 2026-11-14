# Plano del frontend — Calculadora de Viáticos

Fuente: lectura de `public/modules/vales/` y `public/modules/prompts/` (2026-11-12). Reglas: `.agents/reglas/reglas_implementacion.md` (JS vanilla con módulos ES, sin bundler), `reglas_disenoUI.md` (solo tokens de `global.css`), CLAUDE.md §8 (no quitar los marcadores del importmap).

## Estructura

```text
public/modules/viaticos/
├── index.html
├── css/        styles.css (entrada: @import '/css/dashboard.css'), pipeline.css, visor.css, reportes.css (barra de período), borradores.css (acciones de la barra y lista de borradores)
└── js/
    ├── app.js              # arranque (patrón de Prompts, permisos finos)
    ├── state.js            # un único objeto mutable exportado
    ├── textos.js           # catálogo de textos: t('clave', {param}); lanza si falta la clave
    ├── socket.js           # Socket.IO, salas y recarga con debounce
    ├── config/             # constantes: permisos, pestañas, etiquetas
    ├── utils/              # dom.js (h, icono, montar, $), formato.js (escapeHtml, fechas, dinero, tamaño), fechas.js
    ├── api/                # viaticosApi.js (una función por endpoint; patrón pedir() de Prompts)
    ├── components/         # modal.js (con confirmarModal), validacion.js, visorDocumento.js, barraPeriodo.js, pipeline.js, dropzone.js
    ├── layout/             # sidebar.js (pestañas por permiso, colapso, cajón móvil), cuenta.js (menú de cuenta y cierre de sesión)
    ├── views/              # solicitudes.js, gestiones.js, configuracion/…
    ├── forms/              # solicitudForm (largo y corto; modos crear, modificar y borrador), borradorEstado.js, borradores.js
    └── actions/            # liquidación, autorizar, rechazar, dar de baja
```

## Reglas del módulo

- **Los componentes de Vales se copian, no se importan.** `/modules/vales/*` responde 403 o redirige a `/dashboard/` a quien no tenga `vales.ver` (`requireModuleAccess`). `/js`, `/css` y `/assets` son públicos y se pueden usar (`/js/sessionGuard.js`, `/js/toast.js`, `/js/notificaciones.js`).
- **Clases:** el shell y la tabla conservan los nombres de Vales (`.app-shell`, `.sidebar-vales`, `.tabla-wrapper`, `.buzon-vacio`, `.btn-icon`, `.form-field`…). Todo lo propio de viáticos lleva el prefijo `vi-`.
- **Importaciones:** relativas con extensión `.js` (`./x.js`), o absolutas `/js/x.js`. El versionado (`scripts/versionarEstaticos.js`, solo en staging y producción) solo cubre `public/js/` y la carpeta `js/` del HTML.
- **HTML del servidor** siempre por `escapeHtml` o `textContent`. Íconos `<ion-icon name="…-outline">`. Ocultar por permiso con `style.display`.
- **Estado único** `state` (sin getters ni suscripciones). Ciclos de imports solo si son funciones que no se ejecutan en la carga; se documentan.
- **Comentarios** en español, de una línea, solo el porqué.

## HTML (copiar de `vales/index.html:3-62`)

Orden del `<head>`: charset y viewport; `<!-- importmap:inicio --><!-- importmap:fin -->`; `<title>… | Portal Empresarial</title>`; favicon `/assets/logos/LOGO_GP_isotipo.png`; CSS del módulo; Ionicons (`unpkg.com/ionicons@7.1.0`, módulo y `nomodule`); `<script src="/socket.io/socket.io.js">`. Al final del `<body>`: `/js/sessionGuard.js`, `/js/toast.js`, `/js/notificaciones.js`, `/js/mantenimientoAviso.js` y `<script type="module" src="/modules/viaticos/js/app.js">`. Raíces: `#modals-root`, `#toast-root.toast-root`, `#notificaciones-root.notif-root` (en el header).

Header: `.app-header > .header-brand` (`#sidebar-toggle-mobile`, `a.header-back` a `/dashboard/`, logo, `.header-title` «Calculadora de Viáticos», `.header-company` «MundiTrofeos S.A.»), `.notif-root#notificaciones-root` y `.header-user-menu` con `#account-widget`, `#account-avatar`, `#user-display-name`, `#user-display-role`, `#account-dropdown`, `#account-dropdown-name`, `#account-dropdown-role` y `#logout-btn`. Sidebar: `<aside class="sidebar-vales" id="sidebar-vales">` con `.sidebar-item[data-tab]` y `#sidebar-collapse-toggle`; `#sidebar-backdrop`. Contenido: `.app-shell > .app-layout > main.main-container > section#panel-content`. Footer: `footer.app-footer > span.footer-text` «© 2026 MundiTrofeos S.A. | Portal de Herramientas Corporativo Interno». Estado de carga: `.buzon-vacio` con `sync-outline.spin-animation`.

## Arranque (patrón de Prompts, `prompts/js/app.js`)

`sessionCheck` (`GET /api/auth.php?action=session_check`) → si no autenticado, `/login/?expired=true`; guarda `state.user`; sin `viaticos.ver` en `permissions`, `/dashboard/`; pinta cuenta y avatar; `seguirAltoEncabezado()` (`--header-height` con `ResizeObserver`); sidebar por permiso (`PERMISO_POR_TAB`, pestaña activa en `localStorage` `viaticos:tabActiva` si sigue visible); `initSocket`; `cargarTab()` con spinner y, en error, `.buzon-vacio.buzon-vacio-error`. Cambiar de pestaña con cambios sin guardar pide confirmación (`state.salidaVista`).

## Socket (`vales/js/socket.js`)

`io({ query: { userId } })` protegido por `typeof io`; `window.centroNotificaciones?.iniciar({ socket, modulo: 'viaticos' })`; en `connect` emite `register_module` con `['role_<rolId>']` más `'viaticos:gestion'` si tiene `viaticos.gestionar`; maneja `permisos_actualizados` (refresh y recarga), `sesion_revocada` (logout) y `viaticos_actualizada` `{ id, correlativo, estado, accion }` → toast si el actor no es uno mismo y recarga con debounce de 400 ms (aplazada si `document.hidden`).

## API (patrón `pedir()` de `prompts/js/api/promptsApi.js`)

Sin `credentials` (mismo origen). `pedir(url, opciones)` envuelve el fallo de red; lee `res.json().catch(() => null)`; ante `!res.ok` lanza `Error` con `status`, `campos`, `errores` y `codigo`. FormData sin `Content-Type`; la `idempotencyKey` va dentro de `datos` y se reenvía igual en un reintento. Errores de negocio llegan como 400 (con `campos`) o 403; nunca 401. `mensajesDeError(error)` devuelve la lista de errores, los valores de `campos` o el mensaje. Hay que escribir `formatearDinero(simbolo, importe)` (no existe).

## Borradores de solicitudes

- `api/viaticosApi.js`: `listarBorradores`, `obtenerBorrador`, `crearBorrador(modalidad, datos)`, `actualizarBorrador(id, modalidad, datos)` y `eliminarBorrador` (contrato en `contrato_api.md`, «Borradores»).
- `forms/borradorEstado.js` (puro, sin DOM): `estadoABorrador(estado)` deja un objeto JSON plano sin `File` ni URLs (de cada defecto solo `tipoDefectoId` y `descripcion`; conserva `comidasAutoMarcar` y `comidasDesmarcadas`) y `borradorAEstado(datos, modalidad, { paises })` arma el estado completo sobre `estadoInicial()`, ignorando claves desconocidas y cayendo al valor por defecto si un tipo no encaja. Los ids de catálogo no se validan ahí: los depura `reconciliarEstado` al cargar los catálogos.
- `solicitudForm.js`, tercer modo `'borrador'` (`abrirFormularioSolicitud({ modo: 'borrador', borrador, alTerminar })`, `borrador` = respuesta de `GET /borradores/:id`): sigue siendo una solicitud nueva (país, tipo de viaje y moneda editables; «Enviar solicitud» con la validación completa) y agrega `borradorId` al `datos` del envío solo en este modo; nunca al modificar. Tras enviar avisa el cambio de borradores porque el servidor ya lo borró.
- Botón «Guardar borrador» (`#vi-sol-borrador`, `btn--ghost`, junto a Cancelar) en los modos crear y borrador, nunca al modificar. No depende del cálculo ni de la validación: guarda lo que haya (POST en crear, PUT en borrador), muestra el aviso de éxito, avisa el cambio y **cierra el modal**; los errores 400 y 409 del servidor se muestran dentro del modal, que sigue abierto. Mientras guarda (`ctx.enviando`) se frenan el envío, este botón y el cierre.
- Al cerrar con cambios (`ctx.sucio`) la confirmación solo avisa (en crear sugiere «Guardar borrador»; en borrador dice que se pierden los cambios no guardados): `confirmarModal` no admite una tercera acción.
- `forms/borradores.js`: `crearBotonBorradores({ alTerminar })` (`#vi-btn-borradores`, «Borradores (n)», dentro de `.vi-toolbar-acciones` junto a «Nueva solicitud» en la vista Solicitudes) y `abrirModalBorradores`: lista con tipo de viaje, país (de `state.contexto.paises`, si se conoce), fechas del viaje, «Creado el…» y «Vence en N días» (rojo con 3 o menos, «Vence hoy» con 0), y acciones «Abrir» (`obtenerBorrador` y abre el modal en modo borrador) y «Eliminar» (con `confirmarModal`). Un 404 (venció o se eliminó) muestra un aviso y refresca la lista y el contador. Clases `vi-borrador-*`.
- `utils/eventosBorradores.js`: evento de documento `viaticos:borradores:cambio` (`avisarCambioBorradores()`); guardar, eliminar y enviar desde un borrador lo disparan y el botón refresca su contador.
- Textos: claves `borradores.*` y `formulario.borrador.*` / `formulario.cerrar.mensajeBorrador` en `textos.js`.

## Tablas y móvil

`.tabla-wrapper[tabindex=0][role=region]` → `table.buzon-table.data-table.sticky-header`; cada `td` lleva `data-label` y la de acciones `.acciones-cell`; en ≤900 px cada fila es una tarjeta (`::before{content:attr(data-label)}`); objetivos táctiles de 44 px a ≤640 px. Tabla fija en escritorio con `body.vista-tabla-fija` (solo desde 901 px; `--sep-buzon` 16 px). Fila vacía: `td.tabla-vacia`. Los modales a ≤480 px ocupan la pantalla.

## Componentes que se copian

| Componente | Origen | Nota |
|---|---|---|
| `modal.js` | `prompts/js/components/modal.js` | Incluye `confirmarModal` (Promise) y `mostrarErrorModal`; `abrirModal({ title, bodyHtml, footerHtml, size, alCerrar })` |
| `validacion.js` | `vales/js/components/validacion.js` | Independiente; exige `.form-field` alrededor del campo; para mapear `campos` usar `marcarErrorCampo` |
| `visorDocumento.js` | `vales/js/components/visorDocumento.js` + `css/visor.css` | `abrirVisor({ titulo, subtitulo, documentos:[{etiqueta,url}], activo, acciones, aviso, alCerrar })`; quitar los atajos y los imports de Vales |
| `barraPeriodo.js` | `vales/js/components/barraPeriodoReportes.js` + `reportes.css` | `crearBarraPeriodo(contenedor, { obtener, alCambiar, prefijo })`; período `{ tipo, fecha, desde, hasta }`; requiere `datepicker.js` y `fechas.js` |
| `pipeline.js` | `vales/js/components/pipeline.js` + `css/pipeline.css` | Solo `htmlPipeline` y el tooltip; el payload lo arma el servidor |
| `dropzone.js` | `vales/js/components/dropzone.js` | Ajustar tamaño máximo y etiquetas según `viaticos_ajustes` |
| `selectorMultiple.js` | `vales/js/components/selectorMultiple.js` | Para los países de una persona |
| Subpestañas de administración | `prompts/js/views/admin/editor.js:152-176` y `.pr-adm-tabs` | Base de las 11 subpestañas de Configuración |

## Contrato de la API del backend

`.agents/modulos/viaticos/documentacion/contrato_api.md` (endpoints, payloads, errores y reglas) es la fuente de verdad para las llamadas.
