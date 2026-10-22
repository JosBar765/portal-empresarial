# Pestaña «Crear Vale de Arte» (Administración)

Herramienta de corrección: construye el PDF de un vale a partir de campos arbitrarios, lo sube a Storage y muestra el enlace. **Nunca crea ni edita un vale** ni toca `vales.pdf_url` (el dueño lo actualiza a mano).

## Dónde está

- Frontend: `public/modules/admin/js/views/crearVale.js`.
- Backend: `src/modules/admin/controllers/adminValePdfController.js`, `services/adminValePdfService.js`, `repositories/valePdfGeneradoRepository.js`; reutiliza `valePdfService.generarPdfVale` del módulo de vales.
- Permiso `admin.vales.generar` (solo Administrador). Tabla `vale_pdf_generados` y permiso, en el script `admin_generar_vale.sql` (`database/migrations/`).

## Reglas

- Pide primero la contraseña de la cuenta (`bcrypt.compare`). Una contraseña incorrecta responde **403**, no 401, porque `sessionGuard.js` trata cualquier 401 de `/api/` como sesión vencida. 5 fallos en 15 minutos por usuario bloquean solo esta acción.
- Registra cada PDF generado en `vale_pdf_generados` (el correlativo y tipo se cuentan desde esa tabla; ver `vales de arte/documentacion/correlativo_documentos_supabase.md`).
- No aplica reglas de negocio del vale (domingo, 12:00, etc.).
