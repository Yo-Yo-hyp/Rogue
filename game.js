(() => {
  "use strict";

  // ===== Config =====
  const GRID_SIZE = 10;
  const CELL_SIZE = 32;
  const WIDTH = GRID_SIZE * CELL_SIZE;
  const HEIGHT = GRID_SIZE * CELL_SIZE;

  // ===== Canvas =====
  const canvas = document.getElementById("gameCanvas");
  if (!canvas) {
    throw new Error("Canvas not found: #gameCanvas");
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context not available");

  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  // ===== Game State =====
  // 0: floor, 1: wall, 2: stairs
  let map = [];
  let currentDepth = 1;

  const STATE = {
    AWAIT_INPUT: 0,
    PLAYER_ANIM: 1,
    ENEMY_ANIM: 2,
    GAME_OVER: 3,
  };
  let gameState = STATE.AWAIT_INPUT;

  const player = {
    x: 5,
    y: 5,
    pixelX: 5 * CELL_SIZE,
    pixelY: 5 * CELL_SIZE,
    targetX: 5,
    targetY: 5,
    isMoving: false,
    speed: 4, // must divide 32
    hp: 5,
    maxHp: 5,
  };

  const enemy = {
    x: 0,
    y: 0,
    pixelX: 0,
    pixelY: 0,
    targetX: 0,
    targetY: 0,
    isMoving: false,
    speed: 4,
    hp: 3,
    maxHp: 3,
    active: false,
  };

  const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
  };

  // ===== Map Generation =====
  function initMap() {
    map = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(1));

    const startX = 5;
    const startY = 5;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ny = startY + dy;
        const nx = startX + dx;
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
          map[ny][nx] = 0;
        }
      }
    }

    const targetFloorCount = Math.floor(GRID_SIZE * GRID_SIZE * 0.5);
    let currentFloorCount = 9;

    let cx = startX;
    let cy = startY;

    const dirs = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];

    while (currentFloorCount < targetFloorCount) {
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      const nx = cx + dir.dx;
      const ny = cy + dir.dy;

      if (nx > 0 && nx < GRID_SIZE - 1 && ny > 0 && ny < GRID_SIZE - 1) {
        cx = nx;
        cy = ny;
        if (map[cy][cx] === 1) {
          map[cy][cx] = 0;
          currentFloorCount++;
        }
      }
    }

    // stairs via BFS farthest
    const dist = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(-1));
    const q = [{ x: startX, y: startY }];
    dist[startY][startX] = 0;

    let maxDist = 0;

    while (q.length) {
      const cur = q.shift();
      const d0 = dist[cur.y][cur.x];

      for (const dir of dirs) {
        const nx = cur.x + dir.dx;
        const ny = cur.y + dir.dy;
        if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;
        if (map[ny][nx] !== 0) continue;
        if (dist[ny][nx] !== -1) continue;

        dist[ny][nx] = d0 + 1;
        if (dist[ny][nx] > maxDist) maxDist = dist[ny][nx];
        q.push({ x: nx, y: ny });
      }
    }

    const candidates = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (dist[y][x] === maxDist) candidates.push({ x, y });
      }
    }
    if (candidates.length) {
      const stairPos = candidates[Math.floor(Math.random() * candidates.length)];
      map[stairPos.y][stairPos.x] = 2;
    }

    // enemy placement (not in 3x3 safe area)
    const enemyCandidates = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (map[y][x] !== 0) continue;
        const inSafeArea = x >= 4 && x <= 6 && y >= 4 && y <= 6;
        if (!inSafeArea) enemyCandidates.push({ x, y });
      }
    }

    if (enemyCandidates.length) {
      const pos = enemyCandidates[Math.floor(Math.random() * enemyCandidates.length)];
      enemy.x = pos.x;
      enemy.y = pos.y;
      enemy.pixelX = enemy.x * CELL_SIZE;
      enemy.pixelY = enemy.y * CELL_SIZE;
      enemy.targetX = enemy.x;
      enemy.targetY = enemy.y;
      enemy.hp = enemy.maxHp;
      enemy.active = true;
      enemy.isMoving = false;
    } else {
      enemy.active = false;
    }
  }

  function resetGame() {
    currentDepth = 1;
    player.hp = player.maxHp;
    player.x = 5;
    player.y = 5;
    player.pixelX = 5 * CELL_SIZE;
    player.pixelY = 5 * CELL_SIZE;
    player.targetX = 5;
    player.targetY = 5;
    player.isMoving = false;

    initMap();
    gameState = STATE.AWAIT_INPUT;
  }

  // ===== Input =====
  window.addEventListener("keydown", (e) => {
    if (gameState === STATE.GAME_OVER) {
      if (e.key === "r" || e.key === "R") resetGame();
      return;
    }

    if (Object.prototype.hasOwnProperty.call(keys, e.key)) {
      keys[e.key] = true;
      e.preventDefault();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (Object.prototype.hasOwnProperty.call(keys, e.key)) {
      keys[e.key] = false;
      e.preventDefault();
    }
  });

  // ===== Update =====
  function updatePlayerAnim() {
    const tx = player.targetX * CELL_SIZE;
    const ty = player.targetY * CELL_SIZE;

    if (player.pixelX < tx) player.pixelX = Math.min(tx, player.pixelX + player.speed);
    else if (player.pixelX > tx) player.pixelX = Math.max(tx, player.pixelX - player.speed);

    if (player.pixelY < ty) player.pixelY = Math.min(ty, player.pixelY + player.speed);
    else if (player.pixelY > ty) player.pixelY = Math.max(ty, player.pixelY - player.speed);

    if (player.pixelX === tx && player.pixelY === ty) {
      player.x = player.targetX;
      player.y = player.targetY;
      player.isMoving = false;

      if (map[player.y][player.x] === 2) {
        currentDepth++;
        initMap();

        player.x = 5;
        player.y = 5;
        player.pixelX = 5 * CELL_SIZE;
        player.pixelY = 5 * CELL_SIZE;
        player.targetX = 5;
        player.targetY = 5;

        gameState = STATE.AWAIT_INPUT;
      } else {
        gameState = STATE.ENEMY_ANIM;
      }
    }
  }

  function updateEnemyAnim() {
    if (!enemy.active || enemy.hp <= 0) {
      gameState = STATE.AWAIT_INPUT;
      return;
    }

    const dirs = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];

    if (!enemy.isMoving) {
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      const nx = enemy.x + dir.dx;
      const ny = enemy.y + dir.dy;

      if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
        if (map[ny][nx] !== 1 && map[ny][nx] !== 2) {
          if (player.x === nx && player.y === ny) {
            player.hp -= 1;
            if (player.hp <= 0) gameState = STATE.GAME_OVER;
            else gameState = STATE.AWAIT_INPUT;
            return;
          }

          enemy.targetX = nx;
          enemy.targetY = ny;
          enemy.isMoving = true;
        }
      }

      if (!enemy.isMoving) {
        gameState = STATE.AWAIT_INPUT;
      }
      return;
    }

    const tx = enemy.targetX * CELL_SIZE;
    const ty = enemy.targetY * CELL_SIZE;

    if (enemy.pixelX < tx) enemy.pixelX = Math.min(tx, enemy.pixelX + enemy.speed);
    else if (enemy.pixelX > tx) enemy.pixelX = Math.max(tx, enemy.pixelX - enemy.speed);

    if (enemy.pixelY < ty) enemy.pixelY = Math.min(ty, enemy.pixelY + enemy.speed);
    else if (enemy.pixelY > ty) enemy.pixelY = Math.max(ty, enemy.pixelY - enemy.speed);

    if (enemy.pixelX === tx && enemy.pixelY === ty) {
      enemy.x = enemy.targetX;
      enemy.y = enemy.targetY;
      enemy.isMoving = false;
      gameState = STATE.AWAIT_INPUT;
    }
  }

  function updateAwaitInput() {
    if (player.isMoving) return;

    let dx = 0;
    let dy = 0;

    if (keys.ArrowUp) dy = -1;
    else if (keys.ArrowDown) dy = 1;
    else if (keys.ArrowLeft) dx = -1;
    else if (keys.ArrowRight) dx = 1;

    if (dx === 0 && dy === 0) return;

    const nx = player.x + dx;
    const ny = player.y + dy;

    if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) return;
    if (map[ny][nx] === 1) return;

    if (enemy.active && enemy.hp > 0 && enemy.x === nx && enemy.y === ny) {
      enemy.hp -= 1;
      if (enemy.hp <= 0) enemy.active = false;
      gameState = STATE.ENEMY_ANIM;
      return;
    }

    player.targetX = nx;
    player.targetY = ny;
    player.isMoving = true;
    gameState = STATE.PLAYER_ANIM;
  }

  function update() {
    if (gameState === STATE.GAME_OVER) return;

    if (gameState === STATE.AWAIT_INPUT) updateAwaitInput();
    else if (gameState === STATE.PLAYER_ANIM) updatePlayerAnim();
    else if (gameState === STATE.ENEMY_ANIM) updateEnemyAnim();
  }

  // ===== Draw =====
  function drawMap() {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const tile = map[y][x];

        if (tile === 0) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        } else if (tile === 1) {
          ctx.fillStyle = "#8B4513";
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        } else if (tile === 2) {
          ctx.fillStyle = "#FFD700";
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);

          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x * CELL_SIZE + 10, y * CELL_SIZE + 10);
          ctx.lineTo(x * CELL_SIZE + 22, y * CELL_SIZE + 16);
          ctx.lineTo(x * CELL_SIZE + 10, y * CELL_SIZE + 22);
          ctx.stroke();
        }
      }
    }
  }

  function drawGrid() {
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE + 0.5, 0);
      ctx.lineTo(i * CELL_SIZE + 0.5, HEIGHT);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE + 0.5);
      ctx.lineTo(WIDTH, i * CELL_SIZE + 0.5);
      ctx.stroke();
    }
  }

  function drawPlayer() {
    ctx.fillStyle = "#0000ff";
    ctx.fillRect(player.pixelX + 1, player.pixelY + 1, CELL_SIZE - 2, CELL_SIZE - 2);
  }

  function drawEnemy() {
    if (!enemy.active || enemy.hp <= 0) return;
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(enemy.pixelX + 1, enemy.pixelY + 1, CELL_SIZE - 2, CELL_SIZE - 2);
  }

  function drawUI() {
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillRect(2, 2, 190, 54);

    ctx.fillStyle = "#000000";
    ctx.font = "14px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.fillText(`Depth: ${currentDepth}`, 6, 4);
    ctx.fillText(`HP (Player): ${player.hp}/${player.maxHp}`, 6, 20);

    if (enemy.active && enemy.hp > 0) {
      ctx.fillText(`HP (Enemy): ${enemy.hp}/${enemy.maxHp}`, 6, 36);
    }

    if (gameState === STATE.GAME_OVER) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2 - 20);

      ctx.font = "16px Arial";
      ctx.fillText("(Press R to restart)", WIDTH / 2, HEIGHT / 2 + 12);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawMap();
    drawGrid();
    drawPlayer();
    drawEnemy();
    drawUI();
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  initMap();
  requestAnimationFrame(loop);
})();
