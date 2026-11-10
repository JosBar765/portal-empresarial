import { escapeHtml } from '../utils/formato.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { obtenerSupervisionAsesor, guardarSupervisionAsesor } from '../api/adminApi.js';

const nombres = (lista) => lista.map(s => s.nombre).join(', ');

// Texto de la advertencia según lo elegido; `datos` es la respuesta de GET /asesores/:id/supervisores.
function armarAdvertencia(datos, elegidos) {
  const total = datos.valesEsperando.total;
  const sinAsignacion = datos.asignados.length === 0;
  const aCargo = elegidos.length ? elegidos : datos.supervisoresDeTienda;
  if (!elegidos.length && sinAsignacion) return '';
  const quienes = aCargo.length ? nombres(aCargo) : 'nadie (su tienda no tiene supervisores)';
  if (!elegidos.length) {
    return total
      ? `Este asesor tiene ${total} vale(s) esperando autorización; volverán a ser autorizados por los supervisores de su tienda: ${quienes}.`
      : 'Sin supervisión especial, sus vales los autorizan los supervisores de su tienda.';
  }
  return total
    ? `Este asesor tiene ${total} vale(s) esperando autorización; pasarán a ser autorizados por: ${quienes}.${sinAsignacion ? ' Los supervisores de su tienda dejarán de verlos.' : ''}`
    : `Este asesor no tiene vales esperando autorización. Desde ahora sus vales los autorizarán: ${quienes}.`;
}

export async function abrirModalSupervisionAsesor(usuario, alGuardar) {
  let datos;
  try {
    datos = await obtenerSupervisionAsesor(usuario.id);
  } catch (error) {
    window.toast.error('No se pudo abrir la supervisión especial', error.message);
    return;
  }
  const idsActuales = datos.asignados.map(s => s.id);
  // Un asignado que ya no sirve (inactivo o sin permiso) sigue en la lista para poder quitarlo.
  const opciones = [
    ...datos.asignables.map(s => ({ ...s, valido: true })),
    ...datos.asignados.filter(s => !datos.asignables.some(a => a.id === s.id)).map(s => ({ ...s, valido: false }))
  ];

  const bodyHtml = `
    <p class="form-hint">Los supervisores que elijas autorizan los vales de este asesor <strong>en lugar de</strong> los de su tienda. Sin ninguno elegido, vuelven los de su tienda.</p>
    <p class="section-title">Quién autoriza hoy</p>
    <p class="form-hint" id="sup-asesor-actual">${datos.supervisoresACargo.length
      ? `${escapeHtml(nombres(datos.supervisoresACargo))} ${idsActuales.length ? '(asignados)' : '(supervisores de su tienda)'}`
      : 'Nadie: ningún supervisor puede autorizar sus vales ahora.'}</p>
    ${datos.sinSupervisorValido ? '<div class="form-warning">Los supervisores asignados ya no pueden autorizar (están inactivos o sin permiso) y sus vales no los autoriza nadie. Elige supervisores válidos o quita la asignación.</div>' : ''}
    <p class="section-title">Supervisores asignados</p>
    <div class="personal-lista" id="sup-asesor-lista">
      ${opciones.length ? opciones.map(s => `
        <div class="personal-item">
          <div class="form-checkbox">
            <input type="checkbox" id="sup-asesor-${Number(s.id)}" value="${Number(s.id)}" ${idsActuales.includes(s.id) ? 'checked' : ''}>
            <label for="sup-asesor-${Number(s.id)}">${escapeHtml(s.nombre)}${s.valido ? '' : ' (inactivo o sin permiso)'}</label>
          </div>
        </div>`).join('') : '<p class="form-hint">No hay supervisores disponibles para asignar.</p>'}
    </div>
    <div class="form-warning" id="sup-asesor-aviso" hidden></div>
  `;
  const { overlay, cerrar } = abrirModal({
    title: `Supervisión especial — ${usuario.nombre}`,
    bodyHtml,
    footerHtml: '<button class="btn" id="btn-cancelar-sup-asesor">Cancelar</button><button class="btn btn--primary" id="btn-guardar-sup-asesor" disabled>Guardar</button>'
  });

  const btnGuardar = overlay.querySelector('#btn-guardar-sup-asesor');
  const aviso = overlay.querySelector('#sup-asesor-aviso');
  const elegidosIds = () => [...overlay.querySelectorAll('#sup-asesor-lista input:checked')].map(i => Number(i.value));
  const actualizar = () => {
    const ids = elegidosIds();
    const elegidos = opciones.filter(s => ids.includes(s.id));
    const cambio = ids.length !== idsActuales.length || ids.some(id => !idsActuales.includes(id));
    const texto = cambio ? armarAdvertencia(datos, elegidos) : '';
    aviso.hidden = !texto;
    aviso.textContent = texto;
    btnGuardar.disabled = !cambio;
  };
  overlay.querySelectorAll('#sup-asesor-lista input').forEach(i => i.addEventListener('change', actualizar));
  overlay.querySelector('#btn-cancelar-sup-asesor').addEventListener('click', cerrar);

  btnGuardar.addEventListener('click', async () => {
    btnGuardar.disabled = true;
    try {
      const r = await guardarSupervisionAsesor(usuario.id, elegidosIds());
      window.toast.success('Supervisión actualizada', r.valesAvisados ? `Se avisó a los nuevos supervisores de ${r.valesAvisados} vale(s).` : 'Los cambios quedaron guardados.');
      cerrar();
      if (alGuardar) alGuardar();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btnGuardar.disabled = false;
    }
  });
}
