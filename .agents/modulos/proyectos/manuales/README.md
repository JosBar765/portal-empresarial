# Manuales de usuario del módulo Proyectos

Un manual por rol, en lenguaje sencillo y con capturas reales de la pantalla. Cada uno tiene el recorrido del primer día, los pasos de cada tarea, las reglas importantes, los avisos, preguntas frecuentes y un glosario.

| Rol | Word (para entregar) | Fuente |
|---|---|---|
| Asesor | `manual_asesor.docx` | `manual_asesor.md` |
| Supervisor | `manual_supervisor.docx` | `manual_supervisor.md` |
| Gerente | `manual_gerente.docx` | `manual_gerente.md` |
| Administrador | `manual_administrador.docx` | `manual_administrador.md` |

## Cómo se actualizan

1. Edita el `.md` del rol (los títulos con `#` abren capítulo; las capturas se escriben `![Pie](capturas/archivo.jpg)`; los avisos, `> **Tip:** …`, `> **Nota:** …`, `> **Importante:** …` u `> **Ojo:** …`).
2. Si cambió una pantalla, reemplaza su captura en `capturas/` con el mismo nombre (escritorio, 1366 px de ancho).
3. Regenera los Word: `npm i --no-save docx` y `node .agents/modulos/proyectos/manuales/generar_word.js`.

Las capturas se tomaron con datos de demostración (empresas y personas inventadas). Los manuales describen el módulo tal como quedó al cerrar la fase 9 (11 de noviembre de 2026).
