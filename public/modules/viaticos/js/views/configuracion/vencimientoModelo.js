// Reglas puras de la subpestaña «Vencimientos» (sin DOM): ajustes numéricos, detección de cambios, validación y payloads.
import { t } from '../../textos.js';

// Mismos límites que AJUSTES del servidor (constantes.js), que es quien decide; `ejemplo` solo ilustra el campo.
export const CAMPOS = Object.freeze([
  { clave: 'rechazo_vigencia_horas', min: 1, max: 168, ejemplo: 4 },
  { clave: 'borrador_vigencia_dias', min: 1, max: 365, ejemplo: 30 },
  { clave: 'borrador_max_por_usuario', min: 1, max: 200, ejemplo: 15 }
]);

const CLAVES = CAMPOS.map(c => c.clave);

// GET /config/ajustes -> { [clave]: 'texto' }; un ajuste ausente queda sin valor.
export function ajustesIniciales(lista) {
  const valores = {};
  for (const clave of CLAVES) {
    const ajuste = Array.isArray(lista) ? lista.find(a => a.clave === clave) : null;
    valores[clave] = ajuste && ajuste.valor !== null && ajuste.valor !== undefined ? String(ajuste.valor) : '';
  }
  return valores;
}

// Claves de ajuste cuyo valor cambió.
export const ajustesCambiados = (iniciales, actuales) => CLAVES.filter(clave => String(iniciales[clave]).trim() !== String(actuales[clave]).trim());

// Errores del cliente como { clave: mensaje }, con la clave del ajuste.
export function validarAjustes(actuales) {
  const errores = {};
  for (const { clave, min, max } of CAMPOS) {
    const texto = String(actuales[clave] ?? '').trim();
    const params = { campo: t(`config.vencimiento.campo.${clave}`), min, max };
    if (texto === '') errores[clave] = t('config.vencimiento.error.falta', params);
    else if (!/^\d{1,4}$/.test(texto) || Number(texto) < min || Number(texto) > max) errores[clave] = t('config.vencimiento.error.rango', params);
  }
  return errores;
}

// Valor que viaja en PUT /config/ajustes/:clave.
export const valorDeAjuste = (clave, actuales) => Number(String(actuales[clave]).trim());
