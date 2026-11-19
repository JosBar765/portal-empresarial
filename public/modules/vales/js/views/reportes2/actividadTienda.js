import { state } from '../../state.js';
import { crearFiltroTiendas } from '/js/menuCascada.js';
import { paramsDeTienda, valorVigente, resolverTiendaIds } from '../../utils/filtroTiendas.js';
import { crearReporteActividad } from './actividadReporte.js';
import { TEXTOS_TIENDA as T } from './textos.js';

// Reporte de actividad de tienda: el de Actividad agrupado solo por tienda, con vales autorizados (ver flujo_vale_de_arte.md §11.1).
// Las tiendas con las que se armó el menú: convierten un país o un grupo en su lista de ids (mismo criterio que Reportes).
let tiendasDelMenu = [];

const reporte = crearReporteActividad({
  ruta: 'actividad-tienda',
  textos: T,
  contadores: true,
  filtro: {
    id: 'rep2-f-tienda',
    aplicar: (qs) => Object.entries(paramsDeTienda(state.reporte2.tiendaId, tiendasDelMenu)).forEach(([clave, valor]) => qs.set(clave, valor)),
    recibir: (data) => {
      tiendasDelMenu = data.filtros.tiendas;
      // Un país o grupo que ya no resuelve a ninguna tienda vuelve a «todas».
      state.reporte2.tiendaId = valorVigente(state.reporte2.tiendaId, v => resolverTiendaIds(v, tiendasDelMenu));
    },
    montar: (destino, data, recargar) => {
      const menu = crearFiltroTiendas({
        tiendas: tiendasDelMenu,
        etiquetaVacio: data.alcance === 'supervisadas' ? T.todasMisTiendas : T.todasLasTiendas,
        ariaLabel: T.filtroTienda,
        valorActual: state.reporte2.tiendaId || '',
        onSeleccionar: (valor) => { state.reporte2.tiendaId = valor === '' || valor == null ? '' : String(valor); recargar(); }
      });
      destino.appendChild(menu.elemento);
    }
  }
});

export const renderActividadTienda = reporte.render;
export const esqueletoActividadTienda = reporte.esqueleto;
export const pdfActividadTienda = reporte.pdf;
