// public/modules/incidencias/js/views/config/parametros.js
// Parámetros: la pantalla se dibuja desde lo que declara el servidor (un parámetro nuevo aparece solo).
import { h, montar } from '../../utils/dom.js';
import * as api from '../../api/configApi.js';
import { interruptor } from '../../components/campos.js';
import { aviso, avisarError, encabezadoPestana } from './comun.js';

export async function mostrarParametros(cont) {
  let lista = (await api.parametros()).parametros;
  let sucio = false;
  const nuevos = {};

  function dibujar() {
    sucio = false;
    Object.keys(nuevos).forEach(k => delete nuevos[k]);
    const guardar = h('button', { class: 'btn btn--primary', type: 'button', disabled: true }, 'Guardar parámetros');
    const marcar = () => { sucio = true; guardar.disabled = false; };
    const filas = lista.map(p => {
      let control;
      if (p.tipo === 'booleano') {
        control = interruptor({ activo: p.valor, etiqueta: p.etiqueta, alCambiar: async (v) => { nuevos[p.clave] = v; marcar(); } });
      } else {
        const entrada = h('input', { type: 'number', id: `par-${p.clave}`, min: p.min, max: p.max, step: 1, inputmode: 'numeric' });
        entrada.value = String(p.valor);
        entrada.addEventListener('input', () => { nuevos[p.clave] = entrada.value; marcar(); });
        control = h('div', { class: 'inc-parametro-valor' }, entrada, p.unidad ? h('span', { class: 'inc-tenue', text: p.unidad }) : null);
      }
      return h('div', { class: 'inc-regla', 'data-campo': p.clave },
        h('div', null, h('label', { for: `par-${p.clave}`, text: p.etiqueta }), h('p', { class: 'inc-tenue', text: `${p.ayuda}${p.tipo === 'booleano' ? '' : ` (de ${p.min} a ${p.max})`}` })), control);
    });
    guardar.addEventListener('click', async () => {
      guardar.disabled = true;
      try {
        lista = (await api.guardarParametros(nuevos)).parametros;
        aviso('success', 'Parámetros guardados', 'Se aplican desde ahora.');
        dibujar();
      } catch (error) {
        guardar.disabled = false;
        if (error.campos) Object.entries(error.campos).forEach(([clave, texto]) => {
          const fila = cont.querySelector(`[data-campo="${clave}"]`);
          if (fila) { fila.classList.add('inc-campo--error'); fila.querySelector('p').textContent = texto; }
        });
        avisarError(error);
      }
    });
    montar(cont, encabezadoPestana('Parámetros', 'Límites y avisos del módulo. Cada cambio se aplica desde ese momento.'),
      h('section', { class: 'inc-seccion' }, h('div', { class: 'inc-reglas' }, filas), h('div', { class: 'inc-config-pie' }, guardar)));
  }
  dibujar();
  return { sinGuardar: () => sucio, descartar: () => { sucio = false; } };
}
