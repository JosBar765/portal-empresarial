// scripts/proyectos/verificar-campos-alcance.js
// Verifica los campos propios (A6) y el alcance de usuarios por país (A7) de la fase 2c: pruebas puras de validación y,
// por HTTP, las rutas reales: altas y ediciones, clave inmutable, desactivar sin borrar datos, validación por tipo y por
// nicho, filtros, plantilla e importación con columnas propias, historial y cambio inmediato de lo que ve cada persona.
//
// Uso (base DESECHABLE con las migraciones aplicadas; crea datos de prueba y los borra al terminar):
//   node scripts/proyectos/verificar-campos-alcance.js
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/proyectos/routes');
const cp = require('../../src/modules/proyectos/camposPropios');

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};

const PERM_ASESOR = ['proyectos.ver', 'proyectos.clientes.registrar'];
const PERM_IMPORTA = [...PERM_ASESOR, 'proyectos.clientes.importar'];
const PERM_ADMIN = ['proyectos.ver', 'proyectos.administrar', 'proyectos.clientes.registrar', 'proyectos.corregir'];

function verificarPuras() {
  console.log('Claves y validación por tipo');
  prueba('la clave sale de la etiqueta sin acentos ni signos', cp.claveDe('¿Ya es cliente de Premia?') === 'ya_es_cliente_de_premia' && cp.claveDe('  Número de agencias ') === 'numero_de_agencias');
  prueba('una etiqueta sin letras da una clave válida', cp.claveDe('???') === 'campo' && cp.claveDe('2024 ventas') === 'c_2024_ventas');
  prueba('una clave no se reutiliza: si existe (activa o no) se agrega _2, _3…', cp.claveLibre('Camas', new Set(['camas'])) === 'camas_2' && cp.claveLibre('Camas', new Set(['camas', 'camas_2'])) === 'camas_3');
  prueba('la clave nunca pasa de 60 caracteres', cp.claveLibre('x'.repeat(100), new Set()).length <= 60);
  const num = { tipo: 'numero' };
  prueba('número: acepta 12, «12,5» y rechaza texto', cp.validarValor(num, 12).valor === 12 && cp.validarValor(num, '12,5').valor === 12.5 && !!cp.validarValor(num, 'doce').error && !!cp.validarValor(num, 1e15).error);
  const lista = { tipo: 'lista', opciones: ['Banco', 'Cooperativa'] };
  prueba('lista: acepta una opción (sin importar mayúsculas ni acentos) y rechaza otra', cp.validarValor(lista, 'cooperativa').valor === 'Cooperativa' && !!cp.validarValor(lista, 'Financiera').error);
  const sn = { tipo: 'si_no' };
  prueba('sí/no: acepta sí, no, true, 1, 0', cp.validarValor(sn, 'Sí').valor === true && cp.validarValor(sn, 'no').valor === false && cp.validarValor(sn, true).valor === true && cp.validarValor(sn, '1').valor === true && cp.validarValor(sn, 0).valor === false && !!cp.validarValor(sn, 'quizá').error);
  const fe = { tipo: 'fecha' };
  prueba('fecha: AAAA-MM-DD y DD/MM/AAAA, y rechaza las imposibles', cp.validarValor(fe, '2026-01-31').valor === '2026-01-31' && cp.validarValor(fe, '31/1/2026').valor === '2026-01-31' && !!cp.validarValor(fe, '2026-02-30').error && !!cp.validarValor(fe, 'mañana').error);
  prueba('texto: lo recorta y rechaza más de 255 caracteres', cp.validarValor({ tipo: 'texto' }, '  hola ').valor === 'hola' && !!cp.validarValor({ tipo: 'texto' }, 'x'.repeat(256)).error);
  prueba('vacío no es error por sí mismo', cp.validarValor(num, '').vacio === true && cp.validarValor(num, null).vacio === true);
  const defs = [
    { clave: 'todos', tipo: 'texto', nichoId: null, activo: true, obligatorio: false },
    { clave: 'banco_tipo', tipo: 'lista', opciones: ['A', 'B'], nichoId: 1, activo: true, obligatorio: true },
    { clave: 'camas', tipo: 'numero', nichoId: 2, activo: true, obligatorio: false },
    { clave: 'viejo', tipo: 'texto', nichoId: null, activo: false, obligatorio: true }
  ];
  let r = cp.validarDatosExtra(defs, { todos: 'x', camas: 5, banco_tipo: 'A', inventado: 'z', viejo: 'q' }, 1);
  prueba('solo cuentan los campos del nicho y los de todos; los de otro nicho, los inactivos y los desconocidos se ignoran', JSON.stringify(r.valores) === JSON.stringify({ todos: 'x', banco_tipo: 'A' }) && !Object.keys(r.errores).length, JSON.stringify(r));
  r = cp.validarDatosExtra(defs, {}, 1);
  prueba('un obligatorio sin valor da error con su clave; el inactivo no se exige', Object.keys(r.errores).join() === 'datosExtra.banco_tipo', JSON.stringify(r.errores));
  r = cp.validarDatosExtra(defs, { todos: 'nuevo' }, 2, { camas: 7, banco_tipo: 'A', viejo: 'guardado' });
  prueba('lo ya guardado se conserva (otro nicho o campo desactivado) y lo nuevo se suma', JSON.stringify(r.valores) === JSON.stringify({ camas: 7, banco_tipo: 'A', viejo: 'guardado', todos: 'nuevo' }), JSON.stringify(r.valores));
  r = cp.validarDatosExtra(defs, { todos: '' }, 2, { todos: 'antes' });
  prueba('mandar un valor vacío borra ese valor', r.valores.todos === undefined);
}

async function levantar() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: Number(req.headers['x-usuario']), permissions: (req.headers['x-permisos'] || '').split(',').filter(Boolean) };
    next();
  });
  app.use('/api/proyectos', requirePermission('proyectos.ver'), rutas);
  return new Promise(resolver => { const s = app.listen(0, '127.0.0.1', () => resolver(s)); });
}

async function verificarServicio() {
  const configService = require('../../src/modules/proyectos/services/configService');
  const inicio = (await db.query('SELECT NOW() - INTERVAL 2 SECOND AS t', [], 'cam:inicio'))[0].t;
  const ajustesAntes = await db.query('SELECT clave, valor FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'cam:ajustes_antes');
  const camposAntes = await db.query('SELECT id FROM proy_campos', [], 'cam:campos_antes');

  const pais = async (codigo) => (await db.query('SELECT id FROM paises WHERE codigo = ?', [codigo], 'cam:pais'))[0].id;
  const paisGT = await pais('GT');
  const paisSV = await pais('SV');
  const paisHN = await pais('HN');
  const asesorDe = async (paisId, saltar = 0) => (await db.query(
    `SELECT u.id FROM asesores a JOIN usuarios u ON u.id = a.usuario_id JOIN tiendas t ON t.id = a.tienda_id JOIN empresas e ON e.id = t.empresa_id
     WHERE e.pais_id = ? ORDER BY u.id LIMIT 1 OFFSET ?`, [paisId, saltar], 'cam:asesor'))[0].id;
  const asesorGT = await asesorDe(paisGT);
  const asesorGT2 = await asesorDe(paisGT, 1);
  const asesorSV = await asesorDe(paisSV);
  const [{ id: admin }] = await db.query('SELECT id FROM usuarios WHERE rol_id = 1 ORDER BY id LIMIT 1', [], 'cam:admin');
  const nicho = async (n) => (await db.query('SELECT id FROM proy_nichos WHERE nombre = ?', [n], 'cam:nicho'))[0].id;
  const nichoBancos = await nicho('Bancos y cooperativas');
  const nichoHospitales = await nicho('Hospitales');
  const [{ id: areaId }] = await db.query("SELECT id FROM proy_areas_contacto WHERE nombre = 'Compras'", [], 'cam:area');

  const servidor = await levantar();
  const base = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;
  const llamar = async (metodo, ruta, { usuario = admin, permisos = PERM_ADMIN, cuerpo } = {}) => {
    const res = await fetch(base + ruta, { method: metodo, headers: { 'content-type': 'application/json', 'x-usuario': String(usuario), 'x-permisos': permisos.join(',') }, body: cuerpo === undefined || metodo === 'GET' ? undefined : JSON.stringify(cuerpo) });
    return { status: res.status, datos: await res.json().catch(() => null), tipo: res.headers.get('content-type') };
  };
  const asesor = (cuerpo, metodo = 'POST', ruta = '/clientes', usuario = asesorGT) => llamar(metodo, ruta, { usuario, permisos: PERM_ASESOR, cuerpo });
  let n = 0;
  const NOMBRES = ['Aurora Norte', 'Bosque Verde', 'Cumbre Alta', 'Delta Sur', 'Esmeralda Real', 'Faro Azul', 'Granito Rojo', 'Horizonte Claro', 'Iris Dorado', 'Jade Imperial', 'Kiosco Central', 'Laguna Mansa'];
  const empresa = (extra = {}) => { n += 1; return { nombre: `CAM ${NOMBRES[(n - 1) % NOMBRES.length]}`, nichoId: nichoBancos, paisId: paisGT, ciudad: 'Cobán', telefono: `7${String(2000000 + n * 211)}`.slice(0, 8), contacto: { nombre: 'Ana', areaId }, ...extra }; };

  try {
    console.log('Permisos');
    prueba('sin proyectos.administrar no se ven los campos (403)', (await llamar('GET', '/config/campos', { permisos: PERM_ASESOR })).status === 403);
    prueba('ni se crean (403)', (await llamar('POST', '/config/campos', { permisos: PERM_ASESOR, cuerpo: { etiqueta: 'X', tipo: 'texto' } })).status === 403);
    prueba('ni se ve el alcance de usuarios (403)', (await llamar('GET', '/config/alcance', { permisos: PERM_ASESOR })).status === 403);

    console.log('Campos propios · definiciones');
    let r = await llamar('GET', '/config/campos');
    const semilla = r.datos.items.find(c => c.clave === 'ya_es_cliente');
    prueba('existe la semilla «¿Ya es cliente de Premia?» (sí/no, todos los nichos)', r.status === 200 && semilla && semilla.tipo === 'si_no' && semilla.nichoId === null && semilla.activo === true, JSON.stringify(r.datos));
    r = await llamar('POST', '/config/campos', { cuerpo: { etiqueta: '  ', tipo: 'texto' } });
    prueba('sin etiqueta → 400 con el campo marcado', r.status === 400 && !!r.datos.campos.etiqueta);
    r = await llamar('POST', '/config/campos', { cuerpo: { etiqueta: 'X', tipo: 'inventado' } });
    prueba('tipo inventado → 400', r.status === 400 && !!r.datos.campos.tipo);
    r = await llamar('POST', '/config/campos', { cuerpo: { etiqueta: 'Tipo de entidad', tipo: 'lista', nichoId: nichoBancos, opciones: ['Solo una'] } });
    prueba('una lista con una sola opción → 400', r.status === 400 && !!r.datos.campos.opciones);
    r = await llamar('POST', '/config/campos', { cuerpo: { etiqueta: 'Tipo de entidad', tipo: 'lista', nichoId: 999999, opciones: ['A', 'B'] } });
    prueba('un nicho que no existe → 400', r.status === 400 && !!r.datos.campos.nichoId);
    r = await llamar('POST', '/config/campos', { cuerpo: { etiqueta: 'CAM Tipo de entidad', tipo: 'lista', nichoId: nichoBancos, opciones: ['Banco', 'Cooperativa', 'Banco'], obligatorio: true, visibleEnLista: true } });
    const tipoEntidad = r.datos.item;
    prueba('crea un campo de lista obligatorio con clave generada, orden y opciones sin repetir', r.status === 201 && tipoEntidad.clave === 'cam_tipo_de_entidad' && tipoEntidad.obligatorio && tipoEntidad.visibleEnLista && tipoEntidad.opciones.join() === 'Banco,Cooperativa' && tipoEntidad.activo, JSON.stringify(r.datos));
    r = await llamar('POST', '/config/campos', { cuerpo: { etiqueta: 'CAM Número de agencias', tipo: 'numero', nichoId: nichoBancos, visibleEnLista: true } });
    const agencias = r.datos.item;
    r = await llamar('POST', '/config/campos', { cuerpo: { etiqueta: 'CAM Camas', tipo: 'numero', nichoId: nichoHospitales } });
    const camas = r.datos.item;
    r = await llamar('POST', '/config/campos', { cuerpo: { etiqueta: 'CAM Fecha de apertura', tipo: 'fecha' } });
    const apertura = r.datos.item;
    r = await llamar('POST', '/config/campos', { cuerpo: { etiqueta: 'CAM Tipo de entidad', tipo: 'texto' } });
    prueba('una etiqueta repetida genera otra clave (_2), nunca reutiliza la anterior', r.status === 201 && r.datos.item.clave === 'cam_tipo_de_entidad_2', JSON.stringify(r.datos));
    r = await llamar('PUT', `/config/campos/${tipoEntidad.id}`, { cuerpo: { etiqueta: 'CAM Tipo de entidad (nuevo nombre)', opciones: ['Banco', 'Cooperativa', 'Financiera'] } });
    prueba('editar cambia la etiqueta y las opciones pero la clave sigue igual', r.status === 200 && r.datos.item.clave === 'cam_tipo_de_entidad' && r.datos.item.opciones.length === 3 && /nuevo nombre/.test(r.datos.item.etiqueta), JSON.stringify(r.datos));
    r = await llamar('PUT', `/config/campos/${tipoEntidad.id}`, { cuerpo: { tipo: 'texto' } });
    prueba('el tipo no se puede cambiar', r.status === 400 && !!r.datos.campos.tipo);
    prueba('un campo que no existe → 404', (await llamar('PUT', '/config/campos/999999', { cuerpo: { etiqueta: 'X' } })).status === 404);

    console.log('Campos propios · formulario, ficha y lista');
    r = await asesor(null, 'GET', '/clientes/opciones');
    prueba('las opciones traen los campos propios activos para el formulario', r.status === 200 && ['cam_tipo_de_entidad', 'cam_camas', 'ya_es_cliente'].every(c => r.datos.campos.some(x => x.clave === c)));
    r = await asesor(empresa({ datosExtra: { ya_es_cliente: true } }));
    prueba('un obligatorio del nicho sin valor impide guardar (400, marcado como datosExtra.<clave>)', r.status === 400 && r.datos.campos['datosExtra.cam_tipo_de_entidad'], JSON.stringify(r.datos));
    r = await asesor(empresa({ datosExtra: { cam_tipo_de_entidad: 'Estafa', cam_numero_de_agencias: 'doce' } }));
    prueba('valores inválidos por tipo se marcan por campo', r.status === 400 && r.datos.campos['datosExtra.cam_tipo_de_entidad'] === 'Elige una de las opciones.' && r.datos.campos['datosExtra.cam_numero_de_agencias'] === 'Escribe un número.', JSON.stringify(r.datos));
    const e1 = empresa({ datosExtra: { cam_tipo_de_entidad: 'cooperativa', cam_numero_de_agencias: '12', ya_es_cliente: true, cam_fecha_de_apertura: '31/01/2020', cam_camas: 99, inventado: 'x' } });
    r = await asesor(e1);
    const creada = r.datos;
    prueba('guarda los valores tipados; ignora los de otro nicho y los desconocidos',
      r.status === 201 && creada.datosExtra.cam_tipo_de_entidad === 'Cooperativa' && creada.datosExtra.cam_numero_de_agencias === 12 && creada.datosExtra.ya_es_cliente === true
      && creada.datosExtra.cam_fecha_de_apertura === '2020-01-31' && creada.datosExtra.cam_camas === undefined && creada.datosExtra.inventado === undefined, JSON.stringify(r.datos));
    prueba('la ficha trae los campos del nicho con su texto (Sí/No, fecha DD/MM/AAAA)',
      creada.datosNicho.some(d => d.clave === 'ya_es_cliente' && d.texto === 'Sí') && creada.datosNicho.some(d => d.clave === 'cam_fecha_de_apertura' && d.texto === '31/01/2020') && !creada.datosNicho.some(d => d.clave === 'cam_camas'));
    const e2 = await asesor(empresa({ nichoId: nichoHospitales, datosExtra: { cam_camas: 80, ya_es_cliente: false } }));
    prueba('un campo de otro nicho (Hospitales) se pide y se guarda solo ahí; el obligatorio de Bancos no se exige', e2.status === 201 && e2.datos.datosExtra.cam_camas === 80 && e2.datos.datosExtra.ya_es_cliente === false, JSON.stringify(e2.datos));
    r = await asesor(null, 'GET', '/clientes?busqueda=CAM%20');
    prueba('la lista trae las columnas visibles y el valor de cada empresa (vacío si el campo no aplica a su nicho)',
      r.datos.columnasExtra.map(c => c.clave).sort().join() === 'cam_numero_de_agencias,cam_tipo_de_entidad' && r.datos.items.find(i => i.id === creada.id).extras.cam_numero_de_agencias === '12'
      && r.datos.items.find(i => i.id === e2.datos.id).extras.cam_numero_de_agencias === '', JSON.stringify(r.datos.columnasExtra));
    r = await asesor(null, 'GET', '/clientes?busqueda=CAM%20&extra_ya_es_cliente=si');
    prueba('filtrar por un campo sí/no trae solo los «sí»', r.datos.items.length === 1 && r.datos.items[0].id === creada.id, JSON.stringify(r.datos.items.map(i => i.id)));
    r = await asesor(null, 'GET', '/clientes?busqueda=CAM%20&extra_ya_es_cliente=no');
    prueba('…y los «no»', r.datos.items.length === 1 && r.datos.items[0].id === e2.datos.id);
    r = await asesor(null, 'GET', '/clientes?busqueda=CAM%20&extra_cam_tipo_de_entidad=Cooperativa');
    prueba('filtrar por un campo de lista', r.datos.items.length === 1 && r.datos.items[0].id === creada.id);
    r = await asesor(null, 'GET', "/clientes?busqueda=CAM%20&extra_ya_es_cliente=si'%20OR%201=1--");
    prueba('un valor de filtro malicioso no cambia nada (se ignora)', r.status === 200 && r.datos.items.length === 2, JSON.stringify(r.datos));
    r = await asesor({ datosExtra: { cam_numero_de_agencias: 20 } }, 'PUT', `/clientes/${creada.id}`);
    prueba('editar un campo propio conserva los demás', r.status === 200 && r.datos.datosExtra.cam_numero_de_agencias === 20 && r.datos.datosExtra.cam_tipo_de_entidad === 'Cooperativa' && r.datos.datosExtra.ya_es_cliente === true, JSON.stringify(r.datos));

    console.log('Campos propios · desactivar no borra datos');
    r = await llamar('PATCH', `/config/campos/${agencias.id}/activo`, { cuerpo: { activo: false } });
    prueba('desactivar un campo responde 200 y queda inactivo', r.status === 200 && r.datos.item.activo === false);
    r = await asesor(null, 'GET', `/clientes/${creada.id}`);
    prueba('la ficha deja de mostrarlo, pero el dato sigue guardado', !r.datos.datosNicho.some(d => d.clave === 'cam_numero_de_agencias') && r.datos.datosExtra.cam_numero_de_agencias === 20);
    r = await asesor({ ciudad: 'Antigua' }, 'PUT', `/clientes/${creada.id}`);
    prueba('editar la empresa con el campo desactivado no le borra el dato', r.status === 200 && r.datos.datosExtra.cam_numero_de_agencias === 20);
    await llamar('PATCH', `/config/campos/${agencias.id}/activo`, { cuerpo: { activo: true } });
    r = await asesor(null, 'GET', `/clientes/${creada.id}`);
    prueba('al reactivarlo, el dato vuelve', r.datos.datosNicho.some(d => d.clave === 'cam_numero_de_agencias' && d.valor === 20));
    r = await llamar('GET', '/config/campos');
    prueba('la lista de A6 cuenta cuántas empresas tienen cada campo', r.datos.items.find(c => c.id === tipoEntidad.id).usos >= 1 && r.datos.items.find(c => c.id === camas.id).usos >= 1);

    console.log('Historial');
    r = await llamar('GET', '/config/historial?area=campos');
    prueba('cada cambio de un campo queda en el historial (crear, editar, desactivar, activar) con quién y antes/después',
      r.status === 200 && r.datos.items.length >= 7 && r.datos.items.some(i => i.accionCodigo === 'editar' && i.cambios.some(c => c.campo === 'Etiqueta')) && r.datos.items.some(i => i.accionCodigo === 'desactivar') && r.datos.items.every(i => i.area === 'Campos propios'), JSON.stringify(r.datos.items.slice(0, 2)));

    console.log('Importación con columnas propias');
    const plantilla = await (await fetch(`${base}/clientes/importar/plantilla`, { headers: { 'x-usuario': String(asesorGT), 'x-permisos': PERM_IMPORTA.join(',') } })).text();
    const cabecera = plantilla.replace(/^﻿/, '').split('\r\n')[0].split(',');
    prueba('la plantilla suma una columna por cada campo propio activo', ['cam_tipo_de_entidad', 'cam_numero_de_agencias', 'ya_es_cliente', 'cam_camas'].every(c => cabecera.includes(c)), cabecera.join());
    const subir = async (contenido, ruta, usuario = asesorGT) => {
      const form = new FormData();
      form.append('archivo', new Blob([contenido], { type: 'text/csv' }), 'e.csv');
      if (ruta.endsWith('confirmar')) { form.append('duplicadas', 'omitir'); form.append('idempotencyKey', `cam-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`); }
      const res = await fetch(`${base}/clientes/importar/${ruta}`, { method: 'POST', headers: { 'x-usuario': String(usuario), 'x-permisos': PERM_IMPORTA.join(',') }, body: form });
      return { status: res.status, datos: await res.json() };
    };
    const csv = [
      'empresa,nicho,pais,ciudad,telefono,contacto_nombre,contacto_area,cam_tipo_de_entidad,ya_es_cliente,cam_fecha_de_apertura',
      'CAM Imp Uno,Bancos y cooperativas,Guatemala,Cobán,7766 2001,Ana,Compras,Banco,sí,15/03/2019',
      'CAM Imp Dos,Bancos y cooperativas,Guatemala,Cobán,7766 2002,Ana,Compras,,no,',
      'CAM Imp Tres,Bancos y cooperativas,Guatemala,Cobán,7766 2003,Ana,Compras,Estafa,quizá,2019-02-30'
    ].join('\n');
    r = await subir(csv, 'previsualizar');
    const fila = (l) => r.datos.filas.find(f => f.linea === l);
    prueba('la vista previa valida los campos propios por fila (obligatorio faltante, opción inválida, sí/no y fecha inválidos)',
      r.status === 200 && fila(2).estado === 'nueva' && fila(3).estado === 'error' && /obligatorio|Elige/.test(fila(3).errores.cam_tipo_de_entidad || '')
      && fila(4).estado === 'error' && !!fila(4).errores.cam_tipo_de_entidad && !!fila(4).errores.ya_es_cliente && !!fila(4).errores.cam_fecha_de_apertura, JSON.stringify(r.datos.filas.map(f => [f.linea, f.estado, f.errores])));
    r = await subir(csv, 'confirmar');
    const importada = (await db.query("SELECT datos_extra FROM proy_clientes WHERE nombre = 'CAM Imp Uno'", [], 'cam:importada'))[0];
    const extraImportada = typeof importada.datos_extra === 'string' ? JSON.parse(importada.datos_extra) : importada.datos_extra;
    prueba('al confirmar se guardan los valores tipados de la fila válida', r.status === 200 && r.datos.creadas === 1 && extraImportada.cam_tipo_de_entidad === 'Banco' && extraImportada.ya_es_cliente === true && extraImportada.cam_fecha_de_apertura === '2019-03-15', JSON.stringify([r.datos, extraImportada]));

    console.log('Alcance de usuarios');
    r = await llamar('GET', '/config/alcance');
    const fila1 = (id) => r.datos.items.find(p => p.id === id);
    prueba('lista a las personas con su rol, tienda, país por defecto y países efectivos', r.status === 200 && fila1(asesorGT) && fila1(asesorGT).paisesPorDefecto.map(p => p.id).join() === String(paisGT) && fila1(asesorGT).efectivos.length === 1 && r.datos.roles.length >= 2 && r.datos.paises.length >= 6, JSON.stringify(fila1(asesorGT)));
    prueba('permite buscar por nombre, y filtrar por rol y por país',
      (await llamar('GET', `/config/alcance?busqueda=${encodeURIComponent(fila1(asesorGT).nombre.split(' ')[0].toUpperCase())}`)).datos.items.some(p => p.id === asesorGT)
      && (await llamar('GET', `/config/alcance?rol=${fila1(asesorGT).rolId}`)).datos.items.every(p => p.rolId === fila1(asesorGT).rolId)
      && (await llamar('GET', `/config/alcance?pais=${paisSV}`)).datos.items.every(p => p.efectivos.some(e => e.id === paisSV)));
    prueba('guardar sin países → 400', (await llamar('PUT', `/config/alcance/${asesorGT}`, { cuerpo: { paises: [] } })).status === 400);
    prueba('con un país inexistente → 400', (await llamar('PUT', `/config/alcance/${asesorGT}`, { cuerpo: { paises: [999999] } })).status === 400);
    prueba('una persona que no existe → 404', (await llamar('PUT', '/config/alcance/999999', { cuerpo: { paises: [paisGT] } })).status === 404);
    const noVeia = await asesor(null, 'GET', '/clientes?busqueda=CAM%20', asesorSV);
    prueba('antes del cambio, el asesor de El Salvador no ve las empresas de Guatemala', noVeia.datos.items.length === 0);
    prueba('antes del cambio, tampoco puede abrir una por su identificador (404)', (await asesor(null, 'GET', `/clientes/${creada.id}`, asesorSV)).status === 404);
    r = await llamar('PUT', `/config/alcance/${asesorSV}`, { cuerpo: { paises: [paisSV, paisGT] } });
    prueba('agregarle Guatemala guarda solo la excepción', r.status === 200 && r.datos.item.agregados.map(p => p.id).join() === String(paisGT) && r.datos.item.efectivos.length === 2, JSON.stringify(r.datos));
    prueba('y de inmediato ve las empresas de Guatemala', (await asesor(null, 'GET', '/clientes?busqueda=CAM%20', asesorSV)).datos.items.length >= 3 && (await asesor(null, 'GET', `/clientes/${creada.id}`, asesorSV)).status === 200);
    prueba('también puede registrar en Guatemala', (await asesor(empresa({ datosExtra: { cam_tipo_de_entidad: 'Banco' } }), 'POST', '/clientes', asesorSV)).status === 201);
    r = await llamar('PUT', `/config/alcance/${asesorSV}`, { cuerpo: { paises: [paisGT] } });
    prueba('quitarle El Salvador deja solo Guatemala (excepción «quitar» + «agregar»)', r.status === 200 && r.datos.item.quitados.map(p => p.id).join() === String(paisSV) && r.datos.item.efectivos.map(p => p.id).join() === String(paisGT));
    prueba('y de inmediato deja de ver El Salvador', !(await asesor(null, 'GET', '/clientes?pais=' + paisSV, asesorSV)).datos.items.length);
    r = await llamar('PUT', `/config/alcance/${asesorSV}`, { cuerpo: { paises: [paisSV] } });
    prueba('volver al país de su tienda borra las excepciones (solo se guardan diferencias)', r.status === 200 && !r.datos.item.agregados.length && !r.datos.item.quitados.length && Number((await db.query('SELECT COUNT(*) AS n FROM proy_usuario_paises WHERE usuario_id = ?', [asesorSV], 'cam:excep'))[0].n) === 0);
    await llamar('PUT', `/config/alcance/${asesorGT2}`, { cuerpo: { paises: [paisGT, paisHN] } });
    r = await llamar('GET', '/config/historial?area=alcance');
    prueba('cada cambio de alcance queda en el historial con la persona y los países agregados o quitados', r.status === 200 && r.datos.items.length >= 3 && r.datos.items.every(i => i.area === 'Alcance de usuarios') && r.datos.items.some(i => i.cambios.some(c => c.campo === 'Países agregados' && /Guatemala/.test(c.despues))), JSON.stringify(r.datos.items.slice(0, 2)));
  } finally {
    // Limpieza, pase lo que pase: nada de esta prueba debe quedar en la base.
    await db.query("DELETE FROM proy_clientes WHERE (creado_en >= ?) AND nombre LIKE 'CAM %'", [inicio], 'cam:limpiar_clientes');
    await db.query('DELETE FROM proy_importaciones WHERE creado_en >= ?', [inicio], 'cam:limpiar_importaciones');
    await db.query("DELETE FROM idempotency_keys WHERE idempotency_key LIKE 'proy-import:%' AND creado_en >= ?", [inicio], 'cam:limpiar_claves');
    await db.query('DELETE FROM proy_usuario_paises WHERE usuario_id IN (?)', [[asesorGT, asesorGT2, asesorSV]], 'cam:limpiar_alcance');
    const ids = camposAntes.map(c => c.id);
    await db.query(`DELETE FROM proy_campos WHERE ${ids.length ? 'id NOT IN (?)' : '1 = 1'}`, ids.length ? [ids] : [], 'cam:limpiar_campos');
    await db.query('DELETE FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'cam:limpiar_ajustes');
    for (const { clave, valor } of ajustesAntes) await db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?)', [clave, valor], 'cam:restaurar_ajuste');
    await db.query('DELETE FROM proy_config_historial WHERE creado_en >= ?', [inicio], 'cam:limpiar_historial');
    configService.invalidar();
    servidor.close();
  }
}

(async () => {
  verificarPuras();
  await db.listo;
  await verificarServicio();
  console.log(malas ? `\n${malas} verificación(es) fallaron (${buenas} correctas).` : `\nTodo correcto (${buenas} verificaciones).`);
  process.exit(malas ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
