'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// ---- Temas visuales / skins ----
// Cada skin define su propia paleta (índices 1–7) y su variante de dibujo de
// bloque. La paleta activa vive en `COLORS`, que se reasigna al cambiar de tema;
// el tablero y las piezas guardan índices de color, nunca colores literales.
const SKINS = {
  retro: {
    label: 'Retro',
    colors: [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - yellow
      '#ba68c8', // T - purple
      '#81c784', // S - green
      '#e57373', // Z - red
      '#5b9bd5', // J - azul pálido
      '#ffb74d', // L - orange
    ],
    // Bloque cuadrado con highlight superior (estilo original).
    drawBlock(context, x, y, color, size, alpha) {
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
  },

  neon: {
    label: 'Neon',
    colors: [
      null,
      '#18ffff', // I
      '#ffea00', // O
      '#e040fb', // T
      '#69f0ae', // S
      '#ff5252', // Z
      '#536dfe', // J
      '#ffab40', // L
    ],
    // Bloque con glow: shadowBlur del mismo color. Se resetea siempre al final.
    drawBlock(context, x, y, color, size, alpha) {
      context.globalAlpha = alpha ?? 1;
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.fillStyle = color;
      context.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
      context.shadowBlur = 0;
      context.globalAlpha = 1;
    },
  },

  pastel: {
    label: 'Pastel',
    colors: [
      null,
      '#a5d8e6', // I
      '#fbe6a2', // O
      '#d8b4e2', // T
      '#b8e0c2', // S
      '#f4b6b6', // Z
      '#b3bce0', // J
      '#f5cba7', // L
    ],
    // Bloque con esquinas redondeadas (bordes suaves).
    drawBlock(context, x, y, color, size, alpha) {
      context.globalAlpha = alpha ?? 1;
      const px = x * size + 1;
      const py = y * size + 1;
      const s = size - 2;
      const radius = Math.max(2, Math.floor(size * 0.22));
      roundRectPath(context, px, py, s, s, radius);
      context.fillStyle = color;
      context.fill();
      context.globalAlpha = 1;
    },
  },

  pixel: {
    label: 'Pixel art',
    colors: [
      null,
      '#3ec0d6', // I
      '#e6bf3c', // O
      '#a85bc0', // T
      '#5fb872', // S
      '#d65a5a', // Z
      '#5f6bc0', // J
      '#e09a3c', // L
    ],
    // Bloque con textura: rejilla 4×4 de subceldas con tinte claro/oscuro y borde.
    drawBlock(context, x, y, color, size, alpha) {
      context.globalAlpha = alpha ?? 1;
      const px = x * size + 1;
      const py = y * size + 1;
      const s = size - 2;
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      const step = s / 4;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          context.fillStyle = (i + j) % 2 === 0
            ? 'rgba(255,255,255,0.10)'
            : 'rgba(0,0,0,0.12)';
          context.fillRect(px + i * step, py + j * step, step, step);
        }
      }
      context.strokeStyle = 'rgba(0,0,0,0.35)';
      context.lineWidth = 1;
      context.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
      context.globalAlpha = 1;
    },
  },
};

// Dibuja un rectángulo redondeado como path (con fallback si falta roundRect).
function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, w, h, r);
    return;
  }
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKIN_STORAGE_KEY = 'tetris-skin';
let currentSkin = 'retro';
// Paleta activa. Conserva el nombre histórico COLORS usado por el render.
let COLORS = SKINS[currentSkin].colors;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// ---- Tabla de records (localStorage) ----
const HIGHSCORES_KEY = 'tetris-highscores';
const MAX_SCORES = 5;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const skinSelect = document.getElementById('skin-select');

// Elementos de la tabla de records (start screen + game over).
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const startScoresEl = document.getElementById('start-scores');
const overlayScoresEl = document.getElementById('overlay-scores');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const resetScoresBtn = document.getElementById('reset-scores-btn');

// Elementos del menú de pausa.
const pauseMenu = document.getElementById('pause-menu');
const menuMain = document.getElementById('menu-main');
const menuControls = document.getElementById('menu-controls');
const resumeBtn = document.getElementById('resume-btn');
const menuRestartBtn = document.getElementById('menu-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsBackBtn = document.getElementById('controls-back-btn');
const startLevelSelect = document.getElementById('start-level');

// Nivel con el que arrancará la PRÓXIMA partida (elegido en el menú de pausa).
let startLevel = 1;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
// Mejor combo (máximo de líneas eliminadas en un solo lock) de la partida en curso.
let maxCombo;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

// 7-bag randomizer (Tetris Guideline): cada tanda de 7 contiene las 7 piezas
// barajadas, evitando sequías y repeticiones largas del random puro.
let bag = [];

function refillBag() {
  bag = [1, 2, 3, 4, 5, 6, 7];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
}

function randomPiece() {
  if (bag.length === 0) refillBag();
  const type = bag.pop();
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    if (cleared > maxCombo) maxCombo = cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    // El nivel nunca baja del nivel inicial elegido en el menú.
    level = Math.max(startLevel, Math.floor(lines / 10) + 1);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  // Delega el estilo del bloque a la variante de dibujo del skin activo.
  SKINS[currentSkin].drawBlock(context, x, y, color, size, alpha);
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

// ---- Persistencia de records ----

// Mejor puntuación histórica (registro simple en localStorage, 'tetris-best').
function bestScore() {
  return parseInt(localStorage.getItem('tetris-best') || '0', 10);
}

// Lee la tabla de records desde localStorage. Tolera ausencia o JSON corrupto.
function loadHighscores() {
  try {
    const raw = localStorage.getItem(HIGHSCORES_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(e => e && typeof e === 'object')
      .map(e => ({
        name: typeof e.name === 'string' ? e.name : '---',
        score: Number(e.score) || 0,
        lines: Number(e.lines) || 0,
        combo: Number(e.combo) || 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SCORES);
  } catch (err) {
    return [];
  }
}

function saveHighscores(list) {
  try {
    localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(list));
  } catch (err) {
    // localStorage no disponible (modo privado, cuota, etc.): se ignora.
  }
}

// ¿La puntuación entra en el top? (true también si la tabla aún no está llena).
function qualifiesForTop(value) {
  if (value <= 0) return false;
  const list = loadHighscores();
  if (list.length < MAX_SCORES) return true;
  return value > list[list.length - 1].score;
}

// Inserta un record y devuelve la tabla recortada al top.
function addHighscore(entry) {
  const list = loadHighscores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, MAX_SCORES);
  saveHighscores(top);
  return top;
}

// Renderiza la tabla de records dentro de un contenedor.
// highlightIndex (opcional) resalta la fila recién añadida.
function renderScores(container, list, highlightIndex) {
  if (!container) return;
  container.innerHTML = '';
  if (!list.length) {
    const empty = document.createElement('p');
    empty.className = 'scores-empty';
    empty.textContent = 'Sin records todavía';
    container.appendChild(empty);
    return;
  }
  const table = document.createElement('table');
  table.className = 'scores-table';
  const header = document.createElement('tr');
  header.innerHTML = '<th>#</th><th>Nombre</th><th>Puntos</th><th>Líneas</th><th>Combo</th>';
  table.appendChild(header);
  list.forEach((e, i) => {
    const tr = document.createElement('tr');
    if (i === highlightIndex) tr.className = 'highlight';
    const rank = document.createElement('td');
    rank.textContent = i + 1;
    const name = document.createElement('td');
    name.textContent = e.name;
    const sc = document.createElement('td');
    sc.textContent = e.score.toLocaleString();
    const ln = document.createElement('td');
    ln.textContent = e.lines;
    const cb = document.createElement('td');
    cb.textContent = e.combo;
    tr.append(rank, name, sc, ln, cb);
    table.appendChild(tr);
  });
  container.appendChild(table);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  const prevBest = bestScore();
  const isRecord = score > prevBest;
  if (isRecord) localStorage.setItem('tetris-best', String(score));
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = isRecord
    ? `¡Nuevo récord! ${score.toLocaleString()}`
    : `Puntuación: ${score.toLocaleString()} · Récord: ${prevBest.toLocaleString()}`;

  // Snapshot de la partida que se acaba de terminar.
  const finalScore = score;
  const finalLines = lines;
  const finalCombo = maxCombo;

  if (qualifiesForTop(finalScore)) {
    // Entra en el top: pedimos el nombre antes de registrar.
    renderScores(overlayScoresEl, loadHighscores());
    nameForm.classList.remove('hidden');
    nameInput.value = '';

    // Guarda contra reenvíos: solo se registra el record una vez por partida.
    let saved = false;
    const submit = (ev) => {
      ev.preventDefault();
      if (saved) return;
      saved = true;
      const name = (nameInput.value.trim() || 'Anónimo').slice(0, 12);
      const top = addHighscore({ name, score: finalScore, lines: finalLines, combo: finalCombo });
      const idx = top.findIndex(
        e => e.name === name && e.score === finalScore && e.lines === finalLines && e.combo === finalCombo
      );
      nameForm.onsubmit = null;
      nameForm.classList.add('hidden');
      renderScores(overlayScoresEl, top, idx);
    };
    nameForm.onsubmit = submit;
  } else {
    nameForm.classList.add('hidden');
    renderScores(overlayScoresEl, loadHighscores());
  }

  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseMenu.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showMenuView('main');
    pauseMenu.classList.remove('hidden');
  }
}

// Alterna entre la vista principal del menú y la lista de controles.
function showMenuView(view) {
  if (view === 'controls') {
    menuMain.classList.add('hidden');
    menuControls.classList.remove('hidden');
  } else {
    menuControls.classList.add('hidden');
    menuMain.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (!gameOver && !paused) animId = requestAnimationFrame(loop);
}

// Aplica un skin en caliente: reasigna la paleta activa y re-renderiza.
// No depende de recargar la página; el render siguiente usa el nuevo estilo.
function applySkin(name) {
  if (!SKINS[name]) name = 'retro';
  currentSkin = name;
  COLORS = SKINS[name].colors;
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, name);
  } catch (_) {
    // localStorage puede no estar disponible (modo privado); se ignora.
  }
  // Limpiar sombras heredadas y volver a pintar tablero y preview.
  ctx.shadowBlur = 0;
  nextCtx.shadowBlur = 0;
  if (board) draw();
  if (next) drawNext();
}

// Llena el <select> con los skins disponibles y restaura la preferencia guardada.
function initSkin() {
  if (skinSelect) {
    skinSelect.innerHTML = '';
    for (const [name, skin] of Object.entries(SKINS)) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = skin.label;
      skinSelect.appendChild(opt);
    }
  }
  let saved = 'retro';
  try {
    const stored = localStorage.getItem(SKIN_STORAGE_KEY);
    if (stored && SKINS[stored]) saved = stored;
  } catch (_) {
    // Sin acceso a localStorage: se usa el skin por defecto.
  }
  if (skinSelect) skinSelect.value = saved;
  applySkin(saved);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  bag = [];
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  nameForm.classList.add('hidden');
  if (overlayScoresEl) overlayScoresEl.innerHTML = '';
  pauseMenu.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  // Mientras el juego está en pausa o terminado se ignoran los controles de juego.
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

// ---- Menú de pausa ----

// Rellena el selector de nivel inicial (1–15).
for (let lvl = 1; lvl <= 15; lvl++) {
  const opt = document.createElement('option');
  opt.value = lvl;
  opt.textContent = lvl;
  startLevelSelect.appendChild(opt);
}
startLevelSelect.value = startLevel;

startLevelSelect.addEventListener('change', () => {
  startLevel = Number(startLevelSelect.value);
});

resumeBtn.addEventListener('click', togglePause);
controlsBtn.addEventListener('click', () => showMenuView('controls'));
controlsBackBtn.addEventListener('click', () => showMenuView('main'));
menuRestartBtn.addEventListener('click', init);

// ---- Selector de skin ----
if (skinSelect) {
  skinSelect.addEventListener('change', e => applySkin(e.target.value));
}
initSkin();

// ---- Pantalla de inicio y reseteo de records ----

// Comienza la partida ocultando la pantalla de inicio.
function startGame() {
  if (startScreen) startScreen.classList.add('hidden');
  init();
}

if (startBtn) startBtn.addEventListener('click', startGame);

if (resetScoresBtn) {
  resetScoresBtn.addEventListener('click', () => {
    saveHighscores([]);
    renderScores(startScoresEl, []);
  });
}

// ---- Toggle de tema claro/oscuro de la página ----
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light');
    themeToggle.textContent = isLight ? 'Modo oscuro' : 'Modo claro';
  });
}

// Pinta la tabla en la pantalla de inicio y espera a que el jugador la inicie.
renderScores(startScoresEl, loadHighscores());
