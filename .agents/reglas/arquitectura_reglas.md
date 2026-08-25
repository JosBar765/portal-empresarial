# Portal Web de Herramientas Empresariales

## 1. Descripción general

Este proyecto es una plataforma web interna para centralizar diferentes herramientas y procesos de la empresa en un único portal.

La plataforma debe permitir que los usuarios inicien sesión y, dependiendo de su rol y permisos, puedan acceder a diferentes módulos y funcionalidades.

La arquitectura debe estar preparada para incorporar nuevos módulos posteriormente, por ejemplo:

- Generador de prompts.
- Gestión y consulta de eventos.
- Reportes.
- Inventario.
- Otras herramientas internas.

El sistema debe diseñarse desde el inicio pensando en escalabilidad y mantenimiento.

---

# 2. Objetivo arquitectónico

El proyecto debe implementarse como un **monolito modular**.

No se deben crear aplicaciones Node.js independientes para cada herramienta.

Debe existir una única aplicación Node.js que contenga diferentes módulos independientes.

Ejemplo:

Portal
├── Autenticación
├── Usuarios y permisos
├── Vales de Arte
├── Generador de Prompts
├── Eventos
└── Otros módulos futuros

Cada módulo debe estar aislado a nivel de código y debe contener su propia lógica de negocio, rutas, controladores y acceso a datos.

Los módulos no deben depender directamente de la implementación interna de otros módulos.

---

# 3. Stack tecnológico

## Backend

- Node.js
- Express.js
- Socket.IO

## Base de datos

- MySQL

La base de datos será proporcionada por el hosting.

## Frontend

Inicialmente:

- HTML
- CSS
- JavaScript

No utilizar un framework frontend pesado a menos que posteriormente sea necesario.

## Tiempo real

- Socket.IO
- WebSockets

## Hosting

La aplicación será desplegada en un hosting con soporte para aplicaciones Node.js y MySQL.

La arquitectura debe ser compatible con un entorno de hosting administrado y no debe requerir acceso root, Docker ni configuración de un VPS.

---

# 4. Arquitectura general

La aplicación debe seguir una arquitectura modular:

Usuario
    ↓
Frontend
    ↓
API / Express
    ↓
Módulos
    ↓
Servicios
    ↓
Repositorios
    ↓
MySQL

Socket.IO debe funcionar como una capa transversal para comunicación en tiempo real.

Ejemplo:

Usuario A realiza una acción
    ↓
Backend
    ↓
Base de datos
    ↓
Socket.IO
    ↓
Usuarios conectados
    ↓
Actualización automática de sus interfaces

---

# 5. Estructura del proyecto

La estructura debe mantenerse aproximadamente de la siguiente manera:

src/
│
├── config/
│   ├── database.js
│   └── env.js
│
├── core/
│   ├── auth/
│   ├── permissions/
│   ├── websocket/
│   ├── notifications/
│   └── files/
│
├── modules/
│   │
│   ├── vales/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── routes.js
│   │   └── events.js
│   │
│   ├── prompts/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── routes.js
│   │
│   ├── eventos/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── routes.js
│   │
│   └── ...
│
├── app.js
└── server.js


public/
│
├── assets/
├── css/
├── js/
│
├── login/
├── dashboard/
│
└── modules/
    ├── vales/
    ├── prompts/
    └── eventos/


database/
│
├── migrations/
└── seeds/


uploads/

.env
.gitignore
package.json
README.md

---

# 6. Regla fundamental de modularidad

Cada nueva funcionalidad empresarial debe implementarse como un módulo independiente.

Por ejemplo, si se solicita un nuevo módulo llamado "Inventario", NO se debe agregar toda su lógica directamente a:

- server.js
- app.js
- un único archivo global
- módulos existentes

Debe crearse:

src/modules/inventario/

con su propia estructura.

Ejemplo:

src/modules/inventario/
├── controllers/
├── services/
├── repositories/
├── routes.js
└── events.js

El módulo debe ser independiente de los demás módulos siempre que sea posible.

---

# 7. Responsabilidad de cada capa

## Controllers

Los controllers reciben las solicitudes HTTP y devuelven las respuestas.

No deben contener lógica de negocio compleja.

Ejemplo:

POST /api/vales

El controller recibe los datos y delega la operación al service.

---

## Services

Los services contienen la lógica de negocio.

Ejemplo:

- Validar una orden.
- Cambiar el estado de un vale.
- Determinar si una operación está permitida.
- Crear un registro.
- Emitir un evento después de una operación.

Los controllers no deben implementar estas reglas directamente.

---

## Repositories

Los repositories son responsables del acceso a la base de datos.

Las consultas SQL deben permanecer dentro de esta capa siempre que sea posible.

Ejemplo:

valeRepository.crear()
valeRepository.obtenerPorId()
valeRepository.actualizarEstado()

---

## Routes

Las rutas deben definir los endpoints disponibles para cada módulo.

Ejemplo:

/api/vales
/api/vales/:id
/api/vales/:id/estado

---

# 8. Autenticación

El sistema debe contar con autenticación centralizada.

Todos los módulos deben utilizar el mismo sistema de autenticación.

El usuario debe iniciar sesión una sola vez para acceder al portal y a los módulos que tenga autorizados.

No crear sistemas de login independientes para cada módulo.

---

# 9. Roles y permisos

El sistema debe implementar autorización basada en roles y permisos.

No se debe depender únicamente de condiciones como:

if (rol === "ventas")

La autorización debe estar basada en permisos.

Ejemplo:

vales.ver
vales.crear
vales.editar
vales.eliminar

prompts.ver
prompts.crear
prompts.editar

eventos.ver
eventos.crear
eventos.editar

Un rol agrupa diferentes permisos.

Ejemplo:

ASESOR_VENTAS
- vales.ver
- vales.crear
- eventos.ver

DISEÑADOR
- vales.ver
- vales.editar
- prompts.ver

ADMINISTRADOR
- todos los permisos

Los permisos deben validarse en el backend.

Ocultar un botón en el frontend NO constituye seguridad.

---

# 10. Dashboard

Después de iniciar sesión, el usuario debe acceder a un dashboard principal.

El dashboard debe mostrar únicamente los módulos a los que el usuario tenga acceso.

Ejemplo:

Usuario con permisos de Vales:

[ Vales de Arte ]

Usuario con permisos de Vales + Eventos:

[ Vales de Arte ] [ Eventos ]

Usuario administrador:

[ Vales de Arte ]
[ Generador de Prompts ]
[ Eventos ]
[ Administración ]

Los módulos deben poder agregarse al dashboard sin modificar la arquitectura principal.

---

# 11. Base de datos

Debe utilizarse una única base de datos MySQL.

Las tablas deben estar organizadas de acuerdo con los módulos y responsabilidades.

No crear bases de datos independientes para cada módulo salvo que exista una razón técnica futura para hacerlo.

---

# 12. Archivos e imágenes

Los archivos no deben almacenarse directamente como BLOB dentro de MySQL salvo que exista una razón específica.

MySQL debe almacenar los metadatos del archivo:

- ID
- nombre
- ruta
- tipo
- tamaño
- usuario que lo subió
- fecha

Los archivos deben almacenarse en el sistema de archivos o en un servicio de almacenamiento externo.

La implementación debe permitir migrar posteriormente a almacenamiento externo sin modificar la lógica de negocio.

---

# 13. Variables de entorno

Las credenciales y configuraciones sensibles nunca deben escribirse directamente en el código.

Utilizar variables de entorno:

DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=

SESSION_SECRET=

etc.

El archivo .env no debe subirse al repositorio.

---

# 14. Reglas para la IA durante el desarrollo

La IA debe respetar las siguientes reglas:

1. No colocar lógica de negocio directamente en server.js.

2. No crear archivos monolíticos con cientos o miles de líneas si la lógica puede dividirse.

3. No mezclar lógica de diferentes módulos.

4. Las nuevas herramientas deben implementarse como módulos independientes.

5. Reutilizar servicios comunes cuando corresponda.

6. No duplicar sistemas de autenticación.

7. No duplicar sistemas de WebSocket.

8. Los permisos deben validarse en el backend.

9. Las consultas SQL deben mantenerse en repositories.

10. La lógica de negocio debe mantenerse en services.

11. Los controllers deben ser delgados.

12. Antes de crear una nueva dependencia o tecnología, evaluar si realmente es necesaria.

13. No modificar módulos existentes innecesariamente al agregar una nueva funcionalidad.

14. Mantener compatibilidad con el entorno de hosting Node.js administrado.

15. No introducir Docker, microservicios o infraestructura que requiera VPS sin una razón técnica explícita.

16. Antes de realizar cambios estructurales importantes, explicar qué archivos serán modificados y por qué.

---

# 15. Principio de escalabilidad

La aplicación debe permitir agregar nuevos módulos sin modificar significativamente los módulos existentes.

Por ejemplo:

Si actualmente existen:

modules/
├── vales/
├── prompts/
└── eventos/

y posteriormente se solicita:

"Crear módulo de inventario"

La implementación esperada es:

modules/
├── vales/
├── prompts/
├── eventos/
└── inventario/

sin convertir server.js o app.js en archivos gigantes.

---

# 16. Principios generales

Priorizar:

- Modularidad.
- Separación de responsabilidades.
- Reutilización.
- Seguridad.
- Mantenibilidad.
- Escalabilidad.
- Código sencillo.
- Compatibilidad con el hosting actual.

Evitar sobreingeniería.

El objetivo no es construir microservicios ni una arquitectura excesivamente compleja, sino una aplicación modular que pueda crecer de forma ordenada.

Los módulos deben implementarse progresivamente.

Cada nuevo módulo debe respetar la arquitectura y convenciones establecidas en este documento.

---