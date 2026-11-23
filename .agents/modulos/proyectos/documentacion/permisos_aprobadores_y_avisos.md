# Permisos de configuración, aprobadores por persona y avisos que llevan a la acción

Cambios de operación del módulo Proyectos (migraciones `proyectos_configurar` y `proyectos_aprobadores`).

## 1. Quién cambia la configuración
- La configuración de Proyectos es **global** (una sola para todas las tiendas y países). Lo único por persona es el Alcance de usuarios.
- Permiso `proyectos.configurar` (Supervisor y Administrador): Plantillas, Notificaciones, Kit del nicho, Campos propios, Plan del año y ver el Historial.
- Permiso `proyectos.administrar` (solo Administrador): además, Catálogos, Parámetros, Reglas y aprobaciones, Alcance de usuarios y restaurar valores del Historial.
- En el servidor: `configurar` (cualquiera de los dos) y `administrar` en `routes.js`. En pantalla, las tarjetas solo-admin llevan candado y la ruta explica que es del administrador.
- Quien no es administrador ve «Lo que cambies aquí vale para todas las tiendas» y confirma antes de guardar. Todo queda en el Historial.
- Los permisos se crean sin asignar: se dan a los roles desde Administración → Roles (o `scripts/proyectos/activacion.js --sql`).

## 2. Quién aprueba y quién da el visto bueno
- Ya no son permisos de rol: el administrador elige **personas**, en Reglas y aprobaciones → «Quién aprueba» (tabla `proy_aprobadores`, pasos `activacion` y `visto_bueno`).
- El servidor traduce la lista a los permisos virtuales `proyectos.aprobar_activacion` y `proyectos.dar_visto_bueno` en cada petición (`aprobadorService.permisosDe`); `GET /api/proyectos/yo` los entrega a la interfaz para armar el menú.
- Sin nadie asignado, nadie aprueba; la pantalla avisa si el paso está encendido y la lista vacía.
- «Activación pedida» y «Cierre pendiente» llegan a las personas de su paso; los demás avisos de gerencia, a quien tiene `proyectos.ver_gerencia`.
- «Gerente» es solo un rol (hoy una persona); los textos dicen «quien aprueba».

## 3. Avisos que abren su pantalla y «volver»
- Un clic en un aviso de la campana abre la pantalla relacionada (`js/utils/avisosRutas.js`) y muestra «← Volver a <pantalla>» (`components/barraVolver.js`).
- «Crear vale» agrega `volver=` (solo rutas `#/...` de Proyectos); Vales muestra «← Volver a Proyectos». No cambia nada más de Vales.

## 4. Ficha de la empresa: «¿Qué vas a hacer?»
- `components/accionesFicha.js`: Contactar (personas con Llamar, WhatsApp, Correo; Mensajes y guion), Registrar (gestión, cotización, venta; perdida y descartar aparte) y Crear vale. Escritorio: menús bajo el botón; celular: hoja inferior.
- El asesor agrega y edita contactos desde la ficha (`ventanaContacto`).
- Mockups: Figma `3OvP90pDHgudd6fVYjsoZu`, D2b, D2c y M3b–M3d.

## Verificación
`scripts/proyectos/verificar-configurar.js`, `verificar-aprobadores.js`, `verificar-ayudas.js`.
