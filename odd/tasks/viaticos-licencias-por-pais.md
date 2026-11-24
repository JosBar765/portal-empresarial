# Viáticos: licencias, placas y reglas por país

Rama: `feat/viaticos-licencias-por-pais` (desde `dev` con las PR #210 a #216 fusionadas). Migración: `58_viaticos_licencias_por_pais`.

## Problema
Los tipos de licencia son globales y por eso la migración 55 los prefijó (`GT-A`, `GT-B`), algo ilegible. Las placas y las reglas ya son por país; los tipos de licencia no.

## Decisiones del dueño
- El tipo de licencia pertenece a un país (`pais_id`), igual que el tipo de placa y la regla: el código ya no lleva prefijo (`B`, `C1`, `4A`) y es único dentro del país.
- Una sola pestaña en Configuración, con selector de país, que administra para ese país: tipos de licencia, tipos de placa y reglas. Reemplaza a las pestañas «Tipos de licencia», «Reglas de licencia» y la de tipos de placa (si existe aparte).
- La migración limpia los datos anteriores y deja los nuevos.
- Solo se toca esta parte; nada más del módulo.

## Decisión de implementación (la migración)
Transforma en el lugar en vez de borrar y recrear: los registros de `viaticos_licencias` (licencia de cada persona), `viaticos_pilotos` y `viaticos_reglas_licencia` apuntan a los tipos por id, y un borrado perdería esos datos en staging. Resultado final igual de limpio: sin prefijos, sin el nombre del país dentro del nombre, con `pais_id`. Los tipos sin país que nadie referencia se borran.

## Tareas
- [x] T1 Migración 58 (MariaDB 11.8 y MySQL 8; idempotente) y modelo: `viaticos_tipos_licencia.pais_id`, único (país, código).
- [x] T2 Backend: catálogo de tipos de licencia por país, reglas validan que licencia, placa y regla sean del mismo país, consultas que muestran el código (personas, pilotos, solicitudes, catálogo de la solicitud, PDF), mensajes.
- [x] T3 Front: pestaña única «Licencias y placas» con selector de país; formularios de personas y pilotos con los tipos agrupados por país; quitar el recorte del prefijo en el selector de conductor y en el PDF.
- [x] T4 Docs: README, `modelo_datos.md`, `contrato_api.md`, `plano_frontend.md`.
- [x] T5 Verificación (sin MariaDB): `node --check`; migración 58 aplicada en la base local (MySQL 8.4): 36 tipos con país y sin prefijo, 4 licencias de personas, 1 piloto y 41 reglas conservados, índice único (país, código), llave foránea y pais_id NOT NULL; repetirla no cambia nada; API con la cuenta de desarrollo (alta por país, duplicado en el mismo país 409, mismo código en otro país permitido, regla con licencia de otro país 400, solicitud con licencia o piloto de otro país inválida con mensaje que nombra el país); pestaña «Licencias y placas» revisada en el navegador (selector de país, tres secciones, formulario de alta con país fijo; abre en Guatemala). Sin probar: MariaDB 11.8 (la prueba es subirla a staging), editar y eliminar desde la pestaña, y formularios de personas.

## Alcance autorizado
Migración 58, `src/modules/viaticos/**`, `public/modules/viaticos/**`, `.agents/modulos/viaticos/**` y este archivo.

## Ruta
Mapeo de más de 5 consultas y varios archivos no triviales: un escritor delegado que primero lee. Sin runner de pruebas: RED/GREEN no aplica; se verifica con scripts de un solo uso y la API.

## Progreso
- T1 hecha (sin ejecutar: sin BD en este paso): migración `58_viaticos_licencias_por_pais.sql` transforma en el lugar (columna, quita único global, prefijo a país, borra huérfanos, único (país, código), FK, NOT NULL condicional); solo sintaxis ya usada en 40/56/57, sin CHECK+COMMENT ni IF NOT EXISTS en DDL. Ejecución real pendiente en T5.
- T2 hecha: catálogo `tipos-licencia` por país (`catalogos.js`), `tipoLicenciaPorId` devuelve el país, regla valida mismo país (`regla.licenciaOtroPais`), consultas de personas y pilotos exponen `tipoLicenciaPaisId`/`tipoLicenciaPaisNombre`, validación de solicitud con mensajes `solicitud.licenciaOtroPais` y `solicitud.piloto.licenciaOtroPais`, PDF sin recorte de prefijo. La lista del catálogo se filtra por país en el cliente (sin filtro en servidor).
- T3 hecha: pestaña única «Licencias y placas» (`licenciasPlacas.js`, `tiposPorPais.js`, `licenciaTexto.js`), selects agrupados por país en Personas y Pilotos, tablas «Tipo B (País)», sin recorte de prefijo en `conductor.js`; país recordado solo en memoria (se quitó `CLAVES_LOCALES.PAIS_REGLAS`).
- T4 hecha: README, `modelo_datos.md`, `contrato_api.md`, `plano_frontend.md`.
- Verificado: `node --check` de todo lo tocado y script de un solo uso de `erroresDeLicencia` y `licenciaTexto`. Sin verificar: migración en MySQL/MariaDB, API y navegador (T5).
- Ajuste posterior: la pestaña abre en Guatemala si tiene datos (antes en el primer país por orden alfabético).
