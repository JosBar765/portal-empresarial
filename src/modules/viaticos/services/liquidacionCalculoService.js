// src/modules/viaticos/services/liquidacionCalculoService.js
// Cálculo puro de la liquidación: qué comprobantes admite una solicitud y cuánto falta, en centavos enteros.
const { aCentavos, deCentavos, sumar } = require('../dinero');
const { calcularCombustible, calcularHospedaje, calcularOtrosGastos, sumarTramos } = require('./calculoService');

// Importe de combustible solicitado, recalculado con los mismos datos y fórmula que el cálculo de la solicitud.
function combustibleSolicitado({ tramos, rendimientoKmGalon, precioGalon }) {
  const { kmTotal } = sumarTramos(tramos);
  return calcularCombustible({ kmTotal, rendimientoKmGalon, precioGalon }).importe;
}

// Rubros liquidables, en orden: hospedaje (una por noche), combustible (uno) y cada tipo de gasto (uno por renglón).
// Las comidas y la depreciación no se liquidan. `tipoHospedaje` y `tipoCombustible` son filas de viaticos_tipos_gasto; `tiposGasto`, un Map id -> fila.
function calcularRubros({ hospedajes, gastos, combustible, tipoHospedaje, tipoCombustible, tiposGasto }) {
  const rubros = [];
  const noches = sumar(hospedajes.map(h => h.noches));
  if (noches > 0) rubros.push({ tipoGastoId: tipoHospedaje.id, nombre: tipoHospedaje.nombre, esOtros: false, solicitados: noches });
  if (aCentavos(combustible) > 0) rubros.push({ tipoGastoId: tipoCombustible.id, nombre: tipoCombustible.nombre, esOtros: false, solicitados: 1 });
  for (const gasto of gastos) {
    const existente = rubros.find(r => r.tipoGastoId === gasto.tipoGastoId);
    if (existente) existente.solicitados += 1;
    else {
      const tipo = tiposGasto.get(gasto.tipoGastoId);
      rubros.push({ tipoGastoId: gasto.tipoGastoId, nombre: tipo ? tipo.nombre : gasto.tipoGastoNombre, esOtros: Boolean(tipo && tipo.esOtros), solicitados: 1 });
    }
  }
  return rubros;
}

// Lo que la solicitud pidió para liquidar, en centavos: hospedaje + combustible + otros gastos (sin comidas ni depreciación).
function solicitadoALiquidar({ hospedajes, gastos, combustible }) {
  return aCentavos(calcularHospedaje(hospedajes).importe) + aCentavos(combustible) + aCentavos(calcularOtrosGastos(gastos).importe);
}

// Cruza los rubros con los comprobantes cargados. Un rubro con más comprobantes que los solicitados no suma «faltantes» negativos.
function calcularLiquidacion({ rubros, solicitado, comprobantes }) {
  const liquidado = sumar(comprobantes.map(c => aCentavos(c.monto)));
  const pendientes = rubros.map(r => ({ ...r, liquidados: comprobantes.filter(c => c.tipoGastoId === r.tipoGastoId).length }));
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

module.exports = { combustibleSolicitado, calcularRubros, solicitadoALiquidar, calcularLiquidacion };
