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

  // Países y rutas marcados por completo se nombran así; el resto, tienda por tienda.
  function nombresDeTiendas(ids, tiendas) {
    const marcadas = new Set(ids);
    const nombres = [];
    const cubiertas = new Set();
    const claves = [t => t.pais_nombre, t => (/trofex/i.test(t.departamento_nombre || '') ? t.departamento_nombre.replace(/^Ventas\s+/i, '') : null)];
    claves.forEach((clave) => {
      new Set(tiendas.map(clave).filter(Boolean)).forEach((nombre) => {
        const suyas = tiendas.filter(t => clave(t) === nombre);
        if (suyas.length < 2 || !suyas.every(t => marcadas.has(t.id) && !cubiertas.has(t.id))) return;
        suyas.forEach(t => cubiertas.add(t.id));
        nombres.push(nombre);
      });
    });
    return [...nombres, ...ids.filter(id => !cubiertas.has(id)).map(id => etiqueta(tiendas.find(t => t.id === id)))];
  }

  // Lo que hay que sumar para ver un registro: nada si ya está, su tienda o, si no es elegible, su asesor especial.
  function incluir(seleccion, { tiendaId, asesorId }, tiendas, asesores) {
    if (vacia(seleccion) || tiendaId == null || seleccion.tiendas.includes(tiendaId) || seleccion.asesores.includes(asesorId)) {
      return { cubierto: true, nueva: null };
    }
    if (tiendas.some(t => t.id === tiendaId)) return { cubierto: true, nueva: agregar(seleccion, tiendaId) };
    if (asesores.some(a => a.id === asesorId)) return { cubierto: true, nueva: agregar(seleccion, `a${asesorId}`) };
    return { cubierto: false, nueva: null };
  }

  function rotulo(seleccion, tiendas, asesores) {
    if (vacia(seleccion)) return 'todas tus tiendas';
    const nombres = [
      ...nombresDeTiendas(seleccion.tiendas, tiendas),
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

  const api = { permite, rotulo, grupos, resumenFuera, valorDeSeleccion, agregar, incluir };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.alcanceAvisos = api;
})();
