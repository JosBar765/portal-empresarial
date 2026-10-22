# Portal Web de Herramientas Empresariales — MundiTrofeos S.A.

Este proyecto consiste en una plataforma web corporativa centralizada que aloja múltiples herramientas y flujos de trabajo internos de la empresa mediante una arquitectura de **Monolito Modular** robusta y escalable.

El diseño del portal ha sido homogeneizado en tipografía, colores y proporciones a partir de la interfaz de **Gestión de Eventos de MundiTrofeos S.A.** (`eventos_mt`), garantizando una experiencia de usuario armónica y profesional.

---

## 1. Arquitectura General y Tecnologías

El sistema está diseñado para evitar la dispersión de servidores e infraestructura, agrupando toda la lógica en una única aplicación de Node.js modularizada:

```text
Usuario (Navegador)
       │
       ▼
   Frontend (HTML5, Vanilla CSS, JS)  ◄─── [Diseño Consistente Inter]
       │
       ▼
 API Express (Node.js) ◄───► Socket.IO (Mensajería en Tiempo Real)
       │
       ▼
  Módulos Centrales (Autenticación, Permisos, Archivos)
       │
       ▼
 Módulos de Negocio (Vales, Prompts, Eventos)
       │
       ▼
 Repositorios de Acceso a Datos
       │
       ▼
  MySQL (Base de Datos Unificada)
```

### Stack de Tecnologías
*   **Servidor Backend**: Node.js v18+ y Express.js
*   **Base de Datos**: MySQL
*   **Tiempo Real**: WebSockets mediante Socket.IO (transversal a todos los módulos)
*   **Frontend**: HTML5, Vanilla CSS (diseño responsivo y adaptativo sin Tailwind), JavaScript nativo e Ionicons para iconos vectoriales.
*   **Seguridad**: Hash de contraseñas con `bcryptjs`, autenticación JWT sin estado (access token + refresh token rotativo en cookies httpOnly), y control de acceso granular basado en permisos.

---

## 2. Estructura del Proyecto

El código está organizado de la siguiente manera:

```text
portal-empresarial/
├── .agents/                      # Documentación para personas y agentes de IA
│   ├── reglas/                   # Reglas globales (arquitectura, auth, UI, entornos, SQL)
│   └── modulos/                  # Un README y documentacion/ por módulo de negocio
├── CLAUDE.md                     # Guía maestra del monolito modular
├── database/
│   ├── schema.sql                # Estructura (CREATE TABLE, claves, índices)
│   ├── seed.sql                  # Catálogos y datos de organización reales
│   ├── users.sql                 # Usuarios, talleres y sus asignaciones (desarrollo)
│   └── migrations/               # Scripts idempotentes para bases que ya están en producción
├── public/                       # Contenido estático del Frontend
│   ├── assets/
│   │   └── logos/                # Logos corporativos e isotipos de MundiTrofeos
│   ├── css/
│   │   ├── global.css            # Hoja de estilos compartida (tokens de diseño, variables)
│   │   ├── login.css             # Estilos de la interfaz de inicio de sesión
│   │   └── dashboard.css         # Estilos del panel de control de módulos
│   ├── js/
│   │   └── dashboard.js          # Lógica interactiva del Dashboard y cliente Socket.IO
│   ├── login/
│   │   └── index.html            # Interfaz de Ingreso a pantalla partida
│   ├── dashboard/
│   │   └── index.html            # Dashboard principal dinámico de módulos
│   └── modules/                  # Espacio para los frontends de cada módulo de negocio
├── src/                          # Backend de la Aplicación
│   ├── config/
│   │   ├── env.js                # Validación de variables de entorno
│   │   └── database.js           # Pool de conexiones MySQL
│   ├── core/                     # Capas nucleares transversales
│   │   ├── auth/                 # JWT, tokens de acceso/refresco y rutas de autenticación
│   │   ├── permissions/          # Guards de permisos, catálogo de módulos, modo mantenimiento
│   │   ├── websocket/            # Gestor central de WebSockets (Socket.IO)
│   │   ├── files/                # Supabase Storage y subida de archivos
│   │   ├── idempotency/          # Claves de idempotencia
│   │   ├── calendario/           # Horario laboral y feriados
│   │   └── notifications/        # Notificaciones
│   ├── modules/                  # Lógica de negocio de cada módulo (vales, admin)
│   ├── app.js                    # Configuración de Express y middlewares
│   └── server.js                 # Punto de entrada y levantamiento del puerto HTTP
├── .env.example                  # Plantilla de variables de entorno
├── .gitignore                    # Reglas de exclusión de Git (ignora .env y node_modules)
└── package.json                  # Definición del proyecto y dependencias de npm
```

---

## 3. Instalación y Puesta en Marcha

### Prerrequisitos
Tener instalado [Node.js](https://nodejs.org/) (Versión 18 o superior).

### Paso 1: Clonar e instalar dependencias
Abre tu consola de comandos en la carpeta raíz del proyecto (`portal-empresarial/`) e instala las dependencias necesarias de npm:
```bash
npm install
```

### Paso 2: Configurar Base de Datos MySQL
1. Crea una base de datos en tu servidor MySQL (local o hosting) llamada `portal_empresarial`.
2. Importa, en este orden, los archivos de `database/`: `schema.sql` (estructura), `seed.sql` (catálogos y organización) y `users.sql` (usuarios). No hay fallback: si MySQL no está disponible, el servidor no arranca.
3. Duplica el archivo `.env.example`, renombrándolo a `.env`, y edita las credenciales de conexión correspondientes (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, etc.).

### Paso 3: Arrancar en desarrollo
Para levantar el servidor web local con recarga en caliente automática (modo watch de Node.js):
```bash
npm run dev
```

El portal estará disponible en la URL local: **`http://localhost:3000`**

---

## 4. ¿Cómo agregar un nuevo módulo empresarial?

Agregar un nuevo módulo (por ejemplo, `inventario`) es un proceso directo que requiere seguir la estructura monolítica establecida en el proyecto:

1. **Crear carpeta del módulo en Backend**: Crea el subdirectorio `src/modules/inventario/` y estructura sus capas (controlador, servicio, repositorio, rutas y eventos). Puedes guiarte por las plantillas completas de código de la [Guía de Creación de Módulos](.agents/reglas/reglas_modulo.md) y por el paso a paso de [CLAUDE.md](CLAUDE.md).
2. **Crear carpeta del módulo en Frontend**: Crea el subdirectorio `public/modules/inventario/` para albergar su interfaz estática (`index.html`, `js/app.js`, `css/styles.css`).
3. **Registrar Rutas de la API**: Importa y monta tus rutas en [src/app.js](src/app.js) protegidas por el middleware de seguridad (ej: `app.use('/api/inventario', requireAuth, inventarioRoutes)`).
4. **Agregar al Catálogo Dinámico**: Registra el módulo en `MODULOS` de `src/core/permissions/modulesCatalog.js` (lo consume `/api/modules`), asignándole el código de permiso necesario (ej. `inventario.ver`), icono vector y color representativo.

5. **Documentar el módulo**: Crea `.agents/modulos/inventario/README.md` y `.agents/modulos/inventario/documentacion/`.

El Dashboard del usuario detectará automáticamente la adición del módulo y lo listará dinámicamente si el usuario autenticado cuenta con los permisos necesarios.

---

## 5. Control de Acceso y Autenticación Centralizada

*   **Autenticación**: El usuario ingresa a través del Login (`public/login/index.html`). El controlador central valida sus credenciales y emite un **JWT de acceso** de corta vida más un **refresh token** rotativo, ambos en cookies httpOnly; la identidad del usuario sale siempre de `req.user`, nunca del cuerpo de la petición. Especificación: `.agents/reglas/reglas_autenticacion.md`.
*   **Permisos**: La plataforma implementa un control de acceso basado en permisos individuales (ej: `vales.crear`, `eventos.ver`), asignados jerárquicamente a roles (`Administrador`, `Diseñador`, `Asesor de Ventas`).
*   **Protección**: Los botones del frontend se ocultan de forma dinámica y reactiva, y todas las peticiones a la API del backend se blindan a nivel de controlador mediante el middleware `requirePermission('permiso.codigo')`.
