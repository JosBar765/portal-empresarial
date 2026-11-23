// scripts/proyectos/verificar-clientes.js
// Verifica las empresas de la base global (fase 2a): teléfono, nombre y duplicados (pruebas puras), y por HTTP las
// rutas reales con distintos roles y países: crear, buscar, editar, duplicados, alcance por país, estados y contactos.
//
// Uso (base DESECHABLE con las migraciones aplicadas; crea empresas de prueba y las borra al terminar):
//   node scripts/proyectos/verificar-clientes.js
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/proyectos/routes');
const telefonos = require('../../src/modules/proyectos/telefonos');
const duplicados = require('../../src/modules/proyectos/duplicados');

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};

const PERM_ASESOR = ['proyectos.ver', 'proyectos.clientes.registrar'];
const PERM_SUPERVISOR = [...PERM_ASESOR, 'proyectos.clientes.importar', 'proyectos.corregir'];
const PERM_GERENTE = ['proyectos.ver', 'proyectos.ver_gerencia'];
const PERM_ADMIN = ['proyectos.ver', 'proyectos.administrar', 'proyectos.clientes.registrar', 'proyectos.corregir'];

function verificarPuras() {
  console.log('Teléfonos');
  const gt = { nombre: 'Guatemala', prefijoTelefono: '+502', formatoTelefono: '#### ####' };
  const bz = { nombre: 'Belice', prefijoTelefono: '+501', formatoTelefono: '### ####' };
  for (const entrada of ['7765 4400', '+502 7765 4400', '502-7765-4400', '50277654400', '00502 7765 4400']) {
    prueba(`«${entrada}» queda como +50277654400`, telefonos.normalizar(entrada, gt).telefono === '+50277654400');
  }
  prueba('un teléfono con pocos dígitos dice cuántos hacen falta', telefonos.normalizar('7766-12', gt).error === 'Formato inválido: usa +502 y 8 dígitos.');
  prueba('el prefijo de otro país se rechaza', /no es de Guatemala/.test(telefonos.normalizar('+503 2222 3333', gt).error));
  prueba('las letras se rechazan', !telefonos.normalizar('77a5 4400', gt).ok);
  prueba('vacío se rechaza', !telefonos.normalizar('  ', gt).ok);
  const sv = { nombre: 'El Salvador', prefijoTelefono: '+503', formatoTelefono: '#### ####' };
  const todos = [gt, sv, bz];
  prueba('con el prefijo de otro país elegido a propósito se valida con las reglas de ese país', telefonos.normalizar('+503 2222 3344', gt, todos).telefono === '+50322223344');
  prueba('…y si el número no cumple el formato de ese país, se rechaza con su prefijo', telefonos.normalizar('+503 2222 33', gt, todos).error === 'Formato inválido: usa +503 y 8 dígitos.');
  prueba('un prefijo que no es de ningún país configurado se rechaza', !telefonos.normalizar('+999 2222 3344', gt, todos).ok);
  prueba('se muestra con el formato del país del prefijo', telefonos.formatear('+50322223344', gt, todos) === '+503 2222 3344');
  prueba('Belice usa 7 dígitos', telefonos.normalizar('222 3344', bz).telefono === '+5012223344');
  prueba('se muestra con el formato del país', telefonos.formatear('+50277654400', gt) === '+502 7765 4400' && telefonos.formatear('+5012223344', bz) === '+501 222 3344');

  console.log('Nombres y duplicados');
  prueba('quita acentos, puntuación y términos legales', duplicados.normalizarNombre('Cooperativa Guayacán, R.L.') === 'cooperativa guayacan');
  prueba('«&» se lee como «y»', duplicados.normalizarNombre('Banco G&T Continental, S.A.') === 'banco g y t continental');
  prueba('nombres equivalentes se parecen al 100 %', duplicados.similitud(duplicados.normalizarNombre('Cooperativa Guayacán R.L.'), duplicados.normalizarNombre('cooperativa guayacan')) === 100);
  prueba('empresas distintas se parecen poco', duplicados.similitud('banco del norte', 'cooperativa unidos') < 40);
  prueba('un nombre contenido en otro (2+ palabras) pasa de 90', duplicados.similitud('banrural escuintla', 'banrural agencia escuintla') >= 90);
  const candidatos = [
    { id: 1, nombre: 'Cooperativa Guayacán R.L.', nombre_normalizado: 'cooperativa guayacan', ciudad: 'Quetzaltenango', telefono: '+50277654400', pais_id: 1 },
    { id: 2, nombre: 'Cooperativa Guayacán', nombre_normalizado: 'cooperativa guayacan', ciudad: 'Cobán', telefono: '+50277000000', pais_id: 1 }
  ];
  const nuevo = { nombre: 'Cooperativa Guayacán', ciudad: 'Quetzaltenango', telefono: '+50277654400', paisId: 1 };
  const todas = duplicados.coincidencias(nuevo, candidatos);
  prueba('detecta por nombre y ciudad, y por teléfono', todas.length === 1 && todas[0].cliente.id === 1 && todas[0].razones.includes('telefono') && todas[0].razones.includes('nombre_ciudad'));
  prueba('mismo nombre en otra ciudad no es duplicado', !duplicados.coincidencias({ ...nuevo, telefono: '+50200000000' }, candidatos).some(c => c.cliente.id === 2));
  prueba('si falta una ciudad, el nombre igual sí avisa', duplicados.coincidencias({ ...nuevo, ciudad: '', telefono: null }, candidatos).length === 2);
  prueba('apagar el criterio de teléfono lo ignora', !duplicados.coincidencias({ ...nuevo, nombre: 'Otra cosa' }, candidatos, { porTelefono: false }).length);
  prueba('apagar el criterio de nombre lo ignora', !duplicados.coincidencias({ ...nuevo, telefono: null }, candidatos, { porNombreCiudad: false }).length);
  prueba('el mismo nombre en otro país no avisa', !duplicados.coincidencias({ ...nuevo, paisId: 2, telefono: null }, candidatos).length);
}

async function levantar() {
  const app = express();
  app.use(express.json());
  // Autenticación de prueba: quién es y qué permisos tiene llegan en cabeceras, como llegarían en el token.
  app.use((req, res, next) => {
    req.user = { id: Number(req.headers['x-usuario']), permissions: (req.headers['x-permisos'] || '').split(',').filter(Boolean) };
    next();
  });
  app.use('/api/proyectos', requirePermission('proyectos.ver'), rutas);
  return new Promise(resolver => { const s = app.listen(0, '127.0.0.1', () => resolver(s)); });
}

async function verificarServicio() {
  const configService = require('../../src/modules/proyectos/services/configService');
  const inicio = (await db.query('SELECT NOW() - INTERVAL 2 SECOND AS t', [], 'cli:inicio'))[0].t;
  const ajustesAntes = await db.query('SELECT clave, valor FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'cli:ajustes_antes');

  const pais = async (codigo) => (await db.query('SELECT id FROM paises WHERE codigo = ?', [codigo], 'cli:pais'))[0].id;
  const paisGT = await pais('GT');
  const paisSV = await pais('SV');
  const asesorDe = async (paisId, excluir = 0) => (await db.query(
    `SELECT u.id FROM asesores a JOIN usuarios u ON u.id = a.usuario_id JOIN tiendas t ON t.id = a.tienda_id JOIN empresas e ON e.id = t.empresa_id
     WHERE e.pais_id = ? AND u.id <> ? ORDER BY u.id LIMIT 1`, [paisId, excluir], 'cli:asesor'))[0].id;
  const asesorGT = await asesorDe(paisGT);
  const asesorSV = await asesorDe(paisSV);
  const [{ id: supervisor }] = await db.query(`SELECT st.usuario_id AS id FROM supervisor_tiendas st JOIN tiendas t ON t.id = st.tienda_id JOIN empresas e ON e.id = t.empresa_id
     WHERE e.pais_id = ? GROUP BY st.usuario_id HAVING COUNT(DISTINCT e.pais_id) >= 1 ORDER BY st.usuario_id LIMIT 1`, [paisSV], 'cli:supervisor');
  const [{ id: admin }] = await db.query('SELECT id FROM usuarios WHERE rol_id = 1 ORDER BY id LIMIT 1', [], 'cli:admin');
  const gerente = admin;
  const [{ id: nichoId }] = await db.query("SELECT id FROM proy_nichos WHERE nombre = 'Bancos y cooperativas'", [], 'cli:nicho');
  const [{ id: nichoOtroId }] = await db.query("SELECT id FROM proy_nichos WHERE nombre = 'Hospitales'", [], 'cli:nicho2');
  const [{ id: areaId }] = await db.query("SELECT id FROM proy_areas_contacto WHERE nombre = 'Compras'", [], 'cli:area');
  const [{ id: motivoId }] = await db.query("SELECT id FROM proy_motivos_no_contactar WHERE nombre = 'El cliente lo pidió'", [], 'cli:motivo');

  const servidor = await levantar();
  const base = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;
  const llamar = async (metodo, ruta, { usuario = asesorGT, permisos = PERM_ASESOR, cuerpo } = {}) => {
    const res = await fetch(base + ruta, {
      method: metodo,
      headers: { 'content-type': 'application/json', 'x-usuario': String(usuario), 'x-permisos': permisos.join(',') },
      body: cuerpo === undefined || metodo === 'GET' ? undefined : JSON.stringify(cuerpo)
    });
    return { status: res.status, datos: await res.json().catch(() => null) };
  };

  let n = 0;
  const NOMBRES = ['Colegio Montessori Aurora', 'Hospital Santa Lucía Norte', 'Farmacia Vida Plena', 'Gasolinera El Trébol', 'Banco Industrial del Sur',
    'Universidad Mesoamericana Centro', 'Gimnasio Fuerza Total', 'Hostal Casa Colonial', 'Librería Cervantes', 'Funeraria Los Olivos', 'Restaurante Sabor Chapín'];
  const empresa = (extra = {}) => {
    n += 1;
    return {
      nombre: NOMBRES[(n - 1) % NOMBRES.length] + (n > NOMBRES.length ? ` ${'Z'.repeat(n)}` : ''), nichoId, paisId: paisGT, ciudad: 'Quetzaltenango',
      telefono: `7${String(1000000 + n * 137)}`.slice(0, 8), direccion: '3a avenida 4-56', sitioWeb: 'ejemplo.com',
      contacto: { nombre: 'Carolina Méndez', areaId, telefono: '2234 5678', correo: 'carolina@example.com' }, ...extra
    };
  };

  try {
    console.log('Permisos');
    let r = await llamar('POST', '/clientes', { permisos: ['proyectos.ver'], cuerpo: empresa() });
    prueba('sin proyectos.clientes.registrar no se crea (403)', r.status === 403);
    prueba('con solo proyectos.ver sí se lee', (await llamar('GET', '/clientes', { permisos: ['proyectos.ver'] })).status === 200);
    prueba('sin proyectos.ver no se entra', (await llamar('GET', '/clientes', { permisos: [] })).status === 403);

    console.log('Opciones y alcance');
    r = await llamar('GET', '/clientes/opciones');
    prueba('un asesor de Guatemala solo ve su país y los catálogos activos', r.status === 200 && r.datos.paises.map(p => p.codigo).join() === 'GT'
      && r.datos.nichos.length >= 17 && r.datos.areas.length === 7 && r.datos.motivosNoContactar.length === 4 && r.datos.permisos.registrar === true && r.datos.permisos.reactivar === false,
      JSON.stringify(r.datos && r.datos.paises));
    prueba('el selector de teléfono trae los prefijos de todos los países, no solo los del alcance', r.datos.prefijos.length >= 6 && r.datos.prefijos.some(p => p.codigo === 'SV' && p.prefijoTelefono === '+503'), JSON.stringify(r.datos.prefijos));
    r = await llamar('GET', '/clientes/opciones', { usuario: gerente, permisos: PERM_GERENTE });
    prueba('el gerente ve todos los países y no puede registrar', r.datos.paises.length >= 6 && r.datos.permisos.registrar === false);
    r = await llamar('GET', '/clientes/opciones', { usuario: supervisor, permisos: PERM_SUPERVISOR });
    prueba('un supervisor ve los países de sus tiendas (no los de otras)', r.datos.paises.length >= 2 && !r.datos.paises.some(p => p.codigo === 'GT') && r.datos.permisos.reactivar === true);

    console.log('Crear y validar');
    const primera = empresa({ nombre: 'Cooperativa Guayacán R.L.', telefono: '7765 4400' });
    r = await llamar('POST', '/clientes', { cuerpo: primera });
    const creada = r.datos;
    prueba('crear responde 201 con la ficha, su contacto principal y el teléfono con formato',
      r.status === 201 && creada.estado === 'activa' && creada.telefono === '+50277654400' && creada.telefonoTexto === '+502 7765 4400'
      && creada.contactos.length === 1 && creada.contactos[0].principal === true && creada.contactos[0].telefonoTexto === '+502 2234 5678'
      && creada.sitioWeb === 'https://ejemplo.com' && creada.tiendaOrigen, JSON.stringify(creada).slice(0, 300));
    r = await llamar('POST', '/clientes', { cuerpo: { ...empresa(), nombre: '  ', telefono: '7766-12', nichoId: 999999, paisId: paisSV } });
    prueba('los datos malos responden 400 con cada campo marcado', r.status === 400 && r.datos.campos.nombre && r.datos.campos.telefono && r.datos.campos.nichoId && r.datos.campos.paisId, JSON.stringify(r.datos));
    prueba('un país fuera del alcance dice «solo registras empresas de tus países»', r.datos.campos.paisId === 'Solo registras empresas de tus países.');
    r = await llamar('POST', '/clientes', { cuerpo: { ...empresa(), contacto: undefined } });
    prueba('sin contacto se rechaza mientras el ajuste lo exija', r.status === 400 && !!r.datos.campos['contacto.nombre']);
    r = await llamar('POST', '/clientes', { cuerpo: { ...empresa(), contacto: { nombre: 'Luis', areaId: 999999, correo: 'no-es-correo' } } });
    prueba('un contacto con área inexistente y correo inválido marca ambos', r.status === 400 && r.datos.campos['contacto.areaId'] && r.datos.campos['contacto.correo']);
    r = await llamar('POST', '/clientes', { cuerpo: { ...empresa(), sitioWeb: 'esto no es una web' } });
    prueba('un sitio web inválido se rechaza', r.status === 400 && !!r.datos.campos.sitioWeb);

    console.log('Duplicados');
    r = await llamar('POST', '/clientes', { cuerpo: { ...empresa({ nombre: 'Cooperativa Guayacán', telefono: '7765 4400' }) } });
    prueba('el mismo nombre, ciudad y teléfono responde 409 con las coincidencias',
      r.status === 409 && r.datos.codigo === 'POSIBLE_DUPLICADO' && r.datos.duplicados[0].id === creada.id
      && r.datos.duplicados[0].razones.includes('nombre_ciudad') && r.datos.duplicados[0].razones.includes('telefono'), JSON.stringify(r.datos));
    r = await llamar('POST', '/clientes', { cuerpo: { ...empresa({ nombre: 'Distribuidora Los Pinos', telefono: '7765 4400' }) } });
    prueba('solo el mismo teléfono también avisa', r.status === 409 && r.datos.duplicados[0].razones.join() === 'telefono');
    r = await llamar('POST', '/clientes', { cuerpo: { ...empresa({ nombre: 'Cooperativa Guayacán', telefono: '7765 4401', ciudad: 'Cobán' }) } });
    prueba('el mismo nombre en otra ciudad y con otro teléfono no es duplicado', r.status === 201);
    r = await llamar('POST', '/clientes/duplicados', { cuerpo: { nombre: 'cooperativa guayacan', ciudad: 'quetzaltenango', telefono: '', paisId: paisGT } });
    prueba('revisar mientras se escribe encuentra la empresa sin acentos ni mayúsculas', r.status === 200 && r.datos.duplicados.some(d => d.id === creada.id));
    r = await llamar('POST', '/clientes', { cuerpo: { ...empresa({ nombre: 'Cooperativa Guayacán', telefono: '7765 4400' }), confirmarDuplicado: true } });
    prueba('«es otra empresa» permite crear a pesar del aviso', r.status === 201 && r.datos.id !== creada.id);

    console.log('Alcance por país');
    r = await llamar('POST', '/clientes', { usuario: asesorSV, cuerpo: empresa({ nombre: 'Hospital Santa Lucía Norte', paisId: paisSV, ciudad: 'San Salvador', telefono: '2222 3344' }) });
    const salvadorena = r.datos;
    prueba('un asesor de El Salvador registra en su país', r.status === 201 && salvadorena.telefono === '+50322223344', JSON.stringify(r.datos));
    r = await llamar('GET', '/clientes?busqueda=Hospital%20Santa');
    prueba('el asesor de Guatemala no ve la empresa de El Salvador en la lista', r.status === 200 && !r.datos.items.some(i => i.id === salvadorena.id));
    prueba('ni la abre por su identificador (404)', (await llamar('GET', `/clientes/${salvadorena.id}`)).status === 404);
    prueba('ni la edita (404)', (await llamar('PUT', `/clientes/${salvadorena.id}`, { cuerpo: { ciudad: 'Otra' } })).status === 404);
    prueba('ni le agrega contactos (404)', (await llamar('POST', `/clientes/${salvadorena.id}/contactos`, { cuerpo: { nombre: 'X', areaId } })).status === 404);
    prueba('el gerente sí la ve', (await llamar('GET', `/clientes/${salvadorena.id}`, { usuario: gerente, permisos: PERM_GERENTE })).status === 200);
    prueba('y no puede editarla (403)', (await llamar('PUT', `/clientes/${salvadorena.id}`, { usuario: gerente, permisos: PERM_GERENTE, cuerpo: { ciudad: 'Otra' } })).status === 403);
    r = await llamar('GET', '/clientes?busqueda=Hospital%20Santa', { usuario: supervisor, permisos: PERM_SUPERVISOR });
    prueba('el supervisor ve las empresas de los países de sus tiendas', r.datos.items.some(i => i.id === salvadorena.id));
    await db.query("INSERT INTO proy_usuario_paises (usuario_id, pais_id, accion, creado_por) VALUES (?, ?, 'agregar', ?)", [asesorGT, paisSV, admin], 'cli:excepcion');
    prueba('si el administrador le agrega El Salvador, ya la ve', (await llamar('GET', `/clientes/${salvadorena.id}`)).status === 200);
    await db.query("UPDATE proy_usuario_paises SET accion = 'quitar', pais_id = ? WHERE usuario_id = ?", [paisGT, asesorGT], 'cli:excepcion_quitar');
    prueba('si le quita Guatemala, deja de ver las suyas', (await llamar('GET', `/clientes/${creada.id}`)).status === 404);
    await db.query('DELETE FROM proy_usuario_paises WHERE usuario_id = ?', [asesorGT], 'cli:excepcion_limpiar');

    console.log('Buscar, filtrar y paginar');
    r = await llamar('GET', '/clientes?busqueda=guayacan');
    prueba('buscar por nombre ignora acentos y mayúsculas', r.datos.items.length >= 3 && r.datos.items.every(i => /guayac/i.test(i.nombre.normalize('NFD').replace(/[̀-ͯ]/g, ''))));
    r = await llamar('GET', '/clientes?busqueda=77654400');
    prueba('buscar por teléfono (solo dígitos)', r.datos.items.some(i => i.id === creada.id));
    prueba('buscar por teléfono con un fragmento de dígitos', (await llamar('GET', '/clientes?busqueda=7765')).datos.items.some(i => i.id === creada.id));
    r = await llamar('POST', '/clientes', { cuerpo: empresa({ nichoId: nichoOtroId, nombre: 'Clínica Dental Sonrisa', telefono: '7700 1122' }) });
    const otroNicho = r.datos;
    prueba('filtrar por nicho trae solo ese nicho', (await llamar('GET', `/clientes?nicho=${nichoOtroId}`)).datos.items.every(i => i.nichoId === nichoOtroId));
    prueba('cada empresa trae nicho, país, estructura y cuántos contactos tiene', otroNicho.nicho === 'Hospitales' && otroNicho.pais === 'Guatemala' && otroNicho.estructura && otroNicho.contactos.length === 1);
    const masivas = Array.from({ length: 55 }, (_, i) => [`PRUEBA-CLI-PAG ${String(i).padStart(2, '0')}`, `prueba cli pag ${i}`, nichoId, paisGT, 1, asesorGT]);
    await db.query(
      `INSERT INTO proy_clientes (nombre, nombre_normalizado, nicho_id, pais_id, estructura_id, creado_por) VALUES ?`, [masivas], 'cli:masivas'
    );
    const p1 = (await llamar('GET', '/clientes?busqueda=PRUEBA-CLI-PAG')).datos;
    const p2 = (await llamar('GET', '/clientes?busqueda=PRUEBA-CLI-PAG&pagina=2')).datos;
    prueba('el listado trae de 50 en 50 con el total y si hay más', p1.items.length === 50 && p1.total === 55 && p1.hayMas === true && p2.items.length === 5 && p2.hayMas === false);

    console.log('Editar');
    r = await llamar('PUT', `/clientes/${otroNicho.id}`, { cuerpo: { ciudad: 'Antigua Guatemala', direccion: 'Calle del Arco 5' } });
    prueba('editar cambia solo lo enviado', r.status === 200 && r.datos.ciudad === 'Antigua Guatemala' && r.datos.direccion === 'Calle del Arco 5' && r.datos.nombre === 'Clínica Dental Sonrisa');
    r = await llamar('PUT', `/clientes/${otroNicho.id}`, { cuerpo: { telefono: '7765 4400' } });
    prueba('un cambio que la vuelve duplicada avisa (409)', r.status === 409 && r.datos.codigo === 'POSIBLE_DUPLICADO');
    r = await llamar('PUT', `/clientes/${otroNicho.id}`, { cuerpo: { telefono: '7765 4400', confirmarDuplicado: true } });
    prueba('y se guarda si se confirma', r.status === 200 && r.datos.telefono === '+50277654400');
    r = await llamar('PUT', `/clientes/${otroNicho.id}`, { cuerpo: { paisId: paisSV } });
    prueba('no se puede mover a un país fuera del alcance', r.status === 400 && !!r.datos.campos.paisId);

    console.log('Estados');
    r = await llamar('POST', `/clientes/${creada.id}/estado`, { cuerpo: { accion: 'no_contactar' } });
    prueba('marcar «No contactar» exige un motivo', r.status === 400 && !!r.datos.campos.motivoId);
    r = await llamar('POST', `/clientes/${creada.id}/estado`, { cuerpo: { accion: 'no_contactar', motivoId, nota: 'Habló con la gerente.' } });
    prueba('con motivo pasa a «no_contactar» y queda en el historial de la empresa',
      r.status === 200 && r.datos.estado === 'no_contactar' && r.datos.eventos[0].accion === 'no_contactar' && r.datos.eventos[0].motivo === 'El cliente lo pidió'
      && r.datos.eventos[0].estadoAnterior === 'activa' && r.datos.eventos[0].nota === 'Habló con la gerente.');
    prueba('marcarla dos veces responde 409', (await llamar('POST', `/clientes/${creada.id}/estado`, { cuerpo: { accion: 'no_contactar', motivoId } })).status === 409);
    prueba('desde «No contactar» no pasa a inactiva', (await llamar('POST', `/clientes/${creada.id}/estado`, { cuerpo: { accion: 'inactivar', motivoId } })).status === 409);
    prueba('el listado normal (activas) ya no la trae', !(await llamar('GET', '/clientes?busqueda=guayacan')).datos.items.some(i => i.id === creada.id));
    prueba('con estado=no_contactar sí', (await llamar('GET', '/clientes?busqueda=guayacan&estado=no_contactar')).datos.items.some(i => i.id === creada.id));
    prueba('con estado=todas la trae también', (await llamar('GET', '/clientes?busqueda=guayacan&estado=todas')).datos.items.some(i => i.id === creada.id));
    prueba('un asesor no puede reactivarla (403)', (await llamar('POST', `/clientes/${creada.id}/estado`, { cuerpo: { accion: 'reactivar', nota: 'ya puede' } })).status === 403);
    r = await llamar('POST', `/clientes/${creada.id}/estado`, { usuario: admin, permisos: PERM_ADMIN, cuerpo: { accion: 'reactivar' } });
    prueba('reactivar sin motivo se rechaza', r.status === 400 && !!r.datos.campos.nota, `${r.status} ${JSON.stringify(r.datos)}`);
    r = await llamar('POST', `/clientes/${creada.id}/estado`, { usuario: admin, permisos: PERM_ADMIN, cuerpo: { accion: 'reactivar', nota: 'El cliente pidió que lo volvamos a llamar.' } });
    prueba('un supervisor o administrador reactiva con motivo y queda registrado',
      r.status === 200 && r.datos.estado === 'activa' && r.datos.eventos[0].accion === 'reactivar' && r.datos.eventos[0].estadoAnterior === 'no_contactar' && r.datos.eventos[1].accion === 'no_contactar');
    prueba('reactivar una empresa ya activa responde 409', (await llamar('POST', `/clientes/${creada.id}/estado`, { usuario: admin, permisos: PERM_ADMIN, cuerpo: { accion: 'reactivar', nota: 'otra vez' } })).status === 409);
    r = await llamar('POST', `/clientes/${otroNicho.id}/estado`, { cuerpo: { accion: 'inactivar', motivoId } });
    prueba('una empresa activa puede pasar a inactiva', r.status === 200 && r.datos.estado === 'inactiva');

    console.log('Contactos');
    r = await llamar('POST', `/clientes/${creada.id}/contactos`, { cuerpo: { nombre: 'Luis Ortiz', areaId, cargo: 'Mercadeo', telefono: '2234 5690', principal: true } });
    const luis = r.datos.contactos.find(c => c.nombre === 'Luis Ortiz');
    prueba('agregar un contacto como principal deja un solo principal', r.status === 201 && luis.principal === true && r.datos.contactos.filter(c => c.principal).length === 1);
    r = await llamar('POST', `/clientes/${creada.id}/contactos`, { cuerpo: { nombre: '', areaId: 999999 } });
    prueba('un contacto sin nombre ni área válida se rechaza', r.status === 400 && r.datos.campos.nombre && r.datos.campos.areaId);
    r = await llamar('POST', `/clientes/${creada.id}/contactos`, { cuerpo: { nombre: 'Marta Rivas', areaId, telefono: '+503 2222 3344' } });
    const marta = r.datos && r.datos.contactos && r.datos.contactos.find(c => c.nombre === 'Marta Rivas');
    prueba('un contacto puede tener teléfono de otro país si se eligió su prefijo', r.status === 201 && marta.telefono === '+50322223344' && marta.telefonoTexto === '+503 2222 3344', JSON.stringify(r.datos));
    r = await llamar('POST', `/clientes/${creada.id}/contactos`, { cuerpo: { nombre: 'Pedro Sola', areaId, telefono: '+503 2222 33' } });
    prueba('…pero se valida con el formato de ese país', r.status === 400 && r.datos.campos.telefono === 'Formato inválido: usa +503 y 8 dígitos.', JSON.stringify(r.datos));
    const carolina = (await llamar('GET', `/clientes/${creada.id}`)).datos.contactos.find(c => c.nombre === 'Carolina Méndez');
    r = await llamar('PUT', `/clientes/contactos/${carolina.id}`, { cuerpo: { cargo: 'Jefa de compras', principal: true } });
    prueba('editar un contacto y hacerlo principal quita el principal anterior', r.status === 200 && r.datos.contactos.find(c => c.id === carolina.id).cargo === 'Jefa de compras'
      && r.datos.contactos.find(c => c.id === carolina.id).principal === true && r.datos.contactos.find(c => c.id === luis.id).principal === false);
    r = await llamar('PATCH', `/clientes/contactos/${carolina.id}/activo`, { cuerpo: { activo: false } });
    prueba('desactivar al principal pasa el principal a otro contacto activo', r.status === 200 && r.datos.contactos.find(c => c.id === carolina.id).activo === false && r.datos.contactos.find(c => c.id === luis.id).principal === true);
    await llamar('PATCH', `/clientes/contactos/${marta.id}/activo`, { cuerpo: { activo: false } });
    r = await llamar('PATCH', `/clientes/contactos/${luis.id}/activo`, { cuerpo: { activo: false } });
    prueba('no se puede desactivar el último contacto activo mientras el ajuste lo exija (409)', r.status === 409);
    prueba('un contacto de otro país no se toca (404)', (await llamar('PUT', `/clientes/contactos/${(await db.query('SELECT id FROM proy_contactos WHERE cliente_id = ?', [salvadorena.id], 'cli:contacto_sv'))[0].id}`, { cuerpo: { cargo: 'X' } })).status === 404);

    console.log('Ajustes del administrador');
    await configService.guardar({ 'empresas.contacto_obligatorio': false, 'empresas.ciudad_obligatoria': true, 'empresas.duplicado_por_telefono': false }, admin);
    r = await llamar('POST', '/clientes', { cuerpo: { ...empresa({ nombre: 'Taller Mecánico Brisas', telefono: '7712 3344' }), contacto: undefined } });
    prueba('con «contacto obligatorio» apagado se crea sin contacto', r.status === 201 && r.datos.contactos.length === 0, JSON.stringify(r.datos));
    r = await llamar('POST', '/clientes', { cuerpo: { ...empresa({ nombre: 'Panadería La Espiga', telefono: '7712 3355' }), ciudad: '' } });
    prueba('con «ciudad obligatoria» encendido, sin ciudad se rechaza', r.status === 400 && !!r.datos.campos.ciudad);
    r = await llamar('POST', '/clientes', { cuerpo: empresa({ nombre: 'Ferretería El Tornillo', telefono: '7765 4400' }) });
    prueba('con el criterio de teléfono apagado, el mismo teléfono ya no avisa', r.status === 201);
    await configService.guardar({ 'empresas.telefono_o_correo_obligatorio': true }, admin);
    r = await llamar('POST', '/clientes', { cuerpo: { ...empresa({ nombre: 'Mueblería Don Pepe' }), telefono: '', contacto: { nombre: 'Pepe', areaId } } });
    prueba('sin teléfono ni forma de contactar se rechaza', r.status === 400 && !!r.datos.campos.telefono);
    r = await llamar('POST', '/clientes', { cuerpo: { ...empresa({ nombre: 'Mueblería Don Pepe' }), telefono: '', contacto: { nombre: 'Pepe', areaId, correo: 'pepe@example.com' } } });
    prueba('el correo de un contacto cuenta como forma de contactar', r.status === 201);

    console.log('Catálogo de motivos');
    r = await llamar('GET', '/catalogos/no_contactar', { usuario: admin, permisos: PERM_ADMIN });
    prueba('el catálogo de motivos se administra desde A1 y cuenta sus usos', r.status === 200 && r.datos.items.length === 4 && r.datos.items.find(i => i.nombre === 'El cliente lo pidió').usos >= 1, JSON.stringify(r.datos && r.datos.items));
  } finally {
    // Limpieza, pase lo que pase: nada de esta prueba debe quedar en la base.
    await db.query('DELETE FROM proy_clientes WHERE creado_por IN (?) AND creado_en >= ?', [[asesorGT, asesorSV, supervisor, admin], inicio], 'cli:limpiar_clientes');
    await db.query('DELETE FROM proy_usuario_paises WHERE usuario_id IN (?)', [[asesorGT, asesorSV]], 'cli:limpiar_alcance');
    await db.query('DELETE FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'cli:limpiar_ajustes');
    for (const { clave, valor } of ajustesAntes) {
      await db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?)', [clave, valor], 'cli:restaurar_ajuste');
    }
    await db.query('DELETE FROM proy_config_historial WHERE creado_en >= ?', [inicio], 'cli:limpiar_historial');
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
