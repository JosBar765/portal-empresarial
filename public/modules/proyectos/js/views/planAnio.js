// A2 · Plan del año: qué nicho, artículo y plantilla toca cada mes (para toda la región) y la activación automática del proyecto del mes.
// Ruta: #/plan. Un mes ya activo, en aprobación o cerrado no se puede cambiar; un mes sin plan no se activa solo.
import { h, icono, montar } from '../utils/dom.js';
import { cabecera, cargando, interruptor, avisar, aviso } from '../components/ui.js';
import { modalFormulario } from '../components/modalFormulario.js';
import { confirmarModal } from '../components/modal.js';
import { obtenerPlan, guardarPlanMes, quitarPlanMes, listarCatalogo, listarPlantillas, guardarAutomatizacion } from '../api/api.js';

const ESTADOS = {
  activo: ['Activo', 'activa'], pendiente_aprobacion: ['Esperando aprobación', 'pendiente'], borrador: ['Borrador', 'inactiva'], cerrado: ['Cerrado', 'cerrado'],
  planificado: ['Planificado', 'inactiva'], sin_plan: ['Sin plan', '']
};
const DIAS_ACTIVACION = [[0, 'Primer día hábil del mes'], ...Array.from({ length: 28 }, (_, i) => [i + 1, `Día ${i + 1} del mes`])];
const mayuscula = (t) => `${t.charAt(0).toUpperCase()}${t.slice(1)}`;

export async function renderPlanAnio(cont, parametro) {
  montar(cont, cargando());
  let anio = Number(parametro) || new Date().getFullYear();
  const [nichos, articulos, plantillasRes] = await Promise.all([listarCatalogo('nichos'), listarCatalogo('articulos'), listarPlantillas()]);
  const nichosActivos = nichos.items.filter(n => n.activo);
  const articulosActivos = articulos.items.filter(a => a.activo);
  const plantillas = plantillasRes.items.filter(p => p.activa);

  const zona = h('div');
  let datos = null;

  async function cargar() {
    montar(zona, cargando());
    try { datos = await obtenerPlan(anio); } catch (error) { avisar('error', 'No se pudo cargar el plan', error.message); return; }
    dibujar();
  }

  // --- Activación automática ---

  async function cambiarAjuste(clave, valor) {
    try {
      await guardarAutomatizacion({ [clave]: valor });
      datos = await obtenerPlan(anio);
      avisar('success', 'Guardado', clave === 'activacion_auto.activa' ? (valor ? 'La activación automática quedó encendida.' : 'La activación automática quedó apagada.') : 'El ajuste quedó guardado.');
    } catch (error) {
      avisar(error.campos ? 'warning' : 'error', 'No se pudo guardar', (error.campos && Object.values(error.campos)[0]) || error.message);
      datos = await obtenerPlan(anio);
    }
    dibujar();
  }

  function panelAutomatico() {
    const a = datos.automatizacion;
    const dia = h('select', { 'aria-label': 'Día de la activación', disabled: a.activa ? null : '' }, DIAS_ACTIVACION.map(([v, t]) => h('option', { value: String(v), text: t })));
    dia.value = String(a.dia);
    dia.addEventListener('change', () => cambiarAjuste('activacion_auto.dia', Number(dia.value)));
    const hora = h('input', { type: 'time', 'aria-label': 'Hora de la activación', value: a.hora, disabled: a.activa ? null : '' });
    hora.addEventListener('change', () => { if (hora.value) cambiarAjuste('activacion_auto.hora', hora.value); });
    let linea;
    if (!a.activa) linea = h('p', { class: 'texto-tenue', text: 'Apagada: los proyectos se crean y se activan a mano.' });
    else if (!a.proxima) linea = h('p', { class: 'texto-tenue', text: 'No hay una próxima activación a la vista.' });
    else {
      const p = a.proxima;
      linea = aviso({
        tipo: p.plan ? 'info' : 'advertencia',
        titulo: `Próxima activación: ${p.fechaTexto}, ${p.hora}`,
        texto: p.plan ? `Se activará ${p.mesNombre} con el plan: ${p.plan.nicho}.` : `${mayuscula(p.mesNombre)} no tiene plan: no se creará ningún proyecto y se avisará a los administradores.`
      });
    }
    return h('section', { class: 'panel plan-automatico' },
      h('div', { class: 'ajuste-simple' },
        h('div', null, h('div', { class: 'ajuste-nombre', text: 'Activación automática' }), h('div', { class: 'ajuste-ayuda', text: 'El sistema crea y activa el proyecto del plan en el día y la hora elegidos, con todas las tiendas libres que tienen asesores.' })),
        interruptor({ marcado: a.activa, etiqueta: 'Activación automática', alCambiar: (v) => cambiarAjuste('activacion_auto.activa', v) })),
      h('div', { class: 'plan-controles' },
        h('div', { class: 'campo' }, h('label', { text: 'Día de la activación' }), dia),
        h('div', { class: 'campo' }, h('label', { text: 'Hora (Guatemala)' }), hora)),
      linea);
  }

  // --- Planificar un mes ---

  function abrirMes(m) {
    const valores = { nichoId: m.plan ? m.plan.nichoId : '', articuloId: m.plan && m.plan.articuloId ? m.plan.articuloId : '', plantillaId: m.plan && m.plan.plantillaId ? m.plan.plantillaId : '' };
    const errores = {};
    const nodo = h('form', { class: 'formulario-modal', novalidate: '' });
    const lista = (clave, etiqueta, opciones, vacio) => {
      const control = h('select', { 'aria-label': etiqueta }, h('option', { value: '', text: vacio }), opciones.map(o => h('option', { value: String(o.id), text: o.nombre })));
      control.value = String(valores[clave]);
      control.addEventListener('change', () => { valores[clave] = control.value === '' ? '' : Number(control.value); delete errores[clave]; });
      return h('div', { class: `campo${errores[clave] ? ' campo--error' : ''}` }, h('label', { text: etiqueta }), control, errores[clave] ? h('span', { class: 'campo-error', text: errores[clave] }) : null);
    };
    const dibujarForm = () => montar(nodo,
      h('p', { class: 'hoja-subtitulo', text: 'Elige el nicho y el artículo del mes. El nicho se sugiere al crear el proyecto y la activación automática lo usa.' }),
      lista('nichoId', 'Nicho', nichosActivos, 'Elige un nicho'),
      lista('articuloId', 'Artículo de muestra', articulosActivos, 'Sin artículo (lo fija la plantilla)'),
      lista('plantillaId', 'Plantilla de proyecto', plantillas, 'La predeterminada'),
      h('p', { class: 'texto-tenue texto-tenue--chico', text: 'Un mes sin plan queda «Sin plan»: no se activa solo. Un mes ya activo o cerrado no se puede cambiar.' }),
      m.plan ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: quitar }, icono('trash-outline'), 'Quitar del plan') : null);
    async function quitar() {
      if (!(await confirmarModal({ title: `Quitar ${m.nombre} del plan`, mensaje: 'El mes volverá a «Sin plan» y no se activará solo. Los proyectos ya creados no cambian.', aceptar: 'Quitar del plan', cancelar: 'Conservar' }))) return;
      try { datos = await quitarPlanMes(anio, m.mes); cerrarModal(); avisar('success', 'Mes quitado del plan', mayuscula(m.nombre)); dibujar(); } catch (error) { avisar('error', 'No se pudo quitar', error.message); }
    }
    dibujarForm();
    const { cerrar } = modalFormulario({
      title: `${m.plan ? 'Plan de' : 'Planificar'} ${m.nombre} ${anio}`, nodo, aceptar: 'Guardar plan',
      enviar: async () => {
        if (!valores.nichoId) { errores.nichoId = 'Elige un nicho.'; dibujarForm(); throw Object.assign(new Error('Revisa los datos.'), { campos: { nichoId: errores.nichoId } }); }
        try {
          datos = await guardarPlanMes(anio, m.mes, { nichoId: valores.nichoId, articuloId: valores.articuloId || null, plantillaId: valores.plantillaId || null });
        } catch (error) {
          if (error.campos) { Object.assign(errores, error.campos); dibujarForm(); }
          throw error;
        }
        avisar('success', 'Plan guardado', `${mayuscula(m.nombre)} ${anio} queda planificado.`);
        dibujar();
      }
    });
    cerrarModal = cerrar;
  }
  let cerrarModal = () => {};

  function tarjetaMes(m) {
    const [etiqueta, clase] = ESTADOS[m.estado] || ESTADOS.sin_plan;
    if (!m.plan) {
      return h('div', { class: 'plan-mes plan-mes--vacio' },
        h('div', { class: 'plan-mes-fila' }, h('strong', { text: mayuscula(m.nombre) }), h('span', { class: 'texto-tenue', text: etiqueta })),
        h('p', { class: 'texto-tenue', text: 'Elige un nicho y un artículo' }),
        m.editable ? h('button', { class: 'btn btn--ghost btn--chico', type: 'button', onclick: () => abrirMes(m) }, icono('add-outline'), 'Planificar') : null);
    }
    return h(m.editable ? 'button' : 'div', { class: `plan-mes${m.estado === 'activo' ? ' plan-mes--activo' : ''}${m.editable ? ' plan-mes--editable' : ''}`, type: m.editable ? 'button' : null, onclick: m.editable ? () => abrirMes(m) : null },
      h('div', { class: 'plan-mes-fila' }, h('strong', { text: mayuscula(m.nombre) }), h('span', { class: `chip-estado${clase ? ` chip-estado--${clase}` : ''}`, text: etiqueta })),
      h('div', { class: 'plan-mes-nicho', text: m.plan.nicho }),
      h('div', { class: 'texto-tenue texto-tenue--chico' }, icono('gift-outline'), ` Artículo: ${m.plan.articulo || 'el de la plantilla'}`),
      m.proyecto ? h('a', { class: 'plan-mes-enlace', href: `#/proyectos/${m.proyecto.id}`, onclick: (e) => e.stopPropagation() }, 'Ver proyecto') : null);
  }

  function dibujar() {
    montar(zona, panelAutomatico(), h('div', { class: 'plan-meses' }, datos.meses.map(tarjetaMes)));
  }

  montar(cont,
    cabecera({
      titulo: `Plan del año ${anio}`,
      subtitulo: 'Qué nicho y artículo toca cada mes. El sistema sugiere el nicho del plan y puede activar el proyecto solo.',
      acciones: h('div', { class: 'acciones-cabecera' },
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { anio -= 1; location.hash = `#/plan/${anio}`; } }, icono('chevron-back-outline'), `Año ${anio - 1}`),
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { anio += 1; location.hash = `#/plan/${anio}`; } }, `Año ${anio + 1}`, icono('chevron-forward-outline')))
    }),
    zona);
  await cargar();
}
