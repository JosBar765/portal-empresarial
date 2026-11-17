// src/modules/viaticos/services/liquidacionCalculoService.js
// Cálculo puro de la liquidación: qué comprobantes y recibos admite una solicitud y cuánto falta, en centavos enteros.
const { aCentavos, deCentavos, sumar } = require('../dinero');
const { RECIBOS } = require('../constantes');
const { msg } = require('../mensajes');
const { calcularCombustible, calcularDepreciacion, calcularHospedaje, calcularOtrosGastos, sumarTramos } = require('./calculoService');

// Importe de combustible solicitado, recalculado con los mismos datos y fórmula que el cálculo de la solicitud.
function combustibleSolicitado({ tramos, rendimientoKmGalon, precioGalon }) {
  const { kmTotal } = sumarTramos(tramos);
  return calcularCombustible({ kmTotal, rendimientoKmGalon, precioGalon }).importe;
}

// Depreciación solicitada: km totales × depreciación por km, solo con vehículo propio (sin él la solicitud no la guarda: 0).
function depreciacionSolicitada({ tramos, depreciacionPorKm, vehiculoPropio }) {
  if (!vehiculoPropio || depreciacionPorKm === null || depreciacionPorKm === undefined) return 0;
  return calcularDepreciacion({ kmTotal: sumarTramos(tramos).kmTotal, depreciacionPorKm }).importe;
}

// Comidas solicitadas: suma de los valores unitarios guardados en la solicitud (no los del catálogo vigente).
function alimentacionSolicitada(comidas) {
  return deCentavos(sumar(comidas.map(c => aCentavos(c.valorUnitario))));
}

// Rubro que se respalda con un recibo firmado (sin tipo de gasto): uno como máximo, si su importe es mayor que cero.
const rubroDeRecibo = rubroRecibo => ({ tipoGastoId: null, rubroRecibo, nombre: msg(`recibo.rubro.${rubroRecibo}`), esOtros: false, solicitados: 1 });

// Rubros liquidables, en orden: hospedaje (una por noche), combustible (uno), alimentación y depreciación (un recibo cada uno)
// y cada tipo de gasto (uno por renglón). `tipoHospedaje` y `tipoCombustible` son filas de viaticos_tipos_gasto; `tiposGasto`, un Map id -> fila.
function calcularRubros({ hospedajes, gastos, combustible, alimentacion = 0, depreciacion = 0, tipoHospedaje, tipoCombustible, tiposGasto }) {
  const rubros = [];
  const deGasto = (tipoGastoId, nombre, esOtros, solicitados) => ({ tipoGastoId, rubroRecibo: null, nombre, esOtros, solicitados });
  const noches = sumar(hospedajes.map(h => h.noches));
  if (noches > 0) rubros.push(deGasto(tipoHospedaje.id, tipoHospedaje.nombre, false, noches));
  if (aCentavos(combustible) > 0) rubros.push(deGasto(tipoCombustible.id, tipoCombustible.nombre, false, 1));
  if (aCentavos(alimentacion) > 0) rubros.push(rubroDeRecibo(RECIBOS.RUBROS.ALIMENTACION));
  if (aCentavos(depreciacion) > 0) rubros.push(rubroDeRecibo(RECIBOS.RUBROS.DEPRECIACION));
  for (const gasto of gastos) {
    const existente = rubros.find(r => r.tipoGastoId === gasto.tipoGastoId);
    if (existente) existente.solicitados += 1;
    else {
      const tipo = tiposGasto.get(gasto.tipoGastoId);
      rubros.push(deGasto(gasto.tipoGastoId, tipo ? tipo.nombre : gasto.tipoGastoNombre, Boolean(tipo && tipo.esOtros), 1));
    }
  }
  return rubros;
}

// Lo que la solicitud pidió para liquidar, en centavos: hospedaje + combustible + comidas + depreciación + otros gastos.
function solicitadoALiquidar({ hospedajes, gastos, combustible, alimentacion = 0, depreciacion = 0 }) {
  return aCentavos(calcularHospedaje(hospedajes).importe) + aCentavos(combustible) + aCentavos(alimentacion) + aCentavos(depreciacion)
    + aCentavos(calcularOtrosGastos(gastos).importe);
}

// Cruza los rubros con los comprobantes y recibos cargados. Un rubro con más de los solicitados no suma «faltantes» negativos.
// Los recibos «otro» suman en lo liquidado pero no completan ningún rubro.
function calcularLiquidacion({ rubros, solicitado, comprobantes, recibos = [] }) {
  const liquidado = sumar([...comprobantes, ...recibos].map(c => aCentavos(c.monto)));
  const pendientes = rubros.map(r => ({
    ...r,
    liquidados: r.rubroRecibo ? recibos.filter(rb => rb.rubro === r.rubroRecibo).length : comprobantes.filter(c => c.tipoGastoId === r.tipoGastoId).length
  }));
  return {
    resumen: {
      solicitadoALiquidar: deCentavos(solicitado),
      liquidado: deCentavos(liquidado),
      faltaPorLiquidar: deCentavos(Math.max(0, solicitado - liquidado))
    },
    diferencia: deCentavos(liquidado - solicitado),
    pendientes,
    faltanComprobantes: sumar(pendientes.map(r => Math.max(0, r.solicitados - r.liquidados)))
  };
}

module.exports = { combustibleSolicitado, depreciacionSolicitada, alimentacionSolicitada, calcularRubros, solicitadoALiquidar, calcularLiquidacion };
