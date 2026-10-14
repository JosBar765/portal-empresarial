// Selector desplegable de selección múltiple con búsqueda (asesores, diseñadores…): botón con el resumen de lo elegido
// y un panel con casillas, «Seleccionar todos / Quitar selección» y Aplicar / Cancelar. Se cierra con Esc o clic fuera.
import { escapeHtml } from '../utils/formato.js';

// `opciones`: [{ id, nombre }]; `seleccion`: ids elegidos; `plural`: ['asesor', 'asesores'].
export function crearSelectorMultiple(contenedor, { uid, icono, vacio, plural, opciones, seleccion, alAplicar }) {
  const elegidos = new Set(seleccion.map(String));
  const etiqueta = () => {
    if (!elegidos.size) return vacio;
    if (elegidos.size === 1) return (opciones.find(o => elegidos.has(String(o.id))) || {}).nombre || `1 ${plural[0]}`;
    return `${elegidos.size} ${plural[1]}`;
  };
  contenedor.innerHTML = `
    <div class="rep-selector" id="${uid}">
      <button type="button" class="filtro-tienda rep-selector-btn${elegidos.size ? ' is-activo' : ''}" aria-haspopup="dialog" aria-expanded="false">
        <ion-icon name="${icono}" aria-hidden="true"></ion-icon><span>${escapeHtml(etiqueta())}</span>
      </button>
      <div class="rep-selector-panel" role="dialog" aria-label="${escapeHtml(`Elegir ${plural[1]}`)}" hidden>
        <input type="search" class="rep-selector-buscar" placeholder="Buscar por nombre" aria-label="Buscar por nombre" autocomplete="off">
        <div class="rep-selector-acciones">
          <button type="button" class="rep-link" data-accion="todos">Seleccionar todos</button>
          <button type="button" class="rep-link" data-accion="ninguno">Quitar selección</button>
        </div>
        <ul class="rep-selector-lista">
          ${opciones.map(o => `<li data-nombre="${escapeHtml(o.nombre.toLowerCase())}"><label><input type="checkbox" value="${o.id}"${elegidos.has(String(o.id)) ? ' checked' : ''}><span>${escapeHtml(o.nombre)}</span></label></li>`).join('')}
        </ul>
        <p class="rep-selector-vacio" hidden>Nadie coincide con la búsqueda.</p>
        <div class="rep-selector-pie">
          <span data-cuenta></span>
          <span class="rep-selector-botones"><button type="button" class="btn btn--ghost btn--sm" data-accion="cancelar">Cancelar</button><button type="button" class="btn btn--primary btn--sm" data-accion="aplicar">Aplicar</button></span>
        </div>
      </div>
    </div>`;
  const raiz = contenedor.querySelector('.rep-selector');
  const boton = raiz.querySelector('.rep-selector-btn');
  const panel = raiz.querySelector('.rep-selector-panel');
  const cajas = () => [...panel.querySelectorAll('input[type="checkbox"]')];
  const marcadas = () => cajas().filter(c => c.checked).map(c => c.value);
  const cuenta = () => { panel.querySelector('[data-cuenta]').textContent = `${marcadas().length} de ${opciones.length} elegidos`; };
  let abierto = false;

  const cerrar = (devolverFoco = true) => {
    if (!abierto) return;
    abierto = false;
    panel.hidden = true;
    boton.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', fuera, true);
    document.removeEventListener('keydown', teclado, true);
    if (devolverFoco) boton.focus();
  };
  const fuera = (e) => { if (!raiz.contains(e.target)) cerrar(false); };
  const teclado = (e) => { if (e.key === 'Escape') { e.preventDefault(); cerrar(); } };
  boton.addEventListener('click', () => {
    if (abierto) { cerrar(); return; }
    abierto = true;
    panel.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', fuera, true);
    document.addEventListener('keydown', teclado, true);
    cuenta();
    panel.querySelector('.rep-selector-buscar').focus();
  });
  panel.addEventListener('change', cuenta);
  panel.querySelector('.rep-selector-buscar').addEventListener('input', (e) => {
    const t = e.target.value.trim().toLowerCase();
    let visibles = 0;
    panel.querySelectorAll('.rep-selector-lista li').forEach(li => { const ok = !t || li.dataset.nombre.includes(t); li.hidden = !ok; if (ok) visibles += 1; });
    panel.querySelector('.rep-selector-vacio').hidden = visibles > 0;
  });
  panel.querySelector('[data-accion="todos"]').addEventListener('click', () => { cajas().forEach(c => { if (!c.closest('li').hidden) c.checked = true; }); cuenta(); });
  panel.querySelector('[data-accion="ninguno"]').addEventListener('click', () => { cajas().forEach(c => { c.checked = false; }); cuenta(); });
  panel.querySelector('[data-accion="cancelar"]').addEventListener('click', () => {
    cajas().forEach(c => { c.checked = elegidos.has(c.value); });
    cerrar();
  });
  panel.querySelector('[data-accion="aplicar"]').addEventListener('click', () => {
    const ids = marcadas();
    cerrar(false);
    alAplicar(ids.length === opciones.length ? [] : ids); // todos marcados = sin filtro
  });
}
