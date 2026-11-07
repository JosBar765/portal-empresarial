// Formulario de empresa: sirve para registrar (página) y para editar (ventana de la ficha).
// Avisa de posibles duplicados mientras se escribe y, al guardar, si el servidor encuentra alguno; nunca bloquea:
// «Es otra empresa» guarda de todos modos.
import { h, icono, montar } from '../utils/dom.js';
import { aviso, avisar } from '../components/ui.js';
import { campoTexto, campoLista } from '../components/campos.js';
import { revisarDuplicados } from '../api/api.js';
import { chipEstado } from '../utils/clientes.js';

const RAZONES = { telefono: 'mismo teléfono', nombre_ciudad: 'nombre y ciudad parecidos' };
const ESPERA_REVISION_MS = 450;

const hayContacto = (v) => ['nombre', 'cargo', 'telefono', 'correo'].some(c => String(v[`contacto.${c}`] || '').trim());

export function construirFormulario({ opciones, inicial = {}, creando, alEnviar, etiquetaGuardar, alCancelar }) {
  const valores = {
    nombre: '', nichoId: '', paisId: '', ciudad: '', telefono: '', direccion: '', sitioWeb: '', estructuraId: '',
    'contacto.nombre': '', 'contacto.areaId': '', 'contacto.cargo': '', 'contacto.telefono': '', 'contacto.correo': '', ...inicial
  };
  let errores = {};
  let ocupado = false;
  let revision = null;
  let numeroRevision = 0;
  let duplicados = [];

  const zonaDuplicados = h('div', { class: 'zona-duplicados', 'aria-live': 'polite' });
  const cuerpo = h('div');
  const formulario = h('form', { class: 'formulario-empresa', novalidate: '' }, cuerpo, zonaDuplicados);
  const botonGuardar = h('button', { class: 'btn btn--primary', type: 'submit' }, icono('checkmark-outline'), etiquetaGuardar);

  const paisDe = () => opciones.paises.find(p => p.id === valores.paisId);
  const ayudaTelefono = () => {
    const pais = paisDe();
    return pais && pais.prefijoTelefono ? `Formato: ${pais.prefijoTelefono} ${pais.formatoTelefono || ''}`.trim() : 'Elige primero el país.';
  };

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

  async function revisar() {
    const mia = ++numeroRevision;
    if (String(valores.nombre).trim().length < 3 || !valores.paisId) { duplicados = []; dibujarDuplicados(); return; }
    try {
      const r = await revisarDuplicados({ nombre: valores.nombre, ciudad: valores.ciudad, telefono: valores.telefono, paisId: valores.paisId, excluirId: inicial.id });
      if (mia !== numeroRevision) return;
      duplicados = r.duplicados;
    } catch (e) {
      if (mia !== numeroRevision) return;
      duplicados = []; // el aviso mientras se escribe es una ayuda: si falla, el servidor revisa de nuevo al guardar
    }
    dibujarDuplicados();
  }
  const revisarPronto = () => { clearTimeout(revision); revision = setTimeout(revisar, ESPERA_REVISION_MS); };

  // --- Campos ---

  function dibujar() {
    if (!valores.paisId && opciones.paises.length === 1) valores.paisId = opciones.paises[0].id; // antes de armar las ayudas del teléfono
    const ajustes = opciones.ajustes;
    const base = { valores, errores };
    const seccionContacto = creando ? h('fieldset', { class: 'seccion-formulario' },
      h('legend', { text: ajustes.contactoObligatorio ? 'Contacto principal *' : 'Contacto principal (opcional)' }),
      h('div', { class: 'form-rejilla' },
        campoTexto({ ...base, clave: 'contacto.nombre', etiqueta: 'Nombre', obligatorio: ajustes.contactoObligatorio }),
        campoLista({ ...base, clave: 'contacto.areaId', etiqueta: 'Área', opciones: opciones.areas, vacio: 'Elige el área', obligatorio: ajustes.contactoObligatorio }),
        campoTexto({ ...base, clave: 'contacto.cargo', etiqueta: 'Cargo', maximo: 100 }),
        campoTexto({ ...base, clave: 'contacto.telefono', etiqueta: 'Teléfono del contacto', maximo: 30, tipo: 'tel', ayuda: ayudaTelefono() }),
        campoTexto({ ...base, clave: 'contacto.correo', etiqueta: 'Correo', tipo: 'email' }))) : null;
    montar(cuerpo,
      h('div', { class: 'form-rejilla' },
        campoTexto({ ...base, clave: 'nombre', etiqueta: 'Nombre de la empresa', obligatorio: true, alCambiar: revisarPronto }),
        campoLista({ ...base, clave: 'paisId', etiqueta: 'País', opciones: opciones.paises, vacio: 'Elige el país', obligatorio: true, alCambiar: () => { dibujar(); revisarPronto(); } }),
        campoLista({ ...base, clave: 'nichoId', etiqueta: 'Nicho', opciones: opciones.nichos, vacio: 'Elige el nicho', obligatorio: true }),
        campoLista({ ...base, clave: 'estructuraId', etiqueta: 'Estructura', opciones: opciones.estructuras, vacio: 'Elige la estructura' }),
        campoTexto({ ...base, clave: 'ciudad', etiqueta: 'Ciudad', maximo: 100, obligatorio: ajustes.ciudadObligatoria, alCambiar: revisarPronto }),
        campoTexto({ ...base, clave: 'telefono', etiqueta: 'Teléfono de la empresa', maximo: 30, tipo: 'tel', ayuda: ayudaTelefono(), obligatorio: ajustes.telefonoOCorreoObligatorio && !creando, alCambiar: revisarPronto }),
        campoTexto({ ...base, clave: 'direccion', etiqueta: 'Dirección', maximo: 255 }),
        campoTexto({ ...base, clave: 'sitioWeb', etiqueta: 'Sitio web', maximo: 255, obligatorio: ajustes.sitioWebObligatorio, placeholder: 'banco.com' })),
      seccionContacto,
      h('div', { class: 'formulario-acciones' },
        alCancelar ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: alCancelar }, 'Cancelar') : null,
        botonGuardar));
  }

  // --- Envío ---

  function datosParaEnviar() {
    const envio = {
      nombre: valores.nombre, nichoId: valores.nichoId, paisId: valores.paisId, ciudad: valores.ciudad, telefono: valores.telefono,
      direccion: valores.direccion, sitioWeb: valores.sitioWeb, estructuraId: valores.estructuraId
    };
    if (creando && hayContacto(valores)) {
      envio.contacto = { nombre: valores['contacto.nombre'], areaId: valores['contacto.areaId'], cargo: valores['contacto.cargo'], telefono: valores['contacto.telefono'], correo: valores['contacto.correo'] };
    }
    return envio;
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
        errores = error.campos;
        dibujar();
        avisar('warning', 'Revisa los datos marcados', 'Hay datos que corregir.');
        const primero = formulario.querySelector('.campo--error input, .campo--error select');
        if (primero) primero.focus();
      } else {
        avisar('error', 'No se pudo guardar', error.message);
      }
    } finally {
      ocupado = false;
      botonGuardar.classList.remove('btn--loading');
      botonGuardar.disabled = false;
    }
  }

  formulario.addEventListener('submit', (e) => { e.preventDefault(); errores = {}; enviar(false); });
  dibujar();
  return formulario;
}
