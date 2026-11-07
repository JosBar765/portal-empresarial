# Plan de implementación del módulo Proyectos

Estado: **mockup aprobado por el dueño el 2026-11-07**; falta empezar la fase 1 de código. Es el plan de trabajo de la Parte B de `Documento_Idea_Modulo_Proyectos.docx`, en formato de seguimiento. Fuentes: `propuesta_modulo.md`, `acople_flujo_eventos.md`, `decisiones_acople_eventos.md` y el mockup en Figma (`https://www.figma.com/design/3OvP90pDHgudd6fVYjsoZu`).

Reglas de trabajo (de `CLAUDE.md` del portal): cada cambio en una rama nueva desde `dev` actualizado; nunca commit directo en `dev`, `staging`, `main` ni `module/proyectos`; Conventional Commits en español sin atribución de IA; migraciones aditivas e idempotentes con el siguiente número libre (la fase 1 usa de la 33 a la 36); no hay commit ni push sin que se pida.

## 0. Camino recomendado

1. **Ahora, en paralelo:** completar y corregir el mockup (sección 1) y arrancar la **fase 1** (base de datos), que no depende de las pantallas.
2. **Antes de las fases 2 y 3:** tener cerradas las faltas F2, F3, F4 y F5 y los defectos D1–D4 del mockup.
3. Después, fase por fase hasta la 8; la fase 9 (mejoras) una por una.

## 1. Mockup: qué corregir o completar (fase 0b)

### Faltas (pantallas que no existen)

- [x] **F1** Variante de escritorio a 1920×1080 (la propuesta la pide). *Media* — hecho el 2026-11-06 (página 09 (D1, S1, S6, G1, A1)).
- [x] **F2** Importar: paso 3 «Resultado» (creadas, omitidas, con error). *Alta* — hecho el 2026-11-06 (S11).
- [x] **F3** Gerente: lista de «Proyectos» y «Por dar visto bueno» como pantallas propias. *Alta* — hecho el 2026-11-06 (G3, G4, G5).
- [x] **F4** Base de clientes en escritorio (supervisor y administrador) y ficha/edición de empresa y contactos. *Alta* — hecho el 2026-11-06 (S12, S13).
- [x] **F5** Marcar «No contactar», reactivar con motivo y agregar o editar contactos. *Alta* — hecho el 2026-11-06 (T10, T10b, T11).
- [x] **F6** Seguimiento: pestañas «Por tienda» y «Estancados». *Media* — hecho el 2026-11-06 (S14, S15).
- [x] **F7** Catálogos: Artículos, Áreas de contacto, Canales, Resultados, Motivos de pérdida y Monedas. *Media* — hecho el 2026-11-06 (A1, 9 pestañas).
- [x] **F8** Detalle de proyecto cerrado (solo lectura) y «Mis proyectos anteriores» en escritorio. *Media* — hecho el 2026-11-06 (S16, D3).
- [x] **F9** Lista de borradores y reanudar el asistente. *Media* — hecho el 2026-11-06 (S17).
- [x] **F10** Asesor nuevo o que vuelve a un proyecto activo y «tomar» empresas para equilibrar. *Baja* — hecho el 2026-11-06 (S18).
- [x] **F11** Exportar base y resultados (solo anotar, es mejora posterior). *Baja* — hecho el 2026-11-06 (solo anotado como mejora posterior).

### Defectos en lo ya dibujado

- [x] **D1** S7: los avatares redimensionados pierden el círculo; crear variante de tamaño pequeño — hecho el 2026-11-06 (variante pequeña de Avatar).
- [x] **D2** S5: la tabla muestra 4 de 14 asesores sin indicar que hay más — hecho el 2026-11-06 (fila «y 10 asesores más»).
- [x] **D3** S3: la lista de participantes se corta sin señal de desplazamiento — hecho el 2026-11-06 (lista con scroll interno).
- [x] **D4** Convertir Campo, Tarjeta, Aviso, Pestañas y Tabla en componentes (hoy solo Botón, Chip y Avatar lo son) — hecho el 2026-11-06 (componentes Campo, Aviso, Pestaña e Interruptor creados; el resto de pantallas anteriores sigue como marcos con la misma apariencia).
- [x] **D5** Revisar otros paneles de 300 px con datos largos — hecho el 2026-11-06 (prueba en la página 10).
- [x] **D6** Probar con textos extremos (nombres largos, montos grandes) — hecho el 2026-11-06 (prueba en la página 10).
- [x] **D8** Etiquetas del «Resumen» partidas (S2–S5): corregido el 2026-11-06.
- [x] **D9** Tabla de etapas de S4 recortada: corregido el 2026-11-06.
- [x] **D10** Catálogos sin señal de «Mostrando 7 de 17»: corregido el 2026-11-06.
- [x] **D7** Datos de ejemplo inconsistentes entre pantallas (12/14 asesores, 10/9 tiendas, «Colegios» activo y cerrado): corregidos el 2026-11-05.

### Decisiones de diseño por validar

- [x] Color del módulo (ciruela `#7A3F5C`): se mantiene.
- [ ] Chip «Cerrado»: pendiente pasarlo a gris azulado con ícono para no confundirlo con «recibido» de Vales.
- [x] Semáforo con texto además de color: el chip lleva la palabra Verde, Ámbar o Rojo.
- [x] El asesor también usa laptop: se mantienen D1 y D2 (decidido el 2026-11-06).
- [ ] «Crear vale» visible desde el inicio: pendiente marcarlo «fase 7» en el mockup.

### Centro de configuración y variantes (agregado el 2026-11-06)

- [x] A0 a A10 del administrador (inicio, parámetros, plantillas con etapas y permisos del supervisor, reglas y aprobaciones, campos propios, alcance de usuarios, notificaciones, kit del nicho, historial) y 8 pestañas de catálogos.
- [x] Variantes por configuración: selector de plantilla (S2), campos bloqueados u obligatorios (S4), «Esperando aprobación» (T12), aprobar activación (G5), ventas por confirmar (S19), matriz de permisos nuevos (T9b).
- [ ] Pendiente: variantes de celular M6 «por confirmar» y M9 con campos propios; convertir en componentes las pantallas anteriores a esta revisión.
- Registro de cambios en la página «08 · Revisión» del archivo de Figma.

**Aprobado el 2026-11-07** (incluidos los textos de ejemplo tal como están). **Terminado cuando:** el dueño aprueba el mockup pantalla por pantalla (regla de diseño del portal).

## 2. Fases de código

Cada fase = una subrama desde `module/proyectos` actualizada, un pull request, documentación actualizada y prueba en el navegador con los roles que corresponden.

### Fase 1 · Base de datos y catálogos — `feature/proyectos-01-base-datos`

- [x] Migración con todas las tablas `proy_*` (catálogos, base global, proyecto y reparto, trabajo del asesor, soporte).
- [x] Columnas generadas `VIRTUAL`: `proy_participaciones.cliente_abierto_id` y `proy_proyecto_tiendas.tienda_abierta_id`, con índice único; marcas `abierta` y `proyecto_abierto`.
- [x] `referencia`, `anulada_en`, `anulada_por`, `anulacion_motivo` en cotizaciones y ventas; importes `DECIMAL(12,2)`.
- [x] Índices desde el inicio: `proy_gestiones (participacion_id, creado_en)` y `(usuario_id, creado_en)`; `proy_participaciones (asesor_id, abierta, proxima_gestion_en)`.
- [x] Semillas: nichos del Excel de 2020 + Hospitales y Farmacias; Medalla, Llavero, Posavasos; seis áreas; cuatro canales; resultados y motivos básicos; monedas GTQ, USD, HNL, NIO, CRC y su relación con el país.
- [x] Permisos (`modulo = 'proyectos'`) sin asignar a roles, incluido `proyectos.corregir`.
- [x] Entrada en `MODULOS` (`modulesCatalog.js`) desde esta fase (lo exigen las notificaciones); nadie ve la tarjeta.
- [x] Migración aditiva de `notificaciones`: `referencia_tipo` y `referencia_id`.
- [x] Catálogos administrables (A1 y pestañas de F7): API `/api/proyectos/catalogos` y pantalla con 9 pestañas; nunca se borra, se desactiva.
- [x] Tablas de configuración (`proy_estructuras`, `proy_pais_config`, `proy_config_historial`), registro de parámetros `parametros.js` sobre `parametros_sistema` (el valor admite 255 caracteres) y pantallas A0, A3, A5 y A10 (ver `documentacion/configuracion_administrador.md`).
- [x] Historial de cambios con filtros y «restaurar» (cada restauración es un cambio nuevo, también auditado) y resumen del inicio.
- [x] Scripts de verificación en `scripts/proyectos/` (registro, servicio y API por HTTP), probados en MySQL 8.4 y MariaDB 11.8.
- [ ] Pendiente en staging: aplicar las migraciones `proyectos_*` y confirmar los índices únicos en la MariaDB del hosting (hoy probados en MariaDB 11.8 local).
- **Terminado cuando:** la migración corre dos veces sin error, los índices únicos funcionan **en staging** (MariaDB) y los catálogos se editan.

### Fase 2 · Clientes — `feature/proyectos-02-catalogos-clientes`

- [x] Registrar, buscar y filtrar empresas por nicho, país y estado; solo países del usuario. (2a)
- [x] Detección de duplicados (país + nombre normalizado + ciudad, o mismo teléfono) y normalización de teléfonos por país. (2a)
- [x] «No contactar» y «inactiva»; reactivar con motivo (solo `proyectos.corregir`). (2a)
- [x] Contactos por área (2a); empresa de un nicho del proyecto activo se asigna al asesor si participa.
- [ ] Importación CSV con plantilla, vista previa (nuevas, duplicadas, con error) y confirmación; límite de 2,000 filas y 5 MB; límite de frecuencia.
- [ ] Campos propios por nicho (A6, `proy_campos`, `datos_extra`) y alcance de usuarios por país (A7, `proy_usuario_paises`).
- [ ] Pantallas: M8, M9, T8, S8, S9 + paso 3 (F2) + escritorio (F4, F5).
- **Terminado cuando:** un asesor registra una empresa y una importación de prueba muestra duplicadas y errores.

### Fase 3 · Proyectos y reparto — `feature/proyectos-03-proyectos-reparto`

- [ ] Crear, borrador, vista previa, activar y cancelar proyectos.
- [ ] `repartoService` aislado en un solo archivo (por país; una por una al asesor con menos; desempate por tienda de origen; orden determinista; tope y reserva).
- [ ] Bloqueo en orden fijo: proyecto → tiendas → clientes → participaciones.
- [ ] Activar idempotente (`UPDATE … WHERE estado = 'borrador'` + `idempotencyKey`); captura de duplicado con mensaje claro.
- [ ] Alcance: el supervisor solo incluye tiendas que supervisa; tienda ocupada bloqueada.
- [ ] Plantillas de proyecto (A4, `proy_plantillas`, `config_snapshot` al activar) y aprobación opcional de la activación (`pendiente_aprobacion`, G5, T12).
- [ ] Pantallas: S1–S5, T3a, T5, F9.
- **Terminado cuando:** con datos de prueba la diferencia entre asesores nunca pasa de una empresa, y dos activaciones a la vez dejan un solo ganador.

### Fase 4 · Gestión del asesor — `feature/proyectos-04-gestion-asesor`

- [ ] Gestiones, entregas de muestra con control de existencias, cotizaciones y ventas con referencia (venta sin OV no se guarda; OV repetida avisa).
- [ ] País sin moneda local (hoy Belice): sus cotizaciones y ventas salen en dólares hasta que el administrador elija una (lo anuncian A0 y A1 › Países).
- [ ] Venta «por confirmar» cuando el interruptor está encendido (no cuenta en informes hasta confirmarse); referencia obligatoria según el país.
- [ ] Estado de la participación derivado de lo registrado; «perdida» y «descartada» explícitas.
- [ ] «Para hoy» con orden fijo y filtro por el asesor de la sesión; listas de 50 en 50.
- [ ] Pantallas: M1–M7, M10, M11, D1, D2.
- **Terminado cuando:** un asesor recorre una empresa de pendiente a vendida y no puede leer participaciones ajenas.

### Fase 5 · Seguimiento del supervisor — `feature/proyectos-05-seguimiento-supervisor`

- [ ] Avance por asesor y tienda, semáforo, estancados (7 días), tiempo de reacción.
- [ ] Reasignación individual y masiva con historial y aviso a quien recibe y a quien pierde.
- [ ] Anulación con motivo y recálculo de estado (`proyectos.corregir`).
- [ ] Alcance de tres niveles sobre `supervisor_tiendas`; filas «Otra tienda» con datos vacíos desde el servidor.
- [ ] Tiempo real por socket.
- [ ] Cola de confirmación de ventas del supervisor (S19, `proyectos.confirmar_ventas`).
- [ ] Pantallas: S6, S7, T4, T3c + F6.
- **Terminado cuando:** reasignar se ve al instante en el asesor y una fila de otra tienda no lleva datos sensibles.

### Fase 6 · Cierre, informe y gerencia — `feature/proyectos-06-cierre-informe-gerencia`

- [ ] `informeService` único (pantalla, PDF y exportación), congelado en `resumen_cierre`; tasas acumulativas; lo anulado no cuenta.
- [ ] PDF con `pdf-lib`; tablas largas a 20 filas con «y N más».
- [ ] Cierre con conclusiones; visto bueno (dar y devolver con comentarios); panel del gerente.
- [ ] Matriz de notificaciones configurable (A8) y visto bueno opcional según el interruptor.
- [ ] Revisión periódica de proyectos vencidos (gracia configurable, 3 días hábiles por defecto) con `aviso_vencido_en`; notificaciones de todo el módulo.
- [ ] Pantallas: S10, G1, G2, T3b, T6 + F3, F8.
- **Terminado cuando:** el informe coincide con un conteo manual de los mismos datos.

### Fase 7 · Integración con Vales — `feature/proyectos-07-integracion-vales`

- [ ] `GET /api/proyectos/participaciones/:id/prefill-vale` y `POST …/vincular-vale`.
- [ ] Cambio pequeño en el formulario de Vales (`?prellenar=proyectos:<id>`, sin datos personales en la dirección).
- [ ] Pantalla: M12.
- **Terminado cuando:** un vale creado desde Proyectos queda ligado a su cliente.

### Fase 8 · Activación — `feature/proyectos-08-activacion`

- [ ] Asignar los permisos a los roles (preferible desde la pantalla de roles, que refresca la sesión).
- [ ] Probar en staging con cada rol y con dos supervisores activando a la vez.
- [ ] Avisar que quien tenga sesión abierta debe volver a entrar para ver el módulo.
- **Terminado cuando:** el módulo aparece solo para los roles previstos.

### Fase 9 · Mejoras

Una por una, cada una en su subrama: plan del año con sugerencia (A2), activación automática, kit del nicho (A9), tope y rondas, existencias con alerta, exportar a Excel/CSV, comparación de nichos, metas, cartera de ganados, ruta de visitas.

## 3. Decisiones (resueltas el 2026-11-06)

| # | Decisión | Resolución |
|---|---|---|
| 1 | ¿Corregir todo el mockup antes de programar? | Sí: el mockup queda completo y se programa tras la aprobación del dueño (fase 0b). |
| 2 | ¿El asesor también usa laptop? | Sí; se mantienen D1 y D2. |
| 3 | Periodo de descanso de un cliente. | Parámetro del administrador; 3 meses por defecto, 0 lo desactiva. |
| 4 | ¿Reciben empresas los supervisores? | Parámetro; por defecto solo asesores. |
| 5 | ¿Todas las tiendas numeran cotizaciones y órdenes igual? | Referencia obligatoria por país, configurable en A1 › Países. |
| 6 | Pruebas de reparto e informe. | Scripts de verificación con datos de prueba en cada subrama y revisión manual en staging; sin librería nueva. |
| 7 | ¿Aprobar ventas y activaciones? | Interruptores del administrador (A5): confirmación de ventas apagada y aprobación de activación apagada por defecto; visto bueno al cerrar encendido. |
| 8 | ¿Quién configura el flujo? | El administrador, sin programar: Centro de configuración (A0 a A10). Los cambios aplican a proyectos nuevos. |

## 4. Riesgos

| Riesgo | Manejo |
|---|---|
| Columna generada con índice único (primera del portal; en MariaDB 11 una columna `STORED` con claves foráneas en cascada falló en Eventos, error 1901). | Usar `VIRTUAL`; probar en staging al inicio de la fase 1; alternativa: tabla `proy_clientes_abiertos` con el cliente como clave primaria. |
| Los permisos asignados por migración no llegan a la sesión en curso. | Asignarlos desde la pantalla de roles y avisar (fase 8). |
| Reparto con miles de empresas. | Reparto aislado, probado con volúmenes grandes; tope por asesor y rondas. |
| Datos personales de terceros (contactos de las empresas). | Solo con `proyectos.ver`, nunca en direcciones ni registros; el servidor vacía los datos de «Otra tienda». |
| Referencia contable obligatoria donde un país no usa el mismo sistema. | Dato por país para volverla opcional. |
| Programar sin aprobar el mockup. | Aprobación pantalla por pantalla antes de la fase 1. |

## 5. Siguiente acción inmediata

1. Revisar `Documento_Idea_Modulo_Proyectos.docx` y el mockup; aprobar o pedir cambios.
2. Aprobar o corregir el mockup actualizado (la página 08 de Figma lista los cambios).
3. Con eso: crear `module/proyectos` desde `dev` actualizado y abrir `feature/proyectos-01-base-datos`.
