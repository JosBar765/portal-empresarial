import { abrirModal } from '../components/modal.js';
import { escapeHtml, siguienteCodigoMod } from '../utils/formato.js';
import { abrirModalSolicitarModificacion } from '../forms/valeForm.js';
import { abrirModalModificacionBasica } from './modificacionBasica.js';

// Tipos de modificación según la complejidad del cambio. Los días son mínimos contados en días hábiles desde el día de la solicitud.
const TIPOS = [
  {
    id: 'BASICA', nombre: 'Básica', dias: '+1 día hábil', icono: 'chatbubbles-outline',
    resumen: 'Un cambio muy pequeño que se acuerda conversando con el taller.',
    datos: () => ['No crea otro vale', 'Chat con el taller: acepta o rechaza', 'No valida el cupo del taller'],
    info: 'Para un ajuste mínimo (un color, una palabra, un detalle). <strong>No se crea otro vale:</strong> le cuentas el cambio al taller por un chat y, si lo acepta, rehace la propuesta y la envía para tu confirmación. La fecha de entrega se mueve exactamente 1 día hábil.'
  },
  {
    id: 'MEDIA', nombre: 'Media', dias: '+2 días hábiles', icono: 'create-outline',
    resumen: 'Un cambio de tamaño intermedio, con vale MOD.',
    datos: (vale) => [`Se crea el vale ${siguienteCodigoMod(vale)}`, 'Lo autoriza tu supervisor', 'Entrega: mínimo 2 días hábiles desde hoy (puedes poner más)'],
    info: 'Para un cambio intermedio. Se crea un <strong>vale MOD</strong> con la propuesta actual adjunta y tu supervisor debe autorizarlo. La fecha de entrega debe ser de al menos 2 días hábiles desde hoy (puedes elegir más). No admite «urgente».'
  },
  {
    id: 'AVANZADA', nombre: 'Avanzada', dias: '+3 días hábiles', icono: 'construct-outline',
    resumen: 'Un cambio grande o un rediseño, con vale MOD.',
    datos: (vale) => [`Se crea el vale ${siguienteCodigoMod(vale)}`, 'Lo autoriza tu supervisor', 'Entrega: mínimo 3 días hábiles desde hoy (puedes poner más)'],
    info: 'Para un cambio grande (rediseño, otro producto o material). Funciona igual que la Media, pero la fecha de entrega debe ser de al menos 3 días hábiles desde hoy. Los vales MOD se acumulan: MOD, MOD2, MOD3…'
  }
];

// Asesor: elige el tipo de modificación y sigue con su flujo (conversación con el taller, o vale MOD con el formulario).
// La básica solo existe mientras el vale espera tu confirmación: el taller rehace la propuesta antes de que lo recibas.
export function abrirSelectorModificacion(vale) {
  const disponibles = TIPOS.filter(t => t.id !== 'BASICA' || vale.estado === 'PENDIENTE_CONFIRMACION');
  const { overlay, cerrar } = abrirModal({
    title: `Solicitar modificación — ${vale.correlativo}`,
    size: 'lg',
    bodyHtml: `
      <p class="mod-intro">¿Qué tan grande es el cambio? Elige el tipo de modificación.</p>
      <div class="mod-tipos" role="radiogroup" aria-label="Tipo de modificación">
        ${disponibles.map(t => `
          <label class="mod-tipo">
            <input type="radio" name="mod-tipo" value="${t.id}" class="sr-only">
            <span class="mod-tipo-cuerpo">
              <span class="mod-tipo-cab"><ion-icon name="${t.icono}" aria-hidden="true"></ion-icon><strong>${t.nombre}</strong><span class="mod-tipo-dias">${t.dias}</span></span>
              <span class="mod-tipo-resumen">${escapeHtml(t.resumen)}</span>
              <ul class="mod-tipo-datos">${t.datos(vale).map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>
            </span>
          </label>`).join('')}
      </div>
      ${disponibles.length < TIPOS.length ? '<p class="form-nota">La modificación básica solo se puede pedir mientras el vale espera tu confirmación, porque el taller rehace la propuesta antes de que lo recibas.</p>' : ''}
      <details class="mod-info">
        <summary><ion-icon name="information-circle-outline" aria-hidden="true"></ion-icon> ¿Qué es cada modificación?</summary>
        <div class="mod-info-cuerpo">
          ${TIPOS.map(t => `<p><strong>${t.nombre} (${t.dias}).</strong> ${t.info}</p>`).join('')}
          <p>Los días son <strong>mínimos</strong> y se cuentan en días hábiles desde hoy. En la Media y la Avanzada puedes elegir una fecha de entrega más lejana.</p>
        </div>
      </details>
    `,
    footerHtml: '<button class="btn btn--ghost" id="mod-cancelar">Cancelar</button><button class="btn btn--primary" id="mod-continuar" disabled>Continuar</button>'
  });
  const continuar = overlay.querySelector('#mod-continuar');
  overlay.querySelectorAll('input[name="mod-tipo"]').forEach(r => r.addEventListener('change', () => { continuar.disabled = false; }));
  overlay.querySelector('#mod-cancelar').addEventListener('click', cerrar);
  continuar.addEventListener('click', () => {
    const elegido = overlay.querySelector('input[name="mod-tipo"]:checked');
    if (!elegido) return;
    cerrar();
    if (elegido.value === 'BASICA') abrirModalModificacionBasica(vale);
    else abrirModalSolicitarModificacion(vale, elegido.value);
  });
  const primero = overlay.querySelector('input[name="mod-tipo"]');
  if (primero) primero.focus();
}
