// scripts/notificaciones/generarIconos.js
// Genera los íconos de las notificaciones y del manifest a partir del isotipo: node scripts/notificaciones/generarIconos.js
const path = require('path');
const sharp = require('sharp');

const ORIGEN = path.join(__dirname, '../../public/assets/logos/LOGO_GP_isotipo.png');
const DESTINO = path.join(__dirname, '../../public/assets/icons');
const FONDO = '#FFFFFF';

// Isotipo centrado sobre fondo sólido; `relleno` es la fracción del lado que ocupa (maskable pide margen).
async function iconoCuadrado(lado, relleno, nombre) {
  const interior = Math.round(lado * relleno);
  const logo = await sharp(ORIGEN).resize(interior, interior, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' }).png().toBuffer();
  await sharp({ create: { width: lado, height: lado, channels: 4, background: FONDO } })
    .composite([{ input: logo, gravity: 'centre' }])
    .png().toFile(path.join(DESTINO, nombre));
}

// Insignia de la barra de estado de Android: blanco sobre transparente (solo cuenta el canal alfa).
// Se toma la silueta de lo que NO es casi blanco del isotipo (el trofeo blanco queda como hueco).
async function insignia(lado, nombre) {
  const { data, info } = await sharp(ORIGEN).resize(lado, lado, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const claro = (data[i] + data[i + 1] + data[i + 2]) / 3 > 200;
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = claro ? 0 : data[i + 3];
  }
  await sharp(data, { raw: info }).png().toFile(path.join(DESTINO, nombre));
}

(async () => {
  require('fs').mkdirSync(DESTINO, { recursive: true });
  await iconoCuadrado(192, 0.7, 'icon-192.png');
  await iconoCuadrado(512, 0.7, 'icon-512.png');
  await iconoCuadrado(512, 0.55, 'icon-512-maskable.png');
  await insignia(72, 'badge-72.png');
  console.log('Íconos generados en public/assets/icons/');
})().catch((e) => { console.error(e.message); process.exit(1); });
