// public/modules/incidencias/js/utils/tiendas.js
// Cómo se nombran y se agrupan las tiendas en pantalla: país → grupo (ruta o área) → tienda.

// «Ventas Trofex R1» → «Trofex Ruta 1»; «Ventas Premia Z13» → «Premia Z13».
export const nombreDeGrupo = (departamento) => String(departamento || 'Otras tiendas').replace(/^Ventas\s+/i, '').replace(/\bR(\d+)\b/g, 'Ruta $1');

// Si dos tiendas comparten empresa (Munditrofeos), se distinguen por su área.
export function nombreDeTienda(tienda, todas) {
  const compartida = todas.some(t => t.id !== tienda.id && t.empresa === tienda.empresa);
  return compartida && tienda.subdivision ? `${tienda.empresa} · ${tienda.subdivision}` : tienda.empresa;
}

const sinAcentos = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const coincide = (tienda, todas, consulta) => {
  const q = sinAcentos(consulta).trim();
  if (!q) return true;
  return sinAcentos(`${tienda.codigo} ${nombreDeTienda(tienda, todas)} ${nombreDeGrupo(tienda.departamento)} ${tienda.pais}`).includes(q);
};

// [{ pais, grupos: [{ nombre, tiendas: [...] }] }]; primero el país y el grupo de la tienda propia, el resto en orden alfabético.
export function agrupar(tiendas, propia) {
  const paises = new Map();
  for (const t of tiendas) {
    if (!paises.has(t.pais)) paises.set(t.pais, new Map());
    const grupos = paises.get(t.pais);
    const g = nombreDeGrupo(t.departamento);
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push(t);
  }
  const grupoPropio = propia ? nombreDeGrupo(propia.departamento) : null;
  const primero = (a, b, favorito) => (a === favorito ? -1 : b === favorito ? 1 : a.localeCompare(b, 'es'));
  return [...paises.entries()]
    .sort((a, b) => primero(a[0], b[0], propia ? propia.pais : null))
    .map(([pais, grupos]) => ({
      pais,
      grupos: [...grupos.entries()].sort((a, b) => primero(a[0], b[0], grupoPropio)).map(([nombre, lista]) => ({ nombre, tiendas: lista.sort((x, y) => nombreDeTienda(x, tiendas).localeCompare(nombreDeTienda(y, tiendas), 'es')) }))
    }));
}
