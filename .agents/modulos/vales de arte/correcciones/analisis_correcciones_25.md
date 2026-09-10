# Archivo correcciones No. 25

Primero, ejecuta la corrección del archivo de documentación `correcciones_24.md` explicada en **dudas - punto 4**. Lo del nombre de la tabla `encargado_tienda`.  
  
Segundo, realiza la **AUDITORÍA SEGURIDAD** y documentala en el archivo de documentación de `correcciones_25.md`

# Auditoría Seguridad 

Quiero que realices una AUDITORÍA DE SEGURIDAD COMPLETA y una IMPLEMENTACIÓN DE HARDENING sobre este proyecto Node.js/JavaScript.

**IMPORTANTE:** NO QUIERO QUE CAMBIES LA ARQUITECTURA DEL PROYECTO NI QUE ROMPAS SU FUNCIONAMIENTO ACTUAL.

El sistema todavía NO está en producción. Se desplegará posteriormente en Hostinger y será utilizado por trabajadores de Guatemala y otros países de Centroamérica.

El objetivo es dejar el proyecto razonablemente preparado para producción, reduciendo al máximo riesgos como:

* Acceso no autorizado.
* Robo de cuentas.
* Robo o filtración de JWT/tokens.
* Escalación de privilegios.
* SQL Injection.
* XSS.
* CSRF cuando corresponda.
* Inyección de comandos.
* Path Traversal.
* Manipulación de archivos.
* Subida de archivos maliciosos.
* Acceso directo a archivos privados.
* WebSocket abuse.
* Fuerza bruta contra login.
* Credential stuffing.
* Enumeración de usuarios.
* Exposición accidental de información sensible.
* Fugas de variables de entorno.
* Exposición de errores internos.
* Manipulación de IDs o parámetros.
* Mass assignment.
* Falta de validación de entradas.
* Problemas de CORS.
* Problemas de configuración HTTP.
* Ataques contra endpoints.
* Ataques contra generación/descarga de PDFs.
* Ataques relacionados con uploads.
* Problemas de permisos por roles.
* Borrado o modificación no autorizada de información.
* Pérdida de información por errores de aplicación.
* Falta de backups o recuperación ante desastres.
* Configuraciones inseguras de producción.

==================================================

1. REGLAS FUNDAMENTALES
   ==================================================

ANTES DE MODIFICAR CUALQUIER COSA:

1. Analiza primero TODO el proyecto.
2. Lee .agents/reglas/.
3. Analiza package.json.
4. Analiza src/app.js y src/server.js.
5. Analiza toda la arquitectura existente.
6. Analiza especialmente:

   * core/auth
   * core/permissions
   * core/websocket
   * core/files
   * modules/vales
   * repositories
   * controllers
   * services
   * routes
   * configuración de base de datos
   * manejo de uploads
   * frontend relacionado con autenticación y consumo de API.

NO asumas cómo funciona el sistema.

Comprende primero cómo se autentican los usuarios, cómo se autorizan las operaciones, cómo se generan/verifican tokens, cómo se manejan sesiones, cómo funcionan los WebSockets, cómo se accede a MySQL y cómo se almacenan/descargan archivos.

==================================================
2. NO ROMPER FUNCIONALIDAD
==========================

Esta es una condición CRÍTICA.

El sistema actualmente funciona.

NO debes:

* Eliminar funcionalidades existentes.
* Cambiar endpoints sin necesidad.
* Cambiar nombres de propiedades que utiliza el frontend.
* Cambiar contratos de API innecesariamente.
* Cambiar nombres de tablas.
* Cambiar columnas de la base de datos sin justificarlo.
* Romper WebSockets.
* Romper autenticación.
* Romper autorización.
* Romper generación de PDFs.
* Romper uploads.
* Romper descargas.
* Cambiar comportamiento funcional sin necesidad.

Prioriza:

SEGURIDAD > MANTENER COMPATIBILIDAD > CALIDAD DEL CÓDIGO

Si una medida de seguridad requiere modificar comportamiento existente, explícame primero el problema y cómo propones solucionarlo.

==================================================
3. AUDITORÍA ANTES DE IMPLEMENTAR
=================================

Primero genera un informe de auditoría.

Para cada vulnerabilidad encontrada indica:

* Archivo.
* Línea o sección aproximada.
* Vulnerabilidad.
* Nivel de riesgo:
  CRÍTICO / ALTO / MEDIO / BAJO.
* Qué podría hacer un atacante.
* Cómo podría explotarse.
* Impacto.
* Solución recomendada.
* Si la solución puede afectar funcionalidad existente.

NO implementes todavía los cambios mientras realizas esta primera auditoría.

Al finalizar la auditoría, crea un **plan de remediación ordenado por prioridad** en un **documento por aparte** en la **misma carpeta**.

==================================================
4. AUTENTICACIÓN
================

Audita profundamente:

* Login.
* Hashing de contraseñas.
* Comparación de contraseñas.
* JWT.
* Expiración de tokens.
* Secretos utilizados para firmar JWT.
* Manejo de refresh tokens si existen.
* Almacenamiento de tokens.
* Cookies si existen.
* Logout.
* Invalidación de sesiones/tokens.
* Protección contra fuerza bruta.
* Rate limiting.
* Credential stuffing.
* Enumeración de usuarios.
* Mensajes de error del login.
* Recuperación/cambio de contraseña si existe.
* Expiración de contraseñas si aplica.
* Manejo de cuentas deshabilitadas.

Comprueba que NUNCA se almacenen contraseñas en texto plano.

Si se utiliza bcrypt/argon2 u otro algoritmo, evalúa si la configuración es adecuada.

NO inventes mecanismos innecesarios. Utiliza soluciones estándar y mantenibles.

==================================================
5. AUTORIZACIÓN Y ROLES
=======================

El sistema utiliza diferentes roles.

Audita que:

* Un usuario no pueda acceder a endpoints de otro rol.
* Las validaciones de permisos ocurran EN EL BACKEND.
* No se confíe en el frontend para seguridad.
* Un usuario no pueda modificar IDs para acceder a información de otro usuario.
* No exista IDOR/BOLA.
* Los endpoints sensibles tengan autorización explícita.
* Los WebSockets respeten permisos.
* Las descargas respeten permisos.
* Las operaciones de modificación/eliminación respeten permisos.

Busca especialmente vulnerabilidades del tipo:

GET /vale/123

donde un usuario pueda simplemente cambiar 123 por 124 y obtener información que no le corresponde.

==================================================
6. BASE DE DATOS
================

Audita absolutamente todas las consultas SQL.

Comprueba:

* SQL Injection.
* Uso correcto de consultas parametrizadas/prepared statements.
* Validación de parámetros.
* Mass assignment.
* Acceso indebido a registros.
* Permisos de la cuenta MySQL.
* Exposición de credenciales.
* Pool de conexiones.
* Manejo de errores de DB.
* Transacciones.
* Integridad referencial.
* Operaciones críticas que podrían dejar datos inconsistentes.

NO expongas errores SQL directamente al cliente.

Los errores detallados deben quedar únicamente en logs seguros.

==================================================
7. VARIABLES DE ENTORNO Y SECRETOS
==================================

Audita:

* .env.
* JWT secrets.
* Passwords.
* Database credentials.
* API keys.
* Credentials de servicios externos.
* Secrets utilizados por WebSockets.
* Configuración de producción.

Comprueba que:

* Ningún secreto esté hardcodeado.
* .env no pueda servirse públicamente.
* No aparezcan secretos en logs.
* No aparezcan secretos en respuestas HTTP.
* No aparezcan secretos en el frontend.
* Existan valores diferentes para desarrollo y producción cuando corresponda.

Si falta un .env.example, créalo SIN secretos reales.

==================================================
8. HTTP SECURITY
================

Evalúa la implementación de:

* Helmet.
* Content-Security-Policy.
* HSTS.
* X-Content-Type-Options.
* Referrer-Policy.
* Permissions-Policy.
* Frame protection.
* CORS.
* Rate limiting.
* Body size limits.
* Request timeouts.

No agregues políticas que rompan el frontend sin investigar primero las dependencias actuales.

Para CORS, NO utilices:

Access-Control-Allow-Origin: *

si la aplicación realmente necesita autenticación.

Configura los orígenes permitidos de manera explícita cuando corresponda.

==================================================
9. XSS / INPUT VALIDATION
=========================

Busca todos los puntos donde el usuario pueda enviar información.

Incluye:

* Formularios.
* JSON.
* Query parameters.
* URL parameters.
* Headers.
* WebSockets.
* Campos de vales.
* Propuestas.
* Solicitudes de modificación.
* Comentarios/observaciones.
* Nombres.
* Descripciones.
* Archivos.

Implementa validación de entrada utilizando una estrategia consistente.

Distingue correctamente entre:

* Validación.
* Sanitización.
* Encoding.

NO hagas sanitización indiscriminada que destruya datos legítimos.

==================================================
10. CSRF
========

Determina si el proyecto está expuesto a CSRF dependiendo de cómo maneja autenticación y cookies.

NO implementes CSRF automáticamente si el sistema utiliza únicamente Authorization Bearer tokens de una manera que no sea vulnerable a CSRF.

Explica primero si realmente aplica.

==================================================
11. UPLOADS
===========

Esta sección es MUY IMPORTANTE.

El sistema permite trabajar con archivos/imágenes.

Audita:

* Extensiones.
* MIME type.
* Magic bytes/file signature.
* Tamaño máximo.
* Nombre del archivo.
* Path traversal.
* Archivos ejecutables.
* SVG maliciosos.
* Archivos con doble extensión.
* Sobrescritura de archivos.
* Directorios de almacenamiento.
* Acceso directo desde /public.
* Archivos privados.
* Permisos de archivos.
* Image optimization.
* PDFs.
* Nombres generados por el servidor.

Nunca confíes únicamente en:

filename.endsWith(".jpg")

o en:

Content-Type

Diseña una estrategia segura para uploads.

Los nombres físicos de los archivos deberían generarse de forma segura y no depender directamente del nombre proporcionado por el usuario.

==================================================
12. PATH TRAVERSAL
==================

Busca patrones como:

../
..\
path.join()
fs.readFile()
fs.writeFile()
fs.unlink()
fs.rename()

especialmente cuando cualquier parte del path provenga directa o indirectamente del usuario.

Comprueba que un usuario no pueda leer, sobrescribir o eliminar archivos fuera del directorio permitido.

==================================================
13. PDFs
========

Audita la generación y descarga de PDFs.

Comprueba:

* Inyección de contenido.
* Información sensible.
* Acceso no autorizado.
* Manipulación de IDs.
* Nombres de archivos.
* Paths.
* Recursos externos.
* Consumo excesivo de CPU/memoria.
* Denial of Service.

==================================================
14. WEBSOCKETS
==============

El proyecto utiliza WebSockets.

Audita:

* Autenticación del socket.
* Autorización.
* Validación de mensajes.
* Rate limiting.
* Reconexiones.
* Manipulación de eventos.
* Acceso por roles.
* Información transmitida.
* Posibilidad de enviar eventos arbitrarios.
* Posibilidad de escuchar eventos de otros usuarios.
* Denial of Service.
* Gestión de conexiones.

Un usuario no autenticado NO debería poder conectarse y recibir información sensible.

==================================================
15. DENIAL OF SERVICE
=====================

Busca endpoints que puedan consumir muchos recursos:

* Consultas SQL pesadas.
* Generación de PDFs.
* Procesamiento de imágenes.
* Uploads.
* WebSockets.
* Endpoints que devuelvan grandes cantidades de registros.

Implementa límites razonables donde corresponda:

* Rate limit.
* Payload size.
* File size.
* Pagination.
* Timeouts.

No pongas límites arbitrarios que rompan el uso normal del sistema.

==================================================
16. MANEJO DE ERRORES
=====================

Comprueba que producción NO exponga:

* Stack traces.
* SQL queries.
* Paths internos.
* Variables de entorno.
* Secrets.
* Información de infraestructura.
* Información innecesaria de la aplicación.

Implementa un sistema de errores consistente.

El cliente debe recibir mensajes seguros y comprensibles.

Los logs internos deben contener la información necesaria para diagnosticar errores.

==================================================
17. LOGGING Y AUDITORÍA
=======================

Determina qué eventos deberían quedar registrados.

Por ejemplo:

* Login exitoso.
* Login fallido.
* Usuario bloqueado.
* Cambios de permisos.
* Creación de vales.
* Modificaciones.
* Cancelaciones.
* Asignaciones.
* Descargas sensibles.
* Errores importantes.

NO registres:

* Contraseñas.
* JWT completos.
* API keys.
* Información sensible innecesaria.

Si implementas logs, evita generar archivos gigantes sin rotación.

==================================================
18. DEPENDENCIAS
================

Analiza package.json y package-lock.json.

Busca:

* Dependencias vulnerables.
* Dependencias innecesarias.
* Dependencias abandonadas.
* Versiones excesivamente antiguas.

Utiliza npm audit como parte del análisis, pero NO actualices todas las dependencias automáticamente.

Antes de actualizar una dependencia importante, comprueba compatibilidad.

==================================================
19. CONFIGURACIÓN DE PRODUCCIÓN
===============================

Analiza qué debería cambiar entre desarrollo y producción.

Comprueba:

NODE_ENV=production

y cualquier configuración relevante.

Evalúa:

* HTTPS.
* Cookies Secure.
* SameSite.
* CORS.
* Debug.
* Logging.
* Error handling.
* Secrets.
* Database credentials.
* Upload directories.
* Reverse proxy.
* Trust proxy.
* WebSocket configuration.

El sistema será desplegado en Hostinger, por lo que quiero que identifiques también qué configuraciones NO dependen del código sino del entorno de Hostinger.

==================================================
20. BACKUPS Y RECUPERACIÓN
==========================

MUY IMPORTANTE:

La seguridad no solamente consiste en evitar hackers.

Quiero que determines qué debería hacerse para evitar:

* Pérdida de base de datos.
* Corrupción de datos.
* Eliminación accidental.
* Error humano.
* Fallo del servidor.
* Fallo de despliegue.

Analiza qué estrategia de:

* Backup de MySQL.
* Backup de uploads.
* Retención.
* Restauración.
* Disaster recovery.

debería utilizarse.

NO implementes automáticamente backups dentro del código si eso no es apropiado para Hostinger.

Dime qué debo configurar en infraestructura.

==================================================
21. PRINCIPIO DE MÍNIMO PRIVILEGIO
==================================

Aplica el principio de Least Privilege.

Cada componente debería tener únicamente los permisos necesarios.

Esto incluye:

* Usuarios.
* Roles.
* Base de datos.
* Archivos.
* APIs.
* WebSockets.

==================================================
22. FRONTEND
============

Aunque este proyecto sea principalmente backend, revisa también el frontend cuando pueda afectar seguridad.

Especialmente:

* Manejo de tokens.
* localStorage/sessionStorage.
* XSS.
* Información sensible expuesta.
* Validaciones falsas únicamente en frontend.
* URLs de API.
* Manejo de errores.
* Datos recibidos por WebSockets.

Recuerda:

La validación del frontend NO es una medida de seguridad.

==================================================
23. ARQUITECTURA
================

Respeta la arquitectura existente:

src/
├── config/
├── core/
│   ├── auth/
│   ├── files/
│   ├── idempotency/
│   ├── permissions/
│   └── websocket/
├── modules/
│   └── admin/
│       ├── controllers/
│       ├── repositories/
│       └── services/
│   └── vales/
│       ├── controllers/
│       ├── repositories/
│       └── services/
├── app.js
└── server.js

Si una medida de seguridad puede implementarse de manera transversal, prioriza middleware, servicios o componentes reutilizables.

Evita duplicar lógica.

Mantén:

* SOLID.
* DRY.
* KISS.
* Alta cohesión.
* Bajo acoplamiento.
* Separation of Concerns.
* Legibilidad.
* Mantenibilidad.

==================================================
24. NO SOBREINGENIERÍA
======================

NO quiero convertir este proyecto en una arquitectura innecesariamente compleja.

No agregues:

* Microservicios.
* Redis.
* Kubernetes.
* Sistemas externos.
* Servicios adicionales.

a menos que exista una razón real y explícita.

Prefiero una solución sencilla, segura, mantenible y adecuada al tamaño real del sistema.

==================================================
25. IMPLEMENTACIÓN
==================

Después de terminar la auditoría, generaras el **plan de remediación**.

Hazlo por fases.

FASE 1:
Vulnerabilidades críticas y altas.

FASE 2:
Vulnerabilidades medias.

FASE 3:
Hardening y mejoras adicionales.

Explica que después de cada fase tienes que asegurarte qué:

* El código compile/ejecute.
* Las rutas sigan funcionando.
* autenticación.
* autorización.
* WebSockets.
* uploads a supabase.
* PDFs.
* conexión a DB.

==================================================
26. TESTS DE SEGURIDAD
======================

En el mismo  **plan de remediación**, detalla pruebas o scripts de prueba cuando sea apropiado para demostrar que las vulnerabilidades corregidas realmente quedaron solucionadas.

Incluye pruebas como:

* Usuario no autenticado intentando acceder a endpoint protegido.
* Usuario intentando acceder a información de otro usuario.
* Usuario intentando utilizar permisos de otro rol.
* SQL Injection.
* XSS.
* Path Traversal.
* Upload de archivo inválido.
* Upload excesivamente grande.
* Manipulación de parámetros.
* Token inválido.
* Token expirado.
* WebSocket sin autenticación.
* WebSocket con permisos insuficientes.
* Rate limiting.

NO realices pruebas destructivas contra datos reales.

==================================================
27. RESULTADO FINAL
===================

Al finalizar quiero recibir:

1. Resumen ejecutivo de seguridad.

2. Tabla de vulnerabilidades encontradas:

| Riesgo | Vulnerabilidad | Archivo | Impacto | Solución | Estado |

3. Lista de cambios realizados.

4. Lista de archivos modificados.

5. Lista de archivos nuevos.

6. Dependencias agregadas/modificadas.

7. Variables de entorno nuevas.

8. Configuraciones que debo realizar en Hostinger.

9. Configuraciones que debo realizar en MySQL.

10. Configuraciones que NO pueden solucionarse desde el código.

11. Estrategia recomendada de backups.

12. Procedimiento recomendado de recuperación ante desastre.

13. Checklist de seguridad antes de producción.

14. Checklist de seguridad después del despliegue.

15. Riesgos que todavía permanecerían después de aplicar las medidas.

Y por aparte, el **plan de remediación**, que detallará como solucionar las discrepancias y como nos aseguraremos que funciona.

==================================================
28. REGLA FINAL
===============

NO me digas simplemente:

"El proyecto ahora es seguro."

Eso no existe.

Quiero que seas explícito sobre qué riesgos se mitigaron y cuáles todavía existen.

Si encuentras algo que requiere una decisión de arquitectura o infraestructura, NO lo ocultes ni implementes una solución improvisada.

Márcalo como:

"REQUIERE DECISIÓN DEL DESARROLLADOR"

y explica las opciones.

Prioriza seguridad real sobre cantidad de cambios.

No cambies funcionalidades por comodidad.

No borres código simplemente porque "no parece utilizarse".

Antes de eliminar cualquier cosa, demuestra que no tiene dependencias.

El objetivo final es:

UN SISTEMA FUNCIONAL + SEGURO + MANTENIBLE + PREPARADO PARA PRODUCCIÓN EN HOSTINGER.