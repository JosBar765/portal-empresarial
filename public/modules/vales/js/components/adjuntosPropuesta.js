import { escapeHtml } from '../utils/formato.js';
import { htmlDropzone, wireDropzone, ARCHIVO_MAX_BYTES } from './dropzone.js';

// -----------------------------------------------------------------------
// Adjuntos de una propuesta (entrega del Diseñador y fusión del Encargado): archivo, enlaces a documentos de otras
// plataformas y una nota de observaciones. Al entregar, el PDF es obligatorio (`archivoObligatorio`) y los enlaces y la nota son
// complementos, igual que en la fusión. El servidor vuelve a validar todo (https, hasta 5 enlaces, nota de hasta 500 caracteres).
// -----------------------------------------------------------------------
export const MAX_ENLACES = 5;
export const MAX_NOTA = 500;

const pluralizar = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

// Devuelve la URL normalizada (se completa con https:// si falta) o un mensaje de error.
function revisarUrl(texto) {
  let valor = texto.trim();
  if (!valor) return { vacia: true };
  if (/\s/.test(valor)) return { error: 'El enlace no puede tener espacios.' };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(valor)) valor = `https://${valor}`;
  let url;
  try { url = new URL(valor); } catch { return { error: 'Escribe una dirección válida, por ejemplo https://drive.google.com/…' }; }
  if (url.protocol !== 'https:') return { error: 'El enlace debe empezar con https://.' };
  if (url.username || url.password) return { error: 'El enlace no puede incluir usuario ni contraseña.' };
  if (!url.hostname.includes('.')) return { error: 'Escribe una dirección válida, por ejemplo https://drive.google.com/…' };
  if (url.href.length > 500) return { error: 'El enlace es demasiado largo (máximo 500 caracteres).' };
  return { url: url.href, dominio: url.hostname.replace(/^www\./, '') };
}

// `idArchivo`: id del <input type="file"> de la zona de arrastre; `etiquetaArchivo` y `etiquetaNota` ajustan los textos.
// Con `archivoObligatorio` (entregar propuesta) el PDF es indispensable y los enlaces y la nota son complementos.
export function htmlAdjuntosPropuesta({ idArchivo, etiquetaArchivo = 'Archivo', etiquetaNota = 'Nota para el encargado', archivoObligatorio = false }) {
  return `
    <div class="adj" data-adj>
      <section class="adj-seccion">
        <h4 class="adj-titulo"><ion-icon name="document-attach-outline" aria-hidden="true"></ion-icon>${escapeHtml(etiquetaArchivo)}${archivoObligatorio ? ' <span class="adj-requerido" aria-hidden="true">*</span>' : ''}<span class="adj-opcional">${archivoObligatorio ? 'Obligatorio · ' : ''}PDF · máx. 5 MB</span></h4>
        ${htmlDropzone({ id: idArchivo, accept: 'application/pdf', hint: 'PDF · máx. 5MB' })}
        <p class="adj-ayuda">${archivoObligatorio ? 'Sube el PDF de la propuesta; puedes complementarlo con enlaces y una nota.' : '¿Pesa más? Agrega un enlace en la sección de abajo.'}</p>
      </section>
      <section class="adj-seccion">
        <h4 class="adj-titulo"><ion-icon name="link-outline" aria-hidden="true"></ion-icon>Enlaces<span class="adj-opcional">Opcional · hasta ${MAX_ENLACES}</span></h4>
        <ul class="adj-enlaces" data-adj-lista></ul>
        <button type="button" class="btn btn--ghost btn--sm adj-agregar" data-adj-agregar><ion-icon name="add-outline" aria-hidden="true"></ion-icon>Agregar enlace</button>
        <p class="adj-ayuda">Drive, OneDrive, WeTransfer u otra plataforma. Solo enlaces https.</p>
      </section>
      <section class="adj-seccion">
        <h4 class="adj-titulo"><ion-icon name="chatbox-ellipses-outline" aria-hidden="true"></ion-icon><label for="adj-nota">${escapeHtml(etiquetaNota)}</label><span class="adj-opcional">Opcional</span></h4>
        <textarea id="adj-nota" class="adj-nota" rows="3" maxlength="${MAX_NOTA}" placeholder="Observaciones sobre el trabajo entregado…" aria-describedby="adj-contador"></textarea>
        <div class="adj-contador" id="adj-contador" aria-live="polite">0/${MAX_NOTA}</div>
      </section>
      <p class="adj-resumen" data-adj-resumen aria-live="polite"></p>
    </div>`;
}

// Conecta el componente dentro de `overlay`. `onCambio({ valido, resumen })` se llama cada vez que cambia algo, para que la
// ventana habilite o no el botón de enviar y muestre qué se va a enviar.
export function wireAdjuntosPropuesta(overlay, { idArchivo, archivoObligatorio = false, onCambio = () => {} }) {
  const raiz = overlay.querySelector('[data-adj]');
  const lista = raiz.querySelector('[data-adj-lista]');
  const botonAgregar = raiz.querySelector('[data-adj-agregar]');
  const nota = raiz.querySelector('.adj-nota');
  const contador = raiz.querySelector('.adj-contador');
  const resumen = raiz.querySelector('[data-adj-resumen]');
  const obtenerArchivos = wireDropzone(overlay, `#${idArchivo}`, '.archivo-lista', { maxBytes: ARCHIVO_MAX_BYTES });
  let siguiente = 1;

  const filas = () => [...lista.querySelectorAll('.adj-enlace')];
  const leerFila = (fila) => revisarUrl(fila.querySelector('.adj-url').value);

  function pintarFila(fila, mostrarError) {
    const resultado = leerFila(fila);
    const campo = fila.querySelector('.adj-url');
    const error = fila.querySelector('.adj-error');
    const dominio = fila.querySelector('.adj-dominio');
    const hayError = !!resultado.error;
    campo.setAttribute('aria-invalid', String(hayError && mostrarError));
    error.hidden = !(hayError && mostrarError);
    error.textContent = hayError ? resultado.error : '';
    dominio.hidden = !resultado.url;
    dominio.innerHTML = resultado.url ? `<ion-icon name="checkmark-circle" aria-hidden="true"></ion-icon>${escapeHtml(resultado.dominio)}` : '';
  }

  function estado() {
    const archivo = obtenerArchivos()[0] || null;
    const enlaces = [];
    let hayInvalidos = false;
    filas().forEach(fila => {
      const r = leerFila(fila);
      if (r.url) enlaces.push({ url: r.url, nombre: fila.querySelector('.adj-nombre').value.trim() });
      else if (r.error) hayInvalidos = true;
    });
    const texto = nota.value.trim();
    return { archivo, enlaces, nota: texto, hayInvalidos };
  }

  function refrescar() {
    const e = estado();
    contador.textContent = `${nota.value.length}/${MAX_NOTA}`;
    botonAgregar.disabled = filas().length >= MAX_ENLACES;
    const partes = [];
    if (e.archivo) partes.push('1 archivo');
    if (e.enlaces.length) partes.push(pluralizar(e.enlaces.length, 'enlace', 'enlaces'));
    if (e.nota) partes.push('nota');
    const tieneContenido = archivoObligatorio ? !!e.archivo : !!(e.archivo || e.enlaces.length);
    const valido = tieneContenido && !e.hayInvalidos;
    let texto;
    if (e.hayInvalidos) texto = 'Corrige los enlaces marcados para continuar.';
    else if (!tieneContenido) texto = archivoObligatorio ? 'Adjunta el PDF de la propuesta para continuar.' : 'Agrega un archivo o al menos un enlace para continuar.';
    else texto = `Se enviará: ${partes.join(' · ')}`;
    resumen.textContent = texto;
    resumen.classList.toggle('is-pendiente', !valido);
    onCambio({ valido, resumen: texto });
  }

  function agregarFila() {
    if (filas().length >= MAX_ENLACES) return;
    const n = siguiente++;
    const fila = document.createElement('li');
    fila.className = 'adj-enlace';
    fila.innerHTML = `
      <div class="adj-enlace-campos">
        <input type="url" class="adj-url" placeholder="https://drive.google.com/…" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Enlace" aria-describedby="adj-error-${n}">
        <input type="text" class="adj-nombre" placeholder="Nombre (opcional)" maxlength="80" autocomplete="off" aria-label="Nombre del enlace">
        <button type="button" class="adj-quitar" aria-label="Quitar enlace"><ion-icon name="close-outline" aria-hidden="true"></ion-icon></button>
      </div>
      <p class="adj-dominio" hidden></p>
      <p class="adj-error" id="adj-error-${n}" role="alert" hidden></p>`;
    lista.appendChild(fila);
    const url = fila.querySelector('.adj-url');
    url.addEventListener('input', () => { pintarFila(fila, false); refrescar(); });
    url.addEventListener('blur', () => { pintarFila(fila, true); refrescar(); });
    // Pegar una dirección sin protocolo la deja lista con https://.
    url.addEventListener('change', () => {
      const r = revisarUrl(url.value);
      if (r.url) url.value = r.url;
      pintarFila(fila, true);
      refrescar();
    });
    fila.querySelector('.adj-quitar').addEventListener('click', () => { fila.remove(); refrescar(); botonAgregar.focus(); });
    refrescar();
    url.focus();
  }

  botonAgregar.addEventListener('click', agregarFila);
  nota.addEventListener('input', refrescar);
  // La zona de arrastre no avisa los cambios: se revisa después de elegir o quitar un archivo.
  raiz.addEventListener('change', () => setTimeout(refrescar, 0));
  raiz.addEventListener('click', () => setTimeout(refrescar, 0));
  refrescar();

  return {
    // Mensaje del primer problema (y foco en el campo), o null si todo está bien.
    validar() {
      const e = estado();
      for (const fila of filas()) {
        pintarFila(fila, true);
        if (leerFila(fila).error) { fila.querySelector('.adj-url').focus(); return 'Corrige los enlaces marcados.'; }
      }
      if (archivoObligatorio && !e.archivo) return 'Adjunta el PDF de la propuesta.';
      if (!archivoObligatorio && !e.archivo && !e.enlaces.length) return 'Agrega un archivo o al menos un enlace.';
      return null;
    },
    // Agrega al FormData el archivo (con el nombre de campo que espera el servidor), los enlaces y la nota.
    agregarAFormData(formData, campoArchivo) {
      const e = estado();
      if (e.archivo) formData.append(campoArchivo, e.archivo);
      formData.append('enlaces', JSON.stringify(e.enlaces));
      formData.append('nota', e.nota);
    }
  };
}
