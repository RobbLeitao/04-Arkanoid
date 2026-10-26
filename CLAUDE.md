# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado del proyecto

Arkanoid en HTML, CSS y JavaScript puro, **cero dependencias** (sin npm, bundler ni framework). Todavía no hay código del juego: solo existen `README.md`, los assets y los skills de spec. No hay comandos de build, lint ni tests; el juego se ejecutará abriendo el HTML en el navegador. No es un repo git (aún).

## Flujo spec-driven

El trabajo se guía con dos skills del proyecto (`.claude/Skills/`, ambos con `disable-model-invocation`, solo se invocan a mano):

- `/spec <descripción>` — diseña una spec con preguntas previas y la guarda en `specs/NN-slug.md` (estado `Draft`, plantilla en `.claude/Skills/spec/template.md`). No escribe código.
- `/spec-impl <NN-slug>` — solo implementa specs en estado "Aprobado" (el cambio a Aprobado lo hace el humano). Crea la rama `spec-NN-slug`, implementa paso a paso con pausa para revisar diffs y **nunca hace commit solo**. La config está en `specs/.spec-config.yml` (`AutoCreateBranch`).

`/spec-impl` usa `git`, así que requiere inicializar el repo antes. Las respuestas y las specs se escriben en el idioma del prompt (español en este proyecto).

## Assets

Todo está en `assets/assets/` (la carpeta anidada es consecuencia de descomprimir el zip; `assets/__MACOSX/` es basura de macOS e ignorable):

- `spritesheet-breakout.png` — spritesheet único con todos los gráficos.
- `spritesheet.js` — define globales (sin módulos): `SPRITES` (recortes `{sx, sy, sw, sh}` para `paddle`, `ball`, `blocks[color]`) y `EXPLOSION_FRAMES` (4 frames por color de bloque) con `EXPLOSION_DURATION = 150` ms. Hay que cargarlo con `<script>` antes del código del juego; los colores de bloque son `red, cyan, green, magenta, yellow, hotpink, gray`.
- `sounds/ball-bounce.mp3`, `sounds/break-sound.mp3`.
