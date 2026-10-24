# Correcciones 59 — Filtro de tienda en cascada de tres niveles

Rama: `feat/selector-tiendas-cascada` (desde `dev`). Lleva mockup aprobado en Figma («Portal · Selector de tiendas»).

## Problema

El filtro «Todas las tiendas» del Buzón y de Reportes era un `<select>` plano de 27 tiendas, difícil de recorrer. El Admin ya tenía un menú en cascada propio, pero solo con dos niveles y duplicado en su CSS.

## Qué cambia

- **Tres niveles:** país → tiendas del país (más los grupos Trofex Ruta 1 y Ruta 2) → tiendas de cada grupo. «Todas las tiendas» va primero y quita el filtro.
- **Celular (< 640 px):** el menú pasa a una hoja inferior con navegación por pasos (volver, migas de ruta y cerrar).
- **Teclado:** ↑ ↓ recorren, → abre el submenú, ← vuelve un nivel, Enter selecciona, Esc cierra.
- **Estados:** cargando (esqueleto), vacío («Este país no tiene tiendas activas.»), error con «Reintentar» y opción deshabilitada con su motivo.
- **Datos:** el Buzón (`catalogos.tiendas`/`tiendasGerencia`) y Reportes (`filtros.tiendas`, también para el Supervisor) ahora traen `codigo`, `pais_nombre` y `departamento_nombre`; las etiquetas salen como «CÓDIGO - nombre». `id`, `nombre` y el orden no cambian.
- **Componente compartido:** el motor vive en `public/js/menuCascada.js` y sus estilos en `public/css/menu-cascada.css`; Vales y Admin lo importan. El Admin (tiendas y roles) ya no duplica reglas `.menu-cascada-*` en su CSS.
- **Semántica igual:** en el Buzón vacío = `state.tiendaId = null`; en Reportes se sigue depurando taller, asesores y diseñadores que no pertenecen a la tienda nueva.

## Archivos

- `public/js/menuCascada.js`, `public/css/menu-cascada.css`: componente compartido.
- `src/modules/vales/repositories/catalogoRepository.js` (`listarTiendas`) y `reporteRepository.js` (`listarTiendas`, `listarTiendasPorSupervisor`): suman país, departamento y código (`LEFT JOIN`, sin perder filas).
- `src/modules/vales/services/valeReporteService.js`: `_opcionesDeFiltro` entrega `id`, `nombre`, `codigo`, `pais_nombre` y `departamento_nombre`.
- `public/modules/vales/index.html`, `js/layout/toolbar.js`: el `#filtro-tienda` es ahora un contenedor con el menú.
- `public/modules/vales/js/views/reportes.js`: `#rep-f-tienda` es un contenedor con el menú; el antiguo `change` pasó a `onSeleccionar`.
- `public/modules/vales/css/styles.css`: la clase `.filtro-tienda` queda solo para los demás selects.

Solo se agregan columnas de lectura: sin cambios en la base de datos ni en los permisos. El backend se carga al reiniciar el servidor.
