// Grupo de opciones en pastillas (niveles de un fluido, Sí/No del kit): un radiogrupo accesible que se recorre con las flechas.
import { h } from '../utils/dom.js';

// `opciones`: [{ valor, texto, bajo? }] (`bajo` pinta la opción elegida en ámbar); `valor` es el elegido o undefined; `alCambiar(valor)` recibe el valor de la opción.
export function crearGrupoOpciones({ id, etiquetaId, etiquetaAria, opciones, valor, alCambiar, clase = '' }) {
  const botones = opciones.map(o => h('button', { type: 'button', role: 'radio', class: 'vi-opcion', 'data-valor': String(o.valor), text: o.texto }));
  const grupo = h('div', { class: `vi-opciones ${clase}`.trim(), role: 'radiogroup', id, 'aria-labelledby': etiquetaId, 'aria-label': etiquetaId ? null : etiquetaAria }, botones);
  let actual = valor;

  const pintar = () => {
    const hayElegida = opciones.some(o => o.valor === actual);
    botones.forEach((b, i) => {
      const activo = opciones[i].valor === actual;
      b.setAttribute('aria-checked', String(activo));
      b.tabIndex = activo || (!hayElegida && i === 0) ? 0 : -1;
      b.classList.toggle('is-activa', activo);
      b.classList.toggle('is-bajo', activo && !!opciones[i].bajo);
    });
  };
  const elegir = (i) => {
    if (opciones[i].valor === actual) return;
    actual = opciones[i].valor;
    pintar();
    alCambiar(actual);
  };
  botones.forEach((b, i) => {
    b.addEventListener('click', () => elegir(i));
    b.addEventListener('keydown', (e) => {
      const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!paso) return;
      e.preventDefault();
      const siguiente = (i + paso + botones.length) % botones.length;
      elegir(siguiente);
      botones[siguiente].focus();
    });
  });
  pintar();
  return grupo;
}
