// src/modules/tiempos/calculo/diferencias.js
// «Qué cambió» entre dos tablas (la forma que arma tablaRepository.cargarTabla): lista de { objeto, detalle } en palabras del usuario.
const rangoTexto = (r) => (r.hasta === null ? `${r.desde} en adelante` : `${r.desde} – ${r.hasta}`);
const dias = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;

function diferencias(antes, despues) {
  const cambios = [];
  const poner = (objeto, detalle) => cambios.push({ objeto, detalle });
  const nombreEtapa = (t, clave) => (t.etapas[clave] ? t.etapas[clave].nombre : clave);

  for (const [clave, p] of Object.entries(despues.productos)) {
    const a = antes.productos[clave];
    if (!a) { poner(p.nombre, 'Producto nuevo'); continue; }
    if (a.nombre !== p.nombre) poner(a.nombre, `Nombre: «${a.nombre}» → «${p.nombre}»`);
    if (a.activo !== p.activo) poner(p.nombre, p.activo ? 'Vuelve a mostrarse en la calculadora' : 'Se oculta de la calculadora');
    if (a.permiteMoldes !== p.permiteMoldes) poner(p.nombre, p.permiteMoldes ? 'Ahora lleva moldes' : 'Ya no lleva moldes');
    if (a.permiteLanyard !== p.permiteLanyard) poner(p.nombre, p.permiteLanyard ? 'Ahora puede llevar lanyard cosido' : 'Ya no puede llevar lanyard cosido');
    const porDesdeA = new Map(a.rangos.map(r => [r.desde, r]));
    const porDesdeP = new Map(p.rangos.map(r => [r.desde, r]));
    for (const r of p.rangos) {
      const ra = porDesdeA.get(r.desde);
      if (!ra) { poner(`${p.nombre} · ${rangoTexto(r)}`, 'Rango nuevo'); continue; }
      if (ra.hasta !== r.hasta) poner(`${p.nombre} · ${rangoTexto(r)}`, `Termina en ${r.hasta === null ? 'en adelante' : r.hasta} (antes ${ra.hasta === null ? 'en adelante' : ra.hasta})`);
      if (ra.aConvenir !== r.aConvenir) poner(`${p.nombre} · ${rangoTexto(r)}`, r.aConvenir ? 'Pasa a tiempo a convenir' : 'Deja de ser tiempo a convenir');
      for (const e of new Set([...Object.keys(ra.dias), ...Object.keys(r.dias)])) {
        if (ra.dias[e] !== r.dias[e]) poner(`${p.nombre} · ${rangoTexto(r)}`, `${nombreEtapa(despues, e)}: ${ra.dias[e] === undefined ? 'sin dato' : ra.dias[e]} → ${r.dias[e] === undefined ? 'sin dato' : dias(r.dias[e])}`);
      }
    }
    for (const r of a.rangos) if (!porDesdeP.has(r.desde)) poner(`${p.nombre} · ${rangoTexto(r)}`, 'Rango eliminado');
    if (JSON.stringify(a.avisos) !== JSON.stringify(p.avisos)) poner(p.nombre, 'Cambiaron sus avisos');
  }
  for (const [clave, a] of Object.entries(antes.productos)) if (!despues.productos[clave]) poner(a.nombre, 'Producto eliminado');

  for (const [clave, e] of Object.entries(despues.extras)) {
    const a = antes.extras[clave];
    if (!a) { poner(e.nombre, 'Extra nuevo'); continue; }
    if (JSON.stringify(a.rangos) !== JSON.stringify(e.rangos) || a.nombre !== e.nombre || a.aviso !== e.aviso) poner(e.nombre, 'Cambiaron sus rangos o días');
  }
  for (const [clave, v] of Object.entries(despues.parametros)) if (antes.parametros[clave] !== v) poner('Reglas generales', `${clave}: ${antes.parametros[clave]} → ${v}`);
  if (JSON.stringify(antes.avisosGenerales) !== JSON.stringify(despues.avisosGenerales)) poner('Avisos generales', 'Cambiaron los avisos generales');
  const nombresLista = (t) => JSON.stringify([...t.lineas.map(l => `${l.clave}:${l.nombre}`), ...t.etapasLista.map(e => `${e.clave}:${e.nombre}`)]);
  if (nombresLista(antes) !== nombresLista(despues)) poner('Etapas y líneas', 'Cambiaron las etapas o las líneas');
  return cambios;
}

module.exports = { diferencias };
