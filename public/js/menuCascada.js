// Menú en cascada compartido (Admin y Vales). Módulo autocontenido: no importa
// nada del proyecto para que cualquier módulo pueda cargarlo desde /js. Estilos
// en /css/menu-cascada.css. Un nodo del árbol es de uno de tres tipos:
//   - hoja:    { tipo:'hoja', valor, etiqueta }              — seleccionable.
//   - grupo:   { tipo:'grupo', etiqueta, hijos, mensajeVacio? } — abre un submenú
//              (cualquier profundidad); `encabezadoAntes` pinta un divisor y ese
//              título justo antes de la fila (ej. «País» sobre el primer país).
//   - seccion: { tipo:'seccion', etiqueta, hijos }           — encabezado no
//              clickeable con sus hijos en línea.

const CONSULTA_CELULAR = '(max-width: 639px)';
const CONSULTA_PUNTERO_FINO = '(hover: hover) and (pointer: fine)';
const CONSULTA_MOVIMIENTO_REDUCIDO = '(prefers-reduced-motion: reduce)';
const ESPERA_HOVER_MS = 150;
const MENSAJE_GRUPO_VACIO = 'Este país no tiene tiendas activas.';
const MENSAJE_ARBOL_VACIO = 'No hay tiendas activas.';
const SELECTOR_PANELES = '.menu-cascada-panel, .menu-cascada-panel-nivel2';
const SELECTOR_FILAS = '.menu-cascada-item:not(:disabled)';

const $$ = (selector, raiz = document) => Array.from(raiz.querySelectorAll(selector));

function escapeHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const esVacio = (valor) => valor === '' || valor == null;
const enfocar = (el) => { if (el) el.focus({ preventScroll: true }); };

export function construirArbolTiendas(tiendas) {
  const etiquetaTienda = t => (t.codigo ? `${t.codigo} - ${t.nombre}` : t.nombre);
  const porEtiqueta = (a, b) => etiquetaTienda(a).localeCompare(etiquetaTienda(b));
  const hojaDe = t => ({ tipo: 'hoja', valor: t.id, etiqueta: etiquetaTienda(t) });

  const porPais = new Map();
  tiendas.forEach(t => {
    const pais = t.pais_nombre || 'Sin país';
    if (!porPais.has(pais)) porPais.set(pais, []);
    porPais.get(pais).push(t);
  });
  // «Sin país» al final para que no se mezcle con los países reales.
  const paises = [...porPais.keys()].sort((a, b) => {
    if (a === 'Sin país' || b === 'Sin país') return a === b ? 0 : (a === 'Sin país' ? 1 : -1);
    return a.localeCompare(b);
  });

  const nodosPais = paises.map((pais, indice) => {
    const sueltas = [];
    const gruposPorDepto = new Map();
    porPais.get(pais).slice().sort(porEtiqueta).forEach(t => {
      const depto = t.departamento_nombre || '';
      // Los departamentos Trofex (Ruta 1/Ruta 2) van como grupo de nivel 3; el resto queda suelto.
      if (/trofex/i.test(depto)) {
        const etiquetaGrupo = depto.replace(/^Ventas\s+/i, '');
        if (!gruposPorDepto.has(etiquetaGrupo)) gruposPorDepto.set(etiquetaGrupo, []);
        gruposPorDepto.get(etiquetaGrupo).push(t);
      } else {
        sueltas.push(t);
      }
    });
    const hijos = [
      ...sueltas.map(hojaDe),
      ...[...gruposPorDepto.keys()].sort((a, b) => a.localeCompare(b)).map(etiqueta => ({
        tipo: 'grupo',
        etiqueta,
        hijos: gruposPorDepto.get(etiqueta).map(hojaDe)
      }))
    ];
    const nodo = { tipo: 'grupo', etiqueta: pais, hijos };
    if (indice === 0) nodo.encabezadoAntes = 'País';
    return nodo;
  });
  // Con un solo país el primer nivel sobra: sus tiendas suben al nivel 1 bajo el nombre del país.
  if (nodosPais.length === 1) {
    const [unico] = nodosPais;
    return unico.hijos.map((h, i) => (i === 0 ? { ...h, encabezadoAntes: unico.etiqueta } : h));
  }
  return nodosPais;
}

// Orden y agrupación fijos — no se derivan genéricamente de la tabla de
// roles porque el propio documento funcional define esta jerarquía puntual.
export function construirArbolRoles(roles) {
  const porId = new Map(roles.map(r => [r.id, r]));
  const hoja = (id) => porId.has(id) ? { tipo: 'hoja', valor: id, etiqueta: porId.get(id).nombre } : null;
  const grupoEncargados = { tipo: 'grupo', etiqueta: 'Encargados de taller', hijos: [4, 5, 9, 10].map(hoja).filter(Boolean) };
  return [hoja(1), hoja(8), hoja(3), hoja(2), grupoEncargados, hoja(7), hoja(6)].filter(Boolean);
}

// Paneles, flyouts y hoja inferior viven sueltos en document.body (un ancestro
// con overflow o transform, como un modal, los recortaría); `_dueno` marca el
// elemento del que dependen para barrer los que quedaron huérfanos.
export function limpiarMenusCascadaHuerfanos() {
  $$(`${SELECTOR_PANELES}, .menu-cascada-hoja-raiz`).forEach(el => {
    if (el._dueno && !el._dueno.isConnected) el.remove();
  });
}

// Cada disparador detiene la propagación de su click, así que el "click
// afuera" de otro menú nunca se entera: este registro cierra a los demás.
export const menusCascadaAbiertos = new Set();

// `deshabilitar(nodoHoja)` opcional: devuelve { disabled, motivo } para
// bloquear una hoja sin sacarla del árbol, con el motivo como title.
export function crearMenuCascada({ arbol, valorActual, etiquetaVacio, deshabilitar, onSeleccionar, ariaLabel, mensajeVacio }) {
  let arbolActual = arbol || [];
  let actual = valorActual;
  let estado = null; // { tipo:'cargando' } | { tipo:'error', mensaje, onReintentar }
  let abierto = false;
  let enHoja = false;
  let temporizador = null;
  let scrollBloqueado = false;
  let overflowPrevio = '';
  const rutaFlyouts = [];
  const rutaHoja = [];
  const flyouts = [];
  const filasHoja = new Map();
  const etiquetaPanel = ariaLabel || 'Menú de selección';

  const punteroFino = () => window.matchMedia(CONSULTA_PUNTERO_FINO).matches;

  const cont = document.createElement('div');
  cont.className = 'menu-cascada';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'menu-cascada-trigger';
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  const etiquetaSpan = document.createElement('span');
  etiquetaSpan.className = 'menu-cascada-valor';
  trigger.appendChild(etiquetaSpan);
  trigger.insertAdjacentHTML('beforeend', '<ion-icon name="chevron-down-outline"></ion-icon>');
  cont.appendChild(trigger);

  const nav = document.createElement('nav');
  nav.className = 'menu-cascada-panel';
  nav.setAttribute('aria-label', etiquetaPanel);
  nav._dueno = cont;
  document.body.appendChild(nav);

  let raizHoja = null;
  let hoja = null;
  let volverBtn = null;
  let tituloHoja = null;
  let migasHoja = null;
  let cuerpoHoja = null;

  function buscarEtiqueta(valor, nodos) {
    for (const nodo of nodos) {
      if (nodo.tipo === 'hoja' && String(nodo.valor) === String(valor)) return nodo.etiqueta;
      if (nodo.hijos) {
        const enHijos = buscarEtiqueta(valor, nodo.hijos);
        if (enHijos) return enHijos;
      }
    }
    return null;
  }

  function actualizarTrigger() {
    const etiqueta = esVacio(actual) ? etiquetaVacio : (buscarEtiqueta(actual, arbolActual) || etiquetaVacio);
    etiquetaSpan.textContent = etiqueta;
    trigger.title = etiqueta || '';
    if (ariaLabel) trigger.setAttribute('aria-label', `${ariaLabel}: ${etiqueta}`);
  }

  function marcarActivos() {
    const valor = esVacio(actual) ? '' : String(actual);
    const raices = [nav, ...flyouts.map(f => f.panel), cuerpoHoja].filter(Boolean);
    raices.forEach(raiz => $$('.menu-cascada-item[data-valor]', raiz).forEach(btn => {
      const activo = btn.dataset.valor === valor;
      btn.classList.toggle('menu-cascada-item-activo', activo);
      if (activo) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    }));
  }

  function esMio(nodo) {
    return !!nodo && (cont.contains(nodo) || nav.contains(nodo) || flyouts.some(f => f.panel.contains(nodo)) || (!!raizHoja && raizHoja.contains(nodo)));
  }

  function tieneNodosReales(nodos) {
    return nodos.some(n => !(n.tipo === 'hoja' && esVacio(n.valor)));
  }

  // ---------- Filas ----------
  function crearFilaHoja(nodo) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-cascada-item';
    btn.tabIndex = -1;
    btn.dataset.valor = esVacio(nodo.valor) ? '' : nodo.valor;
    btn.innerHTML = '<span class="menu-cascada-item-texto"></span><ion-icon class="menu-cascada-check" name="checkmark-outline"></ion-icon>';
    btn.firstChild.textContent = nodo.etiqueta;
    const estadoFila = deshabilitar ? deshabilitar(nodo) : null;
    if (estadoFila && estadoFila.disabled) {
      btn.disabled = true;
      if (estadoFila.motivo) btn.title = estadoFila.motivo;
    } else {
      btn.addEventListener('click', () => seleccionar(nodo.valor));
    }
    li.appendChild(btn);
    return { li, btn };
  }

  function crearFilaGrupo(nodo) {
    const li = document.createElement('li');
    li.className = 'menu-cascada-submenu';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-cascada-item menu-cascada-item-padre';
    btn.tabIndex = -1;
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = `<span class="menu-cascada-item-texto">${escapeHtml(nodo.etiqueta)}</span><ion-icon name="chevron-forward-outline"></ion-icon>`;
    li.appendChild(btn);
    return { li, btn };
  }

  function crearMensajeVacio(texto) {
    const p = document.createElement('p');
    p.className = 'menu-cascada-vacio';
    p.textContent = texto;
    return p;
  }

  function renderLista(nodos, ul, ctx) {
    nodos.forEach((nodo, i) => {
      if (nodo.encabezadoAntes) {
        if (i > 0) {
          const divisor = document.createElement('li');
          divisor.className = 'menu-cascada-divisor';
          divisor.setAttribute('role', 'separator');
          ul.appendChild(divisor);
        }
        const encabezado = document.createElement('li');
        encabezado.className = 'menu-cascada-encabezado';
        encabezado.innerHTML = `<span class="menu-cascada-seccion-titulo">${escapeHtml(nodo.encabezadoAntes)}</span>`;
        ul.appendChild(encabezado);
      }
      ul.appendChild(renderNodo(nodo, ctx));
    });
  }

  function renderNodo(nodo, ctx) {
    if (nodo.tipo === 'hoja') {
      const { li, btn } = crearFilaHoja(nodo);
      if (!ctx.hoja) btn.addEventListener('mouseenter', () => { if (punteroFino()) programar(() => cerrarDesde(ctx.nivel + 1)); });
      return li;
    }
    if (nodo.tipo === 'grupo') {
      const { li, btn } = crearFilaGrupo(nodo);
      if (ctx.hoja) {
        filasHoja.set(nodo, btn);
        btn.addEventListener('click', (e) => { e.stopPropagation(); entrarHoja(nodo, e.detail === 0); });
      } else {
        conectarFlyout(nodo, btn, ctx);
      }
      return li;
    }
    const li = document.createElement('li');
    li.className = 'menu-cascada-seccion';
    const titulo = document.createElement('span');
    titulo.className = 'menu-cascada-seccion-titulo';
    titulo.textContent = nodo.etiqueta;
    const subUl = document.createElement('ul');
    renderLista(nodo.hijos || [], subUl, ctx);
    li.appendChild(titulo);
    li.appendChild(subUl);
    return li;
  }

  // ---------- Flyouts (escritorio) ----------
  function conectarFlyout(nodo, btn, ctx) {
    const panel = document.createElement('div');
    panel.className = 'menu-cascada-panel-nivel2';
    const g = { nodo, nivel: ctx.nivel + 1, btn, panel };
    panel.dataset.nivel = String(g.nivel);
    panel.setAttribute('aria-label', nodo.etiqueta);
    panel._dueno = cont;
    panel._grupo = g;
    btn._grupo = g;
    const titulo = document.createElement('div');
    titulo.className = 'menu-cascada-panel-titulo';
    titulo.textContent = nodo.etiqueta;
    const cuerpo = document.createElement('div');
    cuerpo.className = 'menu-cascada-panel-cuerpo';
    if (nodo.hijos && nodo.hijos.length) {
      const ul = document.createElement('ul');
      renderLista(nodo.hijos, ul, { nivel: g.nivel, hoja: false });
      cuerpo.appendChild(ul);
    } else {
      cuerpo.appendChild(crearMensajeVacio(nodo.mensajeVacio || MENSAJE_GRUPO_VACIO));
    }
    panel.append(titulo, cuerpo);
    panel.addEventListener('mouseenter', () => clearTimeout(temporizador));
    document.body.appendChild(panel);
    flyouts.push(g);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!rutaFlyouts.includes(g)) abrirGrupo(g, e.detail === 0);
      else if (!punteroFino()) cerrarDesde(g.nivel); // en táctil el segundo toque cierra
      else if (e.detail === 0) enfocar(primeraFila(panel));
    });
    btn.addEventListener('mouseenter', () => {
      if (!punteroFino()) return;
      if (rutaFlyouts.includes(g)) { clearTimeout(temporizador); return; }
      programar(() => abrirGrupo(g, false));
    });
  }

  function programar(accion) {
    clearTimeout(temporizador);
    temporizador = setTimeout(accion, ESPERA_HOVER_MS);
  }

  function cerrarDesde(nivel) {
    while (rutaFlyouts.length && rutaFlyouts[rutaFlyouts.length - 1].nivel >= nivel) {
      const g = rutaFlyouts.pop();
      g.panel.style.display = 'none';
      g.btn.setAttribute('aria-expanded', 'false');
      g.btn.classList.remove('menu-cascada-item-ruta');
    }
  }

  function abrirGrupo(g, enfocarPrimera) {
    clearTimeout(temporizador);
    // Solo cierra su nivel y los más profundos; sus ancestros siguen abiertos.
    cerrarDesde(g.nivel);
    g.panel.style.display = 'flex';
    posicionarFlyout(g);
    g.btn.setAttribute('aria-expanded', 'true');
    g.btn.classList.add('menu-cascada-item-ruta');
    rutaFlyouts.push(g);
    if (enfocarPrimera) enfocar(primeraFila(g.panel));
  }

  function posicionarFlyout(g) {
    const margen = 8;
    const separacion = 4;
    const fila = g.btn.getBoundingClientRect();
    const panelPadre = g.btn.closest(SELECTOR_PANELES).getBoundingClientRect();
    const ancho = g.panel.offsetWidth;
    const alto = g.panel.offsetHeight;
    let left = panelPadre.right + separacion;
    if (left + ancho > window.innerWidth - margen) left = Math.max(margen, panelPadre.left - separacion - ancho);
    let top = fila.top;
    if (top + alto > window.innerHeight - margen) top = Math.max(margen, window.innerHeight - margen - alto);
    g.panel.style.left = `${left}px`;
    g.panel.style.top = `${top}px`;
  }

  const primeraFila = (raiz) => $$(SELECTOR_FILAS, raiz)[0];

  // ---------- Estados ----------
  function crearBloqueEstado() {
    const div = document.createElement('div');
    if (estado.tipo === 'cargando') {
      div.className = 'menu-cascada-estado menu-cascada-esqueleto';
      div.setAttribute('aria-busy', 'true');
      div.setAttribute('aria-label', 'Cargando');
      div.innerHTML = '<span class="menu-cascada-esqueleto-fila"></span>'.repeat(5);
      return div;
    }
    div.className = 'menu-cascada-estado menu-cascada-estado-error';
    div.setAttribute('role', 'alert');
    div.innerHTML = `<ion-icon name="alert-circle-outline"></ion-icon>
      <p class="menu-cascada-estado-mensaje">${escapeHtml(estado.mensaje)}</p>
      <p class="menu-cascada-estado-detalle">Inténtalo de nuevo.</p>
      <button type="button" class="btn btn--ghost btn--sm">Reintentar</button>`;
    div.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      if (estado && estado.onReintentar) estado.onReintentar();
    });
    return div;
  }

  function renderNav() {
    cerrarDesde(0);
    flyouts.splice(0).forEach(f => f.panel.remove());
    nav.replaceChildren();
    if (estado) { nav.appendChild(crearBloqueEstado()); return; }
    const ul = document.createElement('ul');
    renderLista(arbolActual, ul, { nivel: 1, hoja: false });
    if (!tieneNodosReales(arbolActual)) {
      const li = document.createElement('li');
      li.appendChild(crearMensajeVacio(mensajeVacio || MENSAJE_ARBOL_VACIO));
      ul.appendChild(li);
    }
    nav.appendChild(ul);
    marcarActivos();
  }

  function refrescarContenido() {
    renderNav();
    if (abierto && enHoja) { rutaHoja.length = 0; renderHoja(); }
  }

  // ---------- Hoja inferior (celular) ----------
  function asegurarHoja() {
    if (raizHoja) return;
    raizHoja = document.createElement('div');
    raizHoja.className = 'menu-cascada-hoja-raiz';
    raizHoja._dueno = cont;
    const fondo = document.createElement('div');
    fondo.className = 'menu-cascada-hoja-fondo';
    fondo.addEventListener('click', (e) => { e.stopPropagation(); cerrarTodo(true); });
    hoja = document.createElement('div');
    hoja.className = 'menu-cascada-hoja';
    hoja.setAttribute('role', 'dialog');
    hoja.setAttribute('aria-modal', 'true');
    hoja.setAttribute('aria-label', etiquetaPanel);
    hoja.innerHTML = `<div class="menu-cascada-hoja-asa"></div>
      <div class="menu-cascada-hoja-cabecera">
        <button type="button" class="menu-cascada-hoja-volver" aria-label="Volver" hidden><ion-icon name="arrow-back-outline"></ion-icon></button>
        <h2 class="menu-cascada-hoja-titulo"></h2>
        <button type="button" class="menu-cascada-hoja-cerrar" aria-label="Cerrar"><ion-icon name="close-outline"></ion-icon></button>
      </div>
      <div class="menu-cascada-hoja-migas" hidden></div>
      <div class="menu-cascada-hoja-cuerpo"></div>`;
    volverBtn = hoja.querySelector('.menu-cascada-hoja-volver');
    tituloHoja = hoja.querySelector('.menu-cascada-hoja-titulo');
    migasHoja = hoja.querySelector('.menu-cascada-hoja-migas');
    cuerpoHoja = hoja.querySelector('.menu-cascada-hoja-cuerpo');
    volverBtn.addEventListener('click', (e) => { e.stopPropagation(); volverHoja(e.detail === 0); });
    hoja.querySelector('.menu-cascada-hoja-cerrar').addEventListener('click', (e) => { e.stopPropagation(); cerrarTodo(true); });
    raizHoja.append(fondo, hoja);
    document.body.appendChild(raizHoja);
  }

  function renderHoja() {
    const grupo = rutaHoja[rutaHoja.length - 1];
    volverBtn.hidden = !grupo;
    tituloHoja.textContent = grupo ? grupo.etiqueta : etiquetaPanel;
    migasHoja.hidden = !grupo;
    migasHoja.textContent = rutaHoja.map(n => n.etiqueta).join(' › ');
    filasHoja.clear();
    cuerpoHoja.replaceChildren();
    if (estado) {
      cuerpoHoja.appendChild(crearBloqueEstado());
    } else {
      const nodos = grupo ? (grupo.hijos || []) : arbolActual;
      const ul = document.createElement('ul');
      renderLista(nodos, ul, { nivel: rutaHoja.length + 1, hoja: true });
      if (grupo ? !nodos.length : !tieneNodosReales(nodos)) {
        const li = document.createElement('li');
        li.appendChild(crearMensajeVacio(grupo ? (grupo.mensajeVacio || MENSAJE_GRUPO_VACIO) : (mensajeVacio || MENSAJE_ARBOL_VACIO)));
        ul.appendChild(li);
      }
      cuerpoHoja.appendChild(ul);
    }
    cuerpoHoja.scrollTop = 0;
    marcarActivos();
    if (cuerpoHoja.animate && !window.matchMedia(CONSULTA_MOVIMIENTO_REDUCIDO).matches) {
      cuerpoHoja.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'ease-out' });
    }
  }

  function entrarHoja(nodo, conTeclado) {
    rutaHoja.push(nodo);
    renderHoja();
    if (conTeclado) enfocar(primeraFila(cuerpoHoja));
  }

  function volverHoja(conTeclado) {
    const salido = rutaHoja.pop();
    if (!salido) return;
    renderHoja();
    if (conTeclado) enfocar(filasHoja.get(salido));
  }

  function abrirHoja() {
    asegurarHoja();
    rutaHoja.length = 0;
    renderHoja();
    if (!scrollBloqueado) {
      overflowPrevio = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      scrollBloqueado = true;
    }
    raizHoja.classList.add('visible');
  }

  // ---------- Abrir / cerrar ----------
  function seleccionar(valor) {
    actual = valor;
    actualizarTrigger();
    marcarActivos();
    cerrarTodo(true);
    if (onSeleccionar) onSeleccionar(valor);
  }

  function cerrarTodo(devolverFoco = false) {
    clearTimeout(temporizador);
    const teniaFoco = esMio(document.activeElement) && document.activeElement !== trigger;
    abierto = false;
    trigger.setAttribute('aria-expanded', 'false');
    nav.classList.remove('visible');
    cerrarDesde(0);
    flyouts.forEach(f => { f.panel.style.display = 'none'; });
    if (raizHoja) raizHoja.classList.remove('visible');
    rutaHoja.length = 0;
    if (scrollBloqueado) {
      document.body.style.overflow = overflowPrevio;
      scrollBloqueado = false;
    }
    menusCascadaAbiertos.delete(cerrarTodo);
    if (devolverFoco === true && teniaFoco) enfocar(trigger);
  }

  function abrir(conTeclado) {
    // Cierra cualquier otro menú ya abierto antes de abrir este.
    menusCascadaAbiertos.forEach(cerrar => { if (cerrar !== cerrarTodo) cerrar(); });
    // Barre huérfanos aquí y no al construir: durante la construcción `cont`
    // aún no está conectado y daría un falso "huérfano".
    limpiarMenusCascadaHuerfanos();
    enHoja = window.matchMedia(CONSULTA_CELULAR).matches;
    abierto = true;
    trigger.setAttribute('aria-expanded', 'true');
    menusCascadaAbiertos.add(cerrarTodo);
    if (enHoja) {
      abrirHoja();
    } else {
      const margen = 8;
      const rect = trigger.getBoundingClientRect();
      nav.style.top = `${rect.bottom + 6}px`;
      nav.style.maxHeight = `${Math.max(160, Math.min(360, window.innerHeight - rect.bottom - 6 - margen))}px`;
      nav.style.left = `${rect.left}px`;
      const ancho = nav.offsetWidth;
      if (rect.left + ancho > window.innerWidth - margen) nav.style.left = `${Math.max(margen, window.innerWidth - margen - ancho)}px`;
      nav.classList.add('visible');
    }
    if (conTeclado) enfocarInicial();
  }

  function enfocarInicial() {
    const raiz = enHoja ? cuerpoHoja : nav;
    enfocar(raiz.querySelector('.menu-cascada-item-activo:not(:disabled)') || primeraFila(raiz));
  }

  // ---------- Eventos ----------
  nav.addEventListener('mouseenter', () => clearTimeout(temporizador));

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (abierto) cerrarTodo(e.detail === 0);
    else abrir(e.detail === 0);
  });
  trigger.addEventListener('keydown', (e) => {
    if (abierto || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    e.preventDefault();
    abrir(true);
  });

  // Listeners globales con auto-limpieza: si `cont` ya no está en el documento
  // (re-render o modal cerrado) se desregistran y retiran sus paneles sueltos.
  const limpiarSiObsoleto = () => {
    if (cont.isConnected) return false;
    document.removeEventListener('click', onDocumentClick);
    document.removeEventListener('keydown', onDocumentKeydown, true);
    document.removeEventListener('scroll', onDocumentScroll, true);
    window.removeEventListener('resize', onResize);
    nav.remove();
    flyouts.forEach(f => f.panel.remove());
    if (raizHoja) raizHoja.remove();
    if (scrollBloqueado) {
      document.body.style.overflow = overflowPrevio;
      scrollBloqueado = false;
    }
    menusCascadaAbiertos.delete(cerrarTodo);
    return true;
  };

  const onDocumentClick = (e) => {
    if (limpiarSiObsoleto() || !abierto) return;
    // composedPath: la fila pulsada puede haberse retirado del DOM al re-renderizar.
    const camino = e.composedPath();
    const dentro = camino.includes(cont) || camino.includes(nav) || flyouts.some(f => camino.includes(f.panel)) || (!!hoja && camino.includes(hoja));
    if (!dentro) cerrarTodo();
  };

  const onDocumentScroll = (e) => {
    if (limpiarSiObsoleto() || !abierto || enHoja) return;
    if (!esMio(e.target)) cerrarTodo();
  };

  const onResize = () => {
    if (limpiarSiObsoleto() || !abierto || enHoja) return;
    cerrarTodo();
  };

  const onDocumentKeydown = (e) => {
    if (limpiarSiObsoleto() || !abierto) return;
    if (e.key === 'Escape') {
      // En captura y sin propagar: Esc cierra solo el menú, no un modal que lo contenga.
      e.preventDefault();
      e.stopPropagation();
      cerrarTodo(true);
      return;
    }
    const activo = document.activeElement;
    if (e.key === 'Tab') {
      if (enHoja) { atraparTabulador(e); return; }
      cerrarTodo(true);
      return;
    }
    const panelActivo = enHoja ? cuerpoHoja : (activo && activo.closest && activo.closest(SELECTOR_PANELES));
    const filas = panelActivo && esMio(panelActivo) ? $$(SELECTOR_FILAS, panelActivo) : [];
    const indice = filas.indexOf(activo);
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        const raiz = enHoja ? cuerpoHoja : nav;
        const lista = filas.length ? filas : $$(SELECTOR_FILAS, raiz);
        if (!lista.length) return;
        const baja = e.key === 'ArrowDown';
        const destino = indice === -1 ? (baja ? 0 : lista.length - 1) : (indice + (baja ? 1 : -1) + lista.length) % lista.length;
        enfocar(lista[destino]);
        break;
      }
      case 'Home':
      case 'End':
        if (!filas.length) return;
        e.preventDefault();
        enfocar(e.key === 'Home' ? filas[0] : filas[filas.length - 1]);
        break;
      case 'ArrowRight':
        if (activo && activo.classList && activo.classList.contains('menu-cascada-item-padre')) {
          e.preventDefault();
          if (enHoja) {
            const nodo = [...filasHoja].find(([, btn]) => btn === activo);
            if (nodo) entrarHoja(nodo[0], true);
          } else if (activo._grupo) {
            abrirGrupo(activo._grupo, true);
          }
        }
        break;
      case 'ArrowLeft':
        if (enHoja) {
          if (rutaHoja.length) { e.preventDefault(); volverHoja(true); }
        } else if (panelActivo && panelActivo._grupo) {
          e.preventDefault();
          cerrarDesde(panelActivo._grupo.nivel);
          enfocar(panelActivo._grupo.btn);
        }
        break;
      default:
    }
  };

  function atraparTabulador(e) {
    const enfocables = [volverBtn, hoja.querySelector('.menu-cascada-hoja-cerrar'), ...$$(SELECTOR_FILAS, cuerpoHoja)].filter(el => el && !el.hidden);
    const indice = enfocables.indexOf(document.activeElement);
    const destino = (indice + (e.shiftKey ? -1 : 1) + enfocables.length) % enfocables.length;
    e.preventDefault();
    enfocar(enfocables[destino]);
  }

  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onDocumentKeydown, true);
  document.addEventListener('scroll', onDocumentScroll, true);
  window.addEventListener('resize', onResize);

  renderNav();
  actualizarTrigger();
  marcarActivos();

  return {
    elemento: cont,
    actualizar(nuevoValor) {
      actual = nuevoValor;
      actualizarTrigger();
      marcarActivos();
    },
    establecerArbol(nuevoArbol) {
      arbolActual = nuevoArbol || [];
      estado = null;
      actualizarTrigger();
      refrescarContenido();
    },
    mostrarCargando() {
      estado = { tipo: 'cargando' };
      refrescarContenido();
    },
    mostrarError(mensaje, onReintentar) {
      estado = { tipo: 'error', mensaje, onReintentar };
      refrescarContenido();
    },
    cerrar() { cerrarTodo(); }
  };
}
