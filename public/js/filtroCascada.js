// Valores de los filtros en cascada (id, «pais:X» o «grupo:Y») convertidos a ids; sin DOM ni imports para probarse aislado.
const SIN_PAIS = 'Sin país';
const PREFIJO_PAIS = 'pais:';
const PREFIJO_GRUPO = 'grupo:';

// Selección múltiple de tiendas: ids separados por coma («3,7,9»); un id suelto sigue siendo un valor simple.
// Un asesor con supervisión especial va como «a<id>» (los ids de tienda son solo dígitos, no chocan); un «a12» suelto también es lista.
const PREFIJO_ASESOR = 'a';
const tokenAsesor = (texto) => { const m = /^a(\d+)$/.exec(texto.trim()); return m && Number(m[1]) > 0 ? Number(m[1]) : null; };
const esValorMultiple = (valor) => typeof valor === 'string' && (valor.includes(',') || tokenAsesor(valor) !== null);
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

export const valorDeAsesor = (id) => `${PREFIJO_ASESOR}${id}`;

// Ids de los asesores marcados en una lista; los que ya no están en `asesores` se descartan.
export function resolverAsesorIds(valor, asesores = []) {
  if (!esValorMultiple(String(valor ?? ''))) return [];
  const conocidos = new Set(idsDe(asesores));
  return [...new Set(String(valor).split(',').map(tokenAsesor).filter(id => id !== null))].filter(id => conocidos.has(id));
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

// Con `asesores` (solo el Buzón del Supervisor) suma `asesorIds` a los parámetros de tienda.
export function paramsDeTienda(valor, tiendas = [], asesores = []) {
  const asesorIds = resolverAsesorIds(valor, asesores);
  return { ...paramsDe(valor, resolverTiendaIds(valor, tiendas), 'tiendaId', 'tiendaIds'), ...(asesorIds.length ? { asesorIds: asesorIds.join(',') } : {}) };
}
export const paramsDeTaller = (valor, talleres = []) => paramsDe(valor, resolverTallerIds(valor, talleres), 'tallerId', 'tallerIds');

// Un país o grupo que ya no resuelve a ningún id (catálogo cambiado) vuelve a «todas» en vez de filtrar por nada.
// `resolverAsesores` (opcional) conserva los asesores vigentes de una lista; sin él se descartan.
export function valorVigente(valor, resolverIds, resolverAsesores = () => []) {
  if (esValorMultiple(valor)) return [...resolverIds(valor), ...resolverAsesores(valor).map(valorDeAsesor)].join(',');
  return esValorLista(valor) && !resolverIds(valor).length ? '' : valor;
}
