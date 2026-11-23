export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Crea un nodo: `class`, `text`, `html` (solo markup estático), `onX` y atributos.
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

export const icono = (nombre) => h('ion-icon', { name: nombre });

// replaceChildren nativo escribe «null» si recibe null: se descartan los valores vacíos.
export function montar(cont, ...hijos) {
  cont.replaceChildren(...hijos.flat().filter(x => x != null && x !== false));
}
