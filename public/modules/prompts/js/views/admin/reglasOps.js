// Operaciones puras (sin DOM) sobre las reglas específicas del esquema; nunca mutan sus argumentos.
// Los mensajes salen de textos.js; los límites llegan por parámetro desde /config.
import { t } from '../../textos.js';
import { POSICIONES } from './reglasEsquema.js';
import { claveValida, clavesDeReglas, clavesDelEsquema, clavesDeRecursos, claveReservadaPorSistema, intercambiar } from './esquemaOps.js';

export const reglasDe = (esquema) => esquema.reglas || [];

export const reglaVacia = () => ({ clave: '', etiqueta: '', texto: '', posicion: 'inicio', activo: true });

const conReglas = (esquema, reglas) => ({ ...esquema, reglas });

// Una clave de regla no puede repetir un parámetro, un grupo, un recurso, otra regla ni una variable automática o derivada.
export function claveReglaDisponible(esquema, clave, automaticas = [], claveActual = null) {
  if (!claveValida(clave)) return false;
  if (clave === claveActual) return true;
  if (automaticas.includes(clave)) return false;
  return !clavesDelEsquema(esquema).includes(clave)
    && !clavesDeRecursos(esquema).includes(clave)
    && !esquema.grupos.some(g => g.clave === clave)
    && !clavesDeReglas(esquema).includes(clave)
    && !claveReservadaPorSistema(esquema, clave);
}

function buscar(esquema, clave) {
  const i = reglasDe(esquema).findIndex(r => r.clave === clave);
  if (i < 0) throw new Error(t('admin.errores.reglaNoExiste', { clave }));
  return i;
}

export function agregarRegla(esquema, regla, { automaticas = [], limites = null } = {}) {
  if (limites && reglasDe(esquema).length >= limites.reglas_max) throw new Error(t('admin.errores.reglasExceso', { max: limites.reglas_max }));
  if (!claveReglaDisponible(esquema, regla.clave, automaticas)) throw new Error(t('admin.errores.reglaClaveNoDisponible', { clave: regla.clave }));
  return conReglas(esquema, [...reglasDe(esquema), regla]);
}

export function actualizarRegla(esquema, claveOriginal, regla, { automaticas = [] } = {}) {
  const i = buscar(esquema, claveOriginal);
  if (!claveReglaDisponible(esquema, regla.clave, automaticas, claveOriginal)) throw new Error(t('admin.errores.reglaClaveNoDisponible', { clave: regla.clave }));
  return conReglas(esquema, reglasDe(esquema).map((r, k) => (k === i ? regla : r)));
}

export function eliminarRegla(esquema, clave) {
  const i = buscar(esquema, clave);
  return conReglas(esquema, reglasDe(esquema).filter((_, k) => k !== i));
}

export function moverRegla(esquema, clave, delta) {
  return conReglas(esquema, intercambiar(reglasDe(esquema), buscar(esquema, clave), delta));
}

export function alternarRegla(esquema, clave) {
  const i = buscar(esquema, clave);
  return conReglas(esquema, reglasDe(esquema).map((r, k) => (k === i ? { ...r, activo: !r.activo } : r)));
}

// Devuelve los mensajes (explicados) de lo que impide guardar la regla; vacío si está bien.
// `claveActual` = clave original al editar; null al crear (entonces también se revisa el máximo de reglas).
export function validarRegla(regla, limites, esquema, { claveActual = null, automaticas = [] } = {}) {
  const errores = [];
  const etiqueta = String(regla.etiqueta || '').trim();
  const clave = String(regla.clave || '').trim();
  const nombre = etiqueta || clave || t('admin.reglas.sinNombre');
  const texto = String(regla.texto || '');

  if (claveActual === null && reglasDe(esquema).length >= limites.reglas_max) errores.push(t('admin.errores.reglasExceso', { max: limites.reglas_max }));
  if (!etiqueta) errores.push(t('admin.errores.reglaEtiquetaVacia', { max: limites.regla_etiqueta_max }));
  else if (etiqueta.length > limites.regla_etiqueta_max) errores.push(t('admin.errores.reglaEtiquetaLarga', { nombre, largo: etiqueta.length, max: limites.regla_etiqueta_max }));

  if (!claveValida(clave)) errores.push(t('admin.errores.reglaClaveInvalida', { nombre, clave }));
  else if (automaticas.includes(clave)) errores.push(t('admin.errores.reglaClaveReservada', { nombre, clave, lista: automaticas.join(', ') }));
  else if (clave !== claveActual && claveReservadaPorSistema(esquema, clave)) errores.push(t('admin.errores.claveDerivada', { nombre, clave }));
  else if (!claveReglaDisponible(esquema, clave, automaticas, claveActual)) errores.push(t('admin.errores.reglaClaveRepetida', { nombre, clave }));

  if (texto.length > limites.regla_texto_max) errores.push(t('admin.errores.reglaTextoLargo', { nombre, largo: texto.length, max: limites.regla_texto_max }));
  else if (regla.activo && !texto.trim()) errores.push(t('admin.errores.reglaActivaSinTexto', { nombre }));

  if (!POSICIONES.includes(regla.posicion)) errores.push(t('admin.errores.reglaPosicion', { nombre }));
  return errores;
}
