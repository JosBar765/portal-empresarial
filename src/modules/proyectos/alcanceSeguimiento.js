// src/modules/proyectos/alcanceSeguimiento.js
// Reglas puras del seguimiento (sin base de datos): quién ve y quién actúa, cómo se enmascara una fila de otra tienda,
// el semáforo y el tiempo de reacción. Son funciones puras para probarlas con datos inventados.

const tiene = (usuario, permiso) => (usuario.permissions || []).includes(permiso);

// Tres niveles separados (propuesta §4.3): lectura del proyecto, acción sobre participaciones y fila.
// `tiendasSupervisadas`: ids de `supervisor_tiendas`. Administrador y gerencia ven todo; solo el administrador actúa en todo.
function nivelesDe(usuario, tiendasSupervisadas, tiendasDelProyecto = null) {
  const administra = tiene(usuario, 'proyectos.administrar');
  const gerencia = administra || tiene(usuario, 'proyectos.ver_gerencia');
  const mias = new Set(tiendasSupervisadas);
  const lee = gerencia || (tiendasDelProyecto === null ? mias.size > 0 : tiendasDelProyecto.some(t => mias.has(t)));
  return {
    lee, gerencia, administra, tiendasAccion: administra ? null : mias,
    // ¿Puede actuar sobre una participación de esta tienda? Ver no da poder de actuar.
    puedeActuarEn: (tiendaId) => administra || mias.has(tiendaId),
    // Gerencia ve el detalle de todas las tiendas (sin poder actuar); un supervisor, solo el de las suyas.
    veDetalleEn: (tiendaId) => gerencia || administra || mias.has(tiendaId)
  };
}

// Una fila de otra tienda conserva el nombre de la empresa, el asesor y la etapa; contactos, referencias y montos van vacíos.
function enmascararFila(fila, puedeActuar) {
  if (puedeActuar) return { ...fila, otraTienda: false };
  return {
    id: fila.id, empresa: fila.empresa, ciudad: fila.ciudad || null, estado: fila.estado, asesor: fila.asesor, tienda: fila.tienda,
    ultimaGestion: fila.ultimaGestion, diasSinGestion: fila.diasSinGestion,
    contacto: null, telefono: null, monto: null, referencia: null, otraTienda: true
  };
}

// Verde desde `verde` %, ámbar desde `ambar` %, rojo por debajo.
function semaforo(porcentaje, verde, ambar) {
  if (porcentaje >= verde) return 'verde';
  if (porcentaje >= ambar) return 'ambar';
  return 'rojo';
}

const porcentaje = (parte, total) => (total ? Math.round((parte / total) * 100) : 0);
// Minutos → días con un decimal («1.2 d»).
const diasDeReaccion = (minutos) => Math.round((minutos / 1440) * 10) / 10;

module.exports = { nivelesDe, enmascararFila, semaforo, porcentaje, diasDeReaccion };
