// Campo «Conductor» de la sección de vehículo: «Yo» (por defecto) o un piloto de la empresa, con la franja «Tramitando para».
// Solo existe si el catálogo trae pilotos activos; devuelve null si no hay.
import { h } from '../../utils/dom.js';
import { crearCombo } from '../../components/comboAgrupado.js';
import { crearCampo } from '../../components/campo.js';
import { aId, pilotoDelEstado } from '../datos.js';
import { t } from '../../textos.js';

// El prefijo de país del código (GT-B) sobra en el selector: la licencia ya es del país de la solicitud.
const textoPiloto = (p) => t('formulario.conductor.piloto', { nombre: p.nombre, tipo: String(p.tipoLicenciaCodigo).replace(/^[A-Z]{2}-/, '') });

export function crearCampoConductor(ctx) {
  const { estado, catalogos } = ctx;
  const pilotos = catalogos.pilotos || [];
  if (pilotos.length === 0) return null;

  const combo = crearCombo({
    id: 'vi-sol-piloto', name: 'pilotoId', etiquetaAria: t('formulario.conductor.etiqueta'),
    grupos: [{ opciones: [{ valor: '', texto: t('formulario.conductor.yo') }, ...pilotos.map(p => ({ valor: p.id, texto: textoPiloto(p) }))] }],
    valor: estado.pilotoId,
    alCambiar: (v) => { estado.pilotoId = aId(v); ctx.cambio('piloto'); }
  });
  const franja = h('p', { class: 'vi-franja-conductor', id: 'vi-sol-piloto-franja', role: 'status' });

  // Con piloto la franja lo nombra y recuerda de quién es la licencia que se valida.
  function pintar() {
    const piloto = pilotoDelEstado(estado, catalogos);
    franja.style.display = piloto ? '' : 'none';
    franja.textContent = piloto ? t('formulario.conductor.tramitando', { nombre: piloto.nombre, tipo: piloto.tipoLicenciaNombre }) : '';
    // El valor puede haber vuelto a «Yo» al reconciliar (piloto desactivado): se refleja en el combo.
    if (combo.value !== String(estado.pilotoId)) combo.value = String(estado.pilotoId);
  }
  ctx.suscribir('piloto', pintar);
  pintar();

  return { el: h('div', { class: 'vi-conductor' }, crearCampo({ etiqueta: t('formulario.conductor.etiqueta'), control: combo, idControl: 'vi-sol-piloto' }), franja) };
}
