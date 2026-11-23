// Gráfica «Vales asignados y entregados por diseñador» del reporte de actividad de diseñadores: dos barras por diseñador en una misma escala.
// Barra 1 «Asignados» (azul); barra 2 «Entregados» apilada: parte a tiempo (verde) y parte tarde (roja, con su cifra dentro).
// «Sin diseñador asignado» (id 0) lleva solo la barra de asignados y ni E ni T; conserva el espacio de la segunda barra.
// A la derecha, las columnas E (efectividad) y T (entregas tardías) del propio diseñador. Pulsable como la de asesores: el nombre y «Asignados» enfocan
// todo (`todos`), la parte a tiempo solo lo entregado (`entregados`) y la roja solo las entregas tarde (`tarde`).
import { escapeHtml } from '../../utils/formato.js';
import { conSimboloPorcentaje } from '../../utils/formatoPorcentaje.js';
import { htmlCabeceraPlegable, htmlCuerpoPlegable, clasePlegada, conectarPlegable } from './graficaPlegable.js';

const entero = (n) => Number(n) || 0;

// Modelo puro de las filas (sin DOM): una sola escala para todas las barras, la del diseñador con más asignados.
// El rol («· Encargado», «· Asistente») sobra en la gráfica: queda solo el nombre.
const sinRol = (nombre) => String(nombre ?? '').replace(/ · (Encargado|Asistente)$/, '');

export function filasGraficaDisenadores(lista) {
  if (!Array.isArray(lista) || !lista.length) return { maximo: 0, filas: [] };
  const base = lista.map(d => {
    const asignados = entero(d.asignados);
    const entregados = entero(d.entregados);
    const tarde = Math.min(entero(d.tarde), entregados);
    return { id: entero(d.id), nombre: sinRol(d.nombre), asignados, entregados, tarde, aTiempo: entregados - tarde, efectividad: d.efectividad ?? null, tardias: d.tardias ?? null, sinAsignar: d.id != null && Number(d.id) === 0 };
  });
  // Si algún dato trajera más entregados que asignados, la escala los incluye para que ninguna barra se salga.
  const maximo = Math.max(...base.map(f => Math.max(f.asignados, f.entregados)));
  const razon = (n) => (maximo ? Math.max(n / maximo, n > 0 ? 0.015 : 0) : 0);
  // «Sin asignar» siempre va primero; el resto de más a menos asignados y, a igualdad, por nombre (la misma regla del servidor y del PDF).
  base.sort((a, b) => (Number(b.sinAsignar) - Number(a.sinAsignar)) || (b.asignados - a.asignados) || a.nombre.localeCompare(b.nombre, 'es'));
  // Se resaltan la efectividad MÁS BAJA y las entregas tardías MÁS ALTAS (todas las filas que empatan): sin dato no cuentan, con todas iguales o con un máximo de 0 no hay nada que destacar.
  const valores = (clave) => base.filter(f => !f.sinAsignar && f[clave] != null).map(f => Number(f[clave]));
  const ve = valores('efectividad'); const minE = Math.min(...ve); const maxE = Math.max(...ve);
  const maxT = Math.max(0, ...valores('tardias'));
  const filas = base.map(f => ({ ...f, razonAsignados: razon(f.asignados), razonEntregados: razon(f.entregados), rojoMinimo: f.tarde > 0, masBaja: !f.sinAsignar && f.efectividad != null && minE < maxE && Number(f.efectividad) === minE, masTardia: !f.sinAsignar && maxT > 0 && Number(f.tardias) === maxT }));
  return { maximo, filas };
}

// Un blanco pulsable es un botón con aria-pressed; sin `interactiva` queda un span (con la misma ayuda).
const blanco = (interactiva, { clase, modo, pulsado, etiqueta, ayuda, estilo = '', contenido = '' }) => interactiva
  ? `<button type="button" class="${clase}" data-modo="${modo}" aria-pressed="${pulsado}" aria-label="${escapeHtml(etiqueta)}" title="${escapeHtml(ayuda)}"${estilo}>${contenido}</button>`
  : `<span class="${clase}" data-modo="${modo}" title="${escapeHtml(ayuda)}"${estilo}>${contenido}</span>`;

function fila(f, { elegida, modoElegido, interactiva, T, irA = false }) {
  const sel = (modo) => elegida && modoElegido === modo;
  const detalle = T.gdDetalle(f.asignados, f.entregados, f.tarde);
  // «todos» lo comparten el nombre y la barra de asignados.
  const etiquetaTodos = sel('todos') ? T.graficaQuitar(f.nombre) : T.graficaVerDe(f.nombre);
  // Con `irA` (talleres) el nombre no enfoca: sugiere ir al reporte de diseñadores de ese taller (la barra y las partes sí enfocan).
  const nombre = interactiva && irA
    ? `<button type="button" class="rep2-gt-nombre rep2-gt-nombre--boton rep2-gd-nombre" data-ir="1" aria-label="${escapeHtml(T.gdIrA(f.nombre))}" title="${escapeHtml(T.gdIrA(f.nombre))}">${escapeHtml(f.nombre)}</button>`
    : interactiva
    ? `<button type="button" class="rep2-gt-nombre rep2-gt-nombre--boton rep2-gd-nombre" data-modo="todos" aria-pressed="${sel('todos')}" aria-label="${escapeHtml(etiquetaTodos)}" title="${escapeHtml(detalle)}">${escapeHtml(f.nombre)}</button>`
    : `<span class="rep2-gt-nombre rep2-gd-nombre" title="${escapeHtml(f.nombre)}">${escapeHtml(f.nombre)}</span>`;
  const asignados = blanco(interactiva, {
    clase: 'rep2-gd-barra rep2-gd-barra--asignados', modo: 'todos', pulsado: sel('todos'), etiqueta: etiquetaTodos, ayuda: detalle, estilo: ` style="--razon:${f.razonAsignados.toFixed(4)}"`
  });
  const aTiempo = f.aTiempo > 0 ? blanco(interactiva, {
    clase: 'rep2-gd-seg rep2-gd-seg--atiempo', modo: 'entregados', pulsado: sel('entregados'),
    etiqueta: sel('entregados') ? T.gdQuitarEntregados(f.nombre) : T.gdVerEntregados(f.nombre), ayuda: detalle, estilo: ` style="flex:${f.aTiempo}"`
  }) : '';
  const tarde = f.tarde > 0 ? blanco(interactiva, {
    clase: 'rep2-gd-seg rep2-gd-seg--tarde', modo: 'tarde', pulsado: sel('tarde'),
    etiqueta: sel('tarde') ? T.gdQuitarTarde(f.nombre) : T.gdVerTarde(f.nombre), ayuda: detalle, estilo: ` style="flex:${f.tarde}"`, contenido: String(f.tarde)
  }) : '';
  // Sin asignar: nadie entrega ni tiene porcentajes; un hueco de la altura de la segunda barra y celdas vacías mantienen el espaciado.
  const lineaEntregados = f.sinAsignar
    ? '<span class="rep2-gd-linea rep2-gd-linea--hueco" aria-hidden="true"></span>'
    : `<span class="rep2-gd-linea"><span class="rep2-gd-barra rep2-gd-barra--apilada" style="--razon:${f.razonEntregados.toFixed(4)}">${aTiempo}${tarde}</span><span class="rep2-gd-cant">${f.entregados}</span></span>`;
  const columnas = f.sinAsignar
    ? '<span class="rep2-gd-e"></span><span class="rep2-gd-t"></span>'
    : `<span class="rep2-gd-e${f.masBaja ? ' rep2-gd-max' : ''}" title="${escapeHtml(T.gdTituloE)}">${conSimboloPorcentaje(f.efectividad)}</span>
      <span class="rep2-gd-t${f.masTardia ? ' rep2-gd-max' : ''}" title="${escapeHtml(T.gdTituloT)}">${conSimboloPorcentaje(f.tardias)}</span>`;
  return `<li class="rep2-gt-fila rep2-gd-fila${f.sinAsignar ? ' rep2-gd-fila--sin' : ''}${elegida ? ' rep2-gt-fila--elegida' : ''}" data-id="${f.id}">
      ${nombre}
      <span class="rep2-gd-barras">
        <span class="rep2-gd-linea">${asignados}<span class="rep2-gd-cant">${f.asignados}</span></span>
        ${lineaEntregados}
      </span>
      ${columnas}
    </li>`;
}

// `lista`: [{ id, nombre, asignados, entregados, tarde, efectividad, tardias }]. Opciones: `elegida` (id del diseñador enfocado o null) con su `modoElegido`
// (todos | entregados | tarde) e `interactiva` (los blancos se pueden pulsar). Devuelve '' si no hay nada que comparar.
export function htmlGraficaDisenadores(lista, T, { elegida = null, modoElegido = 'todos', interactiva = false, clave = 'disenadores', irA = false } = {}) {
  const { maximo, filas } = filasGraficaDisenadores(lista);
  if (!filas.length || !maximo) return '';
  // Siempre salen todos los diseñadores: no hay «Ver las N restantes».
  const indiceElegida = elegida == null ? -1 : filas.findIndex(f => f.id === entero(elegida));
  const cuerpo = `<div class="rep2-gt-leyenda rep2-gd-leyenda">
      <span><i class="rep2-gt-sw rep2-gd-sw--asignados"></i>${escapeHtml(T.gdLeyendaAsignados)}</span>
      <span><i class="rep2-gt-sw rep2-gd-sw--atiempo"></i>${escapeHtml(T.gdLeyendaATiempo)}</span>
      <span><i class="rep2-gt-sw rep2-gd-sw--tarde"></i>${escapeHtml(T.gdLeyendaTarde)}</span>
    </div>
    <p class="rep2-gd-letras"><strong>${escapeHtml(T.gdColE)}</strong> = ${escapeHtml(T.gdLeyendaE)} · <strong>${escapeHtml(T.gdColT)}</strong> = ${escapeHtml(T.gdLeyendaT)}</p>
    <ol class="rep2-gd-lista">
      <li class="rep2-gt-fila rep2-gd-cab"><span></span><span></span><span class="rep2-gd-colh" title="${escapeHtml(T.gdTituloE)}">${escapeHtml(T.gdColE)}</span><span class="rep2-gd-colh" title="${escapeHtml(T.gdTituloT)}">${escapeHtml(T.gdColT)}</span></li>
      ${filas.map((f, i) => fila(f, { elegida: i === indiceElegida, modoElegido, interactiva, T, irA })).join('')}
    </ol>
`;
  return `<section class="rep2-gt rep2-gd${interactiva ? ' rep2-gt--interactiva' : ''}${clasePlegada(clave)}" id="rep2-grafica-${clave}" data-clave="${clave}" aria-label="${escapeHtml(T.graficaTitulo)}">
    ${htmlCabeceraPlegable(T.graficaTitulo, clave, T.gdInfo || '')}
    ${htmlCuerpoPlegable(clave, cuerpo)}
  </section>`;
}

// Conecta las pulsaciones: `alElegir(id, nombre, modo)` con el blanco pulsado
// (nombre y «Asignados» = 'todos'; parte a tiempo = 'entregados'; parte roja = 'tarde') y `alQuitar()` al presionar fuera de las barras.
export function conectarGraficaDisenadores(raiz, T, { alElegir = null, alQuitar = null, alNombre = null, clave = 'disenadores' } = {}) {
  const seccion = raiz.querySelector(`#rep2-grafica-${clave}`);
  if (!seccion) return;
  conectarPlegable(seccion, clave);
  const lista = seccion.querySelector('.rep2-gd-lista');
  if (lista && alNombre) {
    lista.addEventListener('click', (e) => {
      const li = e.target.closest('li[data-id]');
      if (!li || !e.target.closest('[data-ir]')) return;
      alNombre(Number(li.dataset.id), li.querySelector('.rep2-gd-nombre')?.textContent || '');
    });
  }
  if (lista && alElegir) {
    // Un solo oyente: lee el modo del blanco pulsado (botón con data-modo) y el id de su fila.
    lista.addEventListener('click', (e) => {
      const li = e.target.closest('li[data-id]');
      const blancoPulsado = e.target.closest('[data-modo]');
      if (!li || !blancoPulsado || !li.contains(blancoPulsado)) return;
      const id = Number(li.dataset.id);
      const modo = blancoPulsado.dataset.modo;
      alElegir(id, li.querySelector('.rep2-gd-nombre')?.textContent || '', modo);
      // Repintar rehace los botones: el foco vuelve al blanco pulsado (si sigue ahí) para quien usa el teclado.
      document.querySelector(`#rep2-grafica-${clave} li[data-id="${id}"] [data-modo="${modo}"]`)?.focus();
    });
  }
  if (alQuitar) {
    seccion.addEventListener('click', (e) => {
      if (!e.target.closest('li[data-id]') && !e.target.closest('.rep2-gt-mas') && !e.target.closest('.rep2-gt-plegar') && !e.target.closest('.rep2-gt-info')) alQuitar();
    });
  }
}
