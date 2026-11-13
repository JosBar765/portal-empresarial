// public/modules/incidencias/js/utils/imagen.js
// Las fotos del celular pesan varios megas: se reducen aquí antes de subirlas (más rápido con poca señal y siempre bajo el tope del
// servidor). Si el navegador no puede, se sube la original (el servidor la vuelve a validar y optimizar).
const LADO_MAXIMO = 1600;
const CALIDAD = 0.85;

function cargarImagen(archivo) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolver(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}

export async function reducirImagen(archivo) {
  try {
    if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) return archivo;
    const img = await cargarImagen(archivo);
    const mayor = Math.max(img.naturalWidth, img.naturalHeight);
    // Una foto que ya es chica y liviana se deja como está.
    if (mayor <= LADO_MAXIMO && archivo.size <= 1.5 * 1024 * 1024) return archivo;
    const escala = Math.min(1, LADO_MAXIMO / mayor);
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.max(1, Math.round(img.naturalWidth * escala));
    lienzo.height = Math.max(1, Math.round(img.naturalHeight * escala));
    lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise(resolver => lienzo.toBlob(resolver, 'image/jpeg', CALIDAD));
    if (!blob || blob.size >= archivo.size) return archivo;
    const nombre = String(archivo.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nombre, { type: 'image/jpeg', lastModified: Date.now() });
  } catch (error) {
    return archivo;
  }
}
