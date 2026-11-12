# Calculadora de Viáticos (módulo `viaticos`)

Rama: `module/viaticos`. NO se pushea hasta que lo pida el usuario. Fuente de verdad funcional: `.agents/modulos/viaticos/analisis_modulo.md` y `tabla_tramos.md`.

## Objetivo
Módulo nuevo para solicitar, autorizar y liquidar viáticos (viajes de 1 día o menos y de más de 1 día), con PDF «SOLICITUD DE VIÁTICOS» y catálogos administrables desde `Configuración`.

## Decisiones (usuario, 2026-11-11)
- Pestañas (sidebar): Solicitudes (`viaticos.ver`), Gestiones (`viaticos.gestionar`), Configuración (`viaticos.configurar`).
- `viaticos.autorizar` y `viaticos.liquidar` controlan solo la acción (botones dentro de Gestiones); sin `viaticos.gestionar` no se ve nada. Cada endpoint de acción exige su permiso.
- Estados lógicos: esperando autorización, rechazada, autorizada, liquidada, vencida. Pipeline de más de 1 día: Esperando autorización (rechazo = equis) → Autorizado → En curso/Terminado → Liquidado. Pipeline de 1 día o menos: Esperando autorización → Autorizado.
- `modificar` y `dar de baja` solo en solicitudes esperando autorización, rechazadas o vencidas. Dar de baja borra el registro y el PDF.
- Todo por país: cada persona tiene una lista de países (se asigna en `Configuración`); al crear la solicitud elige país y moneda. Tramos, vehículos, valores de comidas y reglas de licencia son por país. Gestión (gestionar/autorizar/liquidar/configurar) ve todos los países.
- Moneda: campo previo a la solicitud (dólar y monedas centroamericanas). Valor de desayuno, almuerzo y cena: uno por moneda, cargado en `Configuración` (sin tipo de cambio).
- Combustible: el usuario ingresa precio por galón y rendimiento; el costo de gasolina lo calcula el sistema.
- Licencia (supuesto, a confirmar): una sola por persona (número, tipo, vencimiento); las reglas del país de la solicitud deciden qué placa puede manejar.
- Vehículos de la empresa, vehículos propios, licencias, tarjeta de circulación, póliza, tramos y demás catálogos se administran en `Configuración`.
- Correlativo provisional `VIA-GT-000123`: prefijo fijo, código de país, secuencia independiente por país.
- Catálogo de tramos: 14 filas de prueba (horas = 8); el dueño completa el resto desde `Configuración`.
- Liquidación (dueño, confirmado): ni la depreciación de vehículos propios ni las comidas se liquidan ni cuentan en «solicitado a liquidar»; la depreciación se entrega al dueño del auto.
- Todo archivo (comprobantes, PDF de la solicitud, fotos de defectos) se abre con el visor de documentos de Vales (`visorDocumento.js`).
- PDF (dueño): una sola hoja en el caso normal; si las listas (tramos, hoteles, otros gastos) no caben, sigue en una segunda hoja con el mismo encabezado, y la caja TOTAL SOLICITADO y las firmas quedan juntas al final. Viaje de 1 día o menos: la hoja de imágenes solo existe si hay defectos. Todas las hojas llevan conteo de páginas al pie («n/total»), como el vale de arte. Sin límite de filas.
- Storage (dueño, 2026-11-12): todo archivo de viáticos va al bucket propio `SUPABASE_STORAGE_BUCKET_VIATICOS` (`supabaseStorage.viaticos`), con nombres como en Vales: PDF `<CORR>_CREACION`, `<CORR>_CORRECCION_PRE_AUTORIZACION_X` y `<CORR>_AUTORIZACION`; fotos `<CORR>_DEFECTO_CREACION_X` y `_CORRECCION_X`; comprobantes `<CORR>_LIQUIDACION_<RUBRO>_X`. La variable falta en `.env.example` (los permisos del dueño me impiden editarlo) y debe cargarse en el panel de Hostinger antes del merge.
- Autorización (dueño, TENTATIVO hasta que gerencia defina el proceso): al autorizar se regenera el PDF (`<CORR>_AUTORIZACION`) con el nombre de quien autorizó sobre la línea de Administración; el nombre del solicitante va sobre su línea desde la creación. F3.5 debe llamar `regenerarPdf(id, { etapa: 'AUTORIZACION' })` después de registrar el historial.
- Subagentes (dueño, 2026-11-12): no se fija un modelo más barato para ellos; se prioriza la calidad del trabajo sobre el ahorro de tokens. Se sigue el flujo de ODD con escritores delegados y revisión del padre.
- Base de datos: normalizada (al menos 3FN), sin catálogos hardcodeados.

## Fases
- [ ] F1 Mockups en Figma (solo diseño; el dueño aprueba antes de seguir)
  - [x] F1.1 Reconocimiento del sistema de diseño real (`global.css`, buzón y modales de vales, selector de ventana, pipeline, PDF de vales)
  - [x] F1.2 Archivo Figma + tokens/componentes base (46 variables, 12 estilos de texto, 4 sombras, componentes en la página `Base`)
  - [x] F1.3 Solicitudes (escritorio 6:52, 6:427, 6:515, 6:602; celular 7:417, 7:784, 7:846, 7:907). Verificado a ojo: escritorio con datos. Pendiente revisión del dueño
  - [x] F1.4 Modal de solicitud: más de 1 día (página `Modal solicitud`; escritorio 14:61 propio, 14:492 empresa, 14:911 errores, 14:1207 vacío; celular 14:1400, 14:1788). Aritmética verificada en 14:492. Pendiente revisión del dueño
  - [x] F1.5 Modal de solicitud: 1 día o menos (escritorio 16:915, 16:1133; celular 16:1347, 16:1569; listas abiertas 16:1785, 16:1799, 16:1803). Pendiente revisión del dueño
  - [ ] F1.6 Modal de liquidación del solicitante
  - [x] F1.6 Modal de liquidación del solicitante (página `Liquidación`: escritorio 35:523, 35:689, 35:942; celular 35:1174, 35:1324, 35:1549; confirmación 29:1605, 29:1619; combobox 29:1633; comprobante en una sola fila; todo archivo se abre con el visor de Vales, componente «Visor de documentos» 37:565, flujos 38:627, 38:807, 38:1140, 38:1322). Decisión (dueño): «Liquidar» solo se habilita cuando falta por liquidar = 0; no se puede liquidar más de lo solicitado (p. ej. 4 noches = 4 facturas de hotel); las comidas no se liquidan. Pendiente revisión del dueño
  - [x] F1.7 Gestiones: lista (18:87, 18:474, 18:558, 18:641, móvil 18:728), modales autorizar (18:1112, 18:1139) y rechazar (18:1166, 18:1202, 18:1238; sin motivos predeterminados) y liquidación de contabilidad solo lectura (30:558, 30:708, 30:750; celular 30:791, 30:952, 30:994). Estado bajo el pipeline: solo texto (rojo rechazada, amarillo vencida). Pendiente revisión del dueño
  - [x] F1.8 Configuración (11 subpestañas; detalle: Tramos 20:87 y modales, Comidas 22:449, Personas 22:653/22:828, Reglas de licencia 22:913/22:1086; faltan modales de alta de las demás pestañas). Pendiente revisión del dueño
  - [x] F1.9 PDF (página `PDF`: +1 día propio 31:89, +1 día empresarial 31:257, ≤1 día 31:411 / 31:548, imágenes 31:677, comparación de título 31:705). Título «SOLICITUD DE VIÁTICOS» a ~10.82 pt (Arimo) iguala el ancho de «VALE DE ARTE» a 18 pt; en el código medirlo con pdf-lib. Pendiente revisión del dueño
  - [ ] F1.10 Escritorio y celular, con estados vacío, cargando y error; aprobación del dueño
- [ ] F2 Base de datos normalizada (F1 aprobada por el dueño el 2026-11-11). Decisión del dueño: solo migraciones (sin tocar `schema.sql` ni `seed.sql`): dos scripts con el mismo correlativo, `NN_viaticos_esquema.sql` y `NN_viaticos_semilla.sql`; correlativo previsto 37 (dev llega a 34, `module/proyectos` a 36)
  - [x] F2.1 Exploración de convenciones de `database/` y diseño del modelo: `.agents/modulos/viaticos/documentacion/modelo_datos.md` (borrador)
  - [ ] F2.2 Aprobación del modelo por el dueño y cierre de los 5 pendientes del documento
  - [x] F2.2 Modelo aprobado y sus 5 pendientes resueltos (2026-11-11); póliza opcional, tarjeta de circulación obligatoria
  - [x] F2.3 (ejecutadas en la BD local `munditrofeos`, NODE_ENV=development, 2026-11-11; 33 tablas, 5 permisos, rol Piloto con `viaticos.ver`, Administrador con los 5, 7 monedas, 15 ubicaciones y 14 tramos; re-ejecución directa idempotente y CHECK de tramos verificado) Escribir `database/migrations/37_viaticos_esquema.sql` (catálogos, entidades, solicitud y partes) y `37_viaticos_semilla.sql` (permisos, rol Piloto, monedas, tipos de comida, estados, salvedades y los 14 tramos de prueba); previo: integrar `dev` en `module/viaticos` (la rama va en 31)
  - [~] F2.4 Verificación: idempotencia y CHECK ya comprobados en la BD local; falta el CI del PR (escenarios A y B con MySQL 8) y documentar el esquema en `documentacion/` en F5
- [ ] F3 Backend (`src/modules/viaticos`, registro en `modulesCatalog.js` y `app.js`, notificaciones, PDF, Storage solo en producción). Sin test runner en el proyecto: excepción al RED/GREEN; verificación con `node --check`, lectura de imports y pruebas con `curl` contra el servidor que levanta el dueño (localhost:3000)
  - [x] F3.0 Exploración de patrones del backend; contrato de la API en `documentacion/contrato_api.md`. Decisiones: notificaciones con `modulo='viaticos'`, `vale_id` NULL y correlativo en el mensaje; PDF con helpers propios del módulo (sin tocar Vales); un rol nuevo no exige tabla de perfil
  - [x] F3.1 Andamiaje y registro (27 JS bajo `src/modules/viaticos`, montaje en `app.js`, entrada en `modulesCatalog.js` color #6B7A3A; `node --check` y carga de rutas ok). Ruta: delegado a un escritor (más de 2 archivos no triviales)
  - [x] F3.2 (verificada leyendo y llamando servicios con `node` en solo lectura; las escrituras HTTP y el 403 de `configurar` quedan para F3.7 por falta de credenciales de prueba) Configuración: CRUD de catálogos (monedas, valores de comida, ubicaciones, tramos, motivos, tipos de gasto y de defecto, tipos de licencia y de placa, reglas de licencia, vehículos, personas con licencia y países, ajustes)
  - [x] F3.3 completa: parte B (crear, modificar, dar de baja, fotos de defectos con reversión, idempotencia, notificaciones; probada con rollback en la BD local, 22 tablas sin cambios; rutas HTTP y Storage real sin probar, quedan para F3.7). Parte A hecha (cálculo en centavos, validaciones y advertencias, pipeline derivado, catálogo de la solicitud, `calcular`, listar y detalle; 107 aserciones de funciones puras ok, relanzadas por mí). Falta la parte B (crear, modificar, dar de baja y fotos de defectos) y decidir las columnas `rendimiento_km_galon` y `precio_galon` NOT NULL, que el viaje corto no tiene. Solicitudes: listar, crear, modificar y dar de baja; correlativo `VIA-<país>-<n>` por país; cálculos; restricciones y salvedades; pipeline derivado (En curso, Terminado, Vencida)
  - [x] F3.4 (generado y leído como imagen en 5 casos; título 10.954 pt = mismo ancho que «VALE DE ARTE» 18 pt; versiones `_2`, `_3` al regenerar; sin probar subida real a Storage ni la consulta `obtenerDatosDocumento` contra MySQL: queda para F3.7) PDF «SOLICITUD DE VIÁTICOS» (pdf-lib, una hoja que desborda con n/total) y subida a Storage (borrado solo en producción)
  - [ ] F3.5 Gestiones: listar todas, autorizar, rechazar con motivo, historial, notificaciones y tiempo real
  - [ ] F3.6 Liquidación: comprobantes (límites por rubro, archivos), liquidar y vista de contabilidad
  - [ ] F3.7 Verificación integral con `curl` y revisión final
- [ ] F4 Frontend con los mockups aprobados (`public/modules/viaticos`)
- [ ] F5 Documentación del módulo (`.agents/modulos/viaticos/README.md`, `documentacion/`, fila en `CLAUDE.md` §9) y verificación

## Reglas
`.agents/reglas/reglas_modulo.md`, `reglas_disenoUI.md` (mockup primero), `reglas_archivosSQL.md`, `reglas_entornos.md` (borrado en Storage solo en producción). Conventional Commits en español, sin atribución de IA.

## Rutas
F1.1 exploración delegada (lectura); F1.2-F1.9 un solo escritor en Figma, secuencial.

## Progreso
Análisis cerrado en conversación con el dueño. F1 en curso: archivo Figma creado en Team UMG (https://www.figma.com/design/UxBfvT3cceaLEvnYsnJeZA, 2026-11-11); F1.1 (exploración del diseño de Vales) delegada a un explorador de solo lectura.
