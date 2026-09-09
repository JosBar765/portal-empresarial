import { $$ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';

// Menú cascada — desplegable vertical con submenús de nivel 2 hacia la
// derecha. Reemplaza los <select> de Tienda/Rol en Gestionar Usuarios, el
// modal de Nuevo Usuario y el filtro de Gestionar Tiendas. Un nodo del árbol
// es uno de tres tipos:
//   - hoja:    { tipo:'hoja', valor, etiqueta }         — seleccionable.
//   - grupo:   { tipo:'grupo', etiqueta, hijos }        — abre un submenú
//              flotante hacia la derecha (ej. "Trofex R1").
//   - seccion: { tipo:'seccion', etiqueta, hijos }      — encabezado no
//              clickeable, sus hijos se listan debajo en línea (ej. un país).
export function construirArbolTiendas(tiendas) {
  const porPais = {};
  tiendas.forEach(t => {
    const pais = t.pais_nombre || 'Sin país';
    (porPais[pais] = porPais[pais] || []).push(t);
  });
  const etiquetaTienda = t => `${t.codigo} - ${t.nombre}`;
  return Object.keys(porPais).sort().map(pais => {
    const sueltas = [];
    const gruposPorDepto = {};
    porPais[pais].slice().sort((a, b) => etiquetaTienda(a).localeCompare(etiquetaTienda(b))).forEach(t => {
      const depto = t.departamento_nombre || '';
      // Agrupación elegida: los departamentos "Trofex" (Ruta 1/Ruta 2) van
      // en submenú; el resto de tiendas del país quedan sueltas.
      if (/trofex/i.test(depto)) {
        const etiquetaGrupo = depto.replace(/^Ventas\s+/i, '');
        (gruposPorDepto[etiquetaGrupo] = gruposPorDepto[etiquetaGrupo] || []).push(t);
      } else {
        sueltas.push(t);
      }
    });
    const hijos = [
      ...sueltas.map(t => ({ tipo: 'hoja', valor: t.id, etiqueta: etiquetaTienda(t) })),
      ...Object.keys(gruposPorDepto).sort().map(etiqueta => ({
        tipo: 'grupo',
        etiqueta,
        hijos: gruposPorDepto[etiqueta].map(t => ({ tipo: 'hoja', valor: t.id, etiqueta: etiquetaTienda(t) }))
      }))
    ];
    return { tipo: 'seccion', etiqueta: pais, hijos };
  });
}

// Orden y agrupación fijos — no se derivan genéricamente de la tabla de
// roles porque el propio documento funcional define esta jerarquía puntual.
export function construirArbolRoles(roles) {
  const porId = new Map(roles.map(r => [r.id, r]));
  const hoja = (id) => porId.has(id) ? { tipo: 'hoja', valor: id, etiqueta: porId.get(id).nombre } : null;
  const grupoEncargados = { tipo: 'grupo', etiqueta: 'Encargados de taller', hijos: [4, 5, 9, 10].map(hoja).filter(Boolean) };
  return [hoja(1), hoja(8), hoja(3), hoja(2), grupoEncargados, hoja(7), hoja(6)].filter(Boolean);
}

// El panel principal y los submenús de nivel 2 viven sueltos en
// document.body (no como descendientes del trigger): un ancestro con
// overflow (un modal scrolleable) o con transform (incluida una animación
// de apertura con scale/translate) recortaría o desubicaría un panel
// anidado ahí. Cada uno queda marcado con `_dueno` (el elemento del que
// depende su ciclo de vida) para poder barrer los que ya quedaron
// huérfanos de un render anterior.
export function limpiarMenusCascadaHuerfanos() {
  $$('.menu-cascada-panel, .menu-cascada-panel-nivel2').forEach(el => {
    if (el._dueno && !el._dueno.isConnected) el.remove();
  });
}

// Cada trigger detiene la propagación de su propio click, así que el
// listener "click afuera" de cualquier OTRO menú abierto nunca se entera
// de ese click y no se cierra — este registro deja que abrir uno cierre
// explícitamente a todos los demás.
export const menusCascadaAbiertos = new Set();

// `deshabilitar(nodoHoja)` opcional: devuelve { disabled, motivo } para
// bloquear una hoja puntual (rol ya ocupado, tienda fuera de MTC/MTS) sin
// sacarla del árbol, con el motivo visible como title.
export function crearMenuCascada({ arbol, valorActual, etiquetaVacio, deshabilitar, onSeleccionar }) {
  let actual = valorActual;
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

  // El panel vive en document.body (no como hijo de cont): triggers dentro
  // de un modal (overflow-y: auto) recortarían un panel absoluto/anidado —
  // mismo problema que el submenú de nivel 2, misma solución.
  const nav = document.createElement('nav');
  nav.className = 'menu-cascada-panel';
  nav.setAttribute('aria-label', 'Menú de selección');
  nav._dueno = cont;
  document.body.appendChild(nav);

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
    etiquetaSpan.textContent = (actual === '' || actual == null) ? etiquetaVacio : (buscarEtiqueta(actual, arbol) || etiquetaVacio);
  }

  function marcarActivos() {
    $$('.menu-cascada-item[data-valor]', nav).forEach(btn => {
      btn.classList.toggle('menu-cascada-item-activo', String(btn.dataset.valor) === String(actual));
    });
  }

  const misFlyouts = [];
  function cerrarTodo() {
    trigger.setAttribute('aria-expanded', 'false');
    nav.classList.remove('visible');
    misFlyouts.forEach(f => { f.style.display = 'none'; });
    $$('.menu-cascada-item-padre', nav).forEach(b => b.setAttribute('aria-expanded', 'false'));
    menusCascadaAbiertos.delete(cerrarTodo);
  }

  function renderNodo(nodo) {
    const li = document.createElement('li');
    if (nodo.tipo === 'hoja') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-cascada-item';
      btn.dataset.valor = nodo.valor;
      btn.textContent = nodo.etiqueta;
      const estado = deshabilitar ? deshabilitar(nodo) : null;
      if (estado && estado.disabled) {
        btn.disabled = true;
        if (estado.motivo) btn.title = estado.motivo;
      } else {
        btn.addEventListener('click', () => {
          actual = nodo.valor;
          actualizarTrigger();
          marcarActivos();
          cerrarTodo();
          onSeleccionar(nodo.valor);
        });
      }
      li.appendChild(btn);
    } else if (nodo.tipo === 'grupo') {
      li.className = 'menu-cascada-submenu';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-cascada-item menu-cascada-item-padre';
      btn.setAttribute('aria-haspopup', 'true');
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = `<span>${escapeHtml(nodo.etiqueta)}</span><ion-icon name="chevron-forward-outline"></ion-icon>`;
      const subUl = document.createElement('ul');
      subUl.className = 'menu-cascada-panel-nivel2';
      subUl._dueno = li;
      nodo.hijos.forEach(hijo => subUl.appendChild(renderNodo(hijo)));
      document.body.appendChild(subUl);
      misFlyouts.push(subUl);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const yaAbierto = subUl.style.display === 'block';
        misFlyouts.forEach(f => { f.style.display = 'none'; });
        $$('.menu-cascada-item-padre', nav).forEach(b => b.setAttribute('aria-expanded', 'false'));
        if (!yaAbierto) {
          const rect = li.getBoundingClientRect();
          subUl.style.top = `${rect.top}px`;
          const cabeEnDerecha = rect.right + 220 <= window.innerWidth;
          if (cabeEnDerecha) {
            subUl.style.left = `${rect.right + 4}px`;
            subUl.style.right = '';
          } else {
            subUl.style.left = '';
            subUl.style.right = `${window.innerWidth - rect.left + 4}px`;
          }
          subUl.style.display = 'block';
          btn.setAttribute('aria-expanded', 'true');
        }
      });
      li.appendChild(btn);
    } else if (nodo.tipo === 'seccion') {
      li.className = 'menu-cascada-seccion';
      const titulo = document.createElement('span');
      titulo.className = 'menu-cascada-seccion-titulo';
      titulo.textContent = nodo.etiqueta;
      const subUl = document.createElement('ul');
      nodo.hijos.forEach(hijo => subUl.appendChild(renderNodo(hijo)));
      li.appendChild(titulo);
      li.appendChild(subUl);
    }
    return li;
  }

  const raiz = document.createElement('ul');
  arbol.forEach(nodo => raiz.appendChild(renderNodo(nodo)));
  nav.appendChild(raiz);

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const abrir = !nav.classList.contains('visible');
    if (abrir) {
      // Cierra cualquier otro combobox ya abierto antes de abrir este.
      menusCascadaAbiertos.forEach(cerrar => { if (cerrar !== cerrarTodo) cerrar(); });
      // Barre paneles/flyouts huérfanos de renders anteriores AQUÍ (no
      // durante la construcción del árbol, cuando los propios <li>/cont
      // todavía no están conectados al documento y `isConnected` daría un
      // falso "huérfano").
      limpiarMenusCascadaHuerfanos();
      const rect = trigger.getBoundingClientRect();
      nav.style.top = `${rect.bottom + 6}px`;
      nav.style.left = `${rect.left}px`;
      nav.classList.add('visible');
      trigger.setAttribute('aria-expanded', 'true');
      menusCascadaAbiertos.add(cerrarTodo);
    } else {
      cerrarTodo();
    }
  });
  // Listeners globales con auto-limpieza: si `cont` ya no está en el
  // documento (este menú quedó obsoleto por un re-render, o su modal
  // contenedor se cerró) se desregistran solos Y retiran de inmediato el
  // panel/flyouts que hubieran quedado sueltos y visibles en <body> — no
  // basta con dejar de escuchar, porque un modal puede cerrarse (Escape,
  // Cancelar, click en el fondo) con el menú todavía abierto.
  const limpiarSiObsoleto = () => {
    if (cont.isConnected) return false;
    document.removeEventListener('click', onDocumentClick);
    document.removeEventListener('keydown', onDocumentKeydown);
    nav.remove();
    misFlyouts.forEach(f => f.remove());
    menusCascadaAbiertos.delete(cerrarTodo);
    return true;
  };
  const onDocumentClick = (e) => {
    if (limpiarSiObsoleto()) return;
    if (!cont.contains(e.target) && !nav.contains(e.target) && !misFlyouts.some(f => f.contains(e.target))) cerrarTodo();
  };
  const onDocumentKeydown = (e) => {
    if (limpiarSiObsoleto()) return;
    if (e.key === 'Escape') cerrarTodo();
  };
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onDocumentKeydown);

  actualizarTrigger();
  marcarActivos();

  return {
    elemento: cont,
    actualizar(nuevoValor) {
      actual = nuevoValor;
      actualizarTrigger();
      marcarActivos();
    }
  };
}
