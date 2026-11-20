import { state } from '../../state.js';
import { crearFiltroTalleres, crearFiltroTiendas } from '/js/menuCascada.js';
import { paramsDeTaller, paramsDeTienda, valorVigente, resolverTallerIds, resolverTiendaIds } from '../../utils/filtroTiendas.js';
import { crearSelectorMultiple } from '../../components/selectorMultiple.js';
import { crearReporteActividad } from './actividadReporte.js';
import { TEXTOS_TALLER, TEXTOS_DISENADOR, TEXTOS_ASESOR } from './textos.js';
import { asesoresDeLaTienda } from './asesoresDeTienda.js';

// Reportes de actividad de talleres, diseñadores y asesores: misma vista que el de tienda, con su propio filtro (ver flujo_vale_de_arte.md §11.1).
const etiquetaVacio = (T, data) => (data.alcance === 'acotadas' ? T.todosMis : T.todos);

// Los talleres con los que se armó el menú: convierten un país en su lista de ids.
let talleresDelMenu = [];

export const reporteTaller = crearReporteActividad({
  ruta: 'actividad-taller',
  textos: TEXTOS_TALLER,
  filtro: {
    id: 'rep2-f-taller',
    aplicar: (qs) => Object.entries(paramsDeTaller(state.reporte2.tallerId, talleresDelMenu)).forEach(([clave, valor]) => qs.set(clave, valor)),
    recibir: (data) => {
      talleresDelMenu = data.filtros.talleres;
      state.reporte2.tallerId = valorVigente(state.reporte2.tallerId, v => resolverTallerIds(v, talleresDelMenu));
    },
    montar: (destino, data, alCambiar) => {
      const menu = crearFiltroTalleres({
        talleres: talleresDelMenu,
        etiquetaVacio: etiquetaVacio(TEXTOS_TALLER, data),
        ariaLabel: TEXTOS_TALLER.filtro,
        valorActual: state.reporte2.tallerId || '',
        onSeleccionar: (valor) => { state.reporte2.tallerId = valor === '' || valor == null ? '' : String(valor); alCambiar(); }
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

export const reporteDisenador = crearReporteActividad({
  ruta: 'actividad-disenador',
  textos: TEXTOS_DISENADOR,
  filtro: filtroPersonas({ id: 'rep2-f-disenador', clave: 'disenadorIds', parametro: 'disenadorIds', menu: 'disenadores', icono: 'brush-outline', textos: TEXTOS_DISENADOR })
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
      // Un país o grupo que ya no resuelve a ninguna tienda vuelve a «todas».
      state.reporte2.asesorTiendaId = valorVigente(state.reporte2.asesorTiendaId, v => resolverTiendaIds(v, tiendasDelMenu));
    },
    montar: (destino, data, alCambiarSinLimpiar) => {
      const alCambiar = conLimpieza(alCambiarSinLimpiar);
      destino.classList.add('rep2-filtros-doble');
      const zonaTienda = document.createElement('div');
      const zonaAsesores = document.createElement('div');
      destino.append(zonaTienda, zonaAsesores);
      // Se ofrecen los asesores de la tienda elegida (de un país o grupo: los de sus tiendas); los que ya no están en la lista salen de la selección.
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
