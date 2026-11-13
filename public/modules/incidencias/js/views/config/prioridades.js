// public/modules/incidencias/js/views/config/prioridades.js
// Prioridades: nombre, color y orden de cada nivel, y la regla «qué impacto da qué prioridad» (la calcula el servidor).
import { h, montar } from '../../utils/dom.js';
import * as api from '../../api/configApi.js';
import { abrirHoja } from '../../components/modal.js';
import { campoLinea, campoNumero, campoSelect, interruptor, nota } from '../../components/campos.js';
import { aviso, avisarError, tablaConfig, botonEditar, botonPrincipal, encabezadoPestana, COLORES } from './comun.js';

export async function mostrarPrioridades(cont, { alCambiar } = {}) {
  let datos = await api.prioridades();
  let elegidas = Object.fromEntries(datos.reglas.map(r => [r.impacto, r.prioridadId]));
  let cambiosReglas = false;

  const opcionesColor = () => COLORES.filter(c => datos.colores.includes(c[0])).map(c => ({ valor: c[0], texto: c[1] }));

  function formulario(actual) {
    const codigo = campoLinea({ etiqueta: 'Código', nombre: 'codigo', max: 3, valor: actual ? actual.codigo : '', obligatorio: true, deshabilitado: Boolean(actual), ayuda: actual ? 'El código no se cambia.' : 'Una letra y uno o dos números, por ejemplo P5.' });
    const nombre = campoLinea({ etiqueta: 'Nombre', nombre: 'nombre', max: 40, valor: actual ? actual.nombre : '', obligatorio: true });
    const color = campoSelect({ etiqueta: 'Color', nombre: 'color', opciones: opcionesColor(), vacio: 'Elige un color', valor: actual ? actual.color : '' });
    const orden = campoNumero({ etiqueta: 'Orden', nombre: 'orden', min: 1, max: 99, obligatorio: true, valor: actual ? actual.orden : '', ayuda: '1 es la más urgente.' });
    abrirHoja({
      titulo: actual ? `Editar ${actual.codigo}` : 'Nueva prioridad', contenido: h('div', { class: 'inc-formulario-hoja' }, actual ? null : codigo.el, nombre.el, color.el, orden.el, nota('El orden decide qué sube cuando una incidencia se repite.')),
      acciones: [{ texto: actual ? 'Guardar cambios' : 'Crear prioridad', textoOcupado: 'Guardando…', alHacerClic: async () => {
        const cuerpo = { nombre: nombre.valor(), color: color.valor(), orden: Number(orden.valor()) };
        datos = actual ? await api.actualizarPrioridad(actual.id, cuerpo) : await api.crearPrioridad({ ...cuerpo, codigo: codigo.valor() });
        aviso('success', actual ? 'Cambios guardados' : 'Prioridad creada', nombre.valor());
        dibujar();
      } }]
    });
  }

  const chip = (p) => h('span', { class: `inc-chip inc-chip--prio-${p.color}`, text: `${p.codigo} · ${p.nombre}` });

  async function guardarReglas() {
    try {
      datos = await api.guardarReglas(Object.entries(elegidas).map(([impacto, prioridadId]) => ({ impacto, prioridadId: Number(prioridadId) })));
      cambiosReglas = false;
      aviso('success', 'Reglas guardadas', 'Las próximas incidencias usarán esta tabla.');
      if (alCambiar) alCambiar();
      dibujar();
    } catch (error) { avisarError(error); }
  }

  function dibujar() {
    elegidas = Object.fromEntries(datos.reglas.map(r => [r.impacto, r.prioridadId]));
    const activas = datos.prioridades.filter(p => p.activo);
    const boton = h('button', { class: 'btn btn--primary', type: 'button', disabled: true, onclick: guardarReglas }, 'Guardar reglas');
    const reglas = datos.reglas.map(r => {
      const sel = h('select', { 'aria-label': `Prioridad para ${r.nombre}` }, h('option', { value: '', text: 'Elige la prioridad' }), activas.map(p => h('option', { value: String(p.id), text: `${p.codigo} · ${p.nombre}` })));
      sel.value = r.prioridadId ? String(r.prioridadId) : '';
      sel.addEventListener('change', () => { elegidas[r.impacto] = sel.value; cambiosReglas = true; boton.disabled = false; });
      return h('div', { class: 'inc-regla' }, h('div', null, h('strong', { text: r.nombre }), h('p', { class: 'inc-tenue', text: r.ayuda })), sel);
    });
    montar(cont,
      encabezadoPestana('Prioridades', 'Qué tan urgente es cada nivel y cómo se decide.', botonPrincipal('Nueva prioridad', () => formulario(null))),
      tablaConfig({
        columnas: ['Prioridad', 'Orden', 'Abiertas', 'Activa', ''],
        filas: datos.prioridades.map(p => ({ celdas: [chip(p), String(p.orden), String(p.abiertas), interruptor({ activo: p.activo, etiqueta: `${p.codigo}: ${p.activo ? 'activa' : 'apagada'}`, alCambiar: async (nuevo) => {
          try { datos = await api.actualizarPrioridad(p.id, { activo: nuevo }); aviso('success', nuevo ? 'Encendida' : 'Apagada', p.codigo); setTimeout(dibujar, 0); } catch (error) { avisarError(error); throw error; }
        } }), botonEditar(() => formulario(p))] }))
      }),
      h('section', { class: 'inc-seccion' }, h('h3', { text: 'Impacto y prioridad' }), h('p', { class: 'inc-tenue', text: 'Quien reporta solo dice qué tanto afecta; el sistema pone la prioridad con esta tabla.' }), h('div', { class: 'inc-reglas' }, reglas), h('div', { class: 'inc-config-pie' }, boton)));
  }
  dibujar();
  return { sinGuardar: () => cambiosReglas, descartar: () => { cambiosReglas = false; } };
}
