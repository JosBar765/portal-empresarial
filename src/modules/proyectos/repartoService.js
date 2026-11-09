// src/modules/proyectos/repartoService.js
// El reparto equitativo de empresas entre asesores. Un solo archivo, sin base de datos ni red: funciones puras, para que
// la vista previa y la activación usen exactamente el mismo cálculo y se pueda probar con datos inventados.
//
// Reglas (propuesta, sección 8):
//   1. Se reparte por país: las empresas de cada país, entre los asesores participantes de ese país.
//   2. Una por una, a quien tenga menos empresas: así la diferencia entre dos asesores nunca pasa de una.
//   3. Si varios empatan, se prefiere al de la tienda que registró la empresa (afinidad). Es solo un desempate.
//   4. El orden es determinista (por identificador), así la vista previa y el resultado final son idénticos.
//   5. Tope opcional por asesor: lo que sobra queda en reserva, sin asesor.

// `empresas`: [{ id, paisId, tiendaOrigenId }]  `asesores`: [{ id, paisId, tiendaId }]
// `cargaInicial`: Map asesorId → empresas que ya tiene (para repartir una reserva en una segunda ronda).
// Devuelve { asignaciones: [{ clienteId, asesorId, tiendaId }], reserva: [clienteId], sinAsesor: [clienteId],
//            porAsesor: Map asesorId → cuántas recibe en este reparto }.
function calcular({ empresas, asesores, tope = null, afinidad = true, cargaInicial = new Map() }) {
  const porId = (a, b) => a.id - b.id;
  const asesoresDePais = new Map();
  for (const asesor of [...asesores].sort(porId)) {
    if (!asesoresDePais.has(asesor.paisId)) asesoresDePais.set(asesor.paisId, []);
    asesoresDePais.get(asesor.paisId).push(asesor);
  }

  const carga = new Map(asesores.map(a => [a.id, cargaInicial.get(a.id) || 0]));
  const recibe = new Map(asesores.map(a => [a.id, 0]));
  const asignaciones = [];
  const reserva = [];
  const sinAsesor = [];

  for (const empresa of [...empresas].sort(porId)) {
    const delPais = asesoresDePais.get(empresa.paisId);
    if (!delPais || !delPais.length) { sinAsesor.push(empresa.id); continue; }
    const disponibles = tope === null ? delPais : delPais.filter(a => carga.get(a.id) < tope);
    if (!disponibles.length) { reserva.push(empresa.id); continue; }

    const minimo = Math.min(...disponibles.map(a => carga.get(a.id)));
    const empatados = disponibles.filter(a => carga.get(a.id) === minimo);
    // La afinidad solo elige entre los que ya empatan en carga: nunca rompe la equidad.
    const elegido = (afinidad && empresa.tiendaOrigenId && empatados.find(a => a.tiendaId === empresa.tiendaOrigenId)) || empatados[0];

    carga.set(elegido.id, carga.get(elegido.id) + 1);
    recibe.set(elegido.id, recibe.get(elegido.id) + 1);
    asignaciones.push({ clienteId: empresa.id, asesorId: elegido.id, tiendaId: elegido.tiendaId });
  }
  return { asignaciones, reserva, sinAsesor, porAsesor: recibe };
}

// Diferencia entre el que más y el que menos recibió, entre los asesores de un mismo país (para las pruebas y para avisar).
function diferenciaMaxima(asesores, porAsesor) {
  const porPais = new Map();
  for (const a of asesores) {
    if (!porPais.has(a.paisId)) porPais.set(a.paisId, []);
    porPais.get(a.paisId).push(porAsesor.get(a.id) || 0);
  }
  return Math.max(0, ...[...porPais.values()].map(v => Math.max(...v) - Math.min(...v)));
}

module.exports = { calcular, diferenciaMaxima };
