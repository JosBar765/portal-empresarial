// Marca de agua en el navegador: el asesor carga una imagen y obtiene la misma, del mismo tamaño, con el logo y el texto en mosaico.
// Nada se sube ni se guarda; el aspecto sale del ajuste «marca_de_agua» de /config.
import { h, icono, montar } from '../../utils/dom.js';
import { t } from '../../textos.js';
import { abrirModal } from '../../components/modal.js';
import { medidasBaldosa, calcularMosaico } from '../../utils/mosaicoMarca.js';
import { cargarImagen, tamanoNatural, copiarImagen, descargarBlob } from './portapapeles.js';
import { validarImagenMarca, reglasImagenes, mimeAExtension, listaConO } from './archivos.js';

// Constantes técnicas del canvas (no son reglas de negocio).
const MIME_SALIDA = 'image/png';
const LETRA_REFERENCIA = 100; // px con que se mide el texto antes de escalarlo

function cargarLogo(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https:/i.test(url)) img.crossOrigin = 'anonymous'; // sin esto un logo remoto bloquearía el lienzo
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(t('asesor.marca.errores.logoNoCarga', { url })));
    img.src = url;
  });
}

const familiaTitulo = () => getComputedStyle(document.documentElement).getPropertyValue('--font-title').trim() || 'sans-serif';
const fuente = (px, familia) => `700 ${px}px ${familia}`;

// Una baldosa opaca (logo + texto relleno); la opacidad se aplica al estamparla.
function dibujarBaldosa(marca, logo, familia, baldosa, medidas) {
  const { ancho, alto } = baldosa;
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.max(1, Math.ceil(ancho));
  lienzo.height = Math.max(1, Math.ceil(alto));
  const ctx = lienzo.getContext('2d');
  if (medidas.logo.ancho > 0) ctx.drawImage(logo, medidas.logo.x * alto, 0, medidas.logo.ancho * alto, alto);
  const letra = medidas.texto.letra * alto;
  ctx.font = fuente(letra, familia);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = marca.color;
  ctx.fillText(marca.texto, medidas.texto.x * alto, alto / 2);
  return lienzo;
}

function exportar(lienzo, ancho, alto, url) {
  return new Promise((resolve, reject) => {
    const sinLienzo = () => new Error(t('asesor.marca.errores.sinLienzo', { ancho, alto }));
    try {
      lienzo.toBlob(b => (b ? resolve(b) : reject(sinLienzo())), MIME_SALIDA);
    } catch (e) {
      reject(e && e.name === 'SecurityError' ? new Error(t('asesor.marca.errores.lienzoBloqueado', { url })) : sinLienzo());
    }
  });
}

// Devuelve { blob, ancho, alto }: la imagen original en su resolución natural con el mosaico encima.
async function componer(img, marca, logo) {
  const { ancho, alto } = tamanoNatural(img);
  const familia = familiaTitulo();
  if (document.fonts && document.fonts.load) await document.fonts.load(fuente(LETRA_REFERENCIA, familia), marca.texto).catch(() => {});
  const medir = document.createElement('canvas').getContext('2d');
  medir.font = fuente(LETRA_REFERENCIA, familia);
  const medidas = medidasBaldosa({
    proporcionLogo: logo.naturalWidth && logo.naturalHeight ? logo.naturalWidth / logo.naturalHeight : 1,
    anchoTextoPorLetra: medir.measureText(marca.texto).width / LETRA_REFERENCIA
  });
  const mosaico = calcularMosaico({ ancho, alto, angulo: marca.angulo, escala: marca.escala, separacion: marca.separacion, anchoPorAlto: medidas.anchoPorAlto });
  const baldosa = dibujarBaldosa(marca, logo, familia, mosaico.baldosa, medidas);
  const { ancho: bAncho, alto: bAlto } = mosaico.baldosa;

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error(t('asesor.marca.errores.sinLienzo', { ancho, alto }));
  ctx.drawImage(img, 0, 0, ancho, alto);
  ctx.globalAlpha = marca.opacidad;
  ctx.translate(ancho / 2, alto / 2);
  ctx.rotate(mosaico.rad);
  mosaico.centros.forEach(c => ctx.drawImage(baldosa, c.x - bAncho / 2, c.y - bAlto / 2, bAncho, bAlto));
  return { blob: await exportar(lienzo, ancho, alto, marca.logo_url), ancho, alto };
}

// Nombre de la descarga: el del archivo original sin extensión más el sufijo de la marca.
const nombreSalida = (archivo) => t('asesor.marca.nombreArchivo', { nombre: archivo.name.replace(/\.[^.]*$/, '') || t('asesor.marca.imagenPegada') });

export function abrirMarcaDeAgua(config) {
  const marca = config.marcaDeAgua;
  const extPorMime = mimeAExtension(config.formatosImagen);
  const reglas = reglasImagenes({ max_mb: config.limites.imagenes_mb_tope }, config);
  let logoPromesa = null; // una sola carga del logo por apertura; si falla se descarta para reintentar
  let resultado = null; // { blob, url, nombre, ancho, alto }
  let turno = 0; // descarta un procesamiento viejo si el asesor cambia la imagen a mitad
  let ocupado = false;
  let copiada = false;

  const input = h('input', { type: 'file', hidden: true, tabindex: '-1', accept: reglas.extensiones.map(e => `.${e}`).join(',') });
  const zona = h('div', { class: 'pr-dropzone pr-marca-zona', role: 'button', tabindex: '0' },
    icono('image-outline'),
    h('strong', { text: t('asesor.marca.zonaTitulo') }),
    h('span', { class: 'form-hint', text: t('asesor.marca.zonaAyuda', { formatos: listaConO(reglas.formatos), maxMb: reglas.maxMb }) }));
  const error = h('div', { class: 'form-error', role: 'alert', hidden: true });
  const estado = h('p', { class: 'form-hint pr-marca-estado', hidden: true });
  const vistaImg = h('img', { alt: t('asesor.marca.vistaAlt') });
  const vista = h('figure', { class: 'pr-marca-vista', hidden: true }, vistaImg);
  const btnCambiar = h('button', { type: 'button', class: 'btn btn--ghost' });
  const btnDescargar = h('button', { type: 'button', class: 'btn btn--ghost' });
  const btnCopiar = h('button', { type: 'button', class: 'btn btn--primary' });

  const { overlay, cerrar } = abrirModal({ title: t('asesor.marca.titulo'), bodyHtml: '', footerHtml: ' ', size: 'lg', onCerrar: liberar });
  montar(overlay.querySelector('.modal-body'), h('div', { class: 'pr-marca' }, input, zona, error, estado, vista));
  montar(overlay.querySelector('.modal-footer'), btnCambiar, btnDescargar, btnCopiar);

  function pintar() {
    const hay = !!resultado;
    zona.hidden = hay;
    vista.hidden = !hay;
    montar(btnCambiar, icono('swap-horizontal-outline'), h('span', { text: t('asesor.marca.cambiar') }));
    montar(btnDescargar, icono('download-outline'), h('span', { text: t('asesor.marca.descargar') }));
    montar(btnCopiar, icono(copiada ? 'checkmark-circle' : 'copy-outline'), h('span', { text: t(copiada ? 'asesor.marca.copiada' : 'asesor.marca.copiar') }));
    btnCopiar.classList.toggle('is-copiado', copiada);
    btnCambiar.hidden = !hay;
    btnCambiar.disabled = ocupado;
    btnDescargar.disabled = !hay || ocupado;
    btnCopiar.disabled = !hay || ocupado;
  }

  const mostrarError = (mensaje) => { error.textContent = mensaje; error.hidden = !mensaje; };
  const mostrarEstado = (texto) => { estado.textContent = texto; estado.hidden = !texto; };

  function soltarResultado() {
    if (resultado) URL.revokeObjectURL(resultado.url);
    resultado = null;
  }

  async function procesar(archivo) {
    const motivo = validarImagenMarca(archivo, config);
    if (motivo) { mostrarError(motivo); return; }
    const mio = ++turno;
    mostrarError('');
    mostrarEstado(t('asesor.marca.procesando'));
    ocupado = true;
    pintar();
    try {
      let img;
      try { img = await cargarImagen(archivo); } catch (e) { throw new Error(t('asesor.marca.errores.imagenNoLegible', { archivo: archivo.name })); }
      if (!logoPromesa) logoPromesa = cargarLogo(marca.logo_url).catch((e) => { logoPromesa = null; throw e; });
      const salida = await componer(img, marca, await logoPromesa);
      if (mio !== turno || !overlay.isConnected) return;
      soltarResultado();
      const medidas = t('asesor.marca.medidas', { archivo: archivo.name, ancho: salida.ancho, alto: salida.alto });
      resultado = { ...salida, medidas, url: URL.createObjectURL(salida.blob), nombre: nombreSalida(archivo) };
      vistaImg.src = resultado.url;
      copiada = false;
      mostrarEstado(medidas);
    } catch (e) {
      if (mio !== turno) return;
      mostrarEstado(resultado ? resultado.medidas : '');
      mostrarError(e.message);
    } finally {
      if (mio === turno) { ocupado = false; pintar(); }
    }
  }

  // El portapapeles entrega capturas como «image.png»: se renombran como imagen pegada.
  function pegada(f) {
    if (f.name && !/^image\.\w+$/i.test(f.name)) return f;
    const ext = extPorMime[f.type] || f.type.split('/')[1].split('+')[0];
    return new File([f], `${t('asesor.marca.imagenPegada')}.${ext}`, { type: f.type });
  }

  const abrirSelector = () => { if (!ocupado) input.click(); };
  zona.addEventListener('click', abrirSelector);
  zona.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirSelector(); } });
  btnCambiar.addEventListener('click', abrirSelector);
  input.addEventListener('change', () => { const [f] = input.files; input.value = ''; if (f) procesar(f); });

  // Soltar sobre cualquier parte del modal (o su fondo) reemplaza la imagen y evita que el navegador la abra.
  overlay.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('is-arrastre'); });
  overlay.addEventListener('dragleave', (e) => { if (!overlay.contains(e.relatedTarget)) zona.classList.remove('is-arrastre'); });
  overlay.addEventListener('drop', (e) => {
    e.preventDefault();
    zona.classList.remove('is-arrastre');
    const [f] = Array.from(e.dataTransfer.files || []);
    if (f && !ocupado) procesar(f);
  });

  function alPegar(e) {
    const archivos = Array.from(e.clipboardData?.files || []);
    if (!archivos.length) return;
    e.preventDefault();
    const imagen = archivos.find(f => f.type.startsWith('image/'));
    if (!imagen) { mostrarError(t('asesor.marca.errores.pegadoSinImagen')); return; }
    if (!ocupado) procesar(pegada(imagen));
  }
  document.addEventListener('paste', alPegar);

  btnDescargar.addEventListener('click', () => {
    if (!resultado) return;
    try { descargarBlob(resultado.blob, resultado.nombre); } catch (e) { window.toast.warning(t('asesor.resultado.toastNoDescargada'), t('asesor.marca.errores.descargaFallo')); }
  });

  btnCopiar.addEventListener('click', async () => {
    if (!resultado || ocupado) return;
    ocupado = true;
    pintar();
    try {
      await copiarImagen(resultado.blob);
      copiada = true;
      window.toast.success(t('asesor.marca.toastCopiada'), t('asesor.marca.toastCopiadaTexto'));
    } catch (e) {
      window.toast.warning(t('asesor.marca.toastNoCopiada'), e.message);
    } finally {
      ocupado = false;
      pintar();
    }
  });

  function liberar() {
    turno++;
    document.removeEventListener('paste', alPegar);
    soltarResultado();
  }

  pintar();
  zona.focus();
  return cerrar;
}
