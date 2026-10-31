-- 23_prompts_ajuste_marca_de_agua.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Siembra el ajuste global «marca_de_agua» del Generador de Prompts: el texto, el logo y el aspecto de la marca de
--   agua que el asesor aplica a una imagen desde la pantalla «Prompt generado». La marca se compone en el navegador
--   del asesor; la imagen no se sube ni se guarda.
--
-- Qué cambia:
--   Inserta la fila «marca_de_agua» en «prompt_ajustes» solo si no existe: nunca pisa lo que el administrador ya editó.
--   Valores: texto «GRUPO PREMIA»; logo /assets/logos/LOGO_GP_isotipo.png; opacidad 0.18 (de 0.05 a 0.6); ángulo -30
--   grados (de -90 a 90); escala 0.3 = ancho de cada baldosa relativo al lado menor de la imagen (de 0.1 a 0.8);
--   separación 1.5 = espacio entre baldosas en altos de baldosa (de 0.5 a 5); color del texto #FFFFFF (el contorno
--   se deriva del color: oscuro para un color claro y claro para uno oscuro).
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada ni duplica filas):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--   Sin este script el servidor responde un error que indica aplicarlo, porque el ajuste es obligatorio.
--
-- Reversa (solo si hace falta deshacerlo; el servidor vuelve a pedir el ajuste hasta que se aplique de nuevo):
--   DELETE FROM `prompt_ajustes` WHERE `clave` = 'marca_de_agua';

SET NAMES utf8mb4;

INSERT INTO `prompt_ajustes` (`clave`, `valor`, `descripcion`)
SELECT 'marca_de_agua',
'{"texto":"GRUPO PREMIA","logo_url":"/assets/logos/LOGO_GP_isotipo.png","opacidad":0.18,"angulo":-30,"escala":0.3,"separacion":1.5,"color":"#FFFFFF"}',
'Marca de agua que el asesor aplica a una imagen: texto, logo (/assets/ o https del almacenamiento), opacidad, ángulo en grados, escala de la baldosa, separación entre baldosas y color hexadecimal del texto.'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `prompt_ajustes` WHERE `clave` = 'marca_de_agua');
