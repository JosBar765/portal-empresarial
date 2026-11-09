// Ficha de una empresa: datos, contactos por área, historial de estado y las acciones (editar, «No contactar»,
// reactivar, contactos). Cada acción responde con la ficha actualizada, que se vuelve a dibujar.
import { h, icono, montar } from '../utils/dom.js';
import { hace, fechaCorta, nombreCorto } from '../utils/formato.js';
import { cabecera, aviso, cargando, avisar, interruptor } from '../components/ui.js';
import { abrirModal } from '../components/modal.js';
import { modalFormulario } from '../components/modalFormulario.js';
import { campoTexto, campoLista, campoArea, campoTelefono, telefonoCompleto } from '../components/campos.js';
import { CORREO, vacio, validarTexto, separarTelefono } from '../utils/validar.js';
import {
  obtenerCliente, obtenerOpcionesClientes, editarCliente, cambiarEstadoCliente, agregarContacto, editarContacto, cambiarActivoContacto
} from '../api/api.js';
import { chipEstado, chipEnProyecto, ETIQUETA_ESTADO } from '../utils/clientes.js';
import { construirFormulario } from './clienteFormulario.js';

const ORIGEN = { asesor: 'Registrada por un asesor', importacion: 'Importada desde un archivo' };
const ACCION_EVENTO = { no_contactar: 'Marcada «No contactar»', inactivar: 'Marcada inactiva', reactivar: 'Reactivada' };

const dato = (etiqueta, valor) => h('div', { class: 'dato' }, h('dt', { text: etiqueta }), h('dd', null, valor || '—'));

export async function renderFicha(cont, id) {
  montar(cont, cargando());
  const opciones = await obtenerOpcionesClientes();
  let empresa;
  try {
    empresa = await obtenerCliente(id);
  } catch (error) {
    if (error.status !== 404) throw error;
    montar(cont, cabecera({ titulo: 'Empresa no encontrada', acciones: h('a', { class: 'btn btn--ghost', href: '#/clientes' }, icono('arrow-back-outline'), 'Volver a la cartera') }),
      aviso({ tipo: 'advertencia', titulo: 'No existe o no es de tus países', texto: 'Revisa el enlace o búscala en la cartera.' }));
    return;
  }

  const dibujar = () => montar(cont, ...armar(empresa, opciones, (actualizada) => { empresa = actualizada; dibujar(); }));
  dibujar();
}

function armar(empresa, opciones, alActualizar) {
  const puedeEditar = opciones.permisos.registrar;
  const puedeReactivar = opciones.permisos.reactivar;
  const acciones = h('div', { class: 'acciones-cabecera' },
    h('a', { class: 'btn btn--ghost', href: '#/clientes' }, icono('arrow-back-outline'), 'Cartera'),
    puedeEditar ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => ventanaEditar(empresa, opciones, alActualizar) }, icono('create-outline'), 'Editar') : null,
    puedeEditar && empresa.estado === 'activa' ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => ventanaEstado(empresa, opciones, 'inactivar', alActualizar) }, icono('pause-outline'), 'Marcar inactiva') : null,
    puedeEditar && empresa.estado !== 'no_contactar' ? h('button', { class: 'btn btn--danger', type: 'button', onclick: () => ventanaEstado(empresa, opciones, 'no_contactar', alActualizar) }, icono('ban-outline'), 'No contactar') : null,
    puedeReactivar && empresa.estado !== 'activa' ? h('button', { class: 'btn btn--primary', type: 'button', onclick: () => ventanaEstado(empresa, opciones, 'reactivar', alActualizar) }, icono('refresh-outline'), 'Reactivar') : null);

  const ultimoCierre = empresa.eventos.find(e => e.accion !== 'reactivar');
  const avisoEstado = empresa.estado === 'activa' ? null : aviso({
    tipo: empresa.estado === 'no_contactar' ? 'error' : 'advertencia',
    titulo: empresa.estado === 'no_contactar' ? 'No se debe contactar a esta empresa' : 'Esta empresa está inactiva',
    texto: ultimoCierre ? `${ultimoCierre.motivo || 'Sin motivo'} · ${nombreCorto(ultimoCierre.usuario)}, ${hace(ultimoCierre.creadoEn)}.` : null
  });

  return [
    cabecera({
      titulo: empresa.nombre,
      subtitulo: [empresa.nicho, empresa.estructura, [empresa.ciudad, empresa.pais].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
      acciones
    }),
    h('div', { class: 'chips chips--ficha' }, chipEstado(empresa.estado), empresa.enProyecto ? chipEnProyecto() : null),
    avisoEstado,
    h('div', { class: 'ficha-cuerpo' },
      h('div', { class: 'ficha-columna' }, panelDatos(empresa), panelNicho(empresa), panelHistorial(empresa)),
      h('div', { class: 'ficha-columna' }, panelContactos(empresa, opciones, puedeEditar, alActualizar)))
  ];
}

// --- Paneles ---

function panelDatos(e) {
  const web = e.sitioWeb ? h('a', { class: 'enlace-boton', href: e.sitioWeb, target: '_blank', rel: 'noopener noreferrer', text: e.sitioWeb.replace(/^https?:\/\//, '') }) : null;
  return h('section', { class: 'panel' },
    h('h2', { class: 'panel-titulo', text: 'Datos de la empresa' }),
    h('dl', { class: 'datos' },
      dato('País', e.pais), dato('Ciudad', e.ciudad), dato('Nicho', e.nicho), dato('Estructura', e.estructura),
      dato('Teléfono', e.telefonoTexto), dato('Sitio web', web), dato('Dirección', e.direccion),
      dato('Origen', `${ORIGEN[e.origen] || e.origen}${e.tiendaOrigen ? ` · ${e.tiendaOrigen}` : ''}`),
      dato('Registrada por', `${e.creadoPor}, ${hace(e.creadoEn)}`)));
}

// Los campos propios que el administrador definió para el nicho de la empresa (A6).
function panelNicho(e) {
  if (!e.datosNicho || !e.datosNicho.length) return null;
  return h('section', { class: 'panel' },
    h('h2', { class: 'panel-titulo', text: 'Datos del nicho' }),
    h('dl', { class: 'datos' }, e.datosNicho.map(d => dato(d.etiqueta, d.texto))));
}

function panelHistorial(e) {
  const cuerpo = e.eventos.length
    ? h('ul', { class: 'linea-tiempo' }, e.eventos.map(ev => h('li', null,
      h('div', { class: 'linea-titulo', text: `${ACCION_EVENTO[ev.accion] || ev.accion}${ev.motivo ? ` · ${ev.motivo}` : ''}` }),
      ev.nota ? h('div', { class: 'linea-nota', text: ev.nota }) : null,
      h('div', { class: 'linea-detalle', text: `${ETIQUETA_ESTADO[ev.estadoAnterior]} → ${ETIQUETA_ESTADO[ev.estadoNuevo]} · ${nombreCorto(ev.usuario)} · ${fechaCorta(ev.creadoEn)}` }))))
    : h('p', { class: 'panel-descripcion', text: 'Sin cambios de estado. Cuando alguien la marque «No contactar» o inactiva, quedará aquí.' });
  return h('section', { class: 'panel' }, h('h2', { class: 'panel-titulo', text: 'Cambios de estado' }), cuerpo);
}

function tarjetaDeContacto(c, puedeEditar, alAccionar) {
  return h('li', { class: `contacto${c.activo ? '' : ' contacto--inactivo'}` },
    h('div', { class: 'contacto-cuerpo' },
      h('div', { class: 'contacto-nombre' }, c.nombre, c.principal ? h('span', { class: 'chip-estado chip-estado--principal', text: 'Principal' }) : null, !c.activo ? h('span', { class: 'chip-estado chip-estado--inactiva', text: 'Inactivo' }) : null),
      c.cargo ? h('div', { class: 'contacto-detalle', text: c.cargo }) : null,
      c.telefonoTexto ? h('div', { class: 'contacto-detalle' }, icono('call-outline'), c.telefonoTexto) : null,
      c.correo ? h('div', { class: 'contacto-detalle' }, icono('mail-outline'), c.correo) : null),
    puedeEditar ? h('div', { class: 'contacto-acciones' },
      h('button', { class: 'boton-icono', type: 'button', 'aria-label': `Editar a ${c.nombre}`, onclick: () => alAccionar('editar', c) }, icono('create-outline')),
      interruptor({ marcado: c.activo, etiqueta: `${c.nombre} activo`, alCambiar: (valor) => alAccionar('activo', c, valor) })) : null);
}

function panelContactos(empresa, opciones, puedeEditar, alActualizar) {
  const porArea = new Map();
  empresa.contactos.forEach(c => { if (!porArea.has(c.area)) porArea.set(c.area, []); porArea.get(c.area).push(c); });

  async function alAccionar(accion, contacto, valor) {
    if (accion === 'editar') { ventanaContacto(empresa, opciones, contacto, alActualizar); return; }
    try {
      alActualizar(await cambiarActivoContacto(contacto.id, valor));
      avisar('success', valor ? 'Contacto activado' : 'Contacto desactivado', contacto.nombre);
    } catch (error) {
      avisar('error', 'No se pudo cambiar', error.message);
      alActualizar(empresa);
    }
  }

  const cuerpo = empresa.contactos.length
    ? [...porArea].map(([area, lista]) => h('div', { class: 'contactos-area' }, h('h3', { class: 'contactos-area-titulo', text: area }),
      h('ul', { class: 'contactos' }, lista.map(c => tarjetaDeContacto(c, puedeEditar, alAccionar)))))
    : h('p', { class: 'panel-descripcion', text: 'Esta empresa todavía no tiene contactos.' });
  return h('section', { class: 'panel' },
    h('div', { class: 'panel-cabecera' },
      h('h2', { class: 'panel-titulo', text: `Contactos (${empresa.contactos.filter(c => c.activo).length})` }),
      puedeEditar ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => ventanaContacto(empresa, opciones, null, alActualizar) }, icono('person-add-outline'), 'Agregar contacto') : null),
    cuerpo);
}

// --- Ventanas ---

function ventanaEditar(empresa, opciones, alActualizar) {
  const { overlay, cerrar } = abrirModal({ title: 'Editar empresa', bodyHtml: '' });
  const formulario = construirFormulario({
    opciones, creando: false, etiquetaGuardar: 'Guardar cambios', alCancelar: () => cerrar(),
    inicial: {
      id: empresa.id, nombre: empresa.nombre, nichoId: empresa.nichoId, paisId: empresa.paisId, ciudad: empresa.ciudad || '',
      datosExtra: empresa.datosExtra || {},
      telefono: empresa.telefonoTexto || '', direccion: empresa.direccion || '', sitioWeb: empresa.sitioWeb || '', estructuraId: empresa.estructuraId
    },
    alEnviar: async (datos, confirmarDuplicado) => {
      alActualizar(await editarCliente(empresa.id, datos, confirmarDuplicado));
      cerrar();
      avisar('success', 'Empresa actualizada', empresa.nombre);
    }
  });
  overlay.querySelector('.modal-box').classList.add('modal-lg'); // el formulario va en dos columnas
  overlay.querySelector('.modal-body').append(formulario);
}

const TEXTO_ESTADO = {
  no_contactar: { titulo: 'No contactar', aceptar: 'Marcar «No contactar»', peligro: true, ayuda: 'Nadie podrá incluirla en un proyecto hasta que un supervisor o el administrador la reactive.' },
  inactivar: { titulo: 'Marcar inactiva', aceptar: 'Marcar inactiva', peligro: false, ayuda: 'Deja de ofrecerse para proyectos nuevos; sus datos y contactos se conservan.' },
  reactivar: { titulo: 'Reactivar empresa', aceptar: 'Reactivar', peligro: false, ayuda: 'Vuelve a estar disponible. Queda registrado quién la reactivó y por qué.' }
};

function ventanaEstado(empresa, opciones, accion, alActualizar) {
  const texto = TEXTO_ESTADO[accion];
  const valores = { motivoId: '', nota: '' };
  let errores = {};
  const nodo = h('form', { class: 'formulario-modal', novalidate: '' });
  const dibujar = () => montar(nodo,
    h('p', { class: 'panel-descripcion', text: `${empresa.nombre}. ${texto.ayuda}` }),
    accion === 'reactivar' ? null : campoLista({ valores, errores, clave: 'motivoId', etiqueta: 'Motivo', opciones: opciones.motivosNoContactar, vacio: 'Elige un motivo', obligatorio: true, prefijoId: 'estado' }),
    campoArea({ valores, errores, clave: 'nota', etiqueta: accion === 'reactivar' ? 'Motivo de la reactivación *' : 'Nota (opcional)', maximo: 500, prefijoId: 'estado' }));
  dibujar();
  modalFormulario({
    title: texto.titulo, nodo, aceptar: texto.aceptar, peligro: texto.peligro,
    enviar: async () => {
      errores = {};
      alActualizar(await cambiarEstadoCliente(empresa.id, { accion, motivoId: valores.motivoId || undefined, nota: valores.nota }));
      avisar('success', 'Estado actualizado', `${empresa.nombre}: ${ETIQUETA_ESTADO[{ no_contactar: 'no_contactar', inactivar: 'inactiva', reactivar: 'activa' }[accion]]}.`);
    },
    alError: (error) => {
      if (error.campos) { errores = error.campos; dibujar(); } else avisar('error', 'No se pudo cambiar el estado', error.message);
    }
  });
}

function ventanaContacto(empresa, opciones, contacto, alActualizar) {
  const prefijos = opciones.prefijos || [];
  const valores = contacto
    ? { nombre: contacto.nombre, areaId: contacto.areaId, cargo: contacto.cargo || '', telefono: '', correo: contacto.correo || '', principal: contacto.principal }
    : { nombre: '', areaId: '', cargo: '', telefono: '', correo: '', principal: false };
  valores.paisId = empresa.paisId; // el código del teléfono parte del país de la empresa
  const separado = contacto && contacto.telefono ? separarTelefono(contacto.telefono, prefijos) : null;
  if (separado) { valores.telefono = separado.numero; valores.telefono__pais = separado.pais.id; valores.telefono__manual = separado.pais.id !== empresa.paisId; }
  const errores = {};
  const porClave = {};
  const nodo = h('form', { class: 'formulario-modal', novalidate: '' });
  const base = { valores, errores, prefijoId: 'contacto' };
  const reg = (clave, campo) => { porClave[clave] = campo; return campo; };
  montar(nodo,
    reg('nombre', campoTexto({ ...base, clave: 'nombre', etiqueta: 'Nombre', obligatorio: true, validar: (v) => validarTexto(v, { maximo: 150, obligatorio: true, mensajeObligatorio: 'Escribe el nombre del contacto.' }) })),
    reg('areaId', campoLista({ ...base, clave: 'areaId', etiqueta: 'Área', opciones: opciones.areas, vacio: 'Elige el área', obligatorio: true, validar: (v) => (vacio(v) ? 'Elige el área del contacto.' : '') })),
    reg('cargo', campoTexto({ ...base, clave: 'cargo', etiqueta: 'Cargo', maximo: 100, validar: (v) => validarTexto(v, { maximo: 100 }) })),
    reg('telefono', campoTelefono({ ...base, clave: 'telefono', etiqueta: 'Teléfono', prefijos, paisPorDefecto: () => empresa.paisId })),
    reg('correo', campoTexto({ ...base, clave: 'correo', etiqueta: 'Correo', tipo: 'email',
      validar: (v) => (vacio(v) ? '' : (!CORREO.test(String(v).trim()) || String(v).trim().length > 150 ? 'Escribe un correo válido, por ejemplo nombre@empresa.com.' : '')) })),
    h('div', { class: 'campo-fila' }, h('span', { text: 'Contacto principal' }),
      interruptor({ marcado: valores.principal, etiqueta: 'Contacto principal', alCambiar: (v) => { valores.principal = v; } })));
  modalFormulario({
    title: contacto ? 'Editar contacto' : 'Agregar contacto', nodo, aceptar: 'Guardar contacto',
    enviar: async () => {
      Object.keys(errores).forEach(k => delete errores[k]);
      let primero = null;
      Object.values(porClave).forEach(c => { if (!c.revisar() && !primero) primero = c; });
      if (primero) { primero.control.focus(); throw Object.assign(new Error('Revisa los datos marcados.'), { silencioso: true }); }
      const envio = { nombre: valores.nombre, areaId: valores.areaId, cargo: valores.cargo, telefono: telefonoCompleto(valores, 'telefono', prefijos), correo: valores.correo, principal: valores.principal };
      alActualizar(contacto ? await editarContacto(contacto.id, envio) : await agregarContacto(empresa.id, envio));
      avisar('success', 'Contacto guardado', valores.nombre);
    },
    alError: (error) => {
      if (error.silencioso) return;
      if (error.campos) {
        Object.assign(errores, error.campos);
        Object.keys(error.campos).forEach(k => porClave[k] && porClave[k].revisar());
      } else avisar('error', 'No se pudo guardar el contacto', error.message);
    }
  });
}
