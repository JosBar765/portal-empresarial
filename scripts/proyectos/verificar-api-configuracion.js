// scripts/proyectos/verificar-api-configuracion.js
// Recorre por HTTP la API de configuración y catálogos del módulo Proyectos (rutas reales, autenticación de prueba).
//
// Uso:  node scripts/proyectos/verificar-api-configuracion.js
// Escribe contra la base del .env y luego deshace sus propios cambios: úsalo contra una base de desarrollo,
// nunca de producción.
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/proyectos/routes');

let fallos = 0;
const prueba = (nombre, condicion) => {
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}`);
  if (!condicion) fallos++;
};

const json = valor => (typeof valor === 'string' ? JSON.parse(valor) : valor);

async function levantar(usuarioId) {
  const app = express();
  app.use(express.json());
  // Autenticación de prueba: los permisos llegan en la cabecera, como llegarían en el token.
  app.use((req, res, next) => {
    req.user = { id: usuarioId, permissions: (req.headers['x-permisos'] || '').split(',').filter(Boolean) };
    next();
  });
  app.use('/api/proyectos', requirePermission('proyectos.ver'), rutas);
  const servidor = await new Promise(resolver => { const s = app.listen(0, '127.0.0.1', () => resolver(s)); });
  return servidor;
}

async function main() {
  await db.listo;
  const [{ id: usuarioId }] = await db.query('SELECT id FROM usuarios ORDER BY id LIMIT 1', [], 'api:usuario');
  const [{ n: historialAntes }] = await db.query('SELECT COUNT(*) AS n FROM proy_config_historial', [], 'api:historial_antes');
  const ajustesAntes = await db.query('SELECT clave, valor FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'api:ajustes_antes');
  const servidor = await levantar(usuarioId);
  const base = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;
  const ADMIN = 'proyectos.ver,proyectos.administrar';

  const llamar = async (metodo, ruta, { cuerpo, permisos = ADMIN } = {}) => {
    const res = await fetch(base + ruta, {
      method: metodo,
      headers: { 'content-type': 'application/json', 'x-permisos': permisos },
      body: cuerpo === undefined || metodo === 'GET' ? undefined : JSON.stringify(cuerpo)
    });
    return { status: res.status, datos: await res.json().catch(() => null) };
  };

  const creados = { nichos: [], resultados: [], monedas: [] };
  let paisOriginal = null;
  try {
    console.log('Permisos');
    const rutasAdmin = [['GET', '/config/parametros'], ['PUT', '/config/parametros'], ['GET', '/config/reglas'], ['GET', '/config/paises'],
      ['GET', '/catalogos/nichos'], ['POST', '/catalogos/nichos'], ['PATCH', '/catalogos/nichos/1/activo']];
    let todas403 = true;
    for (const [metodo, ruta] of rutasAdmin) {
      if ((await llamar(metodo, ruta, { permisos: 'proyectos.ver', cuerpo: {} })).status !== 403) todas403 = false;
    }
    prueba('con solo proyectos.ver, ninguna ruta de administración responde', todas403);
    prueba('sin proyectos.ver tampoco entra', (await llamar('GET', '/config/parametros', { permisos: 'proyectos.administrar' })).status === 403);

    console.log('Parámetros y reglas');
    let r = await llamar('GET', '/config/parametros');
    const claves = r.datos.grupos.flatMap(g => g.parametros.map(p => p.clave));
    prueba('la pantalla de parámetros trae los ajustes y no las reglas', r.status === 200 && claves.includes('seguimiento.dias_estancado') && !claves.includes('reglas.confirmar_ventas'));
    r = await llamar('GET', '/config/reglas');
    prueba('la pantalla de reglas trae solo los interruptores', r.datos.grupos.length === 1 && r.datos.grupos[0].id === 'reglas' && r.datos.grupos[0].parametros.length === 3);
    r = await llamar('PUT', '/config/parametros', { cuerpo: { cambios: { 'seguimiento.dias_estancado': 10 } } });
    prueba('guardar un parámetro responde con lo modificado y la pantalla al día',
      r.status === 200 && r.datos.modificados.join() === 'seguimiento.dias_estancado'
      && r.datos.grupos.flatMap(g => g.parametros).find(p => p.clave === 'seguimiento.dias_estancado').valor === 10);
    r = await llamar('PUT', '/config/parametros', { cuerpo: { cambios: { 'seguimiento.dias_estancado': 0 } } });
    prueba('un valor fuera de rango responde 400 con el campo marcado', r.status === 400 && !!r.datos.campos['seguimiento.dias_estancado']);
    r = await llamar('PUT', '/config/parametros', { cuerpo: { cambios: { 'reglas.confirmar_ventas': true } } });
    prueba('una regla no se puede guardar desde la pantalla de parámetros', r.status === 400 && !!r.datos.campos['reglas.confirmar_ventas']);
    r = await llamar('PUT', '/config/reglas', { cuerpo: { cambios: { 'reglas.visto_bueno_cierre': false } } });
    prueba('un interruptor se guarda desde la pantalla de reglas', r.status === 200 && r.datos.modificados.join() === 'reglas.visto_bueno_cierre');
    r = await llamar('PUT', '/config/parametros', { cuerpo: { cambios: [1, 2] } });
    prueba('un cuerpo con forma equivocada no rompe: no cambia nada', r.status === 200 && r.datos.modificados.length === 0);
    r = await llamar('POST', '/config/ajustes/seguimiento.dias_estancado/restaurar');
    prueba('restaurar devuelve el valor por defecto', r.status === 200 && r.datos.valor === 7);
    await llamar('POST', '/config/ajustes/reglas.visto_bueno_cierre/restaurar');
    r = await llamar('POST', '/config/ajustes/no.existe/restaurar');
    prueba('restaurar un ajuste inexistente responde 400', r.status === 400);

    console.log('Países');
    r = await llamar('GET', '/config/paises');
    prueba('lista los países con su configuración', r.status === 200 && r.datos.paises.length >= 6 && r.datos.paises[0].referenciaObligatoria !== undefined);
    paisOriginal = r.datos.paises[0];
    const paisId = paisOriginal.paisId;
    r = await llamar('PUT', `/config/paises/${paisId}`, { cuerpo: { referenciaObligatoria: false, confirmacionVentas: true } });
    prueba('guarda la referencia opcional y la confirmación del país', r.status === 200 && r.datos.cambiado === true && r.datos.pais.referenciaObligatoria === false && r.datos.pais.confirmacionVentas === true);
    r = await llamar('PUT', `/config/paises/${paisId}`, { cuerpo: { prefijoTelefono: '502', monedaCodigo: 'XXX' } });
    prueba('un prefijo sin + y una moneda inexistente responden 400 con los campos', r.status === 400 && !!r.datos.campos.prefijoTelefono && !!r.datos.campos.monedaCodigo);
    prueba('un id de país inválido responde 400', (await llamar('PUT', '/config/paises/abc', { cuerpo: {} })).status === 400);
    prueba('un país que no existe responde 404', (await llamar('PUT', '/config/paises/999999', { cuerpo: {} })).status === 404);

    console.log('Catálogos');
    r = await llamar('GET', '/catalogos/nichos');
    prueba('lista los 17 nichos con su número de usos', r.status === 200 && r.datos.items.length >= 17 && r.datos.items.every(i => i.usos === 0 && typeof i.activo === 'boolean'));
    prueba('un catálogo que no existe responde 404', (await llamar('GET', '/catalogos/otro')).status === 404);
    r = await llamar('POST', '/catalogos/nichos', { cuerpo: { nombre: '  Nicho de prueba API  ', descripcion: 'Solo para verificar' } });
    const nicho = r.datos && r.datos.item;
    if (nicho) creados.nichos.push(nicho.id);
    prueba('crear un nicho responde 201, sin espacios sobrantes y al final del orden', r.status === 201 && nicho.nombre === 'Nicho de prueba API' && nicho.activo === true && nicho.orden > 17);
    r = await llamar('POST', '/catalogos/nichos', { cuerpo: { nombre: 'nicho DE prueba api' } });
    prueba('un nombre repetido (aunque cambien mayúsculas) responde 409 con un mensaje claro', r.status === 409 && /Ya existe un nicho/.test(r.datos.error));
    r = await llamar('POST', '/catalogos/nichos', { cuerpo: { nombre: '   ' } });
    prueba('un nombre vacío responde 400 con el campo marcado', r.status === 400 && !!r.datos.campos.nombre);
    r = await llamar('POST', '/catalogos/nichos', { cuerpo: { nombre: 'x'.repeat(101) } });
    prueba('un nombre demasiado largo responde 400', r.status === 400 && !!r.datos.campos.nombre);
    r = await llamar('PUT', `/catalogos/nichos/${nicho.id}`, { cuerpo: { nombre: 'Nicho de prueba API 2', orden: 99 } });
    prueba('editar cambia el nombre y el orden', r.status === 200 && r.datos.item.nombre === 'Nicho de prueba API 2' && r.datos.item.orden === 99);
    r = await llamar('PATCH', `/catalogos/nichos/${nicho.id}/activo`, { cuerpo: { activo: false } });
    prueba('desactivar no borra: la fila sigue y queda inactiva', r.status === 200 && r.datos.item.activo === false && (await llamar('GET', '/catalogos/nichos')).datos.items.some(i => i.id === nicho.id));
    prueba('un valor de activo inválido responde 400', (await llamar('PATCH', `/catalogos/nichos/${nicho.id}/activo`, { cuerpo: { activo: 'tal vez' } })).status === 400);
    prueba('un id de catálogo inexistente responde 404', (await llamar('PUT', '/catalogos/nichos/999999', { cuerpo: { nombre: 'x' } })).status === 404);
    prueba('un id inválido responde 400', (await llamar('PUT', '/catalogos/nichos/abc', { cuerpo: { nombre: 'x' } })).status === 400);

    r = await llamar('POST', '/catalogos/resultados', { cuerpo: { nombre: 'Resultado de prueba', contactoLogrado: true, requiereProxima: false, efectoEstado: 'vendida' } });
    prueba('un efecto de estado que no existe se rechaza (nunca baja ni fija vendida)', r.status === 400 && !!r.datos.campos.efectoEstado);
    r = await llamar('POST', '/catalogos/resultados', { cuerpo: { nombre: 'Resultado de prueba', contactoLogrado: true, requiereProxima: false, efectoEstado: 'interesada' } });
    if (r.datos && r.datos.item) creados.resultados.push(r.datos.item.id);
    prueba('crear un resultado guarda sus sí/no y el efecto', r.status === 201 && r.datos.item.contactoLogrado === true && r.datos.item.requiereProxima === false && r.datos.item.efectoEstado === 'interesada');

    r = await llamar('POST', '/catalogos/monedas', { cuerpo: { codigo: 'eur', nombre: 'Euro', simbolo: '€' } });
    if (r.datos && r.datos.item) creados.monedas.push(r.datos.item.id);
    prueba('una moneda se crea con el código en mayúsculas y ese código es su id', r.status === 201 && r.datos.item.id === 'EUR' && r.datos.item.codigo === 'EUR');
    prueba('un código de moneda inválido responde 400', (await llamar('POST', '/catalogos/monedas', { cuerpo: { codigo: 'EU', nombre: 'Euro', simbolo: '€' } })).status === 400);
    r = await llamar('PUT', '/catalogos/monedas/EUR', { cuerpo: { codigo: 'XYZ', nombre: 'Euro europeo' } });
    prueba('el código de una moneda no se puede cambiar', r.status === 400 && !!r.datos.campos.codigo);
    r = await llamar('PUT', '/catalogos/monedas/eur', { cuerpo: { codigo: 'EUR', nombre: 'Euro europeo' } });
    prueba('repetir el mismo código al editar es válido y cambia el nombre', r.status === 200 && r.datos.item.nombre === 'Euro europeo');

    console.log('Historial');
    const historial = await db.query('SELECT entidad, accion, antes, despues FROM proy_config_historial ORDER BY id', [], 'api:historial');
    const nuevos = historial.slice(historialAntes);
    prueba('crear, editar y desactivar quedaron registrados',
      ['crear', 'editar', 'desactivar'].every(a => nuevos.some(h => h.entidad === 'catalogo:nichos' && h.accion === a)));
    prueba('crear un nicho no guarda un «antes» y editar guarda ambos',
      nuevos.some(h => h.entidad === 'catalogo:nichos' && h.accion === 'crear' && h.antes === null)
      && nuevos.some(h => h.entidad === 'catalogo:nichos' && h.accion === 'editar' && json(h.antes).nombre === 'Nicho de prueba API' && json(h.despues).nombre === 'Nicho de prueba API 2'));
    prueba('los cambios de parámetros y de país también quedaron', nuevos.some(h => h.entidad === 'parametro') && nuevos.some(h => h.entidad === 'pais'));
    const antesDeFallos = nuevos.length;
    await llamar('PUT', '/catalogos/nichos/abc', { cuerpo: { nombre: 'x' } });
    await llamar('POST', '/catalogos/nichos', { cuerpo: { nombre: '' } });
    const [{ n: total }] = await db.query('SELECT COUNT(*) AS n FROM proy_config_historial', [], 'api:historial_total');
    prueba('las peticiones rechazadas no dejan historial', total - historialAntes === antesDeFallos);
  } finally {
    // Limpieza, pase lo que pase: nada de esta prueba debe quedar en la base.
    await db.query('DELETE FROM proy_nichos WHERE nombre LIKE ?', ['Nicho de prueba API%'], 'api:limpiar_nichos');
    await db.query('DELETE FROM proy_resultados_gestion WHERE nombre = ?', ['Resultado de prueba'], 'api:limpiar_resultados');
    await db.query('DELETE FROM proy_monedas WHERE codigo = ?', ['EUR'], 'api:limpiar_monedas');
    await db.query('DELETE FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'api:limpiar_parametros');
    for (const { clave, valor } of ajustesAntes) {
      await db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?)', [clave, valor], 'api:restaurar_ajuste');
    }
    if (paisOriginal) {
      await db.query(
        `UPDATE proy_pais_config SET moneda_codigo = ?, prefijo_telefono = ?, formato_telefono = ?, referencia_obligatoria = ?, confirmacion_ventas = ? WHERE pais_id = ?`,
        [paisOriginal.monedaCodigo, paisOriginal.prefijoTelefono, paisOriginal.formatoTelefono, paisOriginal.referenciaObligatoria ? 1 : 0,
          paisOriginal.confirmacionVentas === null ? null : (paisOriginal.confirmacionVentas ? 1 : 0), paisOriginal.paisId], 'api:limpiar_pais'
      );
    }
    const [{ n: historialDespues }] = await db.query('SELECT COUNT(*) AS n FROM proy_config_historial', [], 'api:historial_despues');
    if (historialDespues > historialAntes) {
      await db.query('DELETE FROM proy_config_historial ORDER BY id DESC LIMIT ?', [historialDespues - historialAntes], 'api:limpiar_historial');
    }
    servidor.close();
  }
  console.log(fallos ? `\n${fallos} verificación(es) fallaron.` : '\nTodo correcto.');
  process.exit(fallos ? 1 : 0);
}

main().catch(e => { console.error('ERROR', e); process.exit(1); });
