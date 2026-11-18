// Sección «Solicitud»: país, tipo de viaje y moneda. Es fija: no se reconstruye al cambiar de país.
import { h } from '../../utils/dom.js';
import { MODALIDADES } from '../../config/constantes.js';
import { crearCombo, llenarCombo, opcionesDe } from '../../components/comboAgrupado.js';
import { crearCampo, crearSeccionForm } from '../../components/campo.js';
import { aId } from '../datos.js';
import { t } from '../../textos.js';

const OPCIONES_TIPO = [
  { valor: MODALIDADES.MAS_DE_UN_DIA, clave: 'formulario.tipo.masDeUnDia' },
  { valor: MODALIDADES.HASTA_UN_DIA, clave: 'formulario.tipo.hastaUnDia' }
];

// Control segmentado accesible: un grupo de radios con flechas para moverse entre ellos.
function crearSegmentado(ctx) {
  // Al modificar, el tipo de viaje no se puede cambiar: los botones quedan deshabilitados.
  const botones = OPCIONES_TIPO.map(o => h('button', { type: 'button', role: 'radio', class: 'vi-segmentado__opcion', 'data-modalidad': o.valor, text: t(o.clave), disabled: ctx.modo === 'modificar' }));
  const grupo = h('div', { class: 'vi-segmentado', role: 'radiogroup', 'aria-labelledby': 'vi-sol-tipo-etiqueta' }, botones);
  const pintar = () => botones.forEach(b => {
    const activo = b.dataset.modalidad === ctx.estado.modalidad;
    b.setAttribute('aria-checked', String(activo));
    b.tabIndex = activo ? 0 : -1;
    b.classList.toggle('is-activa', activo);
  });
  const elegir = (valor) => {
    if (valor === ctx.estado.modalidad) return;
    ctx.estado.modalidad = valor;
    pintar();
    ctx.cambio('modalidad');
  };
  botones.forEach((b) => {
    b.addEventListener('click', () => elegir(b.dataset.modalidad));
    b.addEventListener('keydown', (e) => {
      const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!paso) return;
      e.preventDefault();
      const actual = botones.indexOf(b);
      const siguiente = botones[(actual + paso + botones.length) % botones.length];
      elegir(siguiente.dataset.modalidad);
      siguiente.focus();
    });
  });
  pintar();
  return grupo;
}

export function crearSeccionSolicitud(ctx, { alElegirPais }) {
  const { estado } = ctx;
  const paises = ctx.contexto.paises || [];
  const pais = crearCombo({
    id: 'vi-sol-pais', name: 'paisId', etiquetaAria: t('formulario.pais.etiqueta'), placeholder: t('formulario.pais.placeholder'),
    grupos: [{ opciones: opcionesDe(paises, p => p.nombre) }], valor: estado.paisId, deshabilitado: ctx.modo === 'modificar', alCambiar: (v) => alElegirPais(aId(v))
  });
  const moneda = crearCombo({
    id: 'vi-sol-moneda', name: 'monedaId', etiquetaAria: t('formulario.moneda.etiqueta'), placeholder: t('formulario.moneda.placeholder'),
    grupos: [], deshabilitado: true, alCambiar: (v) => { estado.monedaId = aId(v); ctx.cambio('moneda'); }
  });
  const campoMoneda = crearCampo({ etiqueta: t('formulario.moneda.etiqueta'), control: moneda, idControl: 'vi-sol-moneda' });
  const tipo = h('div', { class: 'form-field' },
    h('span', { class: 'vi-etiqueta', id: 'vi-sol-tipo-etiqueta', text: t('formulario.tipo.etiqueta') }),
    crearSegmentado(ctx));

  // Las monedas llegan con los catálogos; solo aplican a los viajes de más de 1 día.
  function pintarMonedas() {
    const monedas = ctx.catalogos ? ctx.catalogos.monedas : [];
    llenarCombo(moneda, { placeholder: t('formulario.moneda.placeholder'), grupos: [{ opciones: opcionesDe(monedas, m => `${m.nombre} (${m.simbolo})`) }], valor: estado.monedaId });
    moneda.disabled = monedas.length === 0 || ctx.modo === 'modificar';
    campoMoneda.style.display = estado.modalidad === MODALIDADES.MAS_DE_UN_DIA ? '' : 'none';
  }
  ctx.suscribir('catalogos', pintarMonedas, true);
  ctx.suscribir('modalidad', pintarMonedas, true);

  const el = crearSeccionForm({ id: 'vi-sol-seccion-solicitud', titulo: t('formulario.seccion.solicitud') },
    h('div', { class: 'vi-grid vi-grid--3' },
      crearCampo({ etiqueta: t('formulario.pais.etiqueta'), control: pais, idControl: 'vi-sol-pais' }),
      tipo,
      campoMoneda));
  return { el };
}
