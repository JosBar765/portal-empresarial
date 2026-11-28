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
    if ((a.grupo || null) !== (p.grupo || null)) poner(p.nombre, `Categoría: ${a.grupo || 'sin categoría'} → ${p.grupo || 'sin categoría'}`);
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

  const extrasAntes = new Map(antes.extras.map(e => [e.clave, e]));
  for (const e of despues.extras) {
    const a = extrasAntes.get(e.clave);
    if (!a) { poner(e.nombre, 'Extra nuevo'); continue; }
    if (a.activo !== e.activo) poner(e.nombre, e.activo ? 'Vuelve a ofrecerse en la calculadora' : 'Se oculta de la calculadora');
    if (a.nombre !== e.nombre) poner(e.nombre, `Nombre: «${a.nombre}» → «${e.nombre}»`);
    const datos = (x) => JSON.stringify([x.etiqueta, x.ayuda, x.aviso, x.diasFijos, x.unidades, x.opciones]);
    if (datos(a) !== datos(e)) poner(e.nombre, 'Cambiaron sus datos o sus días');
    if (JSON.stringify(a.alcance) !== JSON.stringify(e.alcance)) poner(e.nombre, 'Cambió en qué productos se ofrece');
  }
  for (const a of antes.extras) if (!despues.extras.some(e => e.clave === a.clave)) poner(a.nombre, 'Extra quitado');
  if (JSON.stringify(antes.extras.map(e => e.clave)) !== JSON.stringify(despues.extras.filter(e => extrasAntes.has(e.clave)).map(e => e.clave)) && antes.extras.every(e => despues.extras.some(x => x.clave === e.clave))) poner('Extras', 'Cambió el orden en la calculadora');
  const NOMBRES_REGLAS = { margen_dias: 'Margen por imprevistos', max_piezas: 'Máximo de piezas por pedido', aviso_urgente: 'Aviso de pedido urgente' };
  for (const [clave, v] of Object.entries(despues.parametros)) {
    if (antes.parametros[clave] === v) continue;
    poner('Reglas', typeof v === 'string' ? `${NOMBRES_REGLAS[clave] || clave}: texto nuevo` : `${NOMBRES_REGLAS[clave] || clave}: ${antes.parametros[clave] ?? 'sin dato'} → ${v}`);
  }
  if (JSON.stringify(antes.avisosGenerales) !== JSON.stringify(despues.avisosGenerales)) poner('Avisos generales', 'Cambiaron los avisos generales');
  const lista = (t) => JSON.stringify([t.lineas, t.categoriasLista, t.etapasLista]);
  if (lista(antes) !== lista(despues)) poner('Catálogos', 'Cambiaron las líneas, las categorías o las etapas (nombre, orden o visibilidad)');
  return cambios;
}

module.exports = { diferencias };
