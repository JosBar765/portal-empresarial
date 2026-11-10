// src/modules/proyectos/permisosPorRol.js
// Qué permisos de Proyectos lleva cada rol al activar el módulo (propuesta, sección 4.2). La migración los crea SIN asignar a nadie,
// así el módulo no aparece en el portal antes de tiempo; este es el mapa que se sigue al activarlo desde la pantalla de Roles de
// Administración (que refresca la sesión de quien esté conectado). Lo usan `scripts/proyectos/activacion.js` (tabla, SQL y comprobación
// de una base) y la verificación. La interfaz y el servidor deciden por permiso, nunca por el nombre del rol.
const ROLES = { ADMINISTRADOR: 1, ASESOR: 2, SUPERVISOR: 3, GERENTE: 8 };
const NOMBRES = { 1: 'Administrador', 2: 'Asesor de Ventas', 3: 'Supervisor de Ventas', 8: 'Gerente' };

const PERMISOS_POR_ROL = {
  [ROLES.ADMINISTRADOR]: [
    'proyectos.ver', 'proyectos.clientes.registrar', 'proyectos.clientes.importar', 'proyectos.activar', 'proyectos.reasignar', 'proyectos.ver_gerencia',
    'proyectos.ver_reportes', 'proyectos.corregir', 'proyectos.aprobar_activacion', 'proyectos.confirmar_ventas', 'proyectos.administrar'
  ],
  [ROLES.ASESOR]: ['proyectos.ver', 'proyectos.clientes.registrar', 'proyectos.gestionar'],
  [ROLES.SUPERVISOR]: [
    'proyectos.ver', 'proyectos.clientes.registrar', 'proyectos.clientes.importar', 'proyectos.gestionar', 'proyectos.activar', 'proyectos.reasignar',
    'proyectos.supervisar', 'proyectos.ver_reportes', 'proyectos.corregir', 'proyectos.confirmar_ventas'
  ],
  [ROLES.GERENTE]: ['proyectos.ver', 'proyectos.ver_gerencia', 'proyectos.dar_visto_bueno', 'proyectos.ver_reportes', 'proyectos.aprobar_activacion']
};

// Para qué sirve cada permiso (se muestra en la tabla del documento y de la herramienta).
const DESCRIPCIONES = {
  'proyectos.ver': 'Entrar al módulo',
  'proyectos.clientes.registrar': 'Crear y editar empresas y contactos',
  'proyectos.clientes.importar': 'Importar listas de empresas',
  'proyectos.gestionar': 'Gestionar las empresas que le tocaron',
  'proyectos.activar': 'Crear, activar, cancelar y cerrar proyectos',
  'proyectos.reasignar': 'Pasar empresas de un asesor a otro',
  'proyectos.supervisar': 'Ver el avance de su equipo',
  'proyectos.ver_gerencia': 'Ver todo en solo lectura',
  'proyectos.dar_visto_bueno': 'Dar o devolver el visto bueno al cierre',
  'proyectos.ver_reportes': 'Ver y exportar informes en PDF',
  'proyectos.corregir': 'Anular una cotización o venta equivocada',
  'proyectos.aprobar_activacion': 'Aprobar o rechazar la activación de un proyecto',
  'proyectos.confirmar_ventas': 'Confirmar o rechazar ventas por confirmar',
  'proyectos.administrar': 'Todo el Centro de configuración'
};

// Todos los permisos del módulo, en el orden de la propuesta.
const TODOS = Object.keys(DESCRIPCIONES);

// SQL idempotente que da a cada rol los permisos del mapa sin quitar nada de lo que ya tenía.
function sqlDeActivacion() {
  return Object.entries(PERMISOS_POR_ROL).map(([rol, codigos]) =>
    `-- ${NOMBRES[rol]}\nINSERT IGNORE INTO rol_permisos (rol_id, permiso_id) SELECT ${Number(rol)}, id FROM permisos WHERE codigo IN (${codigos.map(c => `'${c}'`).join(', ')});`
  ).join('\n');
}

// Compara lo que hay en una base con el mapa. `filas`: [{ rol_id, codigo }] con los permisos de Proyectos asignados.
// Devuelve { faltan: { rol: [codigos] }, sobran: { rol: [codigos] }, ok } (sobran = permisos que ese rol no debe tener según el mapa).
function comparar(filas) {
  const tiene = new Map();
  for (const { rol_id: rol, codigo } of filas) {
    if (!tiene.has(rol)) tiene.set(rol, new Set());
    tiene.get(rol).add(codigo);
  }
  const faltan = {};
  const sobran = {};
  for (const [rol, codigos] of Object.entries(PERMISOS_POR_ROL)) {
    const actual = tiene.get(Number(rol)) || new Set();
    const f = codigos.filter(c => !actual.has(c));
    if (f.length) faltan[rol] = f;
  }
  for (const [rol, actual] of tiene) {
    const permitidos = new Set(PERMISOS_POR_ROL[rol] || []);
    const s = [...actual].filter(c => !permitidos.has(c));
    if (s.length) sobran[rol] = s;
  }
  return { faltan, sobran, ok: !Object.keys(faltan).length && !Object.keys(sobran).length };
}

module.exports = { ROLES, NOMBRES, PERMISOS_POR_ROL, DESCRIPCIONES, TODOS, sqlDeActivacion, comparar };
