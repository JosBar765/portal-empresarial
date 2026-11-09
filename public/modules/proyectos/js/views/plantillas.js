// A4 · Plantillas de proyecto (y A4b, los permisos del supervisor): lista a la izquierda y editor con tres pestañas:
// General, Etapas y Permisos del supervisor. Nunca se borra una plantilla: se desactiva.
import { h, icono, montar } from '../utils/dom.js';
import { cabecera, aviso, cargando, interruptor, avisar, barraGuardado, estadoVacio } from '../components/ui.js';
import { registrarSalida } from '../components/salida.js';
import { confirmarModal } from '../components/modal.js';
import { campoTexto, campoLista, campoArea } from '../components/campos.js';
import { listarPlantillas, crearPlantilla, editarPlantilla, cambiarActivaPlantilla, listarCatalogo } from '../api/api.js';
import { pluralizar } from '../utils/formato.js';
import { validarTexto } from '../utils/validar.js';

const CONTROLES = [
  ['articulo', 'Artículo de muestra'], ['existencia', 'Existencia de muestras'], ['meta', 'Meta de venta'], ['tope', 'Tope de empresas por asesor'], ['fechas_etapas', 'Fechas de las etapas']
];
const MODOS = [['editable', 'Editable'], ['bloqueado', 'Bloqueado'], ['obligatorio', 'Obligatorio']];
const NUEVA = {
  id: null, nombre: '', descripcion: '', activa: true, predeterminada: false, articuloId: null, existenciaSugerida: null, topePorAsesor: null, metaMonto: null, metaMoneda: null,
  controles: {}, etapas: [{ nombre: 'Preparación', descripcion: '', duracionDiasHabiles: 5 }, { nombre: 'Contacto', descripcion: '', duracionDiasHabiles: 5 }, { nombre: 'Seguimiento', descripcion: '', duracionDiasHabiles: 5 }, { nombre: 'Cierre', descripcion: '', duracionDiasHabiles: 5 }]
};

const copia = (p) => JSON.parse(JSON.stringify(p));
const aBorrador = (p) => ({
  nombre: p.nombre, descripcion: p.descripcion || '', activa: p.activa, predeterminada: p.predeterminada, articuloId: p.articuloId, existenciaSugerida: p.existenciaSugerida === null ? '' : p.existenciaSugerida,
  topePorAsesor: p.topePorAsesor === null ? '' : p.topePorAsesor, metaMonto: p.metaMonto === null ? '' : p.metaMonto, metaMoneda: p.metaMoneda,
  controles: Object.fromEntries(CONTROLES.map(([c]) => [c, (p.controles || {})[c] || 'editable'])),
  etapas: p.etapas.map(e => ({ nombre: e.nombre, descripcion: e.descripcion || '', duracionDiasHabiles: e.duracionDiasHabiles }))
});
const totalDias = (b) => b.etapas.reduce((s, e) => s + (Number(e.duracionDiasHabiles) || 0), 0);
const semanas = (dias) => Math.max(1, Math.ceil(dias / 5));
const pestanaDeError = (k) => (k.startsWith('etapas') ? 'etapas' : (k.startsWith('controles') ? 'permisos' : 'general'));

export async function renderPlantillas(cont) {
  montar(cont, cargando());
  const [{ items }, { items: articulos }, { items: monedas }] = await Promise.all([listarPlantillas(), listarCatalogo('articulos'), listarCatalogo('monedas')]);
  let plantillas = items;
  let seleccion = plantillas.find(p => p.predeterminada) || plantillas[0] || NUEVA;
  let borrador = aBorrador(seleccion);
  let errores = {};
  let pestana = 'general';
  let ocupado = false;

  const zonaLista = h('div', { class: 'panel campos-lista' });
  const zonaEditor = h('div');
  const barra = barraGuardado({ alDescartar: () => { borrador = aBorrador(seleccion); errores = {}; dibujarEditor(); }, alGuardar: guardar });
  const cambios = () => {
    const base = aBorrador(seleccion);
    return Object.keys(base).filter(k => JSON.stringify(base[k]) !== JSON.stringify(borrador[k])).length;
  };
  registrarSalida(() => cambios() > 0);
  const actualizarBarra = () => barra.actualizar(cambios());

  // --- Lista ---

  function dibujarLista() {
    montar(zonaLista,
      h('div', { class: 'campos-grupo-titulo', text: pluralizar(plantillas.length, 'plantilla', 'plantillas') }),
      plantillas.map(p => h('button', { class: `campo-item campo-item--columna${seleccion.id === p.id ? ' campo-item--activo' : ''}${p.activa ? '' : ' campo-item--inactivo'}`, type: 'button', onclick: () => elegir(p) },
        h('span', { class: 'campo-item-fila' }, h('span', { class: 'campo-item-nombre', text: p.nombre }), p.predeterminada ? h('span', { class: 'chip-estado chip-estado--principal', text: 'Predeterminada' }) : null),
        h('span', { class: 'campo-item-fila' },
          h('span', { class: 'texto-tenue', text: `${pluralizar(p.etapas.length, 'etapa', 'etapas')} · ${pluralizar(p.duracionSemanas, 'semana', 'semanas')}` }),
          h('span', { class: `chip-estado ${p.activa ? 'chip-estado--activa' : ''}`, text: p.activa ? 'Activa' : 'Inactiva' })))),
      plantillas.length ? null : estadoVacio('Todavía no hay plantillas', 'Crea la primera con «Nueva plantilla».', 'document-text-outline'));
  }

  async function elegir(p) {
    if (cambios() > 0 && !(await confirmarModal({ title: 'Hay cambios sin guardar', mensaje: 'Si cambias de plantilla, se pierden. ¿Quieres seguir?', aceptar: 'Descartar cambios', cancelar: 'Seguir editando' }))) return;
    seleccion = p;
    borrador = aBorrador(p);
    errores = {};
    pestana = 'general';
    dibujarTodo();
  }

  // --- Pestañas del editor ---

  function pestanaGeneral() {
    const base = { valores: borrador, errores, prefijoId: 'plantilla', alCambiar: actualizarBarra };
    const interr = (titulo, ayuda, clave, bloqueado) => h('div', { class: 'ajuste-simple' },
      h('div', null, h('div', { class: 'ajuste-nombre', text: titulo }), h('div', { class: 'ajuste-ayuda', text: ayuda })),
      interruptor({ marcado: borrador[clave], deshabilitado: bloqueado, etiqueta: titulo, alCambiar: (v) => { borrador[clave] = v; actualizarBarra(); } }));
    return [
      h('div', { class: 'form-rejilla' },
        campoTexto({ ...base, clave: 'nombre', etiqueta: 'Nombre', obligatorio: true, maximo: 100, validar: (v) => validarTexto(v, { maximo: 100, obligatorio: true, mensajeObligatorio: 'Escribe el nombre de la plantilla.' }) }),
        campoLista({ ...base, clave: 'articuloId', etiqueta: 'Artículo de muestra', opciones: articulos.filter(a => a.activo).map(a => ({ id: a.id, nombre: a.nombre })), vacio: 'Sin artículo' }),
        campoTexto({ ...base, clave: 'existenciaSugerida', etiqueta: 'Existencia sugerida', maximo: 8, ayuda: 'Unidades para el proyecto.' }),
        campoTexto({ ...base, clave: 'topePorAsesor', etiqueta: 'Tope de empresas por asesor', maximo: 3, ayuda: 'Opcional. Lo que sobra queda en reserva.' }),
        campoTexto({ ...base, clave: 'metaMonto', etiqueta: 'Meta de venta', maximo: 14 }),
        campoLista({ ...base, clave: 'metaMoneda', etiqueta: 'Moneda de la meta', opciones: monedas.filter(m => m.activo).map(m => ({ id: m.codigo, nombre: `${m.codigo} · ${m.nombre}` })), vacio: 'Sin moneda', textoIds: true })),
      campoArea({ valores: borrador, errores, clave: 'descripcion', etiqueta: 'Descripción (opcional)', maximo: 255, prefijoId: 'plantilla' }),
      interr('Predeterminada', 'El asistente la ofrece primero al crear un proyecto.', 'predeterminada', seleccion.predeterminada),
      interr('Activa', 'Una plantilla inactiva ya no se ofrece, pero los proyectos que la usaron conservan su copia.', 'activa', seleccion.predeterminada)
    ];
  }

  function pestanaEtapas() {
    const mover = (i, d) => { const j = i + d; if (j < 0 || j >= borrador.etapas.length) return; [borrador.etapas[i], borrador.etapas[j]] = [borrador.etapas[j], borrador.etapas[i]]; dibujarEditor(); };
    const entrada = (valor, clave, i, ancho) => {
      const e = h('input', { type: 'text', value: valor, maxlength: clave === 'descripcion' ? 255 : (clave === 'nombre' ? 100 : 2), 'aria-label': clave, class: ancho });
      e.value = valor;
      e.addEventListener('input', () => { borrador.etapas[i][clave] = e.value; delete errores[`etapas.${i}.${clave === 'duracionDiasHabiles' ? 'duracionDiasHabiles' : clave}`]; actualizarBarra(); if (clave === 'duracionDiasHabiles') resumenDuracion(); });
      return e;
    };
    const resumen = h('strong');
    const resumenDuracion = () => { resumen.textContent = `Duración total: ${totalDias(borrador)} días hábiles (${pluralizar(semanas(totalDias(borrador)), 'semana', 'semanas')})`; };
    resumenDuracion();
    return [
      errores.etapas ? aviso({ tipo: 'error', titulo: errores.etapas }) : null,
      h('div', { class: 'tabla-caja' }, h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table' },
        h('thead', null, h('tr', null, ['', 'Etapa', 'Qué se espera', 'Días hábiles', ''].map(t => h('th', { text: t })))),
        h('tbody', null, borrador.etapas.map((e, i) => h('tr', null,
          h('td', null, h('div', { class: 'mover' },
            h('button', { class: 'boton-icono', type: 'button', 'aria-label': 'Subir', onclick: () => mover(i, -1), disabled: i === 0 }, icono('chevron-up-outline')),
            h('button', { class: 'boton-icono', type: 'button', 'aria-label': 'Bajar', onclick: () => mover(i, 1), disabled: i === borrador.etapas.length - 1 }, icono('chevron-down-outline')))),
          h('td', null, entrada(e.nombre, 'nombre', i, 'entrada-tabla'), errores[`etapas.${i}.nombre`] ? h('div', { class: 'campo-error', text: errores[`etapas.${i}.nombre`] }) : null),
          h('td', null, entrada(e.descripcion, 'descripcion', i, 'entrada-tabla')),
          h('td', null, entrada(e.duracionDiasHabiles, 'duracionDiasHabiles', i, 'entrada-tabla entrada-corta'), errores[`etapas.${i}.duracionDiasHabiles`] ? h('div', { class: 'campo-error', text: errores[`etapas.${i}.duracionDiasHabiles`] }) : null),
          h('td', null, h('button', { class: 'boton-icono', type: 'button', 'aria-label': `Quitar ${e.nombre}`, disabled: borrador.etapas.length === 1, onclick: () => { borrador.etapas.splice(i, 1); actualizarBarra(); dibujarEditor(); } }, icono('trash-outline'))))))))),
      h('div', { class: 'filas-acciones' },
        h('button', { class: 'btn btn--ghost', type: 'button', disabled: borrador.etapas.length >= 12, onclick: () => { borrador.etapas.push({ nombre: '', descripcion: '', duracionDiasHabiles: 5 }); actualizarBarra(); dibujarEditor(); } }, icono('add-outline'), 'Agregar etapa'),
        resumen),
      aviso({ titulo: 'Las etapas orientan, no bloquean', texto: 'Sirven para el semáforo y para decir «vas atrasado respecto a la etapa». El asesor puede registrar en cualquier etapa.' })
    ];
  }

  function pestanaPermisos() {
    const valorDe = {
      articulo: (articulos.find(a => a.id === borrador.articuloId) || {}).nombre || 'Sin artículo', existencia: borrador.existenciaSugerida === '' ? '—' : `${borrador.existenciaSugerida} unidades`,
      meta: borrador.metaMonto === '' ? '—' : `${borrador.metaMonto} ${borrador.metaMoneda || ''}`, tope: borrador.topePorAsesor === '' ? '—' : String(borrador.topePorAsesor), fechas_etapas: 'Según el calendario laboral'
    };
    return [
      h('div', { class: 'tabla-caja' }, h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table' },
        h('thead', null, h('tr', null, ['Campo', 'Valor de la plantilla', 'El supervisor puede…'].map(t => h('th', { text: t })))),
        h('tbody', null, CONTROLES.map(([clave, etiqueta]) => h('tr', null,
          h('td', { class: 'cambio-ajuste', text: etiqueta }),
          h('td', null, borrador.controles[clave] === 'bloqueado' ? icono('lock-closed-outline') : null, ` ${valorDe[clave]}`),
          h('td', null, h('div', { class: 'segmentos', role: 'group', 'aria-label': etiqueta }, MODOS.map(([modo, texto]) => h('button', {
            class: `segmento${borrador.controles[clave] === modo ? ' segmento--activo' : ''}`, type: 'button',
            onclick: () => { borrador.controles[clave] = modo; delete errores[`controles.${clave}`]; actualizarBarra(); dibujarEditor(); }
          }, texto))), errores[`controles.${clave}`] ? h('div', { class: 'campo-error', text: errores[`controles.${clave}`] }) : null))))))),
      aviso({ titulo: 'Bloqueado y obligatorio', texto: 'Bloqueado: el supervisor ve el valor con un candado y no puede cambiarlo. Obligatorio: debe completarlo antes de activar. Las tiendas del alcance siempre las elige el supervisor.' })
    ];
  }

  function dibujarEditor() {
    const nuevo = seleccion.id === null;
    const cuenta = (n) => h('span', { class: 'pestana-cuenta', text: String(n) });
    const botonPestana = (id, titulo, n) => h('button', { class: `pestana${pestana === id ? ' pestana-activa' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(pestana === id), onclick: () => { pestana = id; dibujarEditor(); } }, titulo, n === undefined ? null : cuenta(n));
    montar(zonaEditor, h('section', { class: 'panel formulario-campo' },
      h('div', { class: 'form-seccion-titulo-fila' }, h('h2', { class: 'panel-titulo', text: nuevo ? 'Nueva plantilla' : seleccion.nombre }), seleccion.predeterminada ? h('span', { class: 'chip-estado chip-estado--principal', text: 'Predeterminada' }) : null),
      h('div', { class: 'pestanas', role: 'tablist' }, botonPestana('general', 'General'), botonPestana('etapas', 'Etapas', borrador.etapas.length), botonPestana('permisos', 'Permisos del supervisor', CONTROLES.length)),
      pestana === 'general' ? pestanaGeneral() : (pestana === 'etapas' ? pestanaEtapas() : pestanaPermisos()),
      barra.nodo));
    actualizarBarra();
  }

  async function guardar() {
    if (ocupado) return;
    ocupado = true;
    barra.ocupado(true);
    const envio = {
      ...borrador, articuloId: borrador.articuloId || null, existenciaSugerida: borrador.existenciaSugerida === '' ? null : borrador.existenciaSugerida,
      topePorAsesor: borrador.topePorAsesor === '' ? null : borrador.topePorAsesor, metaMonto: borrador.metaMonto === '' ? null : borrador.metaMonto, metaMoneda: borrador.metaMoneda || null
    };
    try {
      const { item } = seleccion.id === null ? await crearPlantilla(envio) : await editarPlantilla(seleccion.id, envio);
      plantillas = (await listarPlantillas()).items;
      seleccion = plantillas.find(p => p.id === item.id) || item;
      borrador = aBorrador(seleccion);
      errores = {};
      avisar('success', 'Plantilla guardada', `«${seleccion.nombre}» ya se ofrece al crear proyectos.`);
    } catch (error) {
      errores = error.campos || {};
      const primera = Object.keys(errores)[0];
      if (primera) pestana = pestanaDeError(primera);
      avisar(error.campos ? 'warning' : 'error', error.campos ? 'Revisa los datos marcados' : 'No se pudo guardar', error.campos ? 'Hay un dato que corregir.' : error.message);
    } finally {
      ocupado = false;
    }
    dibujarTodo();
  }

  function dibujarTodo() { dibujarLista(); dibujarEditor(); }

  montar(cont,
    cabecera({
      titulo: 'Plantillas de proyecto', subtitulo: 'Define duración, etapas y qué puede cambiar el supervisor.',
      acciones: h('button', { class: 'btn btn--primary', type: 'button', onclick: () => elegir(copia(NUEVA)) }, icono('add-outline'), 'Nueva plantilla')
    }),
    h('div', { class: 'campos-cuerpo' }, zonaLista, zonaEditor));
  dibujarTodo();
}
