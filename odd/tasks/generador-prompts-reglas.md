# Generador de Prompts: prompt autogenerado con reglas generales y específicas

## Objetivo
Eliminar la plantilla editable. El prompt se arma solo con: encabezado del sistema (global) + reglas específicas `inicio` + sección generada por los parámetros y las imágenes + reglas específicas `fin`.

## Decisiones del usuario (2026-10-27)
- Reglas generales: ajustes globales (`encabezado_sistema`, `textos_prompt`).
- Reglas específicas del producto: lista en el esquema (`reglas`: clave, etiqueta, texto, posicion inicio|fin, activo). Versionadas con el producto. Aceptan la sintaxis de plantilla ({{var}}, {{#si}}, {{#no}}, recurso_<clave>, grupo_<g>_vacio).
- Sección generada: por grupo y parámetro, reutilizando la maquinaria de `otros_parametros` y los formatos de `textos_prompt`; nada de texto de negocio en el código.
- No hay plantilla editable ni modo avanzado. El editor muestra una vista previa de solo lectura con el prompt completo.
- Recursos requeridos para publicar: mínimo en `limites` (`recursos_min_publicar`), nunca en el código.
- Se autoriza correr la migración en la BD local de desarrollo (verificar `npm run migrate:estado`: development/localhost).
- La plantilla v18 de la medalla se parte en reglas con una migración; el prompt resultante debe ser idéntico al actual (verificar con un script de comparación).

## Tareas
- [x] T20 Backend: esquema `reglas`, validación, render del prompt autogenerado, ajuste `recursos_min_publicar`, publicación sin plantilla. (Implementado y verificado con script temporal; commit 0e8c4cf. La FORMA de ajustes exige las claves nuevas: ya sembradas por la migración de T22 en la BD local.)
- [ ] T21 Frontend admin: pestaña Reglas, vista previa del prompt completo, quitar el editor de plantilla. (Implementada, pendiente de verificar en navegador.)
- [x] T22 Migración `prompts_reglas` (ajustes nuevos + plantillas existentes partidas en reglas) y prueba de equivalencia. (18/18 prompts idénticos, local v18 y producción v5. Aplicada en la BD local `munditrofeos` (development/localhost): la medalla pasó a v19 publicada con 11 reglas, v18 archivada. Sin probar en MariaDB: confirmar versión 10.3.15+ del hosting antes del deploy.)
- [x] T23 Documentación (`esquema_y_contrato.md`, README del módulo). (Contrato actualizado por T20 y T22; README sin la plantilla editable, con reglas, migración `prompts_reglas` y requisito de MariaDB.)
- [ ] T24 Duplicar producto: acción en la fila de Productos y/o opción en «Nuevo producto»; copia el esquema (grupos, parámetros, recursos, reglas) como borrador v1 de un producto con código y nombre nuevos. (Implementada, pendiente de verificar en navegador: `POST /admin/productos/:id/duplicar` y botón «Duplicar» en la fila.)
- [x] T25 Registro de tipos de parámetro: cada tipo declara en un solo lugar su validación del esquema, validación del valor, formato y cuándo está vacío; sin cadenas de `if`/`switch` repartidas. Solo estructura interna: no se agregan tipos nuevos. (Implementada en `services/tipos/`, pendiente de verificar y de commit: el frontend del asesor y del admin aún ramifica por tipo.)

## Rutas de trabajo
- Cada tarea cierra con un commit convencional en español en `module/generador-prompts` y push.
