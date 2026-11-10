# Integración con Vales de Arte (fase 7)

El asesor que consigue un cliente interesado crea el vale de arte **sin volver a escribir sus datos**, y el vale queda **ligado a su empresa** en Proyectos. La conexión es pequeña y aislada: **el backend de Vales no depende de Proyectos**; Vales solo gana un cambio de interfaz.

## Flujo

1. En la ficha de la empresa (`#/empresa/<id>`), el botón **«Crear vale»** abre `/modules/vales/?prellenar=proyectos:<id>`. Solo aparece con el permiso `vales.crear` y mientras la empresa siga abierta (`registro.puedeCrearVale`).
2. **La dirección solo lleva el id de la participación**: ningún dato personal viaja por la URL. Vales la lee, la limpia de la barra (`history.replaceState`) y pide los datos a Proyectos con la sesión del asesor.
3. Se abre el formulario «Crear vale» con un **banner** («Datos de Proyectos · empresa. Al guardar, el vale se vincula a OV-5231»), la **empresa y el cliente bloqueados** (vienen de la cartera), el teléfono y el correo del contacto principal y la descripción sugerida, editables. El resto del formulario es el de siempre.
4. Al confirmar la creación, Vales avisa a Proyectos para ligar el vale. Si el aviso falla, el vale **ya existe** y se dice con claridad que no se ligó.
5. El vale ligado sale en el **historial de la empresa** («Vale de arte VAL-…»), también en la vista del supervisor.

## API (`/api/proyectos`, permiso `proyectos.gestionar`)

- `GET /participaciones/:id/prefill-vale`: solo el asesor dueño (otro recibe 404) y solo con el proyecto activo (409 si no). Devuelve la empresa, el contacto principal (nombre, teléfono ya separado en prefijo y número para el selector de país de Vales, correo), la **referencia vigente** (la de la venta, o la de la cotización) y una **descripción sugerida** (la nota de la última cotización o gestión, hasta 600 caracteres). Sin contactos usa el nombre y el teléfono de la empresa.
- `POST /participaciones/:id/vincular-vale` con `{ valeId }`: el vale debe existir y ser **del mismo asesor** (uno ajeno responde igual que uno inexistente: 404). Repetir la misma liga responde bien (`repetida: true`) y no duplica; un vale ya ligado a **otra** empresa responde 409. Una empresa puede tener varios vales. Cada liga queda en el historial del proyecto (`vincular_vale`).

## Datos

Tabla propia `proy_vales (participacion_id, vale_id UNIQUE, vinculado_por, vinculado_en)` (migración 41, aditiva). Se eligió una tabla propia y no las columnas `vale_id` de cotizaciones y ventas: esas atan el vale a un registro de dinero que quizá aún no existe; aquí el vínculo es con la empresa. Si el vale se borra en Vales, su liga desaparece (`ON DELETE CASCADE`). Las únicas consultas de Proyectos sobre la tabla `vales` son de lectura (dueño y correlativo) y están en `repositories/valeRepository.js`.

## Código

Proyectos: `services/valeVinculoService.js` · `controllers/valeVinculoController.js` · `repositories/valeRepository.js` · rutas en `routes.js` · la ficha (`gestionService.ficha`) suma los vales a la línea de tiempo y `registro.puedeCrearVale` · `views/empresaAsesor.js` (botón y vales en el historial).
Vales (solo interfaz): `js/app.js` (lee `prellenar`), `js/forms/valeForm.js` (banner, campos prellenados y bloqueados, aviso al guardar) y `js/api/valesApi.js` (dos llamadas), más unas reglas de `css/styles.css`. Sin el parámetro, el formulario no cambia.

## Verificación

`node scripts/proyectos/verificar-vales.js` (base desechable; 24 comprobaciones, también en MariaDB 11.8): prefill (permiso, dueño, contacto principal, referencia, descripción, proyecto cerrado), vincular (vale ajeno o inexistente, repetir, otra empresa, varios vales, historial del asesor y del supervisor, borrar el vale) y que la ficha ofrezca «Crear vale» solo con permiso.
