// A3 · Parámetros: ajustes de reparto, seguimiento, semáforo, importación, empresas e informe.
// Se dibuja desde el registro del servidor (tipo, rango y valor por defecto de cada ajuste); los cambios se guardan juntos.
import { h, montar } from '../utils/dom.js';
import { pluralizar } from '../utils/formato.js';
import { cabecera, aviso, cargando, interruptor, barraGuardado, avisar } from '../components/ui.js';
import { listarParametros, guardarParametros } from '../api/api.js';
import { registrarSalida } from '../components/salida.js';

const NUMERICOS = ['entero', 'porcentaje', 'entero_opcional'];
const ETIQUETAS_OPCION = {
  omitir: 'Omitir', actualizar: 'Actualizar',
  embudo: 'Embudo', montos: 'Montos', canal: 'Canal', muestras: 'Muestras', por_asesor: 'Por asesor', por_tienda: 'Por tienda'
};

// Un número escrito se compara como número; así «7» y 7 son lo mismo.
function comparable(def, valor) {
  if (NUMERICOS.includes(def.tipo)) return valor === '' || valor === null || valor === undefined ? null : Number(valor);
  if (def.tipo === 'multilista') return [...valor].sort().join(',');
  return valor;
}
const iguales = (def, a, b) => comparable(def, a) === comparable(def, b);

function textoDeValor(def, valor) {
  if (def.tipo === 'booleano') return valor ? 'encendido' : 'apagado';
  if (valor === null || valor === undefined) return 'sin tope';
  if (def.tipo === 'multilista') return valor.map(o => ETIQUETAS_OPCION[o] || o).join(', ');
  if (def.tipo === 'lista') return (ETIQUETAS_OPCION[valor] || valor).toLowerCase();
  if (valor === '') return 'vacío';
  return def.unidad ? `${valor} ${def.unidad}` : String(valor);
}

const rangoDe = (def) => (def.min !== null && def.max !== null ? ` · rango ${def.min}–${def.max}` : '');

function crearControl(def, valor, alEditar) {
  switch (def.tipo) {
    case 'booleano':
      return interruptor({ marcado: valor, etiqueta: def.etiqueta, alCambiar: alEditar });
    case 'lista': {
      const select = h('select', { class: 'control-select', 'aria-label': def.etiqueta },
        def.opciones.map(o => h('option', { value: o, text: ETIQUETAS_OPCION[o] || o })));
      select.value = valor;
      select.addEventListener('change', () => alEditar(select.value));
      return select;
    }
    case 'multilista': {
      const marcadas = new Set(valor);
      return h('div', { class: 'casillas' }, def.opciones.map(o => {
        const entrada = h('input', { type: 'checkbox', value: o });
        entrada.checked = marcadas.has(o);
        entrada.addEventListener('change', () => {
          if (entrada.checked) marcadas.add(o); else marcadas.delete(o);
          alEditar(def.opciones.filter(x => marcadas.has(x)));
        });
        return h('label', { class: 'casilla' }, entrada, ETIQUETAS_OPCION[o] || o);
      }));
    }
    case 'hora':
    case 'texto':
    case 'formato_codigo': {
      const entrada = h('input', {
        class: 'control-numero control-texto', type: def.tipo === 'hora' ? 'time' : 'text', value: valor, 'aria-label': def.etiqueta,
        maxlength: def.longitudMax || null, spellcheck: 'false'
      });
      entrada.addEventListener('input', () => alEditar(entrada.value));
      return entrada;
    }
    default: {
      const entrada = h('input', {
        class: 'control-numero', type: 'number', inputmode: 'numeric', min: def.min, max: def.max, step: 1,
        placeholder: def.tipo === 'entero_opcional' ? 'Sin tope' : null, 'aria-label': def.etiqueta
      });
      entrada.value = valor === null || valor === undefined ? '' : valor;
      entrada.addEventListener('input', () => alEditar(entrada.value));
      return def.unidad ? h('div', { class: 'campo-fila' }, entrada, h('span', { class: 'campo-ayuda', text: def.unidad })) : entrada;
    }
  }
}

export async function renderParametros(cont) {
  montar(cont, cargando());
  let grupos = (await listarParametros()).grupos;
  let borrador = {};
  let errores = {};
  let grupoActivo = grupos[0].id;
  const definiciones = () => new Map(grupos.flatMap(g => g.parametros).map(p => [p.clave, p]));
  const guardado = (clave) => definiciones().get(clave).valor;
  const filas = [];

  const barra = barraGuardado({ alDescartar: descartar, alGuardar: guardar });
  const panelDerecho = h('section', { class: 'panel' });
  const listaGrupos = h('nav', { class: 'panel grupos-lista', 'aria-label': 'Grupos de ajustes' });

  function refrescar() {
    filas.forEach(pintar => pintar());
    barra.actualizar(Object.keys(borrador).length);
  }

  function editar(def, valor) {
    if (iguales(def, valor, guardado(def.clave))) delete borrador[def.clave]; else borrador[def.clave] = valor;
    delete errores[def.clave];
    refrescar();
  }

  function fila(def) {
    const control = h('div', { class: 'ajuste-control' });
    const lineaDefecto = h('div', { class: 'ajuste-defecto' });
    const error = h('div', { class: 'ajuste-mensaje-error' });
    const nodo = h('div', { class: 'ajuste' },
      h('div', { class: 'ajuste-nombre', text: def.etiqueta }),
      h('div', { class: 'ajuste-ayuda', text: def.ayuda }),
      control, error);
    const valorVigente = () => (def.clave in borrador ? borrador[def.clave] : guardado(def.clave));
    control.append(crearControl(def, valorVigente(), (valor) => editar(def, valor)), lineaDefecto);

    filas.push(function pintar() {
      const modificado = def.clave in borrador;
      nodo.classList.toggle('ajuste--modificado', modificado);
      nodo.classList.toggle('ajuste--error', Boolean(errores[def.clave]));
      error.textContent = errores[def.clave] || '';
      error.hidden = !errores[def.clave];
      const restaurar = !iguales(def, valorVigente(), def.defecto)
        ? h('button', { class: 'enlace-boton', type: 'button', text: 'Restaurar', onclick: () => { editar(def, def.defecto); dibujarPanel(); } })
        : null;
      lineaDefecto.replaceChildren(
        ...(modificado ? [h('span', { class: 'marca-modificado', text: 'Modificado' }), ' '] : []),
        `Por defecto: ${textoDeValor(def, def.defecto)}${rangoDe(def)}`,
        ...(restaurar ? [restaurar] : []));
    });
    return nodo;
  }

  function dibujarLista() {
    montar(listaGrupos, grupos.map(g => h('button', {
      class: `grupo-boton${g.id === grupoActivo ? ' grupo-boton-activo' : ''}`, type: 'button',
      onclick: () => { grupoActivo = g.id; dibujarLista(); dibujarPanel(); }
    }, h('span', { text: g.nombre }), h('span', { class: 'grupo-cuenta', text: String(g.parametros.length) }))));
  }

  function dibujarPanel() {
    filas.length = 0;
    const grupo = grupos.find(g => g.id === grupoActivo);
    montar(panelDerecho,
      h('h2', { class: 'panel-titulo', text: grupo.nombre }),
      h('p', { class: 'panel-descripcion', text: grupo.descripcion }),
      grupo.parametros.map(fila),
      barra.nodo);
    refrescar();
  }

  function descartar() {
    borrador = {};
    errores = {};
    dibujarPanel();
  }

  async function guardar() {
    barra.ocupado(true);
    try {
      const respuesta = await guardarParametros(borrador);
      grupos = respuesta.grupos;
      const cuantos = respuesta.modificados.length;
      borrador = {};
      errores = {};
      avisar('success', 'Cambios guardados', `${pluralizar(cuantos, 'ajuste actualizado', 'ajustes actualizados')}. Aplican a los proyectos nuevos.`);
      dibujarLista();
      dibujarPanel();
    } catch (error) {
      errores = error.campos || {};
      if (error.campos) {
        // Si el ajuste con error está en otro grupo, se abre ese grupo para que se vea.
        const primero = grupos.find(g => g.parametros.some(p => errores[p.clave]));
        if (primero) { grupoActivo = primero.id; dibujarLista(); }
        avisar('warning', 'Revisa los ajustes marcados', 'Hay valores fuera de rango o que no se pueden combinar.');
      } else {
        avisar('error', 'No se pudo guardar', error.message);
      }
      dibujarPanel();
    } finally {
      barra.ocupado(false);
      refrescar();
    }
  }

  registrarSalida(() => Object.keys(borrador).length > 0);
  montar(cont,
    cabecera({ titulo: 'Parámetros', subtitulo: 'Ajustes de reparto, seguimiento e informes, con su rango y valor por defecto.' }),
    aviso({ titulo: 'Aplica a proyectos nuevos', texto: 'Los proyectos que ya están activos conservan la configuración con la que nacieron.' }),
    h('div', { class: 'parametros-cuerpo' }, listaGrupos, panelDerecho));
  dibujarLista();
  dibujarPanel();
}
