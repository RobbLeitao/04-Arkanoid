const WIDTH = 480;
const HEIGHT = 640;

const canvas = document.getElementById( 'game' );
const ctx = canvas.getContext( '2d' );
ctx.imageSmoothingEnabled = false;

const state = {
  screen: 'title',        // 'title' | 'ready' | 'playing' | 'paused' | 'gameover' | 'won'
  score: 0,
  lives: 3,
  paddle: { x: 0, y: 600, w: 96, h: 12, speed: 6 },
  ball:   { x: 0, y: 0, r: 6, vx: 0, vy: 0, speed: 5 },
  blocks: [],             // { x, y, w: 32, h: 16, color, hp, alive }
  explosions: [],         // { x, y, color, start }  (start = timestamp en ms)
};

// Las velocidades están en px por frame a 60 fps; dt escala el movimiento
// para que no dependa de la tasa de refresco del monitor
const FRAME_MS = 1000 / 60;
const MAX_DT = 3;
let lastTime = 0;

const MAX_BOUNCE_ANGLE = 60 * Math.PI / 180;  // máximo respecto a la vertical
const MIN_VERTICAL = 0.2;                     // |vy| mínimo como fracción de la velocidad

const HEART_SIZE = 20;

const SCORE_COLOR = 10;
const SCORE_GRAY = 30;

const BLOCK_W = 32;
const BLOCK_H = 16;
const BLOCK_COLS = 15;
const BLOCKS_TOP = 48;  // deja sitio para el HUD
const LEVEL_ROWS = [ 'gray', 'red', 'yellow', 'cyan', 'magenta', 'green' ];  // de arriba abajo

// Web Audio: los sonidos se decodifican una vez y se lanzan al instante, sin la latencia de <audio>
const SOUND_BUFFERS = {};
let audioCtx = null;

// Los navegadores bloquean el audio hasta la primera interacción del usuario
function unlockAudio() {
  if ( audioCtx ) {
    if ( audioCtx.state === 'suspended' ) audioCtx.resume();
    return;
  }
  audioCtx = new AudioContext();
  for ( const name in SOUND_DATA ) {
    const bytes = Uint8Array.from( atob( SOUND_DATA[ name ] ), c => c.charCodeAt( 0 ) );
    audioCtx.decodeAudioData( bytes.buffer ).then( buf => { SOUND_BUFFERS[ name ] = buf; } );
  }
}
window.addEventListener( 'mousedown', unlockAudio );
window.addEventListener( 'keydown', unlockAudio );

// Cada reproducción es un nodo nuevo, así que los sonidos pueden solaparse sin cortarse
function playSound( name ) {
  const buf = SOUND_BUFFERS[ name ];
  if ( !buf ) return;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect( audioCtx.destination );
  src.start();
}

// El juego no arranca hasta que el spritesheet está cargado
loadSpritesheet( start );

function start() {
  lastTime = performance.now();
  requestAnimationFrame( loop );
}

function loop( now ) {
  const dt = Math.min( ( now - lastTime ) / FRAME_MS, MAX_DT );
  lastTime = now;
  update( dt );
  draw();
  requestAnimationFrame( loop );
}

// Reloj del juego en ms: no avanza en pausa, para que las explosiones se congelen
let gameTime = 0;

function update( dt ) {
  if ( state.screen !== 'paused' ) {
    gameTime += dt * FRAME_MS;
    state.explosions = state.explosions.filter( ex => gameTime - ex.start < EXPLOSION_DURATION );
  }
  if ( state.screen === 'ready' || state.screen === 'playing' ) updatePaddle( dt );
  if ( state.screen === 'ready' ) stickBallToPaddle();
  if ( state.screen === 'playing' ) updateBall( dt );
}

function stickBallToPaddle() {
  const p = state.paddle;
  const b = state.ball;
  b.x = p.x + p.w / 2;
  b.y = p.y - b.r;
  b.vx = 0;
  b.vy = 0;
}

function launchBall() {
  const b = state.ball;
  b.vx = 0;
  b.vy = -b.speed;
  state.screen = 'playing';
}

function updateBall( dt ) {
  const b = state.ball;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  // Rebote en paredes laterales y techo
  if ( b.x - b.r < 0 ) {
    b.x = b.r;
    b.vx = Math.abs( b.vx );
    playSound( 'bounce' );
  } else if ( b.x + b.r > WIDTH ) {
    b.x = WIDTH - b.r;
    b.vx = -Math.abs( b.vx );
    playSound( 'bounce' );
  }
  if ( b.y - b.r < 0 ) {
    b.y = b.r;
    b.vy = Math.abs( b.vy );
    playSound( 'bounce' );
  }
  enforceMinVertical( b );

  collideBallPaddle();
  collideBallBlocks();

  // La bola cae por abajo: se pierde una vida y vuelve a la pala
  if ( b.y - b.r > HEIGHT ) {
    state.lives--;
    state.screen = state.lives > 0 ? 'ready' : 'gameover';
  }
}

function createBlocks() {
  const blocks = [];
  LEVEL_ROWS.forEach( ( color, row ) => {
    for ( let col = 0; col < BLOCK_COLS; col++ ) {
      blocks.push( {
        x: col * BLOCK_W,
        y: BLOCKS_TOP + row * BLOCK_H,
        w: BLOCK_W,
        h: BLOCK_H,
        color,
        hp: color === 'gray' ? 2 : 1,
        alive: true,
      } );
    }
  } );
  return blocks;
}

function collideBallBlocks() {
  const b = state.ball;
  for ( const block of state.blocks ) {
    if ( !block.alive ) continue;

    // Punto del bloque más cercano al centro de la bola
    const cx = Math.max( block.x, Math.min( b.x, block.x + block.w ) );
    const cy = Math.max( block.y, Math.min( b.y, block.y + block.h ) );
    const dx = b.x - cx;
    const dy = b.y - cy;
    if ( dx * dx + dy * dy >= b.r * b.r ) continue;

    // Lado golpeado: eje con mayor separación (o menor penetración si el centro está dentro)
    let horizontal;
    if ( dx === 0 && dy === 0 ) {
      const left = b.x - block.x;
      const right = block.x + block.w - b.x;
      const top = b.y - block.y;
      const bottom = block.y + block.h - b.y;
      horizontal = Math.min( left, right ) < Math.min( top, bottom );
      if ( horizontal ) b.x += left < right ? -( left + b.r ) : right + b.r;
      else b.y += top < bottom ? -( top + b.r ) : bottom + b.r;
    } else {
      horizontal = Math.abs( dx ) > Math.abs( dy );
      if ( horizontal ) b.x = cx + Math.sign( dx ) * b.r;
      else b.y = cy + Math.sign( dy ) * b.r;
    }

    if ( horizontal ) b.vx = Math.abs( b.vx ) * ( b.x < block.x + block.w / 2 ? -1 : 1 );
    else b.vy = Math.abs( b.vy ) * ( b.y < block.y + block.h / 2 ? -1 : 1 );
    enforceMinVertical( b );

    block.hp--;
    if ( block.hp <= 0 ) {
      block.alive = false;
      state.score += block.color === 'gray' ? SCORE_GRAY : SCORE_COLOR;
      state.explosions.push( { x: block.x, y: block.y, color: block.color, start: gameTime } );
      playSound( 'break' );
      if ( state.blocks.every( bl => !bl.alive ) ) state.screen = 'won';
    } else {
      playSound( 'bounce' );
    }
    break;  // un bloque por frame evita dobles rebotes
  }
}

// Evita que la bola quede rebotando casi en horizontal, manteniendo su velocidad
function enforceMinVertical( b ) {
  const minVy = b.speed * MIN_VERTICAL;
  if ( Math.abs( b.vy ) >= minVy ) return;
  b.vy = ( b.vy < 0 ? -1 : 1 ) * minVy;
  b.vx = ( b.vx < 0 ? -1 : 1 ) * Math.sqrt( b.speed * b.speed - b.vy * b.vy );
}

function collideBallPaddle() {
  const b = state.ball;
  const p = state.paddle;
  if ( b.vy <= 0 ) return;
  const hit = b.y + b.r >= p.y && b.y - b.r <= p.y + p.h &&
              b.x + b.r >= p.x && b.x - b.r <= p.x + p.w;
  if ( !hit ) return;

  // Ángulo proporcional a la distancia al centro de la pala, respecto a la vertical
  const offset = Math.max( -1, Math.min( 1, ( b.x - ( p.x + p.w / 2 ) ) / ( p.w / 2 ) ) );
  const angle = offset * MAX_BOUNCE_ANGLE;
  b.vx = b.speed * Math.sin( angle );
  b.vy = -b.speed * Math.cos( angle );
  b.y = p.y - b.r;
  playSound( 'bounce' );
}

function updatePaddle( dt ) {
  const p = state.paddle;
  if ( keys.left ) p.x -= p.speed * dt;
  if ( keys.right ) p.x += p.speed * dt;
  p.x = Math.max( 0, Math.min( WIDTH - p.w, p.x ) );
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect( 0, 0, WIDTH, HEIGHT );

  if ( state.screen === 'title' ) {
    drawTitle();
  } else {
    drawBlocks();
    drawExplosions();
    drawPaddle();
    drawBall();
    drawHud();
    if ( state.screen === 'paused' ) drawPause();
    if ( state.screen === 'gameover' ) drawEndScreen( 'Game Over' );
    if ( state.screen === 'won' ) drawEndScreen( '¡Victoria!' );
  }
}

function drawPause() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect( 0, 0, WIDTH, HEIGHT );
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 48px monospace';
  ctx.fillText( 'PAUSA', WIDTH / 2, HEIGHT / 2 - 20 );
  ctx.font = '20px monospace';
  ctx.fillText( 'Pulsa P o Esc para continuar', WIDTH / 2, HEIGHT / 2 + 30 );
}

function drawEndScreen( title ) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect( 0, 0, WIDTH, HEIGHT );
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 48px monospace';
  ctx.fillText( title, WIDTH / 2, HEIGHT / 2 - 40 );
  ctx.font = '20px monospace';
  ctx.fillText( 'Puntos: ' + state.score, WIDTH / 2, HEIGHT / 2 + 10 );
  ctx.fillText( 'Pulsa Enter o haz clic para reiniciar', WIDTH / 2, HEIGHT / 2 + 50 );
}

function drawHud() {
  ctx.fillStyle = '#fff';
  ctx.font = '20px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText( 'Puntos: ' + state.score, 12, 24 );
  // Un corazón por vida restante, alineados a la derecha
  for ( let i = 0; i < state.lives; i++ ) {
    drawHeart( WIDTH - 12 - HEART_SIZE - i * ( HEART_SIZE + 6 ), 24 - HEART_SIZE / 2, HEART_SIZE );
  }
}

function drawHeart( x, y, size ) {
  const s = size / 2;
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.moveTo( x + s, y + size );
  ctx.bezierCurveTo( x - size * 0.2, y + size * 0.55, x + size * 0.1, y - size * 0.1, x + s, y + size * 0.3 );
  ctx.bezierCurveTo( x + size * 0.9, y - size * 0.1, x + size * 1.2, y + size * 0.55, x + s, y + size );
  ctx.fill();
}

function drawBlocks() {
  for ( const block of state.blocks ) {
    if ( block.alive ) drawSprite( ctx, 'block_' + block.color, block.x, block.y, block.w, block.h );
  }
}

function drawBall() {
  const b = state.ball;
  drawSprite( ctx, 'ball', b.x - b.r, b.y - b.r, b.r * 2, b.r * 2 );
}

function drawExplosions() {
  for ( const ex of state.explosions ) {
    const frames = EXPLOSION_FRAMES[ ex.color ];
    const progress = ( gameTime - ex.start ) / EXPLOSION_DURATION;
    const i = Math.min( frames.length - 1, Math.floor( progress * frames.length ) );
    drawFrame( ctx, frames[ i ], ex.x, ex.y, BLOCK_W, BLOCK_H );
  }
}

function drawPaddle() {
  const p = state.paddle;
  drawSprite( ctx, 'paddle', p.x, p.y, p.w, p.h );
}

function drawTitle() {
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText( 'ARKANOID', WIDTH / 2, HEIGHT / 2 - 40 );
  ctx.font = '20px monospace';
  ctx.fillText( 'Pulsa para empezar', WIDTH / 2, HEIGHT / 2 + 20 );
}

function startGame() {
  state.screen = 'ready';
  state.score = 0;
  state.lives = 3;
  state.explosions = [];
  state.paddle.x = ( WIDTH - state.paddle.w ) / 2;
  state.blocks = createBlocks();
}

// Pantallas desde las que clic o Enter empiezan una partida nueva
function isRestartScreen() {
  return state.screen === 'title' || state.screen === 'gameover' || state.screen === 'won';
}

function togglePause() {
  if ( state.screen === 'playing' ) state.screen = 'paused';
  else if ( state.screen === 'paused' ) state.screen = 'playing';
}

const keys = { left: false, right: false };

canvas.addEventListener( 'mousedown', () => {
  if ( isRestartScreen() ) startGame();
  else if ( state.screen === 'ready' ) launchBall();
} );

// El ratón mueve la pala: se convierte la posición de pantalla a coordenadas lógicas
canvas.addEventListener( 'mousemove', e => {
  if ( state.screen !== 'ready' && state.screen !== 'playing' ) return;
  const rect = canvas.getBoundingClientRect();
  const x = ( e.clientX - rect.left ) * ( WIDTH / rect.width );
  const p = state.paddle;
  p.x = Math.max( 0, Math.min( WIDTH - p.w, x - p.w / 2 ) );
} );

window.addEventListener( 'keydown', e => {
  if ( e.key === 'Enter' && isRestartScreen() ) startGame();
  if ( ( e.key === 'p' || e.key === 'P' || e.key === 'Escape' ) && !e.repeat ) togglePause();
  if ( e.key === ' ' && state.screen === 'ready' ) {
    e.preventDefault();
    launchBall();
  }
  if ( e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' ) keys.left = true;
  if ( e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' ) keys.right = true;
} );

window.addEventListener( 'keyup', e => {
  if ( e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' ) keys.left = false;
  if ( e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' ) keys.right = false;
} );
