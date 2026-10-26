# SPEC 01 — MVP jugable de Arkanoid

> **Estado:** Borrador
> **Depende de:** ninguna
> **Fecha:** 2026-10-21
> **Objetivo:** Un Arkanoid de un solo nivel, jugable en el navegador con ratón y teclado, con vidas, puntuación, sonidos y pantallas de inicio, pausa, derrota y victoria.

---

## Alcance

**Dentro:**

- Reorganizar los assets: mover `assets/assets/*` a `assets/` y eliminar `assets/__MACOSX/` y los `.DS_Store`. Así la ruta `assets/spritesheet-breakout.png` de `spritesheet.js` funciona sin tocarlo.
- Archivos del juego en la raíz: `index.html`, `style.css`, `game.js`.
- Canvas de resolución lógica fija 480×640, escalado por CSS manteniendo la proporción y con píxeles nítidos.
- Un único nivel: 6 filas × 15 columnas de bloques (bloque 32×16, sin huecos).
- Pala, bola y bloques dibujados con `drawSprite` de `spritesheet.js`.
- Bola con ángulo de salida según el punto de impacto en la pala y velocidad constante.
- Bloques de colores (1 golpe) y bloques grises (2 golpes).
- Animación de explosión al romper un bloque, con `EXPLOSION_FRAMES` y `EXPLOSION_DURATION`.
- Sonidos: `ball-bounce.mp3` en rebotes y `break-sound.mp3` al romper un bloque.
- 3 vidas, puntuación y vidas visibles en un HUD dibujado en el canvas.
- Controles: ratón o teclado (←/→ y A/D) para mover la pala; clic o Espacio para lanzar la bola; P o Esc para pausar.
- Flujo de pantallas dentro del canvas: inicio → juego → pausa / derrota / victoria, con reinicio por clic o Enter.

**Fuera de alcance (para specs futuras):**

- Varios niveles o editor de niveles.
- Power-ups, láseres, bola múltiple y pala que cambia de tamaño.
- Récord (high score) y cualquier persistencia en `localStorage`.
- Aceleración progresiva de la bola.
- Controles táctiles y versión móvil.
- Menú de opciones, volumen o silenciar.
- Tests automatizados, bundler o cualquier dependencia.

## Modelo de datos

```js
// Estado global del juego (game.js)
const state = {
  screen: 'title',        // 'title' | 'ready' | 'playing' | 'paused' | 'gameover' | 'won'
  score: 0,
  lives: 3,
  paddle: { x: 0, y: 600, w: 96, h: 12, speed: 6 },
  ball:   { x: 0, y: 0, r: 6, vx: 0, vy: 0, speed: 5 },
  blocks: [],             // { x, y, w: 32, h: 16, color, hp, alive }
  explosions: [],         // { x, y, color, start }  (start = timestamp en ms)
};
```

Convenciones:

- Coordenadas lógicas con origen arriba a la izquierda; el canvas mide 480×640.
- Velocidades en píxeles por frame, con el bucle en `requestAnimationFrame`.
- `screen: 'ready'` = bola pegada a la pala esperando el lanzamiento (inicio de partida y tras perder una vida).
- Bloques de color: `hp: 1`, 10 puntos. Bloque gris: `hp: 2`, 30 puntos al romperse.
- Distribución del nivel, de arriba abajo: `gray`, `red`, `yellow`, `cyan`, `magenta`, `green`.
- Ángulo de salida de la pala: proporcional a la distancia al centro de la pala, con un máximo de ±60° respecto a la vertical.
- Los valores numéricos (tamaños, velocidades, puntos) son valores iniciales y se pueden ajustar al probar el juego sin cambiar la spec.
- Los sprites y su carga vienen de `assets/spritesheet.js` (globales `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`, `loadSpritesheet`, `drawSprite`, `drawFrame`), que no se modifica.

## Plan de implementación

1. Mover `assets/assets/*` a `assets/` y borrar `assets/__MACOSX/` y los `.DS_Store`. Verificación: existen `assets/spritesheet.js`, `assets/spritesheet-breakout.png` y `assets/sounds/*.mp3`.
2. Crear `index.html`, `style.css` y `game.js` con el canvas 480×640 centrado y escalado por CSS (`image-rendering: pixelated`). Cargar `assets/spritesheet.js` y llamar a `loadSpritesheet`. Verificación: abrir `index.html` y ver el canvas sin errores en consola.
3. Bucle de juego y pantalla `title`: dibujar fondo y texto "Pulsa para empezar". Verificación: el texto se ve; clic o Enter pasa a `ready`.
4. Pala: dibujarla con `drawSprite` y moverla con ratón y con ←/→ / A/D, limitada a los bordes. Verificación: la pala sigue al ratón y al teclado sin salirse.
5. Bola: en `ready` va pegada a la pala; clic o Espacio la lanza hacia arriba; rebota en paredes y techo. Verificación: rebota en tres bordes y no sale del canvas por ellos.
6. Colisión bola–pala con ángulo según el punto de impacto y velocidad constante. Verificación: golpear en el centro sale casi vertical; en los extremos, muy inclinada; el módulo de la velocidad no cambia.
7. Bloques: generar el nivel y dibujarlo; colisión bola–bloque con rebote según el lado golpeado; los de color se rompen al primer golpe y los grises al segundo. Verificación: los 90 bloques se ven y se rompen según su `hp`.
8. Puntuación, vidas y HUD: sumar puntos, perder una vida si la bola cae por abajo y volver a `ready`. Verificación: el HUD muestra puntos y vidas; al perder la bola las vidas bajan.
9. Fin de partida: con 0 vidas pasar a `gameover`; sin bloques vivos pasar a `won`; Enter o clic reinicia. Verificación: se alcanzan ambas pantallas y se reinicia con estado limpio.
10. Pausa con P o Esc, que congela el juego y lo reanuda con la misma tecla. Verificación: durante la pausa nada se mueve.
11. Sonidos: reproducir `ball-bounce.mp3` en rebotes (paredes, techo, pala, bloque no roto) y `break-sound.mp3` al romper un bloque. Verificación: se oye cada sonido en su caso y no hay errores de autoplay (el audio solo se dispara tras la primera interacción del usuario).
12. Animación de explosión: al romper un bloque, mostrar sus 4 frames de `EXPLOSION_FRAMES[color]` durante `EXPLOSION_DURATION` ms en su posición. Verificación: se ve la explosión y desaparece sola.

## Criterios de aceptación

- [ ] Abrir `index.html` con doble clic (`file://`) carga el juego sin errores en la consola.
- [ ] No hay carpetas `__MACOSX` ni archivos `.DS_Store` bajo `assets/`.
- [ ] El proyecto no usa npm, bundler ni librerías externas.
- [ ] El canvas se escala al tamaño de la ventana manteniendo la proporción 3:4 y los sprites no se ven borrosos.
- [ ] La pantalla de inicio muestra "Pulsa para empezar" y un clic o Enter empieza la partida.
- [ ] La pala se mueve con el ratón y con ←/→ y A/D, y nunca sale del canvas.
- [ ] La bola empieza pegada a la pala y solo se lanza con clic o Espacio.
- [ ] La bola rebota en pared izquierda, derecha y techo.
- [ ] El ángulo de salida de la bola depende del punto de impacto en la pala, y su velocidad es constante durante toda la partida.
- [ ] Hay 90 bloques al empezar: 15 grises en la fila superior y 5 filas de color debajo.
- [ ] Un bloque de color se rompe con un golpe y suma 10 puntos.
- [ ] Un bloque gris necesita 2 golpes y suma 30 puntos al romperse.
- [ ] Al romper un bloque se reproduce su animación de explosión (4 frames, 150 ms) y después desaparece.
- [ ] `break-sound.mp3` suena al romper un bloque y `ball-bounce.mp3` suena en los demás rebotes.
- [ ] El HUD muestra la puntuación y las vidas restantes.
- [ ] Perder la bola resta una vida y devuelve la bola a la pala; con 0 vidas aparece "Game Over".
- [ ] Romper todos los bloques muestra la pantalla de victoria.
- [ ] En Game Over y en victoria, Enter o clic reinician la partida con 3 vidas, puntuación 0 y los 90 bloques.
- [ ] P o Esc pausan y reanudan el juego; durante la pausa la bola, la pala y las explosiones no se mueven.
- [ ] No se guarda nada en `localStorage` ni en ningún otro almacenamiento.

## Decisiones

- **Sí:** mover los assets a `assets/` en la raíz. La ruta relativa de `spritesheet.js` funciona sin modificar el archivo y se elimina la carpeta anidada por el zip.
- **No:** dejar el juego dentro de la carpeta de assets o duplicar los assets en `public/`. Estructura confusa o mantenimiento doble.
- **Sí:** resolución lógica fija 480×640 con escalado CSS. La lógica de colisiones no depende del tamaño de ventana, y 480 = 15 bloques de 32 px.
- **No:** canvas de tamaño fijo sin escalar. Se vería diminuto o cortado según la pantalla.
- **Sí:** ángulo de rebote según el punto de impacto y velocidad constante. Da control al jugador y es la mecánica clásica del Arkanoid.
- **No:** aceleración progresiva de la bola. Añade ajuste de dificultad y riesgo; va a otra spec.
- **No:** rebote especular simple en la pala. El jugador no podría dirigir la bola y el juego sería poco jugable.
- **Sí:** 3 vidas con derrota y victoria. Es lo mínimo para que sea un juego completo con principio y fin.
- **Sí:** un único nivel fijo. Los niveles múltiples y el editor van a otra spec.
- **Sí:** ratón y teclado a la vez. Cubre ambas preferencias sin coste relevante.
- **Sí:** todas las pantallas dibujadas en el canvas. Evita HTML/CSS extra y mantiene un único punto de render.
- **Sí:** bloques grises con 2 golpes. Aporta variedad con un cambio mínimo (`hp`).
- **Sí:** el audio solo se reproduce tras la primera interacción del usuario. Los navegadores bloquean el autoplay y el juego ya exige un clic o tecla para empezar.
- **Sí:** sin persistencia en esta spec. El récord es un tema aparte.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| La bola atraviesa bloques o pala a velocidad alta (tunneling) | Velocidad moderada (5 px/frame con bloques de 16 px de alto) y comprobar la colisión por pasos si hiciera falta. |
| Bola atascada rebotando en horizontal | Forzar un mínimo de componente vertical (`vy`) tras cada rebote en pared. |
| La velocidad del juego depende de la tasa de refresco del monitor | Bucle con `requestAnimationFrame` y movimiento por tiempo (delta time) o limitado a 60 fps. Se decide en el paso 3 y se aplica a todo el movimiento. |
| Doble sonido o corte de audio al romper y rebotar a la vez | Usar un clon de `Audio` por reproducción o reiniciar `currentTime`. |
| La carga de la imagen falla (el sprite no aparece) | `spritesheet.js` ya registra el error; el juego no arranca hasta que `loadSpritesheet` llama a su callback. |

## Lo que **no** está en esta spec

- Niveles múltiples y editor de niveles.
- Power-ups y bonus.
- Récord y persistencia.
- Aceleración de la bola.
- Controles táctiles y versión móvil.
- Opciones de audio (volumen, silenciar).
- Tests automatizados o herramientas de build.

Cada una de estas cosas, si se aborda, irá en su propia spec.
