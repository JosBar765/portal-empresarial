# Módulo Administración Central

Gestión de usuarios, roles, permisos, talleres y tiendas del portal, más herramientas de operación: modo mantenimiento, horarios laborales y feriados, y generación de PDF de vales de corrección. Solo el Administrador (rol_id 1) tiene la mayoría de estas acciones.

## Dependencias

- **Montaje:** `/api/admin` con `requireAuth` + `requirePermission('admin.ver')` en `src/app.js`; frontend en `/modules/admin`. El estado del modo mantenimiento lo lee además `GET /api/mantenimiento/estado` (fuera de este módulo).
- **Servicios del core:** `permissions` (incluye `maintenanceMiddleware.js`), `auth`, `calendario` (se invalida al cambiar horarios/feriados), `files` (Supabase Storage para los PDF generados), `websocket`.
- **Reutiliza** `src/modules/vales/services/valePdfService.js` (`generarPdfVale`) para la herramienta «Crear Vale de Arte».
- **Tablas:** `usuarios`, `roles`, `permisos`, `talleres`, `tiendas`, `mantenimiento_config`, `horarios_laborales`, `feriados`, `parametros_sistema`, `vale_pdf_generados`.
- **Permisos:** `admin.ver`, `admin.horarios.gestionar`, `admin.vales.generar` y el resto `admin.*`; definidos en `database/seed.sql` y asignados al Administrador.
- **Variables de entorno:** solo las globales de `.env`.
- No tiene `events.js`; el aviso de mantenimiento viaja por `socketManager` (`mantenimiento_programado`, `mantenimiento_cancelado`, `sesion_revocada`).

## Dónde está el código

- Backend: `src/modules/admin/` (`controllers/adminController.js`, `adminHorarioController.js`, `adminValePdfController.js`; `services/`; `repositories/`; `routes.js`).
- Frontend: `public/modules/admin/` (`js/app.js` y `js/views/`: `usuarios`, `roles`, `talleres`, `tiendas`, `mantenimiento`, `horarios`, `crearVale`).
- Aviso de mantenimiento para los demás usuarios: `public/js/mantenimientoAviso.js`.

## Reglas clave

- **Modo mantenimiento:** activarlo inicia una cuenta regresiva de 10 minutos; al llegar a 0 `maintenanceGate` bloquea (503) a los no administradores y se cierran sus filas de `sesiones_activas`. `/api/auth` se monta antes del gate. Detalle y pasos de producción (importar `mantenimiento_cuenta_regresiva.sql` **antes** de desplegar): [`documentacion/mantenimiento_cuenta_regresiva.md`](documentacion/mantenimiento_cuenta_regresiva.md).
- **Horarios y feriados:** CRUD del horario semanal global (`horarios_laborales`, 7 filas; un día no laboral no lleva horas) y de los feriados por país (`feriados`, opcionalmente anuales). Los plazos y la fecha de entrega de los vales sí los leen a través de `src/core/calendario/`; cada cambio invalida su caché. Detalle: [`documentacion/horarios_feriados.md`](documentacion/horarios_feriados.md).
- **Asistentes por taller:** los asistentes (rol 7 y los de UV/3D, Protextil y Diseño Local) son roles con `roles.hereda_de_rol_id` apuntando al rol de su encargado. Detalle: [`documentacion/asistentes_por_taller.md`](documentacion/asistentes_por_taller.md).
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
