# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Tetris en JavaScript vanilla con HTML5 Canvas. Sin dependencias, sin `package.json`, sin build, sin tests ni linter. Tres archivos: `index.html` (DOM y dos canvas), `style.css` (tema dark/retro), `game.js` (toda la lógica, ~300 líneas).

## Ejecutar

Abrir `index.html` directamente en el navegador, o servir estático:

```bash
python3 -m http.server 8000   # luego http://localhost:8000
```

## Arquitectura de game.js

Todo el estado del juego vive en variables globales de módulo (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.), reinicializadas por `init()`.

- **Tablero**: matriz `ROWS × COLS` (20×10); cada celda es `0` (vacía) o índice 1–7 que mapea a `COLORS` y `PIECES`.
- **Piezas**: matrices cuadradas en `PIECES`; el valor de celda ES el índice de color. Rotación = transponer + invertir filas (`rotateCW`). `tryRotate` aplica wall kicks `[0, -1, 1, -2, 2]` en columnas.
- **Game loop**: `requestAnimationFrame` en `loop()`; acumula `dt` y baja la pieza cuando supera `dropInterval`. Pausa y game over cancelan el frame (`cancelAnimationFrame(animId)`).
- **Ciclo de pieza**: `lockPiece()` → `merge()` → `clearLines()` → `spawn()`. Si la pieza nueva colisiona al aparecer, `endGame()`.
- **Puntuación**: tabla `LINE_SCORES` × nivel; soft drop +1/fila, hard drop +2/celda. Nivel sube cada 10 líneas; velocidad = `max(100, 1000 − (level−1) × 90)` ms.
- **Render**: `draw()` pinta grid, tablero fijado, ghost piece (proyección con `ghostY()`, alpha 0.2) y pieza actual. `drawNext()` usa el segundo canvas.
- **Records**: persistidos en `localStorage` bajo `RECORDS_KEY` (`tetris-records`): `{ scores: [{name, score, lines}], bestCombo, maxLines }`. Top 5 (`MAX_SCORES`). `loadRecords`/`saveRecords`/`renderRecords` gestionan el estado; `combo`/`maxCombo` cuentan clears consecutivos en `clearLines`. Pantalla de inicio (`#start-overlay`) muestra records y espera el botón `JUGAR` (el juego ya no arranca solo). `endGame` guarda combo/líneas siempre y, si la puntuación entra al top, pide nombre (`#name-entry`) antes de persistirla.

## Restricción de dimensiones

Si cambias `COLS`, `ROWS` o `BLOCK` en `game.js`, ajusta también `width`/`height` del `<canvas id="board">` en `index.html` (deben ser `COLS × BLOCK` y `ROWS × BLOCK`).

## Idioma

README, comentarios y textos de UI están en español; mantener ese idioma.
