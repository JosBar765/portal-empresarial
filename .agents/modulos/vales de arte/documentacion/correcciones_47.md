# Correcciones 47 — `vales.ver` da acceso real a la lista de vales (el Gerente ve el Buzón)

Rama: `feature/responsive-movil`. Sin permisos nuevos ni migración.

## Qué pasaba

`vales.ver` solo abría el módulo y la API. Qué lista veía cada quien lo decidía el código por rol (`valeBuzonService.js`); cualquier rol sin vista construida, como el Gerente, recibía una lista vacía y su barra lateral solo traía «Rendimiento» y «Encontrar vale».

## Qué cambia

- **Servidor:** el caso por defecto del buzón (todo rol con `vales.ver` sin vista propia) devuelve el buzón general, el mismo del Administrador (todos los vales, ventana de tiempo, filtro de tienda y contadores). Los roles con vista propia (Asesor, Supervisor, Encargados, Diseñador y Administrador) no cambian.
- **Gerente:** su barra lateral gana el botón **«Buzón»** (tercero; sigue entrando por Rendimiento). Contadores: Total vales, Pend. confirmación, Por fusionar y Atrasados.
- **Solo lectura:** las acciones de escritura siguen exigiendo sus permisos (`vales.asignar`, `.crear`, `.aprobar_general`, etc.); el Gerente solo tiene ver detalle/PDF. Comprobado: asignar, crear y aprobar-general responden 403.
- Un rol sin vista propia que no esté en la barra lateral usa los contadores del Administrador (`buzon.js`).

Archivos: `src/modules/vales/services/valeBuzonService.js`, `public/modules/vales/js/{layout/sidebar.js,config/contadores.js,views/buzon.js}`.
