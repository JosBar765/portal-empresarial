// G5 · Aprobar activación: el gerente ve lo que el supervisor pide activar y la vista previa del reparto; al aprobar se reparte
// en ese momento y se avisa a los asesores; al rechazar, el proyecto vuelve a borrador con su comentario.
import { h, icono, montar } from '../utils/dom.js';
import { fechaCorta, pluralizar } from '../utils/formato.js';
import { cabecera, aviso, cargando, avisar, estadoVacio } from '../components/ui.js';
import { modalFormulario } from '../components/modalFormulario.js';
import { campoArea } from '../components/campos.js';
import { listarProyectos, obtenerProyecto, vistaPreviaProyecto, aprobarProyecto, rechazarProyecto } from '../api/api.js';

const nuevaClave = () => (crypto.randomUUID ? crypto.randomUUID() : `apr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
const fila = (titulo, valor) => h('div', { class: 'dato-fila' }, h('span', { class: 'dato-fila-titulo', text: titulo }), h('span', { class: 'dato-fila-valor', text: valor }));
const rango = (a, b) => (a && b ? `${fechaCorta(`${a} 00:00`).split(' · ')[0]} a ${fechaCorta(`${b} 00:00`).split(' · ')[0]}` : '—');

export async function renderAprobaciones(cont) {
  montar(cont, cargando());
  let cola = (await listarProyectos({ estado: 'aprobacion' })).items;
  let actual = cola[0] || null;
  let claveOperacion = nuevaClave();
  let ocupado = false;
  const zona = h('div');

  async function elegir(proyecto) {
    actual = proyecto;
    claveOperacion = nuevaClave();
    await dibujar();
  }

  async function dibujar() {
    if (!actual) {
      montar(zona, h('div', { class: 'panel' }, estadoVacio('No hay activaciones por aprobar', 'Cuando un supervisor pida activar un proyecto, aparecerá aquí.', 'checkmark-circle-outline')));
      return;
    }
    montar(zona, cargando());
    const [proyecto, previa] = await Promise.all([obtenerProyecto(actual.id), vistaPreviaProyecto(actual.id)]);
    const paises = new Set(proyecto.tiendas.map(t => t.pais));
    const activos = proyecto.participantes.filter(p => p.estado === 'activo').length;
    const excluidos = proyecto.participantes.length - activos;
    const porAsesor = previa.porAsesor.length ? Math.round(previa.asignadas / previa.porAsesor.length) : 0;
    montar(zona,
      h('div', { class: 'aprobacion-cuerpo' },
        h('section', { class: 'panel' },
          h('h2', { class: 'panel-titulo', text: 'Lo que se pide activar' }),
          fila('Nicho', `${proyecto.nicho} (${pluralizar(previa.totalEmpresas, 'empresa elegible', 'empresas elegibles')})`),
          fila('Alcance', `${pluralizar(proyecto.tiendas.length, 'tienda', 'tiendas')} · ${pluralizar(paises.size, 'país', 'países')}`),
          fila('Participantes', `${pluralizar(activos, 'asesor', 'asesores')} · ${pluralizar(excluidos, 'excluido', 'excluidos')}`),
          fila('Artículo', proyecto.articulo ? `${proyecto.articulo}${proyecto.existenciaMuestras !== null ? ` · ${proyecto.existenciaMuestras} unidades` : ''}` : 'Sin artículo'),
          fila('Meta', proyecto.metaMonto !== null ? `${proyecto.metaMonto.toLocaleString('es-GT')} ${proyecto.metaMoneda}` : 'Sin meta'),
          fila('Fechas', `${rango(proyecto.fechaInicio, proyecto.fechaFin)} (${pluralizar(proyecto.etapas.length, 'etapa', 'etapas')})`)),
        h('div', { class: 'aprobacion-lado' },
          h('section', { class: 'panel' },
            h('h2', { class: 'panel-titulo', text: 'Vista previa del reparto' }),
            h('div', { class: 'resumen-importacion' },
              h('div', { class: 'resumen-dato resumen-dato--nueva' }, h('strong', { text: String(previa.asignadas) }), h('span', { text: 'Se repartirán' })),
              h('div', { class: 'resumen-dato resumen-dato--duplicada' }, h('strong', { text: String(previa.sinAsesor) }), h('span', { text: 'Sin asesor' })),
              h('div', { class: 'resumen-dato' }, h('strong', { text: String(previa.reserva) }), h('span', { text: 'En reserva' }))),
            h('p', { class: 'panel-descripcion', text: `Diferencia máxima entre asesores: ${previa.diferenciaMaxima} · ${pluralizar(previa.porAsesor.length, 'asesor', 'asesores')} × ${porAsesor} empresas` })),
          aviso({ tipo: 'advertencia', titulo: 'Al aprobar se reparte ahora', texto: 'Se crean las participaciones y quedan asignadas a cada asesor. Si lo rechazas, vuelve a borrador con tu comentario.' }))),
      h('div', { class: 'formulario-acciones' },
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => rechazar(proyecto) }, 'Rechazar con comentario'),
        h('button', { class: `btn btn--primary${ocupado ? ' btn--loading' : ''}`, type: 'button', disabled: ocupado, onclick: () => aprobar(proyecto) }, icono('checkmark-outline'), 'Aprobar y repartir')));
  }

  async function aprobar(proyecto) {
    if (ocupado) return;
    ocupado = true;
    await dibujar();
    try {
      await aprobarProyecto(proyecto.id, claveOperacion);
      avisar('success', 'Proyecto activado', `«${proyecto.nombre}» ya está repartido entre los asesores.`);
      cola = cola.filter(p => p.id !== proyecto.id);
      actual = cola[0] || null;
      claveOperacion = nuevaClave();
    } catch (error) {
      avisar('error', 'No se pudo aprobar', error.message);
    }
    ocupado = false;
    await dibujar();
    dibujarCabecera();
  }

  function rechazar(proyecto) {
    const valores = { comentario: '' };
    const errores = {};
    const nodo = h('form', { class: 'formulario-modal', novalidate: '' });
    const dibujarForm = () => montar(nodo,
      h('p', { class: 'panel-descripcion', text: `«${proyecto.nombre}» vuelve a borrador y el supervisor verá tu comentario.` }),
      campoArea({ valores, errores, clave: 'comentario', etiqueta: 'Comentario para el supervisor *', maximo: 500, prefijoId: 'rechazo' }));
    dibujarForm();
    modalFormulario({
      title: 'Rechazar la activación', nodo, aceptar: 'Rechazar', peligro: true,
      enviar: async () => {
        await rechazarProyecto(proyecto.id, valores.comentario);
        avisar('success', 'Activación rechazada', 'El proyecto volvió a borrador con tu comentario.');
        cola = cola.filter(p => p.id !== proyecto.id);
        actual = cola[0] || null;
        claveOperacion = nuevaClave();
        await dibujar();
        dibujarCabecera();
      },
      alError: (error) => { if (error.campos) { Object.assign(errores, error.campos); dibujarForm(); } else avisar('error', 'No se pudo rechazar', error.message); }
    });
  }

  const zonaCabecera = h('div');
  function dibujarCabecera() {
    montar(zonaCabecera, cabecera({
      titulo: actual ? actual.nombre : 'Por aprobar',
      subtitulo: actual ? `Pedida por ${actual.creadoPor}${actual.asesores ? '' : ''} · ${cola.length > 1 ? `${cola.length} proyectos esperan tu aprobación` : 'Espera tu aprobación'}` : 'Activaciones que esperan tu aprobación.',
      acciones: cola.length > 1 ? (() => {
        const selector = h('select', { 'aria-label': 'Proyecto por aprobar' }, cola.map(p => h('option', { value: String(p.id), text: p.nombre })));
        selector.value = String(actual.id);
        selector.addEventListener('change', () => elegir(cola.find(p => p.id === Number(selector.value))).then(dibujarCabecera));
        return selector;
      })() : null
    }));
  }

  montar(cont, zonaCabecera, zona);
  dibujarCabecera();
  await dibujar();
}
