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
*   **Seguridad**: Hash de contraseñas con `bcryptjs`, sesiones protegidas con `express-session`, y control de acceso granular basado en permisos.

---

## 2. Estructura del Proyecto

El código está organizado de la siguiente manera:

```text
portal-empresarial/
├── .agents/                      # Reglas de arquitectura y diseño para agentes de IA
├── database/
│   └── schema.sql                # Estructura e inserciones base (semilla) de base de datos
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
│   │   └── database.js           # Pool de conexiones MySQL y base de datos Mock en memoria
│   ├── core/                     # Capas nucleares transversales
│   │   ├── auth/                 # Servicios, controladores y rutas de sesión
│   │   ├── permissions/          # Middleware de validación de permisos
│   │   ├── websocket/            # Gestor central de WebSockets (Socket.IO)
│   │   └── files/                # Gestor de subida de archivos física/nube
│   ├── modules/                  # Espacio para la lógica de negocio de cada módulo
│   │   └── readme_modulo.md      # Guía detallada con código plantilla para nuevos módulos
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
2. Importa el archivo de migración y semillas ubicado en [database/schema.sql](file:///c:/Users/Usuario-PC/Desktop/Proyectos/portal-empresarial/database/schema.sql).
3. Duplica el archivo `.env.example`, renombrándolo a `.env`, y edita las credenciales de conexión correspondientes (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, etc.).

> [!NOTE]
> **Modo Fallback Integrado (Mock)**:
> Si la conexión al servidor MySQL local falla o no se configura en el archivo `.env`, la aplicación **no fallará**. Se activará automáticamente un repositorio en memoria cargado con los datos de prueba iniciales de forma que podrás probar el login y explorar el dashboard inmediatamente.

### Paso 3: Arrancar en desarrollo
Para levantar el servidor web local con recarga en caliente automática (modo watch de Node.js):
```bash
npm run dev
```

El portal estará disponible en la URL local: **`http://localhost:3000`**

### Usuarios de Prueba Predeterminados (Base de datos Semilla / Mock)
| Correo Electrónico | Contraseña | Rol Asignado | Módulos Autorizados |
| :--- | :--- | :--- | :--- |
| `admin@munditrofeos.com` | `admin123` | Administrador | Todos los módulos + Administración |
| `diseno@munditrofeos.com` | `diseno123` | Diseñador | Vales de Arte, Generador de Prompts |
| `ventas@munditrofeos.com` | `ventas123` | Asesor de Ventas | Vales de Arte, Eventos y Carreras |

---

## 4. ¿Cómo agregar un nuevo módulo empresarial?

Agregar un nuevo módulo (por ejemplo, `inventario`) es un proceso directo que requiere seguir la estructura monolítica establecida en el proyecto:

1. **Crear carpeta del módulo en Backend**: Crea el subdirectorio `src/modules/inventario/` y estructura sus capas (controlador, servicio, repositorio, rutas y eventos). Puedes guiarte por las plantillas completas de código redactadas en la [Guía de Creación de Módulos](file:///c:/Users/Usuario-PC/Desktop/Proyectos/portal-empresarial/src/modules/readme_modulo.md).
2. **Crear carpeta del módulo en Frontend**: Crea el subdirectorio `public/modules/inventario/` para albergar su interfaz estática (`index.html`, `js/app.js`, `css/styles.css`).
3. **Registrar Rutas de la API**: Importa y monta tus rutas en [src/app.js](file:///c:/Users/Usuario-PC/Desktop/Proyectos/portal-empresarial/src/app.js) protegidas por el middleware de seguridad (ej: `app.use('/api/inventario', requireAuth, inventarioRoutes)`).
4. **Agregar al Catálogo Dinámico**: Registra el módulo en la lista JSON retornada por el endpoint `/api/modules` en `src/app.js`, asignándole el código de permiso necesario (ej. `inventario.ver`), icono vector y color representativo.

El Dashboard del usuario detectará automáticamente la adición del módulo y lo listará dinámicamente si el usuario autenticado cuenta con los permisos necesarios.

---

## 5. Control de Acceso y Sesión Centralizada

*   **Autenticación**: El usuario ingresa a través del Login (`public/login/index.html`). El controlador central valida sus credenciales y crea una sesión de Express guardando su información básica en `req.session.user`.
*   **Permisos**: La plataforma implementa un control de acceso basado en permisos individuales (ej: `vales.crear`, `eventos.ver`), asignados jerárquicamente a roles (`Administrador`, `Diseñador`, `Asesor de Ventas`).
*   **Protección**: Los botones del frontend se ocultan de forma dinámica y reactiva, y todas las peticiones a la API del backend se blindan a nivel de controlador mediante el middleware `requirePermission('permiso.codigo')`.
