'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// ---- Skins / temas visuales ----
// Cada skin define su paleta (índice 0 = null), color de fondo del canvas,
// color de la rejilla y un `style` que `drawBlock` usa para variar el render.
const SKINS = {
  retro: {
    label: 'Retro',
    bg: '#1a1a25',
    grid: '#22222e',
    style: 'flat',
    colors: [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - yellow
      '#ba68c8', // T - purple
      '#81c784', // S - green
      '#e57373', // Z - red
      '#7986cb', // J - indigo
      '#ffb74d', // L - orange
    ],
  },
  neon: {
    label: 'Neon',
    bg: '#000000',
    grid: '#0d0d18',
    style: 'glow',
    colors: [
      null,
      '#18ffff', // I
      '#ffff00', // O
      '#e040fb', // T
      '#00e676', // S
      '#ff1744', // Z
      '#2979ff', // J
      '#ff9100', // L
    ],
  },
  pastel: {
    label: 'Pastel',
    bg: '#2b2733',
    grid: '#3a3545',
    style: 'rounded',
    colors: [
      null,
      '#a0e7e5', // I
      '#fbe7a1', // O
      '#d3b5e5', // T
      '#b5ead7', // S
      '#ffb7b2', // Z
      '#b5c7f5', // J
      '#ffdac1', // L
    ],
  },
  pixel: {
    label: 'Pixel art',
    bg: '#14140f',
    grid: '#26261c',
    style: 'pixel',
    colors: [
      null,
      '#3aa6b9', // I
      '#d9b310', // O
      '#9b59b6', // T
      '#4caf50', // S
      '#c0392b', // Z
      '#3f51b5', // J
      '#e67e22', // L
    ],
  },
};

const SKIN_KEY = 'tetris-skin';
let currentSkin =
  SKINS[localStorage.getItem(SKIN_KEY)] ? localStorage.getItem(SKIN_KEY) : 'retro';

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
const nameEntry = document.getElementById('name-entry');
const nameInput = document.getElementById('name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const recordsView = document.getElementById('records-view');
const resetRecordsBtn = document.getElementById('reset-records-btn');

const pauseMenu = document.getElementById('pause-menu');
const menuMain = document.getElementById('menu-main');
const menuControls = document.getElementById('menu-controls');
const resumeBtn = document.getElementById('resume-btn');
const menuRestartBtn = document.getElementById('menu-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsBackBtn = document.getElementById('controls-back-btn');
const levelMinusBtn = document.getElementById('level-minus');
const levelPlusBtn = document.getElementById('level-plus');
const startLevelValue = document.getElementById('start-level-value');

const MAX_START_LEVEL = 20;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, bestCombo, running;

// Nivel inicial elegido en el menú de pausa (botones +/-).
let startLevel = 1;

// ---- Records (localStorage) ----
const RECORDS_KEY = 'tetris-records';
const MAX_RECORDS = 5;

function loadRecords() {
  try {
    const r = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (r && Array.isArray(r.scores)) {
      return { scores: r.scores, bestCombo: r.bestCombo || 0, maxLines: r.maxLines || 0 };
    }
  } catch { /* corrupto o ausente */ }
  return { scores: [], bestCombo: 0, maxLines: 0 };
}

function saveRecords(r) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(r));
}

function qualifies(sc) {
  if (sc <= 0) return false;
  const r = loadRecords();
  return r.scores.length < MAX_RECORDS || sc > r.scores[r.scores.length - 1].score;
}

// Inserta puntuación, devuelve índice en el top (0–4) o -1 si no entró.
function addScore(name, sc) {
  const r = loadRecords();
  const entry = { name: name || 'ANON', score: sc };
  r.scores.push(entry);
  r.scores.sort((a, b) => b.score - a.score);
  const idx = r.scores.indexOf(entry);
  r.scores = r.scores.slice(0, MAX_RECORDS);
  saveRecords(r);
  return idx < MAX_RECORDS ? idx : -1;
}

// Actualiza mejor combo y líneas máximas de la partida terminada.
function commitStats() {
  const r = loadRecords();
  if (bestCombo > r.bestCombo) r.bestCombo = bestCombo;
  if (lines > r.maxLines) r.maxLines = lines;
  saveRecords(r);
}

function renderRecords(highlightIdx) {
  const r = loadRecords();
  let rows = '';
  for (let i = 0; i < MAX_RECORDS; i++) {
    const e = r.scores[i];
    const hl = i === highlightIdx ? ' class="hl"' : '';
    if (e) {
      rows += `<tr${hl}><td class="rank">${i + 1}</td><td class="name">${escapeHtml(e.name)}</td><td class="pts">${e.score.toLocaleString()}</td></tr>`;
    } else {
      rows += `<tr><td class="rank">${i + 1}</td><td class="empty">—</td><td class="empty">—</td></tr>`;
    }
  }
  return `
    <table class="records">
      <thead><tr><th>#</th><th>Nombre</th><th>Score</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="records-stats">
      <span>Mejor combo <b>${r.bestCombo}</b></span>
      <span>Líneas máx <b>${r.maxLines}</b></span>
    </div>`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
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
    combo++;
    if (combo > bestCombo) bestCombo = combo;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  } else {
    combo = 0;
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
  const skin = SKINS[currentSkin];
  const color = skin.colors[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;
  context.globalAlpha = alpha ?? 1;

  if (skin.style === 'glow') {
    // Neon: relleno pleno + halo con shadowBlur del propio color.
    context.shadowColor = color;
    context.shadowBlur = (alpha ?? 1) < 1 ? 4 : 12;
    context.fillStyle = color;
    context.fillRect(px, py, s, s);
    context.shadowBlur = 0;
  } else if (skin.style === 'rounded') {
    // Pastel: esquinas redondeadas simuladas con roundRect.
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(px, py, s, s, Math.max(3, size * 0.22));
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.25)';
    context.beginPath();
    context.roundRect(px, py, s, 4, 2);
    context.fill();
  } else if (skin.style === 'pixel') {
    // Pixel art: base + textura de pixeles más claros/oscuros.
    context.fillStyle = color;
    context.fillRect(px, py, s, s);
    const u = s / 4;
    context.fillStyle = 'rgba(255,255,255,0.18)';
    context.fillRect(px, py, u, u);
    context.fillRect(px + 2 * u, py + u, u, u);
    context.fillStyle = 'rgba(0,0,0,0.28)';
    context.fillRect(px + 3 * u, py + 2 * u, u, u);
    context.fillRect(px + u, py + 3 * u, u, u);
  } else {
    // Retro (flat): relleno + highlight superior.
    context.fillStyle = color;
    context.fillRect(px, py, s, s);
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(px, py, s, 4);
  }

  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = SKINS[currentSkin].grid;
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

function endGame() {
  gameOver = true;
  running = false;
  cancelAnimationFrame(animId);
  commitStats();
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  restartBtn.textContent = 'Reiniciar';
  resetRecordsBtn.classList.remove('hidden');
  if (qualifies(score)) {
    nameEntry.classList.remove('hidden');
    nameInput.value = '';
    recordsView.innerHTML = renderRecords();
    overlay.classList.remove('hidden');
    nameInput.focus();
  } else {
    nameEntry.classList.add('hidden');
    recordsView.innerHTML = renderRecords();
    overlay.classList.remove('hidden');
  }
}

function showStart() {
  running = false;
  gameOver = false;
  paused = false;
  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = 'Pulsa Jugar para empezar';
  nameEntry.classList.add('hidden');
  recordsView.innerHTML = renderRecords();
  restartBtn.textContent = 'Jugar';
  resetRecordsBtn.classList.remove('hidden');
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver || !running) return;
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

function showMenuView(view) {
  menuMain.classList.toggle('hidden', view !== 'main');
  menuControls.classList.toggle('hidden', view !== 'controls');
}

function setStartLevel(value) {
  startLevel = Math.min(MAX_START_LEVEL, Math.max(1, value));
  startLevelValue.textContent = startLevel;
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
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  running = true;
  combo = 0;
  bestCombo = 0;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  nameEntry.classList.add('hidden');
  resetRecordsBtn.classList.add('hidden');
  recordsView.innerHTML = '';
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (!running) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
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
resumeBtn.addEventListener('click', togglePause);
menuRestartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', () => showMenuView('controls'));
controlsBackBtn.addEventListener('click', () => showMenuView('main'));
levelMinusBtn.addEventListener('click', () => setStartLevel(startLevel - 1));
levelPlusBtn.addEventListener('click', () => setStartLevel(startLevel + 1));
setStartLevel(startLevel);

// ---- Skins ----
function applySkin(name) {
  if (!SKINS[name]) name = 'retro';
  currentSkin = name;
  const skin = SKINS[name];
  canvas.style.background = skin.bg;
  nextCanvas.style.background = skin.bg;
  localStorage.setItem(SKIN_KEY, name);
  // Redibuja con la nueva paleta aunque el juego esté pausado o terminado.
  if (current) draw();
  if (next) drawNext();
}

function initSkinSelector() {
  for (const [name, skin] of Object.entries(SKINS)) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = skin.label;
    skinSelect.appendChild(opt);
  }
  skinSelect.value = currentSkin;
  skinSelect.addEventListener('change', () => {
    applySkin(skinSelect.value);
    skinSelect.blur();
  });
}

initSkinSelector();
applySkin(currentSkin);

// ---- Records ----
function saveCurrentScore() {
  const idx = addScore(nameInput.value.trim(), score);
  nameEntry.classList.add('hidden');
  recordsView.innerHTML = renderRecords(idx);
}

saveScoreBtn.addEventListener('click', saveCurrentScore);

nameInput.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.code === 'Enter') saveCurrentScore();
});

resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los récords?')) return;
  localStorage.removeItem(RECORDS_KEY);
  nameEntry.classList.add('hidden');
  recordsView.innerHTML = renderRecords();
});

showStart();
