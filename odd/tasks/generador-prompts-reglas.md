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
- [x] T20 Backend: esquema `reglas`, validación, render del prompt autogenerado, ajuste `recursos_min_publicar`, publicación sin plantilla. (Implementado y verificado con script temporal; pendiente de commit. La FORMA de ajustes ya exige las claves nuevas: aplicar la migración de T22 antes de arrancar el servidor local.)
- [ ] T21 Frontend admin: pestaña Reglas, vista previa del prompt completo, quitar el editor de plantilla.
- [ ] T22 Migración que parte la plantilla v18 en reglas y prueba de equivalencia.
- [ ] T23 Documentación (`esquema_y_contrato.md`, README del módulo).

## Rutas de trabajo
- Cada tarea cierra con un commit convencional en español en `module/generador-prompts` y push.
