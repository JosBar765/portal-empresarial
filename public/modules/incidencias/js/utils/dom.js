// public/modules/incidencias/js/utils/dom.js
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Crea un nodo: `class`, `text`, `html` (solo markup estático), `onX` y atributos. Nunca se arma HTML con datos del usuario.
export function h(tag, props, ...hijos) {
  const nodo = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') nodo.className = v;
    else if (k === 'text') nodo.textContent = v;
    else if (k === 'html') nodo.innerHTML = v;
    else if (k.startsWith('on')) nodo.addEventListener(k.slice(2), v);
    else nodo.setAttribute(k, v === true ? '' : v);
  }
  const anadir = (x) => {
    if (Array.isArray(x)) x.forEach(anadir);
    else if (x != null && x !== false) nodo.append(x);
  };
  hijos.forEach(anadir);
  return nodo;
}

export const icono = (nombre, clase) => h('ion-icon', { name: nombre, class: clase });

// replaceChildren nativo escribe «null» si recibe null: se descartan los valores vacíos.
export function montar(cont, ...hijos) {
  cont.replaceChildren(...hijos.flat().filter(x => x != null && x !== false));
}

// Una pausa (en milisegundos).
export const esperar = (ms) => new Promise(resolver => setTimeout(resolver, ms));

// Evita repetir una llamada mientras llegan eventos seguidos (búsqueda, avisos en vivo).
export function sinRebote(fn, ms = 300) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
