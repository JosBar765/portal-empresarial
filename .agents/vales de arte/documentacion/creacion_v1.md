# Módulo Vales de Arte — Documentación v1

Este documento describe la **primera versión implementada** del módulo de Vales de Arte, tal como quedó construida en el código (`src/modules/vales/`, `public/modules/vales/`). Es un documento de referencia técnica sobre lo que *existe y funciona hoy*, distinto de `.agents/analisis_modulo_vales_de_arte.md` (el análisis funcional original que sirvió de base) y de `.agents/schema.md` (el esquema SQL de referencia inicial). Donde esta versión se desvía o interpreta algo ambiguo del análisis original, queda anotado explícitamente.

---

## 1. Alcance de esta versión

Implementado y funcional de punta a punta, corriendo sobre el **fallback en memoria** (no hay MySQL físico en este entorno; ver sección 5):

- Creación de vales de arte con generación automática de PDF.
- Flujo completo de estados (creación → asignación → trabajo → revisión → aprobación → venta/cancelación).
- Flujo de modificación única con aprobación de supervisor.
- Los 4 roles de actores del análisis funcional (Asesor, Supervisor, Encargado ×2, Técnico) más Administrador.
- Permisos granulares validados en backend en cada endpoint.
- Adjuntos (imágenes y documentos PDF) con metadatos en BD y binario en `uploads/`.
- Notificaciones en tiempo real vía Socket.IO con toast y sonido en el frontend.
- Dashboard principal integrado (sin mockups/alerts).

No implementado en v1 (ver sección 9, "Fuera de alcance / v2").

---

## 2. Arquitectura del módulo

Seguimos la convención de `.agents/readme_modulo.md` (monolito modular, capas por responsabilidad):

```
public/modules/vales/              Frontend (una sola vista adaptativa por rol)
├── index.html
├── css/styles.css                 extiende /css/dashboard.css → /css/global.css
└── js/app.js                      SPA ligera sin build step, socket.io-client

src/modules/vales/                 Backend
├── routes.js                      Endpoints + multer (subida de archivos)
├── controllers/valeController.js  HTTP in/out, delgado
├── services/
│   ├── valeService.js             Máquina de estados + TODAS las reglas de negocio
│   └── valePdfService.js          Generación/fusión de PDF (pdf-lib)
├── repositories/
│   ├── valeRepository.js          CRUD de la tabla `vales`
│   ├── asignacionRepository.js    `vale_asignaciones`
│   ├── propuestaRepository.js     `vale_propuestas`
│   ├── documentoRepository.js     `vale_documentos` (metadatos de adjuntos)
│   ├── historialRepository.js     `vale_historial` (trazabilidad)
│   ├── catalogoRepository.js      localidades/productos/materiales/técnicas/acabados
│   └── usuarioValeRepository.js   lecturas de `usuarios` acotadas al módulo
└── events.js                      Notificaciones Socket.IO (canal compartido `vales`)
```

Regla de capas (igual que el resto del portal): **controllers delgados → services con la lógica de negocio → repositories solo con SQL**. `valeService.js` es el único lugar que conoce el flujo del vale; los repositorios no toman decisiones.

---

## 3. Máquina de estados

```
CREADO ──(encargado asigna)──► ASIGNADO ──(técnico comienza)──► EN_PROCESO
                                    ▲                                 │
                                    │                    (técnico entrega o cancela)
                     (encargado desaprueba,                          ▼
                      reasigna mismo/otro técnico)             EN_REVISION
                                    │                                 │
                                    └───────────────◄──────(encargado desaprueba)
                                                                       │
                                                          (encargado aprueba)
                                                                       ▼
                                                                  APROBADO
                                                    ┌──────────────────┼──────────────────┐
                                        (asesor confirma)   (asesor solicita        (asesor cancela)
                                                │             modificación,               │
                                                ▼             1 sola vez)                  ▼
                                             VENDIDO                │                 CANCELADO
                                                          CONFIRMACION_MODIFICACION
                                                                     │
                                                        (supervisor aprueba)
                                                                     ▼
                                                                MODIFICADO
                                                     (vuelve al buzón de encargados,
                                                      mismo tratamiento que CREADO)
```

Notas de implementación (`valeService.js`):

- **Un vale, un registro.** La modificación NO crea una fila nueva: se actualiza el mismo `vales.id`, se antepone `MOD-` al `correlativo`, se guarda el contenido anterior en `descripcion_original` y el nuevo en `descripcion`, y `modificado` pasa a `1` (bloquea una segunda solicitud).
- **Cancelación de proceso por el técnico** ("propuesta en blanco") también aterriza en `EN_REVISION`, con `vale_propuestas.es_cancelacion = 1` y sin URL — el encargado la ve igual que cualquier desaprobación y debe reasignar.
- **Un técnico no puede tener dos vales `EN_PROCESO` simultáneos** — validado en `valeService.comenzar()`, no solo en el frontend.
- **Atraso es una condición calculada, nunca un estado.** `calcularAtraso(vale)` compara `fecha_entrega` contra "ahora" (o contra `actualizado_en` si el vale ya cerró en `VENDIDO`/`CANCELADO`, para que el histórico siga mostrando cuánto se atrasó incluso después de cerrado).

---

## 4. Roles y permisos

| Rol (id) | Permisos `vales.*` | Puede hacer |
|---|---|---|
| Administrador (1) | todos | Todo — bypasa todas las validaciones de "dueño"/"a mi cargo" en el service (`esAdministrador()`) |
| Asesor de Ventas (3) | `ver, crear, editar, confirmar, solicitar_modificacion` | Crear vales, confirmar venta, cancelar, solicitar modificación (solo sobre sus propios vales) |
| Supervisor de Ventas (4) | `ver, supervisar, aprobar_modificacion` | Solo lectura + aprobar/rechazar modificaciones. **No** tiene `confirmar` ni `crear` — el análisis original tiene un párrafo contradictorio que le da acciones de asesor; se resolvió a favor de "no realiza mayor acción, más que todo control", que es la descripción de rol dominante en el documento |
| Encargado de Diseño (5) / Encargado de Diseño UV/3D (6) | `ver, asignar, revisar` | Comparten un buzón; cada uno solo puede asignar a sus propios técnicos (`usuarios.encargado_id`) |
| Técnico de Diseño (7) | `ver, trabajar` | Comenzar/entregar/cancelar únicamente sus vales asignados |
| Diseñador (2) | `ver, editar` (legacy) | Rol preexistente del portal, no participa en el flujo de actores de Vales de Arte — se dejó intacto para no romper Prompts |

Todos los permisos se validan con `requirePermission('vales.xxx')` en `routes.js` **y además** con checks de pertenencia dentro de `valeService.js` (ej. `_assertPropioDelAsesor`, `_assertTecnicoAsignado`) — un asesor autenticado no puede confirmar el vale de otro asesor aunque adivine el ID.

---

## 5. Persistencia: schema real + mock con fallback

- **Schema real** (`database/schema.sql`): tablas `vales`, `vale_asignaciones`, `vale_propuestas`, `vale_documentos`, `vale_historial`, `asesor_limites`, `localidades`, `vale_productos/materiales/tecnicas/acabados`, más las columnas nuevas `usuarios.telefono/localidad_id/encargado_id` y los roles/permisos 4–7 y 9–15.
- **Mock** (`src/config/database.js`): espejo exacto de esas mismas tablas como arrays en memoria, con semillas idénticas a las del `schema.sql` (7 vales de demostración cubriendo todos los estados, 9 usuarios cubriendo los 7 roles).
- **Mecanismo de fallback** (ya existía antes de este módulo, se extendió): `initializeDatabase()` intenta conectar a MySQL; si falla, `useMock = true` y **todas** las queries pasan por el mock automáticamente. Es transparente para los repositorios — no hay ningún `if (useMock)` fuera de `database.js`.
- **Sistema de tags**: cada llamada a `db.query(sql, params, tag)` incluye un tercer argumento opcional. MySQL real lo ignora (corre el SQL parametrizado tal cual). El mock lo usa para saber *exactamente* qué operación ejecutar en memoria, en vez de intentar parsear el SQL dinámico — esto es lo que hace viable tener ~20 operaciones distintas del módulo sin que el mock sea frágil. Ejemplo:

  ```js
  // repository
  await db.query('UPDATE vales SET estado = ? WHERE id = ?', [estado, id], 'vale:update_estado');

  // database.js — taggedHandlers
  'vale:update_estado': (params) => {
    const [estado, id] = params;
    const v = mockDatabase.vales.find(x => x.id === Number(id));
    if (v) { v.estado = estado; v.actualizado_en = ahoraLocal(); }
    return { affectedRows: v ? 1 : 0 };
  },
  ```

  **Regla al agregar una query nueva**: el orden de los parámetros en el array que pasa el repositorio debe coincidir posicionalmente con lo que desestructura el handler del tag. Un desajuste (ej. un literal SQL como `'CONFIRMACION_MODIFICACION'` que también es un `?` ligado) corrompe la escritura del mock *sin lanzar ningún error* — este bug apareció y se corrigió durante el desarrollo de v1 en `vale:solicitar_modificacion`.

  **Regla de seguridad**: cualquier handler que devuelva filas de `usuarios` debe despojar `password_hash` explícitamente (`sinPasswordHash()`), porque el mock ignora la lista de columnas del `SELECT` real y devolvería el objeto completo tal cual está en memoria.

---

## 6. Generación de PDF

`valePdfService.js`, usando **pdf-lib** (sin dependencias nativas, apto para hosting administrado):

- Se regenera en dos momentos: al crear el vale y al solicitar una modificación.
- Layout: encabezado (VALE DE ARTE / correlativo / logo), tablas de asesor / cliente / venta, sección de boceto y descripción con imágenes (máx. 3 por fila), numeración `actual/total` si hay más de una página.
- Si el vale tiene una modificación, la sección de boceto se duplica: primero el bloque nuevo enmarcado en `********** MODIFICACION **********`, luego el bloque original — tal como pide el análisis.
- Los documentos PDF adjuntos (no las imágenes) se fusionan página por página al final del PDF generado vía `pdfDoc.copyPages(...)`.
- **Limitación conocida**: imágenes `webp` no se pueden incrustar directamente (pdf-lib solo soporta JPG/PNG nativamente). Si un adjunto es webp, el PDF muestra un recuadro con el nombre del archivo en vez de la imagen, en lugar de fallar la generación completa. Ver sección 9.
- El binario del PDF **nunca se guarda en la base de datos** — se sube a `uploads/` vía `fileStorage.js` y solo se persiste la ruta relativa en `vales.pdf_url`.

---

## 7. Adjuntos (imágenes y documentos)

- Subida vía `multer` (memoria, no disco temporal) en las rutas de creación y de solicitud de modificación.
- Validación de tipo/tamaño en el controlador: imágenes `jpg/jpeg/png/webp` ≤ 2MB, documentos `application/pdf` ≤ 3MB.
- Metadatos en `vale_documentos` (`tipo`, `mime_type`, `tamano`, `es_modificacion`, `subido_por`); el archivo físico va a `uploads/<hash>.<ext>` vía `fileStorage.saveFile()`.
- `es_modificacion` distingue los adjuntos originales de los añadidos en la solicitud de modificación, para que el PDF pueda mostrar ambos bloques por separado.

---

## 8. Endpoints (`/api/vales`, todos detrás de `requireAuth` + `requirePermission`)

| Método y ruta | Permiso | Acción |
|---|---|---|
| `GET /catalogos` | `vales.ver` | Localidades, productos, materiales, técnicas, acabados |
| `GET /limite-restante` | `vales.crear` | Vales restantes del día para el asesor autenticado |
| `GET /tecnicos` | `vales.asignar` | Técnicos asignables (propios del encargado, o todos si es admin) |
| `GET /` | `vales.ver` | Buzón — el service despacha por `rolId` |
| `POST /` | `vales.crear` | Crear vale (multipart: campos + `imagenes[]` + `documentos[]`) |
| `GET /:id` | `vales.ver` | Detalle + asignaciones + propuestas + documentos + historial |
| `GET /:id/pdf` | `vales.ver` | Redirige al PDF generado |
| `POST /:id/asignar` | `vales.asignar` | `{ tecnicoId }` |
| `POST /:id/comenzar` | `vales.trabajar` | Técnico marca `EN_PROCESO` |
| `POST /:id/entregar` | `vales.trabajar` | Multipart opcional `propuesta` (PDF) |
| `POST /:id/cancelar-proceso` | `vales.trabajar` | Propuesta en blanco, vuelve a `EN_REVISION` |
| `POST /:id/revisar` | `vales.revisar` | `{ aprobar, tecnicoReasignadoId? }` |
| `POST /:id/confirmar` | `vales.confirmar` | Asesor → `VENDIDO` |
| `POST /:id/cancelar` | `vales.confirmar` | Asesor → `CANCELADO` |
| `POST /:id/solicitar-modificacion` | `vales.solicitar_modificacion` | Multipart: `justificacion`, `descripcion`, adjuntos nuevos |
| `POST /:id/aprobar-modificacion` | `vales.aprobar_modificacion` | Supervisor → `MODIFICADO` |
| `GET /carga-trabajo` | `vales.asignar` | Resumen por técnico del encargado autenticado |
| `GET /carga-trabajo/:tecnicoId` | `vales.asignar` | Detalle de asignaciones activas de un técnico |

---

## 9. Reglas de negocio específicas

- **Límite diario del asesor** (`asesor_limites.limite_diario`, default 6): al alcanzarlo, el vale **no se bloquea** — se crea igual pero con `fecha_creacion` del día siguiente. Es un requisito literal del análisis, no un bug.
- **Correlativo**: `LOCALIDAD-ASESOR_ID-SECUENCIA` (ej. `GUA-3-0001`), secuencia acumulada por asesor (no reinicia por día). La modificación antepone `MOD-`.
- **Ventana de tiempo** (día/semana/mes/todo) filtra el buzón y algunos contadores por `fecha_creacion`, sin alterar el orden de aparición dentro de cada grupo.
- **Orden del buzón**: cada rol tiene su propia jerarquía de grupos (ver `_buzonAsesor`, `_buzonSupervisor`, `_buzonEncargado`, `obtenerBuzonTecnico` en `valeService.js`); dentro de cada grupo, primero atrasados, luego urgentes, luego por cercanía a `fecha_entrega`.

---

## 10. Frontend

- **Una sola vista adaptativa** (`public/modules/vales/{index.html,js/app.js}`) en vez de 4 páginas por rol — las columnas del buzón son idénticas en el análisis para los 4 roles, solo cambian contadores, orden y acciones disponibles, así que se parametriza por `rolId` en vez de duplicar HTML.
- Vanilla JS sin build step, mismo patrón que `public/js/dashboard.js`; modales inyectados dinámicamente (`abrirModal()`), sin librería externa.
- Socket.IO: todos los clientes del módulo se unen a un único canal `'vales'` (`socket.emit('register_module', 'vales')`); al recibir `vale_evento` se muestra un toast, un beep (Web Audio API, sin asset externo) y se refresca el buzón. Se prefirió un canal compartido simple sobre salas por usuario/rol para evitar sincronización frágil.
- Estilo: extiende `public/css/dashboard.css` → `public/css/global.css` (mismos tokens de color/tipografía que login y dashboard).

---

## 11. Integración con el resto del portal

- `src/app.js`: monta `app.use('/api/vales', requireAuth, valeRoutes)`; el catálogo dinámico de `/api/modules` ya incluía la entrada de `vales` (preexistente), sin cambios ahí.
- `public/js/dashboard.js`: se eliminó el `preventDefault()` + `alert()` que bloqueaba la navegación a los módulos — la tarjeta "Vales de Arte" ahora navega de verdad a `/modules/vales`.
- No se tocó el módulo de autenticación excepto **un bug preexistente**: los hashes bcrypt sembrados para `admin123`/`diseno123`/`ventas123` eran inválidos (no correspondían a esas contraseñas), lo cual estaba enmascarado por un bypass hardcodeado en `authService.js` solo para admin. Se regeneraron los hashes correctos y se quitó el bypass — login de asesor/diseñador estaba roto de fábrica antes de este cambio.

---

## 12. Credenciales de prueba (semilla)

| Correo | Contraseña | Rol |
|---|---|---|
| `admin@munditrofeos.com` | `admin123` | Administrador |
| `diseno@munditrofeos.com` | `diseno123` | Diseñador (legacy) |
| `ventas@munditrofeos.com` | `ventas123` | Asesor de Ventas |
| `supervisor@munditrofeos.com` | `supervisor123` | Supervisor de Ventas |
| `encargado.diseno@munditrofeos.com` | `disenoenc123` | Encargado de Diseño |
| `encargado.uv3d@munditrofeos.com` | `uv3denc123` | Encargado de Diseño UV/3D |
| `tecnico.a@munditrofeos.com` | `tecnico123` | Técnico (bajo Encargado de Diseño) |
| `tecnico.b@munditrofeos.com` | `tecnico123` | Técnico (bajo Encargado de Diseño) |
| `tecnico.c@munditrofeos.com` | `tecnico123` | Técnico (bajo Encargado UV/3D) |

---

## 13. Fuera de alcance / posibles siguientes pasos (v2)

- Incrustar imágenes `webp` en el PDF (requeriría una librería de conversión, ej. `sharp`, que trae dependencias nativas — se evitó deliberadamente en v1 para no complicar el despliegue en hosting administrado).
- Filtros de columna más finos en el buzón (hoy: texto libre + estado; el análisis menciona filtros por columna en general).
- Panel de administración para gestionar catálogos (productos/materiales/técnicas/acabados) y el límite diario por asesor — hoy solo se editan directamente en el seed/BD.
- Paginación del buzón (v1 carga todos los vales del rol en cada consulta; aceptable al volumen actual de datos de prueba, a revisar si crece significativamente).
- Reasignación de país/localidad por usuario vía UI (hoy `usuarios.localidad_id`/`encargado_id` solo se configuran por seed o acceso directo a BD).
