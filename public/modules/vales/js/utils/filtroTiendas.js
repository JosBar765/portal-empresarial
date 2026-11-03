// Resuelve el valor del menú de tiendas (id, «pais:X» o «grupo:Y») a ids de tienda; sin DOM para poder probarse aislado.
const SIN_PAIS = 'Sin país';
const PREFIJO_PAIS = 'pais:';
const PREFIJO_GRUPO = 'grupo:';

const idsDe = (tiendas) => tiendas.map(t => Number(t.id)).filter(id => Number.isInteger(id) && id > 0);

export function resolverTiendaIds(valor, tiendas = []) {
  if (valor === '' || valor == null) return [];
  const texto = String(valor);
  if (texto.startsWith(PREFIJO_PAIS)) {
    const pais = texto.slice(PREFIJO_PAIS.length);
    return idsDe(tiendas.filter(t => (t.pais_nombre || SIN_PAIS) === pais));
  }
  if (texto.startsWith(PREFIJO_GRUPO)) {
    const grupo = texto.slice(PREFIJO_GRUPO.length);
    return idsDe(tiendas.filter(t => t.departamento_nombre === grupo));
  }
  return /^\d+$/.test(texto.trim()) && Number(texto) > 0 ? [Number(texto)] : [];
}

// Parámetros de la consulta: una tienda va como `tiendaId`; un país o un grupo, como lista `tiendaIds`.
export function paramsDeTienda(valor, tiendas = []) {
  const ids = resolverTiendaIds(valor, tiendas);
  if (!ids.length) return {};
  const esLista = typeof valor === 'string' && (valor.startsWith(PREFIJO_PAIS) || valor.startsWith(PREFIJO_GRUPO));
  return esLista ? { tiendaIds: ids.join(',') } : { tiendaId: ids[0] };
}
