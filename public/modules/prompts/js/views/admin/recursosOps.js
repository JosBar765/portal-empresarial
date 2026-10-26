// Operaciones puras (sin DOM) sobre los recursos fijos del esquema; nunca mutan sus argumentos.
// Los mensajes salen de textos.js; los límites llegan por parámetro desde /config.
import { t } from '../../textos.js';
import { PREFIJO_RECURSO, POSICIONES, URL_RECURSO_RE } from './reglasEsquema.js';
import { claveValida, clavesDelEsquema, clavesDeRecursos, claveReservadaPorSistema, intercambiar, renombrarEnPlantilla } from './esquemaOps.js';

export const recursosDe = (esquema) => esquema.recursos || [];

export const variableDeRecurso = (clave) => `${PREFIJO_RECURSO}${clave}`;

export const urlRecursoValida = (url) => URL_RECURSO_RE.test(String(url || '').trim());

export const recursoVacio = () => ({ clave: '', etiqueta: '', descripcion: '', url: '', posicion: 'inicio', activo: false });

const conRecursos = (esquema, recursos) => ({ ...esquema, recursos });

// Una clave de recurso no puede repetir un parámetro, otro recurso, una variable automática ni una variable que genera el sistema.
export function claveRecursoDisponible(esquema, clave, automaticas = [], claveActual = null) {
  if (!claveValida(clave)) return false;
  if (clave === claveActual) return true;
  if (automaticas.includes(clave)) return false;
  return !clavesDelEsquema(esquema).includes(clave)
    && !clavesDeRecursos(esquema).includes(clave)
    && !clavesDelEsquema(esquema).includes(variableDeRecurso(clave))
    && !claveReservadaPorSistema(esquema, clave);
}

function buscar(esquema, clave) {
  const i = recursosDe(esquema).findIndex(r => r.clave === clave);
  if (i < 0) throw new Error(t('admin.errores.recursoNoExiste', { clave }));
  return i;
}

export function agregarRecurso(esquema, recurso, { automaticas = [], limites = null } = {}) {
  if (limites && recursosDe(esquema).length >= limites.recursos_max) throw new Error(t('admin.errores.recursosExceso', { max: limites.recursos_max }));
  if (!claveRecursoDisponible(esquema, recurso.clave, automaticas)) throw new Error(t('admin.errores.recursoClaveNoDisponible', { clave: recurso.clave }));
  return conRecursos(esquema, [...recursosDe(esquema), recurso]);
}

export function actualizarRecurso(esquema, claveOriginal, recurso, { automaticas = [] } = {}) {
  const i = buscar(esquema, claveOriginal);
  if (!claveRecursoDisponible(esquema, recurso.clave, automaticas, claveOriginal)) throw new Error(t('admin.errores.recursoClaveNoDisponible', { clave: recurso.clave }));
  return conRecursos(esquema, recursosDe(esquema).map((r, k) => (k === i ? recurso : r)));
}

export function eliminarRecurso(esquema, clave) {
  const i = buscar(esquema, clave);
  return conRecursos(esquema, recursosDe(esquema).filter((_, k) => k !== i));
}

export function moverRecurso(esquema, clave, delta) {
  return conRecursos(esquema, intercambiar(recursosDe(esquema), buscar(esquema, clave), delta));
}

// Fragmentos de la plantilla que nombran la variable del recurso: {{recurso_x}}, {{#si recurso_x}} o {{#no recurso_x}}.
export function usosEnPlantilla(plantilla, clave) {
  if (!claveValida(clave)) return [];
  const re = new RegExp(`\\{\\{\\s*(?:#(?:si|no)\\s+)?${variableDeRecurso(clave)}\\s*\\}\\}`, 'g');
  return [...new Set(String(plantilla || '').match(re) || [])];
}

export const renombrarRecursoEnPlantilla = (plantilla, vieja, nueva) =>
  renombrarEnPlantilla(plantilla, variableDeRecurso(vieja), variableDeRecurso(nueva));

// Devuelve los mensajes (explicados) de lo que impide guardar el recurso; vacío si está bien.
// `claveActual` = clave original al editar; null al crear (entonces también se revisa el máximo de recursos).
export function validarRecurso(recurso, limites, esquema, { claveActual = null, automaticas = [] } = {}) {
  const errores = [];
  const etiqueta = String(recurso.etiqueta || '').trim();
  const clave = String(recurso.clave || '').trim();
  const nombre = etiqueta || clave || t('admin.recursos.sinNombre');
  const url = String(recurso.url || '').trim();

  if (claveActual === null && recursosDe(esquema).length >= limites.recursos_max) errores.push(t('admin.errores.recursosExceso', { max: limites.recursos_max }));
  if (!etiqueta) errores.push(t('admin.errores.recursoEtiquetaVacia', { max: limites.recurso_etiqueta_max }));
  else if (etiqueta.length > limites.recurso_etiqueta_max) errores.push(t('admin.errores.recursoEtiquetaLarga', { nombre, largo: etiqueta.length, max: limites.recurso_etiqueta_max }));

  if (!claveValida(clave)) errores.push(t('admin.errores.recursoClaveInvalida', { nombre, clave }));
  else if (automaticas.includes(clave)) errores.push(t('admin.errores.recursoClaveReservada', { nombre, clave, lista: automaticas.join(', ') }));
  else if (clave !== claveActual && claveReservadaPorSistema(esquema, clave)) errores.push(t('admin.errores.claveDerivada', { nombre, clave }));
  else if (!claveRecursoDisponible(esquema, clave, automaticas, claveActual)) errores.push(t('admin.errores.recursoClaveRepetida', { nombre, clave }));

  const descripcion = String(recurso.descripcion || '').trim();
  if (descripcion.length > limites.recurso_descripcion_max) errores.push(t('admin.errores.recursoDescripcionLarga', { nombre, largo: descripcion.length, max: limites.recurso_descripcion_max }));

  if (!POSICIONES.includes(recurso.posicion)) errores.push(t('admin.errores.recursoPosicion', { nombre }));

  if (recurso.activo && !url) errores.push(t('admin.errores.recursoActivoSinUrl', { nombre }));
  else if (url && !urlRecursoValida(url)) errores.push(t('admin.errores.recursoUrlInvalida', { nombre, url }));
  return errores;
}
