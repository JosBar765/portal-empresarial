# Correcciones #35 — Dar de baja un vale antes de ser autorizado

Rama: `feature/dar-de-baja-vale`.

## Qué hace

Nuevo permiso `vales.dar_de_baja`, asignado al rol Asesor de Ventas. Permite al asesor dueño de un vale **no autorizado** (`ESPERANDO_AUTORIZACION`) darlo de baja: se borra por completo (fila, adjuntos y PDF), igual que el rechazo del supervisor (`eliminarValeConArchivos`). Es exclusivo del asesor de ventas: ni el Administrador ni el Supervisor pueden usarlo, aunque se les asigne el permiso.

## Cambios

- `database/seed.sql`: permiso `vales.dar_de_baja` (id 24) y su asignación al rol 2.
- `valeCreacionService.darDeBaja` (dentro del lock del vale, así no puede cruzarse con una autorización simultánea): exige rol asesor, vale propio y estado `ESPERANDO_AUTORIZACION`; avisa en tiempo real al asesor y a sus supervisores (el buzón de estos se refresca).
- `POST /api/vales/:id/dar-de-baja` (`requirePermission('vales.dar_de_baja')`), controlador y fachada `valeService`.
- Frontend: acción "Dar de baja" en el buzón del asesor (ícono `ban-outline` rojo, solo en vales esperando autorización), con modal de confirmación "¿Estás seguro?" y botón rojo "Dar de baja". `puede('darDeBaja')` depende del permiso y del rol asesor.

## Mensajes de error

| Situación | Mensaje |
|---|---|
| Dar de baja un vale ya autorizado | "Este vale ya fue autorizado, así que ya no se puede dar de baja." |
| Autorizar, rechazar o dar de baja un vale ya borrado | "Este vale ya no existe: fue dado de baja o rechazado." (antes: "Vale de arte no encontrado.", ahora común a todas las acciones sobre un vale inexistente) |
| Dar de baja el vale de otro asesor | "Solo puedes dar de baja tus propios vales." |
| Usuario sin el permiso | "No tienes permiso para realizar esta acción." |

En el modal, tras un error el buzón se refresca solo para que el vale deje de aparecer accionable.

## Bases de datos existentes

El seed solo cubre instalaciones nuevas. En una base ya creada hay que insertar el permiso y asignarlo (o crearlo y asignarlo desde Administración):

```sql
INSERT INTO `permisos` (`id`, `codigo`, `nombre`, `modulo`, `descripcion`) VALUES (24, 'vales.dar_de_baja', 'Dar de baja Vales de Arte', 'vales', 'Permite al asesor dar de baja un vale de arte propio antes de que sea autorizado');
INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`) VALUES (2, 24);
```

Los asesores con sesión abierta lo reciben al iniciar sesión de nuevo (o a la siguiente renovación de su token).

## Verificación

- Por API: dar de baja un vale sin autorizar (200); repetirlo (mensaje de "ya no existe"); supervisor intentando darlo de baja (403); asesor dando de baja un vale ya autorizado (mensaje de "ya autorizado"); supervisor autorizando y rechazando un vale ya dado de baja ("ya no existe").
- En el navegador, como la asesora Alejandra Luna: el ícono rojo aparece solo en los vales "Esperando Autorización"; el modal "¿Estás seguro?" elimina el vale y baja el contador; con el modal abierto, el supervisor autorizó el vale y al confirmar apareció "Este vale ya fue autorizado, así que ya no se puede dar de baja."
- No se probó en pantalla el mensaje del supervisor ante un vale ya dado de baja (solo por API).
