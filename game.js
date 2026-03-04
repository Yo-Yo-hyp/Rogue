const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GRID_SIZE = 10;
const CELL_SIZE = 32;

const WIDTH = GRID_SIZE * CELL_SIZE;
const HEIGHT = GRID_SIZE * CELL_SIZE;

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

            // 画面外に出ないように境界判定を行う
            if (nextX >= 0 && nextX < GRID_SIZE && nextY >= 0 && nextY < GRID_SIZE) {
                player.targetX = nextX;
                player.targetY = nextY;
                player.isMoving = true;
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

function draw() {
    // 画面のクリア
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // 描画
    drawGrid();
    drawPlayer();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// ゲームループの開始
requestAnimationFrame(loop);
