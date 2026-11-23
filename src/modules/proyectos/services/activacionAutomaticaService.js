// src/modules/proyectos/services/activacionAutomaticaService.js
// Activación automática (A2): el día y la hora elegidos, crea el proyecto del mes con el plan del año (todas las tiendas libres que
// tienen asesores) y lo activa; si el administrador exige aprobación, lo deja esperando al gerente. Lo llama el vigilante cada 15 minutos.
// Si no se puede, NO deja nada a medias: borra el borrador que creó y avisa a los administradores con el motivo (una sola vez por motivo).
const planRepository = require('../repositories/planRepository');
const proyectoRepository = require('../repositories/proyectoRepository');
const avisosRepository = require('../repositories/avisosRepository');
const configService = require('./configService');
const proyectoService = require('./proyectoService');
const avisosService = require('./avisosService');
const notificacionService = require('../../../core/notifications/notificacionService');
const { fechaDeActivacion, MESES } = require('../planAnual');

const PERMISOS = ['proyectos.activar', 'proyectos.administrar', 'proyectos.ver'];
let enCurso = false;

const ahoraGT = () => { const d = new Date(Date.now() - 6 * 3600 * 1000).toISOString(); return { fecha: d.slice(0, 10), hora: d.slice(11, 16) }; };
const nombreMes = (mes, anio) => `${MESES[mes - 1]} ${anio}`;

// Un motivo que impide activar: `clave` identifica el aviso (no se repite) y `texto` es lo que lee el administrador.
const impedimento = (clave, texto) => Object.assign(new Error(texto), { esImpedimento: true, clave });

class ActivacionAutomaticaService {
  async _avisarFallo(anio, mes, motivo) {
    if (!(await avisosRepository.sellar(`auto-fallo:${anio}-${mes}:${motivo.clave}`))) return false;
    const admins = (await planRepository.administradores()).map(a => a.id);
    if (admins.length) {
      await notificacionService.registrar(admins, {
        modulo: 'proyectos', tipo: 'activacion_automatica_fallo', referenciaTipo: 'plan', referenciaId: null, nivel: 'alerta',
        mensaje: `No se activó el proyecto de ${nombreMes(mes, anio)}: ${motivo.texto}`
      });
    }
    return true;
  }

  // Quien figura como creador: la persona que encendió la activación automática (o, si ya no está, el primer administrador).
  async _creador() {
    let id = await planRepository.quienEncendio();
    let usuario = id ? await planRepository.usuarioActivo(id) : null;
    if (!usuario) usuario = (await planRepository.administradores())[0] || null;
    if (!usuario) throw impedimento('sin_creador', 'no hay ningún administrador activo que figure como creador.');
    return { id: usuario.id, nombre: usuario.nombre, permissions: PERMISOS };
  }

  // Las tiendas libres (sin otro proyecto abierto) que tienen asesores para repartir.
  async _tiendas(ajustes) {
    const libres = (await proyectoRepository.tiendasPosibles({ todas: true })).filter(t => !t.ocupada_por_id).map(t => t.id);
    if (!libres.length) throw impedimento('sin_tiendas', 'todas las tiendas ya están en otro proyecto activo.');
    const candidatos = await proyectoRepository.candidatos(libres, { conSupervisores: ajustes['reparto.reciben_supervisores'] });
    const conAsesores = [...new Set(candidatos.map(c => c.tienda_id))];
    if (!conAsesores.length) throw impedimento('sin_asesores', 'ninguna tienda libre tiene asesores para repartir las empresas.');
    return conAsesores;
  }

  // Crea y activa (o pide aprobación). Cualquier fallo borra el borrador creado.
  async _crearYActivar({ anio, mes, plan, fecha }) {
    const ajustes = await configService.valores();
    const plantillaId = plan.plantilla_id || await planRepository.plantillaPredeterminada();
    if (!plantillaId) throw impedimento('sin_plantilla', 'no hay ninguna plantilla de proyecto activa.');
    const tiendaIds = await this._tiendas(ajustes);
    const usuario = await this._creador();
    let id = null;
    try {
      const borrador = await proyectoService.crear(usuario, { nichoId: plan.nicho_id, anio, mes, plantillaId, articuloId: plan.articulo_id, tiendaIds, fechaInicio: fecha });
      id = borrador.id;
      const previa = await proyectoService.vistaPrevia(usuario, id);
      if (!previa.asignadas) throw impedimento('sin_empresas', `no hay empresas disponibles del nicho ${plan.nicho} para repartir.`);
      const resultado = ajustes['reglas.aprobar_activacion']
        ? await proyectoService.pedirAprobacion(usuario, id)
        : await proyectoService.activar(usuario, id, { idempotencyKey: `auto-${anio}-${mes}` });
      return { proyecto: resultado, usuario, empresas: previa.asignadas, enAprobacion: Boolean(ajustes['reglas.aprobar_activacion']) };
    } catch (error) {
      if (id) await planRepository.eliminarBorrador(id);
      if (error.esImpedimento) throw error;
      // Un error de validación o de negocio (por ejemplo, la plantilla pide un dato obligatorio): se dice cuál.
      const detalle = error.campos ? Object.values(error.campos).join(' ') : error.message;
      throw impedimento('no_activable', detalle || 'ocurrió un error al crear el proyecto.');
    }
  }

  async _avisarExito({ proyecto, usuario, empresas, enAprobacion }, anio, mes) {
    try {
      await avisosService.notificar('activacion_automatica', {
        proyectoId: proyecto.id, autorId: usuario.id, referenciaTipo: 'proyecto', referenciaId: proyecto.id,
        mensaje: enAprobacion
          ? `El plan del año creó «${proyecto.nombre}» y quedó esperando la aprobación del gerente (${empresas} empresas por repartir).`
          : `El plan del año activó «${proyecto.nombre}» automáticamente: ${empresas} empresas repartidas.`
      });
    } catch (error) { console.error('[Proyectos] No se pudo avisar de la activación automática:', error.message); }
  }

  // Una vuelta del vigilante. Devuelve qué pasó (para probarla sin esperar al reloj): apagada | espera | ya_existe | activado | en_aprobacion | fallo.
  async revisar(ahora = ahoraGT()) {
    if (enCurso) return { estado: 'ocupada' };
    enCurso = true;
    try {
      const ajustes = await configService.valores();
      if (!ajustes['activacion_auto.activa']) return { estado: 'apagada' };
      const anio = Number(ahora.fecha.slice(0, 4));
      const mes = Number(ahora.fecha.slice(5, 7));
      const fecha = fechaDeActivacion(anio, mes, ajustes['activacion_auto.dia']);
      if (ahora.fecha < fecha || (ahora.fecha === fecha && ahora.hora < ajustes['activacion_auto.hora'])) return { estado: 'espera', anio, mes };
      // Un mes con proyecto (aunque sea manual) no se activa otra vez; uno cancelado deja el mes libre.
      if ((await planRepository.proyectosDelAnio(anio)).some(p => p.mes === mes)) return { estado: 'ya_existe', anio, mes };
      const plan = await planRepository.obtener(anio, mes);
      try {
        if (!plan) throw impedimento('sin_plan', `${nombreMes(mes, anio)} no tiene plan. Planifícalo en «Plan del año» y se activará en la próxima revisión.`);
        const hecho = await this._crearYActivar({ anio, mes, plan, fecha: ahora.fecha });
        await this._avisarExito(hecho, anio, mes);
        return { estado: hecho.enAprobacion ? 'en_aprobacion' : 'activado', anio, mes, proyectoId: hecho.proyecto.id, empresas: hecho.empresas };
      } catch (error) {
        if (!error.esImpedimento) throw error;
        const avisado = await this._avisarFallo(anio, mes, error);
        return { estado: 'fallo', anio, mes, motivo: error.clave, avisado };
      }
    } finally {
      enCurso = false;
    }
  }
}

module.exports = new ActivacionAutomaticaService();
