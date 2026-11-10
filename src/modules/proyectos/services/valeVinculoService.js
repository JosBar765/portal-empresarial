// src/modules/proyectos/services/valeVinculoService.js
// Integración con Vales de Arte: los datos que prellenan el vale y el vínculo del vale creado con la empresa del asesor.
// El backend de Vales no depende de esto: Vales solo pide el prefill (con la sesión del asesor) y avisa al guardar.
// Los datos personales no viajan por la dirección; solo el id de la participación.
const db = require('../../../config/database');
const participacionRepository = require('../repositories/participacionRepository');
const valeRepository = require('../repositories/valeRepository');
const proyectoRepository = require('../repositories/proyectoRepository');
const gestionService = require('./gestionService');
const ganadosService = require('./ganadosService');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');
const { errorDeValidacion } = require('../errores');

const noExiste = () => new ErrorDeNegocio('Esa empresa no existe o no es tuya.', 404);
const DESCRIPCION_MAXIMA = 600;

// «+502 5511 2034» → { prefijo: '+502', numero: '5511 2034' } para el selector de país de Vales.
function separarTelefono(texto) {
  const t = String(texto || '').trim();
  const m = /^(\+\d{1,4})\s+(.+)$/.exec(t);
  return m ? { prefijo: m[1], numero: m[2] } : { prefijo: null, numero: t };
}

class ValeVinculoService {
  async prefill(usuario, id) {
    const p = await participacionRepository.participacion(aEntero(id) || 0, usuario.id);
    if (!p) throw noExiste();
    const proyecto = await participacionRepository.proyecto(p.proyecto_id);
    if (proyecto.estado !== 'activo' || !p.abierta || p.estado === 'descartada') throw new ErrorDeNegocio('Este proyecto ya no está activo: no se pueden crear vales desde aquí.', 409);
    const [contactos, historial] = await Promise.all([participacionRepository.contactos(p.cliente_id), participacionRepository.historial(p.id)]);
    const conDatos = (c) => c.telefono || c.correo;
    const contacto = contactos.find(c => c.principal && conDatos(c)) || contactos.find(conDatos) || contactos[0] || null;
    const telefono = separarTelefono((contacto && contacto.telefono) || p.telefono);
    // La referencia que aparece en el banner: la de la venta vigente, o la de la cotización vigente.
    const vigente = (filas) => filas.find(f => !f.anulada_en && f.referencia);
    const venta = vigente(historial.ventas.filter(v => v.estado !== 'rechazada'));
    const cotizacion = vigente(historial.cotizaciones);
    const nota = (cotizacion && cotizacion.nota) || (historial.gestiones.find(g => g.nota) || {}).nota || '';
    return {
      participacionId: p.id,
      empresa: { nombre: p.nombre },
      contacto: { nombre: (contacto && contacto.nombre) || p.nombre, cargo: contacto ? contacto.cargo : null, telefonoPrefijo: telefono.prefijo, telefono: telefono.numero, correo: (contacto && contacto.correo) || '' },
      referencia: (venta && venta.referencia) || (cotizacion && cotizacion.referencia) || null,
      descripcion: String(nota || '').slice(0, DESCRIPCION_MAXIMA)
    };
  }

  // Recompra desde Clientes ganados: los mismos datos del vale, pero sin proyecto: el vale no se liga a ninguna participación.
  async prefillRecompra(usuario, clienteId) {
    if (!(await ganadosService.enAlcance(usuario, clienteId))) throw new ErrorDeNegocio('Esa empresa no está en tus clientes ganados.', 404);
    const id = aEntero(clienteId);
    const [cliente, contactos] = await Promise.all([participacionRepository.cliente(id), participacionRepository.contactos(id)]);
    if (!cliente) throw new ErrorDeNegocio('Esa empresa no existe.', 404);
    const conDatos = (c) => c.telefono || c.correo;
    const contacto = contactos.find(c => c.principal && conDatos(c)) || contactos.find(conDatos) || contactos[0] || null;
    const telefono = separarTelefono((contacto && contacto.telefono) || cliente.telefono);
    return {
      participacionId: null, recompra: true,
      empresa: { nombre: cliente.nombre },
      contacto: { nombre: (contacto && contacto.nombre) || cliente.nombre, cargo: contacto ? contacto.cargo : null, telefonoPrefijo: telefono.prefijo, telefono: telefono.numero, correo: (contacto && contacto.correo) || '' },
      referencia: null, descripcion: ''
    };
  }

  // `datos`: { valeId }. Repetir la misma liga responde bien; ligar un vale que ya está en otra empresa es un 409.
  async vincular(usuario, id, datos = {}) {
    const p = await participacionRepository.participacion(aEntero(id) || 0, usuario.id);
    if (!p) throw noExiste();
    const valeId = aEntero(datos.valeId);
    if (!valeId) throw errorDeValidacion('Revisa los datos.', { valeId: 'Indica el vale que se creó.' });
    // Un vale ajeno responde igual que uno que no existe: nadie sabe qué vales tienen los demás.
    const vale = await valeRepository.vale(valeId);
    if (!vale || vale.asesor_id !== usuario.id) throw new ErrorDeNegocio('Ese vale no existe o no es tuyo.', 404);
    let repetida = false;
    const previo = await valeRepository.vinculo(valeId);
    if (previo) {
      if (previo.participacion_id !== p.id) throw new ErrorDeNegocio('Ese vale ya está ligado a otra empresa.', 409);
      repetida = true;
    } else {
      try {
        await db.transaccion(async (tx) => {
          await valeRepository.insertar(tx, { participacionId: p.id, valeId, usuarioId: usuario.id });
          await proyectoRepository.registrarHistorial(tx, { proyectoId: p.proyecto_id, usuarioId: usuario.id, accion: 'vincular_vale', detalle: { participacionId: p.id, valeId, correlativo: vale.correlativo } });
        });
      } catch (error) {
        // Dos avisos a la vez del mismo vale: el segundo ya lo encuentra ligado a esta misma empresa.
        const ahora = await valeRepository.vinculo(valeId);
        if (!ahora || ahora.participacion_id !== p.id) throw error;
        repetida = true;
      }
    }
    return { ...(await gestionService.ficha(usuario, p.id)), vale: { id: vale.id, correlativo: vale.correlativo }, repetida };
  }
}

module.exports = new ValeVinculoService();
