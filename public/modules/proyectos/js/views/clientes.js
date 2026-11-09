// Base de clientes: lista con búsqueda y filtros, y el registro de una empresa nueva.
// Las rutas son #/clientes (lista), #/clientes/nuevo (registro) y #/clientes/<id> (ficha).
import { h, icono, montar } from '../utils/dom.js';
import { cabecera, aviso, cargando, estadoVacio, avisar } from '../components/ui.js';
import { listarClientes, obtenerOpcionesClientes, crearCliente } from '../api/api.js';
import { chipEstado, chipEnProyecto, ESTADOS_FILTRO } from '../utils/clientes.js';
import { construirFormulario } from './clienteFormulario.js';
import { renderFicha } from './clienteFicha.js';

const ESPERA_BUSQUEDA_MS = 350;
let filtrosRecordados = { busqueda: '', nicho: '', pais: '', estado: 'activa' };

export function renderClientes(cont, parametro) {
  if (parametro === 'nuevo') return renderRegistro(cont);
  if (parametro) return renderFicha(cont, parametro);
  return renderLista(cont);
}

// --- Lista ---

const lugar = (e) => [e.ciudad, e.pais].filter(Boolean).join(' · ');

function filaDeTabla(e) {
  return h('tr', null,
    h('td', null, h('a', { class: 'cliente-enlace', href: `#/clientes/${e.id}`, text: e.nombre })),
    h('td', { text: e.nicho }),
    h('td', { text: lugar(e) || '—' }),
    h('td', { text: e.telefonoTexto || '—' }),
    h('td', { class: 'num', text: String(e.contactos) }),
    h('td', null, h('div', { class: 'chips' }, chipEstado(e.estado), e.enProyecto ? chipEnProyecto() : null)));
}

function tarjetaDeCliente(e) {
  return h('a', { class: 'cliente-tarjeta', href: `#/clientes/${e.id}` },
    h('div', { class: 'cliente-tarjeta-cabecera' }, h('span', { class: 'cliente-tarjeta-nombre', text: e.nombre }), icono('chevron-forward-outline')),
    h('div', { class: 'cliente-tarjeta-detalle', text: [e.nicho, lugar(e)].filter(Boolean).join(' · ') }),
    h('div', { class: 'cliente-tarjeta-detalle', text: e.telefonoTexto || 'Sin teléfono' }),
    h('div', { class: 'chips' }, chipEstado(e.estado), e.enProyecto ? chipEnProyecto() : null));
}

async function renderLista(cont) {
  montar(cont, cargando());
  const opciones = await obtenerOpcionesClientes();
  const filtros = { ...filtrosRecordados };
  const items = [];
  let total = 0;
  let pagina = 0;
  let hayMas = false;
  let numeroConsulta = 0;
  let temporizador = null;

  const zonaResultados = h('div');
  const zonaPie = h('div', { class: 'tabla-pie' });

  const entradaBusqueda = h('input', { type: 'search', placeholder: 'Buscar por nombre o teléfono', maxlength: 100, 'aria-label': 'Buscar empresa', autocomplete: 'off' });
  entradaBusqueda.value = filtros.busqueda;
  const lista = (clave, etiqueta, opcionesLista, todo) => {
    const control = h('select', { 'aria-label': etiqueta },
      todo ? h('option', { value: '', text: todo }) : null, opcionesLista.map(([v, t]) => h('option', { value: String(v), text: t })));
    control.value = String(filtros[clave]);
    control.addEventListener('change', () => { filtros[clave] = control.value; cargar(true); });
    return h('div', { class: 'campo' }, h('label', { text: etiqueta }), control);
  };

  async function cargar(desdeCero) {
    const mia = ++numeroConsulta;
    if (desdeCero) { pagina = 0; items.length = 0; }
    filtrosRecordados = { ...filtros };
    const botonMas = zonaPie.querySelector('button');
    if (botonMas) botonMas.classList.add('btn--loading');
    try {
      const r = await listarClientes({ ...filtros, pagina: pagina + 1 });
      if (mia !== numeroConsulta) return;
      pagina = r.pagina;
      total = r.total;
      hayMas = r.hayMas;
      items.push(...r.items);
      dibujarResultados();
    } catch (error) {
      if (mia !== numeroConsulta) return;
      avisar('error', 'No se pudo cargar la lista', error.message);
      dibujarResultados();
    }
  }

  function dibujarResultados() {
    if (!items.length) {
      montar(zonaResultados, h('div', { class: 'tabla-caja' }, filtros.busqueda || filtros.nicho || filtros.pais || filtros.estado !== 'activa'
        ? estadoVacio('Ninguna empresa coincide', 'Prueba con otra búsqueda o quita algún filtro.', 'search-outline')
        : estadoVacio('Todavía no hay empresas', opciones.permisos.registrar ? 'Registra la primera con el botón de arriba.' : 'Cuando se registren, aparecerán aquí.', 'business-outline')));
      montar(zonaPie);
      return;
    }
    montar(zonaResultados,
      h('div', { class: 'tabla-caja clientes-tabla' }, h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table' },
        h('thead', null, h('tr', null, ['Empresa', 'Nicho', 'Ubicación', 'Teléfono', 'Contactos', 'Estado'].map(t => h('th', { class: t === 'Contactos' ? 'num' : null, text: t })))),
        h('tbody', null, items.map(filaDeTabla))))),
      h('div', { class: 'clientes-tarjetas' }, items.map(tarjetaDeCliente)));
    montar(zonaPie,
      h('span', { text: `Mostrando ${items.length} de ${total} ${total === 1 ? 'empresa' : 'empresas'}` }),
      hayMas ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => cargar(false) }, 'Cargar más') : null);
  }

  entradaBusqueda.addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { filtros.busqueda = entradaBusqueda.value.trim(); cargar(true); }, ESPERA_BUSQUEDA_MS);
  });

  const alcanceTexto = opciones.paises.length === 1 ? opciones.paises[0].nombre : `${opciones.paises.length} países`;
  montar(cont,
    cabecera({
      titulo: 'Cartera',
      subtitulo: `Empresas de ${alcanceTexto}. Cualquier asesor puede registrarlas; el sistema avisa si ya existe una parecida.`,
      acciones: opciones.permisos.registrar ? h('a', { class: 'btn btn--primary', href: '#/clientes/nuevo' }, icono('add-outline'), 'Registrar empresa') : null
    }),
    h('div', { class: 'panel filtros filtros--clientes' },
      h('div', { class: 'campo campo--busqueda' }, h('label', { text: 'Buscar' }), entradaBusqueda),
      lista('nicho', 'Nicho', opciones.nichos.map(n => [n.id, n.nombre]), 'Todos los nichos'),
      opciones.paises.length > 1 ? lista('pais', 'País', opciones.paises.map(p => [p.id, p.nombre]), 'Todos los países') : null,
      lista('estado', 'Estado', ESTADOS_FILTRO)),
    zonaResultados, zonaPie);
  await cargar(true);
}

// --- Registro ---

async function renderRegistro(cont) {
  montar(cont, cargando());
  const opciones = await obtenerOpcionesClientes();
  if (!opciones.permisos.registrar) {
    montar(cont, cabecera({ titulo: 'Registrar empresa' }), aviso({ tipo: 'error', titulo: 'No puedes registrar empresas', texto: 'Tu rol solo consulta la cartera.' }));
    return;
  }
  const formulario = construirFormulario({
    opciones, creando: true, etiquetaGuardar: 'Guardar empresa', alCancelar: () => { window.location.hash = '#/clientes'; },
    alEnviar: async (datos, confirmarDuplicado) => {
      const empresa = await crearCliente(datos, confirmarDuplicado);
      avisar('success', 'Empresa registrada', `«${empresa.nombre}» ya está en la base.`);
      window.location.hash = `#/clientes/${empresa.id}`;
    }
  });
  montar(cont,
    cabecera({
      titulo: 'Registrar empresa',
      subtitulo: 'Los campos con * son obligatorios. Si ya existe una parecida, te avisamos antes de guardar.',
      acciones: h('a', { class: 'btn btn--ghost', href: '#/clientes' }, icono('arrow-back-outline'), 'Volver a la cartera')
    }),
    h('section', { class: 'panel panel--formulario' }, formulario));
}
