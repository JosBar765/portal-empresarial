// src/modules/proyectos/services/kitService.js
// Kit del nicho: el administrador escribe el guion de llamada y los mensajes de cada nicho (A9); el asesor los abre desde la ficha de la
// empresa, ya con los datos puestos (M15). El portal no envía nada: abre WhatsApp o el correo con el texto listo y lo envía el asesor.
const db = require('../../../config/database');
const kitRepository = require('../repositories/kitRepository');
const participacionRepository = require('../repositories/participacionRepository');
const configRepository = require('../repositories/configRepository');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');
const { errorDeValidacion } = require('../errores');
const kit = require('../kit');

const noExiste = () => new ErrorDeNegocio('Ese nicho no existe.', 404);
const NOMBRE_CANAL = { whatsapp: 'WhatsApp', correo: 'Correo' };
const FALTA = { empresa: 'la empresa', contacto: 'el contacto', asesor: 'tu nombre', articulo: 'el artículo del proyecto', nicho: 'el nicho' };
const HUECO = '____';

// Lo que queda en el historial: el guion y cada mensaje con su texto.
const resumen = (nicho, activo, guion, mensajes) => ({
  nicho, activo, guion: guion || '',
  mensajes: mensajes.map(m => `${m.titulo} (${NOMBRE_CANAL[m.canal]}${m.activo ? '' : ', apagado'}): ${m.texto}`)
});

// Valida lo que llega de la pantalla y devuelve el kit limpio; un error por campo, con el número del mensaje.
function validar(datos) {
  const campos = {};
  const guion = String(datos.guion == null ? '' : datos.guion).replace(/\r\n/g, '\n').trim();
  if (guion.length > kit.MAX_GUION) campos.guion = `Máximo ${kit.MAX_GUION} caracteres.`;
  else if (kit.variablesDesconocidas(guion).length) campos.guion = `Variables que no existen: ${kit.variablesDesconocidas(guion).join(', ')}. Usa solo ${kit.VARIABLES.map(v => `{${v}}`).join(' ')}.`;
  if (datos.activo !== undefined && typeof datos.activo !== 'boolean') campos.activo = 'Elige activo o apagado.';
  const crudos = Array.isArray(datos.mensajes) ? datos.mensajes : [];
  if (crudos.length > kit.MAX_MENSAJES) campos.mensajes = `Máximo ${kit.MAX_MENSAJES} mensajes por kit.`;
  const mensajes = [];
  crudos.slice(0, kit.MAX_MENSAJES).forEach((m, i) => {
    const n = i + 1;
    const canal = m && m.canal;
    const titulo = String((m && m.titulo) == null ? '' : m.titulo).trim();
    const texto = String((m && m.texto) == null ? '' : m.texto).replace(/\r\n/g, '\n').trim();
    if (!kit.CANALES.includes(canal)) campos[`mensaje${n}`] = 'Elige WhatsApp o correo.';
    else if (!titulo) campos[`mensaje${n}`] = 'Escribe el título.';
    else if (titulo.length > kit.MAX_TITULO) campos[`mensaje${n}`] = `El título admite hasta ${kit.MAX_TITULO} caracteres.`;
    else if (!texto) campos[`mensaje${n}`] = 'Escribe el texto del mensaje.';
    else if (texto.length > kit.MAX_TEXTO) campos[`mensaje${n}`] = `El texto admite hasta ${kit.MAX_TEXTO} caracteres.`;
    else if (kit.variablesDesconocidas(texto).length) campos[`mensaje${n}`] = `Variables que no existen: ${kit.variablesDesconocidas(texto).join(', ')}.`;
    else if (m.activo !== undefined && typeof m.activo !== 'boolean') campos[`mensaje${n}`] = 'Elige activo o apagado.';
    else mensajes.push({ canal, titulo, texto, activo: m.activo !== false });
  });
  if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos marcados.', campos);
  return { guion, activo: datos.activo !== false, mensajes };
}

class KitService {
  // --- Administrador (A9) ---

  async listar() {
    const filas = await kitRepository.nichos();
    return {
      variables: kit.VARIABLES, canales: kit.CANALES,
      nichos: filas.map(f => ({ id: f.id, nombre: f.nombre, tieneKit: f.kit_id !== null, activo: f.kit_id !== null && Boolean(f.kit_activo), tieneGuion: Boolean(Number(f.tiene_guion)), mensajes: Number(f.mensajes) }))
    };
  }

  async obtener(nichoId) {
    const id = aEntero(nichoId);
    const nicho = id === null ? null : await kitRepository.nicho(id);
    if (!nicho) throw noExiste();
    const existente = await kitRepository.kitDelNicho(nicho.id);
    const mensajes = existente ? await kitRepository.mensajes(existente.id) : [];
    return {
      nicho: { id: nicho.id, nombre: nicho.nombre }, variables: kit.VARIABLES, canales: kit.CANALES,
      kit: { guion: (existente && existente.guion) || '', activo: existente ? Boolean(existente.activo) : true,
        mensajes: mensajes.map(m => ({ id: m.id, canal: m.canal, titulo: m.titulo, texto: m.texto, activo: Boolean(m.activo) })) }
    };
  }

  async guardar(nichoId, datos, usuarioId) {
    const id = aEntero(nichoId);
    const nicho = id === null ? null : await kitRepository.nicho(id);
    if (!nicho) throw noExiste();
    const limpio = validar(datos);
    const canales = await kitRepository.canales();
    if (limpio.mensajes.some(m => !canales[m.canal])) throw new ErrorDeNegocio('Falta el canal de WhatsApp o de correo en Catálogos > Canales: créalo o actívalo con ese nombre.', 409);
    await db.transaccion(async (tx) => {
      const kitId = await kitRepository.asegurarKit(tx, nicho.id);
      const antes = await kitRepository.kitDelNicho(nicho.id, tx);
      const mensajesAntes = await kitRepository.mensajes(kitId, tx);
      const resumenAntes = resumen(nicho.nombre, Boolean(antes.activo), antes.guion, mensajesAntes.map(m => ({ ...m, activo: Boolean(m.activo) })));
      await kitRepository.actualizarKit(tx, kitId, { guion: limpio.guion || null, activo: limpio.activo });
      await kitRepository.reemplazarMensajes(tx, kitId, limpio.mensajes, canales);
      const resumenDespues = resumen(nicho.nombre, limpio.activo, limpio.guion, limpio.mensajes);
      const nuevo = !resumenAntes.guion && mensajesAntes.length === 0;
      if (JSON.stringify(resumenAntes) !== JSON.stringify(resumenDespues)) {
        await configRepository.registrarHistorial(tx, { usuarioId, entidad: 'kit', clave: String(nicho.id), accion: nuevo ? 'crear' : 'editar', antes: nuevo ? null : resumenAntes, despues: resumenDespues });
      }
    });
    return this.obtener(nicho.id);
  }

  // --- Asesor (M15): el kit con los datos de su empresa ---

  async paraParticipacion(usuario, participacionId) {
    const p = await participacionRepository.participacion(aEntero(participacionId) || 0, usuario.id);
    if (!p) throw new ErrorDeNegocio('Esa empresa no existe o no es tuya.', 404);
    const proyecto = await participacionRepository.proyecto(p.proyecto_id);
    if (proyecto.estado !== 'activo' || !p.abierta || p.estado === 'descartada') throw new ErrorDeNegocio('Este proyecto ya no está activo: el kit solo se usa con un proyecto activo.', 409);
    const existente = await kitRepository.kitDelNicho(p.nicho_id);
    if (!existente || !existente.activo) return { disponible: false, nicho: p.nicho };
    const [mensajes, contactos] = await Promise.all([kitRepository.mensajes(existente.id), participacionRepository.contactos(p.cliente_id)]);
    const conDatos = (c) => c.telefono || c.correo;
    const contacto = contactos.find(c => c.principal && conDatos(c)) || contactos.find(conDatos) || contactos[0] || null;
    const datos = {
      empresa: p.nombre,
      // Sin contacto con nombre, el saludo se dirige a la empresa («Hola equipo de Banco del Norte»).
      contacto: (contacto && contacto.nombre) || `equipo de ${p.nombre}`,
      asesor: usuario.nombre, articulo: proyecto.articulo, nicho: p.nicho
    };
    const telefono = (contacto && contacto.telefono) || p.telefono || null;
    const correo = (contacto && contacto.correo) || null;

    const guion = existente.guion ? kit.resolver(existente.guion, Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, v || HUECO]))).texto : null;
    const lista = mensajes.filter(m => m.activo).map((m) => {
      const { texto, faltan } = kit.resolver(m.texto, datos);
      const base = { id: m.id, canal: m.canal, titulo: m.titulo, texto };
      if (faltan.length) return { ...base, disponible: false, motivo: `Falta ${faltan.map(f => FALTA[f]).join(' y ')}.` };
      const enlace = m.canal === 'whatsapp' ? kit.enlaceWhatsApp(telefono, texto) : kit.enlaceCorreo(correo, m.titulo, texto);
      if (!enlace) return { ...base, disponible: false, motivo: m.canal === 'whatsapp' ? 'Falta un teléfono del contacto.' : 'Falta un correo del contacto.' };
      return { ...base, disponible: true, enlace };
    });
    return { disponible: true, nicho: p.nicho, empresa: p.nombre, contacto: contacto ? contacto.nombre : null, guion, mensajes: lista };
  }
}

module.exports = new KitService();
