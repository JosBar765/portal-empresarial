// Formulario de empresa: sirve para registrar (página) y para editar (ventana de la ficha).
// - Valida cada campo al salir de él y, desde ahí, mientras se escribe (components/campos.js).
// - El teléfono lleva el código del país, que se pone solo según el país de la empresa.
// - Avisa de posibles duplicados mientras se escribe y, al guardar, si el servidor encuentra alguno; nunca bloquea:
//   «Es otra empresa» guarda de todos modos.
import { h, icono, montar } from '../utils/dom.js';
import { aviso, avisar } from '../components/ui.js';
import { campoTexto, campoLista, campoTelefono, campoSitioWeb, telefonoCompleto } from '../components/campos.js';
import { revisarDuplicados } from '../api/api.js';
import { chipEstado } from '../utils/clientes.js';
import { CORREO, vacio, validarTexto, separarTelefono } from '../utils/validar.js';

const RAZONES = { telefono: 'mismo teléfono', nombre_ciudad: 'nombre y ciudad parecidos' };
const ESPERA_REVISION_MS = 450;
const CAMPOS_CONTACTO = ['nombre', 'areaId', 'cargo', 'telefono', 'correo'];

const hayContacto = (v) => CAMPOS_CONTACTO.some(c => !vacio(v[`contacto.${c}`]));

function seccion(titulo, ayuda, ...campos) {
  return h('section', { class: 'form-seccion' },
    h('header', { class: 'form-seccion-cabecera' }, h('h2', { class: 'form-seccion-titulo', text: titulo }), h('p', { class: 'form-seccion-ayuda', text: ayuda })),
    h('div', { class: 'form-rejilla' }, campos));
}

export function construirFormulario({ opciones, inicial = {}, creando, alEnviar, etiquetaGuardar, alCancelar }) {
  const prefijos = opciones.prefijos || [];
  const ajustes = opciones.ajustes;
  const valores = {
    nombre: '', nichoId: '', paisId: '', ciudad: '', telefono: '', direccion: '', sitioWeb: '', estructuraId: '',
    'contacto.nombre': '', 'contacto.areaId': '', 'contacto.cargo': '', 'contacto.telefono': '', 'contacto.correo': '', ...inicial
  };
  if (!valores.paisId && opciones.paises.length === 1) valores.paisId = opciones.paises[0].id;
  // Al editar, el teléfono llega con su código («+503 2222 3344»): se separa en selector y número.
  const separado = inicial.telefono ? separarTelefono(inicial.telefono, prefijos) : null;
  if (separado) {
    valores.telefono = separado.numero;
    valores.telefono__pais = separado.pais.id;
    valores.telefono__manual = separado.pais.id !== valores.paisId;
  }

  const errores = {};
  const porClave = {};
  let campos = [];
  let ocupado = false;
  let temporizador = null;
  let numeroBusqueda = 0;
  let duplicados = [];

  const zonaDuplicados = h('div', { class: 'zona-duplicados', 'aria-live': 'polite' });
  const cuerpo = h('div', { class: 'formulario-cuerpo' });
  const formulario = h('form', { class: 'formulario-empresa', novalidate: '' }, cuerpo, zonaDuplicados);
  const botonGuardar = h('button', { class: 'btn btn--primary', type: 'submit' }, icono('checkmark-outline'), etiquetaGuardar);

  // --- Duplicados ---

  function dibujarDuplicados() {
    if (!duplicados.length) { montar(zonaDuplicados); return; }
    montar(zonaDuplicados,
      aviso({ tipo: 'advertencia', titulo: duplicados.length === 1 ? 'Posible duplicado' : `Posibles duplicados (${duplicados.length})`, texto: 'Revisa si es la misma empresa antes de guardar.' }),
      h('ul', { class: 'lista-duplicados' }, duplicados.map(d => h('li', null,
        h('div', null,
          h('div', { class: 'duplicado-nombre', text: d.nombre }),
          h('div', { class: 'duplicado-detalle', text: [d.ciudad, d.pais, d.telefonoTexto].filter(Boolean).join(' · ') }),
          h('div', { class: 'duplicado-razon', text: d.razones.map(r => RAZONES[r] || r).join(' y ') })),
        h('div', { class: 'duplicado-acciones' }, chipEstado(d.estado),
          h('a', { class: 'enlace-boton', href: `#/clientes/${d.id}`, target: '_blank', rel: 'noopener', text: 'Ver ficha' }))))));
  }

  async function buscarDuplicados() {
    const mia = ++numeroBusqueda;
    if (String(valores.nombre).trim().length < 3 || !valores.paisId) { duplicados = []; dibujarDuplicados(); return; }
    try {
      const r = await revisarDuplicados({ nombre: valores.nombre, ciudad: valores.ciudad, telefono: telefonoCompleto(valores, 'telefono', prefijos), paisId: valores.paisId, excluirId: inicial.id });
      if (mia !== numeroBusqueda) return;
      duplicados = r.duplicados;
    } catch (e) {
      if (mia !== numeroBusqueda) return;
      duplicados = []; // el aviso mientras se escribe es una ayuda: si falla, el servidor revisa de nuevo al guardar
    }
    dibujarDuplicados();
  }
  const buscarPronto = () => { clearTimeout(temporizador); temporizador = setTimeout(buscarDuplicados, ESPERA_REVISION_MS); };

  // --- Campos ---

  function dibujar() {
    campos = [];
    const base = { valores, errores };
    const reg = (clave, nodo) => { porClave[clave] = nodo; campos.push(nodo); return nodo; };
    const contactoRequerido = () => ajustes.contactoObligatorio || hayContacto(valores);
    let telefonoEmpresa = null;
    let telefonoContacto = null;
    let contactoNombre = null;
    let contactoArea = null;
    const revalidarContacto = () => { if (contactoNombre) { contactoNombre.revisarSiTocado(); contactoArea.revisarSiTocado(); } };

    const nombre = reg('nombre', campoTexto({ ...base, clave: 'nombre', etiqueta: 'Nombre de la empresa', obligatorio: true, alCambiar: buscarPronto,
      validar: (v) => validarTexto(v, { maximo: 150, obligatorio: true, mensajeObligatorio: 'Escribe el nombre de la empresa.' }) }));
    const pais = reg('paisId', campoLista({ ...base, clave: 'paisId', etiqueta: 'País', opciones: opciones.paises, vacio: 'Elige el país', obligatorio: true,
      validar: (v) => (vacio(v) ? 'Elige un país.' : ''),
      alCambiar: () => { telefonoEmpresa.sincronizarPais(); if (telefonoContacto) telefonoContacto.sincronizarPais(); buscarPronto(); } }));
    const nicho = reg('nichoId', campoLista({ ...base, clave: 'nichoId', etiqueta: 'Nicho', opciones: opciones.nichos, vacio: 'Elige el nicho', obligatorio: true,
      validar: (v) => (vacio(v) ? 'Elige un nicho de la lista.' : '') }));
    const estructura = reg('estructuraId', campoLista({ ...base, clave: 'estructuraId', etiqueta: 'Estructura', opciones: opciones.estructuras, vacio: 'Elige la estructura' }));
    const ciudad = reg('ciudad', campoTexto({ ...base, clave: 'ciudad', etiqueta: 'Ciudad', maximo: 100, obligatorio: ajustes.ciudadObligatoria, alCambiar: buscarPronto,
      validar: (v) => validarTexto(v, { maximo: 100, obligatorio: ajustes.ciudadObligatoria, mensajeObligatorio: 'Escribe la ciudad.' }) }));
    telefonoEmpresa = reg('telefono', campoTelefono({ ...base, clave: 'telefono', etiqueta: 'Teléfono de la empresa', prefijos, paisPorDefecto: () => valores.paisId,
      obligatorio: ajustes.telefonoOCorreoObligatorio && !creando, alCambiar: buscarPronto }));
    const direccion = reg('direccion', campoTexto({ ...base, clave: 'direccion', etiqueta: 'Dirección', maximo: 255,
      validar: (v) => validarTexto(v, { maximo: 255 }) }));
    const sitio = reg('sitioWeb', campoSitioWeb({ ...base, clave: 'sitioWeb', etiqueta: 'Sitio web', obligatorio: ajustes.sitioWebObligatorio }));

    const datos = seccion('Datos de la empresa', 'Cómo se llama y a qué se dedica.', nombre, pais, nicho, estructura);
    const ubicacion = seccion('Ubicación y contacto de la empresa', 'El código del país se pone solo según el país elegido.', ciudad, telefonoEmpresa, direccion, sitio);

    let contacto = null;
    if (creando) {
      contactoNombre = reg('contacto.nombre', campoTexto({ ...base, clave: 'contacto.nombre', etiqueta: 'Nombre', obligatorio: ajustes.contactoObligatorio, alCambiar: revalidarContacto,
        validar: (v) => (vacio(v) ? (contactoRequerido() ? 'Escribe el nombre del contacto.' : '') : validarTexto(v, { maximo: 150 })) }));
      contactoArea = reg('contacto.areaId', campoLista({ ...base, clave: 'contacto.areaId', etiqueta: 'Área', opciones: opciones.areas, vacio: 'Elige el área', obligatorio: ajustes.contactoObligatorio, alCambiar: revalidarContacto,
        validar: (v) => (vacio(v) && contactoRequerido() ? 'Elige el área del contacto.' : '') }));
      const cargo = reg('contacto.cargo', campoTexto({ ...base, clave: 'contacto.cargo', etiqueta: 'Cargo', maximo: 100, alCambiar: revalidarContacto,
        validar: (v) => validarTexto(v, { maximo: 100 }) }));
      telefonoContacto = reg('contacto.telefono', campoTelefono({ ...base, clave: 'contacto.telefono', etiqueta: 'Teléfono del contacto', prefijos, paisPorDefecto: () => valores.paisId, alCambiar: revalidarContacto }));
      const correo = reg('contacto.correo', campoTexto({ ...base, clave: 'contacto.correo', etiqueta: 'Correo', tipo: 'email', alCambiar: revalidarContacto,
        validar: (v) => (vacio(v) ? '' : (!CORREO.test(String(v).trim()) || String(v).trim().length > 150 ? 'Escribe un correo válido, por ejemplo nombre@empresa.com.' : '')) }));
      contacto = seccion(ajustes.contactoObligatorio ? 'Contacto principal' : 'Contacto principal (opcional)', 'Después podrás agregar más contactos desde la ficha de la empresa.', contactoNombre, contactoArea, cargo, telefonoContacto, correo);
    }

    montar(cuerpo, datos, ubicacion, contacto,
      h('div', { class: 'formulario-acciones' },
        alCancelar ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: alCancelar }, 'Cancelar') : null,
        botonGuardar));
  }

  // --- Envío ---

  function datosParaEnviar() {
    const envio = {
      nombre: valores.nombre, nichoId: valores.nichoId, paisId: valores.paisId, ciudad: valores.ciudad, telefono: telefonoCompleto(valores, 'telefono', prefijos),
      direccion: valores.direccion, sitioWeb: valores.sitioWeb, estructuraId: valores.estructuraId
    };
    if (creando && hayContacto(valores)) {
      envio.contacto = {
        nombre: valores['contacto.nombre'], areaId: valores['contacto.areaId'], cargo: valores['contacto.cargo'],
        telefono: telefonoCompleto(valores, 'contacto.telefono', prefijos), correo: valores['contacto.correo']
      };
    }
    return envio;
  }

  // Revisa todos los campos (los marca como tocados) y manda el cursor al primero con error.
  function revisarTodo() {
    let primero = null;
    campos.forEach(c => { if (!c.revisar() && !primero) primero = c; });
    return primero;
  }

  async function enviar(confirmarDuplicado) {
    if (ocupado) return;
    ocupado = true;
    botonGuardar.classList.add('btn--loading');
    botonGuardar.disabled = true;
    try {
      await alEnviar(datosParaEnviar(), confirmarDuplicado);
    } catch (error) {
      if (error.status === 409 && error.codigo === 'POSIBLE_DUPLICADO') {
        duplicados = error.duplicados || [];
        dibujarDuplicados();
        zonaDuplicados.append(h('div', { class: 'formulario-acciones' },
          h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => enviar(true) }, 'Es otra empresa, guardar')));
        zonaDuplicados.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (error.campos) {
        Object.assign(errores, error.campos);
        let primero = null;
        Object.keys(error.campos).forEach(k => { if (porClave[k]) { porClave[k].revisar(); if (!primero) primero = porClave[k]; } });
        avisar('warning', 'Revisa los datos marcados', 'Hay datos que corregir.');
        if (primero) primero.control.focus();
      } else {
        avisar('error', 'No se pudo guardar', error.message);
      }
    } finally {
      ocupado = false;
      botonGuardar.classList.remove('btn--loading');
      botonGuardar.disabled = false;
    }
  }

  formulario.addEventListener('submit', (e) => {
    e.preventDefault();
    Object.keys(errores).forEach(k => delete errores[k]);
    const malo = revisarTodo();
    if (malo) {
      avisar('warning', 'Revisa los datos marcados', 'Hay datos que corregir.');
      malo.control.focus();
      return;
    }
    enviar(false);
  });
  dibujar();
  return formulario;
}
