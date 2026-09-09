// scripts/diagnosticar-supabase.js
// Prueba aislada de Supabase Storage: sube y borra un archivo diminuto
// directo con el SDK, sin pasar por Express/multer/imageOptimizer/nada del
// resto de la app — sirve para confirmar si un error (ej. "Forbidden") es
// del lado de Supabase (key/bucket/políticas) o de nuestro propio código.
//
// Uso: node scripts/diagnosticar-supabase.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET;

console.log('--- Configuración leída de .env ---');
console.log('SUPABASE_URL:', url || '(vacío)');
console.log('SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY:', secretKey ? `${secretKey.slice(0, 12)}... (${secretKey.length} caracteres)` : '(vacío)');
console.log('SUPABASE_STORAGE_BUCKET:', bucket || '(vacío)');
console.log('');

if (!url || !secretKey || !bucket) {
  console.error('Faltan variables — revisa tu .env antes de seguir.');
  process.exit(1);
}

async function main() {
  const client = createClient(url, secretKey);
  const objectPath = `diagnostico-${Date.now()}.txt`;
  const contenido = Buffer.from('archivo de prueba — se borra solo');

  console.log(`Intentando subir "${objectPath}" al bucket "${bucket}"...`);
  const { data: subida, error: errorSubida } = await client.storage
    .from(bucket)
    .upload(objectPath, contenido, { contentType: 'text/plain' });

  if (errorSubida) {
    console.error('\n❌ FALLÓ LA SUBIDA. Error completo devuelto por Supabase:');
    console.error(JSON.stringify(errorSubida, Object.getOwnPropertyNames(errorSubida), 2));
    process.exit(1);
  }

  console.log('✅ Subida exitosa:', subida);

  const { data: urlPublica } = client.storage.from(bucket).getPublicUrl(objectPath);
  console.log('URL pública:', urlPublica.publicUrl);

  console.log(`\nBorrando "${objectPath}" (limpieza)...`);
  const { error: errorBorrado } = await client.storage.from(bucket).remove([objectPath]);
  if (errorBorrado) {
    console.error('⚠️  Se subió bien pero no se pudo borrar (queda el archivo de prueba en el bucket):');
    console.error(JSON.stringify(errorBorrado, Object.getOwnPropertyNames(errorBorrado), 2));
    process.exit(1);
  }

  console.log('✅ Todo funcionó: subir, generar URL pública, y borrar.');
}

main().catch(err => {
  console.error('\n❌ Excepción no esperada (antes de llegar a Supabase):');
  console.error(err);
  process.exit(1);
});
