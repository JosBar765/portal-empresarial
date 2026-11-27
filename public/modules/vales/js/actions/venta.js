// Venta de un vale por su orden de venta (OV): el dueño la registra y administra; el supervisor la confirma o rechaza.
import { state } from '../state.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { escapeHtml } from '../utils/formato.js';
import { limpiarOv, ovDeCotizacion } from '../utils/ordenVenta.js';
import { registrarVenta, corregirVenta, borrarVenta, confirmarVenta, rechazarVenta } from '../api/valesApi.js';
import { cargarBuzon } from '../views/buzon.js';

const AVISO_CAMBIO = 'El asesor cambió el número de OV. Revisa el nuevo antes de decidir.';

// Modal de venta abierto: los avisos en vivo lo actualizan si la OV cambia o se resuelve.
let abierto = null;

export function avisarCambioEnModalVenta({ valeId, venta, actorId }) {
  if (!abierto || abierto.valeId !== Number(valeId) || !abierto.overlay.isConnected) return;
  if (abierto.enviando || actorId === state.user.id) return;
  if (venta.estado === 'POR_CONFIRMAR') {
    if (venta.numero !== abierto.numero) abierto.alCambiar?.(venta.numero);
  } else if (venta.estado === 'BORRADA') {
    abierto.alRetirar?.(`El asesor borró la OV ${venta.numero}. Ya no hay nada que decidir.`);
  } else {
    abierto.alResolver?.();
  }
}

function abrir(vale, opciones) {
  const modal = abrirModal(opciones);
  modal.overlay.querySelector('.modal-footer').classList.add('venta-footer');
  abierto = { valeId: vale.id, overlay: modal.overlay, numero: vale.venta?.numero || null, enviando: false };
  return modal;
}

// Reemplaza título, cuerpo y botones del modal abierto. `botones`: { texto, clase, alPulsar }.
function pintar(overlay, titulo, cuerpoHtml, botones) {
  overlay.querySelector('.modal-header h3').textContent = titulo;
  overlay.querySelector('.modal-body').innerHTML = cuerpoHtml;
  const pie = overlay.querySelector('.modal-footer');
  pie.replaceChildren(...botones.map(({ texto, clase = 'btn--ghost', alPulsar }) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = `btn ${clase}`;
    boton.textContent = texto;
    boton.addEventListener('click', () => alPulsar(boton));
    return boton;
  }));
}

const parrafo = (texto) => `<p class="venta-texto">${escapeHtml(texto)}</p>`;
const subtitulo = (vale) => `<p class="venta-subtitulo">Vale ${escapeHtml(vale.correlativo)} · ${escapeHtml(vale.cliente_empresa || vale.cliente_nombre)}</p>`;

function htmlCampo(valor) {
  return `
    <div class="form-field">
      <label for="venta-ov">Número de orden de venta (OV)</label>
      <input type="text" id="venta-ov" inputmode="numeric" autocomplete="off" placeholder="Ej. 100234567890" value="${escapeHtml(valor)}" aria-describedby="venta-ov-ayuda">
      <span class="campo-ayuda" id="venta-ov-ayuda">Solo números, hasta 12 dígitos. Puedes pegarlo desde la otra plataforma.</span>
    </div>`;
}

function quitarErrorCampo(overlay) {
  overlay.querySelector('.field-error')?.remove();
  overlay.querySelector('.form-field')?.classList.remove('is-invalid');
}

function errorEnCampo(overlay, mensaje) {
  quitarErrorCampo(overlay);
  const campo = overlay.querySelector('.form-field');
  campo.classList.add('is-invalid');
  const error = document.createElement('span');
  error.className = 'field-error';
  error.setAttribute('role', 'alert');
  error.textContent = mensaje;
  campo.appendChild(error);
}

// Campo + botón principal: se deshabilita vacío, muestra el envío y deja el error junto al campo.
function conectarCampo(overlay, boton, { enviando, guardar, alResuelta }) {
  const input = overlay.querySelector('#venta-ov');
  const texto = boton.textContent;
  const revisar = () => { boton.disabled = !limpiarOv(input.value); };
  const enviar = async () => {
    if (boton.disabled) return;
    boton.disabled = true;
    boton.textContent = enviando;
    abierto.enviando = true;
    try {
      await guardar(limpiarOv(input.value));
    } catch (error) {
      cargarBuzon();
      if (error.codigo === 'OV_RESUELTA' && alResuelta) { alResuelta(error.message); return; }
      errorEnCampo(overlay, error.message);
      boton.textContent = texto;
      abierto.enviando = false;
      revisar();
    }
  };
  input.addEventListener('input', () => { quitarErrorCampo(overlay); revisar(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); enviar(); } });
  boton.addEventListener('click', enviar);
  revisar();
  input.focus();
}

function pantallaResuelta(overlay, cerrar, mensaje) {
  pintar(overlay, 'Esta OV ya fue resuelta', parrafo(mensaje), [{ texto: 'Entendido', clase: 'btn--primary', alPulsar: cerrar }]);
}

export function abrirModalRegistrarVenta(vale) {
  const sugerida = ovDeCotizacion(vale.cotizacion);
  const { overlay, cerrar } = abrir(vale, {
    title: 'Registrar venta',
    bodyHtml: `${subtitulo(vale)}${htmlCampo('')}${sugerida ? `<button type="button" class="venta-sugerencia" id="venta-sugerencia">Usar ${sugerida} (de la cotización)</button>` : ''}`,
    footerHtml: '<button type="button" class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button type="button" class="btn btn--primary" id="btn-confirmar">Registrar OV</button>'
  });
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelector('#venta-sugerencia')?.addEventListener('click', () => {
    const input = overlay.querySelector('#venta-ov');
    input.value = sugerida;
    input.dispatchEvent(new Event('input'));
    input.focus();
  });
  conectarCampo(overlay, overlay.querySelector('#btn-confirmar'), {
    enviando: 'Registrando…',
    guardar: async (numero) => {
      await registrarVenta(vale.id, numero);
      window.toast.success('OV registrada', `${vale.correlativo} quedó por confirmar.`);
      cerrar();
      cargarBuzon();
    }
  });
}

// Tuerca: corregir o borrar la OV mientras está por confirmar.
export function abrirModalAdministrarVenta(vale) {
  const { numero } = vale.venta;
  const { overlay, cerrar } = abrir(vale, {
    title: 'Orden de venta',
    bodyHtml: `${subtitulo(vale)}${htmlCampo(numero)}`,
    footerHtml: '<button type="button" class="btn btn--danger venta-borrar" id="btn-borrar">Borrar OV</button><button type="button" class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button type="button" class="btn btn--primary" id="btn-confirmar">Guardar cambio</button>'
  });
  const resuelta = (mensaje) => pantallaResuelta(overlay, cerrar, mensaje);
  abierto.alResolver = () => resuelta(`Tu supervisor ya confirmó o rechazó la venta de ${vale.correlativo}. La lista se actualizó.`);
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelector('#btn-borrar').addEventListener('click', () => confirmarBorrado(vale, cerrar));
  conectarCampo(overlay, overlay.querySelector('#btn-confirmar'), {
    enviando: 'Guardando…',
    alResuelta: resuelta,
    guardar: async (nuevo) => {
      await corregirVenta(vale.id, nuevo);
      if (nuevo !== numero) window.toast.success('OV actualizada', `${vale.correlativo}: ahora es la OV ${nuevo}.`);
      cerrar();
      cargarBuzon();
    }
  });
}

function confirmarBorrado(vale, cerrarAdministrar) {
  const { numero } = vale.venta;
  const { overlay, cerrar } = abrirModal({
    title: '¿Borrar la OV?',
    bodyHtml: parrafo(`Se quitará la OV ${numero} del vale ${vale.correlativo}. Podrás registrar otra cuando quieras.`),
    footerHtml: '<button type="button" class="btn btn--ghost" id="btn-no">Cancelar</button><button type="button" class="btn btn--danger" id="btn-si">Sí, borrar</button>'
  });
  overlay.querySelector('#btn-no').addEventListener('click', cerrar);
  const si = overlay.querySelector('#btn-si');
  si.addEventListener('click', async () => {
    si.disabled = true;
    try {
      await borrarVenta(vale.id);
      window.toast.success('OV borrada', `${vale.correlativo} quedó sin orden de venta.`);
      cerrar();
      cerrarAdministrar();
      cargarBuzon();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      cargarBuzon();
    }
  });
}

const DECISIONES = {
  confirmar: {
    titulo: 'Confirmar venta',
    pregunta: (vale, numero) => `¿Deseas confirmar como vendido el vale ${vale.correlativo} con la orden de venta ${numero}?`,
    seguro: (vale, numero) => `Vas a confirmar la venta de ${vale.correlativo} con la OV ${numero}. Esta acción no se puede deshacer.`,
    clase: 'btn--primary',
    final: 'Sí, confirmar venta',
    enviar: confirmarVenta,
    hecho: (vale, numero) => window.toast.success('Venta confirmada', `${vale.correlativo} quedó vendido con la OV ${numero}.`)
  },
  rechazar: {
    titulo: 'Rechazar venta',
    pregunta: (vale, numero) => `¿Deseas rechazar la orden de venta ${numero} del vale ${vale.correlativo}?`,
    seguro: (vale, numero) => `Se rechazará la OV ${numero}. El asesor recibirá un aviso y podrá registrar otra.`,
    clase: 'btn--danger',
    final: 'Sí, rechazar',
    enviar: rechazarVenta,
    hecho: (vale, numero) => window.toast.success('Venta rechazada', `${vale.correlativo}: se rechazó la OV ${numero}.`)
  }
};

// Doble confirmación del supervisor; siempre envía el número que está viendo.
function abrirDecision(vale, decision) {
  const { overlay, cerrar } = abrir(vale, {
    title: decision.titulo, bodyHtml: '', footerHtml: '<button type="button" class="btn btn--ghost">Cancelar</button>'
  });
  const preguntar = () => pintar(overlay, decision.titulo, parrafo(decision.pregunta(vale, abierto.numero)), [
    { texto: 'Cancelar', alPulsar: cerrar },
    { texto: 'Continuar', clase: decision.clase, alPulsar: asegurar }
  ]);
  const asegurar = () => pintar(overlay, '¿Estás seguro?', parrafo(decision.seguro(vale, abierto.numero)), [
    { texto: 'Volver', alPulsar: preguntar },
    { texto: decision.final, clase: decision.clase, alPulsar: enviar }
  ]);
  const enviar = async (boton) => {
    boton.disabled = true;
    abierto.enviando = true;
    const numero = abierto.numero;
    try {
      await decision.enviar(vale.id, numero);
      decision.hecho(vale, numero);
      cerrar();
    } catch (error) {
      abierto.enviando = false;
      if (error.codigo === 'OV_CAMBIO') cambio(error.numeroActual);
      else if (error.codigo === 'OV_RESUELTA') resuelta();
      else if (error.codigo === 'OV_RETIRADA') retirada(error.message);
      else { boton.disabled = false; mostrarErrorModal(overlay, error.message); }
    }
    cargarBuzon();
  };
  const cambio = (nuevo) => {
    const antes = abierto.numero;
    abierto.numero = nuevo;
    pintar(overlay, decision.titulo, `
      <div class="form-aviso" role="alert"><ion-icon name="alert-circle-outline"></ion-icon><span>${AVISO_CAMBIO}</span></div>
      ${parrafo(`Nueva OV: ${nuevo} (antes ${antes})`)}
    `, [
      { texto: 'Cerrar', alPulsar: cerrar },
      { texto: 'Revisar nuevo número', clase: 'btn--primary', alPulsar: preguntar }
    ]);
  };
  const resuelta = () => pantallaResuelta(overlay, cerrar, `Otro supervisor ya confirmó o rechazó la venta de ${vale.correlativo}. La lista se actualizó.`);
  const retirada = (mensaje) => pintar(overlay, decision.titulo, parrafo(mensaje), [{ texto: 'Entendido', clase: 'btn--primary', alPulsar: cerrar }]);
  Object.assign(abierto, { alCambiar: cambio, alResolver: resuelta, alRetirar: retirada });
  preguntar();
}

export const abrirModalConfirmarVenta = (vale) => abrirDecision(vale, DECISIONES.confirmar);
export const abrirModalRechazarVenta = (vale) => abrirDecision(vale, DECISIONES.rechazar);
