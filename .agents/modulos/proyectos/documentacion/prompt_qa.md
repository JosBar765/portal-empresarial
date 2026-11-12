# Prompt de QA del módulo Proyectos

Prompt listo para pegar a un agente de QA. Está adaptado al módulo Proyectos del portal MundiTrofeos; las contraseñas no se guardan aquí.

---

Actúa como un ingeniero de QA (aseguramiento de la calidad) senior. Tu objetivo es probar a fondo el módulo **Proyectos** del portal empresarial, encontrar todos los errores y asperezas posibles, y entregarme un reporte priorizado con recomendaciones para dejarlo correcto y listo para producción.

## Contexto de la aplicación
- **Propósito:** Proyectos reparte cada mes las empresas de un nicho (por ejemplo, Bancos y cooperativas) entre los asesores de ventas de las tiendas elegidas. Los asesores contactan y registran gestiones, cotizaciones y ventas; el supervisor prepara, activa, da seguimiento y cierra el proyecto; el gerente aprueba activaciones y da el visto bueno a los cierres; el administrador configura todo sin programar.
- **Tecnologías:** monolito modular Node/Express; MySQL 8.4 en desarrollo y MariaDB 11.8 en producción; Socket.IO; frontend en JavaScript vanilla con módulos ES (sin frameworks, sin bundler, sin TypeScript); Supabase Storage para archivos. Sin linter ni suite de pruebas unitarias: la verificación son los scripts `scripts/proyectos/verificar-*.js` (cada uno exige una base desechable) y `npm run ci:sintaxis`.
- **URL local:** `http://localhost:3030` (módulo en `/modules/proyectos/`). Base de pruebas: `portal_empresarial` en el contenedor `portal_empresarial_mysql` (puerto 3307). Solo se permite una sesión por usuario: cierra sesión con el botón del portal al cambiar de rol.
- **Credenciales de prueba** (cuentas de desarrollo de `database/users.sql`; la contraseña del administrador te la da el dueño): administrador `admin@grupopremia.com`; gerente `gerente@grupopremia.com`; supervisor `ventas1@grupopremia.com` (Carlos Cornejo, supervisa la tienda MTC); asesores `ventas2@`, `ventas3@`, `ventas4@grupopremia.com`. Las contraseñas de gerente, supervisor y asesor están en el encabezado de `database/users.sql`.
- **Roles y permisos:** administrador (rol 1), asesor (2), supervisor (3), gerente (8). Los permisos son `proyectos.*` (ver, gestionar, clientes.registrar, clientes.importar, activar, reasignar, supervisar, ver_gerencia, dar_visto_bueno, ver_reportes, corregir, aprobar_activacion, confirmar_ventas, administrar). El mapa vive en `src/modules/proyectos/permisosPorRol.js` y se asigna en Administración › Roles. Los demás roles (diseñadores, encargados, asistentes) no deben ver el módulo.
- **Pantallas (rutas `#/…`):** asesor: `miproyecto`, `parahoy`, `empresa/:id`, `anteriores`; todos: `clientes` (Cartera), `ganados`; `importar`; supervisor: `proyectos`, `proyectos/nuevo` (asistente de 4 pasos), `seguimiento`, `participacion/:id`, `ventas`; gerencia: `panel`, `vistobueno`, `aprobaciones`; administrador: `inicio`, `parametros`, `plantillas`, `reglas`, `notificaciones`, `kit`, `campos`, `plan`, `alcance`, `historial`, `catalogos`. Además: la integración con Vales de Arte (botón «Crear vale», vínculo en `proy_vales`), exportaciones CSV/PDF y avisos por la campana y Socket.IO.
- **Reglas de negocio importantes:**
  - Una empresa solo puede estar en un proyecto activo; una tienda solo en un proyecto activo a la vez.
  - Reparto equitativo (a la persona con menos); tope por asesor (1–500) y lo que sobra queda en reserva; rondas de reserva para quien lleva ≥ 80 % (parámetro 1–100) de gestión.
  - El reparto respeta el país de la tienda; las empresas «no contactar» no entran; una empresa con venta reciente descansa N meses (0–36).
  - El estado de la empresa solo sube: pendiente → en gestión → interesada → cotizada → vendida; perdida y descartada son explícitas.
  - Los registros solo se agregan; el supervisor anula con motivo y todo se recalcula. Una venta anulada no cuenta.
  - Con la confirmación de ventas encendida, la venta queda «por confirmar» y no cuenta hasta que el supervisor confirme.
  - Con la aprobación encendida, el supervisor «pide» activación y el proyecto no se reparte hasta que el gerente apruebe. Con el visto bueno encendido, el cierre espera al gerente (puede devolverlo con comentario).
  - Metas: parte igual entre asesores, ajustables; el avance cuenta solo ventas confirmadas en la moneda de la meta; nunca se mezclan monedas.
  - Un proyecto cerrado es de solo lectura; su informe se congela.
  - La configuración aplica a proyectos nuevos; los activos conservan la copia con la que nacieron.
  - Acciones críticas (borrado en Storage, correos, push, llamadas externas) solo se ejecutan en producción.
  - Identidad siempre desde `req.user`, nunca desde el cuerpo o la consulta; los permisos se aplican en el backend; las respuestas de negocio nunca son 401 (la interfaz lo trata como sesión expirada), usan 403.
- **Datos de prueba:** 130 empresas de demostración y 195 contactos (nichos Bancos y cooperativas, Colegios, Iglesias, Gasolineras; Guatemala, El Salvador y Honduras). Todo se borra al terminar.

## Reglas de trabajo
1. NO modifiques código ni datos sin mi aprobación; primero reporta. Las únicas escrituras permitidas son los datos de prueba del propio módulo (proyectos, gestiones, ventas de demostración) y se limpian al final.
2. Usa solo el entorno local y los datos de demostración. Nunca toques staging, producción ni las ramas `dev`, `staging` o `main`; no hagas push ni commits.
3. Cada hallazgo debe ser reproducible: pasos exactos, entrada usada, resultado esperado y resultado obtenido.
4. Si algo no lo puedes probar, dilo explícitamente y explica por qué (por ejemplo, las acciones críticas fuera de producción o el envío real de mensajes).

## Fase 1 — Pruebas estáticas (sin ejecutar)
- Revisa `src/modules/proyectos/` (controladores, servicios, repositorios, rutas, eventos), `public/modules/proyectos/`, las migraciones 33 a 43 y `.agents/modulos/proyectos/`.
- Verifica las convenciones: controladores solo HTTP; servicios sin SQL ni `req`/`res`; todo el SQL en repositorios y parametrizado; errores por `responderError`; ids por `idObligatorio`/`idOpcional`; rutas protegidas después de `authenticateJWT`; cada ruta con `requirePermission`.
- Busca: validaciones faltantes, manejo de errores ausente, `error.message` de MySQL devuelto al cliente, código muerto, credenciales expuestas, SQL vulnerable, dependencias vulnerables, inconsistencias entre la documentación y lo implementado, migraciones no idempotentes y compatibilidad MySQL/MariaDB.

## Fase 2 — Pruebas unitarias (caja blanca)
- Funciones críticas: reparto equitativo y reservas, normalización y duplicados de empresas (`duplicados.js`), cálculo de estados, metas y avance, informe de cierre, validación de parámetros (`parametros.js`), plan del año y activación automática, importación CSV.
- Ejecuta los `verificar-*.js` existentes sobre una base desechable y reporta cuáles fallan; estima cobertura de ramas (cada `if` por su lado verdadero y falso) y propón los casos faltantes sin escribirlos en el repositorio hasta que yo los apruebe.

## Fase 3 — Pruebas de integración
- Frontend ↔ API ↔ base de datos ↔ Socket.IO ↔ Storage: formatos entre capas, códigos HTTP, manejo de errores cuando un servicio falla o tarda, transacciones sin datos a medias (activar, reasignar, importar, cerrar), idempotencia (`idempotencyKey`) y concurrencia (dos supervisores con tiendas en común activando a la vez; reasignaciones simultáneas).
- Integración con Vales de Arte: prefill por `?prellenar=proyectos:<id>`, vínculo en `proy_vales`, vale ajeno o inexistente, vale repetido, proyecto cerrado.

## Fase 4 — Pruebas de sistema (caja negra) — flujos completos
Para CADA rol (administrador, supervisor, asesor, gerente):
- **Camino feliz completo:** configurar → importar/registrar empresas → crear proyecto (4 pasos) → pedir aprobación → aprobar → asesores gestionan, cotizan y venden → supervisor confirma, reasigna, ajusta metas, reparte reserva y anula → cierre → visto bueno (incluida una devolución con reenvío) → exportaciones PDF/CSV → proyectos anteriores y clientes ganados.
- **Flujos alternos y de excepción:** guardar borrador y retomar, volver atrás en el asistente, recargar a mitad de un paso, doble clic en «Guardar»/«Activar», sesión expirada, cancelar con cambios sin guardar, cerrar ventanas al cambiar de pantalla.
- **Partición de equivalencia y valores límite** (mínimo−1, mínimo, máximo y máximo+1) por campo: tope por asesor (1–500), umbral de reserva (1–100), descanso (0–36), meta de venta, existencia de muestras, fechas del proyecto y etapas (inicio > fin, fuera de mes), cantidad de la muestra (más que la existencia), montos de cotización y venta (0, negativos, decimales, muy grandes), referencias duplicadas, descripción (600 caracteres), CSV (0, 1, 2000 y 2001 filas; 5 MB y 5 MB + 1; separadores, codificación y encabezados incorrectos).
- **Entradas especiales:** vacíos, solo espacios, textos muy largos, ñ, tildes y emojis, HTML/JS en nombres y notas, números negativos, fechas inválidas, archivos de tipo incorrecto.
- **Permisos:** con cada rol, abrir directamente las URLs y endpoints de los otros roles (por ejemplo, un asesor abriendo `#/seguimiento` o llamando `/api/proyectos/...` de supervisión; un supervisor sobre tiendas ajenas; un gerente intentando reasignar o anular; roles sin permiso entrando al módulo). Verifica respuestas 403/404 sin filtrar datos.

## Fase 5 — Pruebas no funcionales
- **Rendimiento:** tiempos de carga de cada pantalla y de las consultas con 130 y con miles de empresas (repartir, seguimiento, panel gerencial, exportaciones); varios usuarios simultáneos.
- **Seguridad:** inyección SQL, XSS almacenado en nombres, notas y plantillas del kit, CSRF y cookies (`httpOnly`, `sameSite`, `Secure` en staging y producción), tokens y refresh, IDOR sobre ids de empresas, participaciones y proyectos, mensajes de error que revelen datos internos, cabeceras de seguridad, contraseñas con hash.
- **Usabilidad:** claridad de mensajes, consistencia visual, navegación (barra lateral con categorías, modo colapsado con ventanita y tooltips, cajón móvil), retroalimentación (cargando, éxito, error), aviso falso de «cambios sin guardar» al salir del Kit.
- **Compatibilidad y responsividad:** escritorio (1366 px), tableta y móvil (390 px); Chrome y al menos un navegador más (Brave o Edge).
- **Accesibilidad:** contraste, etiquetas de formularios, navegación con teclado y Esc, `aria-expanded`, foco visible.

## Fase 6 — Pruebas de aceptación
- Valida con los manuales de usuario por rol (`.agents/modulos/proyectos/manuales/`) y la documentación del módulo si el sistema resuelve la necesidad: ¿el supervisor puede preparar y cerrar un mes sin ayuda?, ¿el asesor sabe qué hacer cada día?, ¿el gerente decide con la información que ve?
- Señala pantallas confusas, funciones incompletas o textos que no coinciden con el comportamiento. Casos ya vistos que debes confirmar: el artículo sugerido por el plan del año no llega al paso 3 del asistente; el falso aviso de cambios sin guardar del Kit.

## Fase 7 — Regresión
- Tras cada corrección que yo apruebe, vuelve a ejecutar las pruebas afectadas y `npm run ci:sintaxis`, en MySQL y en MariaDB cuando haya cambios de SQL.

## Formato del entregable
1. **Resumen ejecutivo:** estado general, total de hallazgos por severidad y veredicto (¿listo para producción?).
2. **Tabla de hallazgos:** ID | Fase/Tipo | Módulo o pantalla | Descripción | Pasos para reproducir | Resultado esperado | Resultado obtenido | Severidad (Crítica/Alta/Media/Baja) | Prioridad | Recomendación.
3. **Tabla de casos ejecutados:** ID | Pantalla o flujo | Técnica | Entrada | Resultado esperado | Resultado obtenido | Estado (Pasó/Falló/Bloqueado).
4. **Matriz de cobertura:** pantallas, reglas de negocio y roles probados y pendientes.
5. **Plan de corrección priorizado:** primero seguridad y pérdida de datos, luego lo funcional, al final lo cosmético.
6. **Mejoras sugeridas:** UX, rendimiento y mantenibilidad.

Empieza confirmando que entendiste el contexto, haz un inventario de pantallas, endpoints y flujos del módulo y presenta tu plan de pruebas antes de ejecutar.
