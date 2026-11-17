// Sección «Nivel de fluidos y odómetro»: un selector de niveles por fluido (cada uno con SUS niveles), aviso de nivel bajo y odómetro.
import { h } from '../../utils/dom.js';
import { crearCampo, crearSeccionForm } from '../../components/campo.js';
import { crearCampoNumerico } from '../../components/campoNumerico.js';
import { crearGrupoOpciones } from '../../components/grupoOpciones.js';
import { crearAviso } from '../../components/aviso.js';
import { nivelesBajos } from '../datosCorto.js';
import { t } from '../../textos.js';

const porOrden = (lista) => [...lista].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

export function crearSeccionFluidos(ctx) {
  const { estado, catalogos } = ctx;
  const avisos = h('div', { class: 'vi-avisos', id: 'vi-sol-fluidos-aviso', 'aria-live': 'polite' });

  const filas = porOrden(catalogos.fluidos).map((fluido, k) => {
    const etiquetaId = `vi-sol-fluido-etiqueta-${k}`;
    const grupo = crearGrupoOpciones({
      id: `vi-sol-fluido-${k}`, etiquetaId, valor: estado.fluidos[fluido.id],
      opciones: porOrden(fluido.niveles).map(n => ({ valor: n.id, texto: n.nombre, bajo: !!n.bajoLaMitad })),
      alCambiar: (nivelId) => { estado.fluidos = { ...estado.fluidos, [fluido.id]: nivelId }; ctx.cambio('fluidos'); }
    });
    return h('div', { class: 'form-field vi-nivel-fila', 'data-campo': `inspeccion.fluidos[${k}]`, 'data-fluido': String(fluido.id) },
      h('span', { class: 'vi-nivel-etiqueta', id: etiquetaId, text: fluido.nombre }), grupo);
  });
  const lista = h('div', { class: 'form-field vi-lista-campo vi-niveles', 'data-campo': 'inspeccion.fluidos' }, filas);

  // El PDF registra los niveles por debajo de la mitad: se avisa, pero no se bloquea nada.
  function pintarAviso() {
    const bajos = nivelesBajos(estado, catalogos);
    avisos.replaceChildren(...(bajos.length ? [crearAviso({
      tipo: 'warning', titulo: t('formulario.fluidos.bajoTitulo', { fluidos: bajos.map(b => b.fluido.toLowerCase()).join(', ') }), texto: t('formulario.fluidos.bajoTexto')
    })] : []));
  }
  ctx.suscribir('fluidos', pintarAviso);
  pintarAviso();

  const odometro = crearCampoNumerico({
    id: 'vi-sol-odometro', name: 'inspeccion.odometro', valor: estado.odometro, entero: true, placeholder: t('formulario.odometro.ejemplo'), etiquetaAria: t('formulario.odometro.etiqueta'),
    alCambiar: (valor) => { estado.odometro = valor; ctx.cambio('odometro'); }
  });

  const el = crearSeccionForm({ id: 'vi-sol-seccion-fluidos', titulo: t('formulario.seccion.fluidos'), ayuda: t('formulario.fluidos.ayuda') },
    lista, avisos, crearCampo({ etiqueta: t('formulario.odometro.etiqueta'), control: odometro, idControl: 'vi-sol-odometro' }));
  return { el };
}
