# Diseño Local entre países

Permite que los asesores de un país envíen vales a los Diseño Local de otros países de la región. El dato vive en `paises.comparte_diseno_local` (migración `pais_comparte_diseno_local`) y se edita en Administración Central › Horarios y feriados › «Diseño Local entre países» (permiso `admin.horarios.gestionar`, `PUT /api/admin/horarios/paises/:id/comparte-diseno-local` con `{ comparte: true|false }`).

## Regla de elegibilidad

Un Diseño Local L es elegible para un asesor de la tienda T (país P) si:

1. L atiende T (`taller_local_tiendas`, como antes), o
2. `comparte_diseno_local = 1` en P **y** en el país de la sede de L.

Los talleres generales siguen siendo elegibles para todos. Ningún nombre de país está en el código: Guatemala queda fuera porque su bandera es 0 (así se deja la migración). El país de una tienda o de un Local se calcula como en el calendario: departamento, si no subdivisión y, en último caso, empresa.

## Combinación en un vale

- Talleres generales entre sí, o Diseño Local entre sí **solo del mismo país** (el de la sede).
- Nunca un general con un Local, ni Locales de países distintos (entre países todavía no se comparten vales ni propuestas).
- Los mensajes explican qué falló, la regla y cómo corregirlo (`MENSAJES_ELECCION_TALLERES` en `valeHelpers.js`).

## Dónde se aplica

`validarEleccionTalleres` y `talleresElegiblesDeTienda` (`valeHelpers.js`) reciben el contexto del asesor (`tallerRepository.contextoDeTienda`: tienda, país y bandera) en la creación, la corrección, los borradores, el catálogo, las fechas de entrega y el cupo. Las modificaciones (`MOD-`) heredan los talleres del original y no pasan por esta regla. `GET /api/vales/catalogos` agrega `miPais` (`{ id, nombre, comparteDisenoLocal }`) y cada taller trae `pais_id`, `pais_nombre` y `pais_comparte_diseno_local` (nulos en los generales).

Fechas, feriados y horarios de un vale enviado a un Local de otro país usan el país de ese taller (`calendarioLaboral`: `paisId` del taller), sin cambios.

## Combobox del formulario

El select «Agregar taller…» usa `<optgroup>`: Talleres generales; Diseño Local del país del asesor; los demás Diseño Local, un grupo por país en orden alfabético. Al elegir un Local se deshabilitan los generales y los Locales de otro país; al elegir un general, los Locales.

## Código telefónico del cliente

El selector del código de país del teléfono se preselecciona con el país de la tienda de quien crea el vale (`miPais`, tomado de `paises.codigo_telefono`); se puede cambiar. Al editar un borrador o corregir un vale se respeta el código ya guardado. Sin tienda se conserva Guatemala.
