import { state } from '../../state.js';
import { crearFiltroTalleres, crearFiltroTiendas } from '/js/menuCascada.js';
import { paramsDeTaller, paramsDeTienda, valorVigente, resolverTallerIds, resolverTiendaIds } from '../../utils/filtroTiendas.js';
import { normalizarValorTiendas } from './valorTiendas.js';
import { normalizarValorTalleres } from './valorTalleres.js';
import { crearSelectorMultiple } from '../../components/selectorMultiple.js';
import { crearReporteActividad } from './actividadReporte.js';
import { TEXTOS_TALLER, TEXTOS_DISENADOR, TEXTOS_ASESOR } from './textos.js';
import { asesoresDeLaTienda } from './asesoresDeTienda.js';
import { disenadoresDeLosTalleres } from './disenadoresDeTaller.js';

// Reportes de actividad de talleres, diseñadores y asesores: misma vista que el de tienda, con su propio filtro (ver flujo_vale_de_arte.md §11.1).
const etiquetaVacio = (T, data) => (data.alcance === 'acotadas' ? T.todosMis : T.todos);

// Los talleres con los que se armó el menú: convierten un país en su lista de ids.
let talleresDelMenu = [];

const limpiarTallerElegido = () => { const r = state.reporte2; r.tallerElegida = null; r.tallerElegidaNombre = ''; r.tallerElegidaModo = 'todos'; };

export const reporteTaller = crearReporteActividad({
  ruta: 'actividad-taller',
  textos: TEXTOS_TALLER,
  contadores: true,
  sinAvatar: true, // el círculo de iniciales no aporta en talleres (como en tiendas)
  graficaClave: 'porTaller',
  preguntarDesglose: true,
  // Mismo diseño que diseñadores: la barra «Asignados» enfoca todo el taller, la parte verde solo lo entregado a tiempo y la roja solo las entregas tarde.
  // El nombre del taller sugiere ir al reporte de diseñadores con ese taller ya elegido.
  grafica: {
    tipo: 'agrupada',
    elegida: () => state.reporte2.tallerElegida,
    elegidaNombre: () => state.reporte2.tallerElegidaNombre,
    modo: () => state.reporte2.tallerElegidaModo,
    parametroDesglose: 'tallerDesglose',
    irADisenadores: (id) => { state.reporte2.disenadorTallerId = String(id); state.reporte2.disenadorIds = []; limpiarDisenadorElegido(); },
    limpiar: limpiarTallerElegido,
    alElegir: (id, repintar, nombre = '', modo = 'todos') => {
      const r = state.reporte2;
      if (r.tallerElegida === id && r.tallerElegidaModo === modo) limpiarTallerElegido();
      else { r.tallerElegida = id; r.tallerElegidaNombre = nombre; r.tallerElegidaModo = modo; }
      repintar();
    }
  },
  filtro: {
    id: 'rep2-f-taller',
    aplicar: (qs) => Object.entries(paramsDeTaller(state.reporte2.tallerId, talleresDelMenu)).forEach(([clave, valor]) => qs.set(clave, valor)),
    recibir: (data) => {
      talleresDelMenu = data.filtros.talleres;
      // El selector es múltiple: lo guardado como «pais:X» pasa a la lista de sus talleres y lo que ya no existe se descarta (sin nada vuelve a «todos»).
      state.reporte2.tallerId = normalizarValorTalleres(state.reporte2.tallerId, talleresDelMenu);
    },
    montar: (destino, data, alCambiar) => {
      const menu = crearFiltroTalleres({
        talleres: talleresDelMenu,
        etiquetaVacio: etiquetaVacio(TEXTOS_TALLER, data),
        ariaLabel: TEXTOS_TALLER.filtro,
        multiple: true, // casillas: varios talleres, o un país entero con la casilla del padre
        valorActual: state.reporte2.tallerId || '',
        onSeleccionar: (valor) => { state.reporte2.tallerId = valor === '' || valor == null ? '' : String(valor); limpiarTallerElegido(); alCambiar(); }
      });
      destino.appendChild(menu.elemento);
    }
  }
});

// Filtro de personas con selección múltiple; la selección vive en state.reporte2[clave] y sale como lista de ids.
function filtroPersonas({ id, clave, parametro, menu, icono, textos: T }) {
  return {
    id,
    aplicar: (qs) => { const ids = state.reporte2[clave]; if (ids.length) qs.set(parametro, ids.join(',')); },
    // Una persona que ya no está entre las opciones (alcance o catálogo cambiado) se quita de la selección.
    recibir: (data) => {
      const vigentes = new Set(data.filtros[menu].map(o => String(o.id)));
      state.reporte2[clave] = state.reporte2[clave].filter(v => vigentes.has(String(v)));
    },
    montar: (destino, data, alCambiar) => {
      crearSelectorMultiple(destino, {
        uid: `${id}-sel`, icono, vacio: etiquetaVacio(T, data), plural: T.unidad,
        opciones: data.filtros[menu], seleccion: state.reporte2[clave],
        alAplicar: (ids) => { state.reporte2[clave] = ids; alCambiar(); }
      });
    },
    quitar: (quitado) => { state.reporte2[clave] = state.reporte2[clave].filter(v => String(v) !== quitado); },
    limpiar: () => { state.reporte2[clave] = []; }
  };
}

const limpiarDisenadorElegido = () => { const r = state.reporte2; r.disenadorElegida = null; r.disenadorElegidaNombre = ''; r.disenadorElegidaModo = 'todos'; };

// Filtro del reporte de diseñadores: el selector de talleres (el mismo en cascada múltiple del reporte de talleres, con su propio valor en
// `state.reporte2.disenadorTallerId`) junto al selector múltiple de diseñadores. Los talleres acotan los diseñadores que se ofrecen, los contadores, la gráfica y el desglose.
function filtroDisenadores() {
  const personas = filtroPersonas({ id: 'rep2-f-disenador', clave: 'disenadorIds', parametro: 'disenadorIds', menu: 'disenadores', icono: null, textos: TEXTOS_DISENADOR });
  let talleresDelFiltro = [];
  // Cambiar o quitar talleres o diseñadores descarta el enfoque de la gráfica: el diseñador enfocado puede ya no estar en el conjunto.
  const conLimpieza = (alCambiar) => () => { limpiarDisenadorElegido(); alCambiar(); };
  return {
    ...personas,
    aplicar: (qs) => {
      personas.aplicar(qs);
      Object.entries(paramsDeTaller(state.reporte2.disenadorTallerId, talleresDelFiltro)).forEach(([clave, valor]) => qs.set(clave, valor));
    },
    recibir: (data) => {
      personas.recibir(data);
      talleresDelFiltro = data.filtros.talleres;
      // Lo guardado como «pais:X» pasa a la lista de sus talleres y lo que ya no existe se descarta (sin nada vuelve a «todos»).
      state.reporte2.disenadorTallerId = normalizarValorTalleres(state.reporte2.disenadorTallerId, talleresDelFiltro);
    },
    montar: (destino, data, alCambiarSinLimpiar) => {
      const alCambiar = conLimpieza(alCambiarSinLimpiar);
      destino.classList.add('rep2-filtros-doble');
      const zonaTaller = document.createElement('div');
      const zonaDisenadores = document.createElement('div');
      destino.append(zonaTaller, zonaDisenadores);
      // Se ofrecen los diseñadores de los talleres elegidos; los que ya no están en la lista salen de la selección.
      const pintarDisenadores = () => {
        const opciones = disenadoresDeLosTalleres(data.filtros.disenadores, resolverTallerIds(state.reporte2.disenadorTallerId, talleresDelFiltro));
        const visibles = new Set(opciones.map(d => String(d.id)));
        state.reporte2.disenadorIds = state.reporte2.disenadorIds.filter(id => visibles.has(String(id)));
        personas.montar(zonaDisenadores, { ...data, filtros: { ...data.filtros, disenadores: opciones } }, alCambiar);
      };
      const menu = crearFiltroTalleres({
        talleres: talleresDelFiltro,
        etiquetaVacio: etiquetaVacio(TEXTOS_TALLER, data),
        ariaLabel: TEXTOS_TALLER.filtro,
        multiple: true, // casillas: varios talleres, o un país entero con la casilla del padre
        valorActual: state.reporte2.disenadorTallerId || '',
        onSeleccionar: (valor) => { state.reporte2.disenadorTallerId = valor === '' || valor == null ? '' : String(valor); pintarDisenadores(); alCambiar(); }
      });
      zonaTaller.appendChild(menu.elemento);
      pintarDisenadores();
    },
    quitar: (quitado) => { limpiarDisenadorElegido(); personas.quitar(quitado); },
    limpiar: () => { limpiarDisenadorElegido(); personas.limpiar(); }
  };
}

export const reporteDisenador = crearReporteActividad({
  ruta: 'actividad-disenador',
  textos: TEXTOS_DISENADOR,
  contadores: true,
  sinAvatar: true, // el desglose muestra a los diseñadores en píldoras, sin el círculo de iniciales
  graficaClave: 'porDisenador',
  preguntarDesglose: true,
  // Gráfica agrupada pulsable: el nombre y «Asignados» enfocan todos los vales del diseñador, la parte a tiempo solo los entregados y la roja solo las entregas tarde.
  grafica: {
    tipo: 'agrupada',
    elegida: () => state.reporte2.disenadorElegida,
    elegidaNombre: () => state.reporte2.disenadorElegidaNombre,
    modo: () => state.reporte2.disenadorElegidaModo,
    parametroDesglose: 'disenadorDesglose',
    limpiar: limpiarDisenadorElegido,
    alElegir: (id, repintar, nombre = '', modo = 'todos') => {
      const r = state.reporte2;
      // Mismo diseñador y mismo modo: se deshace; otro modo del mismo diseñador o uno distinto: se cambia el enfoque (el id 0 es válido).
      if (r.disenadorElegida === id && r.disenadorElegidaModo === modo) limpiarDisenadorElegido();
      else { r.disenadorElegida = id; r.disenadorElegidaNombre = nombre; r.disenadorElegidaModo = modo; }
      repintar();
    }
  },
  filtro: filtroDisenadores()
});

const limpiarAsesorElegido = () => { const r = state.reporte2; r.asesorElegida = null; r.asesorElegidaNombre = ''; r.asesorElegidaUrgentes = false; };

// Filtro del reporte de asesores: el selector de tienda (el mismo en cascada del reporte de tiendas, con su propio valor en
// `state.reporte2.asesorTiendaId`) junto al selector múltiple de asesores. La tienda acota contadores, gráfica y desglose.
function filtroAsesorConTienda() {
  const personas = filtroPersonas({ id: 'rep2-f-asesor', clave: 'asesorIds', parametro: 'asesorIds', menu: 'asesores', icono: null, textos: TEXTOS_ASESOR });
  let tiendasDelMenu = [];
  // Un cambio en los selectores descarta el asesor enfocado: puede ya no estar en el conjunto.
  const conLimpieza = (alCambiar) => () => { limpiarAsesorElegido(); alCambiar(); };
  return {
    ...personas,
    aplicar: (qs) => {
      personas.aplicar(qs);
      Object.entries(paramsDeTienda(state.reporte2.asesorTiendaId, tiendasDelMenu)).forEach(([clave, valor]) => qs.set(clave, valor));
    },
    recibir: (data) => {
      personas.recibir(data);
      tiendasDelMenu = data.filtros.tiendas;
      // El selector es múltiple: lo guardado como «pais:X» o «grupo:Y» pasa a la lista de sus tiendas y lo que ya no existe se descarta (sin nada vuelve a «todas»).
      state.reporte2.asesorTiendaId = normalizarValorTiendas(state.reporte2.asesorTiendaId, tiendasDelMenu);
    },
    montar: (destino, data, alCambiarSinLimpiar) => {
      const alCambiar = conLimpieza(alCambiarSinLimpiar);
      destino.classList.add('rep2-filtros-doble');
      const zonaTienda = document.createElement('div');
      const zonaAsesores = document.createElement('div');
      destino.append(zonaTienda, zonaAsesores);
      // Se ofrecen los asesores de las tiendas elegidas (una, varias, o las de un país o grupo); los que ya no están en la lista salen de la selección.
      const pintarAsesores = () => {
        const opciones = asesoresDeLaTienda(data.filtros.asesores, resolverTiendaIds(state.reporte2.asesorTiendaId, tiendasDelMenu));
        const visibles = new Set(opciones.map(a => String(a.id)));
        state.reporte2.asesorIds = state.reporte2.asesorIds.filter(id => visibles.has(String(id)));
        personas.montar(zonaAsesores, { ...data, filtros: { ...data.filtros, asesores: opciones } }, alCambiar);
      };
      const menu = crearFiltroTiendas({
        tiendas: tiendasDelMenu,
        etiquetaVacio: data.alcance === 'acotadas' ? TEXTOS_ASESOR.todasMisTiendas : TEXTOS_ASESOR.todasLasTiendas,
        ariaLabel: TEXTOS_ASESOR.filtroTienda,
        multiple: true, // casillas: varias tiendas, o un país o grupo entero con la casilla del padre
        valorActual: state.reporte2.asesorTiendaId || '',
        onSeleccionar: (valor) => { state.reporte2.asesorTiendaId = valor === '' || valor == null ? '' : String(valor); pintarAsesores(); alCambiar(); }
      });
      zonaTienda.appendChild(menu.elemento);
      pintarAsesores();
    }
  };
}

export const reporteAsesor = crearReporteActividad({
  ruta: 'actividad-asesor',
  textos: TEXTOS_ASESOR,
  contadores: true,
  graficaClave: 'porAsesor',
  preguntarDesglose: true,
  // Barras pulsables como en tiendas: el nombre y la parte azul enfocan todos los vales del asesor y la ámbar solo los urgentes; filtran lo ya generado, sin consultar.
  grafica: {
    elegida: () => state.reporte2.asesorElegida,
    elegidaNombre: () => state.reporte2.asesorElegidaNombre,
    elegidaUrgentes: () => state.reporte2.asesorElegidaUrgentes,
    parametroDesglose: 'asesorDesglose',
    limpiar: limpiarAsesorElegido,
    alElegir: (id, repintar, nombre = '', modo = 'todos') => {
      const r = state.reporte2;
      const urgentes = modo === 'urgentes';
      // Mismo asesor y mismo modo: se deshace; otro modo del mismo asesor o un asesor distinto: se cambia el enfoque.
      if (r.asesorElegida === id && r.asesorElegidaUrgentes === urgentes) limpiarAsesorElegido();
      else { r.asesorElegida = id; r.asesorElegidaNombre = nombre; r.asesorElegidaUrgentes = urgentes; }
      repintar();
    }
  },
  filtro: filtroAsesorConTienda()
});
