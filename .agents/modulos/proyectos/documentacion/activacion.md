# Activación del módulo Proyectos (fase 8)

Las migraciones 33 a 41 crean las tablas y los 14 permisos `proyectos.*` **sin asignarlos a ningún rol**: mientras tanto el módulo no aparece en el portal (un módulo solo cuenta como permitido con su permiso `.ver`). **Activarlo es asignar esos permisos a los roles**. Es una acción del dueño del portal: los agentes de IA no la hacen en staging ni en producción.

## Qué permiso lleva cada rol

| Permiso | Administrador | Asesor | Supervisor | Gerente | Para qué |
|---|:-:|:-:|:-:|:-:|---|
| `proyectos.ver` | ✓ | ✓ | ✓ | ✓ | Entrar al módulo |
| `proyectos.clientes.registrar` | ✓ | ✓ | ✓ | | Crear y editar empresas y contactos |
| `proyectos.clientes.importar` | ✓ | | ✓ | | Importar listas |
| `proyectos.gestionar` | | ✓ | ✓ | | Gestionar las empresas que le tocaron |
| `proyectos.activar` | ✓ | | ✓ | | Crear, activar, cancelar y cerrar proyectos |
| `proyectos.reasignar` | ✓ | | ✓ | | Pasar empresas de un asesor a otro |
| `proyectos.supervisar` | | | ✓ | | Ver el avance de su equipo |
| `proyectos.ver_gerencia` | ✓ | | | ✓ | Ver todo en solo lectura |
| `proyectos.dar_visto_bueno` | | | | ✓ | Dar o devolver el visto bueno al cierre |
| `proyectos.ver_reportes` | ✓ | | ✓ | ✓ | Ver y exportar informes en PDF |
| `proyectos.corregir` | ✓ | | ✓ | | Anular una cotización o venta equivocada |
| `proyectos.aprobar_activacion` | ✓ | | | ✓ | Aprobar o rechazar la activación (si el interruptor está encendido) |
| `proyectos.confirmar_ventas` | ✓ | | ✓ | | Confirmar o rechazar ventas por confirmar (si el interruptor está encendido) |
| `proyectos.administrar` | ✓ | | | | Todo el Centro de configuración |

El resto de roles (encargados de diseño, diseñadores, asistentes) no recibe ninguno. El mismo mapa vive en `src/modules/proyectos/permisosPorRol.js`. La interfaz y el servidor deciden siempre por **permiso**, nunca por el nombre del rol.

## Pasos

1. **Confirmar la base.** Las migraciones se aplican solas al arrancar el servidor en staging y producción (`npm run migrate:estado` en desarrollo). Comprobar con `node scripts/proyectos/activacion.js --verificar` (solo lectura, usa la base del `.env`): debe decir que los permisos existen y mostrar lo que falta asignar.
2. **Primero staging.** Desplegar en staging, refrescarla desde producción si hace falta y hacer los pasos 3 a 6 allí. Producción después, con el mismo orden.
3. **Dejar lista la configuración** (Administrador, antes de que el primer supervisor active nada): en el **Centro de configuración** revisar el inicio (A0): moneda de cada país (Belice sale en dólares hasta que se elija una), la plantilla predeterminada, el alcance de usuarios por país, los catálogos (nichos, artículos, canales, resultados, motivos de pérdida, monedas) y las reglas (aprobación del gerente al activar, confirmación de ventas, visto bueno al cerrar).
4. **Asignar los permisos desde la pantalla Roles de Administración**, un rol a la vez, con la tabla de arriba. Es la forma preferida: al guardar, el portal avisa por socket a quien esté conectado y su sesión se renueva sola. (Alternativa para revisar: `node scripts/proyectos/activacion.js --sql` imprime un SQL idempotente, `INSERT IGNORE`, que no quita nada; con ese camino la sesión se renueva al volver a entrar.)
5. **Avisar a los usuarios.** Quien tenga la sesión abierta y no esté conectado en ese momento debe **volver a entrar** para ver el módulo. Texto sugerido: «Ya está disponible Proyectos en el portal. Si no ves la tarjeta, cierra sesión y vuelve a entrar.»
6. **Probar con cada rol** (cuentas de prueba de staging): 
   - **Asesor:** ve Mi proyecto, Para hoy, Cartera y Mis proyectos anteriores; no ve Seguimiento ni la configuración.
   - **Supervisor:** crea y activa un proyecto de sus tiendas, ve Seguimiento, reasigna, anula, confirma ventas (si está encendido) y cierra.
   - **Gerente:** ve el Panel gerencial y Por dar visto bueno; no reasigna ni anula; da el visto bueno.
   - **Administrador:** ve el Centro de configuración y todo en solo lectura de gerencia.
   - **Diseñador y encargado:** no ven la tarjeta de Proyectos.
   - **Dos supervisores a la vez:** dos supervisores que comparten tiendas arman su proyecto y activan al mismo tiempo; uno gana y el otro recibe el aviso de qué tienda falló.
7. **Cuando todo esté bien en staging**, repetir en producción (pasos 1, 3, 4 y 5). El primer proyecto real conviene hacerlo con un supervisor y una tienda.

## Cómo deshacerlo

Quitar los permisos `proyectos.*` al rol desde la misma pantalla Roles: el módulo desaparece del portal al renovarse la sesión. **Los datos no se tocan** (empresas, proyectos, gestiones, ventas); al volver a asignar los permisos, todo sigue donde estaba.

## Verificación

`node scripts/proyectos/verificar-activacion.js` (base desechable; 23 comprobaciones, también en MariaDB 11.8) asigna el mapa con la misma función que usa la pantalla de Roles (`adminService.actualizarPermisosRol`), comprueba que el módulo aparezca solo para Administrador, Asesor, Supervisor y Gerente, recorre doce rutas con los permisos que cada rol recibe de verdad (quién puede y quién recibe 403), prueba a dos supervisores activando a la vez la misma tienda y deja los permisos como estaban.

## Para abrir los pull requests

Las ramas están apiladas; se abren en orden contra `dev`: `01-base-datos`, `02a-clientes`, `02b-importacion`, `02c-campos-y-alcance`, `03a-reparto`, `03b-plantillas-aprobacion`, `03c-asistente`, `04a-registros`, `04b-pantallas-asesor`, `05a-seguimiento-servidor`, `05b-seguimiento-pantallas`, `06a-cierre-informe`, `06b-cierre-gerencia-pantallas`, `06c-avisos`, `07-integracion-vales` y `08-activacion` (todas con prefijo `feature/proyectos-`). Cada PR se compara contra la anterior; al fusionarse, la siguiente se rebasa sola sobre `dev`.
