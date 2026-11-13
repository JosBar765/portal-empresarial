// scripts/incidencias/verificar-configuracion.js
// Verifica la configuración del módulo Incidencias (fase 3) por HTTP contra las rutas reales: solo quien puede configurar entra;
// países (encender y apagar, con su efecto en el formulario), catálogos (crear, editar, apagar, nombres repetidos y referencias),
// prioridades y reglas impacto → prioridad, parámetros, técnicos, verificadores, roles y permisos (conserva los de otros
// módulos, agrega «Ver» solo y no deja al módulo sin quien pueda configurarlo) y el historial de cambios.
//
// Uso (base DESECHABLE con las migraciones aplicadas; crea datos de prueba y los borra al terminar):
//   node scripts/incidencias/verificar-configuracion.js
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/incidencias/routes');

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};

const P_CONFIGURA = ['incidencias.ver', 'incidencias.configurar'];
const P_REPORTA = ['incidencias.ver', 'incidencias.reportar'];
const PREFIJO = 'PRUEBA CFG';

async function levantar() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: Number(req.headers['x-usuario']), nombre: 'Prueba', permissions: (req.headers['x-permisos'] || '').split(',').filter(Boolean) };
    next();
  });
  app.use('/api/incidencias', requirePermission('incidencias.ver'), rutas);
  return new Promise(resolver => { const s = app.listen(0, '127.0.0.1', () => resolver(s)); });
}

async function verificar() {
  const ajustesAntes = await db.query("SELECT clave, valor FROM parametros_sistema WHERE clave LIKE 'incidencias.%'", [], 'cfg:ajustes_antes');
  const reglasAntes = await db.query('SELECT impacto, prioridad_id FROM incidencia_reglas_prioridad', [], 'cfg:reglas_antes');
  const paisesAntes = await db.query('SELECT pais_id, habilitado, aviso FROM incidencia_paises', [], 'cfg:paises_antes');
  const [{ id: paisGT }] = await db.query("SELECT id FROM paises WHERE codigo = 'GT'", [], 'cfg:gt');
  const [{ id: paisSV }] = await db.query("SELECT id FROM paises WHERE codigo = 'SV'", [], 'cfg:sv');
  const tiendasGT = await db.query('SELECT t.id FROM tiendas t JOIN empresas e ON e.id = t.empresa_id WHERE e.pais_id = ? AND t.activo = 1 ORDER BY t.id LIMIT 2', [paisGT], 'cfg:tiendas');
  const [TA, TB] = tiendasGT.map(t => t.id);
  const usuarios = (await db.query('SELECT id, nombre FROM usuarios WHERE activo = 1 ORDER BY id LIMIT 8', [], 'cfg:usuarios'));
  const ADMIN = usuarios[0].id;
  const [, U1, U2, U3] = usuarios.map(u => u.id);
  const [{ id: catElectrica }] = await db.query("SELECT id FROM incidencia_categorias WHERE nombre = 'Eléctrica'", [], 'cfg:cat');
  const [{ id: espElectricidad }] = await db.query("SELECT id FROM incidencia_especialidades WHERE nombre = 'Electricidad'", [], 'cfg:esp');
  const [{ id: p1 }] = await db.query("SELECT id FROM incidencia_prioridades WHERE codigo = 'P1'", [], 'cfg:p1');
  const [{ id: p2 }] = await db.query("SELECT id FROM incidencia_prioridades WHERE codigo = 'P2'", [], 'cfg:p2');
  const [{ id: p3 }] = await db.query("SELECT id FROM incidencia_prioridades WHERE codigo = 'P3'", [], 'cfg:p3');
  const [{ id: p4 }] = await db.query("SELECT id FROM incidencia_prioridades WHERE codigo = 'P4'", [], 'cfg:p4');
  const [{ id: rolAdmin }] = await db.query("SELECT id FROM roles WHERE nombre = 'Administrador'", [], 'cfg:rol_admin');
  const [{ id: permisoValesVer }] = await db.query("SELECT id FROM permisos WHERE codigo = 'vales.ver'", [], 'cfg:permiso_vales');

  const servidor = await levantar();
  const base = `http://127.0.0.1:${servidor.address().port}/api/incidencias`;
  const llamar = async (metodo, ruta, { usuario, permisos, cuerpo }) => {
    const cab = { 'x-usuario': String(usuario), 'x-permisos': permisos.join(',') };
    if (cuerpo !== undefined) cab['content-type'] = 'application/json';
    const res = await fetch(base + ruta, { method: metodo, headers: cab, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
    return { status: res.status, datos: await res.json().catch(() => null) };
  };
  const adm = (m, r, c) => llamar(m, r, { usuario: ADMIN, permisos: P_CONFIGURA, cuerpo: c });
  const rep = (m, r, c) => llamar(m, r, { usuario: U1, permisos: P_REPORTA, cuerpo: c });
  const fijas = [];
  let rolPrueba = null;
  let incidenciaTemporal = null;

  try {
    console.log('Acceso');
    let r = await rep('GET', '/configuracion/estado');
    prueba('quien no puede configurar recibe 403 en la configuración', r.status === 403, r.status);
    r = await rep('GET', '/configuracion/roles');
    prueba('también en roles y permisos', r.status === 403);
    r = await adm('GET', '/configuracion/estado');
    prueba('quien configura ve el estado general', r.status === 200 && r.datos.paisesHabilitados >= 1 && typeof r.datos.tiendasSinVerificador === 'number' && r.datos.rolesQueConfiguran >= 1, JSON.stringify(r.datos));

    console.log('Países');
    r = await adm('GET', '/configuracion/paises');
    const gt = r.datos.paises.find(p => p.codigo === 'GT');
    prueba('Guatemala aparece primero y encendida, con sus tiendas', r.status === 200 && r.datos.paises[0].codigo === 'GT' && gt.habilitado === true && gt.tiendas > 0, JSON.stringify(r.datos.paises[0]));
    r = await adm('PUT', `/configuracion/paises/${paisSV}`, {});
    prueba('encender o apagar sin decir cuál → 400', r.status === 400 && r.datos.campos && r.datos.campos.habilitado);
    r = await adm('PUT', `/configuracion/paises/${paisSV}`, { habilitado: true, aviso: 'x'.repeat(161) });
    prueba('un aviso de más de 160 caracteres → 400', r.status === 400 && r.datos.campos && r.datos.campos.aviso);
    r = await adm('PUT', '/configuracion/paises/999999', { habilitado: true });
    prueba('un país que no existe → 404', r.status === 404);
    r = await adm('PUT', `/configuracion/paises/${paisSV}`, { habilitado: true, aviso: 'Pronto en El Salvador' });
    prueba('encender El Salvador', r.status === 200 && r.datos.paises.find(p => p.codigo === 'SV').habilitado === true);
    r = await rep('GET', '/formulario');
    prueba('el formulario ya ofrece sus tiendas', r.status === 200 && r.datos.tiendas.some(t => t.pais === 'El Salvador'));
    r = await adm('PUT', `/configuracion/paises/${paisSV}`, { habilitado: false });
    prueba('apagarlo conserva su aviso y el formulario deja de ofrecerlo', r.status === 200 && r.datos.paises.find(p => p.codigo === 'SV').aviso === 'Pronto en El Salvador' && !(await rep('GET', '/formulario')).datos.tiendas.some(t => t.pais === 'El Salvador'));

    console.log('Catálogos');
    r = await adm('GET', '/configuracion/catalogos/inventado');
    prueba('un catálogo que no existe → 404', r.status === 404);
    r = await adm('GET', '/configuracion/catalogos/categorias');
    prueba('las categorías traen su especialidad y sus tipos', r.status === 200 && r.datos.items.length >= 9 && r.datos.items.find(c => c.nombre === 'Eléctrica').tipos.includes('Tomacorriente'));
    r = await adm('POST', '/configuracion/catalogos/categorias', { nombre: '' });
    prueba('una categoría sin nombre → 400', r.status === 400 && r.datos.campos && r.datos.campos.nombre);
    r = await adm('POST', '/configuracion/catalogos/categorias', { nombre: 'x' });
    prueba('un nombre de un carácter → 400', r.status === 400);
    r = await adm('POST', '/configuracion/catalogos/categorias', { nombre: `${PREFIJO} categoría`, especialidadId: 999999 });
    prueba('una especialidad que no existe → 400', r.status === 400 && r.datos.campos && r.datos.campos.especialidadId);
    r = await adm('POST', '/configuracion/catalogos/categorias', { nombre: `${PREFIJO} categoría`, especialidadId: espElectricidad });
    const idCat = r.datos && r.datos.creadoId;
    prueba('crear una categoría con su especialidad', r.status === 201 && r.datos.items.some(c => c.id === idCat && c.especialidad === 'Electricidad' && c.activo === true));
    r = await adm('POST', '/configuracion/catalogos/categorias', { nombre: `${PREFIJO} categoría` });
    prueba('el mismo nombre otra vez → 400', r.status === 400 && r.datos.campos && r.datos.campos.nombre);
    r = await rep('GET', '/formulario');
    prueba('la categoría nueva ya sale en el formulario', r.datos.categorias.some(c => c.nombre === `${PREFIJO} categoría`));
    r = await adm('PUT', `/configuracion/catalogos/categorias/${idCat}`, { activo: false });
    prueba('apagar una categoría la quita del formulario sin borrarla', r.status === 200 && r.datos.items.find(c => c.id === idCat).activo === false && !(await rep('GET', '/formulario')).datos.categorias.some(c => c.id === idCat));
    r = await adm('PUT', `/configuracion/catalogos/categorias/${idCat}`, { nombre: `${PREFIJO} categoría 2`, activo: true });
    prueba('renombrar y volver a encender', r.status === 200 && r.datos.items.find(c => c.id === idCat).nombre === `${PREFIJO} categoría 2`);
    r = await adm('PUT', '/configuracion/catalogos/categorias/999999', { nombre: 'Algo' });
    prueba('editar un registro que no existe → 404', r.status === 404);

    r = await adm('POST', '/configuracion/catalogos/tipos-activo', { nombre: `${PREFIJO} activo` });
    prueba('un tipo de activo sin categoría → 400', r.status === 400 && r.datos.campos && r.datos.campos.categoriaId);
    r = await adm('POST', '/configuracion/catalogos/tipos-activo', { nombre: `${PREFIJO} activo`, categoriaId: idCat });
    const idTipo = r.datos && r.datos.creadoId;
    prueba('crear un tipo de activo en su categoría', r.status === 201 && r.datos.items.some(t => t.id === idTipo && t.categoria === `${PREFIJO} categoría 2`));
    r = await adm('POST', '/configuracion/catalogos/tipos-activo', { nombre: `${PREFIJO} activo`, categoriaId: idCat });
    prueba('el mismo tipo en la misma categoría → 400', r.status === 400);
    r = await adm('POST', '/configuracion/catalogos/tipos-activo', { nombre: `${PREFIJO} activo`, categoriaId: catElectrica });
    prueba('el mismo nombre en otra categoría sí se puede', r.status === 201);

    r = await adm('POST', '/configuracion/catalogos/zonas', { nombre: `${PREFIJO} zona` });
    const idZonaGeneral = r.datos && r.datos.creadoId;
    prueba('crear una zona general', r.status === 201 && r.datos.items.find(z => z.id === idZonaGeneral).tienda_id === null);
    r = await adm('POST', '/configuracion/catalogos/zonas', { nombre: `${PREFIJO} zona` });
    prueba('otra zona general con el mismo nombre → 400', r.status === 400);
    r = await adm('POST', '/configuracion/catalogos/zonas', { nombre: `${PREFIJO} zona`, tiendaId: TA });
    prueba('la misma zona en una tienda sí se puede (otro ámbito)', r.status === 201);
    r = await adm('POST', '/configuracion/catalogos/zonas', { nombre: `${PREFIJO} zona 3`, tiendaId: 999999 });
    prueba('una zona en una tienda que no existe → 400', r.status === 400 && r.datos.campos && r.datos.campos.tiendaId);

    r = await adm('POST', '/configuracion/catalogos/motivos-espera', { nombre: `${PREFIJO} motivo` });
    prueba('crear un motivo de espera', r.status === 201 && r.datos.items.some(m => m.nombre === `${PREFIJO} motivo`));
    r = await adm('POST', '/configuracion/catalogos/especialidades', { nombre: `${PREFIJO} especialidad`, orden: 5000 });
    prueba('un orden fuera de rango → 400', r.status === 400 && r.datos.campos && r.datos.campos.orden);
    r = await adm('POST', '/configuracion/catalogos/especialidades', { nombre: `${PREFIJO} especialidad`, orden: 50 });
    prueba('crear una especialidad', r.status === 201);

    console.log('Prioridades y reglas');
    r = await adm('GET', '/configuracion/prioridades');
    prueba('trae las prioridades y la regla de cada impacto', r.status === 200 && r.datos.prioridades.length >= 4 && r.datos.reglas.length === 4 && r.datos.reglas.every(x => x.prioridadId && x.nombre) && r.datos.colores.includes('rojo'));
    r = await adm('POST', '/configuracion/prioridades', { codigo: 'XX', nombre: 'Muy baja', color: 'gris', orden: 5 });
    prueba('un código mal escrito → 400', r.status === 400 && r.datos.campos && r.datos.campos.codigo);
    r = await adm('POST', '/configuracion/prioridades', { codigo: 'P1', nombre: 'Otra', color: 'gris', orden: 9 });
    prueba('un código repetido → 400', r.status === 400 && r.datos.campos && r.datos.campos.codigo);
    r = await adm('POST', '/configuracion/prioridades', { codigo: 'P5', nombre: 'Muy baja', color: 'fucsia', orden: 0 });
    prueba('color fuera de la lista y orden 0 → 400', r.status === 400 && r.datos.campos.color && r.datos.campos.orden);
    r = await adm('POST', '/configuracion/prioridades', { codigo: 'P5', nombre: 'Muy baja', color: 'gris', orden: 5 });
    const idP5 = r.datos && r.datos.creadoId;
    prueba('crear una prioridad nueva', r.status === 201 && r.datos.prioridades.some(p => p.id === idP5 && p.codigo === 'P5'));
    r = await adm('PUT', `/configuracion/prioridades/${p1}`, { activo: false });
    prueba('no se apaga una prioridad que usa una regla → 400 con el impacto', r.status === 400 && /Riesgo para las personas/.test(r.datos.campos.activo), JSON.stringify(r.datos));
    r = await adm('PUT', `/configuracion/prioridades/${idP5}`, { nombre: 'Mínima', color: 'azul' });
    prueba('editar nombre y color', r.status === 200 && r.datos.prioridades.find(p => p.id === idP5).nombre === 'Mínima');
    r = await adm('PUT', '/configuracion/prioridades/reglas', { reglas: [{ impacto: 'riesgo_personas', prioridadId: p1 }] });
    prueba('guardar las reglas sin los cuatro impactos → 400', r.status === 400 && r.datos.campos.detiene_operacion);
    r = await adm('PUT', '/configuracion/prioridades/reglas', { reglas: [
      { impacto: 'riesgo_personas', prioridadId: p1 }, { impacto: 'detiene_operacion', prioridadId: p2 },
      { impacto: 'trabajo_con_limitaciones', prioridadId: p3 }, { impacto: 'molestia_menor', prioridadId: idP5 }] });
    prueba('cambiar la regla de «Molestia menor» a la prioridad nueva', r.status === 200 && r.datos.reglas.find(x => x.impacto === 'molestia_menor').prioridadId === idP5);
    r = await rep('GET', '/formulario');
    prueba('el formulario muestra la prioridad que corresponde ahora', r.datos.impactos.find(i => i.clave === 'molestia_menor').prioridad.codigo === 'P5');
    r = await adm('PUT', `/configuracion/prioridades/${idP5}`, { activo: false });
    prueba('mientras la regla la use, no se puede apagar', r.status === 400);
    r = await adm('PUT', '/configuracion/prioridades/reglas', { reglas: [
      { impacto: 'riesgo_personas', prioridadId: p1 }, { impacto: 'detiene_operacion', prioridadId: p2 },
      { impacto: 'trabajo_con_limitaciones', prioridadId: p3 }, { impacto: 'molestia_menor', prioridadId: p4 }] });
    prueba('devolver la regla original', r.status === 200);
    r = await adm('PUT', `/configuracion/prioridades/${idP5}`, { activo: false });
    prueba('ahora sí se apaga y deja de ofrecerse', r.status === 200 && r.datos.prioridades.find(p => p.id === idP5).activo === false);

    console.log('Parámetros');
    r = await adm('GET', '/configuracion/parametros');
    prueba('trae los parámetros con su valor, su valor por defecto y sus límites', r.status === 200 && r.datos.parametros.length >= 6 && r.datos.parametros.every(p => p.etiqueta && p.valor !== undefined));
    r = await adm('PUT', '/configuracion/parametros', { valores: { fotos_por_reporte: 99 } });
    prueba('un valor fuera de rango → 400', r.status === 400 && r.datos.campos.fotos_por_reporte);
    r = await adm('PUT', '/configuracion/parametros', { valores: { inventado: 1 } });
    prueba('un parámetro que no existe → 400', r.status === 400 && r.datos.campos.inventado);
    r = await adm('PUT', '/configuracion/parametros', { valores: { subir_nivel_reincidencia: 'quizás' } });
    prueba('un sí o no mal escrito → 400', r.status === 400);
    r = await adm('PUT', '/configuracion/parametros', { valores: { fotos_por_reporte: 2, subir_nivel_reincidencia: false } });
    prueba('guardar parámetros', r.status === 200 && r.datos.parametros.find(p => p.clave === 'fotos_por_reporte').valor === 2 && r.datos.parametros.find(p => p.clave === 'subir_nivel_reincidencia').valor === false);
    r = await rep('GET', '/formulario');
    prueba('el formulario usa el nuevo límite de fotos', r.datos.limites.fotos === 2);

    console.log('Técnicos');
    r = await adm('GET', '/configuracion/tecnicos/candidatos?q=a');
    prueba('el selector ofrece personas que aún no son técnicos', r.status === 200 && r.datos.candidatos.length > 0 && r.datos.candidatos.every(c => c.id && c.nombre && c.rol));
    r = await adm('POST', '/configuracion/tecnicos', { usuarioId: 999999 });
    prueba('una persona que no existe → 400', r.status === 400 && r.datos.campos.usuarioId);
    r = await adm('POST', '/configuracion/tecnicos', { usuarioId: U1, todasLasTiendas: false, tiendaIds: [] });
    prueba('sin tiendas y sin «todas» → 400', r.status === 400 && r.datos.campos.tiendaIds);
    r = await adm('POST', '/configuracion/tecnicos', { usuarioId: U1, especialidadIds: [999999] });
    prueba('una especialidad que no existe → 400', r.status === 400 && r.datos.campos.especialidadIds);
    r = await adm('POST', '/configuracion/tecnicos', { usuarioId: U1, especialidadIds: [espElectricidad], todasLasTiendas: false, tiendaIds: [TA, TB] });
    const tecnico = r.datos && r.datos.tecnicos && r.datos.tecnicos.find(t => t.usuarioId === U1);
    prueba('agregar un técnico con especialidad y tiendas', r.status === 201 && tecnico && tecnico.activo === true && tecnico.especialidades.length === 1 && tecnico.tiendas.length === 2 && tecnico.todasLasTiendas === false, JSON.stringify(tecnico));
    prueba('avisa si su rol no tiene el permiso de atender', typeof tecnico.sinPermiso === 'boolean');
    r = await adm('POST', '/configuracion/tecnicos', { usuarioId: U1 });
    prueba('agregarlo otra vez → 409', r.status === 409);
    r = await adm('GET', '/configuracion/tecnicos/candidatos');
    prueba('ya no aparece entre los candidatos', !r.datos.candidatos.some(c => c.id === U1));
    r = await adm('PUT', `/configuracion/tecnicos/${U1}`, { todasLasTiendas: true });
    prueba('pasar a cubrir todas las tiendas conserva sus especialidades', r.status === 200 && r.datos.tecnicos.find(t => t.usuarioId === U1).todasLasTiendas === true && r.datos.tecnicos.find(t => t.usuarioId === U1).especialidades.length === 1);
    r = await adm('PUT', `/configuracion/tecnicos/${U1}`, { todasLasTiendas: false, tiendaIds: [] });
    prueba('cubrir solo algunas sin elegir tiendas → 400', r.status === 400 && r.datos.campos.tiendaIds);
    r = await adm('PUT', '/configuracion/tecnicos/999999', { activo: false });
    prueba('editar a quien no es técnico → 404', r.status === 404);
    incidenciaTemporal = (await db.query(
      `INSERT INTO incidencias (tienda_id, categoria_id, titulo, descripcion, impacto, prioridad_id, estado, reportada_por, tecnico_id)
       VALUES (?, ?, 'PRUEBA CFG incidencia', 'Para la prueba de desactivar técnicos.', 'molestia_menor', ?, 'en_proceso', ?, ?)`, [TA, catElectrica, p4, U2, U1], 'cfg:incidencia')).insertId;
    r = await adm('PUT', `/configuracion/tecnicos/${U1}`, { activo: false });
    prueba('un técnico con incidencias abiertas no se desactiva → 400 con el número', r.status === 400 && /1 incidencia abierta/.test(r.datos.campos.activo), JSON.stringify(r.datos));
    await db.query('DELETE FROM incidencias WHERE id = ?', [incidenciaTemporal], 'cfg:borrar_incidencia');
    incidenciaTemporal = null;
    r = await adm('PUT', `/configuracion/tecnicos/${U1}`, { activo: false });
    prueba('sin incidencias abiertas sí se desactiva', r.status === 200 && r.datos.tecnicos.find(t => t.usuarioId === U1).activo === false);

    console.log('Verificadores');
    r = await adm('GET', '/configuracion/verificadores');
    const sin0 = r.datos.sinVerificador;
    prueba('lista las tiendas de los países encendidos con quién las verifica', r.status === 200 && r.datos.tiendas.length > 0 && r.datos.tiendas.every(t => t.pais === 'Guatemala') && sin0 === r.datos.tiendas.filter(t => !t.efectivo).length);
    r = await adm('GET', '/configuracion/verificadores/candidatos?q=a');
    prueba('el selector de verificadores ofrece personas activas y avisa si su rol no puede verificar', r.status === 200 && r.datos.candidatos.length > 0 && r.datos.candidatos.every(c => c.id && c.nombre && typeof c.sinPermiso === 'boolean'), JSON.stringify(r.datos));
    r = await adm('POST', '/configuracion/verificadores', { usuarioId: U2, tiendaId: TA, paisId: paisGT });
    prueba('una tienda y un país a la vez → 400', r.status === 400 && r.datos.campos.tiendaId);
    r = await adm('POST', '/configuracion/verificadores', { usuarioId: U2 });
    prueba('ni tienda ni país → 400', r.status === 400);
    r = await adm('POST', '/configuracion/verificadores', { usuarioId: 999999, tiendaId: TA });
    prueba('una persona que no existe → 400', r.status === 400 && r.datos.campos.usuarioId);
    r = await adm('POST', '/configuracion/verificadores', { usuarioId: U2, tiendaId: TA });
    const idV = r.datos && r.datos.creadoId;
    const tiendaA = r.datos && r.datos.tiendas && r.datos.tiendas.find(t => t.id === TA);
    prueba('asignar un verificador a una tienda', r.status === 201 && tiendaA.efectivo === 'tienda' && tiendaA.verificadores[0].usuarioId === U2 && typeof tiendaA.verificadores[0].sinPermiso === 'boolean');
    r = await adm('POST', '/configuracion/verificadores', { usuarioId: U2, tiendaId: TA });
    prueba('la misma persona en la misma tienda → 409', r.status === 409);
    r = await adm('POST', '/configuracion/verificadores', { usuarioId: U3, paisId: paisGT });
    const idVPais = r.datos && r.datos.creadoId;
    const tiendaB = r.datos && r.datos.tiendas && r.datos.tiendas.find(t => t.id === TB);
    prueba('un verificador del país cubre las tiendas que no tienen uno propio', r.status === 201 && tiendaB.efectivo === 'pais' && r.datos.tiendas.find(t => t.id === TA).efectivo === 'tienda' && r.datos.sinVerificador === 0, JSON.stringify(r.datos.sinVerificador));
    r = await adm('DELETE', `/configuracion/verificadores/${idVPais}`);
    prueba('quitar el verificador del país deja sin verificador a las tiendas que no tenían propio', r.status === 200 && r.datos.sinVerificador === sin0 - 1, `${r.datos.sinVerificador} vs ${sin0}`);
    r = await adm('DELETE', `/configuracion/verificadores/${idV}`);
    prueba('quitar el de la tienda', r.status === 200 && r.datos.tiendas.find(t => t.id === TA).verificadores.length === 0);
    r = await adm('DELETE', '/configuracion/verificadores/999999');
    prueba('quitar uno que no existe → 404', r.status === 404);

    console.log('Roles y permisos');
    r = await adm('GET', '/configuracion/roles');
    const administrador = r.datos.roles.find(x => x.id === rolAdmin);
    prueba('lista los permisos del módulo y los roles con lo que tiene cada uno', r.status === 200 && r.datos.permisos.length === 7 && administrador.permisos.length === 7 && administrador.usuarios >= 1);
    rolPrueba = (await db.query("INSERT INTO roles (nombre, descripcion, activo) VALUES ('PRUEBA CFG rol', 'Rol de prueba', 1)", [], 'cfg:rol')).insertId;
    await db.query('INSERT INTO rol_permisos (rol_id, permiso_id) VALUES (?, ?)', [rolPrueba, permisoValesVer], 'cfg:rol_permiso_vales');
    r = await adm('PUT', `/configuracion/roles/${rolPrueba}`, { permisos: 'todos' });
    prueba('permisos que no son una lista → 400', r.status === 400);
    r = await adm('PUT', `/configuracion/roles/${rolPrueba}`, { permisos: ['incidencias.inventado'] });
    prueba('un permiso que no existe → 400', r.status === 400);
    r = await adm('PUT', '/configuracion/roles/999999', { permisos: [] });
    prueba('un rol que no existe → 404', r.status === 404);
    r = await adm('PUT', `/configuracion/roles/${rolPrueba}`, { permisos: ['incidencias.reportar', 'incidencias.resolver'] });
    const nuevoRol = r.datos && r.datos.roles && r.datos.roles.find(x => x.id === rolPrueba);
    prueba('al dar permisos, «Ver» se agrega solo y se avisa', r.status === 200 && nuevoRol.permisos.includes('incidencias.ver') && nuevoRol.permisos.includes('incidencias.resolver') && r.datos.agregados.includes('incidencias.ver'), JSON.stringify(nuevoRol));
    const conserva = await db.query('SELECT 1 FROM rol_permisos WHERE rol_id = ? AND permiso_id = ?', [rolPrueba, permisoValesVer], 'cfg:conserva');
    prueba('los permisos de otros módulos del rol se conservan', conserva.length === 1);
    r = await adm('PUT', `/configuracion/roles/${rolPrueba}`, { permisos: ['incidencias.ver'] });
    prueba('quitar permisos deja solo «Ver»', r.status === 200 && r.datos.roles.find(x => x.id === rolPrueba).permisos.join() === 'incidencias.ver');
    r = await adm('PUT', `/configuracion/roles/${rolPrueba}`, { permisos: [] });
    prueba('sin ningún permiso del módulo, el rol queda sin acceso', r.status === 200 && r.datos.roles.find(x => x.id === rolPrueba).permisos.length === 0 && (await db.query('SELECT 1 FROM rol_permisos WHERE rol_id = ? AND permiso_id = ?', [rolPrueba, permisoValesVer], 'cfg:conserva2')).length === 1);
    r = await adm('PUT', `/configuracion/roles/${rolAdmin}`, { permisos: ['incidencias.ver', 'incidencias.reportar'] });
    prueba('no se le quita «Configurar» al único rol que lo tiene → 409', r.status === 409 && /Al menos un rol/.test(r.datos.error), JSON.stringify(r.datos));
    r = await adm('PUT', `/configuracion/roles/${rolPrueba}`, { permisos: ['incidencias.configurar'] });
    prueba('otro rol puede recibir «Configurar»', r.status === 200);
    r = await adm('PUT', `/configuracion/roles/${rolAdmin}`, { permisos: ['incidencias.ver', 'incidencias.reportar'] });
    prueba('con otro rol que configure, ya se le puede quitar al Administrador', r.status === 200 && !r.datos.roles.find(x => x.id === rolAdmin).permisos.includes('incidencias.configurar'));
    r = await adm('PUT', `/configuracion/roles/${rolAdmin}`, { permisos: ['incidencias.ver', 'incidencias.reportar', 'incidencias.resolver', 'incidencias.verificar', 'incidencias.asignar', 'incidencias.ver_todas', 'incidencias.configurar'] });
    prueba('y se le devuelve todo', r.status === 200 && r.datos.roles.find(x => x.id === rolAdmin).permisos.length === 7);

    console.log('Historial y estado');
    r = await adm('GET', '/configuracion/historial?limite=100');
    const entidades = new Set(r.datos.cambios.map(c => c.entidad));
    prueba('cada cambio quedó anotado con quién lo hizo y cómo estaba antes', r.status === 200 && ['pais', 'categorias', 'prioridad', 'reglas_prioridad', 'parametros', 'tecnico', 'verificador', 'rol'].every(e => entidades.has(e)) && r.datos.cambios.every(c => c.creadoEn), [...entidades].join());
    prueba('el cambio de un país guarda el valor de antes y el de después', r.datos.cambios.some(c => c.entidad === 'pais' && c.antes && c.despues && c.antes.habilitado === false && c.despues.habilitado === true));
    r = await adm('GET', '/configuracion/estado');
    prueba('el estado general sigue respondiendo', r.status === 200 && r.datos.rolesQueConfiguran >= 1);
  } finally {
    servidor.close();
    if (incidenciaTemporal) await db.query('DELETE FROM incidencias WHERE id = ?', [incidenciaTemporal], 'cfg:limpiar_incidencia');
    await db.query("DELETE FROM incidencia_tipos_activo WHERE nombre LIKE 'PRUEBA CFG%'", [], 'cfg:limpiar_tipos');
    await db.query("DELETE FROM incidencia_categorias WHERE nombre LIKE 'PRUEBA CFG%'", [], 'cfg:limpiar_categorias');
    await db.query("DELETE FROM incidencia_zonas WHERE nombre LIKE 'PRUEBA CFG%'", [], 'cfg:limpiar_zonas');
    await db.query("DELETE FROM incidencia_motivos_espera WHERE nombre LIKE 'PRUEBA CFG%'", [], 'cfg:limpiar_motivos');
    await db.query("DELETE FROM incidencia_especialidades WHERE nombre LIKE 'PRUEBA CFG%'", [], 'cfg:limpiar_especialidades');
    await db.query('DELETE FROM incidencia_reglas_prioridad', [], 'cfg:limpiar_reglas');
    for (const rg of reglasAntes) await db.query('INSERT INTO incidencia_reglas_prioridad (impacto, prioridad_id) VALUES (?, ?)', [rg.impacto, rg.prioridad_id], 'cfg:restaurar_regla');
    await db.query("DELETE FROM incidencia_prioridades WHERE codigo = 'P5'", [], 'cfg:limpiar_p5');
    await db.query('DELETE FROM incidencia_tecnicos WHERE usuario_id IN (?)', [[U1, U2, U3]], 'cfg:limpiar_tecnicos');
    await db.query('DELETE FROM incidencia_verificadores WHERE usuario_id IN (?)', [[U1, U2, U3]], 'cfg:limpiar_verificadores');
    if (rolPrueba) {
      await db.query('DELETE FROM rol_permisos WHERE rol_id = ?', [rolPrueba], 'cfg:limpiar_rol_permisos');
      await db.query('DELETE FROM roles WHERE id = ?', [rolPrueba], 'cfg:limpiar_rol');
    }
    await db.query("DELETE FROM parametros_sistema WHERE clave LIKE 'incidencias.%'", [], 'cfg:limpiar_parametros');
    for (const a of ajustesAntes) await db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?)', [a.clave, a.valor], 'cfg:restaurar_parametro');
    for (const p of paisesAntes) await db.query('UPDATE incidencia_paises SET habilitado = ?, aviso = ? WHERE pais_id = ?', [p.habilitado, p.aviso, p.pais_id], 'cfg:restaurar_pais');
    await db.query("DELETE FROM incidencia_config_historial WHERE usuario_id = ?", [ADMIN], 'cfg:limpiar_historial');
    await db.query('INSERT IGNORE INTO rol_permisos (rol_id, permiso_id) SELECT ?, id FROM permisos WHERE modulo = ?', [rolAdmin, 'incidencias'], 'cfg:restaurar_admin');
  }
}

verificar()
  .then(() => { console.log(`\n${buenas} OK, ${malas} fallas`); process.exit(malas ? 1 : 0); })
  .catch((error) => { console.error('ERROR', error); process.exit(2); });
