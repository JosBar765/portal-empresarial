// scripts/proyectos/verificar-configuracion.js
// Verifica el registro de parámetros y el servicio de configuración del módulo Proyectos.
//
// Uso:  node scripts/proyectos/verificar-configuracion.js        (solo el registro; no necesita base de datos)
//       node scripts/proyectos/verificar-configuracion.js --db   (también el servicio, contra la base del .env)
// Con --db escribe y luego deshace sus propios cambios: úsalo contra una base de desarrollo, nunca de producción.
const P = require('../../src/modules/proyectos/parametros');

let fallos = 0;
const prueba = (nombre, condicion) => {
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}`);
  if (!condicion) fallos++;
};
// MySQL devuelve las columnas JSON ya convertidas; MariaDB (producción) las devuelve como texto.
const json = valor => (typeof valor === 'string' ? JSON.parse(valor) : valor);
const lanza = fn => { try { fn(); return null; } catch (e) { return e; } };
const campoDe = (cambios, actuales = P.valoresPorDefecto()) => {
  const error = lanza(() => P.validarCambios(cambios, actuales));
  return error && error.campos;
};

function verificarRegistro() {
  console.log('Registro de parámetros');
  const claves = P.PARAMETROS.map(p => p.clave);
  prueba('las claves no se repiten', new Set(claves).size === claves.length);
  prueba('cada clave cabe en parametros_sistema (60 caracteres con el prefijo)', claves.every(c => (P.PREFIJO + c).length <= 60));
  prueba('cada parámetro pertenece a un grupo conocido', P.PARAMETROS.every(p => P.GRUPOS.some(g => g.id === p.grupo)));
  prueba('cada valor por defecto es válido', P.PARAMETROS.every(p => !lanza(() => P.normalizarValor(p, p.defecto))));
  prueba('guardar y leer devuelve el mismo valor', P.PARAMETROS.every(p => {
    const texto = P.serializar(p, p.defecto);
    return JSON.stringify(P.deserializar(p, texto)) === JSON.stringify(p.defecto);
  }));
  prueba('el texto guardado cabe en 255 caracteres', P.PARAMETROS.every(p => P.serializar(p, p.defecto).length <= 255));

  console.log('Validación');
  prueba('un entero fuera de rango se rechaza', !!campoDe({ 'seguimiento.dias_estancado': 0 })['seguimiento.dias_estancado']);
  prueba('un entero con letras se rechaza', !!campoDe({ 'seguimiento.dias_estancado': '7 días' })['seguimiento.dias_estancado']);
  prueba('un entero escrito como texto se acepta', P.validarCambios({ 'seguimiento.dias_estancado': '10' }, P.valoresPorDefecto())['seguimiento.dias_estancado'] === 10);
  prueba('el tope vacío significa sin tope', P.validarCambios({ 'reparto.tope_por_asesor': '' }, P.valoresPorDefecto())['reparto.tope_por_asesor'] === null);
  prueba('el tope fuera de rango se rechaza', !!campoDe({ 'reparto.tope_por_asesor': 501 })['reparto.tope_por_asesor']);
  prueba('un sí/no inválido se rechaza', !!campoDe({ 'reparto.rondas': 'quizás' })['reparto.rondas']);
  prueba('una opción inexistente se rechaza', !!campoDe({ 'importacion.duplicadas_por_defecto': 'borrar' })['importacion.duplicadas_por_defecto']);
  prueba('las secciones del informe no pueden quedar vacías', !!campoDe({ 'informe.secciones': [] })['informe.secciones']);
  prueba('una sección inexistente se rechaza', !!campoDe({ 'informe.secciones': ['embudo', 'otra'] })['informe.secciones']);
  prueba('las secciones se guardan en el orden del registro', P.validarCambios({ 'informe.secciones': ['por_tienda', 'embudo'] }, P.valoresPorDefecto())['informe.secciones'].join() === 'embudo,por_tienda');
  prueba('el encabezado de más de 200 caracteres se rechaza', !!campoDe({ 'informe.texto_encabezado': 'x'.repeat(201) })['informe.texto_encabezado']);
  prueba('el formato del código acepta los marcadores válidos', !campoDe({ 'codigo.formato': 'PRY-{AAAA}-{N}' }));
  prueba('un marcador inexistente se rechaza', !!campoDe({ 'codigo.formato': 'PRY-{ANIO}' })['codigo.formato']);
  prueba('un formato sin marcadores se rechaza', !!campoDe({ 'codigo.formato': 'PRY' })['codigo.formato']);
  prueba('un formato vacío se rechaza', !!campoDe({ 'codigo.formato': '  ' })['codigo.formato']);
  prueba('una llave sin cerrar se rechaza', !!campoDe({ 'codigo.formato': 'PRY-{AAAA}-{' })['codigo.formato']);
  prueba('la hora debe ser HH:MM', !!campoDe({ 'activacion_auto.hora': '7am' })['activacion_auto.hora'] && !campoDe({ 'activacion_auto.hora': '07:30' }));
  prueba('un ajuste que no existe se rechaza', !!campoDe({ 'no.existe': 1 })['no.existe']);

  console.log('Semáforo');
  prueba('verde igual que ámbar se rechaza', !!campoDe({ 'semaforo.cobertura_verde': 50 })['semaforo.cobertura_verde']);
  prueba('subir el ámbar por encima del verde vigente se rechaza', !!campoDe({ 'semaforo.efectividad_ambar': 80 })['semaforo.efectividad_verde']);
  prueba('subir verde y ámbar juntos se acepta', !campoDe({ 'semaforo.cobertura_verde': 90, 'semaforo.cobertura_ambar': 80 }));
}

async function verificarServicio() {
  const db = require('../../src/config/database');
  await db.listo;
  const config = require('../../src/modules/proyectos/services/configService');
  const [{ id: usuarioId }] = await db.query('SELECT id FROM usuarios ORDER BY id LIMIT 1', [], 'verificar:usuario');
  const [{ n: historialAntes }] = await db.query('SELECT COUNT(*) AS n FROM proy_config_historial', [], 'verificar:historial_antes');
  const historial = clave => db.query('SELECT accion, antes, despues FROM proy_config_historial WHERE entidad = ? AND clave = ? ORDER BY id', ['parametro', clave], 'verificar:historial');
  const CLAVE = 'seguimiento.dias_estancado';

  try {
    console.log('Servicio de configuración (base de datos)');
    prueba('sin fila manda el valor por defecto', (await config.obtener(CLAVE)) === 7);

    const cambiadas = await config.guardar({ [CLAVE]: 12 }, usuarioId);
    prueba('guardar devuelve la clave cambiada', cambiadas.join() === CLAVE);
    prueba('el valor nuevo se lee de inmediato (la caché se invalida)', (await config.obtener(CLAVE)) === 12);
    const filas = await historial(CLAVE);
    prueba('el cambio queda en el historial con el antes y el después', filas.length === 1 && filas[0].accion === 'cambiar'
      && json(filas[0].antes).valor === 7 && json(filas[0].despues).valor === 12);

    prueba('guardar el mismo valor no escribe historial', (await config.guardar({ [CLAVE]: 12 }, usuarioId)).length === 0 && (await historial(CLAVE)).length === 1);

    const error = await config.guardar({ [CLAVE]: 15, 'semaforo.cobertura_verde': 10 }, usuarioId).then(() => null, e => e);
    prueba('un cambio inválido se rechaza completo, sin guardar nada', !!error && (await config.obtener(CLAVE)) === 12);

    const descripcion = await config.describir();
    const ajuste = descripcion.flatMap(g => g.parametros).find(p => p.clave === CLAVE);
    prueba('la pantalla recibe el valor, el defecto y si es el de siempre', ajuste.valor === 12 && ajuste.defecto === 7 && ajuste.esDefecto === false);
    prueba('las reglas no aparecen en la pantalla de parámetros', !descripcion.some(g => g.id === 'reglas') && (await config.describir('reglas')).some(g => g.id === 'reglas'));

    await config.restaurar(CLAVE, usuarioId);
    prueba('restaurar vuelve al valor por defecto y lo deja en el historial',
      (await config.obtener(CLAVE)) === 7 && (await historial(CLAVE)).map(f => f.accion).join() === 'cambiar,restaurar');

    const largo = 'x'.repeat(200);
    await config.guardar({ 'informe.texto_encabezado': largo }, usuarioId);
    prueba('un texto de 200 caracteres se guarda completo (valor de 255)', (await config.obtener('informe.texto_encabezado')) === largo);

    // País: se prueba con el primero que exista y se devuelve a su estado original.
    const [pais] = await config.paises();
    const original = { monedaCodigo: pais.monedaCodigo, prefijoTelefono: pais.prefijoTelefono, formatoTelefono: pais.formatoTelefono,
      referenciaObligatoria: pais.referenciaObligatoria, confirmacionVentas: pais.confirmacionVentas };
    await config.guardarPais(pais.paisId, { referenciaObligatoria: false, confirmacionVentas: true }, usuarioId);
    prueba('el país puede dejar la referencia opcional', (await config.referenciaObligatoria(pais.paisId)) === false);
    prueba('el país que fija «sí» confirma ventas aunque la regla global esté apagada', (await config.confirmacionVentas(pais.paisId)) === true);
    await config.guardarPais(pais.paisId, { confirmacionVentas: '' }, usuarioId);
    prueba('un país que hereda usa la regla global', (await config.confirmacionVentas(pais.paisId)) === (await config.obtener('reglas.confirmar_ventas')));
    const errorPais = await config.guardarPais(pais.paisId, { monedaCodigo: 'XXX', prefijoTelefono: '502' }, usuarioId).then(() => null, e => e);
    prueba('una moneda inexistente y un prefijo sin + se rechazan', !!errorPais && !!errorPais.campos.monedaCodigo && !!errorPais.campos.prefijoTelefono);
    await config.guardarPais(pais.paisId, original, usuarioId);
    prueba('el país vuelve a su estado original', JSON.stringify(await config.pais(pais.paisId)) === JSON.stringify(pais));

  } finally {
    // Limpieza, pase lo que pase: el ajuste de prueba y sus filas de historial no deben quedar en la base.
    await db.query('DELETE FROM parametros_sistema WHERE clave IN (?)', [[P.claveCompleta(CLAVE), P.claveCompleta('informe.texto_encabezado')]], 'verificar:limpiar_parametro');
    const [{ n: historialDespues }] = await db.query('SELECT COUNT(*) AS n FROM proy_config_historial', [], 'verificar:historial_despues');
    if (historialDespues > historialAntes) {
      await db.query('DELETE FROM proy_config_historial ORDER BY id DESC LIMIT ?', [historialDespues - historialAntes], 'verificar:limpiar');
    }
    config.invalidar();
  }
}

(async () => {
  verificarRegistro();
  if (process.argv.includes('--db')) await verificarServicio();
  console.log(fallos ? `\n${fallos} verificación(es) fallaron.` : '\nTodo correcto.');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
