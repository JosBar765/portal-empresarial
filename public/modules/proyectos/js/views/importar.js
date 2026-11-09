// Importar clientes: archivo (S8) → vista previa (S9) → resultado (S11).
// El archivo se queda en el navegador: el servidor lo recibe en la vista previa y otra vez al confirmar, y lo revalida.
import { h, icono, montar } from '../utils/dom.js';
import { pluralizar } from '../utils/formato.js';
import { cabecera, aviso, cargando, avisar } from '../components/ui.js';
import { obtenerOpcionesClientes, previsualizarImportacion, confirmarImportacion, URL_PLANTILLA } from '../api/api.js';
import { descargarCsv } from '../utils/csv.js';

const FILAS_POR_TANDA = 100;
const ETIQUETA_FILA = { nueva: 'Nueva', duplicada: 'Duplicada', error: 'Con error' };
const CLASE_FILA = { nueva: 'activa', duplicada: 'inactiva', error: 'no_contactar' };
const COLUMNAS_ETIQUETA = {
  empresa: 'Empresa', nicho: 'Nicho', pais: 'País', ciudad: 'Ciudad', telefono: 'Teléfono', direccion: 'Dirección', sitio_web: 'Sitio web',
  contacto_nombre: 'Contacto', contacto_area: 'Área del contacto', contacto_cargo: 'Cargo', contacto_telefono: 'Teléfono del contacto', contacto_correo: 'Correo del contacto'
};

const RAZON = { telefono: 'mismo teléfono', nombre_ciudad: 'nombre y ciudad parecidos' };
const textoErrores = (errores) => Object.entries(errores).map(([c, m]) => `${COLUMNAS_ETIQUETA[c] || c}: ${m}`).join(' · ');
const nuevaClave = () => (crypto.randomUUID ? crypto.randomUUID() : `imp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

export async function renderImportar(cont) {
  montar(cont, cargando());
  const opciones = await obtenerOpcionesClientes();
  if (!opciones.permisos.importar) {
    montar(cont, cabecera({ titulo: 'Importar clientes' }), aviso({ tipo: 'error', titulo: 'No puedes importar empresas', texto: 'Tu rol no tiene este permiso.' }));
    return;
  }
  const limites = opciones.importacion;
  let archivo = null;
  let claveOperacion = null;
  let previa = null;
  let duplicadas = limites.duplicadasPorDefecto;
  let filtro = 'todas';
  let visibles = FILAS_POR_TANDA;
  let ocupado = false;
  let errorArchivo = null;

  const zona = h('div');

  // --- S8 · Archivo ---

  function elegirArchivo(candidato) {
    errorArchivo = null;
    if (!candidato) return;
    if (!/\.csv$/i.test(candidato.name)) errorArchivo = 'Sube un archivo .csv (en Excel: Guardar como › CSV).';
    else if (candidato.size === 0) errorArchivo = 'El archivo está vacío.';
    else if (candidato.size > limites.maxMb * 1024 * 1024) errorArchivo = `El archivo pesa más de ${limites.maxMb} MB. Divídelo en partes más pequeñas.`;
    archivo = errorArchivo ? null : candidato;
    dibujarArchivo();
  }

  function dibujarArchivo() {
    const entrada = h('input', { type: 'file', accept: '.csv,text/csv', class: 'archivo-oculto', id: 'importar-archivo', 'aria-label': 'Archivo CSV' });
    entrada.addEventListener('change', () => elegirArchivo(entrada.files[0]));
    const caja = h('label', { class: `caja-archivo${archivo ? ' caja-archivo--lleno' : ''}`, for: 'importar-archivo' },
      icono(archivo ? 'document-text-outline' : 'cloud-upload-outline'),
      h('span', { class: 'caja-archivo-titulo', text: archivo ? archivo.name : 'Elige o arrastra tu archivo .csv' }),
      h('span', { class: 'caja-archivo-detalle', text: archivo ? `${(archivo.size / 1024).toFixed(archivo.size < 10240 ? 1 : 0)} KB` : `Hasta ${limites.maxFilas} filas y ${limites.maxMb} MB` }));
    ['dragover', 'dragenter'].forEach(e => caja.addEventListener(e, (ev) => { ev.preventDefault(); caja.classList.add('caja-archivo--sobre'); }));
    ['dragleave', 'drop'].forEach(e => caja.addEventListener(e, () => caja.classList.remove('caja-archivo--sobre')));
    caja.addEventListener('drop', (ev) => { ev.preventDefault(); elegirArchivo(ev.dataTransfer.files[0]); });

    montar(zona,
      h('section', { class: 'panel' },
        h('ol', { class: 'pasos' },
          h('li', null, h('strong', { text: 'Descarga la plantilla' }), ' y llénala con una empresa por fila. Nicho y país deben escribirse como en el sistema.'),
          h('li', null, h('strong', { text: 'Súbela aquí.' }), ' Te mostramos qué se crearía, qué ya existe y qué tiene errores antes de guardar nada.'),
          h('li', null, h('strong', { text: 'Confirma.' }), ' Solo se importan las empresas sin error.')),
        h('a', { class: 'btn btn--ghost', href: URL_PLANTILLA, download: '' }, icono('download-outline'), 'Descargar plantilla'),
        caja, entrada,
        errorArchivo ? aviso({ tipo: 'error', titulo: errorArchivo }) : null,
        h('div', { class: 'formulario-acciones' },
          h('button', { class: 'btn btn--primary', type: 'button', disabled: !archivo || ocupado, onclick: revisar }, icono('search-outline'), 'Revisar archivo'))));
  }

  async function revisar() {
    if (!archivo || ocupado) return;
    ocupado = true;
    dibujarArchivo();
    try {
      previa = await previsualizarImportacion(archivo);
      claveOperacion = nuevaClave();
      duplicadas = previa.duplicadasPorDefecto;
      filtro = 'todas';
      visibles = FILAS_POR_TANDA;
      ocupado = false;
      dibujarPrevia();
    } catch (error) {
      ocupado = false;
      errorArchivo = error.message;
      dibujarArchivo();
    }
  }

  // --- S9 · Vista previa ---

  const filasFiltradas = () => previa.filas.filter(f => filtro === 'todas' || f.estado === { nuevas: 'nueva', duplicadas: 'duplicada', errores: 'error' }[filtro]);

  function detalleDeFila(f) {
    if (f.estado === 'error') return textoErrores(f.errores);
    if (f.estado === 'duplicada') return `Se parece a «${f.duplicadaDe.nombre}»${f.duplicadaDe.ciudad ? ` (${f.duplicadaDe.ciudad})` : ''}: ${f.duplicadaDe.razones.map(r => RAZON[r] || r).join(' y ')}.`;
    return 'Se creará.';
  }

  function dibujarPrevia() {
    const r = previa.resumen;
    const lista = filasFiltradas();
    const aImportar = r.nuevas + (duplicadas === 'actualizar' ? r.duplicadas : 0);
    const pestana = (id, titulo, n) => h('button', { class: `pestana${filtro === id ? ' pestana-activa' : ''}`, type: 'button', onclick: () => { filtro = id; visibles = FILAS_POR_TANDA; dibujarPrevia(); } },
      titulo, h('span', { class: 'pestana-cuenta', text: String(n) }));

    montar(zona,
      h('section', { class: 'panel' },
        h('div', { class: 'resumen-importacion' },
          h('div', { class: 'resumen-dato resumen-dato--nueva' }, h('strong', { text: String(r.nuevas) }), h('span', { text: r.nuevas === 1 ? 'Nueva' : 'Nuevas' })),
          h('div', { class: 'resumen-dato resumen-dato--duplicada' }, h('strong', { text: String(r.duplicadas) }), h('span', { text: r.duplicadas === 1 ? 'Duplicada' : 'Duplicadas' })),
          h('div', { class: 'resumen-dato resumen-dato--error' }, h('strong', { text: String(r.conError) }), h('span', { text: 'Con error' }))),
        h('p', { class: 'panel-descripcion', text: `${archivo.name} · ${pluralizar(r.total, 'fila', 'filas')}` }),
        r.duplicadas ? h('fieldset', { class: 'opciones-duplicadas' },
          h('legend', { text: 'Las duplicadas (ya existen en la base)' }),
          ...[['omitir', 'Omitirlas: dejar la empresa como está'], ['actualizar', 'Completarlas: llenar lo que esté vacío, sin pisar datos']].map(([valor, texto]) => h('label', { class: 'opcion-radio' },
            h('input', { type: 'radio', name: 'duplicadas', value: valor, checked: duplicadas === valor, onchange: () => { duplicadas = valor; dibujarPrevia(); } }), h('span', { text: texto })))) : null,
        r.conError ? aviso({ tipo: 'advertencia', titulo: `${pluralizar(r.conError, 'fila tiene', 'filas tienen')} errores y no se ${r.conError === 1 ? 'importará' : 'importarán'}`, texto: 'Corrige el archivo y vuelve a subirlo, o importa ahora el resto.' }) : null),
      h('div', { class: 'pestanas', role: 'tablist' }, pestana('todas', 'Todas', r.total), pestana('nuevas', 'Nuevas', r.nuevas), pestana('duplicadas', 'Duplicadas', r.duplicadas), pestana('errores', 'Con error', r.conError)),
      h('div', { class: 'tabla-caja' },
        h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table' },
          h('thead', null, h('tr', null, ['Línea', 'Empresa', 'Ubicación', 'Estado', 'Detalle'].map(t => h('th', { text: t })))),
          h('tbody', null, lista.slice(0, visibles).map(f => h('tr', null,
            h('td', { class: 'num', text: String(f.linea) }),
            h('td', { class: 'cambio-ajuste', text: f.empresa || '—' }),
            h('td', { text: [f.ciudad, f.pais].filter(Boolean).join(' · ') || '—' }),
            h('td', null, h('span', { class: `chip-estado chip-estado--${CLASE_FILA[f.estado]}`, text: ETIQUETA_FILA[f.estado] })),
            h('td', { class: f.estado === 'error' ? 'detalle-error' : 'detalle-fila', text: detalleDeFila(f) })))))),
        h('div', { class: 'tabla-pie' },
          h('span', { text: `Mostrando ${Math.min(visibles, lista.length)} de ${lista.length}` }),
          visibles < lista.length ? h('button', { class: 'enlace-boton', type: 'button', text: 'Ver más', onclick: () => { visibles += FILAS_POR_TANDA; dibujarPrevia(); } }) : null)),
      h('div', { class: 'formulario-acciones' },
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { previa = null; archivo = null; dibujarArchivo(); } }, 'Cambiar archivo'),
        h('button', { class: `btn btn--primary${ocupado ? ' btn--loading' : ''}`, type: 'button', disabled: aImportar === 0 || ocupado, onclick: confirmar },
          icono('checkmark-outline'), aImportar ? `Importar ${pluralizar(aImportar, 'empresa', 'empresas')}` : 'Nada que importar')));
  }

  async function confirmar() {
    if (ocupado) return;
    ocupado = true;
    dibujarPrevia();
    try {
      const resultado = await confirmarImportacion(archivo, duplicadas, claveOperacion);
      ocupado = false;
      dibujarResultado(resultado);
    } catch (error) {
      ocupado = false;
      avisar('error', 'No se pudo importar', error.message);
      dibujarPrevia();
    }
  }

  // --- S11 · Resultado ---

  function descargarErrores(resultado) {
    const filas = [['linea', 'empresa', 'columna', 'motivo']];
    resultado.errores.forEach(f => Object.entries(f.errores).forEach(([c, m]) => filas.push([f.linea, f.empresa, COLUMNAS_ETIQUETA[c] || c, m])));
    descargarCsv('errores_importacion.csv', filas);
  }

  function dibujarResultado(r) {
    const dato = (numero, texto, clase) => h('div', { class: `resumen-dato resumen-dato--${clase}` }, h('strong', { text: String(numero) }), h('span', { text: texto }));
    montar(zona, h('section', { class: 'panel' },
      h('div', { class: 'resultado-titulo' }, icono(r.creadas || r.actualizadas ? 'checkmark-circle-outline' : 'information-circle-outline'),
        h('h2', { class: 'panel-titulo', text: r.creadas || r.actualizadas ? 'Importación terminada' : 'No se importó ninguna empresa' })),
      r.repetida ? aviso({ titulo: 'Esta importación ya se había aplicado', texto: 'Mostramos su resultado; no se creó nada otra vez.' }) : null,
      h('div', { class: 'resumen-importacion' },
        dato(r.creadas, r.creadas === 1 ? 'Creada' : 'Creadas', 'nueva'),
        dato(r.actualizadas, r.actualizadas === 1 ? 'Completada' : 'Completadas', 'actualizada'),
        dato(r.duplicadas - r.actualizadas < 0 ? 0 : r.duplicadas - r.actualizadas, 'Omitidas', 'duplicada'),
        dato(r.conError, 'Con error', 'error')),
      r.conError ? h('p', { class: 'panel-descripcion', text: r.errores.length < r.conError ? `Se descargan las primeras ${r.errores.length} filas con error; corrige y vuelve a subir para ver el resto.` : 'Descarga las filas con error, corrígelas y súbelas de nuevo.' }) : null,
      h('div', { class: 'formulario-acciones' },
        r.conError ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => descargarErrores(r) }, icono('download-outline'), 'Descargar errores (CSV)') : null,
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { archivo = null; previa = null; errorArchivo = null; dibujarArchivo(); } }, 'Importar otro archivo'),
        h('a', { class: 'btn btn--primary', href: '#/clientes' }, icono('business-outline'), 'Ver la base de clientes'))));
  }

  montar(cont,
    cabecera({ titulo: 'Importar clientes', subtitulo: 'Carga muchas empresas a la vez desde un archivo CSV.' }),
    zona);
  dibujarArchivo();
}
