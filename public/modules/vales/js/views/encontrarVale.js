import { $ } from '../utils/dom.js';
import { claseEstado, etiquetaEstado } from '../permisos.js';
import { escapeHtml, formatearFecha, formatearFechaHora, celdaTaller } from '../utils/formato.js';
import { buscarValePorCorrelativo } from '../api/valesApi.js';
import { abrirModalHistorial } from '../actions/historial.js';

// -----------------------------------------------------------------------
// "Encontrar vale" (solo Gerente): reemplaza al buzón. Un buscador por
// correlativo exacto que muestra el vale encontrado con sus fechas, atraso,
// taller(es), estado y las acciones de solo lectura (ver vale, ver propuesta
// final, ver historial). El esqueleto se arma UNA vez; al volver a la vista
// se conserva la última búsqueda.
// -----------------------------------------------------------------------
const FORMATO_CORRELATIVO = /^[A-Za-z0-9-]{3,60}$/;

let pedidoVigente = 0;

// Solo se abren enlaces http(s): una URL guardada con esquema `javascript:`
// o `data:` se ejecutaría con la sesión del Gerente al hacer clic.
function urlSegura(url) {
  try {
    const u = new URL(url, window.location.origin);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

export function cargarEncontrarVale() {
  const cont = $('#encontrar-vale');
  if (!cont.dataset.wired) armarEsqueleto(cont);
  // Listo para escribir, pero solo con puntero fino: en un teléfono abrir el
  // teclado al cambiar de pestaña sería una sorpresa.
  if (window.matchMedia('(pointer: fine)').matches) $('#enc-input', cont).focus();
}

function armarEsqueleto(cont) {
  cont.innerHTML = `
    <header class="enc-cabecera">
      <h2>Encontrar vale</h2>
      <p>Escribe el correlativo de un vale de arte para ver su estado, sus fechas y sus documentos.</p>
    </header>
    <form class="enc-buscador" id="enc-form" role="search" novalidate>
      <div class="enc-campo">
        <label class="enc-sr" for="enc-input">Correlativo del vale de arte</label>
        <ion-icon name="search-outline" class="enc-icono" aria-hidden="true"></ion-icon>
        <input id="enc-input" name="correlativo" type="text" maxlength="60" autocomplete="off" autocapitalize="characters"
               spellcheck="false" placeholder="Ej. MTC-AL-1023" aria-describedby="enc-ayuda enc-error" />
        <button type="button" class="enc-limpiar" id="enc-limpiar" aria-label="Borrar búsqueda" hidden>
          <ion-icon name="close-circle" aria-hidden="true"></ion-icon>
        </button>
      </div>
      <button class="btn btn--primary enc-boton" id="enc-buscar" type="submit">Buscar</button>
    </form>
    <p class="enc-error" id="enc-error" hidden></p>
    <p class="enc-ayuda" id="enc-ayuda">Escribe el correlativo completo, por ejemplo <strong>MTC-AL-1023</strong>. Las modificaciones llevan el prefijo <strong>MOD-</strong>.</p>
    <p class="enc-sr" id="enc-anuncio" role="status" aria-live="polite"></p>
    <section class="enc-resultado" id="enc-resultado" aria-label="Resultado de la búsqueda"></section>`;
  cont.dataset.wired = '1';
  mostrarInicial();

  const input = $('#enc-input', cont);
  $('#enc-form', cont).addEventListener('submit', (e) => { e.preventDefault(); buscar(input.value); });
  input.addEventListener('input', () => { actualizarLimpiar(); ocultarError(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape' && input.value) { e.preventDefault(); limpiar(); } });
  $('#enc-limpiar', cont).addEventListener('click', limpiar);
}

// --- estado del campo ---------------------------------------------------
function actualizarLimpiar() {
  $('#enc-limpiar').hidden = $('#enc-input').value.length === 0;
}

function mostrarError(texto) {
  const p = $('#enc-error');
  p.innerHTML = `<ion-icon name="alert-circle-outline" aria-hidden="true"></ion-icon><span>${escapeHtml(texto)}</span>`;
  p.hidden = false;
  $('#enc-input').setAttribute('aria-invalid', 'true');
}

function ocultarError() {
  $('#enc-error').hidden = true;
  $('#enc-input').removeAttribute('aria-invalid');
}

function limpiar() {
  pedidoVigente++;
  const input = $('#enc-input');
  input.value = '';
  actualizarLimpiar();
  ocultarError();
  mostrarInicial();
  $('#enc-anuncio').textContent = '';
  input.focus();
}

// --- búsqueda ------------------------------------------------------------
async function buscar(texto) {
  // Pegar "MTC-AL-1023 " con espacios sobrantes no debe fallar.
  const limpio = String(texto).replace(/\s+/g, '');
  const input = $('#enc-input');
  input.value = limpio.toUpperCase();
  actualizarLimpiar();
  if (!limpio) { mostrarError('Escribe el correlativo del vale.'); input.focus(); return; }
  // Se valida antes de pasar a mayúsculas: toUpperCase() convierte algunos
  // caracteres no ASCII (ſ, ı) en letras válidas.
  if (!FORMATO_CORRELATIVO.test(limpio)) {
    mostrarError('Usa al menos 3 caracteres: solo letras, números y guiones. Por ejemplo, MTC-AL-1023.');
    input.focus();
    return;
  }
  const correlativo = limpio.toUpperCase();
  ocultarError();

  const pedido = ++pedidoVigente;
  const boton = $('#enc-buscar');
  const resultado = $('#enc-resultado');
  boton.disabled = true;
  boton.classList.add('btn--loading');
  resultado.classList.add('is-buscando');
  try {
    const data = await buscarValePorCorrelativo(correlativo);
    if (pedido !== pedidoVigente) return;
    if (data.vale) {
      mostrarVale(data.vale);
      $('#enc-anuncio').textContent = `Se encontró el vale ${data.vale.correlativo}.`;
    } else {
      mostrarNoEncontrado(correlativo, data.sugerencias || []);
      $('#enc-anuncio').textContent = `No se encontró ningún vale con el correlativo ${correlativo}.`;
    }
  } catch (error) {
    if (pedido !== pedidoVigente) return;
    mostrarFallo(error.message, correlativo);
    $('#enc-anuncio').textContent = 'No se pudo completar la búsqueda.';
  } finally {
    if (pedido === pedidoVigente) {
      boton.disabled = false;
      boton.classList.remove('btn--loading');
      resultado.classList.remove('is-buscando');
      input.focus();
      input.select();
    }
  }
}

// --- resultados --------------------------------------------------------------
function estadoVacio({ icono, titulo, texto, extra = '', tono = '' }) {
  return `
    <div class="enc-panel enc-vacio ${tono}">
      <ion-icon name="${icono}" aria-hidden="true"></ion-icon>
      <h3>${titulo}</h3>
      <p>${texto}</p>
      ${extra}
    </div>`;
}

function mostrarInicial() {
  $('#enc-resultado').innerHTML = estadoVacio({
    icono: 'document-text-outline',
    titulo: 'Busca un vale de arte',
    texto: 'El resultado aparecerá aquí, con sus fechas, talleres, estado y documentos.'
  });
}

function mostrarNoEncontrado(correlativo, sugerencias) {
  const extra = sugerencias.length ? `
    <p class="enc-sug-titulo">¿Buscabas alguno de estos?</p>
    <ul class="enc-sugerencias">
      ${sugerencias.map(s => `<li><button type="button" class="chip" data-correlativo="${escapeHtml(s)}">${escapeHtml(s)}</button></li>`).join('')}
    </ul>` : '';
  const resultado = $('#enc-resultado');
  resultado.innerHTML = estadoVacio({
    icono: 'search-outline',
    titulo: `No encontramos ningún vale con «${escapeHtml(correlativo)}»`,
    texto: 'Revisa que el correlativo esté completo y sin errores de escritura.',
    extra
  });
  resultado.querySelectorAll('.enc-sugerencias .chip').forEach(chip => {
    chip.addEventListener('click', () => buscar(chip.dataset.correlativo));
  });
}

function mostrarFallo(mensaje, correlativo) {
  const resultado = $('#enc-resultado');
  resultado.innerHTML = estadoVacio({
    icono: 'alert-circle-outline',
    titulo: 'No se pudo buscar el vale',
    texto: escapeHtml(mensaje),
    extra: '<button class="btn btn--ghost btn--sm" id="enc-reintentar" type="button">Reintentar</button>',
    tono: 'enc-vacio--error'
  });
  $('#enc-reintentar', resultado).addEventListener('click', () => buscar(correlativo));
}

function mostrarVale(v) {
  const resultado = $('#enc-resultado');
  resultado.innerHTML = `
    <div class="enc-panel">
      <header class="enc-panel-cab">
        <h3>Resultado</h3>
        <span class="enc-conteo">1 vale encontrado</span>
      </header>
      <div class="tabla-wrapper">
        <table class="buzon-table data-table sticky-header">
          <thead>
            <tr>
              <th>Correlativo</th>
              <th>Fecha de ingreso</th>
              <th>Fecha de entrega</th>
              <th>Atraso</th>
              <th>Fecha de evento</th>
              <th class="col-taller">Taller(es)</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td data-label="Correlativo"><strong>${escapeHtml(v.correlativo)}</strong>${v.urgente ? '<span class="badge badge-urgente">URGENTE</span>' : ''}</td>
              <td data-label="Fecha de ingreso">${escapeHtml(formatearFechaHora(v.creado_en || `${v.fecha_creacion} ${v.hora_creacion}`))}</td>
              <td data-label="Fecha de entrega">${escapeHtml(formatearFecha(v.fecha_entrega))}</td>
              <td data-label="Atraso">${v.venceHoy ? '<span class="badge badge-hoy">Hoy</span>' : (v.atrasado ? `<span class="badge badge-atraso">${escapeHtml(Number(v.diasAtraso) || 0)}d</span>` : '<span class="badge badge-ok">Al día</span>')}</td>
              <td data-label="Fecha de evento">${escapeHtml(formatearFecha(v.fecha_evento))}</td>
              <td data-label="Taller(es)" class="col-taller">${celdaTaller({ taller: escapeHtml(v.taller || '') })}</td>
              <td data-label="Estado"><span class="estado-pill ${escapeHtml(claseEstado(v))}">${escapeHtml(etiquetaEstado(v))}</span></td>
              <td data-label="Acciones" class="acciones-cell"><div class="acciones-wrap" id="enc-acciones"></div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;

  const acciones = [
    { icono: 'eye-outline', titulo: 'Ver vale de arte (PDF)', onClick: () => window.open(`/api/vales/${encodeURIComponent(Number(v.id))}/pdf`, '_blank', 'noopener') }
  ];
  // Solo existe una vez que el vale ya fue fusionado: es la propuesta final.
  const urlPropuesta = urlSegura(v.propuesta_general_url);
  if (urlPropuesta) {
    acciones.push({ icono: 'document-attach-outline', titulo: 'Ver propuesta', onClick: () => window.open(urlPropuesta, '_blank', 'noopener') });
  }
  acciones.push({ icono: 'time-outline', titulo: 'Ver historial', onClick: () => abrirModalHistorial(v) });
  const wrap = $('#enc-acciones', resultado);
  acciones.forEach(accion => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-icon';
    btn.title = accion.titulo;
    btn.setAttribute('aria-label', `${accion.titulo} — ${v.correlativo}`);
    btn.innerHTML = `<ion-icon name="${accion.icono}" aria-hidden="true"></ion-icon>`;
    btn.addEventListener('click', accion.onClick);
    wrap.appendChild(btn);
  });
}
