// public/modules/incidencias/js/views/config/roles.js
// Roles y permisos: una matriz rol × permiso de Incidencias. Se guarda un rol a la vez; los permisos de otros módulos no se tocan.
import { h, montar } from '../../utils/dom.js';
import * as api from '../../api/configApi.js';
import { aviso, avisarError, encabezadoPestana } from './comun.js';

export async function mostrarRoles(cont, { alCambiar } = {}) {
  let datos = await api.roles();
  const pendientes = new Map(); // rolId → Set de permisos marcados

  function dibujar() {
    pendientes.clear();
    const cabecera = h('tr', null, h('th', { scope: 'col', text: 'Rol' }), datos.permisos.map(p => h('th', { scope: 'col', title: p.descripcion, text: p.nombre })), h('th', { scope: 'col' }));
    const filas = datos.roles.map(r => {
      const marcados = new Set(r.permisos);
      const guardar = h('button', { class: 'btn btn--primary btn--sm', type: 'button', disabled: true }, 'Guardar');
      const celdas = datos.permisos.map(p => {
        const caja = h('input', { type: 'checkbox', checked: marcados.has(p.codigo), 'aria-label': `${r.nombre}: ${p.nombre}` });
        caja.addEventListener('change', () => {
          if (caja.checked) marcados.add(p.codigo); else marcados.delete(p.codigo);
          pendientes.set(r.id, marcados);
          guardar.disabled = false;
        });
        return h('td', { 'data-etiqueta': p.nombre }, caja);
      });
      guardar.addEventListener('click', async () => {
        guardar.disabled = true;
        try {
          const respuesta = await api.actualizarRol(r.id, [...marcados]);
          datos = respuesta;
          pendientes.delete(r.id);
          const agregado = respuesta.agregados && respuesta.agregados.length;
          aviso('success', `Permisos de ${r.nombre} guardados`, agregado ? 'Se agregó «Ver» porque sin él no se puede entrar al módulo.' : respuesta.aviso);
          if (alCambiar) alCambiar();
          dibujar();
        } catch (error) { guardar.disabled = false; avisarError(error); }
      });
      return h('tr', null, h('th', { scope: 'row' }, h('strong', { text: r.nombre }), h('div', { class: 'inc-tenue', text: `${r.usuarios} persona${r.usuarios === 1 ? '' : 's'}` })), celdas, h('td', { class: 'inc-celda-accion' }, guardar));
    });
    montar(cont, encabezadoPestana('Roles y permisos', 'Qué puede hacer cada rol en Incidencias. Los roles y las personas se crean en Administración.'),
      h('div', { class: 'inc-tabla-config' }, h('table', { class: 'inc-tabla inc-tabla--matriz' }, h('thead', null, cabecera), h('tbody', null, filas))),
      h('ul', { class: 'inc-leyenda' }, datos.permisos.map(p => h('li', null, h('strong', { text: `${p.nombre}: ` }), p.descripcion))));
  }
  dibujar();
  return { sinGuardar: () => pendientes.size > 0, descartar: () => pendientes.clear() };
}
