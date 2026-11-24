// src/modules/viaticos/services/borradorDesdeSolicitud.js
// Puro (sin base de datos): arma el `datos` de un borrador a partir del detalle de una solicitud. Replica en el servidor
// `detalleAEstado` + `estadoABorrador` del formulario (forms/datos.js, datosCorto.js y borradorEstado.js) para que
// el borrador se abra con el mismo estado que tenía la solicitud. Los ids son números o '' y los importes, texto sin ceros sobrantes.
const { MODALIDADES } = require('../constantes');

// Igual que `aId` del formulario: entero o '' (sin elegir).
function aId(valor) {
  if (valor === '' || valor === null || valor === undefined) return '';
  const n = Number(valor);
  return Number.isInteger(n) ? n : '';
}

// Igual que `numeroATexto`: «35.00» -> «35»; '' si no hay valor.
function numeroATexto(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  const n = Number(valor);
  return Number.isFinite(n) ? String(n) : String(valor);
}

const diaDe = valor => String(valor || '').slice(0, 10);
const presente = valor => valor === true || valor === 1 || valor === '1';

// «AAAA-MM-DD HH:mm[:ss]» -> { fecha, hora }; lo que no encaja queda vacío.
function separarFechaHora(texto) {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/.exec(String(texto || ''));
  return { fecha: m ? m[1] : '', hora: m && m[2] ? m[2] : '' };
}

// Valores iniciales de `estadoInicial()` del formulario, tal como los guarda `estadoABorrador`.
function datosBase() {
  return {
    paisId: '', modalidad: MODALIDADES.MAS_DE_UN_DIA, monedaId: '', vehiculoId: '', pilotoId: '', rendimiento: '', precioGalon: '', depreciacion: '', tanqueLleno: false,
    fechaSalida: '', fechaRegreso: '', motivoId: '', origenInicialId: '', tramos: [{ destinoId: '' }], hospedajes: [], comidas: {},
    comidasAutoMarcar: true, comidasDesmarcadas: {}, gastos: [], horaSalida: '', odometro: '', fluidos: {}, kit: {}, defectos: []
  };
}

function datosLargo(detalle, comun) {
  const tramos = [...(detalle.tramos || [])].sort((a, b) => a.orden - b.orden);
  const comidas = {};
  for (const c of detalle.comidas || []) {
    const dia = diaDe(c.fecha);
    comidas[dia] = { ...(comidas[dia] || {}), [aId(c.tipoComidaId)]: true };
  }
  return {
    ...datosBase(),
    ...comun,
    monedaId: aId(detalle.moneda && detalle.moneda.id),
    fechaSalida: diaDe(detalle.fechaSalida),
    fechaRegreso: diaDe(detalle.fechaRegreso),
    rendimiento: numeroATexto(detalle.rendimientoKmGalon),
    precioGalon: numeroATexto(detalle.precioGalon),
    depreciacion: numeroATexto(detalle.depreciacionPorKm),
    tanqueLleno: presente(detalle.tanqueLleno),
    origenInicialId: tramos.length ? aId(tramos[0].origenId) : '',
    tramos: tramos.length ? tramos.map(t => ({ destinoId: aId(t.destinoId) })) : [{ destinoId: '' }],
    hospedajes: (detalle.hospedajes || []).map(h => ({
      hotel: h.hotel || '', lugar: h.lugar || '', noches: numeroATexto(h.noches), valorNoche: numeroATexto(h.valorNoche)
    })),
    comidas,
    // Las comidas ya guardadas son las únicas marcadas: sin esto el formulario volvería a marcar las que se habían desmarcado.
    comidasAutoMarcar: false,
    comidasDesmarcadas: {},
    gastos: (detalle.gastos || []).map(g => ({ tipoGastoId: aId(g.tipoGastoId), descripcion: g.descripcion || '', monto: numeroATexto(g.monto) }))
  };
}

function datosCorto(detalle, comun) {
  const { fecha, hora } = separarFechaHora(detalle.fechaSalida);
  const inspeccion = detalle.inspeccion || {};
  const fluidos = {};
  for (const f of inspeccion.fluidos || []) fluidos[f.fluidoId] = aId(f.nivelId);
  const kit = {};
  for (const k of inspeccion.kit || []) kit[k.kitItemId] = presente(k.presente);
  return {
    ...datosBase(),
    ...comun,
    fechaSalida: fecha,
    horaSalida: hora,
    odometro: numeroATexto(inspeccion.odometro ?? detalle.odometro),
    fluidos,
    kit,
    // Las fotos no viajan al borrador: solo el tipo y la descripción del defecto.
    defectos: (inspeccion.defectos || []).map(d => ({ tipoDefectoId: aId(d.tipoDefectoId), descripcion: d.descripcion || '' }))
  };
}

// Devuelve { modalidad, datos } listo para guardar como borrador.
function borradorDesdeSolicitud(detalle) {
  const comun = {
    paisId: aId(detalle.pais && detalle.pais.id),
    modalidad: detalle.modalidad,
    vehiculoId: aId(detalle.vehiculo && detalle.vehiculo.id),
    pilotoId: aId(detalle.piloto && detalle.piloto.id),
    motivoId: aId(detalle.motivo && detalle.motivo.id)
  };
  const datos = detalle.modalidad === MODALIDADES.HASTA_UN_DIA ? datosCorto(detalle, comun) : datosLargo(detalle, comun);
  // El viaje por JSON deja un objeto plano, igual que `estadoABorrador` del formulario.
  return { modalidad: detalle.modalidad, datos: JSON.parse(JSON.stringify(datos)) };
}

module.exports = { borradorDesdeSolicitud, aId, numeroATexto };
