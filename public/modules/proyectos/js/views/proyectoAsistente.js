// Crear proyecto: asistente de 4 pasos (S2 nicho y mes → S3 alcance y participantes → S4 artículo, meta y etapas → S5 vista
// previa y activación). Cada «Continuar» guarda el borrador, así se puede dejar y retomar desde donde quedó. El reparto lo calcula
// el servidor: aquí solo se muestra su vista previa.
import { h, icono, montar } from '../utils/dom.js';
import { aviso, avisar, cargando, cabecera } from '../components/ui.js';
import { registrarSalida, liberarSalida } from '../components/salida.js';
import { campoTexto, campoLista } from '../components/campos.js';
import { pluralizar } from '../utils/formato.js';
import {
  obtenerOpcionesProyectos, obtenerProyecto, crearProyecto, editarProyecto, candidatosDeTiendas, vistaPreviaProyecto, activarProyecto, pedirAprobacionProyecto
} from '../api/api.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const PASOS = ['Nicho y mes', 'Alcance y participantes', 'Artículo, meta y etapas', 'Vista previa y activación'];
const nuevaClave = () => (crypto.randomUUID ? crypto.randomUUID() : `act-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const quitarAcentos = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '');
const pasoDeError = (clave) => (/^(nichoId|anio|mes|plantillaId)$/.test(clave) ? 1 : (/^(tiendaIds|excluidos)$/.test(clave) ? 2 : 3));

// El primer día hábil del mes elegido (AAAA-MM-DD): fecha de inicio por defecto del borrador.
function primerDiaHabil(anio, mes) {
  const d = new Date(Date.UTC(anio, mes - 1, 1));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function renderAsistente(cont, id) {
  montar(cont, cargando());
  const opciones = await obtenerOpcionesProyectos();
  let proyecto = null;
  if (id) {
    proyecto = await obtenerProyecto(id);
    if (proyecto.estado !== 'borrador') { window.location.hash = `#/proyectos/${id}`; return; }
  }
  const hoy = new Date();
  const predeterminada = opciones.plantillas.find(p => p.predeterminada) || opciones.plantillas[0] || null;

  const e = {
    id: null, plantillaId: predeterminada ? predeterminada.id : null, nichoId: '', anio: hoy.getFullYear(), mes: hoy.getMonth() + 1, tiendaIds: [], excluidos: new Map(),
    articuloId: '', existenciaMuestras: '', topePorAsesor: '', metaMonto: '', metaMoneda: '', fechaInicio: '', fechaFin: '', etapas: []
  };
  const cargarEnEstado = (p) => {
    Object.assign(e, {
      id: p.id, plantillaId: p.plantillaId, nichoId: p.nichoId, anio: p.anio, mes: p.mes, tiendaIds: p.tiendas.map(t => t.id),
      excluidos: new Map(p.participantes.filter(x => x.estado === 'excluido').map(x => [x.usuarioId, x.motivo || ''])),
      articuloId: p.articuloId || '', existenciaMuestras: p.existenciaMuestras === null ? '' : p.existenciaMuestras, topePorAsesor: p.topePorAsesor === null ? '' : p.topePorAsesor,
      metaMonto: p.metaMonto === null ? '' : p.metaMonto, metaMoneda: p.metaMoneda || '', fechaInicio: p.fechaInicio || '', fechaFin: p.fechaFin || '',
      etapas: p.etapas.map(x => ({ nombre: x.nombre, descripcion: x.descripcion || '', fechaInicio: x.fechaInicio || '', fechaFin: x.fechaFin || '' }))
    });
    proyecto = p;
  };
  if (proyecto) cargarEnEstado(proyecto);

  let paso = proyecto ? (e.tiendaIds.length ? 3 : 2) : 1;
  let errores = {};
  let candidatos = [];
  let previa = null;
  let ocupado = false;
  let sucio = false;
  let claveActivacion = nuevaClave();
  const plantilla = () => opciones.plantillas.find(p => p.id === e.plantillaId) || null;
  const controles = () => (plantilla() && plantilla().controles) || {};
  const tiendasSeleccionadas = () => opciones.tiendas.filter(t => e.tiendaIds.includes(t.id));
  registrarSalida(() => sucio);

  const zona = h('div');

  // --- Guardar ---

  // En el primer guardado solo se mandan los datos del paso 1: lo demás lo completa la plantilla en el servidor.
  function envio({ recalcular = false } = {}) {
    if (!e.id) return { nichoId: e.nichoId, anio: e.anio, mes: e.mes, plantillaId: e.plantillaId, fechaInicio: primerDiaHabil(e.anio, e.mes) };
    const vacioANulo = (v) => (v === '' ? null : v);
    return {
      nichoId: e.nichoId, anio: e.anio, mes: e.mes, tiendaIds: e.tiendaIds, excluidos: [...e.excluidos].map(([usuarioId, motivo]) => ({ usuarioId, motivo })),
      articuloId: vacioANulo(e.articuloId), existenciaMuestras: vacioANulo(e.existenciaMuestras), topePorAsesor: vacioANulo(e.topePorAsesor),
      metaMonto: vacioANulo(e.metaMonto), metaMoneda: vacioANulo(e.metaMoneda), fechaInicio: vacioANulo(e.fechaInicio), fechaFin: vacioANulo(e.fechaFin),
      etapas: e.etapas, recalcularEtapas: recalcular
    };
  }

  async function guardar({ recalcular = false, silencioso = false } = {}) {
    try {
      const guardado = e.id ? await editarProyecto(e.id, envio({ recalcular })) : await crearProyecto(envio());
      cargarEnEstado(guardado);
      errores = {};
      sucio = false;
      if (!silencioso) avisar('success', 'Borrador guardado', guardado.nombre);
      return true;
    } catch (error) {
      errores = error.campos || {};
      const primera = Object.keys(errores)[0];
      if (primera) paso = pasoDeError(primera);
      avisar(error.campos ? 'warning' : 'error', error.campos ? 'Revisa los datos marcados' : 'No se pudo guardar', error.campos ? 'Hay un dato que corregir.' : error.message);
      dibujar();
      return false;
    }
  }

  async function ir(destino) {
    if (ocupado) return;
    ocupado = true;
    try {
      if (destino > paso) {
        if (paso === 1 && !e.nichoId) { errores = { nichoId: 'Elige un nicho.' }; avisar('warning', 'Falta el nicho', 'Elige el nicho del mes para continuar.'); return; }
        if (!(await guardar({ silencioso: true }))) return;
        if (destino === 2) await cargarCandidatos();
        if (destino === 4) previa = await vistaPreviaProyecto(e.id);
      } else if (destino === 2 && e.tiendaIds.length) await cargarCandidatos();
      paso = destino;
    } catch (error) {
      avisar('error', 'No se pudo continuar', error.message);
    } finally {
      ocupado = false;
      dibujar();
    }
  }

  async function cargarCandidatos() {
    candidatos = e.tiendaIds.length ? (await candidatosDeTiendas(e.tiendaIds)).candidatos : [];
  }

  async function activar() {
    if (ocupado) return;
    ocupado = true;
    dibujar();
    try {
      if (!(await guardar({ silencioso: true }))) return;
      if (opciones.ajustes.aprobarActivacion) {
        await pedirAprobacionProyecto(e.id);
        avisar('success', 'Aprobación pedida', 'El gerente la aprobará o la devolverá con comentarios.');
      } else {
        await activarProyecto(e.id, claveActivacion);
        avisar('success', 'Proyecto activado', 'Las empresas ya están repartidas entre los asesores.');
      }
      sucio = false;
      liberarSalida();
      window.location.hash = `#/proyectos/${e.id}`;
    } catch (error) {
      if (error.campos) { errores = error.campos; paso = pasoDeError(Object.keys(error.campos)[0]); }
      avisar(error.campos ? 'warning' : 'error', error.campos ? 'Faltan datos para activar' : 'No se pudo activar', error.campos ? 'Completa lo marcado y vuelve a intentar.' : error.message);
      if (!error.campos && error.status === 409) { claveActivacion = nuevaClave(); paso = 2; }
    } finally {
      ocupado = false;
      dibujar();
    }
  }

  // --- Paso 1 ---

  const opcionesMes = () => {
    const filas = [];
    for (let i = -1; i < 12; i += 1) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
      filas.push([`${d.getFullYear()}-${d.getMonth() + 1}`, `${mayuscula(MESES[d.getMonth()])} ${d.getFullYear()}`]);
    }
    return filas;
  };
  const codigoPrevio = () => {
    if (proyecto && proyecto.codigo) return proyecto.codigo;
    const nicho = opciones.nichos.find(n => n.id === e.nichoId);
    const iniciales = nicho ? quitarAcentos(nicho.nombre).split(/\s+/)[0].slice(0, 3).toUpperCase() : '···';
    return opciones.ajustes.codigoFormato.replace('{AAAA}', e.anio).replace('{MM}', String(e.mes).padStart(2, '0')).replace('{NICHO}', iniciales).replace('{N}', '01');
  };

  function paso1() {
    const selector = h('select', { id: 'asistente-plantilla', 'aria-label': 'Plantilla de proyecto', disabled: e.id ? '' : null }, opciones.plantillas.map(p => h('option', { value: String(p.id), text: p.nombre })));
    selector.value = e.plantillaId ? String(e.plantillaId) : '';
    selector.addEventListener('change', () => { e.plantillaId = Number(selector.value); sucio = true; dibujar(); });
    const pl = plantilla();
    const mes = h('select', { id: 'asistente-mes', 'aria-label': 'Mes del proyecto' }, opcionesMes().map(([v, t]) => h('option', { value: v, text: t })));
    mes.value = `${e.anio}-${e.mes}`;
    mes.addEventListener('change', () => { const [a, m] = mes.value.split('-').map(Number); e.anio = a; e.mes = m; sucio = true; dibujar(); });
    return [
      opciones.plantillas.length ? h('section', { class: 'panel' },
        h('div', { class: 'campo' }, h('label', { for: 'asistente-plantilla', text: 'Plantilla de proyecto' }), selector),
        pl ? h('p', { class: 'panel-descripcion' }, pl.predeterminada ? h('span', { class: 'chip-estado chip-estado--principal', text: 'Predeterminada' }) : null,
          ` ${pluralizar(pl.duracionSemanas, 'semana', 'semanas')} · ${pluralizar(pl.etapas.length, 'etapa', 'etapas')}${Object.values(pl.controles || {}).includes('bloqueado') ? ' · algunos datos los fija el administrador' : ''}`) : null) : null,
      h('section', { class: 'panel' },
        h('h2', { class: 'panel-titulo', text: '¿Qué nicho se trabaja este mes?' }),
        h('div', { class: 'tarjetas-nicho', role: 'radiogroup', 'aria-label': 'Nicho' }, opciones.nichos.map(n => h('button', {
          class: `tarjeta-nicho${e.nichoId === n.id ? ' tarjeta-nicho--activa' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(e.nichoId === n.id),
          onclick: () => { e.nichoId = n.id; delete errores.nichoId; sucio = true; dibujar(); }
        }, h('span', { class: 'tarjeta-nicho-nombre', text: n.nombre }), h('span', { class: 'tarjeta-nicho-detalle', text: pluralizar(n.empresas, 'empresa elegible', 'empresas elegibles') }), h('span', { class: 'tarjeta-nicho-radio' })))),
        errores.nichoId ? h('p', { class: 'campo-error', text: errores.nichoId }) : null),
      h('section', { class: 'panel' }, h('div', { class: 'form-rejilla' },
        h('div', { class: 'campo' }, h('label', { for: 'asistente-mes', text: 'Mes del proyecto' }), mes),
        h('div', { class: 'campo' }, h('label', { for: 'asistente-codigo', text: 'Código (automático)' }), h('input', { id: 'asistente-codigo', type: 'text', value: codigoPrevio(), disabled: '' }))))
    ];
  }

  // --- Paso 2 ---

  function alternarTienda(tiendaId, marcada) {
    e.tiendaIds = marcada ? [...new Set([...e.tiendaIds, tiendaId])] : e.tiendaIds.filter(t => t !== tiendaId);
    delete errores.tiendaIds;
    sucio = true;
  }

  function paso2() {
    const libres = opciones.tiendas.filter(t => !t.ocupada);
    const paises = [...new Map(opciones.tiendas.map(t => [t.paisId, t.pais])).entries()];
    const alcance = (modo, paisId) => {
      if (modo === 'una') e.tiendaIds = e.tiendaIds.slice(0, 1);
      if (modo === 'pais') e.tiendaIds = libres.filter(t => t.paisId === paisId).map(t => t.id);
      if (modo === 'region') e.tiendaIds = libres.map(t => t.id);
      sucio = true;
      cargarCandidatos().then(dibujar);
    };
    const selectorPais = h('select', { 'aria-label': 'País' }, paises.map(([pid, nombre]) => h('option', { value: String(pid), text: nombre })));
    const porPais = new Map();
    opciones.tiendas.forEach(t => { if (!porPais.has(t.pais)) porPais.set(t.pais, []); porPais.get(t.pais).push(t); });
    const excluir = (usuarioId, activo) => { if (activo) e.excluidos.delete(usuarioId); else e.excluidos.set(usuarioId, e.excluidos.get(usuarioId) || ''); sucio = true; dibujar(); };
    const activos = candidatos.filter(c => !e.excluidos.has(c.usuarioId)).length;
    return [
      opciones.todasLasTiendas ? aviso({ titulo: 'Entras como administrador', texto: 'Eliges entre todas las tiendas del portal. Un supervisor solo ve las tiendas que supervisa.' }) : null,
      h('section', { class: 'panel' },
        h('h2', { class: 'panel-titulo', text: '¿Qué tiendas participan?' }),
        h('div', { class: 'chips' },
          h('button', { class: 'btn btn--ghost btn--chico', type: 'button', onclick: () => alcance('una') }, 'Una tienda'),
          h('span', { class: 'selector-corto' }, selectorPais, h('button', { class: 'btn btn--ghost btn--chico', type: 'button', onclick: () => alcance('pais', Number(selectorPais.value)) }, 'Un país')),
          h('button', { class: 'btn btn--ghost btn--chico', type: 'button', onclick: () => alcance('region') }, 'Toda la región')),
        errores.tiendaIds ? aviso({ tipo: 'error', titulo: errores.tiendaIds }) : null,
        h('div', { class: 'tiendas-paises' }, [...porPais].map(([pais, lista]) => h('div', { class: 'tiendas-pais' },
          h('div', { class: 'campos-grupo-titulo', text: pais }),
          lista.map((t) => {
            const entrada = h('input', { type: 'checkbox', checked: e.tiendaIds.includes(t.id), disabled: t.ocupada ? '' : null });
            entrada.addEventListener('change', async () => { alternarTienda(t.id, entrada.checked); await cargarCandidatos(); dibujar(); });
            return h('label', { class: `opcion-tienda${t.ocupada ? ' opcion-tienda--ocupada' : ''}`, title: t.ocupada ? `Ya está en «${t.ocupada.proyecto}»` : '' },
              entrada, h('span', { text: `${t.codigo} · ${t.empresa}` }), t.ocupada ? h('span', { class: 'chip-estado chip-estado--no_contactar', text: 'Ocupada' }) : null);
          }))))),
      h('section', { class: 'panel' },
        h('h2', { class: 'panel-titulo', text: `Participantes (${activos} de ${candidatos.length})` }),
        h('p', { class: 'panel-descripcion', text: 'Reciben empresas los asesores de las tiendas elegidas. Si alguien no participa este mes, quítale la marca y escribe por qué.' }),
        errores.excluidos ? aviso({ tipo: 'error', titulo: errores.excluidos }) : null,
        candidatos.length ? h('ul', { class: 'lista-participantes' }, candidatos.map((c) => {
          const incluido = !e.excluidos.has(c.usuarioId);
          const entrada = h('input', { type: 'checkbox', checked: incluido });
          entrada.addEventListener('change', () => excluir(c.usuarioId, entrada.checked));
          const motivo = h('input', { type: 'text', class: 'entrada-tabla', placeholder: 'Motivo (opcional)', maxlength: 255, value: e.excluidos.get(c.usuarioId) || '' });
          motivo.addEventListener('input', () => { e.excluidos.set(c.usuarioId, motivo.value); sucio = true; });
          return h('li', { class: incluido ? '' : 'participante--excluido' },
            h('label', { class: 'opcion-tienda' }, entrada, h('span', { class: 'participante-nombre', text: c.nombre }), h('span', { class: 'texto-tenue', text: `${c.tienda} · ${c.pais}${c.tipo === 'supervisor' ? ' · supervisor' : ''}` })),
            incluido ? null : motivo);
        })) : h('p', { class: 'panel-descripcion', text: 'Elige al menos una tienda para ver a sus asesores.' }))
    ];
  }

  // --- Paso 3 ---

  function paso3() {
    const c = controles();
    const base = { valores: e, errores, prefijoId: 'asistente' };
    const bloquear = (nodo, control) => { if (c[control] === 'bloqueado') { nodo.control.disabled = true; nodo.classList.add('campo--bloqueado'); } return nodo; };
    const marcador = (control) => (c[control] === 'bloqueado' ? icono('lock-closed-outline') : null);
    const fechasBloqueadas = c.fechas_etapas === 'bloqueado';
    const cambioInicio = async () => { sucio = true; if (e.id && e.fechaInicio && await guardar({ recalcular: true, silencioso: true })) dibujar(); };
    const etapaEntrada = (i, clave, tipo) => {
      const entrada = h('input', { type: tipo, class: 'entrada-tabla', value: e.etapas[i][clave] || '', disabled: fechasBloqueadas ? '' : null, 'aria-label': `${clave} de la etapa ${i + 1}` });
      entrada.addEventListener('change', () => { e.etapas[i][clave] = entrada.value; sucio = true; });
      return entrada;
    };
    return [
      h('section', { class: 'panel' },
        h('h2', { class: 'panel-titulo' }, 'Muestra y meta ', marcador('articulo')),
        h('div', { class: 'form-rejilla' },
          bloquear(campoLista({ ...base, clave: 'articuloId', etiqueta: 'Artículo de muestra', opciones: opciones.articulos.map(a => ({ id: a.id, nombre: a.nombre })), vacio: 'Sin artículo', obligatorio: c.articulo === 'obligatorio' }), 'articulo'),
          bloquear(campoTexto({ ...base, clave: 'existenciaMuestras', etiqueta: 'Existencia para el proyecto', maximo: 8, ayuda: 'Unidades de muestra.', obligatorio: c.existencia === 'obligatorio' }), 'existencia'),
          bloquear(campoTexto({ ...base, clave: 'topePorAsesor', etiqueta: 'Tope de empresas por asesor', maximo: 3, ayuda: opciones.ajustes.topePorAsesor ? `Si lo dejas vacío: ${opciones.ajustes.topePorAsesor}. Lo que sobra queda en reserva.` : 'Opcional. Lo que sobra queda en reserva.', obligatorio: c.tope === 'obligatorio' }), 'tope'),
          bloquear(campoTexto({ ...base, clave: 'metaMonto', etiqueta: 'Meta de venta', maximo: 14, obligatorio: c.meta === 'obligatorio' }), 'meta'),
          bloquear(campoLista({ ...base, clave: 'metaMoneda', etiqueta: 'Moneda de la meta', opciones: opciones.monedas.map(m => ({ id: m.codigo, nombre: `${m.simbolo || ''} ${m.codigo} · ${m.nombre}`.trim() })), vacio: 'Sin moneda', textoIds: true }), 'meta'))),
      h('section', { class: 'panel' },
        h('h2', { class: 'panel-titulo' }, `Las ${pluralizar(e.etapas.length, 'etapa', 'etapas')} del mes `, marcador('fechas_etapas')),
        h('div', { class: 'form-rejilla' },
          bloquear(campoTexto({ ...base, clave: 'fechaInicio', etiqueta: 'Fecha de inicio', tipo: 'date', maximo: 10, obligatorio: true, alCambiar: cambioInicio }), 'fechas_etapas'),
          bloquear(campoTexto({ ...base, clave: 'fechaFin', etiqueta: 'Fecha de fin', tipo: 'date', maximo: 10, obligatorio: true, alCambiar: () => { sucio = true; } }), 'fechas_etapas')),
        h('p', { class: 'panel-descripcion', text: 'Orientan, no bloquean: el asesor registra en cualquier etapa.' }),
        e.etapas.length ? h('div', { class: 'tabla-caja' }, h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table' },
          h('thead', null, h('tr', null, ['Etapa', 'Inicio', 'Fin', 'Qué se espera'].map(t => h('th', { text: t })))),
          h('tbody', null, e.etapas.map((et, i) => h('tr', null,
            h('td', { class: 'cambio-ajuste', text: et.nombre }), h('td', null, etapaEntrada(i, 'fechaInicio', 'date')), h('td', null, etapaEntrada(i, 'fechaFin', 'date')),
            h('td', { class: 'texto-tenue', text: et.descripcion || '—' }))))))) : h('p', { class: 'panel-descripcion', text: 'Este proyecto no tiene etapas (no usa plantilla).' }))
    ];
  }

  // --- Paso 4 ---

  function paso4() {
    if (!previa) return [h('section', { class: 'panel' }, cargando())];
    const dato = (n, texto, clase = '') => h('div', { class: `tarjeta-cifra ${clase}` }, h('strong', { text: String(n) }), h('span', { text: texto }));
    const maximo = Math.max(1, ...previa.porAsesor.map(a => a.empresas));
    const filas = previa.porAsesor.slice(0, 12);
    return [
      h('div', { class: 'cifras-reparto' },
        dato(previa.totalEmpresas, 'Empresas elegibles'), dato(previa.asignadas, 'Se repartirán'),
        dato(previa.sinAsesor, 'Sin asesor', previa.sinAsesor ? 'tarjeta-cifra--aviso' : ''), dato(previa.reserva, 'En reserva'), dato(previa.porAsesor.length, 'Asesores')),
      ...previa.sinAsesorPorPais.map(p => aviso({ tipo: 'advertencia', titulo: `${pluralizar(p.cantidad, 'empresa de', 'empresas de')} ${p.pais} quedan fuera del reparto`, texto: `Ningún asesor de ${p.pais} participa. Puedes sumar uno en el paso 2.` })),
      previa.excluidos.length ? aviso({ titulo: `${pluralizar(previa.excluidos.length, 'asesor excluido', 'asesores excluidos')}`, texto: previa.excluidos.map(x => `${x.nombre}${x.motivo ? ` (${x.motivo})` : ''}`).join(' · ') }) : null,
      h('div', { class: 'tabla-caja' }, h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table' },
        h('thead', null, h('tr', null, ['Asesor', 'Tienda', 'País', 'Empresas'].map(t => h('th', { text: t })))),
        h('tbody', null, filas.map(a => h('tr', null, h('td', { text: a.nombre }), h('td', { text: a.tienda }), h('td', { text: a.pais }),
          h('td', null, h('div', { class: 'barra-fila' }, h('div', { class: 'barra' }, h('span', { style: `width:${Math.round((a.empresas / maximo) * 100)}%` })), h('strong', { text: String(a.empresas) }))))))),
        previa.porAsesor.length > filas.length ? h('div', { class: 'tabla-pie' }, h('span', { text: `… y ${previa.porAsesor.length - filas.length} asesores más · el reparto completo se ve al activar` })) : null)),
      h('p', { class: 'panel-descripcion', text: `Reparto equitativo: la diferencia máxima entre asesores de un mismo país es de ${pluralizar(previa.diferenciaMaxima, 'empresa', 'empresas')}. Vista previa, aún no se guarda.` }),
      opciones.ajustes.aprobarActivacion ? aviso({ titulo: 'Esta activación necesita aprobación', texto: 'Al continuar se pide la aprobación del gerente. No se reparte nada hasta que la apruebe.' }) : null
    ];
  }

  // --- Marco: título, pasos, resumen y botones ---

  function resumen() {
    const nicho = opciones.nichos.find(n => n.id === e.nichoId);
    const articulo = opciones.articulos.find(a => a.id === e.articuloId);
    const fila = (titulo, valor, listo) => h('div', { class: 'resumen-fila' },
      h('div', null, h('div', { class: 'resumen-fila-titulo', text: titulo }), h('div', { class: listo ? 'resumen-fila-valor' : 'resumen-fila-valor resumen-fila-valor--pendiente', text: valor })),
      icono(listo ? 'checkmark-outline' : 'time-outline'));
    return h('aside', { class: 'panel resumen-lateral' }, h('h2', { class: 'panel-titulo', text: 'Resumen' }),
      fila('Nicho', nicho ? nicho.nombre : 'Pendiente', Boolean(nicho)),
      fila('Mes', `${mayuscula(MESES[e.mes - 1])} ${e.anio}`, true),
      fila('Alcance', e.tiendaIds.length ? `${e.tiendaIds.length} de ${opciones.tiendas.length} tiendas` : 'Pendiente', e.tiendaIds.length > 0),
      fila('Artículo', articulo ? `${articulo.nombre}${e.existenciaMuestras !== '' ? ` · ${e.existenciaMuestras}` : ''}` : (paso >= 3 ? 'Sin artículo' : 'Pendiente'), Boolean(articulo)),
      fila('Fin del proyecto', e.fechaFin || 'Pendiente', Boolean(e.fechaFin)),
      fila('Reparto', previa ? `${previa.asignadas} empresas · ${previa.porAsesor.length} asesores` : 'Pendiente', Boolean(previa)),
      h('p', { class: 'resumen-nota', text: opciones.todasLasTiendas ? 'Como administrador puedes incluir cualquier tienda.' : 'Un supervisor solo puede incluir tiendas que supervisa.' }));
  }

  function dibujar() {
    const cuerpo = [paso1, paso2, paso3, paso4][paso - 1]();
    const comentario = proyecto && proyecto.aprobacionComentario;
    montar(zona,
      comentario ? aviso({ tipo: 'advertencia', titulo: 'El gerente devolvió el proyecto', texto: comentario }) : null,
      h('ol', { class: 'pasos-asistente' }, PASOS.map((texto, i) => h('li', { class: `paso-asistente${paso === i + 1 ? ' paso-asistente--actual' : ''}${paso > i + 1 ? ' paso-asistente--hecho' : ''}` },
        h('span', { class: 'paso-asistente-numero' }, paso > i + 1 ? icono('checkmark-outline') : String(i + 1)), h('span', { class: 'paso-asistente-texto', text: texto })))),
      h('div', { class: 'asistente-cuerpo' }, h('div', { class: 'asistente-columna' }, cuerpo), resumen()),
      h('div', { class: 'formulario-acciones' },
        paso > 1 ? h('button', { class: 'btn btn--ghost', type: 'button', disabled: ocupado, onclick: () => ir(paso - 1) }, icono('arrow-back-outline'), 'Atrás') : null,
        paso < 4
          ? h('button', { class: `btn btn--primary${ocupado ? ' btn--loading' : ''}`, type: 'button', disabled: ocupado, onclick: () => ir(paso + 1) }, icono('chevron-forward-outline'), 'Continuar')
          : h('button', { class: `btn btn--primary${ocupado ? ' btn--loading' : ''}`, type: 'button', disabled: ocupado || !previa, onclick: activar }, icono('checkmark-outline'), opciones.ajustes.aprobarActivacion ? 'Pedir aprobación' : 'Activar proyecto')));
  }

  montar(cont,
    cabecera({
      titulo: e.id ? 'Continuar proyecto' : 'Crear proyecto', subtitulo: 'Paso a paso: un borrador no reparte nada hasta que lo actives.',
      acciones: h('div', { class: 'acciones-cabecera' },
        h('a', { class: 'btn btn--ghost', href: '#/proyectos' }, icono('arrow-back-outline'), 'Proyectos'),
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: async () => { if (!e.nichoId) { avisar('warning', 'Falta el nicho', 'Elige el nicho para guardar el borrador.'); return; } if (await guardar()) dibujar(); } }, 'Guardar borrador'))
    }),
    zona);
  if (paso >= 2 && e.tiendaIds.length) await cargarCandidatos();
  dibujar();
}
