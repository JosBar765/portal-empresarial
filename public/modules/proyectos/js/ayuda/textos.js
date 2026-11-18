// Textos de ayuda de las pantallas de Configuración de Proyectos. Un solo lugar para revisar el tono.
// - `pantallas[clave]`: lo que despliega «¿Cómo funciona?» (sirve, cambias, efecto, ejemplo, y opcionalmente guia y ojo).
// - `campos[clave]`: lo que abre el icono (i) de un ajuste (titulo, que, efecto, ejemplo y opcionalmente ojo).
// Reglas de redacción: español sencillo, tuteo, frases cortas; cada ajuste dice qué es, qué cambia al tocarlo y desde cuándo vale,
// y trae un ejemplo con números reales. `scripts/proyectos/verificar-ayudas.js` comprueba que no falte ningún ajuste.

const APLICA_NUEVOS = 'Aplica a los proyectos que actives desde ahora; los que ya están en marcha conservan su configuración.';

// Los avisos comparten la misma consecuencia: se enciende o se apaga por rol.
const aviso = (titulo, que, ejemplo) => ({
  titulo, que, ejemplo,
  efecto: 'Enciende o apaga el aviso para cada rol de la fila. Apagado, esa persona deja de recibirlo en la campana; lo demás sigue igual. Vale desde ya, sin esperar a un proyecto nuevo.'
});

export const TEXTOS = {
  pantallas: {
    inicio: {
      sirve: 'Es la puerta de entrada a todo lo que se puede ajustar en Proyectos sin pedir cambios al sistema. Cada tarjeta lleva a un área, te dice cuántos ajustes tiene y qué falta resolver.',
      guia: [
        { ruta: '#/catalogos', titulo: 'Catálogos', texto: 'Revisa nichos, artículos, canales y resultados, y asigna la moneda local de cada país.' },
        { ruta: '#/alcance', titulo: 'Alcance de usuarios', texto: 'Confirma qué países ve cada persona (por defecto, el de su tienda).' },
        { ruta: '#/parametros', titulo: 'Parámetros', texto: 'Ajusta el reparto, el seguimiento, el semáforo, la importación y el informe.' },
        { ruta: '#/plantillas', titulo: 'Plantillas de proyecto', texto: 'Crea los moldes con los que los supervisores arman cada proyecto.' },
        { ruta: '#/reglas', titulo: 'Reglas y aprobaciones', texto: 'Decide si hace falta visto bueno, aprobación o confirmación de ventas.' },
        { ruta: '#/notificaciones', titulo: 'Notificaciones', texto: 'Elige qué avisos recibe cada rol.' },
        { ruta: '#/kit', titulo: 'Kit del nicho y campos propios', texto: 'Guiones, mensajes y datos extra por nicho.' },
        { ruta: '#/plan', titulo: 'Plan del año', texto: 'Planifica el nicho de cada mes y, si quieres, activa los proyectos solos.' }
      ],
      cambias: ['Desde aquí solo se entra a cada área; los cambios se hacen dentro de ellas.', 'El aviso amarillo de arriba lista lo que falta configurar (por ejemplo, un país sin moneda local) y te lleva directo a resolverlo.'],
      efecto: 'Las tarjetas se actualizan solas con lo que guardes. Casi todo lo que cambies aplica a los proyectos nuevos; lo que ya está en marcha no se mueve.',
      ejemplo: 'La tarjeta «Parámetros» dice «35 ajustes en su valor por defecto»: significa que todavía no cambiaste ninguno y el módulo funciona con los valores recomendados.',
      ojo: ['No tienes que configurar todo para empezar: con los valores por defecto el módulo ya funciona.', 'Los supervisores cambian plantillas, notificaciones, kit del nicho, campos propios y plan del año. Catálogos, parámetros, reglas y alcance los cambia solo el administrador (verás un candado).']
    },
    parametros: {
      sirve: 'Aquí están los números y los interruptores que gobiernan el reparto de empresas, el seguimiento, el semáforo, las importaciones, los datos de las empresas y el informe de cierre.',
      cambias: ['Cada ajuste muestra su valor actual, el rango permitido y su valor por defecto; «Restaurar» lo devuelve a como venía.', 'Toca el icono (i) de un ajuste para ver qué es, qué pasa si lo cambias y un ejemplo.', 'Los cambios se guardan juntos con «Guardar cambios».'],
      efecto: [APLICA_NUEVOS, 'Los catálogos, los campos propios, el alcance y las notificaciones sí valen al instante; los parámetros de reparto, seguimiento, semáforo e informe se «congelan» en cada proyecto al activarlo.'],
      ejemplo: 'Si hoy cambias «Días sin gestión para marcar estancada» de 7 a 5, los proyectos que actives desde mañana marcarán empresas estancadas a los 5 días; el proyecto de este mes sigue con 7.',
      ojo: ['Todo cambio queda en el Historial, con quién lo hizo y el valor anterior, y se puede restaurar.', 'Solo el administrador cambia esta pantalla, porque afecta a todas las tiendas y países. Los supervisores la ven bloqueada.']
    },
    plantillas: {
      sirve: 'Una plantilla es un molde para crear proyectos. Guarda la duración, las etapas y los valores que el supervisor encontrará ya puestos (artículo, existencia, meta, tope), y decide qué puede cambiar él.',
      cambias: ['Datos generales: nombre, descripción, si está activa y si es la predeterminada (solo una).', 'Etapas: nombre, qué se espera y cuántos días hábiles dura cada una.', 'Valores por defecto: artículo de muestra, existencia sugerida, tope por asesor y meta de venta.', 'Permisos del supervisor: para cada dato, si es editable, está bloqueado (con candado) o es obligatorio.'],
      efecto: ['Al activar un proyecto se guarda una copia de la plantilla: si la editas después, los proyectos que ya la usaron no cambian.', 'Las plantillas no se borran: se desactivan. Una plantilla inactiva ya no se ofrece al crear proyectos.'],
      ejemplo: '«Proyecto mensual estándar» tiene 4 etapas de 5 días hábiles (20 días, 4 semanas). Si bloqueas la meta en 50,000, el supervisor la ve con candado y no puede cambiarla.',
      ojo: ['Las etapas orientan, no bloquean: sirven para el semáforo y para decir «vas atrasado respecto a la etapa», pero el asesor puede registrar gestiones en cualquier momento.', 'La configuración es una sola para todas las tiendas y países. Los supervisores y el administrador pueden cambiar esta pantalla, y todo queda en el Historial con su nombre.']
    },
    reglas: {
      sirve: 'Enciende o apaga pasos extra del flujo de un proyecto: el visto bueno del gerente al cerrar, la aprobación antes de activar y la confirmación de ventas. También define, país por país, si la referencia de cotización y venta es obligatoria.',
      cambias: ['Tres interruptores generales (visto bueno al cerrar, aprobación antes de activar, confirmación de ventas).', 'Una tabla por país: referencia obligatoria y confirmación de ventas (heredar, sí o no).', 'Quién aprueba o confirma no se decide aquí: se asigna a cada rol en Administración → Roles.'],
      efecto: 'Cambiar una regla aplica a los proyectos nuevos. La referencia obligatoria se aplica a las cotizaciones y ventas que se registren desde ahora.',
      ejemplo: 'Si enciendes «Aprobación del gerente antes de activar», el supervisor ya no activa directo: pide la activación, el proyecto queda «esperando aprobación» y, cuando el gerente aprueba, se reparte.',
      ojo: ['Con todo en su valor por defecto el flujo es el ya aprobado: solo el visto bueno al cerrar viene encendido.', 'Solo el administrador cambia esta pantalla, porque afecta a todas las tiendas y países. Los supervisores la ven bloqueada.']
    },
    avisos: {
      sirve: 'Decide qué eventos avisan por la campana del portal, a qué roles les llegan y, en algunos, con cuánta anticipación. El portal nunca manda correos ni mensajes por su cuenta.',
      cambias: ['Un interruptor por evento y por rol (asesor, supervisor, gerente).', 'La anticipación de los avisos que la tienen (horas, días o unidades).', '«Restaurar valores por defecto» devuelve toda la matriz a como viene.'],
      efecto: 'Cada cambio se guarda al momento y vale desde ya. A quien hizo la acción nunca se le avisa de lo que hizo él mismo, y los avisos se borran solos a los 30 días.',
      ejemplo: 'Si apagas «Seguimiento vencido» para el supervisor, deja de recibirlo en la campana, pero el asesor sigue recibiéndolo.',
      ojo: 'La configuración es una sola para todas las tiendas y países. Los supervisores y el administrador pueden cambiar esta pantalla, y todo queda en el Historial con su nombre.'
    },
    kit: {
      sirve: 'Para cada nicho puedes escribir un guion de llamada y mensajes de WhatsApp o correo. El asesor los abre desde la ficha de la empresa con los datos ya puestos. El portal no envía nada: solo abre WhatsApp o el correo con el texto listo.',
      cambias: ['El guion de llamada (hasta 4000 caracteres).', 'Los mensajes: título, texto, canal, si están activos y el orden (hasta 20 por kit).', 'Si el kit del nicho está encendido o apagado.'],
      efecto: 'Vale al instante para todos los asesores. Cada cambio queda en el Historial; guardar sin cambiar nada no deja registro.',
      ejemplo: 'El mensaje «Hola {contacto}, soy {asesor} de Premia: te propongo {articulo} para {empresa}» se abre ya completo con los nombres reales.',
      ojo: ['Solo puedes usar las variables {empresa}, {contacto}, {asesor}, {articulo} y {nicho}. Cualquier otra se rechaza al guardar, con el número del mensaje.', 'La configuración es una sola para todas las tiendas y países. Los supervisores y el administrador pueden cambiar esta pantalla, y todo queda en el Historial con su nombre.']
    },
    campos: {
      sirve: 'Los campos propios agregan datos extra a la ficha de la empresa según el nicho, sin programar (por ejemplo «Número de agencias» solo para bancos). Aparecen en el formulario, la ficha, los filtros y la plantilla CSV de importación.',
      cambias: ['Etiqueta y tipo: texto, número, lista, sí/no o fecha.', 'Las opciones, si es una lista.', 'Si es obligatorio y si se ve como columna en la lista.', 'A qué nicho aplica, o a todos.', 'Si está activo.'],
      efecto: ['Un campo nuevo empieza a pedirse al instante.', 'Desactivar un campo no borra datos: deja de pedirse y mostrarse, y los datos que ya estaban vuelven si lo reactivas.'],
      ejemplo: 'Creas «¿Cuántas sucursales tiene?» (número, solo para Bancos y cooperativas, obligatorio): desde ya, al registrar un banco, el formulario lo exige.',
      ojo: ['El tipo y la clave de un campo no se pueden cambiar después. Para otro tipo, crea otro campo.', 'La configuración es una sola para todas las tiendas y países. Los supervisores y el administrador pueden cambiar esta pantalla, y todo queda en el Historial con su nombre.']
    },
    plan: {
      sirve: 'Es el calendario del año: para cada mes eliges qué nicho, qué artículo de muestra y qué plantilla toca. Alimenta las sugerencias al crear un proyecto y, si quieres, activa los proyectos solos.',
      cambias: ['Nicho, artículo y plantilla de cada mes.', 'La activación automática: encenderla, el día del mes y la hora.'],
      efecto: ['Al crear un proyecto, el asistente propone el nicho, el artículo y la plantilla del plan del mes.', 'Con la activación automática encendida, el sistema crea y activa el proyecto del mes en el día y la hora elegidos.'],
      ejemplo: 'Plan de noviembre: nicho «Bancos y cooperativas». Activación automática el día 0 a las 07:00 = el primer día hábil de noviembre a las 7 de la mañana, hora de Guatemala.',
      ojo: ['Un mes que ya pasó, o que ya tiene proyecto activo, esperando aprobación o cerrado, no se puede cambiar. Si no se puede crear el proyecto (por ejemplo, sin tiendas libres), no se crea nada y se avisa a los administradores.', 'La configuración es una sola para todas las tiendas y países. Los supervisores y el administrador pueden cambiar esta pantalla, y todo queda en el Historial con su nombre.']
    },
    alcance: {
      sirve: 'Define de qué países ve y registra empresas cada persona. Por defecto cada una ve el país de su tienda; aquí amplías o quitas países para casos especiales, por ejemplo un supervisor regional.',
      cambias: ['Agregar o quitar países a una persona.', 'Solo se guardan las diferencias: volver al país de su tienda borra los ajustes.'],
      efecto: 'El cambio es inmediato: afecta a la cartera, al registro de empresas, a la importación y a la ficha. Quitar un país no borra ningún dato: simplemente deja de verse.',
      ejemplo: 'A Carlos, supervisor de Guatemala, le agregas Honduras: desde ya ve y registra empresas de ambos países.',
      ojo: ['Quien tiene el permiso de gerencia o de administrar ve todos los países, sin importar estos ajustes.', 'Solo el administrador cambia esta pantalla, porque afecta a todas las tiendas y países. Los supervisores la ven bloqueada.']
    },
    historial: {
      sirve: 'Es el registro de todo lo que se ha cambiado en la configuración: quién, cuándo, qué ajuste y cómo estaba antes y después.',
      cambias: ['Se puede filtrar por área, por persona y por fechas.', 'Se puede restaurar un valor anterior.'],
      efecto: 'Restaurar un valor es un cambio nuevo: también queda registrado, y aplica como cualquier otro (a proyectos nuevos o al instante, según el ajuste).',
      ejemplo: 'Ves que el martes alguien subió «Filas máximas por archivo» de 2000 a 5000. Con «Restaurar» vuelve a 2000 y queda anotado quién lo restauró.',
      ojo: 'Los supervisores pueden ver el historial; restaurar un valor delicado (catálogos, parámetros, reglas o alcance) lo hace solo el administrador.'
    },
    'catalogos.nichos': {
      sirve: 'Los nichos son los tipos de empresa a los que se vende en cada proyecto (bancos, hoteles, colegios…). Cada empresa de la cartera y cada proyecto pertenece a uno.',
      cambias: ['Nombre, descripción, si está activo y el orden en que aparece.'],
      efecto: 'Un nicho nuevo se ofrece al instante. Se desactiva, no se borra: deja de ofrecerse, pero sus empresas y proyectos se conservan.',
      ejemplo: 'Creas «Hoteles»: ya puedes registrar empresas de ese nicho y planificar un proyecto de hoteles.',
      ojo: 'Solo el administrador crea nichos, para evitar duplicados como «Banco» y «Bancos».'
    },
    'catalogos.articulos': {
      sirve: 'Los artículos de muestra son los productos que se llevan o se ofrecen en un proyecto.',
      cambias: ['Nombre, descripción y si está activo.'],
      efecto: 'Un artículo activo se puede elegir al crear un proyecto. Desactivarlo no afecta a los proyectos que ya lo usan.',
      ejemplo: 'Agregas «Medalla de aluminio»: el supervisor ya puede elegirla como artículo de muestra de un proyecto.',
      ojo: 'La existencia no se define aquí: se fija por proyecto y baja con cada entrega.'
    },
    'catalogos.areas': {
      sirve: 'Las áreas de contacto dicen en qué departamento de la empresa trabaja cada persona de contacto (Gerencia, Compras, Mercadeo…).',
      cambias: ['Nombre, si está activa y el orden.'],
      efecto: 'Al registrar un contacto, el asesor elige entre las áreas activas.',
      ejemplo: 'Agregas «Eventos»: desde ya se puede registrar un contacto del área de Eventos.'
    },
    'catalogos.canales': {
      sirve: 'Los canales son las formas de contactar a una empresa en una gestión: llamada, WhatsApp, visita, correo…',
      cambias: ['Nombre, si es presencial y si está activo.'],
      efecto: 'El asesor elige el canal al registrar cada gestión. «Presencial» alimenta el informe que compara las gestiones presenciales con las remotas.',
      ejemplo: 'Marcas «Visita a la tienda» como presencial: en el informe de cierre cuenta como gestión presencial.'
    },
    'catalogos.resultados': {
      sirve: 'Los resultados son lo que pasó en una gestión (no contestó, pidió llamar luego, quedó interesado…). Cada uno decide qué se le pide al asesor y a qué estado empuja la empresa.',
      cambias: ['Nombre y orden.', 'Contacto logrado: si cuenta como haber hablado con alguien.', 'Pide próxima fecha: si obliga a agendar el siguiente seguimiento.', 'Empuja el estado a: ninguno, en gestión o interesada.'],
      efecto: 'Vale al instante en las gestiones nuevas. Las gestiones ya registradas no cambian.',
      ejemplo: 'El resultado «Quedó interesado» empuja la empresa a «interesada» y pide fecha de seguimiento.',
      ojo: 'El estado nunca baja: un resultado solo puede subir la empresa hasta «interesada». «Cotizada» y «vendida» salen de la cotización y de la venta.'
    },
    'catalogos.motivos': {
      sirve: 'Los motivos de pérdida explican por qué no se concretó una venta.',
      cambias: ['Nombre, si está activo y el orden.'],
      efecto: 'El asesor elige un motivo al marcar una empresa como perdida; el informe agrupa las pérdidas por motivo.',
      ejemplo: 'Agregas «Ya tiene proveedor»: aparece al marcar una pérdida y el informe cuenta cuántas fueron por eso.'
    },
    'catalogos.no_contactar': {
      sirve: 'Son los motivos para dejar de contactar a una empresa o marcarla como inactiva.',
      cambias: ['Nombre, si está activo y el orden.'],
      efecto: 'Quien marca «No contactar» o inactiva una empresa elige uno de estos motivos.',
      ejemplo: 'Agregas «Pidió no ser llamada»: queda disponible al marcar una empresa como no contactable.'
    },
    'catalogos.estructuras': {
      sirve: 'La estructura dice cómo está organizada una empresa: una sola, varias empresas o varias sucursales.',
      cambias: ['Nombre, si está activa y el orden.'],
      efecto: 'Se elige al registrar o editar una empresa.',
      ejemplo: 'Agregas «Franquicia»: se puede elegir al registrar una empresa.'
    },
    'catalogos.monedas': {
      sirve: 'Las monedas son en las que se registran las cotizaciones y las ventas de cada país.',
      cambias: ['Código de 3 letras (no se cambia después), nombre, símbolo y si está activa.'],
      efecto: 'Una moneda activa se puede asignar como moneda local de un país (pestaña Países).',
      ejemplo: 'GTQ (Q) se asigna a Guatemala: sus cotizaciones y ventas salen en quetzales.',
      ojo: 'Los informes muestran un total por moneda: nunca convierten ni mezclan monedas.'
    },
    'catalogos.paises': {
      sirve: 'Cada país tiene su moneda local, su formato de teléfono y sus reglas de referencia y de confirmación de ventas.',
      cambias: ['Moneda local, prefijo y formato del teléfono.', 'Referencia obligatoria: sí o no.', 'Confirmación de ventas: heredar la regla general, sí o no.'],
      efecto: 'La moneda y el teléfono valen al instante. Las reglas se aplican a las cotizaciones y ventas que se registren desde ahora.',
      ejemplo: 'Honduras con moneda local HNL y confirmación «Sí»: sus ventas salen en lempiras y no cuentan hasta que el supervisor las confirme.',
      ojo: 'Un país sin moneda local aparece como pendiente en el Centro de configuración: sus cotizaciones saldrán en dólares hasta que la elijas.'
    }
  },

  campos: {
    // --- Parámetros: reparto ---
    'parametros.reparto.reciben_supervisores': {
      titulo: 'Los supervisores también reciben empresas',
      que: 'Decide si los supervisores trabajan empresas del proyecto, además de los asesores.',
      efecto: `Apagado (lo normal): el reparto es solo entre asesores. Encendido: cada supervisor entra al reparto como un asesor más. ${APLICA_NUEVOS}`,
      ejemplo: 'Con 36 empresas, 6 asesores y 1 supervisor: apagado, cada asesor recibe 6; encendido, se reparten entre 7 personas (5 o 6 cada una).'
    },
    'parametros.reparto.afinidad_tienda': {
      titulo: 'Preferir la tienda que registró la empresa',
      que: 'Cuando dos asesores van empatados en cantidad de empresas, se prefiere darle la empresa a quien trabaja en la tienda que la registró.',
      efecto: `Solo sirve para desempatar: el reparto sigue siendo equitativo. Apagado, el desempate no mira la tienda. ${APLICA_NUEVOS}`,
      ejemplo: 'La empresa la registró la tienda Zona 3. Si dos asesores van empatados, la recibe el de Zona 3.'
    },
    'parametros.reparto.tope_por_asesor': {
      titulo: 'Tope inicial de empresas por asesor',
      que: 'El máximo de empresas que recibe cada asesor en un proyecto. Cada plantilla propone este valor al crear el proyecto.',
      efecto: `Lo que no cabe por el tope queda en una reserva para repartir después. Vacío significa sin tope. ${APLICA_NUEVOS}`,
      ejemplo: 'Con tope 10 y 60 empresas para 5 asesores: cada uno recibe 10 y las otras 10 quedan en reserva.'
    },
    'parametros.reparto.rondas': {
      titulo: 'Repartir la reserva en una segunda ronda',
      que: 'Permite repartir lo que quedó en reserva, a los asesores que ya avanzaron con sus empresas.',
      efecto: `Encendido: cuando un asesor llega al avance indicado, puede recibir otra tanda de la reserva. Apagado: la reserva se queda sin repartir. ${APLICA_NUEVOS}`,
      ejemplo: 'Quedaron 10 empresas en reserva. Cuando Ana gestiona 8 de sus 10 empresas, recibe una tanda de la reserva.'
    },
    'parametros.reparto.ronda_umbral': {
      titulo: 'Avance para recibir una tanda de la reserva',
      que: 'El porcentaje de sus empresas que un asesor debe haber gestionado para recibir una tanda de la reserva.',
      efecto: `Un número más alto hace esperar más; uno más bajo reparte la reserva antes. Solo importa si las rondas están encendidas. ${APLICA_NUEVOS}`,
      ejemplo: 'Con 80 %, un asesor que gestionó 8 de sus 10 empresas ya puede recibir una tanda; con 5 de 10, todavía no.'
    },
    'parametros.reparto.descanso_meses': {
      titulo: 'Descanso de una empresa con venta',
      que: 'Los meses que una empresa que ya compró «descansa» antes de volver a repartirse en el mismo nicho.',
      efecto: `Con 0 se apaga y la empresa puede repetirse en el siguiente proyecto. ${APLICA_NUEVOS}`,
      ejemplo: 'Con 3 meses, una empresa que compró en octubre no entra a un reparto del mismo nicho hasta enero.'
    },
    'parametros.ganados.meses_recompra': {
      titulo: 'Meses para sugerir la recompra',
      que: 'En «Clientes ganados», cuántos meses después de la última venta se sugiere volver a contactar al cliente.',
      efecto: 'Cambia las sugerencias de recompra al instante; no afecta a proyectos ni a ventas ya registradas.',
      ejemplo: 'Con 6 meses, si vendiste el 3 de enero, se sugiere contactar a ese cliente desde el 3 de julio.'
    },
    // --- Seguimiento ---
    'parametros.seguimiento.dias_estancado': {
      titulo: 'Días sin gestión para marcar «estancada»',
      que: 'Cuántos días puede pasar una empresa sin gestiones antes de aparecer como estancada.',
      efecto: `Un número más bajo marca más empresas como estancadas y avisa antes; uno más alto da más margen. ${APLICA_NUEVOS}`,
      ejemplo: 'Con 7 días, una empresa cuya última gestión fue el lunes 3 pasa a «estancada» si nadie la gestiona hasta el lunes 10.'
    },
    'parametros.vencimiento.gracia_dias_habiles': {
      titulo: 'Gracia antes de marcar «vencido»',
      que: 'Días hábiles que se esperan después de la fecha de fin antes de marcar el proyecto como vencido.',
      efecto: `Con 0 el proyecto se marca vencido apenas pasa su fecha de fin. ${APLICA_NUEVOS}`,
      ejemplo: 'Con fin el viernes 27 y gracia de 3 días hábiles, el proyecto se marca vencido después del miércoles 2.'
    },
    // --- Semáforo ---
    'parametros.semaforo.cobertura_verde': {
      titulo: 'Cobertura: verde desde',
      que: 'La cobertura es cuántas empresas gestionó el asesor frente a las que tiene asignadas, comparada con lo que toca según la etapa. Desde este porcentaje, su semáforo está en verde.',
      efecto: `Subirlo hace el semáforo más exigente: más asesores en ámbar o rojo. Debe ser mayor que el ámbar. ${APLICA_NUEVOS}`,
      ejemplo: 'Con verde 75 % y ámbar 50 %: un asesor que lleva 80 % de lo esperado está en verde, uno con 60 % en ámbar y uno con 40 % en rojo.'
    },
    'parametros.semaforo.cobertura_ambar': {
      titulo: 'Cobertura: ámbar desde',
      que: 'Desde este porcentaje hasta el verde, el semáforo de cobertura está en ámbar; por debajo, en rojo.',
      efecto: `Debe ser menor que el verde. Subirlo vuelve rojos a más asesores. ${APLICA_NUEVOS}`,
      ejemplo: 'Con ámbar 50 %, un asesor con 49 % de lo esperado queda en rojo.'
    },
    'parametros.semaforo.efectividad_verde': {
      titulo: 'Efectividad: verde desde',
      que: 'La efectividad es cuántas de las empresas asignadas terminaron «interesadas», medida al cierre del proyecto. Desde este porcentaje, el semáforo está en verde.',
      efecto: `Debe ser mayor que el ámbar. Subirlo exige más resultados para el verde. ${APLICA_NUEVOS}`,
      ejemplo: 'Con verde 75 %: de 10 empresas asignadas, 8 interesadas dan 80 %: verde.'
    },
    'parametros.semaforo.efectividad_ambar': {
      titulo: 'Efectividad: ámbar desde',
      que: 'Desde este porcentaje hasta el verde, el semáforo de efectividad está en ámbar; por debajo, en rojo.',
      efecto: `Debe ser menor que el verde. ${APLICA_NUEVOS}`,
      ejemplo: 'Con ámbar 50 %: 4 interesadas de 10 (40 %) quedan en rojo.'
    },
    // --- Importación ---
    'parametros.importacion.max_filas': {
      titulo: 'Filas máximas por archivo',
      que: 'El número máximo de filas que acepta un archivo CSV al importar empresas.',
      efecto: 'Vale desde la próxima importación. Un archivo con más filas se rechaza antes de procesarlo.',
      ejemplo: 'Con 2000, un archivo de 2500 filas se rechaza: se divide en dos archivos.'
    },
    'parametros.importacion.max_mb': {
      titulo: 'Tamaño máximo del CSV',
      que: 'El peso máximo, en megabytes, de un archivo CSV al importar.',
      efecto: 'Vale desde la próxima importación. Un archivo más pesado se rechaza.',
      ejemplo: 'Con 5 MB, un archivo de 7 MB no se acepta.'
    },
    'parametros.importacion.duplicadas_por_defecto': {
      titulo: 'Qué hacer con las duplicadas',
      que: 'Lo que viene marcado por defecto en cada fila del archivo que se parece a una empresa ya registrada.',
      efecto: 'Omitir: la fila duplicada no se importa. Actualizar: sus datos se ponen sobre la empresa existente. Es solo lo que viene marcado; quien importa lo puede cambiar fila por fila.',
      ejemplo: 'Con «Omitir», una fila de «Banco Industrial» que ya existe aparece marcada para no importarse.'
    },
    // --- Empresas ---
    'parametros.empresas.ciudad_obligatoria': {
      titulo: 'La ciudad es obligatoria',
      que: 'Decide si se puede guardar una empresa sin ciudad.',
      efecto: 'Encendido: el formulario y la importación exigen ciudad. Vale al instante para las empresas que se registren desde ahora; las existentes no se tocan.',
      ejemplo: 'Encendido, una empresa sin ciudad muestra el error «La ciudad es obligatoria» y no se guarda.'
    },
    'parametros.empresas.contacto_obligatorio': {
      titulo: 'Pedir al menos un contacto',
      que: 'Cada empresa nueva necesita registrar al menos una persona de contacto.',
      efecto: 'Apagado: se pueden registrar empresas sin contactos. Vale al instante para registros nuevos.',
      ejemplo: 'Encendido, no se puede guardar «Hotel Sol» sin al menos un contacto.'
    },
    'parametros.empresas.telefono_o_correo_obligatorio': {
      titulo: 'Pedir teléfono o correo',
      que: 'Hace falta al menos una forma de contactar: un teléfono o un correo.',
      efecto: 'Apagado: se pueden registrar empresas sin ninguno de los dos. Vale al instante para registros nuevos.',
      ejemplo: 'Encendido, un contacto sin teléfono ni correo no se puede guardar.'
    },
    'parametros.empresas.sitio_web_obligatorio': {
      titulo: 'El sitio web es obligatorio',
      que: 'Decide si se puede guardar una empresa sin sitio web.',
      efecto: 'Encendido: el formulario exige sitio web. Vale al instante para registros nuevos.',
      ejemplo: 'Encendido, una empresa sin sitio web muestra el error y no se guarda.'
    },
    'parametros.empresas.duplicado_por_nombre_ciudad': {
      titulo: 'Avisar de duplicado por país, nombre y ciudad',
      que: 'Antes de crear una empresa, avisa si ya hay otra con el mismo país, un nombre muy parecido y la misma ciudad.',
      efecto: 'Es un aviso: quien registra puede decidir. Vale al instante.',
      ejemplo: 'Al registrar «Banco Industrial S.A.» en Guatemala, avisa que ya existe «Banco Industrial» en la misma ciudad.'
    },
    'parametros.empresas.duplicado_por_telefono': {
      titulo: 'Avisar de duplicado por teléfono',
      que: 'Avisa si el teléfono que se escribe ya está registrado en otra empresa.',
      efecto: 'Es un aviso: quien registra puede decidir. Vale al instante.',
      ejemplo: 'Si el 2222-3333 ya es de «Hotel Sol», al usarlo en otra empresa avisa de la coincidencia.'
    },
    'parametros.empresas.similitud_minima': {
      titulo: 'Parecido mínimo del nombre',
      que: 'Qué tan parecido debe ser un nombre al de otra empresa para avisar de un posible duplicado.',
      efecto: 'Un porcentaje más alto avisa solo con nombres casi iguales; uno más bajo avisa más seguido (con más falsas alarmas). Vale al instante.',
      ejemplo: 'Con 85 %, «Corporación Mar» y «Corporacion Mar» se avisan como parecidas; «Mar del Sur» no.'
    },
    // --- Código e informe ---
    'parametros.codigo.formato': {
      titulo: 'Formato del código del proyecto',
      que: 'Cómo se arma el código de cada proyecto. Se escriben marcadores entre llaves: {AAAA} año, {MM} mes, {NICHO} iniciales del nicho y {N} número.',
      efecto: 'Aplica a los proyectos que se creen desde ahora; los que ya existen conservan su código. Debe llevar al menos un marcador para que cada código sea distinto.',
      ejemplo: 'PRY-{AAAA}-{MM}-{NICHO} da PRY-2026-11-BAN para Bancos y cooperativas en noviembre de 2026.'
    },
    'parametros.informe.filas_por_tabla': {
      titulo: 'Filas por tabla en el PDF',
      que: 'Cuántas filas muestra cada tabla del informe en PDF antes de resumir el resto.',
      efecto: `Aplica a los informes de los proyectos que cierres desde ahora. ${APLICA_NUEVOS}`,
      ejemplo: 'Con 20, una tabla de 35 asesores muestra 20 filas y luego «y 15 más».'
    },
    'parametros.informe.secciones': {
      titulo: 'Secciones del informe',
      que: 'Qué partes lleva el informe de cierre y su PDF: embudo, montos, canal, muestras, por asesor y por tienda.',
      efecto: `Una sección sin marcar no aparece en el informe. Debe quedar al menos una. ${APLICA_NUEVOS}`,
      ejemplo: 'Si desmarcas «Muestras», el informe de los proyectos nuevos ya no incluye la sección de muestras.'
    },
    'parametros.informe.texto_encabezado': {
      titulo: 'Línea bajo el título del PDF',
      que: 'Un texto opcional que aparece justo debajo del título del PDF del informe.',
      efecto: 'Vale para los PDF que se generen desde ahora. Puede quedar vacío.',
      ejemplo: 'Escribes «Uso interno — Gerencia comercial»: aparece bajo el título de cada PDF.'
    },
    // --- Reglas ---
    'parametros.reglas.visto_bueno_cierre': {
      titulo: 'Visto bueno del gerente al cerrar',
      que: 'Cuando el supervisor cierra un proyecto, el cierre espera a que el gerente lo revise y dé su visto bueno.',
      efecto: `Apagado: el proyecto se cierra sin visto bueno. Quién da el visto bueno se asigna en Roles. ${APLICA_NUEVOS}`,
      ejemplo: 'Encendido: el supervisor cierra «Bancos noviembre», el gerente lo revisa y lo aprueba o lo devuelve con comentarios.'
    },
    'parametros.reglas.aprobar_activacion': {
      titulo: 'Aprobación del gerente antes de activar',
      que: 'El supervisor no activa el proyecto directamente: pide la activación y el gerente la aprueba.',
      efecto: `Encendido: aparece el estado «esperando aprobación»; al aprobar, el proyecto se activa y se reparte. Si el gerente rechaza, vuelve a borrador con su comentario. ${APLICA_NUEVOS}`,
      ejemplo: 'El supervisor pide activar el proyecto de noviembre; el gerente lo aprueba y en ese momento se reparten las empresas.'
    },
    'parametros.reglas.confirmar_ventas': {
      titulo: 'Confirmación de ventas por el supervisor',
      que: 'Una venta registrada por el asesor no cuenta hasta que el supervisor la confirme. Es la regla general; cada país puede cambiarla.',
      efecto: `Encendido: la venta queda «por confirmar» y no suma en los informes ni cambia la empresa a «vendida» hasta confirmarse. Si el supervisor la rechaza, vuelve al asesor con el motivo. ${APLICA_NUEVOS}`,
      ejemplo: 'Ana registra una venta de Q5,000: queda por confirmar; cuando el supervisor la confirma, entra al informe.'
    },
    // --- Automatización ---
    'parametros.activacion_auto.activa': {
      titulo: 'Activar proyectos con el plan del año',
      que: 'El sistema crea y activa solo el proyecto del mes según el plan del año, sin que un supervisor tenga que hacerlo.',
      efecto: 'Encendido: cada mes, en el día y la hora elegidos, se crea el proyecto del plan con todas las tiendas libres que tengan asesores. Si la aprobación del gerente está encendida, queda esperando su aprobación.',
      ejemplo: 'Con el plan de noviembre en «Bancos y cooperativas», el 2 de noviembre a las 07:00 aparece el proyecto activo y repartido.',
      ojo: 'Si no se puede crear (sin plan, sin plantilla o sin tiendas libres), no se deja nada a medias y se avisa a los administradores.'
    },
    'parametros.activacion_auto.dia': {
      titulo: 'Día de la activación',
      que: 'El día del mes en que se activa el proyecto del plan. 0 significa el primer día hábil del mes.',
      efecto: 'Si el día elegido cae en fin de semana, pasa al siguiente día hábil. Solo importa si la activación automática está encendida.',
      ejemplo: 'Con 5: el proyecto se activa el 5 de cada mes (o el lunes siguiente, si cae en fin de semana).'
    },
    'parametros.activacion_auto.hora': {
      titulo: 'Hora de la activación',
      que: 'La hora del día en que se activa el proyecto del plan. Es hora de Guatemala, en formato de 24 horas.',
      efecto: 'Solo importa si la activación automática está encendida. El sistema revisa cada 15 minutos.',
      ejemplo: 'Con 07:00, el proyecto se activa a las 7 de la mañana; con 15:30, a las 3:30 de la tarde.'
    },

    // --- Plantillas ---
    'plantillas.articulo': {
      titulo: 'Artículo de muestra',
      que: 'El artículo que la plantilla propone al crear un proyecto.',
      efecto: 'Es solo una sugerencia, salvo que lo bloquees o lo pidas como obligatorio en «Qué puede cambiar el supervisor».',
      ejemplo: 'La plantilla propone «Medalla de aluminio»; el supervisor la encuentra ya elegida.'
    },
    'plantillas.existencia': {
      titulo: 'Existencia sugerida',
      que: 'Cuántas unidades de muestra se propone tener para el proyecto.',
      efecto: 'Es la cantidad con la que arranca la existencia del proyecto; baja con cada entrega. El supervisor puede cambiarla si no está bloqueada.',
      ejemplo: 'Con 100 unidades y 12 entregadas, quedan 88.'
    },
    'plantillas.meta': {
      titulo: 'Meta de venta',
      que: 'El monto de venta que se propone como meta del proyecto, con su moneda.',
      efecto: 'Es la meta de partida; el supervisor puede ajustarla si no está bloqueada.',
      ejemplo: 'Meta de 50,000 en GTQ: el semáforo y el informe la usan para medir el avance.'
    },
    'plantillas.tope': {
      titulo: 'Tope de empresas por asesor',
      que: 'El máximo de empresas que recibe cada asesor con esta plantilla. Es opcional.',
      efecto: 'Lo que no cabe por el tope queda en reserva. Vacío significa sin tope.',
      ejemplo: 'Tope 10 con 60 empresas y 5 asesores: 10 cada uno y 10 en reserva.'
    },
    'plantillas.etapas': {
      titulo: 'Etapas',
      que: 'Los pasos del proyecto en orden, con su nombre, qué se espera y cuántos días hábiles dura cada uno.',
      efecto: 'La duración total del proyecto es la suma de las etapas. Las etapas orientan, no bloquean: sirven para el semáforo («vas atrasado respecto a la etapa»).',
      ejemplo: 'Preparación (5 días), Contacto (5), Seguimiento (5) y Cierre (5) suman 20 días hábiles, o sea 4 semanas.'
    },
    'plantillas.predeterminada': {
      titulo: 'Plantilla predeterminada',
      que: 'La plantilla que el asistente ofrece primero al crear un proyecto. Solo una puede serlo.',
      efecto: 'Al marcar otra como predeterminada, la anterior deja de serlo. La predeterminada no se puede desactivar.',
      ejemplo: '«Proyecto mensual estándar» es la predeterminada: sale elegida cuando el supervisor empieza un proyecto.'
    },
    'plantillas.activa': {
      titulo: 'Plantilla activa',
      que: 'Si la plantilla se ofrece al crear proyectos.',
      efecto: 'Una plantilla inactiva ya no se ofrece, pero los proyectos que la usaron conservan su copia.',
      ejemplo: 'Desactivas «Proyecto corto de 3 semanas»: deja de aparecer, y los proyectos que la usaron siguen igual.'
    },
    'plantillas.controles': {
      titulo: 'Qué puede cambiar el supervisor',
      que: 'Para cada dato (artículo, existencia, meta, tope y fechas de las etapas) eliges si el supervisor lo puede editar, si queda bloqueado o si es obligatorio.',
      efecto: 'Bloqueado: el supervisor ve el valor con un candado y no lo puede cambiar. Obligatorio: debe completarlo antes de activar. Editable: lo puede cambiar libremente. El sistema lo hace cumplir, no solo la pantalla.',
      ejemplo: 'Bloqueas la meta en 50,000: el supervisor la ve con candado. Marcas el artículo como obligatorio: no puede activar sin elegir uno.',
      ojo: 'Para bloquear un dato, la plantilla debe traerlo ya escrito.'
    },

    // --- Reglas por país ---
    'reglas.referencia_pais': {
      titulo: 'Referencia obligatoria',
      que: 'Si al registrar una cotización o una venta en ese país hay que escribir el número de cotización y de orden de venta.',
      efecto: 'Apagado: la referencia es opcional en ese país. Se aplica a las cotizaciones y ventas que se registren desde ahora.',
      ejemplo: 'Con referencia obligatoria en Guatemala, una venta sin número de orden no se puede guardar.'
    },
    'reglas.confirmacion_pais': {
      titulo: 'Confirmación de ventas por país',
      que: 'Permite que un país siga o cambie la regla general de confirmar ventas: heredar (usa la general), sí (siempre confirma) o no (nunca).',
      efecto: 'Se aplica a las ventas que se registren desde ahora. «Heredar» sigue lo que diga el interruptor general.',
      ejemplo: 'La regla general está apagada, pero Honduras tiene «Sí»: sus ventas quedan por confirmar y las de los demás países no.'
    },

    // --- Campos propios ---
    'campos.tipo': {
      titulo: 'Tipo de campo',
      que: 'La clase de dato que guarda el campo: texto, número, lista de opciones, sí/no o fecha.',
      efecto: 'El tipo no se puede cambiar después. Para otro tipo, crea otro campo.',
      ejemplo: '«Número de agencias» es de tipo número: solo acepta cifras.'
    },
    'campos.opciones': {
      titulo: 'Opciones de la lista',
      que: 'Las opciones entre las que se elige cuando el tipo es lista.',
      efecto: 'Aparecen en el formulario y en los filtros de la cartera.',
      ejemplo: 'Para «Tamaño»: Pequeña, Mediana, Grande.'
    },
    'campos.obligatorio': {
      titulo: 'Obligatorio',
      que: 'Si el campo debe llenarse para poder guardar una empresa.',
      efecto: 'Vale al instante para las empresas que se guarden desde ahora; las que ya existen no se tocan. También se exige al importar.',
      ejemplo: 'Con «Número de agencias» obligatorio, un banco sin ese dato no se guarda.'
    },
    'campos.visible_lista': {
      titulo: 'Visible en la lista',
      que: 'Si el campo aparece como una columna en la lista de la cartera.',
      efecto: 'Solo cambia lo que se ve en la lista; el dato siempre está en la ficha.',
      ejemplo: 'Con «Número de agencias» visible, la lista de bancos muestra esa columna.'
    },
    'campos.nicho': {
      titulo: 'A qué nicho aplica',
      que: 'Un nicho concreto o todos. El campo solo se pide y se muestra en las empresas de ese nicho.',
      efecto: 'Si lo cambias, el campo se pide en otro grupo de empresas; los datos que ya estaban guardados se conservan.',
      ejemplo: 'Un campo solo para «Hoteles» no aparece al registrar un banco.'
    },
    'campos.activo': {
      titulo: 'Campo activo',
      que: 'Si el campo se pide y se muestra.',
      efecto: 'Desactivarlo no borra datos: dejan de verse y vuelven si lo reactivas.',
      ejemplo: 'Desactivas «Número de agencias»: el formulario ya no lo pide, pero los valores guardados siguen allí.'
    },

    // --- Catálogos ---
    'catalogos.resultado.efecto': {
      titulo: 'Empuja el estado a',
      que: 'A qué estado sube la empresa cuando se registra una gestión con este resultado: ninguno, en gestión o interesada.',
      efecto: 'Vale en las gestiones nuevas. El estado nunca baja: si la empresa ya estaba más adelante, no cambia.',
      ejemplo: '«Quedó interesado» empuja a «interesada»; «No contestó» no mueve el estado.'
    },
    'catalogos.resultado.contacto': {
      titulo: 'Contacto logrado',
      que: 'Si este resultado cuenta como haber hablado de verdad con alguien de la empresa.',
      efecto: 'Alimenta los números de contacto del seguimiento y del informe.',
      ejemplo: '«No contestó» no es contacto logrado; «Habló con compras» sí.'
    },
    'catalogos.resultado.proxima': {
      titulo: 'Pide próxima fecha',
      que: 'Si al elegir este resultado el asesor debe agendar el siguiente seguimiento.',
      efecto: 'Vale en las gestiones nuevas. Sin fecha no se puede guardar la gestión.',
      ejemplo: '«Pidió que lo llamen el lunes» exige escribir la fecha del siguiente contacto.'
    },
    'catalogos.canal.presencial': {
      titulo: 'Presencial',
      que: 'Si el canal es una visita en persona, no remota.',
      efecto: 'El informe compara las gestiones presenciales con las remotas.',
      ejemplo: '«Visita» es presencial; «WhatsApp» no.'
    },
    'catalogos.pais.moneda': {
      titulo: 'Moneda local',
      que: 'La moneda en la que se registran las cotizaciones y las ventas de ese país.',
      efecto: 'Sin moneda local, las cotizaciones y ventas de ese país salen en dólares hasta que la elijas.',
      ejemplo: 'Guatemala con GTQ: sus ventas salen en quetzales.'
    },

    // --- Avisos (una entrada por evento) ---
    'avisos.reparto_recibido': aviso('Reparto recibido', 'Avisa al asesor cuando le llegan empresas de un proyecto.', 'Se activa el proyecto y a Ana le avisan: «Recibiste 6 empresas».'),
    'avisos.meta_ajustada': aviso('Meta de ventas ajustada', 'Avisa al asesor cuando se cambia su meta de ventas.', 'El supervisor sube la meta de Ana de Q20,000 a Q25,000 y a ella le llega el aviso.'),
    'avisos.reasignada_recibe': aviso('Empresa reasignada: la recibe', 'Avisa al asesor que recibe una empresa que pasó de otra persona.', 'El supervisor reasigna «Hotel Sol» a Luis y a Luis le avisan.'),
    'avisos.reasignada_pierde': aviso('Empresa reasignada: la pierde', 'Avisa al asesor al que le quitaron una empresa.', 'El supervisor pasa «Hotel Sol» de Ana a Luis y a Ana le avisan.'),
    'avisos.seguimiento_vence': aviso('Seguimiento que vence', 'Avisa al asesor antes de que venza un seguimiento que agendó. La anticipación son las horas antes del vencimiento (0 = el mismo día).', 'Con 2 horas de anticipación, un seguimiento de las 10:00 avisa a las 8:00.'),
    'avisos.seguimiento_vencido': aviso('Seguimiento vencido', 'Avisa al asesor y, si lo dejas encendido, al supervisor cuando un seguimiento ya pasó sin gestionarse.', 'El seguimiento del martes no se hizo: el miércoles les llega el aviso.'),
    'avisos.proyecto_por_cerrar': aviso('Proyecto por cerrar', 'Avisa al supervisor unos días antes de la fecha de fin del proyecto. La anticipación son los días.', 'Con 3 días, el proyecto que termina el viernes avisa el martes.'),
    'avisos.proyecto_vencido': aviso('Proyecto vencido', 'Avisa al supervisor y al gerente cuando el proyecto pasó su fecha de fin y los días de gracia sin cerrarse.', 'El proyecto terminó el viernes 27 y sigue abierto: tras los días de gracia les llega el aviso.'),
    'avisos.activacion_automatica': aviso('Proyecto activado por el plan del año', 'Avisa al supervisor y al gerente cuando el sistema activó solo el proyecto del mes.', 'El 2 de noviembre a las 07:00 se activa el proyecto del plan y les llega el aviso.'),
    'avisos.activacion_pedida': aviso('Activación pedida', 'Avisa al gerente cuando un supervisor pide activar un proyecto (si la aprobación está encendida).', 'El supervisor pide activar «Bancos noviembre» y el gerente recibe el aviso.'),
    'avisos.activacion_resuelta': aviso('Activación aprobada o rechazada', 'Avisa al supervisor cuando el gerente aprueba o rechaza su pedido de activación.', 'El gerente aprueba y el supervisor recibe: «Tu proyecto fue aprobado».'),
    'avisos.cierre_pendiente': aviso('Cierre pendiente de visto bueno', 'Avisa al gerente cuando un proyecto cerrado espera su visto bueno.', 'El supervisor cierra el proyecto y el gerente recibe el aviso para revisarlo.'),
    'avisos.visto_bueno_resuelto': aviso('Visto bueno dado o devuelto', 'Avisa al supervisor cuando el gerente da o devuelve el visto bueno del cierre.', 'El gerente devuelve el cierre con comentarios y el supervisor recibe el aviso.'),
    'avisos.venta_por_confirmar': aviso('Venta por confirmar', 'Avisa al supervisor cuando un asesor registra una venta que debe confirmar (si la confirmación está encendida).', 'Ana registra una venta de Q5,000 y el supervisor recibe el aviso para confirmarla.'),
    'avisos.venta_revisada': aviso('Venta confirmada o rechazada', 'Avisa al asesor cuando el supervisor confirma o rechaza su venta.', 'El supervisor rechaza la venta con un motivo y Ana lo recibe.'),
    'avisos.registro_anulado': aviso('Cotización, venta o gestión anulada', 'Avisa al asesor cuando se anula un registro suyo.', 'El supervisor anula una cotización duplicada de Ana y ella recibe el aviso.'),
    'avisos.existencia_baja': aviso('Existencia de muestras baja', 'Avisa al supervisor cuando las muestras del proyecto bajan de una cantidad. La anticipación es esa cantidad de unidades.', 'Con 20 unidades, cuando quedan 20 o menos de la medalla, el supervisor recibe el aviso.'),
    'avisos.anticipacion': {
      titulo: 'Anticipación',
      que: 'Cuánto antes (horas, días o unidades, según el aviso) se manda el aviso.',
      efecto: 'Un valor más grande avisa con más tiempo. Vale desde ya.',
      ejemplo: 'En «Proyecto por cerrar» con 3 días, el aviso llega 3 días antes de la fecha de fin.'
    },

    // --- Kit del nicho ---
    'kit.variables': {
      titulo: 'Variables de los mensajes',
      que: 'Palabras entre llaves que el sistema reemplaza con datos reales al abrir el mensaje: {empresa}, {contacto}, {asesor}, {articulo} y {nicho}.',
      efecto: 'Si falta un dato (por ejemplo el artículo), ese mensaje se oculta con su motivo; en el guion queda un hueco ____ para completarlo. Una variable que no existe se rechaza al guardar.',
      ejemplo: '«Hola {contacto}» se convierte en «Hola María». Sin contacto, queda «Hola equipo de Hotel Sol».'
    },
    'kit.guion': {
      titulo: 'Guion de llamada',
      que: 'El texto que el asesor lee o sigue cuando llama a una empresa del nicho.',
      efecto: 'Vale al instante. Puede llevar las variables; los datos que falten se dejan como huecos para completar en la llamada.',
      ejemplo: 'Buenos días, ¿hablo con {contacto}? Le llamo de Premia por {articulo}…'
    },
    'kit.mensajes': {
      titulo: 'Mensajes',
      que: 'Plantillas de WhatsApp o de correo que el asesor abre prellenadas. El portal no los envía: abre la aplicación con el texto listo.',
      efecto: 'Un mensaje apagado deja de aparecer. Hay un máximo de 20 mensajes por kit.',
      ejemplo: 'El asesor toca «WhatsApp» y se abre la conversación con el mensaje ya escrito.'
    },

    // --- Plan del año ---
    'plan.mes': {
      titulo: 'Plan del mes',
      que: 'El nicho, el artículo y la plantilla que tocan ese mes. El artículo y la plantilla son opcionales: sin ellos manda la plantilla predeterminada.',
      efecto: 'Un mes que ya pasó, o que ya tiene proyecto activo, esperando aprobación o cerrado, no se puede cambiar. El asistente de proyectos usa este plan como sugerencia.',
      ejemplo: 'Planificas diciembre con «Colegios»: en diciembre, al crear el proyecto, se sugiere ese nicho.'
    },

    // --- Alcance ---
    'alcance.paises': {
      titulo: 'Países de una persona',
      que: 'Los países de los que esa persona ve y registra empresas. Por defecto, el de su tienda.',
      efecto: 'Inmediato. Debe quedar al menos un país. Quitar un país no borra datos: dejan de verse.',
      ejemplo: 'A un supervisor regional le marcas Guatemala y Honduras: ve la cartera de los dos.'
    }
  }
};
