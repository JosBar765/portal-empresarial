# Campos propios y alcance de usuarios (fase 2c)

Dos áreas del Centro de configuración del administrador (`proyectos.administrar`): A6 (campos propios) y A7 (alcance de usuarios por país). Ambas dejan cada cambio en el historial de configuración (A10).

## Campos propios (A6)

- **Definición** (`proy_campos`): etiqueta, **tipo** (texto, número, lista, sí/no, fecha), opciones (si es lista), nicho o todos, obligatorio, visible en la lista, orden y activo. Semilla: «¿Ya es cliente de Premia?» (sí/no, todos los nichos).
- **Clave:** se genera de la etiqueta (`¿Ya es cliente de Premia?` → `ya_es_cliente_de_premia`), solo con a-z, 0-9 y `_`; es única y **no se cambia ni se reutiliza** (si la etiqueta se repite, la clave lleva `_2`, `_3`…). El **tipo tampoco se cambia**: para otro tipo se crea otro campo.
- **Valores:** viven juntos en `proy_clientes.datos_extra` (JSON), ya tipados: texto, número, opción de la lista, sí/no (`true`/`false`) y fecha (`AAAA-MM-DD`). Las reglas de cada tipo están en `src/modules/proyectos/camposPropios.js`.
- **Validación** (formulario y CSV): solo cuentan los campos activos que aplican al nicho de la empresa (de todos los nichos o de ese). Un obligatorio sin valor impide guardar; los valores inválidos se marcan por campo (`datosExtra.<clave>`). Lo que ya estaba guardado y no viene en la petición **se conserva**, también el de campos desactivados o de otros nichos.
- **Desactivar no borra datos:** el campo deja de pedirse y de mostrarse; sus datos siguen guardados y vuelven al reactivarlo.
- **Dónde aparecen:** la **ficha** («Datos del nicho»), la **lista de la cartera** (una columna por cada campo «visible en la lista»), los **filtros** (campos sí/no y lista: `?extra_<clave>=si|no|<opción>`, con la clave y el valor como parámetros SQL, nunca concatenados) y las **columnas de la plantilla CSV** (una por campo activo, con su clave como encabezado; también se reconoce la etiqueta). El formulario de la empresa (registrar y editar) muestra la sección «Datos del nicho» con los campos de todos los nichos y los del nicho elegido (mockup T8c/M9c); cada tipo tiene su control (texto, número, lista, interruptor sí/no y fecha) y la validación en tiempo real de los demás campos.
- **API:** `GET/POST /config/campos`, `PUT /config/campos/:id`, `PATCH /config/campos/:id/activo`; en la cartera, `GET /clientes/opciones` trae `campos`.

## Alcance de usuarios (A7)

- Por defecto, cada persona ve y registra empresas del **país de su tienda** (asesores) o de **sus tiendas** (supervisores). El administrador puede **agregar** o **quitar** países; solo se guardan las **diferencias** (`proy_usuario_paises`: `agregar` / `quitar`), así que volver al país de la tienda borra las excepciones.
- La pantalla lista a las personas con tienda (más las que ya tienen ajustes), con rol, tienda, país por defecto, ajustes y **países efectivos**, con búsqueda y filtros por rol y país. «Editar» abre una ventana con todos los países para marcar; se exige al menos uno.
- El cambio es **inmediato**: afecta a la cartera, al registro, a la importación y a la ficha (una empresa de un país que ya no ve responde 404). Quitar un país **no borra ningún dato**.
- Quien tiene `proyectos.ver_gerencia` o `proyectos.administrar` ve todos los países, sin importar estos ajustes.
- **API:** `GET /config/alcance?busqueda=&rol=&pais=` y `PUT /config/alcance/:usuarioId` con `{ paises: [ids] }`.

## Verificación

`node scripts/proyectos/verificar-campos-alcance.js` en una base desechable: claves y validación por tipo (pruebas puras); permisos; altas y ediciones; clave y tipo inmutables; formulario, ficha, lista y filtros (incluido un valor de filtro malicioso); desactivar sin borrar datos; historial; plantilla e importación con columnas propias; y el alcance (cambio inmediato de lo que ve cada persona). Limpia lo que crea.
