// scripts/proyectos/verificar-ayudas.js
// Verifica que la ayuda de Configuración de Proyectos cubra TODO: cada pantalla, cada parámetro del registro, cada evento de
// notificación, cada pestaña de catálogo y los ajustes con reglas de plantillas, reglas, campos propios, kit, plan y alcance.
// Falla si algo no tiene texto o si un texto no explica qué hace, qué pasa al cambiarlo y da un ejemplo. No usa base de datos.
//
// Uso: node scripts/proyectos/verificar-ayudas.js
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const { PARAMETROS } = require(path.join(RAIZ, 'src', 'modules', 'proyectos', 'parametros.js'));
const { EVENTOS } = require(path.join(RAIZ, 'src', 'modules', 'proyectos', 'eventos.js'));

// Los módulos del navegador son ES: se leen como texto y se evalúan sin sus `export`.
function cargarModuloEs(ruta, nombres) {
  const fuente = fs.readFileSync(ruta, 'utf8').replace(/^export\s+/gm, '');
  // eslint-disable-next-line no-new-func
  return new Function(`${fuente}\nreturn { ${nombres.join(', ')} };`)();
}

const { TEXTOS } = cargarModuloEs(path.join(RAIZ, 'public', 'modules', 'proyectos', 'js', 'ayuda', 'textos.js'), ['TEXTOS']);
const { CATALOGOS, PESTANAS } = cargarModuloEs(path.join(RAIZ, 'public', 'modules', 'proyectos', 'js', 'views', 'catalogosConfig.js'), ['CATALOGOS', 'PESTANAS']);

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};
const texto = (v) => (Array.isArray(v) ? v.join(' ') : String(v || '')).trim();
const lleno = (v, min = 15) => texto(v).length >= min;

const PANTALLAS = ['inicio', 'parametros', 'plantillas', 'reglas', 'avisos', 'kit', 'campos', 'plan', 'alcance', 'historial', ...PESTANAS.map(p => `catalogos.${p}`)];
const AJUSTES_CON_REGLAS = [
  'plantillas.articulo', 'plantillas.existencia', 'plantillas.meta', 'plantillas.tope', 'plantillas.etapas', 'plantillas.predeterminada', 'plantillas.activa', 'plantillas.controles',
  'reglas.referencia_pais', 'reglas.confirmacion_pais',
  'campos.tipo', 'campos.opciones', 'campos.obligatorio', 'campos.visible_lista', 'campos.nicho', 'campos.activo',
  'catalogos.resultado.efecto', 'catalogos.resultado.contacto', 'catalogos.resultado.proxima', 'catalogos.canal.presencial', 'catalogos.pais.moneda',
  'avisos.anticipacion', 'kit.variables', 'kit.guion', 'kit.mensajes', 'plan.mes', 'alcance.paises'
];

console.log('Pantallas');
for (const clave of PANTALLAS) {
  const t = TEXTOS.pantallas[clave];
  prueba(`«${clave}» tiene explicación`, Boolean(t));
  if (!t) continue;
  prueba(`«${clave}»: dice para qué sirve, qué pasa al cambiar y da un ejemplo`, lleno(t.sirve) && lleno(t.efecto) && (lleno(t.ejemplo)), JSON.stringify(Object.keys(t)));
  if (clave !== 'historial' && clave.startsWith('catalogos.') === false) prueba(`«${clave}»: dice qué se puede cambiar`, lleno(t.cambias), '');
}
prueba('el Centro de configuración trae la guía de por dónde empezar (8 pasos)', Array.isArray(TEXTOS.pantallas.inicio.guia) && TEXTOS.pantallas.inicio.guia.length >= 8);

console.log('Parámetros del registro');
for (const p of PARAMETROS) {
  const t = TEXTOS.campos[`parametros.${p.clave}`];
  prueba(`parámetro «${p.clave}»`, Boolean(t) && lleno(t.titulo, 3) && lleno(t.que) && lleno(t.efecto) && lleno(t.ejemplo), t ? Object.keys(t).join() : 'sin texto');
}

console.log('Avisos (eventos de notificación)');
for (const e of EVENTOS) {
  const t = TEXTOS.campos[`avisos.${e.clave}`];
  prueba(`aviso «${e.clave}»`, Boolean(t) && lleno(t.titulo, 3) && lleno(t.que) && lleno(t.efecto) && lleno(t.ejemplo), t ? Object.keys(t).join() : 'sin texto');
}

console.log('Ajustes con reglas de las demás pantallas');
for (const clave of AJUSTES_CON_REGLAS) {
  const t = TEXTOS.campos[clave];
  prueba(`ajuste «${clave}»`, Boolean(t) && lleno(t.titulo, 3) && lleno(t.que) && lleno(t.efecto) && lleno(t.ejemplo), t ? Object.keys(t).join() : 'sin texto');
}

console.log('Coherencia');
prueba('cada pestaña de catálogo del código tiene su explicación', Object.keys(CATALOGOS).every(id => TEXTOS.pantallas[`catalogos.${id}`]) && Boolean(TEXTOS.pantallas['catalogos.paises']));
const sobrantes = Object.keys(TEXTOS.campos).filter(k => k.startsWith('parametros.') && !PARAMETROS.some(p => `parametros.${p.clave}` === k));
prueba('no hay textos de parámetros que ya no existen', sobrantes.length === 0, sobrantes.join());
const sobrantesAvisos = Object.keys(TEXTOS.campos).filter(k => k.startsWith('avisos.') && k !== 'avisos.anticipacion' && !EVENTOS.some(e => `avisos.${e.clave}` === k));
prueba('no hay textos de avisos que ya no existen', sobrantesAvisos.length === 0, sobrantesAvisos.join());
const todos = [...Object.values(TEXTOS.pantallas), ...Object.values(TEXTOS.campos)].map(t => JSON.stringify(t)).join(' ');
prueba('los textos no usan jerga técnica («endpoint», «API», «JSON», «SQL»)', !/\b(endpoint|API|JSON|SQL|backend)\b/i.test(todos));
prueba('los estados se escriben completos (sin abreviaturas como «pend.» o «en gest.»)', !/\b(pend\.|en gest\.|cot\.)/i.test(todos));

console.log(`\n${buenas} OK, ${malas} fallas`);
process.exit(malas ? 1 : 0);
