# Módulo Administración Central

Gestión de usuarios, roles, permisos, talleres y tiendas del portal, más herramientas de operación: modo mantenimiento, horarios laborales y feriados, y generación de PDF de vales de corrección. Solo el Administrador (rol_id 1) tiene la mayoría de estas acciones.

## Dependencias

- **Montaje:** `/api/admin` con `requireAuth` + `requirePermission('admin.ver')` en `src/app.js`; frontend en `/modules/admin`. El estado del modo mantenimiento lo lee además `GET /api/mantenimiento/estado` (fuera de este módulo).
- **Servicios del core:** `permissions` (incluye `maintenanceMiddleware.js`), `auth`, `calendario` (se invalida al cambiar horarios/feriados), `files` (Supabase Storage para los PDF generados), `websocket`.
- **Reutiliza** `src/modules/vales/services/valePdfService.js` (`generarPdfVale`) para la herramienta «Crear Vale de Arte».
- **Tablas:** `usuarios`, `roles`, `permisos`, `talleres`, `taller_local_tiendas`, `asesor_supervisores`, `tiendas`, `mantenimiento_config`, `horarios_laborales`, `feriados`, `parametros_sistema`, `vale_pdf_generados`.
- **Permisos:** `admin.ver`, `admin.horarios.gestionar`, `admin.vales.generar` y el resto `admin.*`; definidos en `database/seed.sql` y asignados al Administrador.
- **Variables de entorno:** solo las globales de `.env`.
- No tiene `events.js`; el aviso de mantenimiento viaja por `socketManager` (`mantenimiento_programado`, `mantenimiento_cancelado`, `sesion_revocada`).

## Dónde está el código

- Backend: `src/modules/admin/` (`controllers/adminController.js`, `adminHorarioController.js`, `adminValePdfController.js`; `services/` (incluye `supervisionAsesorService.js`); `repositories/`; `routes.js`).
- Frontend: `public/modules/admin/` (`js/app.js` y `js/views/`: `usuarios`, `roles`, `talleres`, `tiendas`, `mantenimiento`, `horarios`, `crearVale`, `propuestasCompartidas`; `actions/tallerTiendas.js` para las tiendas de un Local; `actions/supervisionAsesor.js` para la supervisión especial).
- Aviso de mantenimiento para los demás usuarios: `public/js/mantenimientoAviso.js`.

## Reglas clave

- **Modo mantenimiento:** activarlo inicia una cuenta regresiva de 10 minutos; al llegar a 0 `maintenanceGate` bloquea (503) a los no administradores y se cierran sus filas de `sesiones_activas`. `/api/auth` se monta antes del gate. Detalle y pasos de producción (importar `mantenimiento_cuenta_regresiva.sql` **antes** de desplegar): [`documentacion/mantenimiento_cuenta_regresiva.md`](documentacion/mantenimiento_cuenta_regresiva.md).
- **Horarios y feriados:** CRUD del horario semanal global (`horarios_laborales`, 7 filas; un día no laboral no lleva horas) y de los feriados por país (`feriados`, opcionalmente anuales). Los plazos y la fecha de entrega de los vales sí los leen a través de `src/core/calendario/`; cada cambio invalida su caché. La misma pestaña trae «Diseño Local entre países»: un interruptor por país (`paises.comparte_diseno_local`, `PUT /horarios/paises/:id/comparte-diseno-local`, permiso `admin.horarios.gestionar`) para que sus asesores usen los Diseño Local de otros países que también lo tengan activo y sus Diseño Local se ofrezcan a ellos (Guatemala queda en 0). Reglas: módulo vales, `diseno_local_entre_paises.md`. Detalle: [`documentacion/horarios_feriados.md`](documentacion/horarios_feriados.md).
- **Asistentes por taller:** los asistentes (rol 7 y los de UV/3D, Protextil y Diseño Local) son roles con `roles.hereda_de_rol_id` apuntando al rol de su encargado. Detalle: [`documentacion/asistentes_por_taller.md`](documentacion/asistentes_por_taller.md).
- **Tiendas de un Diseño Local (Gestionar Talleres, icono de tienda):** un Local tiene una tienda principal o sede (`talleres.tienda_id`: marca «es Local», país, feriados y código de los archivos; puede repetirse entre Locales) y un nombre libre que escribe el administrador al crearlo (`POST /talleres` con `{ nombre, tiendaId, encargadoId? }`: obligatorio, sin espacios al inicio ni al final, máximo 100 caracteres y único; el service responde con mensajes explicativos antes del error de MySQL) y atiende las tiendas de `taller_local_tiendas`. `crearLocal` escribe la sede ahí en la misma transacción. La acción «Asignar tiendas» (`GET/POST /talleres/:id/tiendas`, `DELETE /talleres/:id/tiendas/:tiendaId`; escribir exige `admin.talleres.gestionar`) agrega tiendas activas de cualquier país y aunque ya las use otro Local; la sede no se puede quitar. Quitar una tienda solo afecta a los vales nuevos: los vales abiertos conservan sus filas de `vale_talleres`. Solo los Locales tienen tiendas asignadas; un general atiende a todas.
- **Propuestas compartidas (pestaña propia):** define `talleres.comparte_propuestas` por taller (`GET /talleres/propuestas-compartidas`, `PUT /talleres/:id/comparte-propuestas` con `{ comparte: boolean }`; permiso `admin.talleres.gestionar`), agrupado en Talleres generales y Diseño Local por país (el de la tienda sede, como el calendario). Ninguna migración activa un Local: el valor lo cambia solo esta pestaña. La regla de grupo la aplica el módulo de vales al leer (ver `flujo_vale_de_arte.md`, sección 14).
- **Supervisión especial (Usuarios, icono de escudo en un asesor):** asigna al asesor los supervisores que autorizan sus vales en lugar de los de su tienda (`asesor_supervisores`; `GET/PUT /asesores/:id/supervisores` con `{ supervisorIds }`, que reemplaza el conjunto: vacío vuelve a los de la tienda; escribir exige `admin.tiendas.gestionar`). Valida asesor, supervisores existentes, activos, rol 3 con `vales.supervisar` y sin repetidos; avisa a los supervisores nuevos de cada vale que espera su acción y toma los candados de esos vales (409 de reintento si alguno está en uso). Detalle: `.agents/modulos/vales de arte/documentacion/supervision_por_asesor.md`.
- **Filtros de tienda (Usuarios y Tiendas):** usan el menú en cascada compartido con la fila «Todas — <país o grupo Trofex>»; se filtra en el cliente por el país, el grupo o la tienda elegidos (un usuario sin tienda no coincide con un país o un grupo). Los formularios y el filtro de roles siguen exigiendo un solo valor.
- **Modales de personal (tiendas y talleres):** «Gestionar personal» no se cierra al agregar o quitar a alguien: avisa con un toast, actualiza la lista de la página al fondo y repinta el mismo modal con los datos nuevos (en tiendas conserva la categoría elegida). Solo la X, Escape, el fondo o «Cerrar» lo cierran. Los modales de solo lectura («Ver personal») no cambian.
- **Supervisores por permiso:** es supervisor quien tiene un rol con `vales.supervisar`, no solo el rol 3; ese permiso se puede asignar a cualquier rol (el rol 3 lo conserva). «Gestionar personal» de una tienda ofrece como candidatos a los usuarios activos con ese permiso (`es_supervisor` en `GET /usuarios`), «Ver personal» muestra su cobertura (`supervisor_tiendas`) y los roles nuevos aparecen al final de los selectores de rol. Crear o editar usuario sigue tratando solo al rol 3 como supervisor (fila en `supervisores` y teléfono).
- **Crear Vale de Arte** (herramienta de corrección, solo Administrador): ver [`documentacion/crear_vale_de_arte.md`](documentacion/crear_vale_de_arte.md). Nunca crea ni edita un vale.
- Los permisos se validan en el backend; ocultar una pestaña en el frontend no es control de acceso.

## Roles del sistema

- `rol_id` 1: Administrador.
- 2: Asesor.
- 3: Supervisor.
- 4: Encargado de Diseño.
- 5: Encargado de Diseño UV/3D.
- 6: Diseñador.
- 7: Asistente.
- 8: Gerente.
- 9: Encargado de Protextil.
- 10: Encargado de Diseño Local.
- Los asistentes heredan el rol de su encargado (`roles.hereda_de_rol_id`): ver [`documentacion/asistentes_por_taller.md`](documentacion/asistentes_por_taller.md).

## Documentos del módulo (`documentacion/`)

- [`mantenimiento_cuenta_regresiva.md`](documentacion/mantenimiento_cuenta_regresiva.md): modo mantenimiento con cuenta regresiva.
- [`horarios_feriados.md`](documentacion/horarios_feriados.md): pestaña «Horarios y feriados».
- [`asistentes_por_taller.md`](documentacion/asistentes_por_taller.md): herencia de rol de los asistentes.
- [`crear_vale_de_arte.md`](documentacion/crear_vale_de_arte.md): pestaña «Crear Vale de Arte».
- [`refactor_app_js.md`](documentacion/refactor_app_js.md): refactorización de `public/modules/admin/js/app.js` en capas.
