// Gráfica de «Vales ingresados por tienda» y «por asesor» de los reportes de actividad: barras horizontales de mayor a menor.
// Con muchas tiendas o asesores un pie no se lee; las barras comparan mejor y la que más vales mete va en el color de acento y las demás en gris.
// En el reporte de tiendas es pulsable: la barra elige esa tienda (enfoca contadores y desglose; la elegida lleva un borde y pulsarla de nuevo lo
// deshace) y el nombre sugiere ir al reporte de asesores de esa tienda. En el de asesores (apilada) la barra y el nombre enfocan todos los vales
// del asesor y el tramo ámbar solo los urgentes (`modo` 'urgentes' / 'todos').
import { escapeHtml } from '../../utils/formato.js';
import { htmlCabeceraPlegable, htmlCuerpoPlegable, clasePlegada, conectarPlegable } from './graficaPlegable.js';

const VISIBLES = 10;
const desplegadas = new Set(); // por gráfica (clave): se recuerda entre cargas, porque elegir una barra recarga el reporte y no debe volver a plegar la lista
const entero = (n) => Number(n) || 0;
const porcentaje = (n, total) => {
  const p = total ? n / total * 100 : 0;
  return n > 0 && p < 1 ? '<1' : String(Math.round(p));
};

// Barra apilada: tramo azul (no urgentes) y tramo ámbar (urgentes) en la misma barra; la cantidad de urgentes siempre va dentro del tramo
// (el CSS le da un ancho mínimo para que quepa la cifra de un solo vale).
const tramos = (t) => {
  const urgentes = Math.min(entero(t.urgentes), entero(t.total));
  const base = entero(t.total) - urgentes;
  return `${base > 0 ? `<span class="rep2-gt-seg rep2-gt-seg--base" style="flex:${base}"></span>` : ''}${urgentes > 0 ? `<span class="rep2-gt-seg rep2-gt-seg--urgente" data-modo="urgentes" style="flex:${urgentes}">${urgentes}</span>` : ''}`;
};

const fila = (t, maximo, total, { lider, oculta, elegida, elegidaUrgentes, interactiva, nombreBoton, apilada, T }) => {
  const razon = maximo ? Math.max(t.total / maximo, t.total > 0 ? 0.015 : 0) : 0; // largo de la barra respecto de la mayor (el CSS reserva el lugar del porcentaje)
  // Apilada: la etiqueta añade qué hace el tramo ámbar (solo urgentes); si ya está enfocado ese modo, se ofrece quitarlo.
  const base = elegida && !(apilada && elegidaUrgentes) ? T.graficaQuitar(t.nombre) : T.graficaVerDe(t.nombre);
  const etiqueta = apilada ? `${base}. ${elegida && elegidaUrgentes ? T.graficaQuitarUrgentes(t.nombre) : T.graficaVerUrgentesDe(t.nombre)}` : base;
  const nombre = nombreBoton
    ? `<button type="button" class="rep2-gt-nombre rep2-gt-nombre--boton" title="${escapeHtml(T.graficaIrAAsesores(t.nombre))}" aria-label="${escapeHtml(T.graficaIrAAsesores(t.nombre))}">${escapeHtml(t.nombre)}</button>`
    : `<span class="rep2-gt-nombre" title="${escapeHtml(t.nombre)}">${escapeHtml(t.nombre)}</span>`;
  const barra = `<span class="rep2-gt-barra${apilada ? ' rep2-gt-barra--apilada' : ''}" style="--razon:${razon.toFixed(4)}">${apilada ? tramos(t) : ''}</span><span class="rep2-gt-pct">${porcentaje(t.total, total)} %</span>`;
  // Apilada: el detalle «N vales · U urgentes» queda en la ayuda de la barra (y en su etiqueta para lectores de pantalla).
  const detalle = apilada ? T.graficaDetalle(entero(t.total), entero(t.urgentes)) : T.graficaTotal(entero(t.total)); // la barra simple solo dice cuántos vales son
  const pista = interactiva
    ? `<button type="button" class="rep2-gt-pista" aria-pressed="${elegida}" aria-label="${escapeHtml(etiqueta)}"${detalle ? ` title="${escapeHtml(detalle)}"` : ''}>${barra}</button>`
    : `<span class="rep2-gt-pista"${detalle ? ` title="${escapeHtml(detalle)}" role="img" aria-label="${escapeHtml(`${t.nombre}: ${detalle}`)}"` : ''}>${barra}</span>`;
  return `<li class="rep2-gt-fila${lider ? ' rep2-gt-fila--lider' : ''}${elegida ? ' rep2-gt-fila--elegida' : ''}${elegida && elegidaUrgentes ? ' rep2-gt-fila--elegida-urgentes' : ''}" data-id="${entero(t.id)}"${oculta ? ' data-extra hidden' : ''}>
      ${nombre}
      ${pista}
      <span class="rep2-gt-valor">${entero(t.total)}</span>
    </li>`;
};

// `lista`: [{ id, nombre, total }] de mayor a menor. Opciones: `titulo`; `clave` (identifica la gráfica para recordar si está desplegada);
// `elegida` (id de la barra elegida o null; `elegidaUrgentes`: el enfoque es solo de sus urgentes); `interactiva` (las barras se pueden pulsar); `nombreBoton` (el nombre se puede pulsar);
// `apilada` (cada barra se divide en no urgentes y urgentes, con su leyenda; `lista` trae `urgentes` y no se resalta la mayor, porque el color
// pasa a significar «urgente»). Devuelve '' si no hay nada que comparar.
export function htmlGraficaBarras(lista, T, { titulo = T.graficaTitulo, clave = 'tiendas', elegida = null, elegidaUrgentes = false, interactiva = false, nombreBoton = false, apilada = false } = {}) {
  if (!Array.isArray(lista) || !lista.length) return ''; // basta una con vales: el servidor ya mandó null si no corresponde
  const total = lista.reduce((s, t) => s + entero(t.total), 0);
  if (!total) return '';
  const maximo = entero(lista[0].total);
  const restantes = Math.max(lista.length - VISIBLES, 0);
  // La elegida siempre debe verse: si está entre las ocultas, la lista se muestra desplegada.
  const indiceElegida = elegida == null ? -1 : lista.findIndex(t => entero(t.id) === entero(elegida));
  const abierta = desplegadas.has(clave) || indiceElegida >= VISIBLES;
  const cuerpo = `${apilada ? `<div class="rep2-gt-leyenda" aria-hidden="true"><span><i class="rep2-gt-sw rep2-gt-sw--base"></i>${escapeHtml(T.graficaNoUrgentes)}</span><span><i class="rep2-gt-sw rep2-gt-sw--urgente"></i>${escapeHtml(T.graficaUrgentes)}</span></div>` : ''}
    <ol class="rep2-gt-lista">${lista.map((t, i) => fila(t, maximo, total, {
    lider: !apilada && entero(t.total) === maximo, oculta: i >= VISIBLES && !abierta, elegida: i === indiceElegida, elegidaUrgentes, interactiva, nombreBoton, apilada, T
  })).join('')}</ol>
    ${restantes ? `<button type="button" class="rep-link rep2-gt-mas" aria-expanded="${abierta}" data-restantes="${restantes}">${escapeHtml(abierta ? T.graficaMenos : T.graficaRestantes(restantes))}</button>` : ''}`;
  return `<section class="rep2-gt${interactiva || nombreBoton ? ' rep2-gt--interactiva' : ''}${clasePlegada(clave)}" id="rep2-grafica-${clave}" data-clave="${clave}" aria-label="${escapeHtml(titulo)}">
    ${htmlCabeceraPlegable(titulo, clave)}
    ${htmlCuerpoPlegable(clave, cuerpo)}
  </section>`;
}

// Despliega o pliega las que siguen a las diez primeras y conecta las pulsaciones: `alElegir(id, nombre, modo)` en la barra (o la cifra; `modo`
// 'urgentes' si se pulsó el tramo ámbar, si no 'todos') y
// `alNombre(id, nombre)` en el nombre (si no se da `alNombre`, el nombre hace lo mismo que la barra).
export function conectarGraficaBarras(raiz, T, { alElegir = null, alNombre = null, alQuitar = null } = {}) {
  const seccion = raiz.querySelector('.rep2-gt');
  if (!seccion) return;
  conectarPlegable(seccion, seccion.dataset.clave);
  const boton = seccion.querySelector('.rep2-gt-mas');
  if (boton) {
    boton.addEventListener('click', () => {
      const abrir = boton.getAttribute('aria-expanded') !== 'true';
      if (abrir) desplegadas.add(seccion.dataset.clave); else desplegadas.delete(seccion.dataset.clave);
      seccion.querySelectorAll('[data-extra]').forEach(li => { li.hidden = !abrir; });
      boton.setAttribute('aria-expanded', String(abrir));
      boton.textContent = abrir ? T.graficaMenos : T.graficaRestantes(Number(boton.dataset.restantes));
    });
  }
  const lista = seccion.querySelector('.rep2-gt-lista');
  if (lista && (alElegir || alNombre)) {
    // Un solo oyente: la barra (con teclado), la cifra y el nombre de su fila.
    lista.addEventListener('click', (e) => {
      const li = e.target.closest('li[data-id]');
      if (!li) return;
      const id = Number(li.dataset.id);
      const nombre = li.querySelector('.rep2-gt-nombre')?.textContent || '';
      if (e.target.closest('.rep2-gt-nombre') && alNombre) alNombre(id, nombre);
      else if (alElegir) alElegir(id, nombre, e.target.closest('.rep2-gt-seg--urgente') ? 'urgentes' : 'todos');
    });
  }
  // Presionar fuera de las barras (título, leyenda, bordes de la gráfica) quita la barra elegida; el botón «Ver las N restantes» no cuenta.
  if (alQuitar) {
    seccion.addEventListener('click', (e) => {
      if (!e.target.closest('li[data-id]') && !e.target.closest('.rep2-gt-mas') && !e.target.closest('.rep2-gt-plegar')) alQuitar();
    });
  }
}
