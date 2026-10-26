# Módulo Generador de Prompts

Rama: `module/generador-prompts` (desde dev 884a872). Sin push.
Base: `.agents/modulos/generador de prompts/analisis_modulo.md` y `propuesta_modulo.md`. Mockup: https://www.figma.com/design/XB3lOHqrqObxxQnr78rIiT

## Objetivo
Módulo nuevo e independiente. El asesor completa los parámetros de un producto (hoy, la medalla) y el portal arma un prompt de texto para pegar en un generador de imágenes (Gemini). No genera imágenes. La vista de administración define los productos y sus parámetros sin tocar código.

## Decisiones (todas del usuario)
- Parámetros de cada producto en JSON dentro de una columna MySQL, por versión inmutable. Un borrador y una versión publicada por producto.
- Nada se guarda por propuesta: sin historial, sin número de propuesta, sin tabla de propuestas. El servidor arma el prompt y lo devuelve sin escribir.
- Las imágenes viven solo en el navegador. Se copian como una lámina numerada única (canvas) más el prompt, en un solo ítem del portapapeles (`image/png` + `text/plain`); si el generador no toma ambos, quedan dos botones separados.
- Roles: usan el módulo Asesor (rol 2) y Supervisor (rol 3); administra el Administrador (rol 1).
- Contacto del pie desde `asesores.telefono` o `supervisores.telefono`. Si falta el teléfono, el servidor responde con una excepción y el asesor puede aceptar generar sin número (solo nombre y correo).
- Siempre en español. Pie fijo: logo del portal y colores del logo.
- Marca de agua obligatoria (regla de gerencia): el prompt pide el logo y la frase «Grupo Premia». Se prueba así; si falla se analiza una segunda etapa.
- Cada prompt es una instrucción nueva: encabezado fijo del sistema que pide ignorar cualquier propuesta anterior; se pega en un chat nuevo.
- Plantilla v1 optimizada para Gemini (texto exacto entre comillas, formato 16:9, fondo plano, lámina de referencia, sin negaciones).
- Sin sockets ni `events.js`. El único acoplamiento con otro módulo es leer el contacto del asesor.

## Tareas
- [ ] T0 Documentos de análisis y propuesta en la rama.
- [ ] T1 BD: tablas en `schema.sql`, permisos en `seed.sql` y migración idempotente (tablas, permisos, producto Medalla v1 publicada con esquema y plantilla).
- [ ] T2 Backend: `src/modules/prompts` (esquema, plantilla, contacto, productos, versiones, rutas), catálogo `MODULOS` y montaje en `app.js`.
- [ ] T3 Front asesor: formulario dinámico, lámina numerada, copiar todo, modal sin teléfono.
- [ ] T4 Front administración: lista, editor de parámetros, plantilla, vista previa y JSON.
- [ ] T5 Documentación del módulo y mapa de docs de `CLAUDE.md`.
- [ ] T6 Verificación final (sintaxis, pruebas de funciones puras) y resumen.

## Checks
Sin suite de tests (excepción a RED/GREEN): `node --check` en todo JS tocado y comprobaciones con `node -e` de las funciones puras (validación de esquema, render de plantilla). El servidor lo levanta el usuario; las migraciones no se ejecutan contra bases reales desde aquí.

## Route declaration
- T1 a T5: delegated direct (un escritor por tarea, varias carpetas y archivos no triviales), tras un mapeo de patrones por un explorador de solo lectura.

## Progreso
Rama creada. Pendiente T0.
