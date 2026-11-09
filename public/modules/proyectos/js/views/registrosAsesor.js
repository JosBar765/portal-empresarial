// Hojas de registro del asesor: gestión (M4), cotización (M5), venta (M6, con el aviso de orden repetida), perdida (M7) y descarte.
// En celular salen como hoja inferior; en escritorio, como ventana. La gestión también se arma como panel fijo en la ficha de escritorio.
import { h, icono, montar } from '../utils/dom.js';
import { avisar } from '../components/ui.js';
import { modalFormulario } from '../components/modalFormulario.js';
import { campoLista, campoTexto, campoArea } from '../components/campos.js';
import { registrarGestion, registrarCotizacion, registrarVenta, marcarEmpresaPerdida, descartarEmpresa } from '../api/api.js';
import { simboloDe } from '../utils/gestion.js';

// Una clave por hoja abierta: un doble clic o un reintento no duplica el registro.
const nuevaClave = () => (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID().replace(/-/g, '') : `${Date.now()}${Math.random().toString(36).slice(2)}`).slice(0, 40);
const errorDeCampos = (campos) => Object.assign(new Error('Revisa los datos.'), { campos });
const vacio = (v) => String(v == null ? '' : v).trim() === '';

// Botones redondeados de una sola elección (canal, moneda).
function pildoras({ etiqueta, opciones, valor, alElegir }) {
  return h('div', { class: 'campo' }, h('span', { class: 'campo-etiqueta', text: etiqueta }),
    h('div', { class: 'pildoras', role: 'radiogroup', 'aria-label': etiqueta },
      opciones.map(o => h('button', { class: `pildora${o.id === valor ? ' pildora--activa' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(o.id === valor), onclick: () => alElegir(o.id), text: o.nombre }))));
}

const abrirHoja = (opciones) => {
  const ventana = modalFormulario(opciones);
  ventana.overlay.classList.add('hoja');
  return ventana;
};

const subtitulo = (ficha) => h('p', { class: 'hoja-subtitulo', text: ficha.empresa.nombre });

// --- Gestión ---

// Arma el formulario de una gestión. `enviar()` valida, guarda y devuelve la ficha nueva; los botones los pone quien lo usa.
export function formularioGestion(ficha, opciones, { alCambiar } = {}) {
  const contactos = ficha.contactos;
  const valores = {
    canalId: (opciones.canales[0] || {}).id, contactoId: contactos.length === 1 ? contactos[0].id : '', resultadoId: '', nota: '', proximaEn: '',
    muestra: false, muestraCantidad: '1', muestraAreaId: ''
  };
  const errores = {};
  const clave = nuevaClave();
  const nodo = h('form', { class: 'formulario-modal', novalidate: '' });
  const resultado = () => opciones.resultados.find(r => r.id === Number(valores.resultadoId));
  const muestra = ficha.registro.muestra;
  const sinStock = muestra && muestra.quedan !== null && muestra.quedan <= 0;

  function dibujar() {
    const r = resultado();
    montar(nodo,
      pildoras({ etiqueta: 'Canal', opciones: opciones.canales, valor: valores.canalId, alElegir: (id) => { valores.canalId = id; delete errores.canalId; dibujar(); } }),
      campoLista({ valores, errores, clave: 'contactoId', etiqueta: 'Con quién habló', vacio: contactos.length ? 'Elige un contacto' : 'Esta empresa no tiene contactos', opciones: contactos.map(c => ({ id: c.id, nombre: `${c.nombre} · ${c.area}` })), prefijoId: 'gestion' }),
      campoLista({ valores, errores, clave: 'resultadoId', etiqueta: 'Resultado', obligatorio: true, vacio: 'Elige el resultado', opciones: opciones.resultados, prefijoId: 'gestion', alCambiar: dibujar, validar: (v) => (vacio(v) ? 'Elige el resultado.' : '') }),
      campoArea({ valores, errores, clave: 'nota', etiqueta: 'Nota', maximo: 1000, prefijoId: 'gestion' }),
      campoTexto({
        valores, errores, clave: 'proximaEn', etiqueta: 'Próximo seguimiento', tipo: 'datetime-local', obligatorio: Boolean(r && r.requiere_proxima), prefijoId: 'gestion',
        ayuda: r && r.requiere_proxima ? 'Obligatorio con este resultado.' : 'Opcional.',
        validar: (v) => (r && r.requiere_proxima && vacio(v) ? 'Con este resultado hay que fijar la fecha del próximo seguimiento.' : '')
      }),
      muestra ? h('div', { class: 'muestra-caja' },
        h('label', { class: 'sino' },
          h('span', { class: 'sino-texto' }, h('span', { class: 'sino-etiqueta', text: 'Entregué muestra' }),
            h('span', { class: 'sino-ayuda', text: sinStock ? `${muestra.articulo} · ya no quedan` : `${muestra.articulo}${muestra.quedan === null ? '' : ` · quedan ${muestra.quedan}`}` })),
          h('span', { class: 'interruptor' },
            (() => { const i = h('input', { type: 'checkbox', role: 'switch', 'aria-label': 'Entregué muestra' }); i.checked = valores.muestra; i.disabled = sinStock; i.addEventListener('change', () => { valores.muestra = i.checked; dibujar(); }); return i; })(),
            h('span', { class: 'interruptor-pista' }))),
        valores.muestra ? h('div', { class: 'form-rejilla' },
          campoTexto({ valores, errores, clave: 'muestraCantidad', etiqueta: 'Cantidad', maximo: 6, prefijoId: 'gestion', obligatorio: true, validar: (v) => (/^[1-9]\d{0,5}$/.test(String(v).trim()) ? '' : 'Escribe cuántas muestras entregaste.') }),
          campoLista({ valores, errores, clave: 'muestraAreaId', etiqueta: 'Área', vacio: 'Sin área', opciones: opciones.areas, prefijoId: 'gestion' })) : null) : null);
    if (alCambiar) alCambiar();
  }
  dibujar();

  async function enviar() {
    const faltan = {};
    if (!valores.canalId) faltan.canalId = 'Elige el canal.';
    if (vacio(valores.resultadoId)) faltan.resultadoId = 'Elige el resultado.';
    const r = resultado();
    if (r && r.requiere_proxima && vacio(valores.proximaEn)) faltan.proximaEn = 'Con este resultado hay que fijar la fecha del próximo seguimiento.';
    if (valores.muestra && !/^[1-9]\d{0,5}$/.test(String(valores.muestraCantidad).trim())) faltan.muestraCantidad = 'Escribe cuántas muestras entregaste.';
    if (Object.keys(faltan).length) { Object.assign(errores, faltan); dibujar(); throw errorDeCampos(faltan); }
    const nueva = await registrarGestion(ficha.id, {
      canalId: valores.canalId, contactoId: valores.contactoId || null, resultadoId: Number(valores.resultadoId), nota: valores.nota, proximaEn: valores.proximaEn || null,
      muestra: valores.muestra ? { cantidad: Number(valores.muestraCantidad), areaId: valores.muestraAreaId || null } : undefined, idempotencyKey: clave
    });
    avisar('success', 'Gestión guardada', ficha.empresa.nombre);
    return nueva;
  }

  // Los errores del servidor (campos con problema o un mensaje) se pintan en el mismo formulario.
  function alError(error) {
    const campos = {};
    for (const [k, v] of Object.entries(error.campos || {})) campos[k.replace(/^muestra\.cantidad$/, 'muestraCantidad').replace(/^muestra\.areaId$/, 'muestraAreaId')] = v;
    if (Object.keys(campos).length) { Object.assign(errores, campos); dibujar(); } else avisar('error', 'No se pudo guardar', error.message);
  }
  return { nodo, enviar, alError, reiniciar: () => { Object.assign(valores, { contactoId: contactos.length === 1 ? contactos[0].id : '', resultadoId: '', nota: '', proximaEn: '', muestra: false, muestraCantidad: '1', muestraAreaId: '' }); dibujar(); } };
}

export function abrirGestion(ficha, opciones, alGuardar) {
  const f = formularioGestion(ficha, opciones);
  f.nodo.prepend(subtitulo(ficha));
  abrirHoja({ title: 'Registrar gestión', nodo: f.nodo, aceptar: 'Guardar gestión', enviar: async () => alGuardar(await f.enviar()), alError: f.alError });
}

// --- Cotización y venta ---

function abrirDinero({ tipo, ficha, opciones, alGuardar }) {
  const esVenta = tipo === 'venta';
  const { registro } = ficha;
  const valores = { moneda: registro.monedaPorDefecto, monto: '', referencia: '', nota: '', confirmarRepetida: false };
  const errores = {};
  const clave = nuevaClave();
  let repetida = null;
  const nodo = h('form', { class: 'formulario-modal', novalidate: '' });
  const monedas = [registro.monedaLocal, 'USD'].filter((c, i, l) => c && l.indexOf(c) === i)
    .map(c => ({ id: c, nombre: `${simboloDe(c, opciones.monedas)} · ${(opciones.monedas.find(m => m.codigo === c) || {}).nombre || c}${c === registro.monedaLocal ? ' (local)' : ''}` }));
  const nombreDelNumero = esVenta ? 'Número de orden de venta (OV)' : 'Número de cotización';

  function dibujar() {
    montar(nodo,
      subtitulo(ficha),
      pildoras({ etiqueta: 'Moneda', opciones: monedas, valor: valores.moneda, alElegir: (c) => { valores.moneda = c; delete errores.moneda; dibujar(); } }),
      registro.monedaLocal ? null : h('p', { class: 'campo-mensaje', text: 'Este país no tiene moneda local configurada: se registra en dólares.' }),
      campoTexto({
        valores, errores, clave: 'monto', etiqueta: esVenta ? 'Monto vendido' : 'Monto cotizado', obligatorio: true, maximo: 14, prefijoId: tipo, placeholder: `${simboloDe(valores.moneda, opciones.monedas)} 0.00`,
        validar: (v) => (/^\d{1,10}([.,]\d{1,2})?$/.test(String(v).trim()) && Number(String(v).replace(',', '.')) > 0 ? '' : 'Escribe un monto mayor que cero, con hasta dos decimales.')
      }),
      campoTexto({
        valores, errores, clave: 'referencia', etiqueta: nombreDelNumero, obligatorio: registro.referenciaObligatoria, maximo: 60, prefijoId: tipo,
        ayuda: registro.referenciaObligatoria ? `Obligatorio: sin número no se guarda la ${esVenta ? 'venta' : 'cotización'}.` : 'Opcional en este país.',
        validar: (v) => (registro.referenciaObligatoria && vacio(v) ? 'Escribe el número; sin número no se guarda.' : '')
      }),
      esVenta ? null : campoArea({ valores, errores, clave: 'nota', etiqueta: 'Nota (opcional)', maximo: 500, prefijoId: tipo }),
      esVenta && registro.ventaPorConfirmar ? h('p', { class: 'campo-mensaje', text: 'Tu supervisor debe confirmar esta venta: hasta entonces no cuenta como vendida.' }) : null,
      repetida ? h('div', { class: 'aviso aviso--advertencia', role: 'alert' }, icono('warning-outline'),
        h('div', null,
          h('div', { class: 'aviso-titulo', text: 'Esta OV ya está en otra venta' }),
          h('div', { class: 'aviso-texto', text: `${repetida.referencia} ya está en «${repetida.cliente}»${repetida.fecha ? ` (${repetida.fecha})` : ''}. Si cubre varias empresas del grupo, confírmalo.` }),
          h('label', { class: 'casilla' }, (() => { const i = h('input', { type: 'checkbox' }); i.checked = valores.confirmarRepetida; i.addEventListener('change', () => { valores.confirmarRepetida = i.checked; }); return i; })(), h('span', { text: 'Sí, es la misma orden para varias empresas' })))) : null);
  }
  dibujar();

  abrirHoja({
    title: esVenta ? 'Registrar venta' : 'Registrar cotización', nodo, aceptar: esVenta ? 'Registrar venta' : 'Registrar cotización',
    enviar: async () => {
      const faltan = {};
      if (!/^\d{1,10}([.,]\d{1,2})?$/.test(String(valores.monto).trim()) || !(Number(String(valores.monto).replace(',', '.')) > 0)) faltan.monto = 'Escribe un monto mayor que cero, con hasta dos decimales.';
      if (registro.referenciaObligatoria && vacio(valores.referencia)) faltan.referencia = 'Escribe el número; sin número no se guarda.';
      if (Object.keys(faltan).length) { Object.assign(errores, faltan); dibujar(); throw errorDeCampos(faltan); }
      const datos = { moneda: valores.moneda, monto: String(valores.monto).replace(',', '.'), referencia: valores.referencia, idempotencyKey: clave };
      if (esVenta) datos.confirmarReferenciaRepetida = valores.confirmarRepetida === true;
      else datos.nota = valores.nota;
      const nueva = await (esVenta ? registrarVenta : registrarCotizacion)(ficha.id, datos);
      avisar('success', esVenta ? 'Venta registrada' : 'Cotización registrada', ficha.empresa.nombre);
      alGuardar(nueva);
    },
    alError: (error) => {
      if (error.codigo === 'REFERENCIA_REPETIDA') { repetida = error.detalle; valores.confirmarRepetida = false; dibujar(); return; }
      if (error.campos && Object.keys(error.campos).length) { Object.assign(errores, error.campos); dibujar(); } else avisar('error', 'No se pudo guardar', error.message);
    }
  });
}

export const abrirCotizacion = (ficha, opciones, alGuardar) => abrirDinero({ tipo: 'cotizacion', ficha, opciones, alGuardar });
export const abrirVenta = (ficha, opciones, alGuardar) => abrirDinero({ tipo: 'venta', ficha, opciones, alGuardar });

// --- Perdida y descarte ---

export function abrirPerdida(ficha, opciones, alGuardar) {
  const valores = { motivoId: '', nota: '' };
  const errores = {};
  const clave = nuevaClave();
  const nodo = h('form', { class: 'formulario-modal', novalidate: '' });
  const dibujar = () => montar(nodo,
    subtitulo(ficha),
    h('div', { class: 'campo' }, h('span', { class: 'campo-etiqueta', text: 'Motivo de pérdida' }),
      h('div', { class: 'opciones-radio', role: 'radiogroup', 'aria-label': 'Motivo de pérdida' }, opciones.motivos.map(m => h('button', {
        class: `opcion-radio${valores.motivoId === m.id ? ' opcion-radio--activa' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(valores.motivoId === m.id),
        onclick: () => { valores.motivoId = m.id; delete errores.motivoId; dibujar(); }
      }, h('span', { class: 'opcion-radio-punto' }), m.nombre))),
      errores.motivoId ? h('div', { class: 'campo-mensaje campo-mensaje--error' }, icono('alert-circle-outline'), h('span', { text: errores.motivoId })) : null),
    campoArea({ valores, errores, clave: 'nota', etiqueta: 'Nota (opcional)', maximo: 255, prefijoId: 'perdida', ayuda: 'Reábrela con una gestión nueva mientras el proyecto siga activo.' }));
  dibujar();
  abrirHoja({
    title: 'Marcar como perdida', nodo, aceptar: 'Marcar perdida', peligro: true,
    enviar: async () => {
      if (!valores.motivoId) { errores.motivoId = 'Elige el motivo.'; dibujar(); throw errorDeCampos({ motivoId: errores.motivoId }); }
      const nueva = await marcarEmpresaPerdida(ficha.id, { motivoId: valores.motivoId, nota: valores.nota, idempotencyKey: clave });
      avisar('success', 'Empresa marcada como perdida', ficha.empresa.nombre);
      alGuardar(nueva);
    },
    alError: (error) => { if (error.campos && Object.keys(error.campos).length) { Object.assign(errores, error.campos); dibujar(); } else avisar('error', 'No se pudo guardar', error.message); }
  });
}

export function abrirDescarte(ficha, alGuardar) {
  const valores = { motivo: '' };
  const errores = {};
  const clave = nuevaClave();
  const nodo = h('form', { class: 'formulario-modal', novalidate: '' });
  const dibujar = () => montar(nodo,
    subtitulo(ficha),
    h('p', { class: 'panel-descripcion', text: 'Descartar saca a la empresa de tu trabajo en este proyecto (por ejemplo, cerró o no corresponde). No se puede reabrir.' }),
    campoArea({ valores, errores, clave: 'motivo', etiqueta: 'Motivo *', maximo: 255, prefijoId: 'descarte' }));
  dibujar();
  abrirHoja({
    title: 'Descartar empresa', nodo, aceptar: 'Descartar', peligro: true,
    enviar: async () => {
      if (vacio(valores.motivo)) { errores.motivo = 'Cuenta por qué se descarta la empresa.'; dibujar(); throw errorDeCampos({ motivo: errores.motivo }); }
      const nueva = await descartarEmpresa(ficha.id, { motivo: valores.motivo, idempotencyKey: clave });
      avisar('success', 'Empresa descartada', ficha.empresa.nombre);
      alGuardar(nueva);
    },
    alError: (error) => { if (error.campos && Object.keys(error.campos).length) { Object.assign(errores, error.campos); dibujar(); } else avisar('error', 'No se pudo guardar', error.message); }
  });
}
