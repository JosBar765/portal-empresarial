// src/modules/proyectos/services/planService.js
// Plan del año (A2): qué nicho, artículo y plantilla toca cada mes, para toda la región. Sugiere el nicho al crear un proyecto y es la
// base de la activación automática. Un mes ya activo, en aprobación o cerrado no se puede cambiar. Cada cambio queda en el historial.
const db = require('../../../config/database');
const planRepository = require('../repositories/planRepository');
const catalogoRepository = require('../repositories/catalogoRepository');
const plantillaRepository = require('../repositories/plantillaRepository');
const configRepository = require('../repositories/configRepository');
const configService = require('./configService');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');
const { errorDeValidacion } = require('../errores');
const { definicion } = require('../catalogos');
const { MESES, proximaActivacion, fechaLarga } = require('../planAnual');

const AHORA_GT = () => new Date(Date.now() - 6 * 3600 * 1000);
const BLOQUEAN = ['activo', 'pendiente_aprobacion', 'cerrado'];
// Si un mes tiene varios proyectos, manda el más avanzado.
const PESO = { activo: 5, pendiente_aprobacion: 4, borrador: 3, cerrado: 2 };

const ahoraGT = () => { const d = AHORA_GT().toISOString(); return { fecha: d.slice(0, 10), hora: d.slice(11, 16) }; };

const resumen = (p) => (p ? { mes: MESES[p.mes - 1], anio: p.anio, nicho: p.nicho, articulo: p.articulo || null, plantilla: p.plantilla || null } : null);

function validarMes(anio, mes) {
  const a = aEntero(anio);
  const m = aEntero(mes);
  if (a === null || a < 2020 || a > 2100 || m === null || m < 1 || m > 12) throw errorDeValidacion('Revisa los datos marcados.', { mes: 'Elige un mes y un año válidos.' });
  return { anio: a, mes: m };
}

const filaDeMes = (p) => ({ nichoId: p.nicho_id, nicho: p.nicho, articuloId: p.articulo_id, articulo: p.articulo || null, plantillaId: p.plantilla_id, plantilla: p.plantilla || null });

class PlanService {
  // El plan de un año con el estado de cada mes y la próxima activación automática.
  async anio(anioCrudo) {
    const anio = aEntero(anioCrudo) || AHORA_GT().getUTCFullYear();
    if (anio < 2020 || anio > 2100) throw errorDeValidacion('Revisa los datos marcados.', { anio: 'Elige un año entre 2020 y 2100.' });
    const [planes, proyectos, ajustes] = await Promise.all([planRepository.listarAnio(anio), planRepository.proyectosDelAnio(anio), configService.valores()]);
    const ahora = ahoraGT();
    const delMes = (mes) => proyectos.filter(p => p.mes === mes).sort((a, b) => (PESO[b.estado] || 0) - (PESO[a.estado] || 0))[0] || null;
    const meses = MESES.map((nombre, i) => {
      const mes = i + 1;
      const plan = planes.find(p => p.mes === mes) || null;
      const proyecto = delMes(mes);
      const pasado = anio < Number(ahora.fecha.slice(0, 4)) || (anio === Number(ahora.fecha.slice(0, 4)) && mes < Number(ahora.fecha.slice(5, 7)));
      return {
        mes, nombre, plan: plan ? filaDeMes(plan) : null,
        estado: proyecto ? proyecto.estado : (plan ? 'planificado' : 'sin_plan'),
        proyecto: proyecto ? { id: proyecto.id, nombre: proyecto.nombre, nichoId: proyecto.nicho_id } : null,
        editable: !pasado && !(proyecto && BLOQUEAN.includes(proyecto.estado))
      };
    });
    return { anio, meses, automatizacion: await this._automatizacion(ajustes) };
  }

  // Estado de la activación automática y cuándo es la próxima. `motivo` explica por qué no se activaría nada ese día.
  async _automatizacion(ajustes) {
    const activa = Boolean(ajustes['activacion_auto.activa']);
    const base = { activa, dia: ajustes['activacion_auto.dia'], hora: ajustes['activacion_auto.hora'], proxima: null };
    if (!activa) return base;
    const ahora = ahoraGT();
    const anioActual = Number(ahora.fecha.slice(0, 4));
    const ocupados = new Set();
    for (const a of [anioActual, anioActual + 1]) for (const p of await planRepository.proyectosDelAnio(a)) ocupados.add(`${p.anio}-${p.mes}`);
    const proxima = proximaActivacion(ahora, { dia: base.dia, hora: base.hora }, ocupados);
    if (!proxima) return base;
    const plan = await planRepository.obtener(proxima.anio, proxima.mes);
    return {
      ...base,
      proxima: {
        anio: proxima.anio, mes: proxima.mes, mesNombre: MESES[proxima.mes - 1], fecha: proxima.fecha, fechaTexto: fechaLarga(proxima.fecha), hora: proxima.hora,
        plan: plan ? { nicho: plan.nicho } : null, motivo: plan ? null : 'sin_plan'
      }
    };
  }

  // Lo que el asistente de proyectos necesita para sugerir el nicho: el plan del año actual y el siguiente.
  async sugerencias() {
    const anio = AHORA_GT().getUTCFullYear();
    const [a, b] = await Promise.all([planRepository.listarAnio(anio), planRepository.listarAnio(anio + 1)]);
    return [...a, ...b].map(p => ({ anio: p.anio, mes: p.mes, nichoId: p.nicho_id, nicho: p.nicho, articuloId: p.articulo_id, plantillaId: p.plantilla_id }));
  }

  async _comprobar(anio, mes) {
    const ahora = ahoraGT();
    if (anio < Number(ahora.fecha.slice(0, 4)) || (anio === Number(ahora.fecha.slice(0, 4)) && mes < Number(ahora.fecha.slice(5, 7)))) throw new ErrorDeNegocio('Ese mes ya pasó: no se puede cambiar su plan.', 409);
    const ocupa = (await planRepository.proyectosDelAnio(anio)).find(p => p.mes === mes && BLOQUEAN.includes(p.estado));
    if (ocupa) throw new ErrorDeNegocio(`${MESES[mes - 1][0].toUpperCase()}${MESES[mes - 1].slice(1)} ya tiene un proyecto ${ocupa.estado === 'cerrado' ? 'cerrado' : 'en marcha'}: su plan ya no se puede cambiar.`, 409);
  }

  async guardarMes(anioCrudo, mesCrudo, datos, usuarioId) {
    const { anio, mes } = validarMes(anioCrudo, mesCrudo);
    const campos = {};
    const nicho = aEntero(datos.nichoId) === null ? null : await catalogoRepository.obtener(definicion('nichos'), aEntero(datos.nichoId));
    if (!nicho || !nicho.activo) campos.nichoId = 'Elige un nicho de la lista.';
    let articuloId = null;
    if (datos.articuloId !== undefined && datos.articuloId !== null && datos.articuloId !== '') {
      const articulo = aEntero(datos.articuloId) === null ? null : await catalogoRepository.obtener(definicion('articulos'), aEntero(datos.articuloId));
      if (!articulo || !articulo.activo) campos.articuloId = 'Elige un artículo de la lista.'; else articuloId = articulo.id;
    }
    let plantillaId = null;
    if (datos.plantillaId !== undefined && datos.plantillaId !== null && datos.plantillaId !== '') {
      const plantilla = aEntero(datos.plantillaId) === null ? null : await plantillaRepository.obtener(aEntero(datos.plantillaId));
      if (!plantilla || !plantilla.activa) campos.plantillaId = 'Elige una plantilla activa de la lista.'; else plantillaId = plantilla.id;
    }
    if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos marcados.', campos);
    await this._comprobar(anio, mes);
    await db.transaccion(async (tx) => {
      const antes = await planRepository.obtener(anio, mes, tx);
      await planRepository.guardar(tx, { anio, mes, nichoId: nicho.id, articuloId, plantillaId });
      const despues = await planRepository.obtener(anio, mes, tx);
      if (JSON.stringify(resumen(antes)) !== JSON.stringify(resumen(despues))) {
        await configRepository.registrarHistorial(tx, { usuarioId, entidad: 'plan', clave: `${anio}-${mes}`, accion: antes ? 'editar' : 'crear', antes: resumen(antes), despues: resumen(despues) });
      }
    });
    return this.anio(anio);
  }

  async quitarMes(anioCrudo, mesCrudo, usuarioId) {
    const { anio, mes } = validarMes(anioCrudo, mesCrudo);
    const antes = await planRepository.obtener(anio, mes);
    if (!antes) throw new ErrorDeNegocio('Ese mes no tiene plan.', 404);
    await this._comprobar(anio, mes);
    await db.transaccion(async (tx) => {
      await planRepository.eliminar(tx, anio, mes);
      await configRepository.registrarHistorial(tx, { usuarioId, entidad: 'plan', clave: `${anio}-${mes}`, accion: 'desactivar', antes: resumen(antes), despues: null });
    });
    return this.anio(anio);
  }
}

module.exports = new PlanService();
