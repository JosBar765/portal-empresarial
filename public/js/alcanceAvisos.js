// Selección de tiendas de la campana: funciones puras (también las usan las pruebas en Node).
// Una selección es { tiendas: [id], asesores: [id] }; vacía significa «todo».
(() => {
  const vacia = (s) => !s.tiendas.length && !s.asesores.length;

  // Qué avisos en vivo se muestran: los mismos criterios que el servidor.
  function permite(seleccion, { tiendaId, asesorId }, usuarioId) {
    if (vacia(seleccion) || tiendaId == null || asesorId === usuarioId) return true;
    return seleccion.tiendas.includes(tiendaId) || seleccion.asesores.includes(asesorId);
  }

  // Igual que en el selector del Buzón: el código primero.
  const etiqueta = (t) => (t && t.codigo ? `${t.codigo} - ${t.nombre}` : (t || {}).nombre);

  function rotulo(seleccion, tiendas, asesores) {
    if (vacia(seleccion)) return 'todas tus tiendas';
    const nombres = [
      ...seleccion.tiendas.map(id => etiqueta(tiendas.find(t => t.id === id))),
      ...seleccion.asesores.map(id => (asesores.find(a => a.id === id) || {}).nombre)
    ].filter(Boolean);
    return nombres.length <= 2 ? nombres.join(', ') : `${nombres.length} tiendas`;
  }

  // Lo no leído fuera de la selección, una fila por tienda (o por asesor con supervisión especial si su tienda no es elegible).
  function grupos(filas, tiendas, asesores) {
    const porClave = new Map();
    filas.forEach((f) => {
      const tienda = tiendas.find(t => t.id === f.tiendaId);
      const especial = !tienda && asesores.find(a => a.id === f.asesorId);
      const clave = especial ? `a${especial.id}` : String(f.tiendaId);
      const nombre = especial ? especial.nombre : (tienda ? etiqueta(tienda) : f.tienda);
      const grupo = porClave.get(clave) || { clave, nombre, noLeidas: 0, puedeVer: Boolean(tienda || especial) };
      grupo.noLeidas += f.noLeidas;
      porClave.set(clave, grupo);
    });
    return [...porClave.values()].sort((a, b) => b.noLeidas - a.noLeidas || a.nombre.localeCompare(b.nombre));
  }

  function resumenFuera(lista) {
    const total = lista.reduce((suma, g) => suma + g.noLeidas, 0);
    return `${total} sin leer en ${lista.length} ${lista.length === 1 ? 'tienda' : 'tiendas'} que no ves`;
  }

  const valorDeSeleccion = ({ tiendas, asesores }) => [...tiendas, ...asesores.map(id => `a${id}`)].join(',');

  function agregar(seleccion, clave) {
    const esAsesor = String(clave).startsWith('a');
    const id = Number(esAsesor ? String(clave).slice(1) : clave);
    const sumar = (lista) => (lista.includes(id) ? lista : [...lista, id]);
    return { tiendas: esAsesor ? seleccion.tiendas : sumar(seleccion.tiendas), asesores: esAsesor ? sumar(seleccion.asesores) : seleccion.asesores };
  }

  const api = { permite, rotulo, grupos, resumenFuera, valorDeSeleccion, agregar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.alcanceAvisos = api;
})();
