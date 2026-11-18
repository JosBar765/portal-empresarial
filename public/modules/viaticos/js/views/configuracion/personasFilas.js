// Fila de «Personas» como HTML puro (sin DOM); todo texto del servidor pasa por escapeHtml.
import { escapeHtml } from '../../utils/formato.js';
import { t } from '../../textos.js';
import { celda, celdaAcciones, conValor, htmlVigencia } from './filas.js';
import { textoLicencia, textoPaises } from './personasModelo.js';

export function htmlFilaPersona(persona, hoyIso) {
  const licencia = persona.licencia;
  return `<tr data-id="${Number(persona.id)}">
    ${celda(t('config.personas.col.nombre'), `<strong>${escapeHtml(persona.nombre)}</strong>`)}
    ${celda(t('config.personas.col.correo'), conValor(persona.email), 'vi-celda-secundaria')}
    ${celda(t('config.personas.col.rol'), conValor(persona.rol))}
    ${celda(t('config.personas.col.paises'), conValor(textoPaises(persona.paises)))}
    ${celda(t('config.personas.col.licencia'), conValor(textoLicencia(licencia)))}
    ${celda(t('config.personas.col.vence'), htmlVigencia(licencia && licencia.venceEl, hoyIso))}
    ${celdaAcciones({ id: persona.id, nombre: persona.nombre, activo: true, alternable: false })}
  </tr>`;
}
