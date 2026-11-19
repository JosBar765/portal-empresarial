import { state } from '../../state.js';
import { crearFiltroTalleres } from '/js/menuCascada.js';
import { paramsDeTaller, valorVigente, resolverTallerIds } from '../../utils/filtroTiendas.js';
import { crearSelectorMultiple } from '../../components/selectorMultiple.js';
import { crearReporteActividad } from './actividadReporte.js';
import { TEXTOS_TALLER, TEXTOS_DISENADOR, TEXTOS_ASESOR } from './textos.js';

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
    montar: (destino, data, recargar) => {
      const menu = crearFiltroTalleres({
        talleres: talleresDelMenu,
        etiquetaVacio: etiquetaVacio(TEXTOS_TALLER, data),
        ariaLabel: TEXTOS_TALLER.filtro,
        valorActual: state.reporte2.tallerId || '',
        onSeleccionar: (valor) => { state.reporte2.tallerId = valor === '' || valor == null ? '' : String(valor); recargar(); }
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
    montar: (destino, data, recargar) => {
      crearSelectorMultiple(destino, {
        uid: `${id}-sel`, icono, vacio: etiquetaVacio(T, data), plural: T.unidad,
        opciones: data.filtros[menu], seleccion: state.reporte2[clave],
        alAplicar: (ids) => { state.reporte2[clave] = ids; recargar(); }
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

export const reporteAsesor = crearReporteActividad({
  ruta: 'actividad-asesor',
  textos: TEXTOS_ASESOR,
  filtro: filtroPersonas({ id: 'rep2-f-asesor', clave: 'asesorIds', parametro: 'asesorIds', menu: 'asesores', icono: 'people-outline', textos: TEXTOS_ASESOR })
});
