// public/modules/incidencias/js/views/config/tecnicos.js
// Técnicos: quién atiende, qué especialidades tiene y qué tiendas cubre. Las personas se crean en Administración.
import { h, montar } from '../../utils/dom.js';
import * as api from '../../api/configApi.js';
import { abrirHoja } from '../../components/modal.js';
import { casillas, interruptor, nota } from '../../components/campos.js';
import { aviso, avisarError, tablaConfig, botonEditar, botonPrincipal, encabezadoPestana, selectorPersonas, tiendasDeConfig } from './comun.js';

export async function mostrarTecnicos(cont, { alCambiar } = {}) {
  let lista = (await api.tecnicos()).tecnicos;
  const especialidades = (await api.catalogo('especialidades')).items.filter(e => e.activo);

  // Alta (actual = null: se elige a la persona) o edición de lo que cubre.
  async function formulario(actual) {
    const tiendas = await tiendasDeConfig();
    const persona = actual ? null : selectorPersonas({ buscar: api.candidatosTecnico, etiqueta: 'Persona' });
    const esp = casillas({ etiqueta: 'Especialidades', nombre: 'especialidadIds', opciones: especialidades.map(e => ({ valor: e.id, texto: e.nombre })), seleccion: new Set((actual ? actual.especialidades : []).map(e => e.id)), ayuda: 'Sin marcar ninguna, puede tomar cualquier categoría.' });
    let todas = actual ? actual.todasLasTiendas : true;
    const cajaTodas = h('input', { type: 'checkbox', checked: todas });
    const tie = casillas({ etiqueta: 'Tiendas que cubre', nombre: 'tiendaIds', opciones: tiendas.map(t => ({ valor: t.id, texto: `${t.codigo} · ${t.empresa}` })), seleccion: new Set((actual ? actual.tiendas : []).map(t => t.id)) });
    const zonaTiendas = h('div', { hidden: todas }, tie.el);
    cajaTodas.addEventListener('change', () => { todas = cajaTodas.checked; zonaTiendas.hidden = todas; });
    const interruptorTodas = h('div', { class: 'inc-campo inc-campo--ancho', 'data-campo': 'todasLasTiendas' }, h('label', { class: 'inc-casilla' }, cajaTodas, h('span', { text: 'Cubre todas las tiendas' })));
    abrirHoja({
      titulo: actual ? `Cobertura de ${actual.nombre}` : 'Agregar técnico', contenido: h('div', { class: 'inc-formulario-hoja' }, persona ? persona.el : null, esp.el, interruptorTodas, zonaTiendas, nota('Para que pueda tomar incidencias, el rol de la persona debe tener el permiso «Atender» (pestaña Roles y permisos).')),
      acciones: [{ texto: actual ? 'Guardar cobertura' : 'Agregar técnico', textoOcupado: 'Guardando…', alHacerClic: async () => {
        const cuerpo = { especialidadIds: esp.valores(), todasLasTiendas: todas, tiendaIds: todas ? [] : tie.valores() };
        if (actual) lista = (await api.actualizarTecnico(actual.usuarioId, cuerpo)).tecnicos;
        else {
          const p = persona.elegida();
          lista = (await api.agregarTecnico({ ...cuerpo, usuarioId: p ? p.id : undefined })).tecnicos;
        }
        aviso('success', actual ? 'Cobertura guardada' : 'Técnico agregado', actual ? actual.nombre : '');
        if (alCambiar) alCambiar();
        dibujar();
      } }]
    });
  }

  const chips = (arr, vacio) => (arr.length ? h('span', { class: 'inc-tenue', text: arr.map(x => x.nombre || x.codigo).join(', ') }) : h('span', { class: 'inc-tenue', text: vacio }));

  function dibujar() {
    montar(cont,
      encabezadoPestana('Técnicos', 'Quienes atienden las incidencias del buzón. Las personas se crean en Administración.', botonPrincipal('Agregar técnico', () => formulario(null))),
      tablaConfig({
        columnas: ['Técnico', 'Especialidades', 'Cubre', 'Abiertas', 'Activo', ''],
        filas: lista.map(t => ({ celdas: [
          h('div', null, h('strong', { class: t.activo ? '' : 'inc-apagado', text: t.nombre }), h('div', { class: 'inc-tenue', text: t.rol }), t.sinPermiso ? h('span', { class: 'inc-chip inc-chip--alerta', title: 'Su rol no tiene el permiso de atender', text: 'Su rol no puede atender' }) : null),
          chips(t.especialidades, 'Cualquiera'), t.todasLasTiendas ? 'Todas las tiendas' : chips(t.tiendas, '—'), String(t.abiertas),
          interruptor({ activo: t.activo, etiqueta: `${t.nombre}: ${t.activo ? 'activo' : 'apagado'}`, alCambiar: async (nuevo) => {
            try { lista = (await api.actualizarTecnico(t.usuarioId, { activo: nuevo })).tecnicos; aviso('success', nuevo ? 'Técnico activado' : 'Técnico apagado', t.nombre); if (alCambiar) alCambiar(); setTimeout(dibujar, 0); } catch (error) { avisarError(error); throw error; }
          } }),
          botonEditar(() => formulario(t), 'Cobertura')] })),
        vacio: 'Todavía no hay técnicos. Agrega el primero con el botón de arriba.'
      }));
  }
  dibujar();
  return {};
}
