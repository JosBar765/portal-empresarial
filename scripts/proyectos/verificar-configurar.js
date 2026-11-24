// scripts/proyectos/verificar-configurar.js
// Verifica quién puede cambiar qué en la Configuración de Proyectos: quien tiene `proyectos.configurar` (un supervisor) entra a
// plantillas, notificaciones, kit del nicho, campos propios, plan del año y al historial; lo delicado (catálogos, parámetros, reglas
// y aprobaciones, alcance de usuarios, restaurar valores) sigue siendo solo de `proyectos.administrar`; quien no tiene ninguno de
// los dos no entra a nada. Va por HTTP contra las rutas reales y no escribe datos.
//
// Uso (base DESECHABLE con las migraciones aplicadas):
//   node scripts/proyectos/verificar-configurar.js
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/proyectos/routes');
const { PERMISOS_POR_ROL, ROLES } = require('../../src/modules/proyectos/permisosPorRol');

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};

const SUPERVISOR = ['proyectos.ver', 'proyectos.supervisar', 'proyectos.configurar'];
const ADMIN = ['proyectos.ver', 'proyectos.administrar'];
const ASESOR = ['proyectos.ver', 'proyectos.gestionar', 'proyectos.clientes.registrar'];

// Lectura de lo operativo: la ven quien configura y quien administra.
const OPERATIVAS = ['/config/plantillas', '/config/campos', '/config/plan/2026', '/config/automatizacion', '/config/kits', '/config/avisos', '/config/historial', '/config/resumen', '/catalogos/nichos'];
// Lo delicado: solo administrar.
const SOLO_ADMIN = ['/config/parametros', '/config/reglas', '/config/alcance', '/config/paises'];

async function levantar() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: 1, nombre: 'Prueba', permissions: (req.headers['x-permisos'] || '').split(',').filter(Boolean) };
    next();
  });
  app.use('/api/proyectos', requirePermission('proyectos.ver'), rutas);
  return new Promise(resolver => { const s = app.listen(0, '127.0.0.1', () => resolver(s)); });
}

async function verificar() {
  const servidor = await levantar();
  const base = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;
  const llamar = async (metodo, ruta, permisos, cuerpo) => {
    const res = await fetch(base + ruta, { method: metodo, headers: { 'x-permisos': permisos.join(','), 'content-type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    return res.status;
  };
  try {
    console.log('Lo operativo (configurar o administrar)');
    for (const ruta of OPERATIVAS) {
      const [sup, adm, ase] = [await llamar('GET', ruta, SUPERVISOR), await llamar('GET', ruta, ADMIN), await llamar('GET', ruta, ASESOR)];
      prueba(`GET ${ruta}: supervisor y administrador entran, el asesor no`, sup === 200 && adm === 200 && ase === 403, `sup ${sup}, adm ${adm}, ase ${ase}`);
    }

    console.log('Lo delicado (solo administrar)');
    for (const ruta of SOLO_ADMIN) {
      const [sup, adm] = [await llamar('GET', ruta, SUPERVISOR), await llamar('GET', ruta, ADMIN)];
      prueba(`GET ${ruta}: el supervisor recibe 403 y el administrador entra`, sup === 403 && adm === 200, `sup ${sup}, adm ${adm}`);
    }
    for (const [metodo, ruta] of [['PUT', '/config/parametros'], ['PUT', '/config/reglas'], ['PUT', '/config/alcance/1'], ['PUT', '/config/paises/1'], ['POST', '/catalogos/nichos'], ['PUT', '/catalogos/nichos/1'], ['POST', '/config/historial/1/restaurar'], ['POST', '/config/ajustes/reparto.rondas/restaurar']]) {
      const sup = await llamar(metodo, ruta, SUPERVISOR, {});
      prueba(`${metodo} ${ruta}: el supervisor no puede cambiarlo → 403`, sup === 403, String(sup));
    }

    console.log('Cambiar lo operativo');
    for (const [metodo, ruta] of [['POST', '/config/plantillas'], ['POST', '/config/campos'], ['PUT', '/config/avisos']]) {
      const sup = await llamar(metodo, ruta, SUPERVISOR, {});
      prueba(`${metodo} ${ruta}: el supervisor pasa la guarda (responde 200 o 400 por datos vacíos, nunca 403)`, [200, 400, 422].includes(sup), String(sup));
      const ase = await llamar(metodo, ruta, ASESOR, {});
      prueba(`${metodo} ${ruta}: el asesor recibe 403`, ase === 403, String(ase));
    }

    console.log('Quién lleva qué permiso');
    prueba('el Supervisor y el Administrador llevan `proyectos.configurar`', PERMISOS_POR_ROL[ROLES.SUPERVISOR].includes('proyectos.configurar') && PERMISOS_POR_ROL[ROLES.ADMINISTRADOR].includes('proyectos.configurar'));
    prueba('solo el Administrador lleva `proyectos.administrar`', Object.entries(PERMISOS_POR_ROL).every(([rol, p]) => p.includes('proyectos.administrar') === (Number(rol) === ROLES.ADMINISTRADOR)));
    prueba('el asesor no lleva ninguno de los dos', !PERMISOS_POR_ROL[ROLES.ASESOR].some(p => ['proyectos.configurar', 'proyectos.administrar'].includes(p)));
    const [{ n }] = await db.query("SELECT COUNT(*) AS n FROM permisos WHERE codigo = 'proyectos.configurar'", [], 'cfg:permiso');
    prueba('la migración creó el permiso `proyectos.configurar` (una sola vez)', Number(n) === 1, String(n));
  } finally {
    servidor.close();
  }
}

verificar()
  .then(() => { console.log(`\n${buenas} OK, ${malas} fallas`); process.exit(malas ? 1 : 0); })
  .catch((error) => { console.error('Error inesperado:', error); process.exit(1); });
