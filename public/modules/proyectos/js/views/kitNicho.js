// A9 · Kit del nicho: el guion de llamada y los mensajes (WhatsApp o correo) de cada nicho, con variables como {empresa}.
// El portal no envía nada: el asesor los abre prellenados desde la ficha de la empresa y los envía él mismo. Ruta: #/kit.
import { h, icono, montar } from '../utils/dom.js';
import { cabecera, cargando, interruptor, avisar, barraGuardado } from '../components/ui.js';
import { registrarSalida } from '../components/salida.js';
import { confirmarModal } from '../components/modal.js';
import { listarKits, obtenerKit, guardarKit } from '../api/api.js';

const NOMBRE_CANAL = { whatsapp: 'WhatsApp', correo: 'Correo' };
const MAX_GUION = 4000;
const MAX_TEXTO = 1500;
const MAX_TITULO = 100;
const MAX_MENSAJES = 20;
// Datos de ejemplo de la vista previa: así se ve un mensaje con los datos de una empresa.
const EJEMPLO = { empresa: 'Banco del Norte', contacto: 'Carolina', asesor: 'Carla', articulo: 'Medalla' };

const alta = () => ({ canal: 'whatsapp', titulo: '', texto: '', activo: true });
const aBorrador = (kit) => ({ guion: kit.guion, activo: kit.activo, mensajes: kit.mensajes.map(m => ({ canal: m.canal, titulo: m.titulo, texto: m.texto, activo: m.activo })) });
const copia = (b) => JSON.parse(JSON.stringify(b));

// Reemplaza las variables por los datos de ejemplo; una variable que no existe se deja a la vista para que se note.
const conEjemplo = (texto, nicho) => String(texto || '').replace(/\{([^{}]*)\}/g, (entero, nombre) => ({ ...EJEMPLO, nicho }[nombre] || entero));

export async function renderKitNicho(cont) {
  montar(cont, cargando());
  const catalogo = await listarKits();
  const variables = catalogo.variables;
  let nichos = catalogo.nichos;
  let nicho = nichos[0];
  let original = null;
  let borrador = null;
  let errores = {};
  let ocupado = false;
  let ultimoCampo = null;

  const zonaLista = h('div', { class: 'panel campos-lista' });
  const zonaEditor = h('div');
  const barra = barraGuardado({ alDescartar: () => { borrador = copia(original); errores = {}; dibujarEditor(); }, alGuardar: guardar });
  const cambios = () => {
    if (!borrador) return 0;
    return (borrador.guion !== original.guion ? 1 : 0) + (borrador.activo !== original.activo ? 1 : 0) + (JSON.stringify(borrador.mensajes) !== JSON.stringify(original.mensajes) ? 1 : 0);
  };
  registrarSalida(() => cambios() > 0);
  const actualizarBarra = () => barra.actualizar(cambios());

  function dibujarLista() {
    montar(zonaLista, h('div', { class: 'campos-grupo' }, h('div', { class: 'campos-grupo-titulo', text: 'Nichos' }),
      nichos.map(n => h('button', { class: `campo-item${nicho.id === n.id ? ' campo-item--activo' : ''}`, type: 'button', onclick: () => elegir(n) },
        h('span', { class: 'campo-item-nombre', text: n.nombre }),
        h('span', { class: 'campo-item-etiquetas' },
          n.tieneKit && n.activo ? h('span', { class: 'chip-estado', text: `${n.mensajes} ${n.mensajes === 1 ? 'mensaje' : 'mensajes'}` })
            : n.tieneKit ? h('span', { class: 'chip-estado chip-estado--no_contactar', text: 'Apagado' }) : h('span', { class: 'chip-estado chip-estado--inactiva', text: 'Sin kit' }))))));
  }

  async function elegir(n) {
    if (cambios() > 0 && !(await confirmarModal({ title: 'Hay cambios sin guardar', mensaje: 'Si cambias de nicho, se pierden. ¿Quieres seguir?', aceptar: 'Descartar cambios', cancelar: 'Seguir editando' }))) return;
    await cargarNicho(n);
  }

  async function cargarNicho(n) {
    nicho = n;
    errores = {};
    montar(zonaEditor, cargando());
    dibujarLista();
    try {
      const { kit } = await obtenerKit(n.id);
      original = aBorrador(kit);
      borrador = copia(original);
    } catch (error) {
      avisar('error', 'No se pudo cargar el kit', error.message);
      return;
    }
    dibujarEditor();
  }

  // Inserta una variable donde está el cursor del último texto que se editó (el guion o un mensaje).
  function insertarVariable(nombre) {
    const campo = ultimoCampo;
    if (!campo || !campo.isConnected) { avisar('info', 'Elige dónde ponerla', 'Haz clic en el guion o en el texto de un mensaje y vuelve a elegir la variable.'); return; }
    const ini = campo.selectionStart ?? campo.value.length;
    const fin = campo.selectionEnd ?? ini;
    campo.setRangeText(`{${nombre}}`, ini, fin, 'end');
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.focus();
  }

  const area = (valor, { filas, maximo, alEscribir, etiquetaAria }) => {
    const t = h('textarea', { rows: filas, maxlength: maximo, 'aria-label': etiquetaAria });
    t.value = valor;
    t.addEventListener('focus', () => { ultimoCampo = t; });
    t.addEventListener('input', () => { alEscribir(t.value); actualizarBarra(); });
    return t;
  };

  function tarjetaMensaje(m, i) {
    const err = errores[`mensaje${i + 1}`];
    const vista = h('div', { class: 'kit-vista' });
    const pintar = () => montar(vista, h('span', { class: 'kit-vista-rotulo', text: 'Vista previa con datos de ejemplo' }), h('p', { text: conEjemplo(m.texto, nicho.nombre) || '—' }));
    pintar();
    const canal = h('select', { 'aria-label': 'Canal del mensaje' }, Object.entries(NOMBRE_CANAL).map(([v, t]) => h('option', { value: v, text: t })));
    canal.value = m.canal;
    canal.addEventListener('change', () => { m.canal = canal.value; actualizarBarra(); });
    const titulo = h('input', { type: 'text', maxlength: MAX_TITULO, placeholder: 'Título (por ejemplo, Saludo inicial)', 'aria-label': 'Título del mensaje' });
    titulo.value = m.titulo;
    titulo.addEventListener('input', () => { m.titulo = titulo.value; actualizarBarra(); });
    const texto = area(m.texto, { filas: 3, maximo: MAX_TEXTO, etiquetaAria: 'Texto del mensaje', alEscribir: (v) => { m.texto = v; pintar(); } });
    return h('div', { class: `kit-mensaje${err ? ' campo--error' : ''}${m.activo ? '' : ' kit-mensaje--apagado'}` },
      h('div', { class: 'kit-mensaje-cabecera' }, canal, titulo,
        interruptor({ marcado: m.activo, etiqueta: 'Mensaje activo', alCambiar: (v) => { m.activo = v; actualizarBarra(); dibujarEditor(); } }),
        h('button', { class: 'btn btn--ghost btn--chico', type: 'button', 'aria-label': 'Quitar mensaje', onclick: () => { borrador.mensajes.splice(i, 1); errores = {}; actualizarBarra(); dibujarEditor(); } }, icono('trash-outline'))),
      texto, err ? h('span', { class: 'campo-error', text: err }) : null, vista);
  }

  function dibujarEditor() {
    if (!borrador) return;
    const chips = h('div', { class: 'kit-variables' }, h('span', { class: 'campo-ayuda', text: 'Variables (clic para insertar):' }),
      variables.map(v => h('button', { class: 'chip-variable', type: 'button', onclick: () => insertarVariable(v), text: `{${v}}` })));
    const guion = area(borrador.guion, { filas: 8, maximo: MAX_GUION, etiquetaAria: 'Guion de llamada', alEscribir: (v) => { borrador.guion = v; } });
    montar(zonaEditor, h('section', { class: 'panel formulario-campo' },
      h('h2', { class: 'panel-titulo', text: nicho.nombre }),
      h('div', { class: 'ajuste-simple' },
        h('div', null, h('div', { class: 'ajuste-nombre', text: 'Kit activo' }), h('div', { class: 'ajuste-ayuda', text: 'Apagado, el asesor no ve guion ni mensajes de este nicho.' })),
        interruptor({ marcado: borrador.activo, etiqueta: 'Kit activo', alCambiar: (v) => { borrador.activo = v; actualizarBarra(); } })),
      h('div', { class: `campo${errores.guion ? ' campo--error' : ''}` }, h('label', { text: 'Guion de llamada' }), guion,
        errores.guion ? h('span', { class: 'campo-error', text: errores.guion }) : h('span', { class: 'campo-ayuda', text: 'Un paso por línea. Se le muestra al asesor en la ficha de la empresa.' })),
      chips,
      h('div', { class: 'aviso aviso--info' }, icono('information-circle-outline'), h('div', null, h('strong', { text: 'El portal no envía mensajes' }), h('p', { text: 'El asesor abre el mensaje prellenado en WhatsApp o en su correo y lo envía él mismo. Si a la empresa le falta un dato, ese mensaje se oculta.' }))),
      h('h3', { class: 'panel-titulo', text: 'Mensajes' }),
      errores.mensajes ? h('span', { class: 'campo-error', text: errores.mensajes }) : null,
      borrador.mensajes.map(tarjetaMensaje),
      borrador.mensajes.length < MAX_MENSAJES ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { borrador.mensajes.push(alta()); actualizarBarra(); dibujarEditor(); } }, icono('add-outline'), 'Agregar mensaje') : null,
      barra.nodo));
    actualizarBarra();
  }

  async function guardar() {
    if (ocupado) return;
    ocupado = true;
    barra.ocupado(true);
    try {
      const { kit } = await guardarKit(nicho.id, borrador);
      original = aBorrador(kit);
      borrador = copia(original);
      errores = {};
      nichos = (await listarKits()).nichos;
      nicho = nichos.find(n => n.id === nicho.id) || nicho;
      dibujarLista();
      avisar('success', 'Kit guardado', `El kit de ${nicho.nombre} ya está disponible para los asesores.`);
    } catch (error) {
      errores = error.campos || {};
      avisar(error.campos ? 'warning' : 'error', error.campos ? 'Revisa los datos marcados' : 'No se pudo guardar', error.campos ? 'Hay un dato que corregir.' : error.message);
    } finally {
      ocupado = false;
    }
    dibujarEditor();
  }

  montar(cont,
    cabecera({ titulo: 'Kit del nicho', subtitulo: 'Guion y mensajes por nicho. El asesor los abre prellenados; el portal no los envía.' }),
    h('div', { class: 'campos-cuerpo' }, zonaLista, zonaEditor));
  await cargarNicho(nicho);
}
