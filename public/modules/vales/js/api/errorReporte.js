// Error de una petición de Reportes: lleva de dónde viene (etapa, código, referencia del servidor) para ubicarlo en el log. Módulo puro, sin DOM.
const CODIGO_POR_ESTADO = { 400: 'REPORTE_FILTRO_INVALIDO', 403: 'REPORTE_SIN_ACCESO', 404: 'REPORTE_NO_ENCONTRADO', 429: 'REPORTE_LIMITE' };

export class ErrorReporte extends Error {
  constructor(mensaje, { status = 0, codigo = '', referencia = '', etapa = '', reintentarEnSegundos = null, reporte = '' } = {}) {
    super(mensaje);
    this.name = 'ErrorReporte';
    this.status = status;
    this.codigo = codigo;
    this.referencia = referencia;
    this.etapa = etapa;
    this.reintentarEnSegundos = reintentarEnSegundos;
    this.reporte = reporte;
  }

  // `data` es el cuerpo ya leído (objeto) o null/undefined si no era JSON; sin código del servidor se deduce del estado HTTP (p. ej. un proxy que responde 502).
  static deRespuesta(res, data, { etapa = '', reporte = '' } = {}) {
    const cuerpo = data && typeof data === 'object' ? data : {};
    const segundos = Number(cuerpo.reintentarEnSegundos);
    return new ErrorReporte(typeof cuerpo.error === 'string' && cuerpo.error ? cuerpo.error : '', {
      status: res.status,
      codigo: cuerpo.codigo || CODIGO_POR_ESTADO[res.status] || (res.status >= 500 ? 'REPORTE_INTERNO' : ''),
      referencia: cuerpo.referencia || '',
      etapa: cuerpo.etapa || etapa,
      reintentarEnSegundos: Number.isFinite(segundos) && segundos > 0 ? segundos : null,
      reporte
    });
  }

  // `fetch` falla con TypeError cuando no hay conexión con el servidor.
  static deRed(error, { etapa = '', reporte = '' } = {}) {
    return new ErrorReporte(error?.message || '', { status: 0, codigo: 'REPORTE_RED', etapa, reporte });
  }

  // Fallo de la propia pantalla (no de una petición): sirve para no confundirlo con uno del servidor.
  static deCliente(error, { etapa = '', reporte = '' } = {}) {
    return new ErrorReporte(error?.message || '', { status: 0, codigo: 'REPORTE_CLIENTE', etapa, reporte });
  }
}
