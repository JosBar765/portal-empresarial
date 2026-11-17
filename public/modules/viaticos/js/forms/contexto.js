// Contexto compartido del formulario de solicitud: estado, catálogos, último cálculo del servidor y un bus de eventos mínimo
// con el que las secciones se avisan entre sí (país, moneda, vehículo, fechas, ruta…) sin conocerse.
// `modo`: 'crear' o 'modificar' (en modificar, país, tipo de viaje y moneda no se pueden cambiar).
export function crearContexto({ estado, contexto, modo = 'crear' }) {
  // clave -> [{ fn, fijo }]; las secciones del detalle se sueltan al reconstruirlo, las fijas (país, resumen) no.
  const oyentes = new Map();
  const limpiezas = [];
  const ctx = {
    estado,
    contexto,
    modo,
    catalogos: null,
    // Última respuesta de /solicitudes/calcular, y los errores ya traducidos a los campos de la pantalla ({ campo, mensaje }).
    respuesta: null,
    erroresServidor: [],
    calculando: false,
    errorCalculo: null,
    sucio: false,
    tocados: new Set(),
    intentoEnvio: false,
    enviando: false,

    suscribir(clave, fn, fijo = false) {
      if (!oyentes.has(clave)) oyentes.set(clave, []);
      oyentes.get(clave).push({ fn, fijo });
    },
    // Avisa sin marcar el formulario como modificado (cálculo recibido, catálogos cargados…).
    emitir(clave) {
      (oyentes.get(clave) || []).slice().forEach(o => o.fn(clave));
    },
    // Un cambio del usuario: marca el formulario y avisa a quien dependa de `clave` y a quien escuche todo (`*`).
    cambio(clave) {
      ctx.sucio = true;
      ctx.emitir(clave);
      ctx.emitir('*');
    },
    // Una sección que reserva algo fuera de su DOM (URLs de fotos) lo libera aquí al reconstruirse el detalle.
    alSoltar(fn) {
      limpiezas.push(fn);
    },
    soltarDetalle() {
      for (const [clave, lista] of oyentes) oyentes.set(clave, lista.filter(o => o.fijo));
      limpiezas.splice(0).forEach(fn => fn());
    },

    moneda() {
      return ctx.catalogos ? ctx.catalogos.monedas.find(m => m.id === estado.monedaId) || null : null;
    },
    simbolo() {
      const moneda = ctx.moneda();
      return moneda ? moneda.simbolo : '';
    },
    vehiculo() {
      return ctx.catalogos ? ctx.catalogos.vehiculos.find(v => v.id === estado.vehiculoId) || null : null;
    },
    nombreUbicacion(id) {
      const u = ctx.catalogos ? ctx.catalogos.ubicaciones.find(x => x.id === id) : null;
      return u ? u.nombre : '';
    }
  };
  return ctx;
}
