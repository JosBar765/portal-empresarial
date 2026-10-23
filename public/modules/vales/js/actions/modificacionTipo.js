import { abrirModal } from '../components/modal.js';
import { escapeHtml, siguienteCodigoMod } from '../utils/formato.js';
import { abrirModalSolicitarModificacion } from '../forms/valeForm.js';

// Tipos de modificación según el tamaño del cambio. Los días son mínimos y se cuentan en días hábiles desde hoy.
const TIPOS = [
  {
    id: 'BASICA', nombre: 'Básica', dias: '+1 día', icono: 'chatbubbles-outline',
    resumen: 'Un ajuste pequeño, con vale nuevo.',
    ejemplo: 'Ej.: cambiar un color o un texto.',
    chips: (vale) => [['document-text-outline', `Crea ${siguienteCodigoMod(vale)}`], ['person-outline', 'Autoriza tu supervisor']]
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

// Asesor: elige el tipo de modificación y sigue con el formulario del vale MOD (los tres tipos lo comparten).
// `alCancelar` permite volver al modal desde el que se abrió (p. ej. el de decisión).
export function abrirSelectorModificacion(vale, { alCancelar } = {}) {
  const disponibles = TIPOS;
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
      <details class="mod-info">
        <summary><ion-icon name="help-circle-outline" aria-hidden="true"></ion-icon>¿Cuál elijo?</summary>
        <ul class="mod-info-lista">
          <li><strong>Básica, Media y Avanzada:</strong> crean un vale MOD que autoriza tu supervisor.</li>
          <li>Los días son <strong>mínimos</strong>, contados en días hábiles desde hoy (1, 2 y 3). Puedes elegir más.</li>
          <li>Una modificación nunca es para hoy. Con «Pedido urgente» basta el siguiente día disponible.</li>
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
    abrirModalSolicitarModificacion(vale, elegido.value);
  };
  overlay.querySelectorAll('input[name="mod-tipo"]').forEach(r => {
    r.addEventListener('change', () => { continuar.disabled = false; });
    // Doble clic en una tarjeta: elige y continúa.
    r.closest('.mod-tipo').addEventListener('dblclick', () => { r.checked = true; seguir(); });
  });
  overlay.querySelector('#mod-cancelar').addEventListener('click', () => { cerrar(); if (alCancelar) alCancelar(); });
  continuar.addEventListener('click', seguir);
  const primero = overlay.querySelector('input[name="mod-tipo"]');
  if (primero) primero.focus();
}
