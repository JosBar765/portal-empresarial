// Texto de los tipos de licencia (sin DOM): el código ya no lleva prefijo de país, así que el país se muestra aparte.

// El nombre solo si ya contiene el código («Tipo B» con «B»); si no, «código · nombre».
export function etiquetaTipo(codigo, nombre) {
  const cod = String(codigo ?? '');
  const nom = String(nombre ?? '');
  return cod && !nom.toLowerCase().includes(cod.toLowerCase()) ? `${cod} · ${nom}` : nom;
}

// En tablas y avisos: «Tipo B (Honduras)». Sin país queda solo la etiqueta.
export function textoTipoConPais(codigo, nombre, paisNombre) {
  const etiqueta = etiquetaTipo(codigo, nombre);
  return paisNombre ? `${etiqueta} (${paisNombre})` : etiqueta;
}

// Opciones de un combo agrupado por país: un grupo por país, en orden alfabético; `extra` (opcional) es el tipo ya asignado
// aunque esté desactivado, para no perderlo al guardar. Cada tipo: { id, codigo, nombre, paisNombre }.
export function gruposDeTiposPorPais(tipos, extra = null) {
  const lista = extra && !tipos.some(tp => tp.id === extra.id) ? [...tipos, extra] : tipos;
  const porPais = new Map();
  lista.forEach(tp => {
    const pais = tp.paisNombre || '';
    if (!porPais.has(pais)) porPais.set(pais, []);
    porPais.get(pais).push({ valor: tp.id, texto: etiquetaTipo(tp.codigo, tp.nombre) });
  });
  return [...porPais.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([pais, opciones]) => ({ etiqueta: pais || undefined, opciones }));
}
