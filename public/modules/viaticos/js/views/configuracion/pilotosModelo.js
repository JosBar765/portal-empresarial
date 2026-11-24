// Reglas puras de la subpestaña «Pilotos» (sin DOM): búsqueda, validación del cliente y payload.
import { t } from '../../textos.js';
import { esIsoValido } from '../../utils/fechas.js';
import { filtrarFilas } from './modelo.js';

// Mismos topes que las columnas de viaticos_pilotos.
export const LIMITES_PILOTO = Object.freeze({ NOMBRE: 100, NUMERO: 50 });

const vacio = (v) => v === null || v === undefined || String(v).trim() === '';

export const filtrarPilotos = (pilotos, busqueda = '') => filtrarFilas(pilotos, busqueda, (p) => [p.nombre, p.numero, p.tipoLicenciaCodigo, p.tipoLicenciaNombre, p.tipoLicenciaPaisNombre]);

// Errores del cliente como { campo: mensaje } con los nombres del servidor.
export function validarPiloto(valores) {
  const errores = {};
  for (const [campo, max] of [['nombre', LIMITES_PILOTO.NOMBRE], ['numero', LIMITES_PILOTO.NUMERO]]) {
    const etiqueta = t(`config.pilotos.campo.${campo}`);
    const texto = vacio(valores[campo]) ? '' : String(valores[campo]).trim();
    if (texto === '') errores[campo] = t('config.error.obligatorio', { campo: etiqueta });
    else if (texto.length > max) errores[campo] = t('config.error.largo', { campo: etiqueta, largo: texto.length, max });
  }
  if (vacio(valores.tipoLicenciaId)) errores.tipoLicenciaId = t('config.error.obligatorioLista', { campo: t('config.pilotos.campo.tipoLicenciaId') });
  if (vacio(valores.venceEl)) errores.venceEl = t('config.pilotos.error.venceFalta');
  else if (!esIsoValido(String(valores.venceEl))) errores.venceEl = t('config.pilotos.error.fechaInvalida');
  return errores;
}

export function armarPayloadPiloto(valores) {
  return {
    nombre: String(valores.nombre).trim(),
    tipoLicenciaId: Number(valores.tipoLicenciaId),
    numero: String(valores.numero).trim(),
    venceEl: String(valores.venceEl).trim()
  };
}
