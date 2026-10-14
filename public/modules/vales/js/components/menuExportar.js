import { escapeHtml } from '../utils/formato.js';

// -----------------------------------------------------------------------
// Botón «Exportar PDF» de Reportes. Con una sola opción es un botón simple; con varias, un botón con menú (patrón «menu button»):
// Enter, Espacio o ↓ abren; ↑/↓ navegan; Inicio/Fin saltan; Esc cierra y devuelve el foco; clic fuera o Tab cierran.
// `opciones`: [{ id, icono, titulo, detalle }]; `activa`: la opción de la pestaña que se está viendo (se marca en el menú).
// -----------------------------------------------------------------------
export function crearMenuExportar(contenedor, { alElegir }) {
  let opciones = [];
  let activa = '';
  let ocupado = false;
  let abierto = false;

  const boton = () => contenedor.querySelector('#rep-exportar');
  const items = () => [...contenedor.querySelectorAll('[role="menuitem"]')];

  function cerrar({ devolverFoco = false } = {}) {
    if (!abierto) return;
    abierto = false;
    const menu = contenedor.querySelector('.rep-menu');
    if (menu) menu.hidden = true;
    const b = boton();
    if (b) { b.setAttribute('aria-expanded', 'false'); if (devolverFoco) b.focus(); }
  }

  function abrir(enfocar = 'primero') {
    if (ocupado || abierto) return;
    abierto = true;
    contenedor.querySelector('.rep-menu').hidden = false;
    boton().setAttribute('aria-expanded', 'true');
    const lista = items();
    (enfocar === 'ultimo' ? lista[lista.length - 1] : lista[0]).focus();
  }

  function elegir(id) {
    cerrar({ devolverFoco: true });
    alElegir(id);
  }

  function pintar() {
    const unico = opciones.length <= 1;
    contenedor.classList.toggle('rep-exportar--menu', !unico);
    contenedor.innerHTML = unico
      ? `<button class="btn btn--primary btn--sm" id="rep-exportar" type="button"${ocupado ? ' disabled' : ''}><ion-icon name="download-outline" aria-hidden="true"></ion-icon> <span>${ocupado ? 'Generando PDF…' : 'Exportar PDF'}</span></button>`
      : `<button class="btn btn--primary btn--sm" id="rep-exportar" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="rep-menu-exportar"${ocupado ? ' disabled' : ''}>
           <ion-icon name="download-outline" aria-hidden="true"></ion-icon> <span>${ocupado ? 'Generando PDF…' : 'Exportar PDF'}</span><ion-icon name="chevron-down-outline" class="rep-exportar-flecha" aria-hidden="true"></ion-icon>
         </button>
         <div class="rep-menu" id="rep-menu-exportar" role="menu" aria-label="Elegir reporte a descargar" hidden>
           ${opciones.map(o => `
             <button type="button" class="rep-menu-item${o.id === activa ? ' is-activa' : ''}" role="menuitem" tabindex="-1" data-tipo="${escapeHtml(o.id)}">
               <ion-icon name="${escapeHtml(o.icono)}" aria-hidden="true"></ion-icon>
               <span class="rep-menu-texto"><strong>${escapeHtml(o.titulo)}</strong><small>${escapeHtml(o.detalle)}</small></span>
               ${o.id === activa ? '<span class="rep-menu-actual">Estás viendo este</span>' : ''}
             </button>`).join('')}
         </div>`;
    abierto = false;
    const b = boton();
    if (unico) { b.addEventListener('click', () => alElegir((opciones[0] || { id: 'actividad' }).id)); return; }
    b.addEventListener('click', () => (abierto ? cerrar() : abrir()));
    b.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); abrir('primero'); }
      if (e.key === 'ArrowUp') { e.preventDefault(); abrir('ultimo'); }
    });
    contenedor.querySelectorAll('[role="menuitem"]').forEach(item => {
      item.addEventListener('click', () => elegir(item.dataset.tipo));
      item.addEventListener('keydown', (e) => {
        const lista = items();
        const i = lista.indexOf(item);
        if (e.key === 'ArrowDown') { e.preventDefault(); lista[(i + 1) % lista.length].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); lista[(i - 1 + lista.length) % lista.length].focus(); }
        else if (e.key === 'Home') { e.preventDefault(); lista[0].focus(); }
        else if (e.key === 'End') { e.preventDefault(); lista[lista.length - 1].focus(); }
        else if (e.key === 'Escape') { e.preventDefault(); cerrar({ devolverFoco: true }); }
        else if (e.key === 'Tab') cerrar();
      });
    });
  }

  // Un solo manejador global: clic fuera cierra el menú.
  document.addEventListener('click', (e) => { if (abierto && !contenedor.contains(e.target)) cerrar(); });

  return {
    configurar(nuevas, nuevaActiva) {
      opciones = nuevas;
      activa = nuevaActiva;
      pintar();
    },
    // Mientras se genera el PDF el botón queda deshabilitado y lo avisa.
    ocupado(valor) {
      ocupado = valor;
      pintar();
    }
  };
}
