# Correcciones #20

## Gestionar Usuarios

- **Transaccional**: `crearUsuario` ya no hace ninguna asignación de tienda/taller — al no quedar ningún paso fallible después del insert base, no puede quedar un usuario huérfano si algo falla.
- El modal "Nuevo usuario"/"Editar información" quedó reducido a Nombre, Correo, Contraseña, Rol (solo al crear) y Teléfono (solo Asesor/Supervisor). Toda la lógica de asignación de tienda/taller que tenía se movió a "Gestionar Tiendas" y a la nueva pestaña "Gestionar Talleres".
- El rol ya no se puede cambiar al editar un usuario — se fija en la creación.
- El candado de activar/desactivar usuario estaba invertido (activo se veía cerrado); ahora sigue el mismo criterio que Roles y Permisos: desbloqueado/verde = activo, bloqueado/rojo = inactivo.
- El teléfono ahora incluye un selector de código de país (mismo patrón que el formulario de vales), en vez de un solo campo de texto libre.

## Gestionar Tiendas

- "Agregar personal" ya no permite asignar a un Encargado de taller, Técnico, Asistente, Gerente o Administrador desde ahí — su ubicación depende enteramente de su taller. Solo Asesor y Supervisor siguen siendo asignables por esta vía.
- El combobox de "Agregar personal" ya no muestra a un Asesor que ya esté asignado a otra tienda.

## Gestionar Talleres (pestaña nueva)

Reemplaza la asignación de taller que antes vivía en "Editar usuario". Cada taller (Diseño, Diseño UV/3D, Protextil, cada Diseño Local) tiene su propia acción "Gestionar personal": asignar/quitar su encargado (validado contra el rol que corresponde a ese taller específico, con el mismo rechazo por conflicto de antes) y agregar/quitar técnicos (incluyendo al Asistente en los 3 talleres de Munditrofeos, que puede "clonar" cualquiera de ellos).

## Modelo de datos

- `usuarios.tienda_id` se eliminó por completo. Asesor sigue en `asesores.tienda_id`, Supervisor en `supervisor_tiendas`; el resto de roles nunca tuvo un motivo real para tener tienda propia — su ubicación sale de su taller (`talleres.encargado_id` / `taller_tecnicos` cruzado con `encargado_tienda`).
- Como consecuencia, un Técnico de un taller compartido (Diseño/UV-3D/Protextil) ya no elige MTC o MTS explícitamente — cuenta como personal de ambas, igual que su encargado.
- `tiendaAdminRepository.listarPersonalDetalle` quedó con una sola regla en vez de ramas por rol: Asesor por `asesores.tienda_id`, cualquier ligado a un taller (encargado o técnico/asistente) si su taller cubre esa tienda en `encargado_tienda`, y Supervisor por `supervisor_tiendas`.
- No se tocaron los 11 talleres "Diseño Local" — cada tienda (salvo Trofex) sigue teniendo su propio taller y su propio encargado, sin consolidar.

## UX

- Los combobox personalizados (`crearMenuCascada`) ahora se cierran entre sí — abrir uno cierra cualquier otro que estuviera abierto (antes se podían dejar varios abiertos a la vez porque cada uno detenía la propagación de su propio click).
