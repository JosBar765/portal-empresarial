# Informe de pruebas de calidad (QA) · Resultados, hallazgos y plan de corrección

# 1. Resumen ejecutivo

## Qué se hizo

Se probó el módulo **Proyectos** del portal MundiTrofeos de punta a punta, con los cuatro roles (administrador, supervisor, gerente y asesor), entre el 11 y el 12 de noviembre de 2026. Las pruebas cubrieron el código, la lógica de negocio, la comunicación entre capas, los flujos completos, los valores límite y las entradas especiales, la seguridad, el rendimiento, la accesibilidad y la aceptación contra los manuales de usuario.

Todo se ejecutó en un ambiente local de desarrollo: una base de datos desechable para las pruebas automáticas y la base local del equipo para el recorrido manual. No se tocó staging ni producción.

## Veredicto

**El módulo está en buen estado y listo para pasar a staging.** El recorrido completo de un proyecto (configurar, crear, aprobar, repartir, gestionar, vender, confirmar, reasignar, cerrar y dar el visto bueno) funciona. No quedan hallazgos críticos ni altos, y los de seguridad de severidad media están corregidos.

Verificado también en **MariaDB 11.8** (49 migraciones y las 18 verificaciones pasan). Antes de producción queda repetir la prueba en **staging** (cookies `Secure`, HTTPS y la política de seguridad de contenido con el despliegue real), que no se pudo hacer aquí.

## Cifras

| | Total | Corregidos | Abiertos | Otros |
|---|---|---|---|---|
| **Alta** | 1 | 1 | 0 | |
| **Media** | 7 | 7 | 0 | |
| **Baja** | 20 | 16 | 2 | 1 no reproducible, 1 informativo |
| **Total** | **28** | **24** | **2** | **2** |

- **Pruebas automáticas:** 18 scripts de verificación con unas 905 comprobaciones; pasan todas (la de avisos se corrigió: ver E-05).
- **Pruebas adicionales de este QA:** unos 400 casos por HTTP (integración, valores límite, entradas especiales, permisos, importación y exportación), 96 combinaciones de permisos, 12 afirmaciones de los manuales y 36 mediciones de rendimiento.
- **Recorrido manual:** más de 40 pasos con los cuatro roles, con captura de lo observado en cada uno.
- Cada corrección se verificó con una prueba que **falla con el código anterior y pasa con el nuevo**.

# 2. Tabla de hallazgos

Severidad: Alta, Media o Baja. Estado: **Corregido**, **Abierto**, **No reproducible** o **Informativo**.

## Seguridad y código

| ID | Hallazgo y cómo se encontró | Esperado y obtenido | Sev. | Estado | Recomendación |
|---|---|---|---|---|---|
| E-01 | `npm audit` reportó 8 vulnerabilidades en dependencias de producción, una crítica (`proxy-addr`, suplantación de IP) y cuatro altas (`multer`, `sharp`, `body-parser`, `engine.io`). | Esperado: 0. Obtenido: 8. | Alta | **Corregido** | `npm audit fix` sin `--force`: 0 vulnerabilidades. Solo cambió el archivo de bloqueo. |
| S-01 | La aplicación no enviaba política de seguridad de contenido (`helmet({ contentSecurityPolicy: false })`). | Esperado: cabecera CSP. Obtenido: ninguna. | Media | **Corregido** | Nueva política (`src/core/seguridad/csp.js`): scripts solo del sitio, de unpkg y los en línea existentes por hash; sin `unsafe-inline` ni `unsafe-eval` en scripts; `object-src none`. Verificada en login, dashboard, vales, administración y proyectos, con el importmap del despliegue simulado. |
| S-02 | Tras cerrar sesión, el token anterior seguía siendo válido hasta que vencía (15 minutos). El token no se ligaba a la sesión activa. | Esperado: 401 tras el cierre de sesión. Obtenido: 200. | Media | **Corregido** | El access token solo vale si su `sid` coincide con `sesiones_activas` (cookie y Bearer); un token sin `sid` no se acepta. Tres comprobaciones nuevas, que fallan con el código anterior. |
| E-02 | 22 consultas SQL directas en 7 servicios (`cierre`, `proyecto`, `importación`, `seguimiento`, `alcanceAdmin`, `gestión`, `rondas`). Rompía la regla «servicios sin SQL». | Esperado: todo el SQL en repositorios. | Media | **Corregido** | Todo el SQL pasó a los repositorios (nuevo `operacionRepository` para claves de operación y bloqueos; `resolverVistoBueno`, `actualizarCodigo`, `registrarImportacion`, `bloquearParaCompletar`, `reemplazarExcepciones`). Sin cambio de comportamiento: las 18 verificaciones dan el mismo resultado. |
| E-03 | El endpoint de CSRF devuelve un valor fijo y decorativo. El código lo documenta; la protección real es `SameSite=Strict`. | Sin riesgo directo. | Baja | **Corregido** | El login ya no pide ni manda el valor decorativo y el endpoint `action=csrf` se retiró. La protección sigue siendo `SameSite=Strict`. |
| E-04 | Un usuario con solo `proyectos.ver` puede listar la Cartera de su país. | A decidir con el dueño del producto. | Baja | Abierto | Confirmar si es lo deseado. |
| E-05 | La prueba `verificar-avisos` espera 2 destinatarios para «proyecto vencido», pero el aviso llega a todos los supervisores que cubren una tienda del proyecto (13 en la base de prueba). | Esperado: 2. Obtenido: 13. Es la prueba la que depende de los datos. | Baja | **Corregido** | La prueba ahora compara contra los destinatarios reales del primer aviso. `verificar-avisos`: 38 OK, 0 fallas. |

## Validación y datos

| ID | Hallazgo y cómo se encontró | Esperado y obtenido | Sev. | Estado | Recomendación |
|---|---|---|---|---|---|
| Q-01 | Crear un proyecto con una fecha que no existe en el calendario (`2026-02-31`, `2027-02-29`) o con una etapa así dio un **error 500**. | Esperado: 400 «Escribe la fecha como AAAA-MM-DD». Obtenido: 500. Causa: `Date.parse` acepta el 31 de febrero y MySQL lo rechaza. | Media | **Corregido** | Nuevo validador `esFechaReal` en proyectos, seguimientos y filtros del historial. Dos pruebas nuevas. |
| Q-02 | Se puede crear un borrador sin tiendas. | Es válido para un borrador; al activarlo da 4xx. | Baja | Informativo | Ninguna. |
| Q-03 | Un doble clic con la misma llave de idempotencia deja un `ER_DUP_ENTRY` en el registro del servidor aunque el resultado es correcto (una sola fila). | Esperado: sin ruido en el registro. | Baja | **Corregido** | Un duplicado (`ER_DUP_ENTRY`) se registra como información, no como error; el resto de errores de base sigue como error. |

## Accesibilidad

| ID | Hallazgo y cómo se encontró | Esperado y obtenido | Sev. | Estado | Recomendación |
|---|---|---|---|---|---|
| A-01 | Las ventanas (modales) no tenían `role="dialog"` ni `aria-modal`, ni manejaban el foco. | Esperado: se anuncian como diálogo y atrapan el foco. | Media | **Corregido** | Roles, título enlazado, foco al abrir, Tab atrapado y foco devuelto al cerrar. Verificado en el navegador. |
| A-02 | Texto secundario y etiquetas de estado con contraste insuficiente (2.3 a 3.1:1 frente a 4.5:1). | Esperado: 4.5:1. | Baja | **Corregido** | Texto secundario `#5B6B80` (5.4:1) y estados más oscuros (6.8:1). 8 pantallas medidas: 0 incumplimientos. |
| A-03 | Controles de 20 × 20 y 30 × 30 px en la cabecera (menú y flecha de regreso). | Esperado: 32 px o más. | Baja | **Corregido** | Ahora 40 × 40 px. Los enlaces de texto dentro de tablas quedan exentos. |
| A-04 | El CSS del módulo no respetaba `prefers-reduced-motion`. | Esperado: menos movimiento a quien lo pide. | Baja | **Corregido** | Regla añadida; los indicadores de carga se conservan. |

## Funcional y experiencia de uso (recorrido manual)

| ID | Hallazgo y cómo se encontró | Esperado y obtenido | Sev. | Estado | Recomendación |
|---|---|---|---|---|---|
| M-01 | Al reasignar empresas, la meta de todos subió de Q 10,000 a Q 12,000 sin aviso: la meta se repartía entre quienes tenían empresas. | Esperado: la meta no cambia al reasignar. | Media | **Corregido** | La meta se reparte entre los participantes activos. Prueba nueva. |
| M-02 | Un asesor que se quedaba sin empresas desaparecía de Seguimiento. | Esperado: sigue en la tabla con 0 asignadas. | Media | **Corregido** | Seguimiento parte de los participantes. Prueba nueva. |
| M-03 | El aviso «Esperando aprobación» nombraba al supervisor que pidió la activación en vez del gerente. | Esperado: «El gerente la aprobará…». | Baja | **Corregido** | Texto fijo. |
| M-04 | La plantilla del proyecto salía como «—» antes de activarlo. | Esperado: el nombre de la plantilla. | Baja | **Corregido** | El servidor devuelve `plantillaNombre`. Prueba nueva. |
| M-05 | Aviso de «cambios sin guardar» al salir del Kit aunque ya estaba guardado. | Esperado: sin aviso. | Baja | No reproducible | Se intentó de nuevo (editar, guardar, salir) y no ocurrió. Seguir atento. |
| M-06 | El artículo que sugiere el plan del año se perdía al pasar del paso 1 al 2 del asistente. | Esperado: Medalla preseleccionada en el paso 3. | Baja | **Corregido** | Causa real: el primer guardado del borrador no enviaba el artículo. Verificado en el navegador. |
| M-07 | La reacción de un asesor sin gestión salía como «0 d» en rojo, que se lee como «reaccionó el mismo día». | Esperado: «Sin gestión» o «—». | Baja | **Corregido** | Texto «Sin gestión» (con empresas) o «—» (sin empresas). |
| M-08 | Se puede programar un seguimiento para una hora que ya pasó hoy (solo se rechaza una fecha pasada). | A decidir: ¿rechazar horas pasadas? | Baja | Abierto | Decisión de negocio. |
| M-09 | Textos con errores: «S.A..», «1 tiendas» y doble punto en el aviso del comentario del gerente. | Esperado: texto limpio. | Baja | **Corregido** | Corregidos los tres. |
| M-11 | La campana del gerente conserva el aviso de «activación pedida» después de resolverla. | Esperado: se marca leído al actuar. | Baja | **Corregido** | Al aprobar o rechazar, el aviso «activación pedida» queda leído para todos. Prueba nueva en `verificar-avisos`. |
| M-14 | La reasignación equitativa eligió destinatarios sin un criterio visible (con empate en 3 empresas). | Esperado: explicación o criterio fijo. | Baja | **Corregido** | La vista previa de la reasignación equitativa muestra el criterio: a quien tenga menos empresas; en empate, el de menor identificador. |

## Aceptación contra los manuales

| ID | Hallazgo y cómo se encontró | Esperado y obtenido | Sev. | Estado | Recomendación |
|---|---|---|---|---|---|
| F-01 | El cierre ya cerrado no mostraba presencial vs. remoto ni las muestras entregadas, aunque el informe sí los guarda. | Esperado: lo que dice el manual. | Baja | **Corregido** | Paneles compartidos entre el cierre y la vista congelada. Verificado. |
| F-02 | Los manuales decían «si quedan pocas muestras»; el aviso real es de una sola vez al bajar de 20 unidades. | Esperado: el número en el manual. | Baja | **Corregido** | Manuales actualizados y regenerados. |
| F-03 | Una gestión sin próximo seguimiento borra el seguimiento anterior (está documentado), y el asesor puede hacerlo sin querer. | Esperado: que se avise. | Baja | **Corregido** | Texto de ayuda en el formulario cuando hay un seguimiento programado, y nota en el manual. |

Una consulta adicional resultó **no ser un hallazgo**: el usuario 9002 (Steve Recinos), que recibe los avisos de activación, es una segunda cuenta con rol Gerente.

# 3. Casos de prueba ejecutados

Se resumen por técnica. El detalle de cada caso queda en los scripts.

| Grupo | Técnica | Casos | Resultado |
|---|---|---|---|
| Scripts de verificación (18) | Caja blanca y de integración sobre servicios y rutas | unas 905 comprobaciones | Pasan todas menos 1 (E-05). |
| Matriz de permisos | 6 perfiles contra 16 rutas | 96 | Todo según lo esperado. |
| Integración y concurrencia | Doble clic, llaves de idempotencia, activación y reasignación en paralelo, cierre | 18 | Pasan los 18. Sin duplicados ni empresas sin dueño. |
| Valores límite | Mínimo−1, mínimo, máximo y máximo+1 en nota, referencia, monto, parámetros, proyecto, empresa, fechas | unos 140 | Un fallo real (Q-01), corregido. |
| Partición de equivalencia | Moneda, canal, resultado, contacto, país, nicho, artículo, tienda | unos 60 | Pasan. |
| Entradas especiales | Vacíos, espacios, ñ y tildes, emojis, HTML, SQL, caracteres de control, formatos de fecha inválidos | unos 50 | Pasan. HTML y SQL se guardan como texto y la interfaz no los ejecuta. |
| Importación CSV | 0, 1, 2000 y 2001 filas; archivo de 5 MB más 2 bytes; vacío; ejecutable; separador desconocido; fórmula; país inexistente; confirmar en paralelo; reimportar | 14 | Pasan. |
| Exportación | CSV y PDF del cierre; acceso sin permiso | 8 | Pasan. Los CSV llevan marca para Excel. |
| Seguridad (HTTP) | Cookies, tokens alterados, sin firma, cierre de sesión, enumeración de usuarios, límite de intentos, inyección, archivos sensibles, CORS, cabeceras | 25 | Pasan, salvo S-01 y S-02 (corregidos después). |
| Seguridad: regresión tras S-01 y S-02 | `pruebas-sesion` (47), `pruebas-fase1` (64) y `pruebas-csp` (10); el navegador carga login, dashboard, vales, administración y proyectos con la política activa | 121 | Pasan todas. |
| Rendimiento | 6,000 empresas, reparto, lecturas, exportaciones y 30 peticiones en paralelo | 36 | Reparto de 6,000 empresas en 0.6 s; lecturas de 10 a 130 ms; 30 en paralelo sin errores (la más lenta, 230 ms). |
| Accesibilidad y móvil | Auditoría automática en 10 pantallas a 390 px y en escritorio: etiquetas, nombres, ids, contraste, tamaño táctil | 10 pantallas | Sin desbordes; ver A-01 a A-04. |
| Aceptación | Afirmaciones de los manuales no cubiertas por el recorrido | 12 | Coinciden las 12. |
| Recorrido manual | Cuatro roles, de la configuración al visto bueno final | más de 40 pasos | Completo. |

# 4. Matriz de cobertura

| Área | Administrador | Supervisor | Gerente | Asesor |
|---|---|---|---|---|
| Entrar y navegar el módulo (menú, categorías, colapsado) | Probado | Probado | Probado | Probado |
| Configuración (reglas, parámetros, kit, plan) | Probado | | | |
| Catálogos, plantillas, campos, alcance, notificaciones, historial | Scripts | | | |
| Importar y registrar empresas | | Probado | | Probado |
| Crear, aprobar y activar proyectos | | Probado | Probado | |
| Trabajar empresas (gestión, muestra, cotización, venta) | | | | Probado |
| Confirmar, anular, reasignar, ajustar metas | | Probado | | |
| Cierre y visto bueno | | Probado | Probado | |
| Panel gerencial, clientes ganados, proyectos anteriores | | | Probado | Probado |
| Exportaciones | | Probado | Probado | |
| Vínculo con Vales de Arte | | | | Probado |
| Permisos y acceso a rutas ajenas | Probado | Probado | Probado | Probado |

**Pantallas de configuración del administrador:** probadas por scripts y, en parte, a mano. La auditoría de accesibilidad no las incluyó.

# 5. Plan de corrección priorizado

## 1. Antes de producción

- ~~Repetir las 18 verificaciones en MariaDB 11.8~~: hecho, pasan todas (ver «No probado»).
- Probar en **staging**: cookies `Secure`, HTTPS y la política de seguridad de contenido con el despliegue real (el importmap se inyecta al instalar; aquí se simuló y funcionó).
- Asignar los permisos `proyectos.*` en la pantalla Roles de staging y producción (tarea del dueño del portal).

## 2. Decisiones del dueño del producto (los dos hallazgos abiertos)

- **M-08:** decidir si se rechazan horas pasadas al programar un seguimiento (hoy solo se rechaza una fecha pasada).
- **E-04:** confirmar si quien solo tiene `proyectos.ver` debe poder listar la Cartera de su país.

# 6. Mejoras sugeridas

- **Medir la cobertura de código.** El proyecto no tiene `c8` ni `nyc`; con uno de los dos se vería qué ramas faltan.
- **Integrar los scripts de QA al repositorio** (matriz de permisos, valores límite, rendimiento), hoy fuera de él, para repetirlos en cada cambio.
- **Rendimiento visual:** medir el tiempo de carga en el navegador (esta vez se midió la API).
- **Vista previa del reparto:** mostrar el criterio de desempate.
- **Seguimientos vencidos:** un recordatorio visible cuando uno venza.
- **Campana del gerente:** que se limpie al resolver una acción.
- **Textos:** unificar la regla de singular y plural con una función común para todo el módulo.

# 7. Qué no se pudo probar

- **MariaDB 11.8:** se ejecutaron después en MariaDB 11.8.9: 49 migraciones aplicadas, las 18 verificaciones (905 comprobaciones) y las pruebas de integración y de límites pasan, sin diferencias de comportamiento. Los 4 casos de límites que «fallan» son los mismos supuestos del arnés que en MySQL (no del producto). Falta solo probar contra la base real de staging.
- **Navegadores distintos al usado**, lector de pantalla y navegación completa solo con teclado.
- **Staging y producción:** cookies `Secure`, HTTPS, acciones críticas (borrado en almacenamiento, correos) y envío real de mensajes de WhatsApp o correo.
- **Un CSV de exactamente 5 MB válido:** se confirmó el rechazo por encima del límite, pero no la aceptación en el límite exacto.
- **Accesibilidad de las pantallas de configuración del administrador** y tiempo de carga de página en el navegador.
- **Cobertura de código:** no se midió por falta de herramienta.

# 8. Cómo repetir las pruebas

- Crear una base de datos desechable y aplicar las migraciones (`npm run migrate`).
- Ejecutar los 18 scripts uno por uno con la base limpia entre cada uno: `node scripts/proyectos/verificar-<nombre>.js`.
- Verificar la sintaxis con `npm run ci:sintaxis` y las dependencias con `npm audit --omit=dev`.
- Para repetir el recorrido manual, seguir la guía de los manuales de usuario por rol (carpeta `manuales`).
