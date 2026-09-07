-- Schema: Portal Web de Herramientas Empresariales — MundiTrofeos S.A.
-- Motor: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
--
-- Solo estructura (tablas, claves, índices). Sin datos — ver seed.sql y
-- mock.sql. Orden de importación: schema.sql -> seed.sql -> mock.sql.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `paises` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `codigo`          VARCHAR(2)   NOT NULL UNIQUE COMMENT 'Código ISO (GT, SV, HN, NI, CR, BZ)',
  `nombre`          VARCHAR(100) NOT NULL,
  `codigo_telefono` VARCHAR(5)   DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- analisis_correcciones_18.md #5: entidad jurídica dueña de una o más
-- tiendas (ej. "Munditrofeos, S.A." es dueña de MTC y MTS). El país de una
-- tienda se resuelve a través de su empresa, ya no de `tiendas.pais_id`.
CREATE TABLE IF NOT EXISTS `empresas` (
  `id`      INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`  VARCHAR(150) NOT NULL,
  `pais_id` INT NOT NULL,
  FOREIGN KEY (`pais_id`) REFERENCES `paises` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `roles` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`         VARCHAR(50)  NOT NULL UNIQUE,
  `descripcion`    VARCHAR(255) DEFAULT NULL,
  -- "Eliminar" un rol es desactivarlo, nunca un DELETE físico — un rol
  -- desactivado se sigue listando (en gris) para poder reactivarlo.
  `activo`         TINYINT(1) NOT NULL DEFAULT 1,
  `creado_en`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `permisos` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `codigo`      VARCHAR(100) NOT NULL UNIQUE COMMENT 'Ej: vales.ver, admin.ver',
  `nombre`      VARCHAR(100) NOT NULL,
  `modulo`      VARCHAR(50)  NOT NULL COMMENT 'Asociado al módulo (vales, admin)',
  `descripcion` VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rol_permisos` (
  `rol_id`     INT NOT NULL,
  `permiso_id` INT NOT NULL,
  PRIMARY KEY (`rol_id`, `permiso_id`),
  FOREIGN KEY (`rol_id`)     REFERENCES `roles`    (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`permiso_id`) REFERENCES `permisos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- analisis_correcciones_18.md #5: `telefono` sale de aquí — Asesor/Supervisor
-- lo guardan en su tabla satélite; el resto de roles (Administrador,
-- Encargados, Técnicos, Asistente, Gerente) no lo tienen en el sistema.
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id`                  INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`              VARCHAR(150) NOT NULL,
  `email`               VARCHAR(150) NOT NULL UNIQUE,
  `password_hash`       VARCHAR(255) NOT NULL,
  `rol_id`              INT NOT NULL,
  `tienda_id`           INT DEFAULT NULL COMMENT 'DEPRECATED (analisis_correcciones_18.md #5): en desuso para Asesor/Supervisor (ver `asesores`/`supervisor_tiendas`); todavía en uso para Técnico/Encargado (su propia tienda física — no confundir con `encargado_tienda`, que cubre el caso de un taller compartido por dos tiendas)',
  `activo`              TINYINT(1) NOT NULL DEFAULT 1,
  `intentos_fallidos`   INT NOT NULL DEFAULT 0,
  `bloqueado_hasta`     DATETIME DEFAULT NULL,
  `creado_en`           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_usuarios_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- analisis_correcciones_18.md #5: un Asesor de Ventas trabaja para EXACTAMENTE
-- una tienda a la vez (`tienda_id` NULL = sin asignar). Para reasignarlo hay
-- que desasignarlo primero (`tienda_id` a NULL) y luego asignarlo a la nueva
-- — no se permite saltar directo de una tienda a otra (ver adminService).
CREATE TABLE IF NOT EXISTS `asesores` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL UNIQUE,
  `tienda_id`  INT DEFAULT NULL,
  `telefono`   VARCHAR(30) DEFAULT NULL,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tienda_id`)  REFERENCES `tiendas`  (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `supervisores` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL UNIQUE,
  `telefono`   VARCHAR(30) DEFAULT NULL,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- analisis_correcciones_18.md #5: reemplaza `supervisor_asignaciones`. Un
-- supervisor supervisa TIENDAS, no departamentos ni subdivisiones — relación
-- muchos a muchos explícita, asignable/desasignable una por una, sin
-- cobertura "heredada" implícita.
CREATE TABLE IF NOT EXISTS `supervisor_tiendas` (
  `usuario_id` INT NOT NULL,
  `tienda_id`  INT NOT NULL,
  PRIMARY KEY (`usuario_id`, `tienda_id`),
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tienda_id`)  REFERENCES `tiendas`  (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- analisis_correcciones_18.md #3: `pais_id` es NULL-able porque un
-- departamento como "Ventas Centroamérica" agrupa subdivisiones de VARIOS
-- países a la vez — en ese caso el país vive en cada `subdivisiones.pais_id`
-- y este campo se ignora. Solo se usa cuando el departamento NO tiene
-- subdivisiones propias (ej. "Ventas Premia Z13", exclusivo de Guatemala),
-- que es el único caso donde hace falta para el filtro País → Departamento
-- del modal "Nueva tienda".
CREATE TABLE IF NOT EXISTS `departamentos` (
  `id`      INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`  VARCHAR(100) NOT NULL UNIQUE,
  `pais_id` INT DEFAULT NULL,
  `activo`  TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (`pais_id`) REFERENCES `paises` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- No todo departamento tiene subdivisiones (ej. Premia Z13) — por eso
-- `tiendas.subdivision_id` es NULL-able en vez de exigir una fila aquí.
CREATE TABLE IF NOT EXISTS `subdivisiones` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `departamento_id` INT NOT NULL,
  `nombre`          VARCHAR(100) NOT NULL,
  `pais_id`         INT NOT NULL COMMENT 'analisis_correcciones_18.md #3: país real de esta subdivisión — un departamento puede agrupar subdivisiones de varios países',
  `activo`          TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (`departamento_id`) REFERENCES `departamentos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`pais_id`) REFERENCES `paises` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE KEY `uq_subdivision` (`departamento_id`, `nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tiendas/sucursales, usadas para el correlativo de vales y para resolver,
-- vía departamento/subdivisión, cuál(es) supervisor(es) cubren a un asesor
-- (ver `supervisor_tiendas`). analisis_correcciones_18.md #5: ya no tienen
-- `pais_id` propio (se resuelve vía `empresa_id` → `empresas.pais_id`) ni
-- `nombre` propio (se deriva como "{EMPRESA}, {SUBDIVISIÓN}", o solo
-- "{EMPRESA}" si no tiene subdivisión — ver `tiendaAdminRepository`).
CREATE TABLE IF NOT EXISTS `tiendas` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `codigo`          VARCHAR(10)  NOT NULL UNIQUE COMMENT 'Ej: MTC, SSV, XEL',
  `empresa_id`      INT NOT NULL,
  `departamento_id` INT NOT NULL,
  `subdivision_id`  INT DEFAULT NULL COMMENT 'NULL si el departamento no tiene subdivisiones',
  `orden`           INT NOT NULL DEFAULT 0 COMMENT 'Orden manual del catálogo, editable desde la Vista Administrador',
  `activo`          TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`departamento_id`) REFERENCES `departamentos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`subdivision_id`) REFERENCES `subdivisiones` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Catálogos del formulario de vale de arte (combobox).
CREATE TABLE IF NOT EXISTS `vale_productos` (
  `id`     INT AUTO_INCREMENT PRIMARY KEY,
  `codigo` VARCHAR(20)  NOT NULL UNIQUE,
  `nombre` VARCHAR(100) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vale_materiales` (
  `id`     INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Talleres/departamentos a los que un asesor puede dirigir un vale de arte.
-- Cada taller tiene un único encargado dueño (asigna técnicos y revisa
-- propuestas de ESE taller). `tienda_id` distingue un taller de TODA la
-- empresa (NULL) de un "Diseño Local" que solo existe para una tienda
-- puntual (apunta a esa tienda).
-- analisis_correcciones_19.md #8/#11/#12: `encargado_id` es NULL-able — un
-- taller puede quedar momentáneamente sin encargado (se desasigna al
-- titular antes de asignar un reemplazo, igual que `asesores.tienda_id`).
CREATE TABLE IF NOT EXISTS `talleres` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `nombre`       VARCHAR(100) NOT NULL UNIQUE,
  `encargado_id` INT DEFAULT NULL,
  `tienda_id`    INT DEFAULT NULL COMMENT 'NULL = taller de toda la empresa; NOT NULL = Diseño Local de esa tienda. Gobierna a qué talleres puede enviar un vale cada asesor (ver _validarTalleresIds) — no confundir con `encargado_tienda`, que es solo para "Gestionar personal".',
  `activo`       TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (`encargado_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`tienda_id`) REFERENCES `tiendas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- analisis_correcciones_18.md #5: el encargado de un taller compartido por
-- MTC y MTS (Diseño, Diseño UV/3D, Protextil) debe aparecer como personal de
-- AMBAS tiendas en "Gestionar personal" — algo que `talleres.encargado_id`
-- (un solo dueño) no puede expresar por sí solo. Esta tabla es EXCLUSIVA para
-- ese listado; el enrutamiento de vales (qué taller puede elegir un asesor)
-- sigue gobernado enteramente por `talleres.tienda_id`, sin cambios de
-- comportamiento para las tiendas Premia/Trofex.
CREATE TABLE IF NOT EXISTS `encargado_tienda` (
  `taller_id` INT NOT NULL,
  `tienda_id` INT NOT NULL,
  PRIMARY KEY (`taller_id`, `tienda_id`),
  FOREIGN KEY (`taller_id`) REFERENCES `talleres` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tienda_id`) REFERENCES `tiendas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- analisis_correcciones_18.md #5: reemplaza `usuarios.encargado_id` — un
-- técnico trabaja físicamente en un solo taller (PK sobre `usuario_id`, no
-- compuesta, para que sea imposible tener dos filas del mismo técnico).
-- analisis_correcciones_19.md #10: también guarda a qué taller "clona" el
-- Asistente (rol 7) — mismo shape (usuario→taller), nunca colisiona con un
-- técnico porque un usuario nunca tiene ambos roles a la vez.
CREATE TABLE IF NOT EXISTS `taller_tecnicos` (
  `usuario_id` INT NOT NULL PRIMARY KEY,
  `taller_id`  INT NOT NULL,
  FOREIGN KEY (`taller_id`)  REFERENCES `talleres` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_taller_tecnicos_taller` (`taller_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Estado GENERAL de un vale de arte. El progreso DENTRO de cada taller
-- (asignación/proceso/revisión/aprobado) vive en `vale_talleres`, no aquí —
-- un vale con 2+ talleres puede tener uno EN_PROCESO y otro recién CREADO a
-- la vez, algo que esta única columna no puede representar. Un vale nace
-- ESPERANDO_AUTORIZACION y el Supervisor de Ventas (dueño de los asesores
-- que lo crearon) debe autorizarlo antes de que exista ninguna fila en
-- `vale_talleres` (ver `talleres_solicitados`). CONFIRMADO es el estado
-- final del vale ORIGINAL una vez aprobada su modificación.
CREATE TABLE IF NOT EXISTS `vales` (
  `id`                    INT AUTO_INCREMENT PRIMARY KEY,
  `correlativo`           VARCHAR(60) NOT NULL UNIQUE COMMENT 'Estructura: [MOD-]TIENDA-INICIALES-00001 (código de tienda + iniciales del asesor + 5 dígitos). Los correlativos históricos previos a esta convención no se renumeran.',
  `asesor_id`             INT NOT NULL,
  `tienda_id`             INT NOT NULL,
  `vale_original_id`      INT DEFAULT NULL COMMENT 'Solo en vales MODIFICADO: apunta al vale original que se modificó',
  `fecha_creacion`        DATE NOT NULL,
  `hora_creacion`         TIME NOT NULL,
  `fecha_entrega`         DATETIME NOT NULL,
  `fecha_evento`          DATETIME NOT NULL,
  `urgente`               TINYINT(1) NOT NULL DEFAULT 0,
  -- Información del cliente (digitada por el asesor)
  `cliente_empresa`       VARCHAR(150) DEFAULT NULL,
  `cliente_nombre`        VARCHAR(150) NOT NULL,
  `cliente_telefono`      VARCHAR(30)  NOT NULL,
  `cliente_correo`        VARCHAR(150) NOT NULL,
  -- Información de venta
  `producto_id`           INT DEFAULT NULL,
  `material_id`           INT DEFAULT NULL,
  `tecnica`               VARCHAR(150) DEFAULT NULL COMMENT 'Texto libre',
  `acabado`               VARCHAR(150) DEFAULT NULL COMMENT 'Texto libre',
  `cantidad`              INT NOT NULL COMMENT 'Debe ser > 1',
  `cotizacion`            DECIMAL(10,2) NOT NULL,
  -- Boceto, descripción y documentos oficiales
  `descripcion`           TEXT,
  `pdf_url`               TEXT DEFAULT NULL COMMENT 'URL del PDF generado, nunca se guarda el binario en BD',
  `propuesta_general_url` TEXT DEFAULT NULL COMMENT 'Documento final "oficial" del vale: la propuesta del único taller si hubo uno solo, o el documento de fusión subido por el encargado que fusionó si hubo varios',
  `fusionado_por`         INT DEFAULT NULL COMMENT 'usuarios.id del encargado que realizó la fusión (NULL si el vale nunca requirió fusión)',
  `fusionado_en`          DATETIME DEFAULT NULL,
  -- Control de Modificaciones
  `modificado`            INT NOT NULL DEFAULT 0 COMMENT 'Máx 1 permitida',
  `atraso_congelado_en`   DATETIME DEFAULT NULL COMMENT 'Snapshot fijado la primera vez que el vale se confirma de recibido o se aprueba su modificación; el atraso deja de recalcularse en vivo aunque el estado luego cambie',
  `atraso_notificado_en`  DATETIME DEFAULT NULL COMMENT 'Sellado por el vigilante de atraso la primera vez que notifica el atraso de este vale, para no repetir la alerta',
  `talleres_solicitados`  VARCHAR(100) DEFAULT NULL COMMENT 'CSV de talleres.id elegidos al crear, pendientes de autorización del Supervisor',
  `autorizado_por`        INT DEFAULT NULL COMMENT 'usuarios.id del Supervisor que autorizó la creación/modificación de este vale',
  `autorizado_en`         DATETIME DEFAULT NULL,
  `autorizacion_tipo`     ENUM('CREACION','MODIFICACION') DEFAULT NULL,
  `confirmado_en`         DATETIME DEFAULT NULL COMMENT 'Sellado cuando el asesor confirma de recibido',
  `estado` ENUM('ESPERANDO_AUTORIZACION','CREADO','APROBADO_DEPARTAMENTO','PENDIENTE_CONFIRMACION','RECIBIDO','SOLICITANDO_MODIFICACION','MODIFICADO','CONFIRMADO') NOT NULL DEFAULT 'ESPERANDO_AUTORIZACION',
  `creado_en`             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`asesor_id`)        REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`tienda_id`)        REFERENCES `tiendas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`vale_original_id`) REFERENCES `vales` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`producto_id`)      REFERENCES `vale_productos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`material_id`)      REFERENCES `vale_materiales` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`autorizado_por`)   REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`fusionado_por`)    REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_vales_estado` (`estado`),
  INDEX `idx_vales_asesor` (`asesor_id`),
  INDEX `idx_vales_fecha_entrega` (`fecha_entrega`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Progreso de un vale de arte DENTRO de cada taller al que fue enviado. Una
-- fila por (vale, taller) fan-out en creación; reasignar desactiva la fila
-- activa y crea una nueva.
CREATE TABLE IF NOT EXISTS `vale_talleres` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`          INT NOT NULL,
  `taller_id`        INT NOT NULL,
  `tecnico_id`       INT DEFAULT NULL,
  -- EN_PAUSA permite a un técnico (o a un encargado autoasignado) pausar su
  -- trabajo en un taller sin entregar propuesta, para tomar otro vale.
  `estado`           ENUM('PENDIENTE_ASIGNACION','ASIGNADO','EN_PROCESO','EN_PAUSA','EN_REVISION','APROBADO') NOT NULL DEFAULT 'PENDIENTE_ASIGNACION',
  `fecha_asignacion` DATETIME DEFAULT NULL,
  `activo`           TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Determina la asignación vigente para este taller',
  `creado_en`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_id`)    REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`taller_id`)  REFERENCES `talleres` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`tecnico_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_vale_talleres_vale` (`vale_id`),
  INDEX `idx_vale_talleres_tecnico` (`tecnico_id`, `activo`),
  INDEX `idx_vale_talleres_taller` (`taller_id`, `activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Solicitud de modificación de un vale ya RECIBIDO. Al aprobarla el
-- supervisor, se crea un vale de arte NUEVO (correlativo MOD-..., estado
-- MODIFICADO, `vale_original_id` apuntando aquí) — la solicitud en sí nunca
-- muta el vale original, solo lo deja en SOLICITANDO_MODIFICACION mientras
-- espera.
CREATE TABLE IF NOT EXISTS `vale_solicitudes_modificacion` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `vale_original_id` INT NOT NULL,
  `asesor_id`        INT NOT NULL,
  `fecha_entrega`    DATETIME NOT NULL,
  `fecha_evento`     DATETIME NOT NULL,
  `urgente`          TINYINT(1) NOT NULL DEFAULT 0,
  `cliente_empresa`  VARCHAR(150) DEFAULT NULL,
  `cliente_nombre`   VARCHAR(150) NOT NULL,
  `cliente_telefono` VARCHAR(30)  NOT NULL,
  `cliente_correo`   VARCHAR(150) NOT NULL,
  `producto_id`      INT DEFAULT NULL,
  `material_id`      INT DEFAULT NULL,
  `tecnica`          VARCHAR(150) DEFAULT NULL,
  `acabado`          VARCHAR(150) DEFAULT NULL,
  `cantidad`         INT NOT NULL,
  `cotizacion`       DECIMAL(10,2) NOT NULL,
  `talleres_ids`     VARCHAR(100) NOT NULL COMMENT 'CSV de talleres.id elegidos para el vale modificado',
  `justificacion`    TEXT NOT NULL,
  `estado`           ENUM('PENDIENTE','APROBADA','RECHAZADA') NOT NULL DEFAULT 'PENDIENTE',
  `creado_en`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_original_id`) REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`asesor_id`)        REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`producto_id`)      REFERENCES `vale_productos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`material_id`)      REFERENCES `vale_materiales` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_solicitudes_vale_original` (`vale_original_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Propuestas entregadas por un técnico (o un encargado autoasignado) para
-- revisión del encargado del taller.
CREATE TABLE IF NOT EXISTS `vale_propuestas` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`    INT NOT NULL,
  `tecnico_id` INT NOT NULL,
  `url`        TEXT DEFAULT NULL COMMENT 'URL del documento de propuesta',
  `creado_en`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_id`)    REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`tecnico_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_propuestas_vale` (`vale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Metadatos de archivos adjuntos (imágenes y documentos); el binario nunca
-- se guarda en BD.
CREATE TABLE IF NOT EXISTS `vale_documentos` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`         INT NOT NULL,
  `nombre_original` VARCHAR(255) NOT NULL,
  `ruta`            VARCHAR(500) NOT NULL,
  `tipo`            ENUM('imagen','documento') NOT NULL,
  `mime_type`       VARCHAR(100) NOT NULL,
  `tamano`          INT NOT NULL COMMENT 'Tamaño en bytes',
  `es_modificacion` TINYINT(1) NOT NULL DEFAULT 0,
  `subido_por`      INT NOT NULL,
  `creado_en`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_id`)    REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`subido_por`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_documentos_vale` (`vale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historial/trazabilidad de cada cambio de estado de un vale. `taller_id` es
-- NULL para eventos de nivel de vale (creación, fusión, confirmación,
-- modificación — visibles para todos los roles con acceso al vale) y se
-- llena con el taller correspondiente para eventos internos de un taller
-- (asignar/comenzar/entregar/revisar) — un encargado o técnico de OTRO
-- taller no debe ver esos eventos.
CREATE TABLE IF NOT EXISTS `vale_historial` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`         INT NOT NULL,
  `usuario_id`      INT NOT NULL,
  `taller_id`       INT DEFAULT NULL,
  `tecnico_id`      INT DEFAULT NULL COMMENT 'A qué técnico corresponde el evento, para que pueda filtrar SU historial sin depender de parsear el texto de `accion`. Se llena solo cuando el actor NO es el propio técnico (asignación/reasignación/aprobación por el encargado)',
  `estado_anterior` VARCHAR(50) DEFAULT NULL,
  `estado_nuevo`    VARCHAR(50) NOT NULL,
  `accion`          VARCHAR(150) NOT NULL,
  `creado_en`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_id`)    REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`taller_id`)  REFERENCES `talleres` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`tecnico_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_historial_vale` (`vale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fila única (id fijo = 1) con el estado del Modo Mantenimiento del portal.
CREATE TABLE IF NOT EXISTS `mantenimiento_config` (
  `id`           TINYINT PRIMARY KEY DEFAULT 1,
  `activo`       TINYINT(1) NOT NULL DEFAULT 0,
  `mensaje`      VARCHAR(500) DEFAULT NULL,
  `activado_por` INT DEFAULT NULL,
  `activado_en`  DATETIME DEFAULT NULL,
  FOREIGN KEY (`activado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
