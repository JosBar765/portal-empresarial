// scripts/proyectos/activacion.js
// Herramienta para activar el módulo Proyectos (fase 8). NO cambia nada por sí sola.
//
//   node scripts/proyectos/activacion.js              Muestra qué permiso lleva cada rol (el mapa de la propuesta).
//   node scripts/proyectos/activacion.js --sql        Imprime el SQL idempotente equivalente (para revisarlo; la forma preferida de
//                                                     activar es la pantalla de Roles de Administración, que además refresca la
//                                                     sesión de quien esté conectado).
//   node scripts/proyectos/activacion.js --verificar  Lee (solo lectura) la base a la que apunta el .env y dice qué permisos
//                                                     faltan o sobran en cada rol. Sale con código 1 si hay diferencias.
const { PERMISOS_POR_ROL, NOMBRES, DESCRIPCIONES, TODOS, sqlDeActivacion, comparar } = require('../../src/modules/proyectos/permisosPorRol');

const modo = process.argv[2] || '';

function tabla() {
  const roles = Object.keys(PERMISOS_POR_ROL);
  const ancho = Math.max(...TODOS.map(c => c.length));
  console.log(`${'Permiso'.padEnd(ancho)}  ${roles.map(r => NOMBRES[r].slice(0, 14).padEnd(14)).join('  ')}  Para qué`);
  for (const codigo of TODOS) console.log(`${codigo.padEnd(ancho)}  ${roles.map(r => (PERMISOS_POR_ROL[r].includes(codigo) ? 'sí' : '—').padEnd(14)).join('  ')}  ${DESCRIPCIONES[codigo]}`);
}

async function verificar() {
  const db = require('../../src/config/database');
  await db.listo;
  const filas = await db.query(
    `SELECT rp.rol_id, p.codigo FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE p.modulo = 'proyectos'`, [], 'activacion:permisos'
  );
  const existentes = (await db.query("SELECT codigo FROM permisos WHERE modulo = 'proyectos'", [], 'activacion:existentes')).map(r => r.codigo);
  const sinCrear = TODOS.filter(c => !existentes.includes(c));
  const resultado = comparar(filas);
  const nombre = (rol) => `${NOMBRES[rol] || `rol ${rol}`} (${rol})`;
  if (sinCrear.length) console.log(`Permisos que la migración todavía no creó en esta base: ${sinCrear.join(', ')}`);
  for (const [rol, codigos] of Object.entries(resultado.faltan)) console.log(`Faltan a ${nombre(rol)}: ${codigos.join(', ')}`);
  for (const [rol, codigos] of Object.entries(resultado.sobran)) console.log(`Sobran a ${nombre(rol)}: ${codigos.join(', ')}`);
  console.log(resultado.ok && !sinCrear.length ? 'Los permisos de Proyectos coinciden con el mapa de la propuesta.' : 'Hay diferencias con el mapa de la propuesta.');
  process.exit(resultado.ok && !sinCrear.length ? 0 : 1);
}

if (modo === '--sql') console.log(`-- Activación de Proyectos: da a cada rol sus permisos sin quitar nada de lo que ya tenía.\n-- Preferible: hacerlo desde la pantalla de Roles (refresca la sesión de quien esté conectado).\n${sqlDeActivacion()}`);
else if (modo === '--verificar') verificar().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
else if (modo === '') tabla();
else { console.error('Uso: node scripts/proyectos/activacion.js [--sql | --verificar]'); process.exit(2); }
