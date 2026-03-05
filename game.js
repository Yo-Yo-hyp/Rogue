const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GRID_SIZE = 10;
const CELL_SIZE = 32;

const WIDTH = GRID_SIZE * CELL_SIZE;
const HEIGHT = GRID_SIZE * CELL_SIZE;

// 0: 床, 1: 壁, 2: 階段
let map = [];
let currentDepth = 1;

function initMap() {
    // 全体を壁で初期化
    for (let y = 0; y < GRID_SIZE; y++) {
        map[y] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            map[y][x] = 1;
        }
    }

    // ランダムウォーク（穴掘り法に似た手法）による迷路生成
    let startX = 5;
    let startY = 5;

    // 初期位置周辺(3x3)は必ず床にする
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            let ny = startY + dy;
            let nx = startX + dx;
            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                map[ny][nx] = 0;
            }
        }
    }

    // 床のマス数（面積の約半分を床にする）
    let targetFloorCount = Math.floor(GRID_SIZE * GRID_SIZE * 0.5);
    let currentFloorCount = 9; // 初期位置周辺の3x3=9マス

    let cx = startX;
    let cy = startY;

    // 規定の床面積に達するまでランダムに歩きながら掘る
    while (currentFloorCount < targetFloorCount) {
        // 上下左右からランダムな方向を選ぶ
        const dirs = [
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 }
        ];
        const dir = dirs[Math.floor(Math.random() * dirs.length)];

        let nx = cx + dir.dx;
        let ny = cy + dir.dy;

        // マップの外周には壁を残す（0より大きく、GRID_SIZE-1未満）
        if (nx > 0 && nx < GRID_SIZE - 1 && ny > 0 && ny < GRID_SIZE - 1) {
            cx = nx;
            cy = ny;
            if (map[cy][cx] === 1) {
                map[cy][cx] = 0;
                currentFloorCount++;
            }
        }
    }

    // --- 階段の配置 (BFS) ---
    // プレイヤーの初期位置から到達可能な床(0)の距離を計算する
    let distances = [];
    for (let y = 0; y < GRID_SIZE; y++) {
        distances[y] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            distances[y][x] = -1; // 未訪問
        }
    }

    let queue = [];
    queue.push({ x: startX, y: startY, d: 0 });
    distances[startY][startX] = 0;

    let maxDist = 0;

    // BFS実行
    while (queue.length > 0) {
        let curr = queue.shift();

        // 4方向をチェック
        const dirs = [
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 }
        ];

        for (let dir of dirs) {
            let nx = curr.x + dir.dx;
            let ny = curr.y + dir.dy;

            // マップ内で、かつ床(0)であり、未訪問の場合
            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                if (map[ny][nx] === 0 && distances[ny][nx] === -1) {
                    distances[ny][nx] = curr.d + 1;
                    queue.push({ x: nx, y: ny, d: curr.d + 1 });
                    if (distances[ny][nx] > maxDist) {
                        maxDist = distances[ny][nx];
                    }
                }
            }
        }
    }

    // 最大距離を持つタイルの候補を収集
    let candidates = [];
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (distances[y][x] === maxDist) {
                candidates.push({ x: x, y: y });
            }
        }
    }

    // 候補の中からランダムに1つ選んで階段(2)を配置する
    if (candidates.length > 0) {
        let stairPos = candidates[Math.floor(Math.random() * candidates.length)];
        map[stairPos.y][stairPos.x] = 2;
    }
}

// ゲーム開始時にマップを生成
initMap();

const player = {
    x: 5,
    y: 5,
    pixelX: 5 * CELL_SIZE,
    pixelY: 5 * CELL_SIZE,
    isMoving: false,
    targetX: 5,
    targetY: 5,
    speed: 4 // ピクセル/フレーム。32を割り切れる数にする
};

// 入力状態の管理
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
        e.preventDefault(); // スクロールを防ぐ
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;
        e.preventDefault();
    }
});

function update() {
    if (!player.isMoving) {
        let dx = 0;
        let dy = 0;

        // 1回に1方向のみ移動できるようにする（斜め移動不可）
        if (keys.ArrowUp) {
            dy = -1;
        } else if (keys.ArrowDown) {
            dy = 1;
        } else if (keys.ArrowLeft) {
            dx = -1;
        } else if (keys.ArrowRight) {
            dx = 1;
        }

        if (dx !== 0 || dy !== 0) {
            const nextX = player.x + dx;
            const nextY = player.y + dy;

            // 画面外に出ないように境界判定を行い、さらに移動先が壁(1)でないか判定する
            if (nextX >= 0 && nextX < GRID_SIZE && nextY >= 0 && nextY < GRID_SIZE) {
                if (map[nextY][nextX] !== 1) {
                    player.targetX = nextX;
                    player.targetY = nextY;
                    player.isMoving = true;
                }
            }
        }
    } else {
        // 目標座標に向かってピクセル単位で移動（アニメーション）
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

        // 目標地点に到達したか判定
        if (player.pixelX === targetPixelX && player.pixelY === targetPixelY) {
            player.x = player.targetX;
            player.y = player.targetY;
            player.isMoving = false;

            // 階段に乗ったか判定
            if (map[player.y][player.x] === 2) {
                // フロア移動処理
                currentDepth++;
                initMap(); // 新しいマップを生成（階段も再配置される）
                // プレイヤーを初期位置に戻す
                player.x = 5;
                player.y = 5;
                player.pixelX = 5 * CELL_SIZE;
                player.pixelY = 5 * CELL_SIZE;
                player.targetX = 5;
                player.targetY = 5;
            }
        }
    }
}

function drawMap() {
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (map[y][x] === 1) {
                // 壁を描画
                ctx.fillStyle = '#8B4513'; // 茶色
                ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            } else if (map[y][x] === 2) {
                // 階段を描画
                ctx.fillStyle = '#FFD700'; // 黄色（ゴールド）
                ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);

                // 階段のシンボルを描画（>の形）
                ctx.strokeStyle = '#000000';
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
    ctx.strokeStyle = '#cccccc'; // 細いグレーの線
    ctx.lineWidth = 1;

    // 0.5ずらすことで線がにじむのを防ぎ、くっきり描画する
    for (let i = 0; i <= GRID_SIZE; i++) {
        // 縦線
        ctx.beginPath();
        ctx.moveTo(i * CELL_SIZE + 0.5, 0);
        ctx.lineTo(i * CELL_SIZE + 0.5, HEIGHT);
        ctx.stroke();

        // 横線
        ctx.beginPath();
        ctx.moveTo(0, i * CELL_SIZE + 0.5);
        ctx.lineTo(WIDTH, i * CELL_SIZE + 0.5);
        ctx.stroke();
    }
}

function drawPlayer() {
    ctx.fillStyle = '#0000ff'; // 青い四角
    // グリッド線が見えるように上下左右に1ピクセルの余白を作る
    ctx.fillRect(player.pixelX + 1, player.pixelY + 1, CELL_SIZE - 2, CELL_SIZE - 2);
}

function drawUI() {
    // 階層（Depth）を描画
    ctx.fillStyle = '#000000';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    // 左上に背景を透過させないための小さな四角を描画
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(2, 2, 80, 20);
    // テキストを描画
    ctx.fillStyle = '#000000';
    ctx.fillText(`Depth: ${currentDepth}`, 5, 4);
}

function draw() {
    // 画面のクリア
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // 描画
    drawMap();
    drawGrid();
    drawPlayer();
    drawUI();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// ゲームループの開始
requestAnimationFrame(loop);
