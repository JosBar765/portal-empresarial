// Sección «Comidas por día»: una fila por cada día del viaje con desayuno, almuerzo y cena; los totales los calcula el servidor.
import { h } from '../../utils/dom.js';
import { crearSeccionForm } from '../../components/campo.js';
import { crearAviso } from '../../components/aviso.js';
import { crearTotales, ponerTotal } from '../../components/renglones.js';
import { formatearDinero } from '../../utils/formato.js';
import { diasEntre, etiquetaDia } from '../../utils/fechas.js';
import { alternarMarca, depurarMarcas, valoresComidaDeMoneda } from '../datos.js';
import { t } from '../../textos.js';

const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function crearSeccionComidas(ctx) {
  const { estado, catalogos } = ctx;
  const tipos = [...catalogos.tiposComida].sort((a, b) => a.orden - b.orden);
  const ayuda = h('p', { class: 'vi-ayuda', id: 'vi-sol-comidas-valores', 'aria-live': 'polite' });
  const avisos = h('div', { class: 'vi-avisos' });
  const mensaje = h('p', { class: 'vi-ayuda vi-vacio', id: 'vi-sol-comidas-mensaje', 'aria-live': 'polite' });
  const tabla = h('div', { class: 'vi-comidas', id: 'vi-sol-comidas-dias' });
  const listaCampo = h('div', { class: 'form-field vi-lista-campo', 'data-campo': 'comidas' }, mensaje, tabla);
  const totales = crearTotales([
    ...tipos.map(tipo => ({ id: `vi-sol-comida-total-${tipo.id}`, etiqueta: `${capitalizar(tipo.nombre)}s`, valor: '' })),
    { id: 'vi-sol-total-comidas', etiqueta: t('formulario.comidas.total'), valor: '', fuerte: true }
  ], { id: 'vi-sol-totales-comidas' });

  function pintar() {
    const dias = diasEntre(estado.fechaSalida, estado.fechaRegreso);
    const valores = valoresComidaDeMoneda(catalogos.valoresComida, estado.monedaId);
    const moneda = ctx.moneda();
    const simbolo = ctx.simbolo();
    estado.comidas = depurarMarcas(estado.comidas, dias, valores);

    ayuda.textContent = moneda
      ? t('formulario.comidas.valores', { valores: tipos.filter(x => valores[x.id]).map(x => `${x.nombre} ${formatearDinero(simbolo, valores[x.id])}`).join(', ') || t('formulario.comidas.ninguno') })
      : t('formulario.comidas.sinMoneda');
    const sinValor = moneda ? tipos.filter(x => !valores[x.id]) : [];
    avisos.replaceChildren(...(sinValor.length ? [crearAviso({
      tipo: 'warning', titulo: t('formulario.comidas.faltaValorTitulo'),
      texto: t('formulario.comidas.faltaValor', { comidas: sinValor.map(x => x.nombre).join(', '), moneda: moneda.nombre })
    })] : []));

    const cabecera = h('div', { class: 'vi-comidas__fila vi-comidas__fila--cabecera', 'aria-hidden': 'true' },
      h('span', { text: t('formulario.comidas.dia') }),
      tipos.map(tipo => h('span', { class: 'vi-comidas__tipo' }, capitalizar(tipo.nombre), moneda && !valores[tipo.id] && h('small', { text: t('formulario.comidas.sinValor') }))));
    const filas = dias.map(dia => h('div', { class: 'vi-comidas__fila', 'data-dia': dia },
      h('span', { class: 'vi-comidas__dia', text: etiquetaDia(dia) }),
      tipos.map(tipo => {
        const habilitada = !!valores[tipo.id];
        const input = h('input', { type: 'checkbox', id: `vi-sol-comida-${dia}-${tipo.id}`, 'data-dia': dia, 'data-tipo': String(tipo.id), checked: !!(estado.comidas[dia] && estado.comidas[dia][tipo.id]), disabled: !habilitada });
        input.addEventListener('change', () => { estado.comidas = alternarMarca(estado.comidas, dia, tipo.id, input.checked); ctx.cambio('comidas'); });
        return h('label', { class: 'vi-check', title: habilitada ? undefined : t('formulario.comidas.sinValor') },
          input, h('span', { class: 'vi-solo-lector', text: t('formulario.comidas.marcar', { comida: tipo.nombre, dia: etiquetaDia(dia) }) }));
      })));
    tabla.replaceChildren(...(dias.length ? [cabecera, ...filas] : []));
    const fechasCompletas = estado.fechaSalida && estado.fechaRegreso;
    mensaje.textContent = dias.length ? '' : t(fechasCompletas ? 'formulario.comidas.fechasMal' : 'formulario.comidas.sinFechas');
    mensaje.style.display = dias.length ? 'none' : '';
    mostrarTotales();
  }

  // Cantidad y valor por comida salen del cálculo del servidor; sin cálculo vigente se ve en cero.
  function mostrarTotales() {
    const simbolo = ctx.simbolo();
    const c = ctx.respuesta && ctx.respuesta.desglose && ctx.respuesta.desglose.comidas;
    for (const tipo of tipos) {
      const linea = c && c.lineas.find(l => l.tipoComidaId === tipo.id);
      ponerTotal(totales, `vi-sol-comida-total-${tipo.id}`, linea
        ? `${linea.cantidad} × ${formatearDinero(simbolo, linea.valorUnitario)} = ${formatearDinero(simbolo, linea.total)}`
        : formatearDinero(simbolo, 0));
    }
    ponerTotal(totales, 'vi-sol-total-comidas', formatearDinero(simbolo, c ? c.importe : 0));
  }

  ctx.suscribir('fechas', pintar);
  ctx.suscribir('moneda', pintar);
  ctx.suscribir('resultado', mostrarTotales);
  pintar();

  const el = crearSeccionForm({ id: 'vi-sol-seccion-comidas', titulo: t('formulario.seccion.comidas') }, ayuda, avisos, listaCampo, totales);
  return { el };
}
