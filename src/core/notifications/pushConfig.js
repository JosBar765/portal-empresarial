// Claves VAPID del Web Push: OPCIONALES (excepción a "todas obligatorias"). Cada entorno usa las suyas: una suscripción solo admite
// envíos firmados con la clave con la que se creó. En `test` queda siempre apagado.
const APAGADO = Object.freeze({ habilitado: false, publicKey: '', privateKey: '', subject: '' });
const ENTORNOS = ['development', 'staging', 'production'];

function leerPush(env, nodeEnv, avisar = console.warn) {
  const publica = (env.VAPID_PUBLIC_KEY || '').trim();
  const privada = (env.VAPID_PRIVATE_KEY || '').trim();
  const subject = (env.VAPID_SUBJECT || '').trim();
  const presentes = [publica, privada, subject].filter(Boolean).length;
  if (!ENTORNOS.includes(nodeEnv) || presentes === 0) return APAGADO;
  if (presentes < 3) {
    avisar('[Push] Avisos del sistema desactivados: faltan VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY o VAPID_SUBJECT.');
    return APAGADO;
  }
  const base64url = /^[A-Za-z0-9_-]+$/;
  if (!base64url.test(publica) || !base64url.test(privada) || !/^(mailto:|https:\/\/)\S+$/.test(subject)) {
    avisar('[Push] Avisos del sistema desactivados: las claves VAPID o VAPID_SUBJECT (mailto: o https:) no tienen un formato válido.');
    return APAGADO;
  }
  return { habilitado: true, publicKey: publica, privateKey: privada, subject };
}

module.exports = { leerPush };
