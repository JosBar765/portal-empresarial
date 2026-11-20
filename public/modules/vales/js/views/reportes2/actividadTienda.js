import { state } from '../../state.js';
import { crearFiltroTiendas } from '/js/menuCascada.js';
import { paramsDeTienda, valorVigente, resolverTiendaIds } from '../../utils/filtroTiendas.js';
import { crearReporteActividad } from './actividadReporte.js';
import { TEXTOS_TIENDA as T } from './textos.js';

// Reporte de actividad de tienda: el de Actividad agrupado solo por tienda, con vales autorizados (ver flujo_vale_de_arte.md §11.1).
// Las tiendas con las que se armó el menú: convierten un país o un grupo en su lista de ids (mismo criterio que Reportes).
let tiendasDelMenu = [];

export const reporteTienda = crearReporteActividad({
  ruta: 'actividad-tienda',
  textos: T,
  contadores: true,
  sinAvatar: true,
  preguntarDesglose: true,
  // Barras de la gráfica por tienda: presionar una enfoca los contadores y el desglose en esa tienda (el selector, la gráfica y el PDF no cambian);
  // presionarla de nuevo quita el enfoque. El enfoque filtra lo ya generado: no consulta.
  grafica: {
    elegida: () => state.reporte2.tiendaElegida,
    elegidaNombre: () => state.reporte2.tiendaElegidaNombre,
    // El nombre de una tienda lleva al reporte de asesores filtrado por esa tienda (se parte sin asesores elegidos, para ver a todos los de la tienda).
    irAAsesores: (id) => { state.reporte2.asesorTiendaId = String(id); state.reporte2.asesorIds = []; },
    limpiar: () => { state.reporte2.tiendaElegida = null; state.reporte2.tiendaElegidaNombre = ''; },
    alElegir: (id, repintar, nombre = '') => {
      const r = state.reporte2;
      const quitar = r.tiendaElegida === id;
      r.tiendaElegida = quitar ? null : id;
      r.tiendaElegidaNombre = quitar ? '' : nombre; // el nombre sirve para el modal del PDF
      repintar();
    }
  },
  filtro: {
    id: 'rep2-f-tienda',
    aplicar: (qs) => Object.entries(paramsDeTienda(state.reporte2.tiendaId, tiendasDelMenu)).forEach(([clave, valor]) => qs.set(clave, valor)),
    recibir: (data) => {
      tiendasDelMenu = data.filtros.tiendas;
      // Un país o grupo que ya no resuelve a ninguna tienda vuelve a «todas».
      state.reporte2.tiendaId = valorVigente(state.reporte2.tiendaId, v => resolverTiendaIds(v, tiendasDelMenu));
    },
    montar: (destino, data, alCambiar) => {
      const menu = crearFiltroTiendas({
        tiendas: tiendasDelMenu,
        etiquetaVacio: data.alcance === 'supervisadas' ? T.todasMisTiendas : T.todasLasTiendas,
        ariaLabel: T.filtroTienda,
        valorActual: state.reporte2.tiendaId || '',
        // Un filtro nuevo en el selector descarta la barra elegida: esa tienda puede ya no estar en el conjunto.
        onSeleccionar: (valor) => { state.reporte2.tiendaElegida = null; state.reporte2.tiendaElegidaNombre = ''; state.reporte2.tiendaId = valor === '' || valor == null ? '' : String(valor); alCambiar(); }
      });
      destino.appendChild(menu.elemento);
    }
  }
});
