// Definición declarativa de los catálogos simples de Configuración; refleja src/modules/viaticos/catalogos.js (longitudes y reglas).
// `texto` es el prefijo de las claves de textos.js (titulo, subtitulo, alta, edicion, vacio.*).
// `columnas`: campo de la fila (y clave de su etiqueta); `campos`: lo que lleva el formulario; `soloAlta`: no se cambia al editar.
// `informativos`: marcas que solo se muestran; `protegidos`: nombres de filas que el módulo busca por nombre.

const NOMBRE_100 = (placeholder) => ({ nombre: 'nombre', tipo: 'texto', max: 100, placeholder });

export const DEFINICIONES = Object.freeze({
  monedas: {
    recurso: 'monedas',
    texto: 'config.monedas',
    columnas: [{ campo: 'codigo' }, { campo: 'nombre' }, { campo: 'simbolo' }],
    busca: ['codigo', 'nombre', 'simbolo'],
    campos: [
      { nombre: 'codigo', tipo: 'texto', max: 3, mayusculas: true, formato: /^[A-Z]{3}$/, regla: 'config.regla.codigoMoneda', placeholder: 'config.ph.codigoMoneda' },
      { nombre: 'nombre', tipo: 'texto', max: 50, placeholder: 'config.ph.nombreMoneda' },
      { nombre: 'simbolo', tipo: 'texto', max: 5, placeholder: 'config.ph.simbolo' }
    ]
  },
  'tipos-licencia': {
    recurso: 'tipos-licencia',
    texto: 'config.tipos-licencia',
    columnas: [{ campo: 'codigo' }, { campo: 'nombre' }],
    busca: ['codigo', 'nombre'],
    campos: [
      { nombre: 'codigo', tipo: 'texto', max: 20, placeholder: 'config.ph.codigoLicencia' },
      NOMBRE_100('config.ph.nombreLicencia')
    ]
  },
  // Se administra dentro de «Reglas de licencia», por país: el país no es un campo de esta definición (lo fija la sección).
  'tipos-placa': {
    recurso: 'tipos-placa',
    texto: 'config.tipos-placa',
    columnas: [{ campo: 'codigo' }, { campo: 'nombre' }],
    busca: ['codigo', 'nombre'],
    campos: [
      { nombre: 'codigo', tipo: 'texto', max: 20, placeholder: 'config.ph.codigoPlaca' },
      NOMBRE_100('config.ph.nombrePlaca')
    ]
  },
  ubicaciones: {
    recurso: 'ubicaciones',
    texto: 'config.ubicaciones',
    columnas: [{ campo: 'nombre' }, { campo: 'paisNombre' }],
    busca: ['nombre', 'paisNombre'],
    // El país no cambia al editar: dejaría datos ligados al país anterior.
    campos: [
      { nombre: 'paisId', tipo: 'pais', soloAlta: true },
      NOMBRE_100('config.ph.nombreUbicacion')
    ]
  },
  motivos: {
    recurso: 'motivos',
    texto: 'config.motivos',
    columnas: [{ campo: 'nombre' }],
    busca: ['nombre'],
    campos: [NOMBRE_100('config.ph.nombreMotivo')]
  },
  'tipos-gasto': {
    recurso: 'tipos-gasto',
    texto: 'config.tipos-gasto',
    columnas: [{ campo: 'nombre' }],
    busca: ['nombre'],
    campos: [NOMBRE_100('config.ph.nombreGasto')],
    informativos: ['esOtros', 'seleccionableEnGastos'],
    // La liquidación identifica estos dos rubros por nombre: no se renombran ni se desactivan (el servidor responde 409).
    protegidos: ['Hospedaje', 'Combustible']
  },
  'tipos-defecto': {
    recurso: 'tipos-defecto',
    texto: 'config.tipos-defecto',
    columnas: [{ campo: 'nombre' }],
    busca: ['nombre'],
    campos: [NOMBRE_100('config.ph.nombreDefecto')],
    informativos: ['esOtros']
  }
});
