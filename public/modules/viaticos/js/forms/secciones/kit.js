// Sección «Kit de emergencia»: un Sí/No por elemento; solo es registro y no restringe la solicitud.
import { h } from '../../utils/dom.js';
import { crearSeccionForm } from '../../components/campo.js';
import { crearGrupoOpciones } from '../../components/grupoOpciones.js';
import { t } from '../../textos.js';

const porOrden = (lista) => [...lista].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

export function crearSeccionKit(ctx) {
  const { estado, catalogos } = ctx;
  const filas = porOrden(catalogos.kit).map((item, k) => {
    const etiquetaId = `vi-sol-kit-etiqueta-${k}`;
    const grupo = crearGrupoOpciones({
      id: `vi-sol-kit-${k}`, etiquetaId, valor: estado.kit[item.id],
      opciones: [{ valor: true, texto: t('comun.si') }, { valor: false, texto: t('comun.no') }],
      alCambiar: (presente) => { estado.kit = { ...estado.kit, [item.id]: presente }; ctx.cambio('kit'); }
    });
    return h('div', { class: 'form-field vi-nivel-fila', 'data-campo': `inspeccion.kit[${k}]`, 'data-kit': String(item.id) },
      h('span', { class: 'vi-nivel-etiqueta', id: etiquetaId, text: item.nombre }), grupo);
  });
  const lista = h('div', { class: 'form-field vi-lista-campo vi-niveles', 'data-campo': 'inspeccion.kit' }, filas);
  const el = crearSeccionForm({ id: 'vi-sol-seccion-kit', titulo: t('formulario.seccion.kit'), ayuda: t('formulario.kit.ayuda') }, lista);
  return { el };
}
