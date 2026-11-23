// Pruebas de la gráfica de diseñadores y de las tarjetas de contadores (módulos puros, sin DOM ni servidor).
// Uso: node scripts/reportes/probarGraficaDisenadores.mjs  (sale con código 1 si algo falla)
const ruta = (rel) => new URL(rel, import.meta.url).href;
const { filasGraficaDisenadores, htmlGraficaDisenadores } = await import(ruta('../../public/modules/vales/js/views/reportes2/graficaDisenadores.js'));
const { htmlContadores } = await import(ruta('../../public/modules/vales/js/views/reportes2/contadoresActividad.js'));
const { TEXTOS_DISENADOR: T, TEXTOS_ASESOR, TEXTOS_TIENDA } = await import(ruta('../../public/modules/vales/js/views/reportes2/textos.js'));

let fallos = 0;
const ok = (nombre, cond, detalle = '') => { console.log(`${cond ? 'OK   ' : 'FALLA'} ${nombre}${detalle ? ` -> ${detalle}` : ''}`); if (!cond) fallos++; };
const cuenta = (s, re) => (s.match(re) || []).length;

const d = (id, nombre, asignados, entregados, tarde, efectividad, tardias) => ({ id, nombre, asignados, entregados, tarde, efectividad, tardias });
const lista3 = [d(1, 'Ana', 20, 10, 3, 50, 30), d(0, 'Sin diseñador asignado', 8, 0, 0, 0, null), d(2, 'Luis', 5, 5, 1, 100, 20)];

// Modelo de filas
const m = filasGraficaDisenadores(lista3);
ok('modelo: Sin diseñador asignado siempre primero, aunque otro tenga más', filasGraficaDisenadores([d(1, 'Ana', 20, 10, 3, 50, 30), d(0, 'Sin', 8, 0, 0, 0, null), d(2, 'Luis', 5, 5, 1, 100, 20)]).filas.map(f => f.id).join() === '0,1,2');
ok('modelo: escala = mayor de asignados', m.maximo === 20, String(m.maximo));
ok('modelo: razones comparten escala', m.filas[1].razonAsignados === 1 && m.filas[1].razonEntregados === 0.5 && m.filas[2].razonAsignados === 0.25, JSON.stringify(m.filas.map(f => [f.razonAsignados, f.razonEntregados])));
ok('modelo: parte a tiempo = entregados - tarde', m.filas[1].aTiempo === 7 && m.filas[2].aTiempo === 4);
ok('modelo: bandera de ancho mínimo del rojo', m.filas[1].rojoMinimo === true && m.filas[0].rojoMinimo === false && m.filas[2].rojoMinimo === true);
ok('modelo: id 0 es una fila normal', m.filas[0].id === 0 && m.filas[0].nombre === 'Sin diseñador asignado');
ok('modelo: sin entregados la razón es 0', m.filas[0].razonEntregados === 0);
ok('modelo: lista vacía', filasGraficaDisenadores([]).filas.length === 0 && filasGraficaDisenadores(null).maximo === 0);
ok('modelo: tarde no pasa de entregados', filasGraficaDisenadores([d(3, 'X', 4, 2, 9, null, null)]).filas[0].tarde === 2);

// Marcado
const html = htmlGraficaDisenadores(lista3, T, { interactiva: true });
ok('html: lista vacía = cadena vacía', htmlGraficaDisenadores([], T) === '' && htmlGraficaDisenadores(null, T) === '');
ok('html: una fila por diseñador', cuenta(html, /<li class="rep2-gt-fila rep2-gd-fila/g) === 3);
ok('html: título y leyenda de colores', html.includes('Vales asignados y entregados por diseñador') && html.includes('Asignados') && html.includes('Entregados a tiempo') && html.includes('Entregados tarde'));
ok('html: leyenda de letras con E y T en negrita y sin el cálculo', html.includes('<strong>E</strong> = Efectividad · <strong>T</strong> = Entregas tardías') && !html.includes('÷'));
ok('html: cabecera E y T con title', /<span class="rep2-gd-colh" title="[^"]+">E<\/span><span class="rep2-gd-colh" title="[^"]+">T<\/span>/.test(html));
ok('html: valores E y T con porcentaje y «—»', html.includes('>50 %</span>') && html.includes('>30 %</span>') && html.includes('>100 %</span>'));
const liSin = html.split('<li ').find(s => s.includes('data-id="0"')) || '';
ok('html: Sin diseñador asignado = una barra, hueco en lugar de la segunda y sin E ni T', liSin.includes('rep2-gd-fila--sin') && liSin.includes('rep2-gd-linea--hueco') && !liSin.includes('rep2-gd-barra--apilada') && !/>s*[d.]+ %</.test(liSin) && !liSin.includes('>—<') && liSin.includes('<span class="rep2-gd-e"></span><span class="rep2-gd-t"></span>'));
ok('html: solo Sin asignar usa la fila de una barra', cuenta(html, /rep2-gd-fila--sin/g) === 1);
ok('html: modos de los blancos', cuenta(html, /data-modo="todos"/g) === 6 && cuenta(html, /data-modo="entregados"/g) === 2 && cuenta(html, /data-modo="tarde"/g) === 2, `todos=${cuenta(html, /data-modo="todos"/g)} entregados=${cuenta(html, /data-modo="entregados"/g)} tarde=${cuenta(html, /data-modo="tarde"/g)}`);
ok('html: la cifra de tarde va dentro del segmento rojo', />\s*3<\/button>/.test(html) && /rep2-gd-seg--tarde"[^>]*>1<\/button>/.test(html) && /rep2-gd-seg--tarde"[^>]*>3<\/button>/.test(html));
ok('html: id 0 con data-id="0"', html.includes('data-id="0"'));
ok('html: sin elegida ningún aria-pressed true', !html.includes('aria-pressed="true"'));
const htmlTarde = htmlGraficaDisenadores(lista3, T, { elegida: 0, modoElegido: 'tarde', interactiva: true });
ok('html: elegido 0 sin entregas tarde no marca nada raro', cuenta(htmlTarde, /aria-pressed="true"/g) === 0);
const htmlTarde2 = htmlGraficaDisenadores(lista3, T, { elegida: 1, modoElegido: 'tarde', interactiva: true });
ok('html: elegida + modo tarde marca solo el segmento rojo de ese diseñador', cuenta(htmlTarde2, /aria-pressed="true"/g) === 1 && /rep2-gd-seg--tarde" data-modo="tarde" aria-pressed="true"/.test(htmlTarde2) && htmlTarde2.includes('rep2-gt-fila--elegida'));
const htmlEnt = htmlGraficaDisenadores(lista3, T, { elegida: 2, modoElegido: 'entregados', interactiva: true });
ok('html: modo entregados marca la parte a tiempo y ofrece quitarlo', cuenta(htmlEnt, /aria-pressed="true"/g) === 1 && htmlEnt.includes('Quitar el enfoque en los vales entregados de Luis'));
const htmlTodos = htmlGraficaDisenadores(lista3, T, { elegida: 1, modoElegido: 'todos', interactiva: true });
ok('html: modo todos marca el nombre y la barra Asignados', cuenta(htmlTodos, /aria-pressed="true"/g) === 2 && htmlTodos.includes('Quitar el enfoque en Ana y ver todos los diseñadores'));
ok('html: etiquetas de los blancos', html.includes('Ver los contadores y el desglose de Ana') && html.includes('Ver solo los vales entregados de Ana') && html.includes('Ver solo las entregas tarde de Ana'));
// Ningún botón dentro de otro botón
const anidado = (s) => { let prof = 0; for (const t of s.match(/<\/?button\b/g) || []) { if (t === '<button') { if (prof > 0) return true; prof++; } else prof--; } return false; };
ok('html: sin botón dentro de botón', !anidado(html) && !anidado(htmlTarde2) && !anidado(htmlGraficaDisenadores(lista3, T, { elegida: 1, interactiva: true })));
const sinInter = htmlGraficaDisenadores(lista3, T, { interactiva: false });
ok('html: no interactiva no tiene botones de barra', cuenta(sinInter, /<button type="button" class="rep2-gd/g) === 0 && !sinInter.includes('aria-pressed'));
// Doce filas
const doce = Array.from({ length: 12 }, (_, i) => d(i + 1, `D${i + 1}`, 30 - i, 10, i % 3, 33.33, 10));
const h12 = htmlGraficaDisenadores(doce, T, { interactiva: true });
ok('html: 12 filas -> salen las 12, sin ocultas ni «Ver las N restantes»', cuenta(h12, /<li class="rep2-gt-fila rep2-gd-fila/g) === 12 && !h12.includes('data-extra') && !h12.includes('Ver las') && !h12.includes('rep2-gt-mas'));
const cuarenta = Array.from({ length: 40 }, (_, i) => d(i + 1, `D${i + 1}`, 50 - i, 5, 0, 10, 0));
ok('html: 40 filas también salen completas', cuenta(htmlGraficaDisenadores(cuarenta, T, { interactiva: true }), /<li class="rep2-gt-fila rep2-gd-fila/g) === 40);

// Tarjetas de contadores
const base = { ingresados: 10, urgentes: { total: 3, porcentaje: 30 }, sinEntregar: 2, atrasados: { total: 4, anteriores: 1, actuales: 3 }, recibidos: { total: 5, conAtraso: 2, sinAtraso: 3 } };
const sin = htmlContadores(base, T);
const con = htmlContadores({ ...base, urgentes: { total: 3, porcentaje: 33.333 }, efectividad: 50, aTiempo: 60 }, T);
const cartas = (s) => cuenta(s, /class="rep2-cont-card/g);
ok('contadores: sin efectividad 5 tarjetas (con Urgentes)', cartas(sin) === 5 && sin.includes('>Urgentes<') && !sin.includes('rep2-cont-card--calculada') && !sin.includes('rep2-contadores--cuatro'), String(cartas(sin)));
ok('contadores: diseñadores 6 tarjetas, sin Urgentes', cartas(con) === 6 && !con.includes('>Urgentes<') && !con.includes('data-filtro="urgente"') && con.includes('rep2-contadores--cuatro'), String(cartas(con)));
const orden = ['>Ingresados<', '>Por vencer<', '>Efectividad<', '>Entregas a tiempo<', '>Atrasados<', '>Entregados<'].map(s => con.indexOf(s));
ok('contadores: orden Ingresados · Por vencer · Efectividad · Entregas a tiempo, y debajo Atrasados y Entregados', orden.every((p, k) => p >= 0 && (k === 0 || p > orden[k - 1])), orden.join(','));
ok('contadores: Efectividad y detalle', con.includes('>Efectividad<') && con.includes('>50 %<') && con.includes('5 de 10 vales entregados (3 atrasados)'));
ok('contadores: Entregas a tiempo y detalle', con.includes('>Entregas a tiempo<') && con.includes('>60 %<') && con.includes('3 de 5 entregas'));
ok('contadores: Urgentes de tiendas/asesores sigue en %', sin.includes('>30 %<'));
const nulos = htmlContadores({ ...base, efectividad: null, aTiempo: null }, T);
ok('contadores: null -> «—»', cuenta(nulos, />—</g) === 2);
ok('contadores: tarjetas nuevas no son botones', !/<button[^>]*rep2-cont-card--mitad/.test(htmlContadores({ ...base, efectividad: 1, aTiempo: 1 }, T, { pulsables: true, activos: {} })));
ok('contadores: tienda/asesor no cambian de tarjetas', cartas(htmlContadores(base, TEXTOS_TIENDA)) === 5 && cartas(htmlContadores(base, TEXTOS_ASESOR, { pulsables: true })) === 5);

console.log(fallos ? `\n${fallos} comprobación(es) fallaron` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
