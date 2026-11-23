import { state } from '../../state.js';
import { $ } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/formato.js';
import { obtenerReporteActividad, descargarReporteActividadPdf } from '../../api/valesApi.js';
import { aplicarPeriodoAQuery } from '../../components/barraPeriodoReportes.js';
import { htmlContadores } from './contadoresActividad.js';
import { htmlGraficaBarras, conectarGraficaBarras } from './graficaBarras.js';
import { htmlGraficaDisenadores, conectarGraficaDisenadores } from './graficaDisenadores.js';
import { preguntarDesglosePdf } from './modalDesglosePdf.js';
import { preguntarIrAAsesores } from './modalIrAAsesores.js';
import { enfocarPayload, existeGrupo, contarFilasDesglose } from './enfoque.js';
import { aplicarFiltroContador } from './filtroContadores.js';
import { paramsDesglosePdf } from './paramsPdf.js';
import {
  htmlEsqueletoCuerpo, cabeceraPanel, htmlTablaSeccion, SECCIONES_REPORTE, htmlSeccion, conectarSecciones, conectarAcciones, reiniciarDesglose
} from './desglose.js';

// Render común de los reportes de actividad de Reportes 2 (tienda, taller, diseñador, asesor); ver flujo_vale_de_arte.md §11.1.
// `filtro` aporta lo propio de cada uno: { id, aplicar(qs), recibir(opciones), montar(contenedor, opciones, alCambiar), quitar?(id), limpiar?() };
// sus selectores viven en la fila de filtros de la pestaña (no en el resultado) y `alCambiar` solo avisa que cambiaron: nada se consulta hasta «Generar».
// Reportes 2 renombra dos secciones respecto de Reportes (clave de sección -> clave del texto).
const TITULOS_SECCION = { atrasados: 'seccionAtrasados', noEntregados: 'seccionSinEntregar' };
const horaActual = () => new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
// La hora «Actualizado» es la de la generación: repintar por un enfoque no la cambia.
const horasGeneracion = new WeakMap();

// Atrasados anteriores al período: primera sección del desglose, con la misma tabla de los atrasados del período (clave propia para sus ids y su pliegue).
function seccionAnteriores(av, T) {
  if (!av || !av.total) return null;
  return { clave: 'atrasadosAnteriores', titulo: T.tituloVigentes, icono: 'time-outline', sub: T.subVigentes, total: av.total, grupos: av.grupos };
}

function htmlVacio(periodo, T) {
  const ampliar = periodo.tipo !== 'mes';
  return `<div class="rep-estado">
    <span class="rep-estado-icono"><ion-icon name="document-text-outline" aria-hidden="true"></ion-icon></span>
    <h4>${escapeHtml(T.vacioTitulo)}</h4>
    <p>${escapeHtml(T.vacioTexto)}</p>
    ${ampliar ? `<button type="button" class="btn btn--ghost btn--sm" id="rep2-ver-mes">${escapeHtml(T.verMes)}</button>` : ''}
  </div>`;
}

function htmlDesgloseOmitido(n, T) {
  return `<div class="rep-estado rep-estado--aviso">
    <span class="rep-estado-icono"><ion-icon name="alert-circle-outline" aria-hidden="true"></ion-icon></span>
    <h4>${escapeHtml(T.desgloseOmitidoTitulo)}</h4>
    <p>${escapeHtml(T.desgloseOmitidoTexto(n))}</p>
  </div>`;
}

// `filtrosHtml`: fila de filtros por contador (vacía si no hay); con filtro, un desglose sin vales explica por qué en vez de decir que no hay vales.
function htmlPanel(data, periodo, T, sinAvatar, filtrosHtml = '') {
  reiniciarDesglose(); // los vales en memoria del panel anterior ya no sirven
  const g = data.grupos;
  // Sobre el tope de vales el servidor no manda el desglose: aviso en su lugar (los contadores y la gráfica quedan arriba).
  if (g.desgloseOmitido) return cabeceraPanel(T.panel) + htmlDesgloseOmitido(g.totalVales, T);
  const delPeriodo = SECCIONES_REPORTE.map(def => ({ ...def, ...(TITULOS_SECCION[def.clave] ? { titulo: T[TITULOS_SECCION[def.clave]] } : {}), ...g.secciones[def.clave] })).filter(x => x.total > 0);
  const anteriores = seccionAnteriores(data.atrasadosVigentes, T);
  // Sin contador de vales: quienes trabajan por adelantado tienen vales con entrega fuera de la ventana y el total confundía.
  const secciones = anteriores ? [anteriores, ...delPeriodo] : delPeriodo;
  if (!secciones.length) return cabeceraPanel(T.panel) + filtrosHtml + (filtrosHtml ? htmlSinValesFiltro(T) : htmlVacio(periodo, T));
  // La tabla de «anteriores» usa la clave `atrasados` para llevar la columna Atraso.
  const html = (sec) => htmlSeccion({
    ...sec, prefijo: 'rep2-sec', sub: sec.clave === 'entregados' ? T.subEntregados : sec.sub,
    cuerpo: () => htmlTablaSeccion(sec === anteriores ? { ...sec, clave: 'atrasados' } : sec, { texto: T.columna }, false, !sinAvatar)
  });
  return `${cabeceraPanel(T.panel)}
    ${filtrosHtml}
    ${secciones.map(html).join('')}
    ${delPeriodo.length || filtrosHtml ? '' : htmlVacio(periodo, T)}`;
}

function htmlSinValesFiltro(T) {
  return `<div class="rep-estado">
    <span class="rep-estado-icono"><ion-icon name="funnel-outline" aria-hidden="true"></ion-icon></span>
    <p>${escapeHtml(T.filtroSinVales)}</p>
  </div>`;
}

// Rótulo del filtro de un contador (las categorías llevan el de su tarjeta).
const ROTULO_FILTRO = {
  urgente: T => T.contUrgentes, sinEntregar: T => T.contSinEntregar, atrasados: T => T.contAtrasados, entregados: T => T.contEntregados,
  atrasadosAnteriores: T => T.filtroCategoria(T.contAtrasados, T.contAnteriores), atrasadosActuales: T => T.filtroCategoria(T.contAtrasados, T.contActuales),
  entregadosConAtraso: T => T.filtroCategoria(T.contEntregados, T.contConAtraso), entregadosSinAtraso: T => T.filtroCategoria(T.contEntregados, T.contSinAtraso)
};

// Filtros activos (la barra elegida en la gráfica y los contadores), con × para quitar cada uno (mismo aspecto que las fichas de personas).
// `textoGrupo`: la etiqueta de la barra elegida (la misma que lleva el PDF); la clave «grupo» la representa.
function htmlFiltrosActivos(claves, T, textoGrupo = '') {
  if (!claves.length) return '';
  const fichas = claves.map(k => { const r = k === 'grupo' ? textoGrupo : ROTULO_FILTRO[k](T); return `<span class="rep-ficha">${escapeHtml(r)}<button type="button" data-quitar-filtro="${k}" aria-label="${escapeHtml(T.quitarFiltro(r))}"><ion-icon name="close" aria-hidden="true"></ion-icon></button></span>`; });
  return `<div class="rep-fichas rep2-filtros-activos" id="rep2-filtros-activos"><span class="rep-fichas-rotulo">${escapeHtml(T.filtrosActivos)}</span>${fichas.join('')}${claves.length > 1 ? `<button type="button" class="rep-link" data-quitar-filtro="todos">${escapeHtml(T.quitarFiltros)}</button>` : ''}</div>`;
}

// Quién se evalúa (solo en los filtros de personas), con × para quitar a cada uno, como en Reportes.
const htmlFichas = (evaluados, T) => `<div class="rep-fichas" id="rep2-fichas"><span class="rep-fichas-rotulo">${escapeHtml(T.evaluandoA)}</span>${evaluados.map(p => `<span class="rep-ficha">${escapeHtml(p.nombre)}<button type="button" data-quitar="${p.id}" aria-label="${escapeHtml(T.quitarA(p.nombre))}"><ion-icon name="close" aria-hidden="true"></ion-icon></button></span>`).join('')}<button type="button" class="rep-link" id="rep2-limpiar">${escapeHtml(T.limpiar)}</button></div>`;

// `contadores: true` muestra las tarjetas de resumen y `sinAvatar: true` quita el círculo de iniciales (solo el reporte de tienda).
// `graficaClave`: qué lista de los contadores dibuja la gráfica de barras (`porTienda` en el de tiendas, `porAsesor` en el de asesores).
// `grafica`: { elegida(), limpiar(), alElegir(id, repintar, nombre, modo), irAAsesores?(id), elegidaNombre(), elegidaUrgentes?(), parametroDesglose? } hace pulsables
// las barras: la elegida enfoca contadores y desglose en esa tienda o asesor filtrando el reporte ya generado (enfoque.js), sin consultar; lo demás
// —selector, gráfica, PDF— sigue con el filtro vigente. En tiendas el nombre sugiere, con un modal, ir al reporte de asesores de esa tienda;
// en asesores `elegidaUrgentes` enfoca solo sus vales urgentes. Con `tipo: 'agrupada'` (diseñadores) la gráfica es la de dos barras y `modo()`
// (todos | entregados | tarde) dice qué parte se pulsó. Sin `grafica` solo informa.
// `preguntarDesglose: true` (tiendas y asesores): al descargar el PDF un modal pregunta si se incluye el desglose de vales (`desglose=0` = sin él).
// Pulsar un contador alterna su filtro (el de estado es uno solo; «urgente» es aparte) y repinta con lo generado, sin consultar; × y «Quitar filtros» los retiran.
function conectarFiltroContadores(cont, repintar, quitarGrupo = () => {}) {
  const alternar = (clave) => {
    if (clave === 'urgente') state.reporte2.urgenteElegido = !state.reporte2.urgenteElegido;
    else state.reporte2.contadorElegido = state.reporte2.contadorElegido === clave ? null : clave;
    repintar();
    // Repintar rehace los botones: el foco vuelve al contador pulsado.
    document.querySelector(`#rep2-contadores [data-filtro="${clave}"]`)?.focus();
  };
  const bloque = $('#rep2-contadores', cont);
  bloque.addEventListener('click', (e) => { const b = e.target.closest('[data-filtro]'); if (b) alternar(b.dataset.filtro); });
  const fila = $('#rep2-filtros-activos', cont);
  if (fila) fila.addEventListener('click', (e) => {
    const b = e.target.closest('[data-quitar-filtro]');
    if (!b) return;
    const k = b.dataset.quitarFiltro;
    if (k === 'grupo' || k === 'todos') quitarGrupo(); // la barra elegida de la gráfica
    if (k === 'urgente' || k === 'todos') state.reporte2.urgenteElegido = false;
    if (k !== 'urgente' && k !== 'grupo') state.reporte2.contadorElegido = null;
    repintar();
  });
}

export function crearReporteActividad({ ruta, textos: T, filtro, contadores = false, sinAvatar = false, grafica = null, graficaClave = 'porTienda', preguntarDesglose = false }) {
  const construirQuery = (periodo) => {
    const qs = new URLSearchParams();
    aplicarPeriodoAQuery(qs, periodo);
    filtro.aplicar(qs);
    return qs;
  };

  // Lo que muestra la pantalla: el PDF cuenta sus vales (con y sin los filtros de vista) para avisar si será largo.
  let vistaMostrada = null; // con el enfoque de la barra y el filtro por contador
  let vistaGeneral = null; // lo generado, sin ningún filtro de vista
  let contadorMostrado = {}; // filtro por contador aplicado en pantalla

  // Pide el reporte general; el enfoque de una barra se calcula después sobre estos mismos datos.
  const generar = async (periodo) => {
    const datos = await obtenerReporteActividad(ruta, construirQuery(periodo));
    horasGeneracion.set(datos, horaActual());
    return datos;
  };

  // ctx: { alCambiar, repintar, remontarFiltros, verMes, irAReporte, puedeIrA }; `repintar` rehace la vista con el resultado ya generado, sin consultar.
  function render(cont, periodo, data, { alCambiar, repintar, remontarFiltros, verMes, irAReporte = null, puedeIrA = null }) {
    const idElegida = grafica ? grafica.elegida() : null;
    // La gráfica sale siempre del filtro vigente al generar, aunque haya una barra elegida.
    const listaGrafica = data.contadores?.[graficaClave];
    // Si la elegida ya no está en lo generado (cambió el período o el filtro) se descarta y todo vuelve al filtro vigente.
    const enfocada = idElegida != null && existeGrupo(data, idElegida) && Array.isArray(listaGrafica) && listaGrafica.some(t => Number(t.id) === Number(idElegida));
    if (idElegida != null && !enfocada) grafica.limpiar();
    const agrupada = grafica?.tipo === 'agrupada'; // gráfica de dos barras por persona (diseñadores): el enfoque trae su propio modo
    const vista = enfocada ? enfocarPayload(data, agrupada ? { id: idElegida, modo: grafica.modo() } : { id: idElegida, urgentes: !!grafica.elegidaUrgentes?.() }) : data;
    const pulsables = contadores && !vista.grupos?.desgloseOmitido;
    // El reporte de diseñadores (`agrupada`) no tiene contador de Urgentes: un filtro «urgente» que venga de otro reporte no se aplica.
    const filtroContador = pulsables ? { estado: state.reporte2.contadorElegido, urgente: agrupada ? false : state.reporte2.urgenteElegido } : {};
    // La barra elegida va primero, como filtro de lo que se ve y de lo que se imprime; luego los de los contadores.
    const textoGrupo = enfocada ? T.pdfFiltroGrupo(T.columna, grafica.elegidaNombre(), !!grafica.elegidaUrgentes?.(), agrupada ? grafica.modo() : null) : '';
    const clavesFiltro = [enfocada ? 'grupo' : null, filtroContador.urgente ? 'urgente' : null, filtroContador.estado || null].filter(Boolean);
    const vistaDesglose = aplicarFiltroContador(vista, filtroContador);
    // Lo que el PDF ofrece imprimir: el desglose como se ve (barra + contador) o el general.
    vistaMostrada = vistaDesglose;
    vistaGeneral = data;
    contadorMostrado = filtroContador;
    // El nombre de una barra de tienda lleva al reporte de asesores, si la persona tiene acceso a él.
    // El nombre de una tienda lleva al reporte de asesores y el de un taller al de diseñadores (con el filtro ya elegido), si la persona tiene acceso.
    const irA = grafica?.irAAsesores ? { ruta: 'actividad-asesor', ir: grafica.irAAsesores } : (grafica?.irADisenadores ? { ruta: 'actividad-disenador', ir: grafica.irADisenadores } : null);
    const alNombre = irA && irAReporte && puedeIrA && puedeIrA(irA.ruta)
      ? async (id, nombre) => { if (await preguntarIrAAsesores(T, nombre)) { irA.ir(id); irAReporte(irA.ruta); } }
      : null;
    const claveGraficaAgrupada = graficaClave === 'porTaller' ? 'talleres' : 'disenadores';
    const fichas = filtro.quitar && data.evaluados?.length ? htmlFichas(data.evaluados, T) : '';
    cont.innerHTML = `
    <div class="rep2-cabfila">
      <div class="rep2-cab">
        <h3>${escapeHtml(data.titulo)}</h3>
        <p class="rend-meta">${escapeHtml(data.periodo.etiqueta)} · ${escapeHtml(T.actualizado)} ${horasGeneracion.get(data) || horaActual()}</p>
      </div>
    </div>
    ${fichas}
    ${contadores ? htmlContadores(vista.contadores, T, { pulsables, activos: filtroContador }) + (agrupada
    ? htmlGraficaDisenadores(listaGrafica, T, { elegida: enfocada ? Number(idElegida) : null, modoElegido: enfocada ? grafica.modo() : 'todos', interactiva: true, clave: claveGraficaAgrupada, irA: !!alNombre })
    : htmlGraficaBarras(listaGrafica, T, {
      titulo: T.graficaTitulo, clave: graficaClave === 'porAsesor' ? 'asesores' : 'tiendas',
      elegida: enfocada ? Number(idElegida) : null, elegidaUrgentes: enfocada && !!grafica.elegidaUrgentes?.(), interactiva: !!grafica, nombreBoton: !!alNombre, apilada: graficaClave === 'porAsesor'
    })) : ''}
    <div class="rend-grid"><section class="rend-panel rend-span-12" id="rep2-panel">${htmlPanel(vistaDesglose, periodo, T, sinAvatar, htmlFiltrosActivos(clavesFiltro, T, textoGrupo))}</section></div>
    <details class="rend-notas">
      <summary>${escapeHtml(T.notasTitulo)}</summary>
      <ul>${T.notas.map(n => `<li>${n}</li>`).join('')}</ul>
    </details>`;
    if (fichas) {
      // Quitar a alguien cambia la selección, no el resultado: el selector se rehace y el reporte queda por actualizar.
      cont.querySelectorAll('[data-quitar]').forEach(b => b.addEventListener('click', () => { filtro.quitar(b.dataset.quitar); b.closest('.rep-ficha').remove(); remontarFiltros(); alCambiar(); }));
      $('#rep2-limpiar', cont).addEventListener('click', () => { filtro.limpiar(); $('#rep2-fichas', cont).remove(); remontarFiltros(); alCambiar(); });
    }
    if (pulsables) conectarFiltroContadores(cont, repintar, () => { if (enfocada) grafica.limpiar(); });
    const conexion = { alElegir: grafica ? (id, nombre, modo) => grafica.alElegir(id, repintar, nombre, modo) : null, alQuitar: enfocada ? () => { grafica.limpiar(); repintar(); } : null };
    if (agrupada) conectarGraficaDisenadores(cont, T, { ...conexion, alNombre, clave: claveGraficaAgrupada });
    else conectarGraficaBarras(cont, T, { ...conexion, alNombre });
    const panel = $('#rep2-panel', cont);
    conectarAcciones(panel);
    conectarSecciones(panel);
    const ampliar = $('#rep2-ver-mes', panel);
    if (ampliar) ampliar.addEventListener('click', () => verMes({ tipo: 'mes', fecha: periodo.tipo === 'rango' ? periodo.hasta : periodo.fecha }));
  }

  return {
    ruta,
    // Rehace los selectores del reporte en `destino` con las opciones del servidor; la selección guardada que ya no existe se descarta.
    montarFiltros: (destino, opciones, alCambiar) => {
      filtro.recibir(opciones);
      destino.replaceChildren();
      const fila = document.createElement('div');
      fila.className = 'rep-filtros-fila';
      const caja = document.createElement('div');
      caja.id = filtro.id;
      fila.appendChild(caja);
      destino.appendChild(fila);
      filtro.montar(caja, opciones, alCambiar);
    },
    // Lo que se enviaría con los filtros y la ventana de ahora: la pestaña lo compara con lo generado para saber si el resultado quedó viejo.
    consulta: (periodo) => construirQuery(periodo).toString(),
    generar,
    render,
    esqueleto: htmlEsqueletoCuerpo,
    // Devuelve null si se cierra el modal sin elegir: no se descarga nada.
    // `consultaGenerada` es la consulta con que se generó lo que se ve: el PDF sale siempre de ella y no de los filtros de ahora.
    pdf: async (periodo, consultaGenerada = null) => {
      const qs = consultaGenerada ? new URLSearchParams(consultaGenerada) : construirQuery(periodo);
      if (preguntarDesglose) {
        // Con filtros de vista (barra enfocada o contadores) el modal ofrece imprimir el desglose filtrado, el completo o ninguno.
        const idEnfocada = grafica ? grafica.elegida() : null;
        const modoGrafica = grafica?.tipo === 'agrupada' ? grafica.modo() : null;
        const enfoque = idEnfocada != null ? { id: idEnfocada, parametro: grafica.parametroDesglose, urgentes: !!grafica.elegidaUrgentes?.(), modo: modoGrafica } : null;
        const filtros = [
          ...(enfoque ? [T.pdfFiltroGrupo(T.columna, grafica.elegidaNombre(), enfoque.urgentes, modoGrafica)] : []),
          ...[contadorMostrado.urgente ? 'urgente' : null, contadorMostrado.estado || null].filter(Boolean).map(k => ROTULO_FILTRO[k](T))
        ];
        // Con el desglose general omitido (más de 5000 vales) no se ofrece el completo y se desconoce cuántos vales trae el filtrado.
        const omitido = !!vistaGeneral?.grupos?.desgloseOmitido;
        const modo = await preguntarDesglosePdf(T, {
          filtros,
          filasFiltradas: omitido || !vistaMostrada ? null : contarFilasDesglose(vistaMostrada),
          filasCompleto: omitido ? null : (vistaGeneral ? contarFilasDesglose(vistaGeneral) : 0)
        });
        if (modo === null) return null;
        for (const [clave, valor] of Object.entries(paramsDesglosePdf({ modo, enfoque, contador: contadorMostrado }))) qs.set(clave, valor);
      }
      return descargarReporteActividadPdf(ruta, qs);
    }
  };
}
