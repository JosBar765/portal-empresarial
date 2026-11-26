// Reglas puras de la selección de tiendas: qué se guarda, a qué tiendas equivale y cómo la cambia el administrador.
// Un grupo es un departamento Trofex (las rutas), igual que en el selector.
const GRUPO = /trofex/i;

const agrupar = (tiendas, clave) => tiendas.reduce((mapa, t) => {
  const k = clave(t);
  if (k != null) mapa.set(k, [...(mapa.get(k) || []), t.id]);
  return mapa;
}, new Map());
const porPais = (tiendas) => agrupar(tiendas, t => t.pais_id);
const porGrupo = (tiendas) => agrupar(tiendas, t => (GRUPO.test(t.departamento_nombre || '') ? t.departamento_id : null));

// Países y grupos marcados por completo se guardan como tales (sus tiendas nuevas entran solas); todo marcado es «sin filtro».
function compactar(ids, tiendas) {
  const marcadas = new Set(ids);
  if (tiendas.length && tiendas.every(t => marcadas.has(t.id))) return { tiendas: [], paises: [], grupos: [] };
  const cubiertas = new Set();
  const completos = (mapa) => [...mapa]
    .filter(([, suyas]) => suyas.every(id => marcadas.has(id) && !cubiertas.has(id)))
    .map(([clave, suyas]) => {
      suyas.forEach(id => cubiertas.add(id));
      return clave;
    });
  const paises = completos(porPais(tiendas));
  const grupos = completos(porGrupo(tiendas));
  return { tiendas: ids.filter(id => !cubiertas.has(id)), paises, grupos };
}

const alcanza = (fila, t) => (fila.clase === 'tienda' && fila.ref_id === t.id)
  || (fila.clase === 'pais' && fila.ref_id === t.pais_id)
  || (fila.clase === 'grupo' && fila.ref_id === t.departamento_id);

// Ids de las tiendas de `tiendas` que la selección guardada marca hoy.
const expandir = (filas, tiendas) => tiendas.filter(t => filas.some(f => alcanza(f, t))).map(t => t.id);

// `antes` y `despues`: { tiendas: [objetos], asesores: [ids] } que podía marcar. Devuelve la selección nueva, o null si no cambia.
function ajustar(filas, antes, despues) {
  const elegidas = filas.filter(f => f.clase !== 'guardado');
  if (!elegidas.length) return null;
  const idsDespues = new Set(despues.tiendas.map(t => t.id));
  const idsAntes = new Set(antes.tiendas.map(t => t.id));
  // Solo sale lo que se perdió: lo que nunca fue elegible por asignación (admin) no se toca.
  const perdidas = antes.tiendas.filter(t => !idsDespues.has(t.id));
  const sigue = (f) => {
    if (f.clase === 'asesor') return despues.asesores.includes(f.ref_id) || !antes.asesores.includes(f.ref_id);
    return despues.tiendas.some(t => alcanza(f, t)) || !perdidas.some(t => alcanza(f, t));
  };
  const quedan = elegidas.filter(sigue);
  const cubierta = (t) => quedan.some(f => alcanza(f, t));
  const nuevas = despues.tiendas.filter(t => !idsAntes.has(t.id) && !cubierta(t)).map(t => ({ clase: 'tienda', ref_id: t.id }));
  const asesoresNuevos = despues.asesores
    .filter(id => !antes.asesores.includes(id) && !quedan.some(f => f.clase === 'asesor' && f.ref_id === id))
    .map(id => ({ clase: 'asesor', ref_id: id }));
  if (!nuevas.length && !asesoresNuevos.length && quedan.length === elegidas.length) return null;
  const todas = [...quedan, ...nuevas, ...asesoresNuevos];
  const de = (clase) => todas.filter(f => f.clase === clase).map(f => f.ref_id);
  return { tiendas: de('tienda'), paises: de('pais'), grupos: de('grupo'), asesores: de('asesor') };
}

module.exports = { compactar, expandir, ajustar, alcanza };
