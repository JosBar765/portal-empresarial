#!/usr/bin/env node
// scripts/vales/verificar-bajas.js
// Comprueba el registro permanente de bajas (`vale_bajas`): cada vale eliminado por uno de los cuatro caminos deja
// una fila con su código, cliente, dueño, razón, estado, fecha de entrega y horas (y el enlace al borrador si venció);
// quitar un solo taller de un vale con varios deja una fila `TALLER_QUITADO` y el vale sigue vivo; revertir una
// creación fallida no deja nada; y si el registro falla, el vale no se borra.
//
// Uso (base DESECHABLE con las migraciones aplicadas; crea vales de prueba y limpia al terminar):
//   node --require ./scripts/security/stub-storage.js scripts/vales/verificar-bajas.js
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const PREFIJO = 'PRUEBA-BAJA';

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};

async function main() {
  const db = require(path.join(RAIZ, 'src', 'config', 'database'));
  await db.listo;
  const servicios = path.join(RAIZ, 'src', 'modules', 'vales', 'services');
  const valeCreacionService = require(path.join(servicios, 'valeCreacionService'));
  const valeAdjuntosService = require(path.join(servicios, 'valeAdjuntosService'));
  const valeRepository = require(path.join(RAIZ, 'src', 'modules', 'vales', 'repositories', 'valeRepository'));

  const [asesor] = await db.query(
    'SELECT u.id, u.nombre, u.email, a.tienda_id FROM asesores a JOIN usuarios u ON u.id = a.usuario_id ORDER BY u.id LIMIT 1', [], 'bajas:asesor'
  );
  const [admin] = await db.query('SELECT id, nombre, email FROM usuarios WHERE rol_id = 1 ORDER BY id LIMIT 1', [], 'bajas:admin');
  const [taller] = await db.query('SELECT id FROM talleres WHERE activo = 1 ORDER BY id LIMIT 1', [], 'bajas:taller');
  const actorAsesor = { id: asesor.id, nombre: asesor.nombre, rolId: 2, permissions: ['vales.crear', 'vales.ver'] };
  const actorAdmin = { id: admin.id, nombre: admin.nombre, rolId: 1, permissions: [] };

  let contador = 0;
  const correlativos = [];
  async function crearVale({ estado, vigenciaPasada = false, originalId = null, modificado = 0, prefijo = '' }) {
    const correlativo = `${prefijo}${PREFIJO}-${Date.now()}-${++contador}`;
    correlativos.push(correlativo);
    const res = await db.query(
      `INSERT INTO vales (correlativo, asesor_id, tienda_id, vale_original_id, fecha_creacion, hora_creacion, fecha_entrega, fecha_evento,
         cliente_empresa, cliente_nombre, cliente_telefono, cliente_correo, producto, material, cantidad, cotizacion, modificado,
         vigencia_hasta, estado_id)
       VALUES (?, ?, ?, ?, CURDATE(), CURTIME(), DATE_ADD(NOW(), INTERVAL 10 DAY), DATE_ADD(NOW(), INTERVAL 12 DAY),
         'Empresa de prueba S.A.', 'Cliente de prueba', '+502 12345678', 'prueba@example.com', 'Medalla', 'Metal', 10, 100, ?,
         ${vigenciaPasada ? 'DATE_SUB(NOW(), INTERVAL 1 HOUR)' : 'NULL'}, (SELECT id FROM estados_vale WHERE nombre = ?))`,
      [correlativo, asesor.id, asesor.tienda_id, originalId, modificado, estado], 'bajas:vale'
    );
    const [vale] = await db.query('SELECT id, correlativo, creado_en FROM vales WHERE id = ?', [res.insertId], 'bajas:vale_leer');
    return vale;
  }
  const existe = async (id) => (await db.query('SELECT 1 FROM vales WHERE id = ?', [id], 'bajas:existe')).length > 0;
  const bajasDe = (correlativo) => db.query('SELECT * FROM vale_bajas WHERE correlativo = ? ORDER BY id', [correlativo], 'bajas:leer');
  const hacePoco = (fecha) => Math.abs(Date.now() - new Date(String(fecha).replace(' ', 'T')).getTime()) < 5 * 60 * 1000;

  try {
    console.log('1. Baja del asesor (a propósito)');
    {
      const vale = await crearVale({ estado: 'ESPERANDO_AUTORIZACION' });
      await valeCreacionService.darDeBaja(actorAsesor, vale.id);
      const [b, ...otras] = await bajasDe(vale.correlativo);
      prueba('el vale ya no existe y queda una sola fila de registro', !(await existe(vale.id)) && !!b && otras.length === 0);
      prueba('guarda código, empresa, cliente y el estado que tenía',
        b && b.correlativo === vale.correlativo && b.cliente_empresa === 'Empresa de prueba S.A.' && b.cliente_nombre === 'Cliente de prueba' && b.estado === 'ESPERANDO_AUTORIZACION',
        JSON.stringify(b));
      prueba('guarda de quién era el vale (id, nombre y correo)', b && b.asesor_id === asesor.id && b.asesor_nombre === asesor.nombre && b.asesor_correo === asesor.email);
      prueba('la razón dice «eliminado por: correo» y guarda quién fue', b && b.motivo === 'BAJA_ASESOR' && b.razon === `eliminado por: ${asesor.email}`
        && b.eliminado_por_id === asesor.id && b.eliminado_por_correo === asesor.email, b && b.razon);
      prueba('guarda la hora de creación del vale y la de eliminación', b && b.creado_en_vale === vale.creado_en && hacePoco(b.eliminado_en), b && `${b.creado_en_vale} / ${b.eliminado_en}`);
      prueba('un vale que no es de una modificación no guarda original', b && b.vale_original_correlativo === null);
    }

    console.log('2. Vencimiento de la vigencia');
    {
      const vale = await crearVale({ estado: 'ESPERANDO_AUTORIZACION', vigenciaPasada: true });
      const eliminado = await valeCreacionService.expirarVale(vale.id);
      const [b] = await bajasDe(vale.correlativo);
      prueba('el vale se elimina y la razón es «vencimiento», sin persona',
        eliminado === true && !(await existe(vale.id)) && b && b.motivo === 'VENCIMIENTO_VIGENCIA' && b.razon === 'vencimiento'
        && b.eliminado_por_id === null && b.eliminado_por_correo === null && b.asesor_correo === asesor.email, JSON.stringify(b));
      const [borrador] = await db.query('SELECT id, origen_motivo, talleres_ids FROM vale_borradores WHERE correlativo_origen = ?', [vale.correlativo], 'bajas:borrador');
      prueba('el vencimiento deja un borrador del asesor y la baja guarda su id y la fecha de entrega que se quería',
        !!borrador && borrador.origen_motivo === 'VENCIMIENTO_VIGENCIA' && b && b.borrador_id === borrador.id && b.fecha_entrega !== null, JSON.stringify({ borrador, b }));
    }

    console.log('3. Vencimiento de adjuntos');
    {
      const vale = await crearVale({ estado: 'CREADO' });
      await db.query(
        `INSERT INTO vale_talleres (vale_id, taller_id, estado_id, activo, adjuntos_vence_en)
         VALUES (?, ?, (SELECT id FROM estados_taller WHERE nombre = 'ADJUNTOS_RECHAZADOS'), 1, DATE_SUB(NOW(), INTERVAL 1 HOUR))`,
        [vale.id, taller.id], 'bajas:fila_adjuntos'
      );
      const eliminado = await valeAdjuntosService.expirarPorAdjuntos(vale.id);
      const [b] = await bajasDe(vale.correlativo);
      prueba('el vale se elimina y la razón es «vencimiento»',
        eliminado === true && !(await existe(vale.id)) && b && b.motivo === 'VENCIMIENTO_ADJUNTOS' && b.razon === 'vencimiento' && b.estado === 'CREADO', JSON.stringify(b));
    }

    console.log('4. Solicitud de modificación rechazada');
    {
      const original = await crearVale({ estado: 'RECIBIDO', modificado: 1 });
      const mod = await crearVale({ estado: 'SOLICITANDO_MODIFICACION', originalId: original.id, prefijo: 'MOD-' });
      await valeCreacionService.rechazarCreacion(actorAdmin, mod.id, 'Motivo de prueba', { modificacion: true });
      const [b] = await bajasDe(mod.correlativo);
      const [orig] = await db.query('SELECT modificado FROM vales WHERE id = ?', [original.id], 'bajas:original');
      prueba('la modificación se elimina y guarda «rechazado por: correo» y el código del original',
        !(await existe(mod.id)) && b && b.motivo === 'MODIFICACION_RECHAZADA' && b.razon === `rechazado por: ${admin.email}`
        && b.vale_original_correlativo === original.correlativo && b.estado === 'SOLICITANDO_MODIFICACION', JSON.stringify(b));
      prueba('una modificación no deja borrador y su baja no guarda borrador_id',
        b && b.borrador_id === null && (await db.query('SELECT 1 FROM vale_borradores WHERE correlativo_origen = ?', [mod.correlativo], 'bajas:borrador_mod')).length === 0);
      prueba('el original sigue existiendo y queda reabierto', (await existe(original.id)) && orig.modificado === 0);
      prueba('el original no deja registro de baja', (await bajasDe(original.correlativo)).length === 0);
    }

    console.log('5. Lo que no debe registrarse');
    {
      const vale = await crearVale({ estado: 'ESPERANDO_AUTORIZACION' });
      await valeCreacionService.eliminarValeConArchivos(vale.id);
      prueba('revertir una creación fallida (sin baja) borra el vale y no deja registro', !(await existe(vale.id)) && (await bajasDe(vale.correlativo)).length === 0);
    }

    console.log('6. Si el registro falla, el vale no se borra');
    {
      const vale = await crearVale({ estado: 'ESPERANDO_AUTORIZACION' });
      const falla = await valeRepository.eliminarYReabrirOriginal({
        valeId: vale.id, valeOriginalId: null, usuarioId: asesor.id, accionHistorial: 'x',
        baja: { motivo: 'M'.repeat(60), razon: 'prueba', actorId: null, actorCorreo: null }
      }).then(() => null, (e) => e);
      prueba('el registro inválido falla y el vale sigue intacto (todo o nada)', !!falla && (await existe(vale.id)) && (await bajasDe(vale.correlativo)).length === 0,
        falla ? falla.message : 'no falló');
    }

    console.log('7. Quitar un solo taller de un vale con varios talleres (el vale sigue vivo)');
    {
      const [otro] = await db.query('SELECT id FROM talleres WHERE activo = 1 AND id <> ? ORDER BY id LIMIT 1', [taller.id], 'bajas:otro_taller');
      if (!otro) {
        console.log('  (se omite: hace falta un segundo taller activo)');
      } else {
        for (const automatico of [false, true]) {
          const etiqueta = automatico ? 'automático (adjuntos vencidos)' : 'manual (el asesor)';
          const vale = await crearVale({ estado: 'CREADO' });
          const filaTaller = (tallerId, vence) => db.query(
            `INSERT INTO vale_talleres (vale_id, taller_id, estado_id, activo, adjuntos_vence_en)
             VALUES (?, ?, (SELECT id FROM estados_taller WHERE nombre = 'ADJUNTOS_RECHAZADOS'), 1, ${vence})`, [vale.id, tallerId], 'bajas:fila_taller');
          await filaTaller(taller.id, automatico ? 'DATE_SUB(NOW(), INTERVAL 1 HOUR)' : 'DATE_ADD(NOW(), INTERVAL 1 DAY)');
          await filaTaller(otro.id, 'DATE_ADD(NOW(), INTERVAL 1 DAY)');
          await db.query('UPDATE vales SET talleres_solicitados = ? WHERE id = ?', [`${taller.id},${otro.id}`, vale.id], 'bajas:solicitados');
          if (automatico) await valeAdjuntosService.expirarPorAdjuntos(vale.id);
          else await valeAdjuntosService.quitarTallerDeVale(vale.id, taller.id, { actor: actorAsesor });
          const filas = await db.query("SELECT * FROM vale_bajas WHERE correlativo = ? AND motivo = 'TALLER_QUITADO'", [vale.correlativo], 'bajas:taller_quitado');
          const [b] = filas;
          const [v] = await db.query('SELECT talleres_solicitados FROM vales WHERE id = ?', [vale.id], 'bajas:solicitados_leer');
          prueba(`${etiqueta}: deja UNA fila TALLER_QUITADO con el taller, y el vale sigue vivo con el otro taller`,
            filas.length === 1 && b.taller_id === taller.id && !!b.taller_nombre && (await existe(vale.id)) && v.talleres_solicitados === String(otro.id), JSON.stringify(b));
          prueba(`${etiqueta}: la razón y quién la decidió son correctos`,
            automatico
              ? /^adjuntos vencidos: taller /.test(b.razon) && b.eliminado_por_id === null
              : b.razon === `taller quitado por: ${asesor.email}` && b.eliminado_por_id === asesor.id, b && b.razon);
        }
      }
    }
  } finally {
    // Limpieza, pase lo que pase: nada de esta prueba debe quedar en la base.
    await db.query('DELETE FROM vale_borradores WHERE correlativo_origen IN (?)', [correlativos.length ? correlativos : ['-']], 'bajas:limpiar_borradores');
    await db.query('DELETE FROM vale_bajas WHERE correlativo IN (?)', [correlativos.length ? correlativos : ['-']], 'bajas:limpiar_bajas');
    await db.query('DELETE FROM notificaciones WHERE vale_id IN (SELECT id FROM vales WHERE correlativo IN (?))', [correlativos.length ? correlativos : ['-']], 'bajas:limpiar_notificaciones');
    await db.query('DELETE FROM vales WHERE correlativo IN (?)', [correlativos.length ? correlativos : ['-']], 'bajas:limpiar_vales');
  }

  console.log(malas ? `\n${malas} verificación(es) fallaron (${buenas} correctas).` : `\nTodo correcto (${buenas} verificaciones).`);
  process.exit(malas ? 1 : 0);
}

main().catch((e) => { console.error('ERROR', e); process.exit(1); });
