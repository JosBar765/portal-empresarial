// A6 · Campos propios de la empresa: lista por nicho a la izquierda y editor a la derecha.
// La clave se genera de la etiqueta y, como el tipo, no cambia después de crear el campo.
import { h, icono, montar } from '../utils/dom.js';
import { cabecera, cargando, interruptor, avisar, estadoVacio, barraGuardado } from '../components/ui.js';
import { registrarSalida } from '../components/salida.js';
import { confirmarModal } from '../components/modal.js';
import { campoTexto, campoLista } from '../components/campos.js';
import { listarCampos, crearCampo, editarCampo, cambiarActivoCampo, listarCatalogo } from '../api/api.js';

const TIPOS = [['texto', 'Texto'], ['numero', 'Número'], ['lista', 'Lista'], ['si_no', 'Sí/No'], ['fecha', 'Fecha']];
const NOMBRE_TIPO = Object.fromEntries(TIPOS);
const TODOS = 'Todos los nichos';
const NUEVO = { id: null, etiqueta: '', nichoId: null, tipo: 'texto', opciones: [], obligatorio: false, visibleEnLista: false, activo: true };

const aBorrador = (campo) => ({
  etiqueta: campo.etiqueta, nichoId: campo.nichoId, tipo: campo.tipo, opcionesTexto: campo.opciones.join('\n'),
  obligatorio: campo.obligatorio, visibleEnLista: campo.visibleEnLista
});

export async function renderCampos(cont) {
  montar(cont, cargando());
  const [{ items }, { items: nichos }] = await Promise.all([listarCampos(), listarCatalogo('nichos')]);
  let campos = items;
  let seleccion = campos[0] || NUEVO;
  let borrador = aBorrador(seleccion);
  let errores = {};
  let ocupado = false;

  const zonaLista = h('div', { class: 'panel campos-lista' });
  const zonaEditor = h('div');
  const barra = barraGuardado({ alDescartar: () => { borrador = aBorrador(seleccion); errores = {}; dibujarEditor(); }, alGuardar: guardar });
  const cambios = () => {
    const base = aBorrador(seleccion);
    return Object.keys(base).filter(k => JSON.stringify(base[k]) !== JSON.stringify(borrador[k])).length;
  };
  registrarSalida(() => cambios() > 0);

  // --- Lista por nicho ---

  function dibujarLista() {
    const grupos = new Map();
    campos.forEach(c => { const g = c.nichoId === null ? TODOS : c.nicho; if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push(c); });
    const orden = [...grupos.keys()].sort((a, b) => (a === TODOS ? -1 : b === TODOS ? 1 : a.localeCompare(b, 'es')));
    montar(zonaLista,
      orden.map(g => h('div', { class: 'campos-grupo' },
        h('div', { class: 'campos-grupo-titulo', text: g }),
        grupos.get(g).map(c => h('button', { class: `campo-item${seleccion.id === c.id ? ' campo-item--activo' : ''}${c.activo ? '' : ' campo-item--inactivo'}`, type: 'button', onclick: () => elegir(c) },
          h('span', { class: 'campo-item-nombre', text: c.etiqueta }),
          h('span', { class: 'campo-item-etiquetas' },
            c.obligatorio ? h('span', { class: 'chip-estado chip-estado--inactiva', text: 'Obligatorio' }) : null,
            h('span', { class: 'chip-estado', text: NOMBRE_TIPO[c.tipo] }),
            c.activo ? null : h('span', { class: 'chip-estado chip-estado--no_contactar', text: 'Inactivo' })))))),
      campos.length ? null : estadoVacio('Todavía no hay campos', 'Crea el primero con «Nuevo campo».', 'create-outline'));
  }

  async function elegir(campo) {
    if (cambios() > 0 && !(await confirmarModal({ title: 'Hay cambios sin guardar', mensaje: 'Si cambias de campo, se pierden. ¿Quieres seguir?', aceptar: 'Descartar cambios', cancelar: 'Seguir editando' }))) return;
    seleccion = campo;
    borrador = aBorrador(campo);
    errores = {};
    dibujarTodo();
  }

  // --- Editor ---

  function vistaPrevia() {
    const etiqueta = borrador.etiqueta.trim() || 'Etiqueta del campo';
    const opciones = borrador.opcionesTexto.split('\n').map(o => o.trim()).filter(Boolean);
    let control;
    if (borrador.tipo === 'lista') control = h('select', { disabled: '' }, h('option', { text: 'Elige…' }), opciones.map(o => h('option', { text: o })));
    else if (borrador.tipo === 'si_no') control = h('div', { class: 'campo-fila vista-previa-si-no' }, h('span', { text: 'Sí / No' }), interruptor({ marcado: false, deshabilitado: true, etiqueta }));
    else control = h('input', { type: borrador.tipo === 'fecha' ? 'date' : 'text', disabled: '', placeholder: borrador.tipo === 'numero' ? '0' : '' });
    return h('div', { class: 'vista-previa' },
      h('div', { class: 'vista-previa-titulo', text: 'Así se verá en el formulario de la empresa' }),
      h('div', { class: 'campo' }, h('label', null, etiqueta, borrador.obligatorio ? h('span', { class: 'campo-obligatorio', text: ' *' }) : null), control));
  }

  function fila(titulo, ayuda, valor, alCambiar) {
    return h('div', { class: 'ajuste-simple' },
      h('div', null, h('div', { class: 'ajuste-nombre', text: titulo }), h('div', { class: 'ajuste-ayuda', text: ayuda })),
      interruptor({ marcado: valor, etiqueta: titulo, alCambiar }));
  }

  function dibujarEditor() {
    const nuevo = seleccion.id === null;
    const base = { valores: borrador, errores };
    const tipos = h('div', { class: 'segmentos', role: 'group', 'aria-label': 'Tipo de dato' }, TIPOS.map(([valor, texto]) => h('button', {
      class: `segmento${borrador.tipo === valor ? ' segmento--activo' : ''}`, type: 'button', disabled: !nuevo && borrador.tipo !== valor,
      onclick: () => { if (!nuevo) return; borrador.tipo = valor; delete errores.tipo; dibujarEditor(); }
    }, texto)));
    const opciones = borrador.tipo === 'lista' ? h('div', { class: `campo${errores.opciones ? ' campo--error' : ''}` },
      h('label', { for: 'campo-opciones' }, 'Opciones', h('span', { class: 'campo-obligatorio', text: ' *' })),
      (() => { const t = h('textarea', { id: 'campo-opciones', rows: 5, placeholder: 'Una opción por línea' }); t.value = borrador.opcionesTexto; t.addEventListener('input', () => { borrador.opcionesTexto = t.value; delete errores.opciones; actualizarBarra(); vistaZona(); }); return t; })(),
      errores.opciones ? h('span', { class: 'campo-error', text: errores.opciones }) : h('span', { class: 'campo-ayuda', text: 'Una opción por línea; mínimo dos.' })) : null;
    const zonaVista = h('div');
    const vistaZona = () => montar(zonaVista, vistaPrevia());
    vistaZona();

    const etiqueta = campoTexto({ ...base, clave: 'etiqueta', etiqueta: 'Etiqueta', maximo: 100, obligatorio: true, prefijoId: 'campo', alCambiar: () => { actualizarBarra(); vistaZona(); },
      validar: (v) => (String(v || '').trim() ? '' : 'Escribe la etiqueta del campo.') });
    const nicho = campoLista({ ...base, clave: 'nichoId', etiqueta: 'Nicho', opciones: nichos.filter(n => n.activo).map(n => ({ id: n.id, nombre: n.nombre })), vacio: TODOS, prefijoId: 'campo', alCambiar: () => { borrador.nichoId = borrador.nichoId || null; actualizarBarra(); } });
    montar(zonaEditor, h('section', { class: 'panel formulario-campo' },
      h('h2', { class: 'panel-titulo', text: nuevo ? 'Nuevo campo' : seleccion.etiqueta }),
      h('div', { class: 'form-rejilla' }, etiqueta, nicho),
      h('div', { class: `campo${errores.tipo ? ' campo--error' : ''}` }, h('span', { class: 'campo-etiqueta', text: 'Tipo de dato' }), tipos,
        errores.tipo ? h('span', { class: 'campo-error', text: errores.tipo }) : (nuevo ? null : h('span', { class: 'campo-ayuda', text: 'El tipo no se puede cambiar: crea otro campo.' }))),
      opciones,
      fila('Obligatorio', 'Sin este dato no se puede guardar la empresa.', borrador.obligatorio, (v) => { borrador.obligatorio = v; actualizarBarra(); vistaZona(); }),
      fila('Visible en la lista', 'Se muestra como columna en la cartera.', borrador.visibleEnLista, (v) => { borrador.visibleEnLista = v; actualizarBarra(); }),
      nuevo ? null : fila('Activo', 'Desactivarlo no borra los datos ya guardados.', seleccion.activo, alternarActivo),
      zonaVista, barra.nodo));
    actualizarBarra();
  }

  function actualizarBarra() { barra.actualizar(cambios()); }

  async function alternarActivo(valor) {
    try {
      const { item } = await cambiarActivoCampo(seleccion.id, valor);
      campos = campos.map(c => (c.id === item.id ? { ...c, ...item } : c));
      seleccion = campos.find(c => c.id === item.id);
      avisar('success', valor ? 'Campo activado' : 'Campo desactivado', valor ? 'Vuelve a pedirse y a mostrarse.' : 'Dejó de pedirse; sus datos se conservan.');
    } catch (error) { avisar('error', 'No se pudo cambiar', error.message); }
    dibujarTodo();
  }

  async function guardar() {
    if (ocupado) return;
    ocupado = true;
    barra.ocupado(true);
    const envio = {
      etiqueta: borrador.etiqueta, nichoId: borrador.nichoId || null, tipo: borrador.tipo, obligatorio: borrador.obligatorio, visibleEnLista: borrador.visibleEnLista,
      opciones: borrador.tipo === 'lista' ? borrador.opcionesTexto.split('\n').map(o => o.trim()).filter(Boolean) : []
    };
    try {
      const { item } = seleccion.id === null ? await crearCampo(envio) : await editarCampo(seleccion.id, envio);
      campos = (await listarCampos()).items;
      seleccion = campos.find(c => c.id === item.id) || item;
      borrador = aBorrador(seleccion);
      errores = {};
      avisar('success', 'Campo guardado', `«${seleccion.etiqueta}» ya se ofrece en el formulario.`);
    } catch (error) {
      errores = error.campos || {};
      avisar(error.campos ? 'warning' : 'error', error.campos ? 'Revisa los datos marcados' : 'No se pudo guardar', error.campos ? 'Hay un dato que corregir.' : error.message);
    } finally {
      ocupado = false;
    }
    dibujarTodo();
  }

  function dibujarTodo() { dibujarLista(); dibujarEditor(); }

  montar(cont,
    cabecera({
      titulo: 'Campos propios de la empresa',
      subtitulo: 'Datos extra por nicho: aparecen en el formulario, la ficha, los filtros y la plantilla CSV.',
      acciones: h('button', { class: 'btn btn--primary', type: 'button', onclick: () => elegir(NUEVO) }, icono('add-outline'), 'Nuevo campo')
    }),
    h('div', { class: 'campos-cuerpo' }, zonaLista, zonaEditor));
  dibujarTodo();
}
