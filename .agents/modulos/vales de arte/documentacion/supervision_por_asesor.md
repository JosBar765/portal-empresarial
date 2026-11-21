# Supervisión especial de un asesor

## Qué es
Normalmente quienes autorizan los vales de un asesor son los supervisores que cubren su tienda (`supervisor_tiendas`). La **supervisión especial** asigna a un asesor supervisores concretos (tabla `asesor_supervisores`, migración `asesor_supervisores`): ESOS supervisores autorizan **en lugar de** los de su tienda. Sin filas, todo sigue igual; la tabla nace vacía.

Caso de uso: un asesor de El Salvador que ve licitaciones y solo deben autorizar los supervisores generales de Centroamérica.

## Reglas
- Dos consultas centrales deciden el alcance y cambian juntas (`usuarioValeRepository`): `obtenerSupervisoresDeAsesor(asesorId)` (quién autoriza a un asesor) y su inversa `listarAsesoresPorSupervisor(supervisorId)` (a quién autoriza un supervisor). Buzón, detalle, catálogo, reportes, cupo, notificaciones, chats y vigilantes dependen de ellas y se adaptan solos.
- Un supervisor asignado cuenta solo si sigue **activo** y con `vales.supervisar`. Si todos los asignados dejan de servir, la lista queda **vacía**: no se cae a los de la tienda (enrutaría licitaciones a quien no corresponde). El admin ve la advertencia en la ventana de supervisión; quien debe actuar es el administrador (reasignar o quitar la asignación).
- Alcance por tiendas: las tiendas del supervisor para el filtro de reportes y los talleres Diseño Local visibles (cupo y filtros) suman las tiendas de los asesores que se le asignaron (`tallerRepository.listarIdsPorSupervisor`, `reporteRepository.listarTiendasPorSupervisor`). Quien pierde al asesor conserva sus tiendas.
- El vale sigue a la asignación vigente: la autorización se calcula al autorizar, dentro del candado del vale.

## Administración
Pestaña Usuarios, icono «Supervisión especial» de un asesor (rol 2). `GET /api/admin/asesores/:id/supervisores` devuelve la asignación, los supervisores asignables (activos, de cualquier rol con `vales.supervisar`), quién autoriza hoy, los supervisores de su tienda y los vales que esperan acción (autorización o solicitud de modificación). `PUT` con `{ supervisorIds: [...] }` **reemplaza** el conjunto; una lista vacía quita la asignación. El PUT exige `admin.tiendas.gestionar` y valida con mensajes explicativos: asesor existente, supervisores existentes, activos, con el permiso `vales.supervisar` y sin repetidos.

Antes de confirmar, el modal advierte: «Este asesor tiene N vales esperando autorización; pasarán a ser autorizados por: [nombres]. Los supervisores de su tienda dejarán de verlos.»

## Cambiar la asignación con vales esperando
En el mismo flujo del PUT (`supervisionAsesorService`):
- Se avisa a los supervisores que **quedan a cargo y antes no lo estaban**, por cada vale del asesor en `ESPERANDO_AUTORIZACION` o `SOLICITANDO_MODIFICACION` (los dos estados en que el supervisor decide), con el mismo mecanismo de la creación (`valeEvents.notificar`, notificación persistida). Los que dejan de estar a cargo solo refrescan su buzón en silencio (`vale_refrescar`). Los que ya estaban no reciben duplicados.
- **Candados:** el cambio corre en la cola de creación del asesor (`conColaDeCreacion`: otro cambio o un vale nuevo del mismo asesor esperan su turno y ven la asignación ya cambiada) y toma, todo o nada y en orden ascendente de id, el candado de cada vale pendiente (`valeMutex.conLocksDeVales`). Si algún vale se está procesando, responde 409 «Un vale de este asesor se está procesando en este momento… No se cambió nada…» y no se cambia ni se avisa nada; si aparecen vales nuevos mientras toma los candados, reintenta (hasta 3 veces) y si no, 409.
- El reemplazo del conjunto (borrar e insertar) es una sola transacción. Los avisos se emiten tras confirmarla; su guardado es el de siempre (best effort, se registra en el log si falla).
- Un PUT con el mismo conjunto no hace nada.

## Pasos de producción
La migración `asesor_supervisores` se aplica sola al arrancar en staging y producción. Nadie tiene filas al inicio: el comportamiento no cambia hasta que el administrador asigne supervisores.

## Filtro de tienda del Buzón

Antes los vales de un asesor con supervisión especial **nunca se ocultaban** por el filtro de tienda: solo se podía elegir una tienda, y esos vales los autorizan únicamente sus supervisores asignados, así que si el filtro los escondiera el vale esperaría sin que nadie lo viera. Con el selector múltiple (correcciones 73 y 75) **esa regla se retiró** y la decide el supervisor:

- En el primer nivel del selector, junto a los países y bajo el encabezado «Supervisión especial», el Supervisor ve como casillas a **sus** asesores con supervisión especial (`asesoresEspeciales` del catálogo: activos, por nombre).
- Sin ninguna selección se ve todo, especiales incluidos. Con selección, el Buzón y Trabajo realizado muestran los vales de las **tiendas marcadas más los de los asesores marcados**; un asesor especial sin marcar queda oculto.
- El cliente manda `asesorIds` (lista de ids separada por comas, mismo tope de 500 y mismo descarte de lo inválido que `tiendaIds`). El servidor solo acepta, para el Supervisor, la intersección con sus propios asesores especiales; cualquier otro id se ignora, porque el filtro solo reduce lo que su rol ya ve. Los contadores se calculan sobre la misma lista ya filtrada.
- Administrador, Gerente y los demás roles no ven estas filas y filtran como siempre.
- En el valor del selector el asesor va como `a<id>` (p. ej. «3,7,a12»), para no chocar con los ids de tienda; lo guardado en el navegador se limpia de tiendas y asesores que ya no corresponden.
- Riesgo asumido: con un filtro activo y un especial sin marcar, sus vales por autorizar no se ven hasta marcarlo o limpiar el filtro.
