// src/modules/viaticos/services/reporteCalculoService.js
// Aritmética pura de los reportes, en centavos enteros: importes por categoría de una solicitud, agrupación por solicitante y porcentajes.
const { REPORTES } = require('../constantes');
const { aCentavos, deCentavos, dividirRedondeado, sumar } = require('../dinero');
const { calcularCombustible, calcularDepreciacion } = require('./calculoService');

const CATEGORIAS = REPORTES.CATEGORIAS;

// Importes (centavos) de las cinco categorías de una solicitud, con las mismas funciones que produjeron su total_solicitado.
// Depreciación solo con vehículo propio, como en la solicitud.
function categoriasDeSolicitud(fila) {
  // Sin rendimiento o precio guardado no hay combustible que calcular.
  const hayCombustible = fila.rendimientoKmGalon !== null && fila.precioGalon !== null;
  const combustible = hayCombustible ? calcularCombustible({
    kmTotal: fila.kmTotal, rendimientoKmGalon: fila.rendimientoKmGalon, precioGalon: fila.precioGalon
  }).importe : 0;
  const propio = fila.vehiculoPropietarioId !== null && fila.depreciacionPorKm !== null;
  const depreciacion = propio ? calcularDepreciacion({ kmTotal: fila.kmTotal, depreciacionPorKm: fila.depreciacionPorKm }).importe : 0;
  return {
    [CATEGORIAS.HOSPEDAJE]: aCentavos(fila.hospedaje),
    [CATEGORIAS.COMBUSTIBLE]: aCentavos(combustible),
    [CATEGORIAS.ALIMENTACION]: aCentavos(fila.comidas),
    [CATEGORIAS.DEPRECIACION]: aCentavos(depreciacion),
    [CATEGORIAS.OTROS]: aCentavos(fila.otrosGastos)
  };
}

// Porcentajes en décimas (1 decimal) de cada parte sobre el total; el ajuste de redondeo va a la porción mayor para que sumen 100.0.
function porcentajes(partes) {
  const total = sumar(partes);
  if (total <= 0) return partes.map(() => 0);
  const decimas = partes.map(parte => dividirRedondeado(BigInt(parte) * BigInt(REPORTES.DECIMAS_TOTAL), total));
  const diferencia = REPORTES.DECIMAS_TOTAL - sumar(decimas);
  if (diferencia !== 0) decimas[partes.indexOf(Math.max(...partes))] += diferencia;
  return decimas.map(d => d / 10);
}

// `solicitudes`: [{ solicitanteId, nombre, total (centavos) }] -> ranking por total descendente (empate: nombre) y resumen.
function agruparPorSolicitante(solicitudes) {
  const porPersona = new Map();
  for (const s of solicitudes) {
    const actual = porPersona.get(s.solicitanteId) || { solicitanteId: s.solicitanteId, nombre: s.nombre, solicitudes: 0, centavos: 0 };
    actual.solicitudes += 1;
    actual.centavos += s.total;
    porPersona.set(s.solicitanteId, actual);
  }
  const lista = [...porPersona.values()].sort((a, b) => b.centavos - a.centavos || a.nombre.localeCompare(b.nombre, 'es'));
  const pct = porcentajes(lista.map(p => p.centavos));
  const totalCentavos = sumar(lista.map(p => p.centavos));
  const cantidad = sumar(lista.map(p => p.solicitudes));
  const promedioDe = (centavos, n) => (n > 0 ? deCentavos(dividirRedondeado(centavos, n)) : 0);
  return {
    solicitantes: lista.map((p, i) => ({
      solicitanteId: p.solicitanteId,
      nombre: p.nombre,
      solicitudes: p.solicitudes,
      total: deCentavos(p.centavos),
      porcentaje: pct[i],
      promedio: promedioDe(p.centavos, p.solicitudes)
    })),
    resumen: { total: deCentavos(totalCentavos), solicitudes: cantidad, solicitantes: lista.length, promedio: promedioDe(totalCentavos, cantidad) }
  };
}

// `montos`: { [clave]: centavos } -> categorías en el orden fijo, con porcentaje; sin movimiento: lista vacía.
function repartirPorCategoria(montos, nombreDe) {
  const claves = REPORTES.ORDEN_CATEGORIAS;
  const centavos = claves.map(clave => montos[clave] || 0);
  const total = sumar(centavos);
  if (total <= 0) return { total: 0, categorias: [] };
  const pct = porcentajes(centavos);
  return {
    total: deCentavos(total),
    categorias: claves.map((clave, i) => ({ clave, nombre: nombreDe(clave), monto: deCentavos(centavos[i]), porcentaje: pct[i] }))
  };
}

// Suma las categorías de varias solicitudes: { [clave]: centavos }.
function sumarCategorias(listas) {
  const acumulado = Object.fromEntries(REPORTES.ORDEN_CATEGORIAS.map(clave => [clave, 0]));
  for (const categorias of listas) for (const clave of REPORTES.ORDEN_CATEGORIAS) acumulado[clave] += categorias[clave];
  return acumulado;
}

module.exports = { categoriasDeSolicitud, porcentajes, agruparPorSolicitante, repartirPorCategoria, sumarCategorias };
