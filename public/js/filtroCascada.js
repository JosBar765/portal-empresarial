// Valores de los filtros en cascada (id, «pais:X» o «grupo:Y») convertidos a ids; sin DOM ni imports para probarse aislado.
const SIN_PAIS = 'Sin país';
const PREFIJO_PAIS = 'pais:';
const PREFIJO_GRUPO = 'grupo:';

// Selección múltiple de tiendas: ids separados por coma («3,7,9»); un id suelto sigue siendo un valor simple.
const esValorMultiple = (valor) => typeof valor === 'string' && valor.includes(',');
const esValorLista = (valor) => typeof valor === 'string' && (valor.startsWith(PREFIJO_PAIS) || valor.startsWith(PREFIJO_GRUPO) || esValorMultiple(valor));
const idsDe = (items) => items.map(t => Number(t.id)).filter(id => Number.isInteger(id) && id > 0);
const idUnico = (texto) => (/^\d+$/.test(texto.trim()) && Number(texto) > 0 ? [Number(texto)] : []);
// Un taller con varios países cuenta en cada uno; sin país cuenta en «Sin país».
const paisesDeTaller = (t) => (t.paises && t.paises.length ? t.paises : [SIN_PAIS]);

export function resolverTiendaIds(valor, tiendas = []) {
  if (valor === '' || valor == null) return [];
  const texto = String(valor);
  if (esValorMultiple(texto)) {
    // Un id que ya no está en el catálogo se descarta.
    const conocidos = new Set(idsDe(tiendas));
    return [...new Set(texto.split(',').flatMap(idUnico))].filter(id => conocidos.has(id));
  }
  if (texto.startsWith(PREFIJO_PAIS)) {
    const pais = texto.slice(PREFIJO_PAIS.length);
    return idsDe(tiendas.filter(t => (t.pais_nombre || SIN_PAIS) === pais));
  }
  if (texto.startsWith(PREFIJO_GRUPO)) {
    const grupo = texto.slice(PREFIJO_GRUPO.length);
    return idsDe(tiendas.filter(t => t.departamento_nombre === grupo));
  }
  return idUnico(texto);
}

export function resolverTallerIds(valor, talleres = []) {
  if (valor === '' || valor == null) return [];
  const texto = String(valor);
  if (texto.startsWith(PREFIJO_PAIS)) {
    const pais = texto.slice(PREFIJO_PAIS.length);
    return idsDe(talleres.filter(t => paisesDeTaller(t).includes(pais)));
  }
  return idUnico(texto);
}

// Parámetros de la consulta: uno solo va como `<clave>Id`; un país o un grupo, como lista `<clave>Ids`.
function paramsDe(valor, ids, claveUno, claveLista) {
  if (!ids.length) return {};
  return esValorLista(valor) ? { [claveLista]: ids.join(',') } : { [claveUno]: ids[0] };
}

export const paramsDeTienda = (valor, tiendas = []) => paramsDe(valor, resolverTiendaIds(valor, tiendas), 'tiendaId', 'tiendaIds');
export const paramsDeTaller = (valor, talleres = []) => paramsDe(valor, resolverTallerIds(valor, talleres), 'tallerId', 'tallerIds');

// Un país o grupo que ya no resuelve a ningún id (catálogo cambiado) vuelve a «todas» en vez de filtrar por nada.
export function valorVigente(valor, resolverIds) {
  if (esValorMultiple(valor)) return resolverIds(valor).join(',');
  return esValorLista(valor) && !resolverIds(valor).length ? '' : valor;
}
