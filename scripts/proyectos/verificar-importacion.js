// scripts/proyectos/verificar-importacion.js
// Verifica la importación de empresas por CSV (fase 2b): lector CSV (pruebas puras) y, por HTTP, las rutas reales:
// permisos, archivo inválido, límites, vista previa, confirmación, idempotencia (incluida la simultánea), completar
// duplicadas sin pisar datos y límite de frecuencia.
//
// Uso (base DESECHABLE con las migraciones aplicadas; crea empresas de prueba y las borra al terminar):
//   node scripts/proyectos/verificar-importacion.js
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/proyectos/routes');
const csv = require('../../src/modules/proyectos/csv');

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};

const PERM_ASESOR = ['proyectos.ver', 'proyectos.clientes.registrar'];
const PERM_IMPORTA = [...PERM_ASESOR, 'proyectos.clientes.importar'];
const ENCABEZADO = 'empresa,nicho,pais,ciudad,telefono,direccion,sitio_web,contacto_nombre,contacto_area,contacto_cargo,contacto_telefono,contacto_correo';

function verificarLector() {
  console.log('Lector CSV');
  const filas = (texto) => csv.leer(texto).filas;
  prueba('coma, comillas y comillas dobles escapadas', JSON.stringify(filas('a,"b,c","d ""e"""\n1,2,3')) === JSON.stringify([['a', 'b,c', 'd "e"'], ['1', '2', '3']]));
  prueba('punto y coma (Excel en español)', JSON.stringify(filas('a;b;c\r\n1;2;3\r\n')) === JSON.stringify([['a', 'b', 'c'], ['1', '2', '3']]));
  prueba('tabulador', JSON.stringify(filas('a\tb\n1\t2')) === JSON.stringify([['a', 'b'], ['1', '2']]));
  prueba('un salto de línea dentro de comillas es parte de la celda', filas('a,b\n"uno\ndos",x')[1][0] === 'uno\ndos');
  prueba('las líneas en blanco no cuentan', filas('a,b\n\n1,2\n\n').length === 2);
  prueba('CRLF y CR solos', filas('a,b\r\n1,2\r3,4').length === 3);
  prueba('sin salto final también lee la última fila', filas('a,b\n1,2').length === 2);
  prueba('comillas sin cerrar → error', !!csv.leer('a,"b\n1,2').error);
  prueba('demasiadas columnas → error', !!csv.leer(Array.from({ length: 40 }, (_, i) => `c${i}`).join(',')).error);
  prueba('una celda enorme → error', !!csv.leer(`a,${'x'.repeat(2000)}`).error);
  prueba('el BOM no queda en el primer encabezado', csv.decodificar(Buffer.from('﻿empresa,nicho', 'utf8')).startsWith('empresa'));
  prueba('un archivo en Windows-1252 conserva los acentos', csv.decodificar(Buffer.from('Cooperativa Ñandú', 'latin1')) === 'Cooperativa Ñandú');
  prueba('un UTF-8 válido no se toca', csv.decodificar(Buffer.from('Cooperativa Ñandú', 'utf8')) === 'Cooperativa Ñandú');
  prueba('el nombre de columna ignora acentos, mayúsculas y espacios', csv.clave(' Teléfono  Contacto ') === 'telefono_contacto');
  prueba('una celda que parece fórmula se neutraliza al escribir', csv.escapar('=HYPERLINK("x")') === '"\'=HYPERLINK(""x"")"' && csv.escapar('+50212345678') === '\'+50212345678' && csv.escapar('@cmd') === '\'@cmd');
  prueba('una celda normal no cambia y una con coma se entrecomilla', csv.escapar('Banco') === 'Banco' && csv.escapar('a,b') === '"a,b"');
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
  const inicio = (await db.query('SELECT NOW() - INTERVAL 2 SECOND AS t', [], 'imp:inicio'))[0].t;
  const ajustesAntes = await db.query('SELECT clave, valor FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'imp:ajustes_antes');

  const pais = async (codigo) => (await db.query('SELECT id FROM paises WHERE codigo = ?', [codigo], 'imp:pais'))[0].id;
  const paisGT = await pais('GT');
  const asesoresGT = (await db.query(
    `SELECT u.id FROM asesores a JOIN usuarios u ON u.id = a.usuario_id JOIN tiendas t ON t.id = a.tienda_id JOIN empresas e ON e.id = t.empresa_id
     WHERE e.pais_id = ? ORDER BY u.id LIMIT 3`, [paisGT], 'imp:asesor')).map(f => f.id);
  const [asesorGT, asesorGT2] = asesoresGT;
  const personaB = { usuario: asesorGT2 }; // el límite de frecuencia es por persona: los bloques largos usan otra
  const [{ id: admin }] = await db.query('SELECT id FROM usuarios WHERE rol_id = 1 ORDER BY id LIMIT 1', [], 'imp:admin');
  const [{ id: nichoId }] = await db.query("SELECT id FROM proy_nichos WHERE nombre = 'Bancos y cooperativas'", [], 'imp:nicho');
  const [{ id: estructuraId }] = await db.query('SELECT id FROM proy_estructuras ORDER BY id LIMIT 1', [], 'imp:estructura');

  const servidor = await levantar();
  const base = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;
  const cabeceras = (usuario, permisos) => ({ 'x-usuario': String(usuario), 'x-permisos': permisos.join(',') });
  const subir = async (ruta, contenido, { nombre = 'empresas.csv', tipo = 'text/csv', usuario = asesorGT, permisos = PERM_IMPORTA, campos = {} } = {}) => {
    const form = new FormData();
    Object.entries(campos).forEach(([k, v]) => form.append(k, v));
    if (contenido !== null) form.append('archivo', new Blob([contenido], { type: tipo }), nombre);
    const res = await fetch(base + ruta, { method: 'POST', headers: cabeceras(usuario, permisos), body: form });
    return { status: res.status, datos: await res.json().catch(() => null) };
  };
  const previa = (contenido, opciones) => subir('/clientes/importar/previsualizar', contenido, opciones);
  const confirmar = (contenido, duplicadas, clave, opciones = {}) => subir('/clientes/importar/confirmar', contenido, { ...opciones, campos: { duplicadas, idempotencyKey: clave, ...(opciones.campos || {}) } });
  const clave = () => `imp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const cuantas = async (patron) => Number((await db.query('SELECT COUNT(*) AS n FROM proy_clientes WHERE nombre LIKE ?', [patron], 'imp:contar'))[0].n);

  // Empresa que ya existe, sin ciudad ni dirección, para probar duplicadas y completar.
  const existente = (await db.query(
    `INSERT INTO proy_clientes (nombre, nombre_normalizado, nicho_id, pais_id, estructura_id, telefono, creado_por) VALUES ('IMP Cooperativa Existente', 'imp cooperativa existente', ?, ?, ?, '+50277000001', ?)`,
    [nichoId, paisGT, estructuraId, asesorGT], 'imp:existente')).insertId;
  await db.query("INSERT INTO proy_contactos (cliente_id, area_id, nombre, principal, activo, creado_por) SELECT ?, id, 'Contacto Previo', 1, 1, ? FROM proy_areas_contacto ORDER BY id LIMIT 1", [existente, asesorGT], 'imp:contacto_previo');

  try {
    console.log('Permisos, plantilla y archivos inválidos');
    prueba('sin proyectos.clientes.importar no se sube nada (403)', (await previa(`${ENCABEZADO}\nX,Colegios,Guatemala`, { permisos: PERM_ASESOR })).status === 403);
    const resPlantilla = await fetch(`${base}/clientes/importar/plantilla`, { headers: cabeceras(asesorGT, PERM_IMPORTA) });
    const bytesPlantilla = Buffer.from(await resPlantilla.arrayBuffer()); // text() quitaría el BOM
    const textoPlantilla = bytesPlantilla.toString('utf8');
    prueba('la plantilla baja como CSV con BOM, encabezado y una fila de ejemplo', resPlantilla.status === 200 && /text\/csv/.test(resPlantilla.headers.get('content-type')) && bytesPlantilla[0] === 0xEF && textoPlantilla.startsWith('﻿empresa,nicho,pais') && textoPlantilla.trim().split('\r\n').length === 2);
    prueba('la plantilla se lee de vuelta con el mismo lector', csv.leer(csv.decodificar(bytesPlantilla)).filas[0].length === 12);
    prueba('la plantilla también exige permiso (403)', (await fetch(`${base}/clientes/importar/plantilla`, { headers: cabeceras(asesorGT, PERM_ASESOR) })).status === 403);
    let r = await previa(null);
    prueba('sin archivo, error claro (400)', r.status === 400 && !!r.datos.error, JSON.stringify(r.datos));
    r = await previa('', { nombre: 'vacio.csv' });
    prueba('archivo vacío → «está vacío»', r.status === 400 && /vacío/.test(r.datos.error), JSON.stringify(r.datos));
    r = await previa('PK\u0003\u0004', { nombre: 'empresas.xlsx', tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    prueba('un .xlsx se rechaza pidiendo CSV', r.status === 400 && /\.csv/.test(r.datos.error), JSON.stringify(r.datos));
    r = await previa('hola.exe', { nombre: 'virus.csv.exe', tipo: 'application/x-msdownload' });
    prueba('un tipo ejecutable se rechaza', r.status === 400);
    r = await previa(`${ENCABEZADO}\n`);
    prueba('solo el encabezado → sin empresas', r.status === 400 && /no tiene empresas/.test(r.datos.error), JSON.stringify(r.datos));
    r = await previa('nombre,telefono\nX,1');
    prueba('faltan columnas obligatorias → las nombra', r.status === 400 && /nicho/.test(r.datos.error) && /pais/.test(r.datos.error), JSON.stringify(r.datos));

    console.log('Límites configurables');
    await configService.guardar({ 'importacion.max_filas': 100, 'importacion.max_mb': 1 }, admin);
    const muchas = [ENCABEZADO, ...Array.from({ length: 101 }, (_, i) => `IMP Limite ${i},Colegios,Guatemala`)].join('\n');
    r = await previa(muchas);
    prueba('más filas que importacion.max_filas → 400 con el máximo', r.status === 400 && /101/.test(r.datos.error) && /100/.test(r.datos.error), JSON.stringify(r.datos));
    r = await previa(`${ENCABEZADO}\nIMP Gigante,Colegios,Guatemala,${'x'.repeat(900)}\n${'#'.repeat(1024 * 1024 + 10)}`);
    prueba('más peso que importacion.max_mb → 400 con el máximo', r.status === 400 && /1 MB/.test(r.datos.error), JSON.stringify(r.datos));
    await configService.guardar({ 'importacion.max_filas': 2000, 'importacion.max_mb': 5 }, admin);

    console.log('Vista previa');
    r = await previa(`${ENCABEZADO}\nIMP Sin Contacto,Colegios,Guatemala,Cobán,7765 4410`);
    prueba('con «contacto obligatorio» encendido, una fila sin contacto es un error', r.datos.filas[0].estado === 'error' && !!r.datos.filas[0].errores.contacto_nombre, JSON.stringify(r.datos.filas[0]));
    await configService.guardar({ 'empresas.contacto_obligatorio': false }, admin);
    const archivo = [
      ENCABEZADO,
      'IMP Colegio Nuevo Uno,Colegios,Guatemala,Quetzaltenango,7765 4401,3a calle 1-1,nuevo1.com,Ana Pérez,Compras,Jefa,2234 5678,ana@example.com',
      'IMP Colegio Nuevo Dos,colegios,guatemala,Cobán,7765 4402,,,,,,,',
      'IMP Cooperativa Existente,Bancos y cooperativas,Guatemala,Antigua,7765 4403,Calle del Arco 5,coop.com,Luis Ortiz,Compras,Gerente,2234 5679,luis@example.com',
      'IMP Sin Nicho,Nicho Inventado,Guatemala,Cobán,7765 4404,,,,,,,',
      'IMP Otro Pais,Colegios,El Salvador,San Salvador,2222 3344,,,,,,,',
      'IMP Telefono Malo,Colegios,Guatemala,Cobán,12345,,,,,,,',
      'IMP Colegio Nuevo Uno,Colegios,Guatemala,Quetzaltenango,7765 4499,,,,,,,',
      '=HYPERLINK("http://malo.example"),Colegios,Guatemala,Cobán,7765 4405,,,,,,,',
      ',Colegios,Guatemala,Cobán,7765 4406,,,,,,,',
      'IMP Contacto Malo,Colegios,Guatemala,Cobán,7765 4407,,,Pepe,AreaInexistente,,,correo-malo'
    ].join('\r\n');
    r = await previa(archivo);
    const porLinea = (n) => (r.datos.filas || []).find(f => f.linea === n) || {};
    prueba('la vista previa responde 200 con resumen y una fila por línea (sin tocar la base)', r.status === 200 && r.datos.filas.length === 10 && (await cuantas('IMP Colegio%')) === 0, JSON.stringify(r.datos && r.datos.resumen));
    prueba('dos nuevas válidas (nicho y país sin importar acentos ni mayúsculas)', porLinea(2).estado === 'nueva' && porLinea(3).estado === 'nueva', JSON.stringify([porLinea(2), porLinea(3)]));
    prueba('una duplicada indica con quién se parece', porLinea(4).estado === 'duplicada' && porLinea(4).duplicadaDe.id === existente);
    prueba('nicho inexistente: error en la columna nicho', porLinea(5).estado === 'error' && /Nicho Inventado/.test(porLinea(5).errores.nicho || ''));
    prueba('país fuera del alcance: «País no asignado a tu usuario»', porLinea(6).estado === 'error' && porLinea(6).errores.pais === 'País no asignado a tu usuario.', JSON.stringify(porLinea(6).errores));
    prueba('teléfono con formato inválido: error con el texto del mockup', porLinea(7).estado === 'error' && /Formato inválido/.test(porLinea(7).errores.telefono || ''));
    prueba('repetida dentro del archivo: se marca la segunda con la línea de la primera', porLinea(8).estado === 'error' && /línea 2/.test(porLinea(8).errores.empresa || ''), JSON.stringify(porLinea(8)));
    prueba('una celda con fórmula se trata como texto, nunca se ejecuta', porLinea(9).estado === 'nueva' && porLinea(9).empresa.startsWith('=HYPERLINK'));
    prueba('empresa sin nombre: error', porLinea(10).estado === 'error' && !!porLinea(10).errores.empresa);
    prueba('contacto con área inexistente y correo malo: error por columna', porLinea(11).estado === 'error' && !!porLinea(11).errores.contacto_area && !!porLinea(11).errores.contacto_correo, JSON.stringify(porLinea(11).errores));
    prueba('el resumen cuenta nuevas, duplicadas y con error', r.datos.resumen.nuevas === 3 && r.datos.resumen.duplicadas === 1 && r.datos.resumen.conError === 6 && r.datos.duplicadasPorDefecto === 'omitir', JSON.stringify(r.datos.resumen));
    const conPuntoYComa = archivo.split('\r\n').slice(0, 3).join('\r\n').replace(/,/g, ';');
    r = await previa(Buffer.from(conPuntoYComa, 'latin1'), { nombre: 'excel.csv' });
    prueba('un CSV de Excel (punto y coma, Windows-1252) también se lee', r.status === 200 && r.datos.resumen.nuevas === 2, JSON.stringify(r.datos));

    console.log('Confirmar');
    prueba('sin clave de operación → 400', (await confirmar(archivo, 'omitir', '')).status === 400);
    prueba('con una opción de duplicadas inválida → 400', (await confirmar(archivo, 'borrar', clave())).status === 400);
    prueba('sin permiso → 403', (await confirmar(archivo, 'omitir', clave(), { permisos: PERM_ASESOR })).status === 403);
    const claveUno = clave();
    r = await confirmar(archivo, 'omitir', claveUno);
    prueba('confirmar omitiendo duplicadas crea solo las nuevas', r.status === 200 && r.datos.creadas === 3 && r.datos.actualizadas === 0 && r.datos.duplicadas === 1 && r.datos.conError === 6 && r.datos.repetida === false, JSON.stringify(r.datos));
    const creadas = await db.query("SELECT nombre, origen, tienda_origen_id, creado_por, ciudad FROM proy_clientes WHERE nombre LIKE 'IMP Colegio Nuevo%' OR nombre LIKE '=HYPER%' ORDER BY nombre", [], 'imp:creadas');
    prueba('quedan con origen «importacion», la tienda y la persona que importó', creadas.length === 3 && creadas.every(c => c.origen === 'importacion' && c.creado_por === asesorGT && c.tienda_origen_id), JSON.stringify(creadas));
    const contactosUno = await db.query("SELECT ct.nombre, ct.principal FROM proy_contactos ct JOIN proy_clientes c ON c.id = ct.cliente_id WHERE c.nombre = 'IMP Colegio Nuevo Uno'", [], 'imp:contactos');
    prueba('el contacto del archivo queda como principal', contactosUno.length === 1 && contactosUno[0].nombre === 'Ana Pérez' && contactosUno[0].principal === 1);
    const registro = (await db.query('SELECT * FROM proy_importaciones WHERE usuario_id = ? ORDER BY id DESC LIMIT 1', [asesorGT], 'imp:registro'))[0];
    prueba('queda un registro de la importación con sus conteos', registro && registro.filas === 10 && registro.creadas === 3 && registro.actualizadas === 0 && registro.duplicadas === 1 && registro.con_error === 6 && registro.archivo === 'empresas.csv', JSON.stringify(registro));
    prueba('la respuesta trae las filas con error (para descargarlas)', Array.isArray(r.datos.errores) && r.datos.errores.length === 6 && r.datos.errores.every(e => e.linea && Object.keys(e.errores).length));

    console.log('Idempotencia');
    r = await confirmar(archivo, 'omitir', claveUno);
    prueba('repetir la misma clave devuelve el mismo resultado sin crear de nuevo', r.status === 200 && r.datos.repetida === true && r.datos.creadas === 3 && (await cuantas('IMP Colegio Nuevo%')) === 2 && Number((await db.query('SELECT COUNT(*) AS n FROM proy_importaciones WHERE usuario_id = ?', [asesorGT], 'imp:n_reg'))[0].n) === 1);
    r = await confirmar(archivo, 'omitir', clave());
    prueba('con otra clave, las ya creadas ahora son duplicadas: no se vuelven a crear', r.status === 200 && r.datos.creadas === 0 && r.datos.duplicadas === 4 && (await cuantas('IMP Colegio Nuevo%')) === 2, JSON.stringify(r.datos));
    const simultaneo = `${ENCABEZADO}\nIMP Simultanea Uno,Colegios,Guatemala,Cobán,7766 1001\nIMP Simultanea Dos,Colegios,Guatemala,Cobán,7766 1002`;
    const claveSimultanea = clave();
    const dobles = await Promise.all([confirmar(simultaneo, 'omitir', claveSimultanea, personaB), confirmar(simultaneo, 'omitir', claveSimultanea, personaB), confirmar(simultaneo, 'omitir', claveSimultanea, personaB)]);
    prueba('tres confirmaciones simultáneas con la misma clave crean una sola vez', dobles.every(d => d.status === 200) && (await cuantas('IMP Simultanea%')) === 2 && dobles.filter(d => d.datos.repetida === false).length === 1, JSON.stringify(dobles.map(d => [d.status, d.datos && d.datos.repetida])));

    console.log('Revalidación y completar duplicadas');
    const carrera = `${ENCABEZADO}\nIMP Carrera,Colegios,Guatemala,Cobán,7767 2001`;
    r = await previa(carrera, personaB);
    prueba('la vista previa dice «nueva»', r.datos.filas[0].estado === 'nueva');
    await db.query("INSERT INTO proy_clientes (nombre, nombre_normalizado, nicho_id, pais_id, ciudad, estructura_id, telefono, creado_por) VALUES ('IMP Carrera', 'imp carrera', ?, ?, 'Cobán', ?, '+50277672001', ?)", [nichoId, paisGT, estructuraId, asesorGT], 'imp:carrera');
    r = await confirmar(carrera, 'omitir', clave(), personaB);
    prueba('si alguien la creó antes de confirmar, la confirmación la ve como duplicada y no la crea', r.datos.creadas === 0 && r.datos.duplicadas === 1 && (await cuantas('IMP Carrera')) === 1, JSON.stringify(r.datos));
    await db.query("UPDATE proy_clientes SET ciudad = 'Ciudad Original' WHERE id = ?", [existente], 'imp:ciudad_original');
    const completar = `${ENCABEZADO}\nIMP Cooperativa Existente,Bancos y cooperativas,Guatemala,Antigua,7700 0001,Calle del Arco 5,coop.com,Luis Ortiz,Compras,Gerente,2234 5679,luis@example.com`;
    r = await confirmar(completar, 'actualizar', clave(), personaB);
    const despues = (await db.query('SELECT ciudad, direccion, sitio_web, telefono FROM proy_clientes WHERE id = ?', [existente], 'imp:despues'))[0];
    const contactosExistente = await db.query('SELECT nombre, principal FROM proy_contactos WHERE cliente_id = ? ORDER BY id', [existente], 'imp:contactos_ex');
    prueba('«actualizar» completa lo vacío (dirección y sitio web) sin pisar lo que ya había (ciudad y teléfono)',
      r.datos.actualizadas === 1 && r.datos.creadas === 0 && despues.ciudad === 'Ciudad Original' && despues.direccion === 'Calle del Arco 5' && despues.sitio_web === 'https://coop.com' && despues.telefono === '+50277000001', JSON.stringify([r.datos, despues]));
    prueba('agrega el contacto nuevo sin quitarle lo principal al que ya estaba', contactosExistente.length === 2 && contactosExistente[0].principal === 1 && contactosExistente[1].nombre === 'Luis Ortiz' && contactosExistente[1].principal === 0, JSON.stringify(contactosExistente));
    r = await confirmar(completar, 'actualizar', clave(), personaB);
    prueba('repetirlo con otra clave no cambia nada (0 actualizadas, sin contactos repetidos)', r.datos.actualizadas === 0 && (await db.query('SELECT id FROM proy_contactos WHERE cliente_id = ?', [existente], 'imp:n_contactos')).length === 2, JSON.stringify(r.datos));

    console.log('Límite de frecuencia');
    const otraPersona = (await db.query('SELECT id FROM usuarios WHERE rol_id = 1 ORDER BY id DESC LIMIT 1', [], 'imp:otra'))[0].id;
    const estados = [];
    for (let i = 0; i < 32; i += 1) estados.push((await previa(`${ENCABEZADO}\nIMP Frecuencia,Colegios,Guatemala,Cobán`, { usuario: otraPersona })).status);
    prueba('pasadas 30 vistas previas en 10 minutos responde 429 con un mensaje claro', estados.slice(0, 30).every(s => s === 200) && estados[31] === 429);
    prueba('el límite es por persona: otra persona sigue pudiendo', (await previa(`${ENCABEZADO}\nIMP Frecuencia,Colegios,Guatemala,Cobán`, { usuario: asesorGT })).status === 200);
  } finally {
    // Limpieza, pase lo que pase: nada de esta prueba debe quedar en la base.
    await db.query('DELETE FROM proy_clientes WHERE (creado_en >= ? OR id = ?) AND (nombre LIKE ? OR nombre LIKE ? OR nombre LIKE ?)', [inicio, existente, 'IMP %', '=HYPERLINK%', 'IMP%'], 'imp:limpiar_clientes');
    await db.query('DELETE FROM proy_importaciones WHERE creado_en >= ?', [inicio], 'imp:limpiar_importaciones');
    await db.query("DELETE FROM idempotency_keys WHERE idempotency_key LIKE 'proy-import:%' AND creado_en >= ?", [inicio], 'imp:limpiar_claves');
    await db.query('DELETE FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'imp:limpiar_ajustes');
    for (const { clave: c, valor } of ajustesAntes) await db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?)', [c, valor], 'imp:restaurar_ajuste');
    await db.query('DELETE FROM proy_config_historial WHERE creado_en >= ?', [inicio], 'imp:limpiar_historial');
    configService.invalidar();
    servidor.close();
  }
}

(async () => {
  verificarLector();
  await db.listo;
  await verificarServicio();
  console.log(malas ? `\n${malas} verificación(es) fallaron (${buenas} correctas).` : `\nTodo correcto (${buenas} verificaciones).`);
  process.exit(malas ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
