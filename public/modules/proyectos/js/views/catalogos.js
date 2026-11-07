// A1 · Catálogos: las listas que el administrador edita sin programar (una fila nueva es una opción nueva).
import { h, icono, montar } from '../utils/dom.js';
import { cabecera, aviso, cargando, interruptor, avisar, estadoVacio } from '../components/ui.js';
import { confirmarModal } from '../components/modal.js';
import {
  listarCatalogo, crearEnCatalogo, editarEnCatalogo, cambiarActivoEnCatalogo, listarPaises, guardarPais
} from '../api/api.js';
import { CATALOGOS, PESTANAS, CONFIRMACION_VENTAS, EFECTOS_ETIQUETA } from './catalogosConfig.js';

const FILAS_VISIBLES = 7;
const TITULO_PAISES = 'Países';
const aTexto = (valor) => (valor === null ? 'heredar' : (valor ? 'si' : 'no'));
const deTexto = (texto) => (texto === 'heredar' ? null : texto === 'si');

let pestanaRecordada = 'nichos';

export async function renderCatalogos(cont) {
  montar(cont, cargando());
  const datos = {};
  const [listas, respuestaPaises] = await Promise.all([
    Promise.all(Object.keys(CATALOGOS).map(async (id) => [id, (await listarCatalogo(id)).items])),
    listarPaises()
  ]);
  listas.forEach(([id, items]) => { datos[id] = items; });
  let paises = respuestaPaises.paises;

  let pestana = PESTANAS.includes(pestanaRecordada) ? pestanaRecordada : 'nichos';
  let seleccion = null;        // fila que se edita; null = formulario de alta
  let borrador = {};           // lo escrito en el formulario
  let errores = {};
  const verTodos = {};
  const zonaTitulo = h('div');
  const zonaPestanas = h('div', { class: 'pestanas', role: 'tablist' });
  const zonaCuerpo = h('div', { class: 'catalogo-cuerpo' });

  const cuantos = (id) => (id === 'paises' ? paises.length : datos[id].length);
  const nombreDe = (item) => item.nombre || item.codigo;

  // --- Pestañas y encabezado ---

  function dibujarPestanas() {
    montar(zonaPestanas, PESTANAS.map(id => h('button', {
      class: `pestana${id === pestana ? ' pestana-activa' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(id === pestana),
      onclick: () => cambiarPestana(id)
    }, id === 'paises' ? TITULO_PAISES : CATALOGOS[id].titulo, h('span', { class: 'pestana-cuenta', text: String(cuantos(id)) }))));
  }

  function dibujarTitulo() {
    const config = CATALOGOS[pestana];
    montar(zonaTitulo, cabecera({
      titulo: 'Catálogos',
      subtitulo: 'Se editan sin programar: una fila nueva es una opción nueva.',
      acciones: config ? h('button', { class: 'btn btn--primary', type: 'button', onclick: () => seleccionar(null) }, icono('add-outline'), config.nuevo) : null
    }));
  }

  function cambiarPestana(id) {
    pestana = id;
    pestanaRecordada = id;
    seleccion = id === 'paises' ? paises[0] || null : null;
    borrador = {};
    errores = {};
    dibujarTodo();
  }

  function seleccionar(item) {
    seleccion = item;
    borrador = {};
    errores = {};
    dibujarCuerpo();
  }

  // --- Tabla ---

  function celda(columna, item) {
    switch (columna.tipo) {
      case 'nombre': return h('td', { class: 'cambio-ajuste', text: nombreDe(item) });
      case 'texto': return h('td', { text: item[columna.clave] || '—' });
      case 'si_no': return h('td', { text: item[columna.clave] ? 'Sí' : '—' });
      case 'efecto': return h('td', { text: EFECTOS_ETIQUETA[item[columna.clave]] || '—' });
      case 'usos': return h('td', { class: 'num', text: String(item.usos) });
      case 'orden': return h('td', { class: 'num', text: item.orden === null ? '—' : String(item.orden) });
      case 'activo': return h('td', null, interruptor({ marcado: item.activo, etiqueta: `${nombreDe(item)} activo`, alCambiar: (valor) => alternarActivo(item, valor) }));
      default: return h('td');
    }
  }

  function filaDeCatalogo(config, item) {
    const clases = [!item.activo ? 'fila-inactiva' : '', seleccion && seleccion.id === item.id ? 'fila-seleccionada' : ''].join(' ').trim();
    return h('tr', { class: clases || null },
      config.columnas.map(c => celda(c, item)),
      h('td', null, h('button', { class: 'boton-icono', type: 'button', 'aria-label': `Editar ${nombreDe(item)}`, onclick: () => seleccionar(item) }, icono('create-outline'))));
  }

  function tablaDeCatalogo() {
    const config = CATALOGOS[pestana];
    const items = datos[pestana];
    if (!items.length) return h('div', { class: 'tabla-caja' }, estadoVacio('Todavía no hay nada aquí', `Crea ${config.singular === 'área' ? 'la primera' : 'el primero'} con el formulario.`));
    const visibles = verTodos[pestana] ? items : items.slice(0, FILAS_VISIBLES);
    return h('div', { class: 'tabla-caja' },
      h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table' },
        h('thead', null, h('tr', null, [...config.columnas.map(c => h('th', { class: ['usos', 'orden'].includes(c.tipo) ? 'num' : null, text: c.titulo })), h('th')])),
        h('tbody', null, visibles.map(item => filaDeCatalogo(config, item))))),
      h('div', { class: 'tabla-pie' },
        h('span', { text: `Mostrando ${visibles.length} de ${items.length} ${config.titulo.toLowerCase()}` }),
        visibles.length < items.length ? h('button', { class: 'enlace-boton', type: 'button', text: 'Ver todos', onclick: () => { verTodos[pestana] = true; dibujarCuerpo(); } }) : null));
  }

  async function alternarActivo(item, activo) {
    const config = CATALOGOS[pestana];
    if (!activo && item.usos > 0) {
      const unidad = config.columnas.find(c => c.tipo === 'usos').titulo.toLowerCase();
      const acepta = await confirmarModal({
        title: `Desactivar ${config.singular}`,
        mensaje: `«${nombreDe(item)}» tiene ${item.usos} ${unidad}. Dejará de ofrecerse en proyectos nuevos; lo que ya existe no se toca.`,
        aceptar: 'Desactivar'
      });
      if (!acepta) { dibujarCuerpo(); return; }
    }
    try {
      const { item: actualizado } = await cambiarActivoEnCatalogo(pestana, item.id, activo);
      datos[pestana] = datos[pestana].map(i => (i.id === actualizado.id ? actualizado : i));
      avisar('success', activo ? 'Activado' : 'Desactivado', `«${nombreDe(actualizado)}» ${activo ? 'vuelve a ofrecerse' : 'ya no se ofrece en proyectos nuevos'}.`);
    } catch (error) {
      avisar('error', 'No se pudo cambiar', error.message);
    }
    dibujarCuerpo();
  }

  // --- Formulario de catálogo ---

  const valorDe = (campo) => {
    if (campo.clave in borrador) return borrador[campo.clave];
    if (seleccion) return seleccion[campo.clave];
    if (campo.tipo === 'interruptor') return false;
    return campo.valorInicial || '';
  };

  function campoDe(campo) {
    const error = errores[campo.clave];
    const id = `campo-${campo.clave}`;
    const actualizar = (valor) => { borrador[campo.clave] = valor; delete errores[campo.clave]; };
    let control;
    if (campo.tipo === 'interruptor') {
      return h('div', { class: 'campo-fila' }, h('span', { text: campo.etiqueta }),
        interruptor({ marcado: valorDe(campo), etiqueta: campo.etiqueta, alCambiar: actualizar }));
    }
    if (campo.tipo === 'area') {
      control = h('textarea', { id, rows: 3, maxlength: 255 });
      control.value = valorDe(campo) || '';
      control.addEventListener('input', () => actualizar(control.value));
    } else if (campo.tipo === 'lista') {
      control = h('select', { id }, campo.opciones.map(([v, t]) => h('option', { value: v, text: t })));
      control.value = valorDe(campo);
      control.addEventListener('change', () => actualizar(control.value));
    } else {
      control = h('input', { id, type: 'text', maxlength: campo.maximo || 100, autocomplete: 'off' });
      control.value = valorDe(campo) || '';
      control.disabled = Boolean(campo.soloAlCrear && seleccion);
      control.addEventListener('input', () => {
        if (campo.mayusculas) control.value = control.value.toUpperCase();
        actualizar(control.value);
      });
    }
    return h('div', { class: `campo${error ? ' campo--error' : ''}` },
      h('label', { for: id, text: campo.etiqueta }), control,
      error ? h('span', { class: 'campo-error', text: error }) : null);
  }

  async function guardarCatalogo() {
    const config = CATALOGOS[pestana];
    const envio = {};
    config.campos.forEach(c => { if (!(c.soloAlCrear && seleccion)) envio[c.clave] = valorDe(c); });
    if (seleccion && seleccion.orden !== null && 'orden' in borrador) envio.orden = borrador.orden;
    if (!seleccion && 'activo' in borrador) envio.activo = borrador.activo;
    try {
      if (seleccion) await editarEnCatalogo(pestana, seleccion.id, envio);
      else await crearEnCatalogo(pestana, envio);
      datos[pestana] = (await listarCatalogo(pestana)).items;
      avisar('success', 'Guardado', `Se guardó el ${config.singular === 'área' ? 'área' : config.singular}.`);
      seleccion = null;
      borrador = {};
      errores = {};
      dibujarTodo();
    } catch (error) {
      errores = error.campos || {};
      avisar(error.campos ? 'warning' : 'error', error.campos ? 'Revisa los datos marcados' : 'No se pudo guardar', error.campos ? 'Hay un dato que corregir.' : error.message);
      dibujarCuerpo();
    }
  }

  function formularioDeCatalogo() {
    const config = CATALOGOS[pestana];
    const campos = config.campos.map(campoDe);
    if (seleccion && seleccion.orden !== null) {
      const entrada = h('input', { id: 'campo-orden', type: 'number', min: 1, step: 1 });
      entrada.value = 'orden' in borrador ? borrador.orden : seleccion.orden;
      entrada.addEventListener('input', () => { borrador.orden = entrada.value; delete errores.orden; });
      campos.push(h('div', { class: `campo${errores.orden ? ' campo--error' : ''}` }, h('label', { for: 'campo-orden', text: 'Orden' }), entrada,
        errores.orden ? h('span', { class: 'campo-error', text: errores.orden }) : null));
    }
    if (!seleccion) {
      campos.push(h('div', { class: 'campo-fila' }, h('span', { text: 'Activo' }),
        interruptor({ marcado: 'activo' in borrador ? borrador.activo : true, etiqueta: 'Activo', alCambiar: (v) => { borrador.activo = v; } })));
    }
    return h('form', { class: 'panel formulario-lateral', novalidate: '', onsubmit: (e) => { e.preventDefault(); guardarCatalogo(); } },
      h('h3', { text: seleccion ? `Editar ${config.singular}` : config.nuevo }),
      campos,
      config.aviso ? aviso(config.aviso) : null,
      h('button', { class: 'btn btn--primary', type: 'submit' }, icono('checkmark-outline'), `Guardar ${config.singular}`),
      seleccion ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => seleccionar(null) }, 'Cancelar') : null);
  }

  // --- Países (se editan, no se crean) ---

  const monedasActivas = () => datos.monedas.filter(m => m.activo);

  function tablaDePaises() {
    return h('div', { class: 'tabla-caja' },
      h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table' },
        h('thead', null, h('tr', null, ['País', 'Moneda', 'Prefijo', 'Teléfono', 'Referencia', 'Confirmación', ''].map(t => h('th', { text: t })))),
        h('tbody', null, paises.map(p => h('tr', { class: seleccion && seleccion.paisId === p.paisId ? 'fila-seleccionada' : null },
          h('td', { class: 'cambio-ajuste', text: p.nombre }),
          h('td', { text: p.monedaCodigo || '—' }),
          h('td', { text: p.prefijoTelefono || '—' }),
          h('td', { text: p.formatoTelefono || '—' }),
          h('td', { text: p.referenciaObligatoria ? 'Sí' : 'No' }),
          h('td', { text: { heredar: 'Heredar', si: 'Sí', no: 'No' }[aTexto(p.confirmacionVentas)] }),
          h('td', null, h('button', { class: 'boton-icono', type: 'button', 'aria-label': `Editar ${p.nombre}`, onclick: () => seleccionar(p) }, icono('create-outline')))))))),
      h('div', { class: 'tabla-pie' }, h('span', { text: `${paises.length} países` })));
  }

  async function guardarDePais() {
    const envio = { ...borrador };
    try {
      await guardarPais(seleccion.paisId, envio);
      paises = (await listarPaises()).paises;
      avisar('success', 'País guardado', `Se guardó la configuración de ${seleccion.nombre}.`);
      seleccion = paises.find(p => p.paisId === seleccion.paisId) || null;
      borrador = {};
      errores = {};
    } catch (error) {
      errores = error.campos || {};
      avisar(error.campos ? 'warning' : 'error', error.campos ? 'Revisa los datos marcados' : 'No se pudo guardar', error.campos ? 'Hay un dato que corregir.' : error.message);
    }
    dibujarCuerpo();
  }

  function formularioDePais() {
    if (!seleccion) return h('div', { class: 'panel' }, estadoVacio('Elige un país', 'Usa el lápiz de la tabla para editarlo.', 'globe-outline'));
    const valor = (clave) => (clave in borrador ? borrador[clave] : seleccion[clave]);
    const campoTexto = (clave, etiqueta, ayuda) => {
      const id = `pais-${clave}`;
      const entrada = h('input', { id, type: 'text', maxlength: 30, autocomplete: 'off' });
      entrada.value = valor(clave) || '';
      entrada.addEventListener('input', () => { borrador[clave] = entrada.value; delete errores[clave]; });
      return h('div', { class: `campo${errores[clave] ? ' campo--error' : ''}` }, h('label', { for: id, text: etiqueta }), entrada,
        errores[clave] ? h('span', { class: 'campo-error', text: errores[clave] }) : (ayuda ? h('span', { class: 'campo-ayuda', text: ayuda }) : null));
    };
    const moneda = h('select', { id: 'pais-moneda' },
      h('option', { value: '', text: 'Sin moneda local' }),
      monedasActivas().map(m => h('option', { value: m.codigo, text: `${m.codigo} · ${m.nombre}` })));
    moneda.value = valor('monedaCodigo') || '';
    moneda.addEventListener('change', () => { borrador.monedaCodigo = moneda.value || null; delete errores.monedaCodigo; dibujarCuerpo(); });
    const confirmacion = h('select', { id: 'pais-confirmacion' }, CONFIRMACION_VENTAS.map(([v, t]) => h('option', { value: v, text: t })));
    confirmacion.value = aTexto(valor('confirmacionVentas'));
    confirmacion.addEventListener('change', () => { borrador.confirmacionVentas = deTexto(confirmacion.value); });
    return h('form', { class: 'panel formulario-lateral', novalidate: '', onsubmit: (e) => { e.preventDefault(); guardarDePais(); } },
      h('h3', { text: `Editar país: ${seleccion.nombre}` }),
      h('div', { class: `campo${errores.monedaCodigo ? ' campo--error' : ''}` }, h('label', { for: 'pais-moneda', text: 'Moneda local' }), moneda,
        errores.monedaCodigo ? h('span', { class: 'campo-error', text: errores.monedaCodigo }) : null),
      campoTexto('prefijoTelefono', 'Prefijo del teléfono'),
      campoTexto('formatoTelefono', 'Formato del teléfono', 'Usa # para cada dígito, por ejemplo #### ####.'),
      h('div', { class: 'campo-fila' }, h('span', { text: 'Referencia obligatoria' }),
        interruptor({ marcado: valor('referenciaObligatoria'), etiqueta: 'Referencia obligatoria', alCambiar: (v) => { borrador.referenciaObligatoria = v; } })),
      h('div', { class: 'campo' }, h('label', { for: 'pais-confirmacion', text: 'Confirmación de ventas' }), confirmacion),
      !valor('monedaCodigo') ? aviso({ tipo: 'advertencia', titulo: 'Sin moneda local', texto: 'Las cotizaciones y ventas de este país saldrán en dólares hasta que elijas una.' }) : null,
      h('button', { class: 'btn btn--primary', type: 'submit' }, icono('checkmark-outline'), 'Guardar país'));
  }

  // --- Armado ---

  function dibujarCuerpo() {
    montar(zonaCuerpo,
      pestana === 'paises' ? tablaDePaises() : tablaDeCatalogo(),
      pestana === 'paises' ? formularioDePais() : formularioDeCatalogo());
  }

  function dibujarTodo() {
    dibujarTitulo();
    dibujarPestanas();
    dibujarCuerpo();
  }

  if (pestana === 'paises') seleccion = paises[0] || null;
  montar(cont, zonaTitulo, zonaPestanas, zonaCuerpo);
  dibujarTodo();
}
