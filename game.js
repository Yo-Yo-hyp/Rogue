document.title = "JS LOADED";
// === DEBUG OVERLAY (temporary, robust) ===
(function () {
  function ensureBox() {
    let box = document.getElementById("__debug_overlay__");
    if (!box) {
      box = document.createElement("pre");
      box.id = "__debug_overlay__";
      box.style.position = "fixed";
      box.style.left = "8px";
      box.style.right = "8px";
      box.style.bottom = "8px";
      box.style.maxHeight = "45vh";
      box.style.overflow = "auto";
      box.style.whiteSpace = "pre-wrap";
      box.style.padding = "10px";
      box.style.background = "rgba(0,0,0,0.85)";
      box.style.color = "#fff";
      box.style.fontSize = "12px";
      box.style.zIndex = "999999";
      (document.body || document.documentElement).appendChild(box);
    }
    return box;
  }
  function show(msg) {
    try {
      const box = ensureBox();
      box.textContent += msg + "\n";
    } catch (_) {}
  }
  window.addEventListener("error", (e) => show(`[ERROR] ${e.message}\n${e.filename}:${e.lineno}:${e.colno}`));
  window.addEventListener("unhandledrejection", (e) => show(`[REJECTION] ${String(e.reason)}`));
  show("[DEBUG] overlay loaded");
})();
// ===== DEBUG END =====

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("gameCanvas");
  if (!canvas) {
    document.body.innerHTML = "<pre>Canvas not found: gameCanvas</pre>";
    return;
  }
  
  const ctx = canvas.getContext("2d");

  const GRID_SIZE = 10;
  const CELL_SIZE = 32;

  const WIDTH = GRID_SIZE * CELL_SIZE;
  const HEIGHT = GRID_SIZE * CELL_SIZE;

  // 0: 床, 1: 壁, 2: 階段
  let map = [];
  let currentDepth = 1;

  const STATE = {
    AWAIT_INPUT: 0,
    PLAYER_ANIM: 1,
    ENEMY_ANIM: 2,
    GAME_OVER: 3
  };
  let gameState = STATE.AWAIT_INPUT;

  const enemy = {
    x: 0,
    y: 0,
    pixelX: 0,
    pixelY: 0,
    isMoving: false,
    targetX: 0,
    targetY: 0,
    speed: 4,
    hp: 3,
    maxHp: 3,
    active: false
  };

  const player = {
    x: 5,
    y: 5,
    pixelX: 5 * CELL_SIZE,
    pixelY: 5 * CELL_SIZE,
    isMoving: false,
    targetX: 5,
    targetY: 5,
    speed: 4,
    hp: 5,
    maxHp: 5
  };

  const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
  };

  function initMap() {
    // mapを作り直す
    map = [];

    // 全体を壁で初期化
    for (let y = 0; y < GRID_SIZE; y++) {
      map[y] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        map[y][x] = 1;
      }
    }

    const startX = 5;
    const startY = 5;

    // 初期位置周辺(3x3)は必ず床
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ny = startY + dy;
        const nx = startX + dx;
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
          map[ny][nx] = 0;
        }
      }
    }

    // 床のマス数（面積の約半分）
    const targetFloorCount = Math.floor(GRID_SIZE * GRID_SIZE * 0.5);
    let currentFloorCount = 9; // 3x3
    let cx = startX;
    let cy = startY;

    // ランダムウォークで掘る
    while (currentFloorCount < targetFloorCount) {
      const dirs = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 }
      ];
      const dir = dirs[Math.floor(Math.random() * dirs.length)];

      const nx = cx + dir.dx;
      const ny = cy + dir.dy;

      // 外周は壁を残す
      if (nx > 0 && nx < GRID_SIZE - 1 && ny > 0 && ny < GRID_SIZE - 1) {
        cx = nx;
        cy = ny;
        if (map[cy][cx] === 1) {
          map[cy][cx] = 0;
          currentFloorCount++;
        }
      }
    }

    // --- 階段配置 (BFS 最遠) ---
    const distances = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(-1));
    const queue = [];
    queue.push({ x: startX, y: startY, d: 0 });
    distances[startY][startX] = 0;

    let maxDist = 0;

    while (queue.length > 0) {
      const curr = queue.shift();
      const dirs = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 }
      ];
      for (const d of dirs) {
        const nx = curr.x + d.dx;
        const ny = curr.y + d.dy;
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
          if (map[ny][nx] === 0 && distances[ny][nx] === -1) {
            distances[ny][nx] = curr.d + 1;
            queue.push({ x: nx, y: ny, d: curr.d + 1 });
            if (distances[ny][nx] > maxDist) maxDist = distances[ny][nx];
          }
        }
      }
    }

    const candidates = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (distances[y][x] === maxDist) candidates.push({ x, y });
      }
    }

    if (candidates.length > 0) {
      const stairPos = candidates[Math.floor(Math.random() * candidates.length)];
      map[stairPos.y][stairPos.x] = 2;
    }

    // --- 敵配置（床(0)、安全地帯(3x3)除外、階段(2)除外）---
    const enemyCandidates = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (map[y][x] === 0) {
          const inSafeArea = (x >= 4 && x <= 6 && y >= 4 && y <= 6);
          if (!inSafeArea) enemyCandidates.push({ x, y });
        }
      }
    }

    if (enemyCandidates.length > 0) {
      const enemyPos = enemyCandidates[Math.floor(Math.random() * enemyCandidates.length)];
      enemy.x = enemyPos.x;
      enemy.y = enemyPos.y;
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

  window.addEventListener("keydown", (e) => {
    if (gameState === STATE.GAME_OVER) {
      if (e.key === "r" || e.key === "R") {
        resetGame();
      }
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

  function update() {
    if (gameState === STATE.GAME_OVER) return;

    if (gameState === STATE.AWAIT_INPUT) {
      if (!player.isMoving) {
        let dx = 0;
        let dy = 0;

        if (keys.ArrowUp) dy = -1;
        else if (keys.ArrowDown) dy = 1;
        else if (keys.ArrowLeft) dx = -1;
        else if (keys.ArrowRight) dx = 1;

        if (dx !== 0 || dy !== 0) {
          const nextX = player.x + dx;
          const nextY = player.y + dy;

          if (nextX >= 0 && nextX < GRID_SIZE && nextY >= 0 && nextY < GRID_SIZE) {
            if (map[nextY][nextX] !== 1) {
              // bump attack
              if (enemy.active && enemy.hp > 0 && enemy.x === nextX && enemy.y === nextY) {
                enemy.hp -= 1;
                if (enemy.hp <= 0) enemy.active = false;
                gameState = STATE.ENEMY_ANIM;
              } else {
                player.targetX = nextX;
                player.targetY = nextY;
                player.isMoving = true;
                gameState = STATE.PLAYER_ANIM;
              }
            }
          }
        }
      }
      return;
    }

    if (gameState === STATE.PLAYER_ANIM) {
      const targetPixelX = player.targetX * CELL_SIZE;
      const targetPixelY = player.targetY * CELL_SIZE;

      if (player.pixelX < targetPixelX) {
        player.pixelX += player.speed;
        if (player.pixelX > targetPixelX) player.pixelX = targetPixelX;
      } else if (player.pixelX > targetPixelX) {
        player.pixelX -= player.speed;
        if (player.pixelX < targetPixelX) player.pixelX = targetPixelX;
      }

      if (player.pixelY < targetPixelY) {
        player.pixelY += player.speed;
        if (player.pixelY > targetPixelY) player.pixelY = targetPixelY;
      } else if (player.pixelY > targetPixelY) {
        player.pixelY -= player.speed;
        if (player.pixelY < targetPixelY) player.pixelY = targetPixelY;
      }

      if (player.pixelX === targetPixelX && player.pixelY === targetPixelY) {
        player.x = player.targetX;
        player.y = player.targetY;
        player.isMoving = false;

        // stairs
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
          return;
        }

        gameState = STATE.ENEMY_ANIM;
      }
      return;
    }

    if (gameState === STATE.ENEMY_ANIM) {
      if (!enemy.active || enemy.hp <= 0) {
        gameState = STATE.AWAIT_INPUT;
        return;
      }

      if (!enemy.isMoving) {
        const dirs = [
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 }
        ];

        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        const nextX = enemy.x + dir.dx;
        const nextY = enemy.y + dir.dy;

        if (nextX >= 0 && nextX < GRID_SIZE && nextY >= 0 && nextY < GRID_SIZE) {
          // 壁(1)と階段(2)は避ける
          if (map[nextY][nextX] !== 1 && map[nextY][nextX] !== 2) {
            // player bump
            if (player.x === nextX && player.y === nextY) {
              player.hp -= 1;
              if (player.hp <= 0) gameState = STATE.GAME_OVER;
              else gameState = STATE.AWAIT_INPUT;
              return;
            }

            enemy.targetX = nextX;
            enemy.targetY = nextY;
            enemy.isMoving = true;
          } else {
            gameState = STATE.AWAIT_INPUT;
          }
        } else {
          gameState = STATE.AWAIT_INPUT;
        }
      } else {
        const targetPixelX = enemy.targetX * CELL_SIZE;
        const targetPixelY = enemy.targetY * CELL_SIZE;

        if (enemy.pixelX < targetPixelX) {
          enemy.pixelX += enemy.speed;
          if (enemy.pixelX > targetPixelX) enemy.pixelX = targetPixelX;
        } else if (enemy.pixelX > targetPixelX) {
          enemy.pixelX -= enemy.speed;
          if (enemy.pixelX < targetPixelX) enemy.pixelX = targetPixelX;
        }

        if (enemy.pixelY < targetPixelY) {
          enemy.pixelY += enemy.speed;
          if (enemy.pixelY > targetPixelY) enemy.pixelY = targetPixelY;
        } else if (enemy.pixelY > targetPixelY) {
          enemy.pixelY -= enemy.speed;
          if (enemy.pixelY < targetPixelY) enemy.pixelY = targetPixelY;
        }

        if (enemy.pixelX === targetPixelX && enemy.pixelY === targetPixelY) {
          enemy.x = enemy.targetX;
          enemy.y = enemy.targetY;
          enemy.isMoving = false;
          gameState = STATE.AWAIT_INPUT;
        }
      }
    }
  }

  function drawMap() {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        // ★床(0)も塗る：これが無いと白く見える
        if (map[y][x] === 0) {
          ctx.fillStyle = "#f7f7f7";
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        } else if (map[y][x] === 1) {
          ctx.fillStyle = "#8B4513";
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        } else if (map[y][x] === 2) {
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
    if (enemy.active && enemy.hp > 0) {
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(enemy.pixelX + 1, enemy.pixelY + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }
  }

  function drawUI() {
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillRect(2, 2, 190, 54);

    ctx.fillStyle = "#000000";
    ctx.font = "14px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.fillText(`Depth: ${currentDepth}`, 6, 6);
    ctx.fillText(`HP (Player): ${player.hp}/${player.maxHp}`, 6, 22);

    if (enemy.active && enemy.hp > 0) {
      ctx.fillText(`HP (Enemy): ${enemy.hp}/${enemy.maxHp}`, 6, 38);
    }

    if (gameState === STATE.GAME_OVER) {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2 - 18);

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

  // 起動
  initMap();
  requestAnimationFrame(loop);
});
