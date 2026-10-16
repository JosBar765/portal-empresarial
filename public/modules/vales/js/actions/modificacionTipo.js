import { abrirModal } from '../components/modal.js';
import { escapeHtml, siguienteCodigoMod } from '../utils/formato.js';
import { abrirModalSolicitarModificacion } from '../forms/valeForm.js';
import { abrirModalModificacionBasica } from './modificacionBasica.js';

// Tipos de modificación según el tamaño del cambio. Los días son mínimos y se cuentan en días hábiles desde hoy.
const TIPOS = [
  {
    id: 'BASICA', nombre: 'Básica', dias: '+1 día', icono: 'chatbubbles-outline',
    resumen: 'Un ajuste pequeño, acordado por chat con el taller.',
    ejemplo: 'Ej.: cambiar un color o un texto.',
    chips: () => [['chatbubble-outline', 'Chat con el taller'], ['documents-outline', 'Sin vale nuevo']]
  },
  {
    id: 'MEDIA', nombre: 'Media', dias: '+2 días', icono: 'create-outline',
    resumen: 'Un cambio mediano, con vale nuevo.',
    ejemplo: 'Ej.: ajustar medidas o materiales.',
    chips: (vale) => [['document-text-outline', `Crea ${siguienteCodigoMod(vale)}`], ['person-outline', 'Autoriza tu supervisor']]
  },
  {
    id: 'AVANZADA', nombre: 'Avanzada', dias: '+3 días', icono: 'construct-outline',
    resumen: 'Un cambio grande o un rediseño, con vale nuevo.',
    ejemplo: 'Ej.: otro diseño u otro producto.',
    chips: (vale) => [['document-text-outline', `Crea ${siguienteCodigoMod(vale)}`], ['person-outline', 'Autoriza tu supervisor']]
  }
];

// Asesor: elige el tipo de modificación y sigue con su flujo (chat con el taller, o formulario del vale MOD).
// La básica solo existe mientras el vale espera tu confirmación: el taller rehace la propuesta antes de que lo recibas.
export function abrirSelectorModificacion(vale) {
  const disponibles = TIPOS.filter(t => t.id !== 'BASICA' || vale.estado === 'PENDIENTE_CONFIRMACION');
  const { overlay, cerrar } = abrirModal({
    title: `Solicitar modificación — ${vale.correlativo}`,
    size: 'lg',
    bodyHtml: `
      <p class="mod-intro">¿Qué tan grande es el cambio?</p>
      <div class="mod-tipos" role="radiogroup" aria-label="Tipo de modificación">
        ${disponibles.map(t => `
          <label class="mod-tipo">
            <input type="radio" name="mod-tipo" value="${t.id}" class="sr-only">
            <span class="mod-tipo-cuerpo">
              <span class="mod-tipo-cab">
                <ion-icon name="${t.icono}" aria-hidden="true"></ion-icon><strong>${t.nombre}</strong>
                <span class="mod-tipo-dias">${t.dias}</span>
                <span class="mod-tipo-marca" aria-hidden="true"></span>
              </span>
              <span class="mod-tipo-resumen">${escapeHtml(t.resumen)}</span>
              <span class="mod-tipo-ejemplo">${escapeHtml(t.ejemplo)}</span>
              <span class="mod-tipo-chips">${t.chips(vale).map(([i, txt]) => `<span class="mod-chip"><ion-icon name="${i}" aria-hidden="true"></ion-icon>${escapeHtml(txt)}</span>`).join('')}</span>
            </span>
          </label>`).join('')}
      </div>
      ${disponibles.length < TIPOS.length ? '<p class="mod-aviso"><ion-icon name="information-circle-outline" aria-hidden="true"></ion-icon>La básica solo se pide antes de confirmar el vale.</p>' : ''}
      <details class="mod-info">
        <summary><ion-icon name="help-circle-outline" aria-hidden="true"></ion-icon>¿Cuál elijo?</summary>
        <ul class="mod-info-lista">
          <li><strong>Básica:</strong> sin vale nuevo. El taller acepta o rechaza por chat y la entrega sube 1 día hábil.</li>
          <li><strong>Media y Avanzada:</strong> crean un vale MOD que autoriza tu supervisor.</li>
          <li>Los días son <strong>mínimos</strong>, contados en días hábiles desde hoy. En Media y Avanzada puedes elegir más.</li>
        </ul>
      </details>
    `,
    footerHtml: '<button class="btn btn--ghost" id="mod-cancelar">Cancelar</button><button class="btn btn--primary" id="mod-continuar" disabled>Continuar</button>'
  });
  const continuar = overlay.querySelector('#mod-continuar');
  const seguir = () => {
    const elegido = overlay.querySelector('input[name="mod-tipo"]:checked');
    if (!elegido) return;
    cerrar();
    if (elegido.value === 'BASICA') abrirModalModificacionBasica(vale);
    else abrirModalSolicitarModificacion(vale, elegido.value);
  };
  overlay.querySelectorAll('input[name="mod-tipo"]').forEach(r => {
    r.addEventListener('change', () => { continuar.disabled = false; });
    // Doble clic en una tarjeta: elige y continúa.
    r.closest('.mod-tipo').addEventListener('dblclick', () => { r.checked = true; seguir(); });
  });
  overlay.querySelector('#mod-cancelar').addEventListener('click', cerrar);
  continuar.addEventListener('click', seguir);
  const primero = overlay.querySelector('input[name="mod-tipo"]');
  if (primero) primero.focus();
}
