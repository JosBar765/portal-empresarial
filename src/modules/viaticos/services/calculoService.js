// src/modules/viaticos/services/calculoService.js
// Motor de cálculo del viático: funciones puras en centavos enteros (ver dinero.js); el redondeo ocurre solo al final de cada importe.
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { MODALIDADES } = require('../constantes');
const { aCentavos, aCentesimas, deCentavos, dividirRedondeado, sumar } = require('../dinero');
const { msg } = require('../mensajes');

const aDinero = centavos => deCentavos(centavos);

// Km y horas de la ruta: suma de los renglones (cada tramo ya trae su km y horas del catálogo).
function sumarTramos(tramos) {
  const km = sumar(tramos.map(t => aCentesimas(t.km)));
  const horas = sumar(tramos.map(t => aCentesimas(t.horas)));
  return { kmTotal: aDinero(km), horasTotal: aDinero(horas) };
}

// (km / rendimiento) × precio; los galones se muestran redondeados pero el importe parte de la razón exacta.
// Con `capacidadTanque` (tanque lleno) se paga max(0, galones de la ruta − capacidad), restado exacto antes de redondear.
function calcularCombustible({ kmTotal, rendimientoKmGalon, precioGalon, capacidadTanque = null }) {
  const km = BigInt(aCentesimas(kmTotal));
  const rendimiento = BigInt(aCentesimas(rendimientoKmGalon));
  const precio = BigInt(aCentavos(precioGalon));
  const capacidad = capacidadTanque === null || capacidadTanque === undefined ? 0n : BigInt(aCentesimas(capacidadTanque));
  const galonesRuta = dividirRedondeado(km * 100n, rendimiento);
  // Pagados (centésimas de galón) = (km×100 − capacidad×rendimiento) / rendimiento; nunca negativo.
  const exceso = km * 100n - capacidad * rendimiento;
  const pagados = exceso > 0n ? exceso : 0n;
  return {
    galonesRuta: aDinero(galonesRuta),
    capacidad: capacidadTanque === null || capacidadTanque === undefined ? null : aDinero(Number(capacidad)),
    galones: aDinero(dividirRedondeado(pagados, rendimiento)),
    importe: aDinero(dividirRedondeado(pagados * precio, rendimiento * 100n))
  };
}

function calcularDepreciacion({ kmTotal, depreciacionPorKm }) {
  const km = BigInt(aCentesimas(kmTotal));
  return { importe: aDinero(dividirRedondeado(km * BigInt(aCentavos(depreciacionPorKm)), 100)) };
}

function calcularHospedaje(hospedajes) {
  const lineas = hospedajes.map(h => ({ ...h, total: aDinero(h.noches * aCentavos(h.valorNoche)) }));
  return {
    lineas,
    totalNoches: sumar(hospedajes.map(h => h.noches)),
    importe: aDinero(sumar(hospedajes.map(h => h.noches * aCentavos(h.valorNoche))))
  };
}

// Las fechas son «AAAA-MM-DD» y se comparan como texto.
function fueraDelViaje(fecha, salida, regreso) {
  return fecha < salida.slice(0, 10) || fecha > regreso;
}

// Comidas marcadas cuya moneda no tiene valor configurado (una por tipo).
function comidasSinValor(comidas, valoresPorTipo, tiposComida) {
  const faltantes = new Set(comidas.filter(c => valoresPorTipo[c.tipoComidaId] === undefined).map(c => c.tipoComidaId));
  return tiposComida.filter(t => faltantes.has(t.id));
}

// valoresPorTipo: { [tipoComidaId]: valor } de la moneda elegida.
function calcularComidas({ comidas, tiposComida, valoresPorTipo, monedaNombre, fechaSalida, fechaRegreso }) {
  const [sinValor] = comidasSinValor(comidas, valoresPorTipo, tiposComida);
  if (sinValor) throw new ErrorDeNegocio(msg('solicitud.comidaSinValor', { comida: sinValor.nombre, moneda: monedaNombre }), 400);
  const fuera = comidas.find(c => fueraDelViaje(c.fecha, fechaSalida, fechaRegreso));
  if (fuera) {
    throw new ErrorDeNegocio(msg('solicitud.comidaFueraDeFechas', { fecha: fuera.fecha, salida: fechaSalida.slice(0, 10), regreso: fechaRegreso }), 400);
  }
  const lineas = tiposComida.map(tipo => {
    const cantidad = comidas.filter(c => c.tipoComidaId === tipo.id).length;
    const valor = valoresPorTipo[tipo.id];
    return {
      tipoComidaId: tipo.id,
      nombre: tipo.nombre,
      cantidad,
      valorUnitario: valor === undefined ? null : Number(valor),
      total: valor === undefined ? 0 : aDinero(cantidad * aCentavos(valor))
    };
  });
  return { lineas, importe: aDinero(sumar(lineas.map(l => aCentavos(l.total)))) };
}

function calcularOtrosGastos(gastos) {
  return { lineas: gastos.map(g => ({ ...g })), importe: aDinero(sumar(gastos.map(g => aCentavos(g.monto)))) };
}

// `datos` ya está normalizado; `tramos` trae km y horas del catálogo, en el orden del viaje.
// Un viaje de 1 día o menos no lleva importes. `capacidadTanque`: capacidad del vehículo si el viaje sale con el tanque lleno.
function calcularSolicitud({ datos, tramos, vehiculoPropio, tiposComida, valoresPorTipo, monedaNombre, capacidadTanque = null }) {
  if (datos.modalidad !== MODALIDADES.MAS_DE_UN_DIA) {
    return { desglose: null, totales: { totalSolicitado: 0 } };
  }
  const ruta = sumarTramos(tramos);
  const combustible = calcularCombustible({ kmTotal: ruta.kmTotal, rendimientoKmGalon: datos.rendimientoKmGalon, precioGalon: datos.precioGalon, capacidadTanque });
  const depreciacion = vehiculoPropio ? calcularDepreciacion({ kmTotal: ruta.kmTotal, depreciacionPorKm: datos.depreciacionPorKm }) : null;
  const hospedaje = calcularHospedaje(datos.hospedajes);
  const comidas = calcularComidas({
    comidas: datos.comidas, tiposComida, valoresPorTipo, monedaNombre, fechaSalida: datos.fechaSalida, fechaRegreso: datos.fechaRegreso
  });
  const otrosGastos = calcularOtrosGastos(datos.gastos);
  const partes = {
    combustible: combustible.importe,
    depreciacion: depreciacion ? depreciacion.importe : 0,
    hospedaje: hospedaje.importe,
    comidas: comidas.importe,
    otrosGastos: otrosGastos.importe
  };
  return {
    desglose: {
      ruta: { tramos, ...ruta },
      combustible: { rendimientoKmGalon: datos.rendimientoKmGalon, precioGalon: datos.precioGalon, tanqueLleno: capacidadTanque !== null, ...combustible },
      depreciacion: depreciacion ? { depreciacionPorKm: datos.depreciacionPorKm, ...depreciacion } : null,
      hospedaje,
      comidas,
      otrosGastos
    },
    totales: { ...partes, totalSolicitado: aDinero(sumar(Object.values(partes).map(aCentavos))) }
  };
}

module.exports = {
  sumarTramos, calcularCombustible, calcularDepreciacion, calcularHospedaje, calcularComidas, calcularOtrosGastos,
  comidasSinValor, fueraDelViaje, calcularSolicitud
};
