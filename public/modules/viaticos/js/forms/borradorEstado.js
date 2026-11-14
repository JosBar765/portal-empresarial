// Conversión pura (sin DOM) entre el estado del formulario y el `datos` de un borrador: el borrador no guarda fotos ni archivos.
import { MODALIDADES } from '../config/constantes.js';
import { aId } from '../utils/ids.js';
import { estadoInicial } from './datos.js';
import { defectoNuevo } from './datosCorto.js';

const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const texto = (valor) => (typeof valor === 'string' ? valor : (typeof valor === 'number' && Number.isFinite(valor) ? String(valor) : ''));
const lista = (valor) => (Array.isArray(valor) ? valor : []);
const objeto = (valor) => (esObjeto(valor) ? valor : {});
const soloMarcadas = (mapa) => Object.fromEntries(Object.entries(objeto(mapa)).filter(([, marcado]) => marcado === true));

// Estado -> `datos` JSON plano; de los defectos solo viaja el tipo y la descripción (la foto se vuelve a pedir al abrirlo).
export function estadoABorrador(estado) {
  const datos = {
    paisId: estado.paisId,
    modalidad: estado.modalidad,
    monedaId: estado.monedaId,
    vehiculoId: estado.vehiculoId,
    rendimiento: estado.rendimiento,
    precioGalon: estado.precioGalon,
    depreciacion: estado.depreciacion,
    fechaSalida: estado.fechaSalida,
    fechaRegreso: estado.fechaRegreso,
    motivoId: estado.motivoId,
    origenInicialId: estado.origenInicialId,
    tramos: estado.tramos.map(fila => ({ destinoId: fila.destinoId })),
    hospedajes: estado.hospedajes.map(fila => ({ hotel: fila.hotel, lugar: fila.lugar, noches: fila.noches, valorNoche: fila.valorNoche })),
    comidas: estado.comidas,
    comidasAutoMarcar: estado.comidasAutoMarcar,
    comidasDesmarcadas: estado.comidasDesmarcadas,
    gastos: estado.gastos.map(fila => ({ tipoGastoId: fila.tipoGastoId, descripcion: fila.descripcion, monto: fila.monto })),
    horaSalida: estado.horaSalida,
    odometro: estado.odometro,
    fluidos: estado.fluidos,
    kit: estado.kit,
    defectos: estado.defectos.map(fila => ({ tipoDefectoId: fila.tipoDefectoId, descripcion: fila.descripcion }))
  };
  // El viaje por JSON deja un objeto sin referencias al estado vivo (ni Files ni URLs de fotos).
  return JSON.parse(JSON.stringify(datos));
}

// `datos` guardado -> estado completo sobre los valores iniciales; lo que falte o tenga un tipo raro cae al valor por defecto.
// Los ids que dependen del catálogo no se validan aquí: los depura `reconciliarEstado` al cargarlo.
export function borradorAEstado(datos, modalidad, { paises = [] } = {}) {
  const base = estadoInicial({ paises });
  const d = objeto(datos);
  const paisId = aId(d.paisId);
  const tramos = lista(d.tramos).map(fila => ({ destinoId: aId(objeto(fila).destinoId) }));
  const comidas = {};
  for (const [dia, tipos] of Object.entries(objeto(d.comidas))) {
    const marcados = soloMarcadas(tipos);
    if (Object.keys(marcados).length) comidas[dia] = marcados;
  }
  const fluidos = {};
  for (const [fluidoId, nivelId] of Object.entries(objeto(d.fluidos))) {
    if (aId(nivelId) !== '') fluidos[fluidoId] = aId(nivelId);
  }
  const kit = {};
  for (const [itemId, presente] of Object.entries(objeto(d.kit))) {
    if (typeof presente === 'boolean') kit[itemId] = presente;
  }
  return {
    ...base,
    paisId: paisId === '' ? base.paisId : paisId,
    modalidad: Object.values(MODALIDADES).includes(modalidad) ? modalidad : base.modalidad,
    monedaId: aId(d.monedaId),
    vehiculoId: aId(d.vehiculoId),
    rendimiento: texto(d.rendimiento),
    precioGalon: texto(d.precioGalon),
    depreciacion: texto(d.depreciacion),
    fechaSalida: texto(d.fechaSalida),
    fechaRegreso: texto(d.fechaRegreso),
    motivoId: aId(d.motivoId),
    origenInicialId: aId(d.origenInicialId),
    tramos: tramos.length ? tramos : base.tramos,
    hospedajes: lista(d.hospedajes).map(objeto).map(fila => ({ hotel: texto(fila.hotel), lugar: texto(fila.lugar), noches: texto(fila.noches), valorNoche: texto(fila.valorNoche) })),
    comidas,
    comidasAutoMarcar: typeof d.comidasAutoMarcar === 'boolean' ? d.comidasAutoMarcar : base.comidasAutoMarcar,
    comidasDesmarcadas: soloMarcadas(d.comidasDesmarcadas),
    gastos: lista(d.gastos).map(objeto).map(fila => ({ tipoGastoId: aId(fila.tipoGastoId), descripcion: texto(fila.descripcion), monto: texto(fila.monto) })),
    horaSalida: texto(d.horaSalida),
    odometro: texto(d.odometro),
    fluidos,
    kit,
    defectos: lista(d.defectos).map(objeto).map(fila => ({ ...defectoNuevo(), tipoDefectoId: aId(fila.tipoDefectoId), descripcion: texto(fila.descripcion) }))
  };
}
