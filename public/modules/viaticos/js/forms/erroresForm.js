// Errores del formulario: une los del servidor con los locales (renglones a medias) y los pinta junto a cada campo.
// Un error de un campo que el usuario aún no tocó no se muestra (un formulario vacío no debe verse como un campo de errores),
// pero sí cuenta para bloquear el envío; los de la licencia se ven siempre porque no hay campo que corregir.
import { TEXTOS, t } from '../textos.js';
import { marcarErroresDeCampos } from '../components/validacion.js';
import { crearAviso } from '../components/aviso.js';
import { erroresLocales, familiaDeCampo, raizDeCampo, remapearCampo } from './datos.js';

// Todos los errores vigentes como { campo, mensaje }, sin filtrar por lo tocado.
export function erroresVigentes(ctx) {
  const locales = erroresLocales(ctx.estado, ctx.catalogos).map(e => ({ campo: e.campo, mensaje: t(e.clave, e.params) }));
  const rutaIncompleta = locales.some(e => e.campo === 'origenInicialId' || e.campo.startsWith('tramos['));
  // Un error general de lista (tramos, fluidos, kit…) sobra si ya hay renglones a medias que lo explican; la hora mala explica la fecha que falta.
  const explicado = (campo) => (campo === 'tramos' && rutaIncompleta)
    || (['inspeccion.fluidos', 'inspeccion.kit', 'inspeccion.defectos'].includes(campo) && locales.some(l => l.campo.startsWith(`${campo}[`)))
    || (campo === 'fechaSalida' && locales.some(l => l.campo === 'horaSalida'));
  const servidor = ctx.erroresServidor.filter(e => !explicado(e.campo) && !locales.some(l => l.campo === e.campo));
  return [...locales, ...servidor];
}

const esVisible = (ctx, campo) => campo === 'licencia' || ctx.intentoEnvio || ctx.tocados.has(raizDeCampo(campo));

// Traduce un `campos` del servidor (posiciones dentro de lo enviado) a errores de la pantalla.
export function erroresDeCampos(campos, indices) {
  return Object.entries(campos || {}).map(([campo, mensaje]) => ({ campo: remapearCampo(campo, indices), mensaje: String(mensaje) }));
}

// Nombres de los campos pendientes para el motivo del botón de envío (máximo cuatro).
export function camposPendientes(errores) {
  const nombres = [];
  for (const e of errores) {
    const clave = `formulario.campo.${familiaDeCampo(e.campo)}`;
    const nombre = clave in TEXTOS ? t(clave) : t('formulario.campo.otro');
    if (!nombres.includes(nombre)) nombres.push(nombre);
  }
  const mostrados = nombres.slice(0, 4).join(', ');
  return nombres.length > 4 ? t('formulario.envio.ymas', { campos: mostrados, n: nombres.length - 4 }) : mostrados;
}

export function pintarErrores(ctx, { form, bloqueos }) {
  form.querySelectorAll('[data-origen-error]').forEach(campo => {
    campo.classList.remove('is-invalid');
    const mensaje = campo.querySelector(':scope > .field-error');
    if (mensaje) mensaje.remove();
    delete campo.dataset.origenError;
  });
  const visibles = erroresVigentes(ctx).filter(e => esVisible(ctx, e.campo));
  const campos = {};
  const licencia = [];
  for (const e of visibles) {
    if (e.campo === 'licencia') licencia.push(e.mensaje);
    else if (!(e.campo in campos)) campos[e.campo] = e.mensaje;
  }
  const { sueltos } = marcarErroresDeCampos(form, campos);
  form.querySelectorAll('[data-banner-campos]').forEach(b => b.remove());
  form.querySelectorAll('.form-field.is-invalid:not([data-origen-error])').forEach(campo => { campo.dataset.origenError = '1'; });
  bloqueos.replaceChildren(
    ...licencia.map(mensaje => crearAviso({ tipo: 'error', titulo: t('formulario.bloqueo.licencia'), texto: mensaje })),
    ...sueltos.map(mensaje => crearAviso({ tipo: 'error', titulo: t('formulario.bloqueo.general'), texto: mensaje })));
}
