// A5 · Reglas y aprobaciones: los interruptores del flujo y, país por país, la referencia y la confirmación de ventas.
import { h, icono, montar } from '../utils/dom.js';
import { pluralizar } from '../utils/formato.js';
import { cabecera, aviso, cargando, interruptor, barraGuardado, avisar } from '../components/ui.js';
import { listarReglas, guardarReglas, listarPaises, guardarPais, obtenerAprobadores, guardarAprobadores } from '../api/api.js';
import { registrarSalida } from '../components/salida.js';
import { iconoAyuda } from '../components/ayuda.js';

const OPCIONES_CONFIRMACION = [['heredar', 'Heredar'], ['si', 'Sí'], ['no', 'No']];
const aTexto = (valor) => (valor === null ? 'heredar' : (valor ? 'si' : 'no'));
const deTexto = (texto) => (texto === 'heredar' ? null : texto === 'si');

export async function renderReglas(cont) {
  montar(cont, cargando());
  let reglas = (await listarReglas()).grupos.flatMap(g => g.parametros);
  let paises = (await listarPaises()).paises;
  let aprobadores = await obtenerAprobadores();
  const panelAprobadores = h('section', { class: 'panel' });
  let borradorReglas = {};
  let borradorPaises = {};

  const barra = barraGuardado({ alDescartar: descartar, alGuardar: guardar });
  const panelReglas = h('section', { class: 'panel' });
  const panelPaises = h('section', { class: 'panel' });

  const cantidad = () => Object.keys(borradorReglas).length + Object.values(borradorPaises).reduce((suma, c) => suma + Object.keys(c).length, 0);

  function editarRegla(regla, valor) {
    if (valor === regla.valor) delete borradorReglas[regla.clave]; else borradorReglas[regla.clave] = valor;
    dibujarAprobadores();
    barra.actualizar(cantidad());
  }

  function editarPais(pais, campo, valor) {
    const guardado = pais[campo];
    const cambios = borradorPaises[pais.paisId] || {};
    if (valor === guardado) delete cambios[campo]; else cambios[campo] = valor;
    if (Object.keys(cambios).length) borradorPaises[pais.paisId] = cambios; else delete borradorPaises[pais.paisId];
    barra.actualizar(cantidad());
  }

  function dibujarReglas() {
    montar(panelReglas,
      h('h2', { class: 'panel-titulo', text: 'Aprobaciones del flujo' }),
      h('p', { class: 'panel-descripcion', text: 'Enciende o apaga cada paso. Quién aprueba se elige más abajo, por persona.' }),
      reglas.map(regla => h('div', { class: 'regla' },
        interruptor({ marcado: regla.clave in borradorReglas ? borradorReglas[regla.clave] : regla.valor, etiqueta: regla.etiqueta, alCambiar: (v) => editarRegla(regla, v) }),
        h('div', { class: 'regla-cuerpo' },
          h('div', { class: 'regla-nombre' }, regla.etiqueta, iconoAyuda(`parametros.${regla.clave}`)),
          h('div', { class: 'regla-texto', text: regla.ayuda }),
          regla.nota ? h('div', { class: 'regla-nota' }, icono('information-circle-outline'), regla.nota) : null,
          regla.permiso ? h('div', { class: 'regla-nota' }, icono('lock-closed-outline'), `Permiso: ${regla.permiso}`) : null))));
  }

  // Quién aprueba la activación y quién da el visto bueno: se elige por persona y se guarda al momento.
  const PASOS = [
    { clave: 'activacion', regla: 'reglas.aprobar_activacion', titulo: 'Quién aprueba la activación', texto: 'Reciben el aviso, ven «Por aprobar» y deciden si el proyecto se activa.' },
    { clave: 'vistoBueno', regla: 'reglas.visto_bueno_cierre', titulo: 'Quién da el visto bueno', texto: 'Reciben el aviso del cierre, ven «Por dar visto bueno» y lo aprueban o lo devuelven.' }
  ];
  const reglaEncendida = (clave) => { const r = reglas.find(x => x.clave === clave); return r ? (clave in borradorReglas ? borradorReglas[clave] : r.valor) : false; };

  async function cambiarAprobadores(paso, ids) {
    try {
      aprobadores = await guardarAprobadores({ [paso]: ids });
      avisar('success', 'Guardado', 'La lista quedó actualizada.');
    } catch (error) { avisar(error.campos ? 'warning' : 'error', 'No se pudo guardar', (error.campos && Object.values(error.campos)[0]) || error.message); }
    dibujarAprobadores();
  }

  function bloqueAprobadores(paso) {
    const personas = aprobadores[paso.clave];
    const libres = aprobadores.candidatos.filter(c => !personas.some(p => p.id === c.id));
    const elegir = h('select', { class: 'control-select', 'aria-label': `Agregar a ${paso.titulo.toLowerCase()}` },
      h('option', { value: '', text: 'Agregar persona…' }), libres.map(c => h('option', { value: c.id, text: `${c.nombre} · ${c.rol || 'Sin rol'}` })));
    elegir.addEventListener('change', () => { if (elegir.value) cambiarAprobadores(paso.clave, [...personas.map(p => p.id), Number(elegir.value)]); });
    const sinNadie = !personas.length && reglaEncendida(paso.regla);
    return h('div', { class: 'aprobadores-paso' },
      h('div', { class: 'regla-nombre', text: paso.titulo }),
      h('div', { class: 'regla-texto', text: paso.texto }),
      h('div', { class: 'aprobadores-chips' }, personas.length
        ? personas.map(p => h('span', { class: 'chip-persona' }, p.nombre,
          h('button', { class: 'chip-quitar', type: 'button', 'aria-label': `Quitar a ${p.nombre}`, onclick: () => cambiarAprobadores(paso.clave, personas.filter(x => x.id !== p.id).map(x => x.id)) }, icono('close-outline'))))
        : h('span', { class: 'regla-nota', text: 'Nadie asignado todavía.' })),
      sinNadie ? aviso({ tipo: 'advertencia', titulo: 'Nadie puede aprobar', texto: 'Este paso está encendido y no hay nadie asignado: los proyectos quedarían esperando. Asigna a alguien.' }) : null,
      libres.length ? elegir : null);
  }

  function dibujarAprobadores() {
    montar(panelAprobadores,
      h('h2', { class: 'panel-titulo', text: 'Quién aprueba' }),
      h('p', { class: 'panel-descripcion', text: 'Elige a las personas, una por una. Puede ser cualquiera con acceso a Proyectos; los cambios se guardan al momento y quedan en el Historial.' }),
      PASOS.map(bloqueAprobadores));
  }

  function filaPais(pais) {
    const referencia = interruptor({
      marcado: pais.referenciaObligatoria, etiqueta: `Referencia obligatoria en ${pais.nombre}`,
      alCambiar: (v) => editarPais(pais, 'referenciaObligatoria', v)
    });
    const confirmacion = h('select', { class: 'control-select', 'aria-label': `Confirmación de ventas en ${pais.nombre}` },
      OPCIONES_CONFIRMACION.map(([valor, texto]) => h('option', { value: valor, text: texto })));
    confirmacion.value = aTexto(pais.confirmacionVentas);
    confirmacion.addEventListener('change', () => editarPais(pais, 'confirmacionVentas', deTexto(confirmacion.value)));
    return h('tr', null,
      h('td', null, h('strong', { text: pais.nombre })),
      h('td', { text: pais.monedaCodigo || '—' }),
      h('td', null, referencia),
      h('td', null, confirmacion));
  }

  function dibujarPaises() {
    montar(panelPaises,
      h('h2', { class: 'panel-titulo', text: 'Por país' }),
      h('p', { class: 'panel-descripcion', text: 'Referencia obligatoria y confirmación de ventas, país por país.' }),
      h('div', { class: 'tabla-caja' }, h('div', { class: 'tabla-scroll' },
        h('table', { class: 'data-table' },
          h('thead', null, h('tr', null, [['País'], ['Moneda'], ['Referencia', 'reglas.referencia_pais'], ['Confirmación', 'reglas.confirmacion_pais']].map(([t, clave]) => h('th', null, t, clave ? iconoAyuda(clave) : null)))),
          h('tbody', null, paises.map(filaPais))))),
      h('div', { class: 'separado' }, aviso({
        titulo: 'Cambiar una regla aplica a proyectos nuevos',
        texto: 'La referencia obligatoria se aplica a las cotizaciones y ventas que se registren desde ahora.'
      })),
      barra.nodo);
  }

  function dibujar() {
    dibujarReglas();
    dibujarAprobadores();
    dibujarPaises();
    barra.actualizar(cantidad());
  }

  function descartar() {
    borradorReglas = {};
    borradorPaises = {};
    dibujar();
  }

  async function guardar() {
    barra.ocupado(true);
    try {
      if (Object.keys(borradorReglas).length) await guardarReglas(borradorReglas);
      for (const [paisId, cambios] of Object.entries(borradorPaises)) await guardarPais(paisId, cambios);
      avisar('success', 'Cambios guardados', `${pluralizar(cantidad(), 'ajuste actualizado', 'ajustes actualizados')}. Aplican a los proyectos nuevos.`);
      borradorReglas = {};
      borradorPaises = {};
    } catch (error) {
      avisar('error', 'No se pudo guardar', error.message);
    }
    // Se vuelve a leer siempre: si algo se guardó antes del error, la pantalla debe mostrarlo.
    try {
      reglas = (await listarReglas()).grupos.flatMap(g => g.parametros);
      paises = (await listarPaises()).paises;
    } catch (error) {
      avisar('error', 'No se pudo actualizar la pantalla', error.message);
    }
    dibujar();
    barra.ocupado(false);
    barra.actualizar(cantidad());
  }

  registrarSalida(() => cantidad() > 0);
  montar(cont,
    cabecera({ ayuda: 'reglas', titulo: 'Reglas y aprobaciones', subtitulo: 'Enciende o apaga pasos del flujo. Por defecto, el flujo ya aprobado.' }),
    h('div', { class: 'reglas-cuerpo' }, panelReglas, panelAprobadores, panelPaises));
  dibujar();
}
