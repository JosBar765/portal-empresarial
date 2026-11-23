# Kit del nicho (fase 9d)

Mockups aprobados en Figma: **A9** (edición del administrador, página «06 · Administrador») y **M15** (hoja «Mensajes y guion» del asesor, página «02 · Asesor — celular»).

## Qué es

Para cada nicho, el administrador escribe un **guion de llamada** y **mensajes** de WhatsApp o de correo. El asesor los abre desde la ficha de su empresa con los datos ya puestos. **El portal no envía nada**: se abre WhatsApp (`wa.me`) o el programa de correo (`mailto:`) con el texto escrito y el asesor lo envía.

## Variables

`{empresa}` `{contacto}` `{asesor}` `{articulo}` `{nicho}`. Cualquier otra (por ejemplo `{cliente}` o `{Empresa}`) se rechaza al guardar, con el número del mensaje.

| Variable | De dónde sale |
|---|---|
| `{empresa}` | nombre de la empresa |
| `{contacto}` | contacto principal con datos; sin contacto, «equipo de {empresa}» |
| `{asesor}` | nombre de la persona de la sesión (nunca del cuerpo de la petición) |
| `{articulo}` | artículo del proyecto |
| `{nicho}` | nicho de la empresa |

## Reglas

- **Solo con proyecto activo:** el kit se abre únicamente para una empresa abierta de un proyecto activo (409 si no). El nicho de la **empresa** decide cuál kit aparece.
- **Mensajes que no se pueden armar:** si falta un dato (por ejemplo el artículo del proyecto), un teléfono para WhatsApp o un correo válido para el correo, el mensaje se **oculta con su motivo**. Una variable sin dato nunca queda como `{contacto}` en el texto.
- **Guion:** un dato que falta se deja como hueco `____` para completarlo en la llamada.
- **Kit apagado, sin kit o mensaje apagado:** el asesor no ve nada; la API responde `disponible: false` sin textos.
- **Límites:** guion 4000 caracteres, título 100, texto 1500 y 20 mensajes por kit.
- **No se registra** que el asesor abrió un mensaje: solo se abre el enlace.
- **Historial:** cada cambio del kit queda en el historial de configuración (área «Kit del nicho»). Guardar sin cambios no agrega nada.

## API (`/api/proyectos`)

| Ruta | Quién | Qué |
|---|---|---|
| `GET /config/kits` | `proyectos.administrar` | nichos con el estado de su kit, variables y canales |
| `GET /config/kits/:nichoId` | `proyectos.administrar` | el kit de un nicho (vacío y activo si no existe) |
| `PUT /config/kits/:nichoId` | `proyectos.administrar` | guarda el kit completo (guion, activo y la lista de mensajes) |
| `GET /participaciones/:id/kit` | `proyectos.gestionar`, solo lo propio | guion y mensajes resueltos, con su enlace |

## Datos

Las tablas `proy_kits` y `proy_kit_mensajes` ya venían de la migración de configuración: no hay migración nueva. El canal de cada mensaje es una fila del catálogo `proy_canales`; solo se usan **«WhatsApp»** y **«Correo»** (si alguien los renombra o desactiva, guardar un kit con mensajes responde 409 y lo dice).

## Código

`kit.js` (reglas puras) · `services/kitService.js` · `repositories/kitRepository.js` · `controllers/kitController.js` · frontend `views/kitNicho.js` (A9, ruta `#/kit`) y `views/kitAsesor.js` (M15, botón «Mensajes y guion» de la ficha).

## Verificación

`node scripts/proyectos/verificar-kit.js` (base desechable; 41 comprobaciones): variables y enlaces, permisos, validaciones, historial, kit apagado, mensajes ocultos con su motivo, solo lo propio y proyecto cerrado.
