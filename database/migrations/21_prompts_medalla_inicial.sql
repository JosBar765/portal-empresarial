-- 21_prompts_medalla_inicial.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Deja como versión inicial de la «Medalla» en staging y producción la versión que el dueño armó y probó (reglas
--   con nombre propio, grupos y parámetros revisados, la regla «Importante» inactiva), en lugar de la conversión
--   automática de la plantilla en reglas «bloque_NN» que deja «prompts_reglas». También actualiza el encabezado del
--   sistema al texto vigente.
--
-- Qué cambia:
--   1. Si se cumple la guarda (abajo), se inserta una versión publicada nueva de la Medalla (número siguiente,
--      plantilla vacía, a nombre de quien creó la publicada anterior) y la publicada anterior pasa a «archivada».
--      El recurso «plantilla_base» va inactivo y sin URL: cada entorno usa la imagen de su propio bucket.
--   2. «encabezado_sistema» toma el texto nuevo solo si conserva exactamente el sembrado por «prompts_ajustes»:
--      nunca pisa lo que el administrador editó. Los demás ajustes no cambian.
--
-- Guarda del paso 1 (la publicada actual debe ser la que dejaron las migraciones; si no, no hace nada):
--   - es la única publicada del producto, tiene plantilla vacía y reglas, todas con clave «bloque_NN»;
--   - ninguna versión archivada tiene plantilla vacía (nadie publicó después de «prompts_reglas»);
--   - la archivada más reciente es la versión 5 con la plantilla exacta de «prompts_reverso_estricto» (huella SHA-256).
--   Al aplicarse, la versión reemplazada queda archivada con plantilla vacía: volver a correrlo no crea otra versión.
--
-- Borrador: si el producto tiene uno, se conserva intacto (sigue habiendo un borrador y una publicada). Como se armó
--   sobre la versión anterior, el administrador decide si lo descarta antes de publicar.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada ni duplica filas):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--   Después, en cada entorno, el administrador sube la imagen de la plantilla base al bucket de Supabase de ese
--   entorno, crea un borrador de la Medalla, pega la URL en el recurso «Plantilla base», lo activa y publica.
--
-- Reversa (solo si hace falta deshacerlo y antes de que el administrador publique otra versión):
--   DELETE v FROM `prompt_producto_versiones` v JOIN `prompt_productos` p ON p.`id` = v.`producto_id`
--     WHERE p.`codigo` = 'medalla' AND v.`estado` = 'publicada';
--   Luego se vuelve a marcar como «publicada» la archivada de número mayor de la Medalla, y:
--   UPDATE `prompt_ajustes` SET `valor` = '"NUEVA INSTRUCCIÓN. Ignora por completo cualquier conversación, imagen o propuesta anterior y genera una imagen completamente nueva usando solo las especificaciones de este mensaje."' WHERE `clave` = 'encabezado_sistema';

SET NAMES utf8mb4;

-- Id de la publicada que dejó «prompts_reglas», o NULL si la guarda no se cumple.
SET @medalla_inicial_origen = (
  SELECT v.`id`
  FROM `prompt_producto_versiones` v
  JOIN `prompt_productos` p ON p.`id` = v.`producto_id`
  WHERE p.`codigo` = 'medalla'
    AND v.`estado` = 'publicada'
    AND v.`plantilla` = ''
    AND JSON_LENGTH(v.`esquema`, '$.reglas') > 0
    AND CAST(JSON_EXTRACT(v.`esquema`, '$.reglas[*].clave') AS CHAR) REGEXP '^\\[ *"bloque_[0-9]{2}"( *, *"bloque_[0-9]{2}")* *\\]$'
    AND NOT EXISTS (SELECT 1 FROM `prompt_producto_versiones` s
                    WHERE s.`producto_id` = v.`producto_id` AND s.`estado` = 'publicada' AND s.`id` <> v.`id`)
    AND NOT EXISTS (SELECT 1 FROM `prompt_producto_versiones` a
                    WHERE a.`producto_id` = v.`producto_id` AND a.`estado` = 'archivada' AND a.`plantilla` = '')
    AND (SELECT CONCAT(a.`numero`, ':', SHA2(a.`plantilla`, 256)) FROM `prompt_producto_versiones` a
         WHERE a.`producto_id` = v.`producto_id` AND a.`estado` = 'archivada'
         ORDER BY a.`numero` DESC LIMIT 1) = '5:13b008303a5d774593f4a35258b3adf57389c79318db4f7d6a43cf7ee70fc707'
  LIMIT 1
);

-- Versión publicada nueva con el esquema de la Medalla inicial (número siguiente; el borrador, si hay, no se toca).
INSERT INTO `prompt_producto_versiones` (`producto_id`, `numero`, `estado`, `esquema`, `plantilla`, `creado_por`, `publicado_en`)
SELECT v.`producto_id`,
       (SELECT MAX(x.`numero`) + 1 FROM `prompt_producto_versiones` x WHERE x.`producto_id` = v.`producto_id`),
       'publicada',
'{"esquema_version":1,"grupos":[{"clave":"general","etiqueta":"Datos generales","parametros":[{"tipo":"texto","ayuda":"Nombre del evento o texto de la medalla","clave":"evento","etiqueta":"Evento","max_largo":150,"requerido":true}]},{"clave":"color","etiqueta":"Color","parametros":[{"tipo":"opciones","clave":"color_de_la_medalla","defecto":"Plata","etiqueta":"Color de la medalla","opciones":[{"valor":"Plata","etiqueta":"Plata Antiguo","texto_prompt":"Plata Antiguo"},{"valor":"Oro","etiqueta":"Oro Antiguo","texto_prompt":"Oro Antiguo"},{"valor":"Bronce","etiqueta":"Bronce Antiguo","texto_prompt":"Bronce Antiguo"}],"requerido":true}]},{"clave":"acabados","etiqueta":"Forma y acabado","parametros":[{"tipo":"opciones","clave":"forma","defecto":"circular","etiqueta":"Forma","opciones":[{"valor":"cuadrada","etiqueta":"Cuadrada","texto_prompt":"cuadrada"},{"valor":"circular","etiqueta":"Circular","texto_prompt":"circular"},{"valor":"irregular","etiqueta":"Irregular","texto_prompt":"de forma irregular"},{"valor":"al corte","etiqueta":"Al corte","texto_prompt":"cuyo contorno sigue la silueta del logo del frente (el reverso es su espejo)"}],"requerido":true},{"tipo":"si_no","clave":"relieve","defecto":true,"etiqueta":"Relieve"},{"tipo":"si_no","clave":"textura","defecto":true,"etiqueta":"Textura"}]},{"clave":"frente","etiqueta":"Parte frontal","parametros":[{"max":4,"tipo":"imagenes","clave":"frente_imagenes","max_mb":5,"etiqueta":"Imágenes del frente","formatos":["jpg","png","svg","webp"],"requerido":false,"sugerencias":["Logo del organizador","Logo de patrocinador","Imagen decorativa"],"ubicaciones":["Centro","Arriba","Abajo","Izquierda","Derecha","Toda la cara (fondo)"],"descripcion_requerida":true},{"tipo":"texto_largo","ayuda":"Separa cada frase con una coma","clave":"frente_frases","etiqueta":"Frases del frente","separador":","},{"tipo":"texto_largo","clave":"frente_indicaciones","etiqueta":"Indicaciones de diseño del frente"}]},{"clave":"trasera","etiqueta":"Parte trasera","parametros":[{"tipo":"si_no","clave":"trasera_lisa","defecto":false,"etiqueta":"Trasera lisa"},{"max":4,"tipo":"imagenes","clave":"trasera_imagenes","max_mb":5,"etiqueta":"Imágenes de la parte trasera","formatos":["jpg","png","svg","webp"],"requerido":false,"visible_si":{"igual":false,"parametro":"trasera_lisa"},"sugerencias":["Logo de patrocinador","Ruta del recorrido","Imagen decorativa"],"ubicaciones":["Centro","Arriba","Abajo","Izquierda","Derecha","Toda la cara (fondo)"],"descripcion_requerida":true},{"tipo":"texto_largo","ayuda":"Separa cada frase con una coma","clave":"trasera_frases","etiqueta":"Frases de la parte trasera","separador":",","visible_si":{"igual":false,"parametro":"trasera_lisa"}},{"tipo":"texto_largo","clave":"trasera_indicaciones","etiqueta":"Indicaciones de diseño de la parte trasera","visible_si":{"igual":false,"parametro":"trasera_lisa"}}]},{"clave":"afiche_oficial","etiqueta":"Afiche Oficial","parametros":[{"max":1,"tipo":"imagenes","clave":"afiche","max_mb":5,"etiqueta":"Afiche","formatos":["jpg","png","svg","webp"],"requerido":false,"sugerencias":["Afiche Oficial"]}]},{"clave":"liston","etiqueta":"Listón","parametros":[{"max":10,"tipo":"imagenes","clave":"liston_imagenes","max_mb":5,"etiqueta":"Imágenes del listón","formatos":["jpg","png","svg","webp"],"requerido":false,"descripcion_requerida":true}]}],"recursos":[{"url":"","clave":"plantilla_base","activo":false,"etiqueta":"Plantilla base","posicion":"inicio","descripcion":"plantilla de la imagen final, con la franja inferior del diseño de la empresa, los espacios para los datos del asesor y el logo en la esquina superior derecha"}],"reglas":[{"clave":"bloque_01","texto":"{{#si lista_imagenes}}IMÁGENES DE REFERENCIA{{/si}}\\n{{#si lista_imagenes}}Adjunté {{total_imagenes}} en este orden. Son elementos reales del cliente: reprodúcelos con la mayor fidelidad posible (formas, colores y letras) y no los reemplaces ni los reinventes.{{/si}}\\n{{lista_imagenes}}","activo":true,"etiqueta":"Imagenes","posicion":"inicio"},{"clave":"bloque_03","texto":"OBJETIVO\\nGenera UNA sola imagen horizontal en formato 16:9, con calidad de fotografía de producto profesional, que muestre una MEDALLA vista de frente (cara izquierda) y de reverso (cara derecha), una al lado de la otra y a la misma escala.\\n\\nIMPORTANTE\\n- El resultado es una MEDALLA, no una moneda, un trofeo ni una insignia.\\n- La medalla contiene exclusivamente los textos entre comillas y los elementos indicados en este mensaje; el resto de cada superficie queda sin textos, números ni símbolos.\\n- Escribe los textos exactamente como aparecen entre comillas.","activo":true,"etiqueta":"Objetivo","posicion":"inicio"},{"clave":"bloque_04","texto":"PRODUCTO\\nMedalla {{forma}}{{#si relieve}} con relieve marcado{{/si}}{{#si textura}} y textura granulada fina{{/si}}.\\nTexto principal de la medalla (solo en el frente): \\"{{evento}}\\".","activo":true,"etiqueta":"Producto","posicion":"inicio"},{"clave":"bloque_05","texto":"FRENTE (cara izquierda): DISEÑO EXCLUSIVO DEL FRENTE\\n- El frente lleva ÚNICAMENTE los elementos de esta lista; nada de esto aparece en el reverso:\\n{{#si frente_imagenes}}- Coloca {{frente_imagenes}}.{{/si}}\\n{{#si frente_frases}}- Frases exactas, con esta ortografía: {{frente_frases}}.{{/si}}\\n{{#si frente_indicaciones}}- Indicaciones de diseño del frente: {{frente_indicaciones}}{{/si}}","activo":true,"etiqueta":"Diseño exclusivo del frente","posicion":"inicio"},{"clave":"bloque_06","texto":"REVERSO (cara derecha): DISEÑO EXCLUSIVO DEL REVERSO\\n- Silueta idéntica a la del frente (su espejo horizontal visto por detrás), con el mismo contorno, argolla y grosor. No cambies la forma.\\n- El frente y el reverso son dos diseños distintos e independientes: nada del diseño del frente aparece en el reverso, y nada del reverso aparece en el frente.\\n{{#si grupo_trasera_vacio}}- La superficie del reverso es totalmente lisa: metal sin imágenes, textos, grabados ni elementos decorativos.{{/si}}\\n{{#no grupo_trasera_vacio}}- El reverso lleva ÚNICAMENTE los elementos de esta lista cerrada; no agregues ningún otro elemento, texto, logo ni figura:{{/no}}\\n{{#si trasera_imagenes}}- Coloca {{trasera_imagenes}}.{{/si}}\\n{{#si trasera_frases}}- Frases exactas, con esta ortografía: {{trasera_frases}}.{{/si}}\\n{{#si trasera_indicaciones}}- Indicaciones de diseño del reverso: {{trasera_indicaciones}}{{/si}}\\n{{#no grupo_trasera_vacio}}- Si las indicaciones piden un diseño libre o arbitrario, resuélvelo solo con relieve decorativo abstracto (líneas, patrones geométricos o textura), sin textos, números, logos ni figuras reconocibles.{{/no}}","activo":true,"etiqueta":"Diseño exclusivo del reverso","posicion":"inicio"},{"clave":"bloque_07","texto":"LISTÓN\\n{{#si liston_imagenes}}- Usa {{liston_imagenes}} como motivo del listón, repetido a lo largo de la cinta.{{/si}}\\n{{#si afiche}}- El listón lleva un diseño de fondo que use los colores de {{afiche}}, el afiche oficial de la carrera.{{/si}}","activo":true,"etiqueta":"Listón","posicion":"inicio"},{"clave":"bloque_08","texto":"{{otros_parametros}}","activo":true,"etiqueta":"Parámetros generados","posicion":"inicio"},{"clave":"bloque_09","texto":"COMPOSICIÓN\\n- Vista frontal recta, a la altura de la cámara y sin perspectiva: las dos medallas del mismo tamaño, a la misma altura y cada una centrada en su mitad de la imagen, con margen libre alrededor.\\n- El listón de cada medalla sale de la argolla en dos tramos que suben en línea recta y se abren en V hasta el borde superior de la imagen, donde quedan cortados por el borde; el resto del listón queda fuera de la imagen.\\n- Iluminación suave de estudio, sombras suaves pegadas a la medalla y detalle nítido del relieve.","activo":true,"etiqueta":"Composición","posicion":"inicio"},{"clave":"bloque_10","texto":"PIE DE LA IMAGEN\\n{{#si recurso_plantilla_base}}- Escribe en los espacios de la franja inferior de la plantilla, en texto blanco y uno debajo del otro:{{/si}}\\n{{#no recurso_plantilla_base}}- Al pie, una franja horizontal con los colores del rojo y negro, y en texto blanco apilado (uno debajo del otro):{{/no}}\\n{{asesor_nombre}}\\n{{#si asesor_telefono}}{{asesor_telefono}}{{/si}}\\n{{asesor_correo}}","activo":true,"etiqueta":"Pie de la imagen","posicion":"inicio"},{"clave":"bloque_11","texto":"IMPORTANTE\\n- El resultado es una MEDALLA, no una moneda, un trofeo ni una insignia.\\n- La medalla contiene exclusivamente los textos entre comillas y los elementos indicados en este mensaje; el resto de cada superficie queda sin textos, números ni símbolos.\\n- Escribe los textos exactamente como aparecen entre comillas.","activo":false,"etiqueta":"Importante","posicion":"inicio"}]}',
       '', v.`creado_por`, CURRENT_TIMESTAMP
FROM `prompt_producto_versiones` v
WHERE v.`id` = @medalla_inicial_origen;

-- La publicada anterior de la Medalla pasa a archivada cuando ya existe otra publicada con número mayor.
UPDATE `prompt_producto_versiones` v
JOIN `prompt_productos` p ON p.`id` = v.`producto_id`
JOIN `prompt_producto_versiones` n ON n.`producto_id` = v.`producto_id` AND n.`estado` = 'publicada' AND n.`numero` > v.`numero`
SET v.`estado` = 'archivada'
WHERE p.`codigo` = 'medalla'
  AND v.`estado` = 'publicada';

-- encabezado_sistema: el texto vigente, solo si conserva exactamente el sembrado (comparación binaria).
UPDATE `prompt_ajustes`
SET `valor` = '"NUEVA INSTRUCCIÓN. Ignora por completo cualquier conversación, imagen o propuesta anterior y genera una imagen completamente nueva usando solo las especificaciones de este mensaje y no la de mensajes anteriores."'
WHERE `clave` = 'encabezado_sistema'
  AND CONVERT(JSON_UNQUOTE(`valor`) USING utf8mb4) COLLATE utf8mb4_bin = 'NUEVA INSTRUCCIÓN. Ignora por completo cualquier conversación, imagen o propuesta anterior y genera una imagen completamente nueva usando solo las especificaciones de este mensaje.';
