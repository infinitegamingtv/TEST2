// --- DOM Elements ---
const screens = {
    lobby: document.getElementById('lobby-screen'),
    waiting: document.getElementById('waiting-screen'),
    dashboard: document.getElementById('teacher-dashboard'),
    game: document.getElementById('game-screen'),
    leaderboard: document.getElementById('leaderboard-screen')
};

// Lobby & Roles
const roleSelection = document.getElementById('role-selection');
const loginForm = document.getElementById('login-form');
const btnShowStudent = document.getElementById('btn-show-student');
const btnShowTeacher = document.getElementById('btn-show-teacher');
const btnBackRole = document.getElementById('btn-back-role');
const teacherCreating = document.getElementById('teacher-creating');
const errorMsg = document.getElementById('lobby-error');

// Waiting
const waitRoomId = document.getElementById('wait-room-id');

// Dashboard
const dashRoomId = document.getElementById('dash-room-id');
const playerCount = document.getElementById('player-count');
const dashPlayersList = document.getElementById('dash-players-list');
const btnStartGame = document.getElementById('btn-start-game');

// Game UI
const hudRoom = document.getElementById('hud-room');
const hudScore = document.getElementById('hud-score');
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const instructionText = document.getElementById('game-instruction');

// Leaderboard UI
const lbRoomName = document.getElementById('lb-room-name');
const lbYourScore = document.getElementById('lb-your-score');
const lbList = document.getElementById('leaderboard-list');
const btnPlayAgain = document.getElementById('btn-play-again');
const btnLeaveRoom = document.getElementById('btn-leave-room');

// --- Game Variables ---
let animationId;
let gameActive = false;
let gameStarted = false;
let score = 0;
let frameCount = 0;

// Entities
let player;
let obstacles = [];
let items = [];
let particles = [];

// Game Constants
const GRAVITY_FORCE = 0.6;
const JUMP_FORCE = 12;
const GAME_SPEED = 5;

// --- Setup ---
function switchScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// --- Multiplayer Listeners ---
multiplayer.onLeaderboardUpdate = (leaderboard) => {
    if (multiplayer.isTeacher) {
        // Cập nhật trên Dashboard
        dashPlayersList.innerHTML = '';
        playerCount.textContent = leaderboard.length;
        if (leaderboard.length > 0) btnStartGame.style.display = 'block';
        
        leaderboard.forEach((player, index) => {
            const li = document.createElement('li');
            li.className = `leaderboard-item rank-${index + 1}`;
            li.innerHTML = `
                <span class="player-name-lb">${index + 1}. ${player.name}</span>
                <span class="player-score-lb">${player.score}</span>
            `;
            dashPlayersList.appendChild(li);
        });
    } else if (screens.leaderboard.classList.contains('active')) {
        renderLeaderboard(leaderboard);
    }
};

multiplayer.onGameStarted = () => {
    if (!multiplayer.isTeacher) {
        switchScreen('game');
        initGame();
    }
};

// --- Lobby Logic ---
btnShowStudent.addEventListener('click', () => {
    roleSelection.style.display = 'none';
    loginForm.style.display = 'block';
});

btnBackRole.addEventListener('click', () => {
    loginForm.style.display = 'none';
    roleSelection.style.display = 'block';
    errorMsg.textContent = '';
});

// Teacher creates room
btnShowTeacher.addEventListener('click', async () => {
    roleSelection.style.display = 'none';
    teacherCreating.style.display = 'block';
    
    const result = await multiplayer.createRoom();
    if (result.success) {
        dashRoomId.textContent = result.roomId;
        switchScreen('dashboard');
    } else {
        alert(result.message);
        teacherCreating.style.display = 'none';
        roleSelection.style.display = 'block';
    }
});

// Student joins
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const playerName = document.getElementById('player-name').value.trim();
    const roomId = document.getElementById('room-id').value.trim().toUpperCase();

    if (!playerName || !roomId) return;

    errorMsg.textContent = 'Đang kết nối tới máy chủ...';
    loginForm.querySelector('button[type="submit"]').disabled = true;

    try {
        const result = await multiplayer.joinRoom(playerName, roomId);
        if (result.success) {
            errorMsg.textContent = '';
            waitRoomId.textContent = roomId;
            hudRoom.textContent = roomId;
            switchScreen('waiting');
        } else {
            errorMsg.textContent = result.message;
        }
    } catch (err) {
        errorMsg.textContent = 'Lỗi kết nối: ' + err.message;
    } finally {
        loginForm.querySelector('button[type="submit"]').disabled = false;
    }
});

// Teacher starts game
btnStartGame.addEventListener('click', () => {
    multiplayer.startGame();
    btnStartGame.style.display = 'none'; // Ẩn nút sau khi bắt đầu
});

// --- Game Logic ---
class Player {
    constructor() {
        this.w = 30;
        this.h = 30;
        this.x = 100;
        this.y = canvas.height - this.h - 10;
        this.vy = 0;
        this.gravity = GRAVITY_FORCE;
        this.isFlipped = false;
        this.color = '#3b82f6';
    }

    flipGravity() {
        this.gravity = -this.gravity;
        this.isFlipped = !this.isFlipped;
        // Thêm lực đẩy nhẹ khi đổi trọng lực để mượt hơn
        this.vy = this.isFlipped ? -JUMP_FORCE : JUMP_FORCE;
        createParticles(this.x + this.w/2, this.y + (this.isFlipped ? 0 : this.h), '#60a5fa', 5);
    }

    update() {
        this.vy += this.gravity;
        this.y += this.vy;

        // Xử lý va chạm sàn & trần
        if (this.y > canvas.height - this.h - 10) {
            this.y = canvas.height - this.h - 10;
            this.vy = 0;
        } else if (this.y < 10) {
            this.y = 10;
            this.vy = 0;
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.w, this.h, 5);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Vẽ "mắt" nhân vật
        ctx.fillStyle = '#fff';
        const eyeY = this.isFlipped ? this.y + 20 : this.y + 5;
        ctx.fillRect(this.x + 20, eyeY, 4, 4);
    }
}

class Obstacle {
    constructor() {
        this.w = 30;
        this.h = Math.random() * 100 + 50;
        this.x = canvas.width;
        this.isTop = Math.random() > 0.5;
        this.y = this.isTop ? 10 : canvas.height - this.h - 10;
        this.color = '#ef4444';
    }

    update() {
        this.x -= GAME_SPEED + (score * 0.05); // Tăng tốc theo điểm
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.shadowBlur = 0;
    }
}

class Item {
    constructor() {
        this.r = 10;
        this.x = canvas.width + 50;
        this.y = Math.random() * (canvas.height - 100) + 50;
        this.color = '#10b981';
        this.collected = false;
    }

    update() {
        this.x -= GAME_SPEED;
    }

    draw() {
        if (this.collected) return;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = (Math.random() - 0.5) * 5;
        this.life = 1;
        this.decay = Math.random() * 0.05 + 0.02;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }
    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function initGame() {
    player = new Player();
    obstacles = [];
    items = [];
    particles = [];
    score = 0;
    frameCount = 0;
    gameActive = true;
    gameStarted = false;
    hudScore.textContent = score;
    instructionText.style.display = 'block';
    
    drawBackground();
    player.draw();
}

function handleInput() {
    if (!gameActive) return;
    if (!gameStarted) {
        gameStarted = true;
        instructionText.style.display = 'none';
        gameLoop();
    }
    player.flipGravity();
}

// Controls
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        handleInput();
    }
});
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleInput();
});
canvas.addEventListener('mousedown', () => handleInput());

// Collision Check (AABB)
function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.w &&
        rect1.x + rect1.w > rect2.x &&
        rect1.y < rect2.y + rect2.h &&
        rect1.y + rect1.h > rect2.y
    );
}
// Collision for circle item
function checkItemCollision(p, item) {
    const distX = Math.abs(p.x + p.w/2 - item.x);
    const distY = Math.abs(p.y + p.h/2 - item.y);
    if (distX > (p.w/2 + item.r)) return false;
    if (distY > (p.h/2 + item.r)) return false;
    if (distX <= (p.w/2)) return true; 
    if (distY <= (p.h/2)) return true;
    const dx = distX - p.w/2;
    const dy = distY - p.h/2;
    return (dx*dx + dy*dy <= (item.r*item.r));
}

function gameOver() {
    gameActive = false;
    cancelAnimationFrame(animationId);
    
    // Hiệu ứng chữ Game Over trên Canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 50px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 10);
    ctx.fillStyle = '#fff';
    ctx.font = '24px Outfit, sans-serif';
    ctx.fillText(`Điểm của bạn: ${score}`, canvas.width/2, canvas.height/2 + 30);
    
    // Lưu điểm & chuyển màn hình
    multiplayer.updateScore(score);
    
    // Đợi 2 giây cho người chơi nhìn thấy điểm rồi mới chuyển sang Leaderboard
    setTimeout(() => {
        showLeaderboard();
    }, 2000);
}

function drawBackground() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw sci-fi grid or lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i - (frameCount % 50), 0);
        ctx.lineTo(i - (frameCount % 50), canvas.height);
        ctx.stroke();
    }
    // Sàn và trần
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, 10);
    ctx.fillRect(0, canvas.height - 10, canvas.width, 10);
}

function gameLoop() {
    if (!gameActive) return;
    frameCount++;

    drawBackground();

    // Spawn entities
    if (frameCount % 80 === 0) obstacles.push(new Obstacle());
    if (frameCount % 150 === 0) items.push(new Item());

    // Update & Draw Items
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.update();
        item.draw();

        if (!item.collected && checkItemCollision(player, item)) {
            item.collected = true;
            score += 10;
            hudScore.textContent = score;
            createParticles(item.x, item.y, item.color, 15);
        }

        if (item.x < -20 || item.collected) items.splice(i, 1);
    }

    // Update & Draw Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.update();
        obs.draw();

        if (checkCollision(player, obs)) {
            createParticles(player.x + player.w/2, player.y + player.h/2, player.color, 30);
            gameOver();
            return; // Dừng vòng lặp ngay khi chết
        }

        if (obs.x + obs.w < 0) {
            score += 1; // Điểm vượt qua chướng ngại vật
            hudScore.textContent = score;
            obstacles.splice(i, 1);
        }
    }

    // Update & Draw Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw();
        if (p.life <= 0) particles.splice(i, 1);
    }

    player.update();
    player.draw();

    animationId = requestAnimationFrame(gameLoop);
}

// --- Leaderboard Logic ---
function showLeaderboard() {
    switchScreen('leaderboard');
    lbRoomName.textContent = multiplayer.currentRoomId;
    lbYourScore.textContent = score;
    
    // Nếu có dữ liệu phòng, render ngay lập tức (tránh bị trống lúc mới hiện)
    if (multiplayer.roomRef) {
        multiplayer.roomRef.child('players').once('value', (snap) => {
            const data = snap.val() || {};
            const leaderboard = Object.keys(data).map(name => ({
                name: name,
                score: data[name].score
            })).sort((a, b) => b.score - a.score);
            renderLeaderboard(leaderboard);
        });
    }
}

function renderLeaderboard(data) {
    lbList.innerHTML = '';
    data.forEach((player, index) => {
        const li = document.createElement('li');
        li.className = `leaderboard-item rank-${index + 1}`;
        li.innerHTML = `
            <span class="player-name-lb">${index + 1}. ${player.name} ${player.name === multiplayer.currentPlayerName ? '(Bạn)' : ''}</span>
            <span class="player-score-lb">${player.score}</span>
        `;
        lbList.appendChild(li);
    });
}

btnPlayAgain.addEventListener('click', () => {
    switchScreen('game');
    initGame();
});

btnLeaveRoom.addEventListener('click', () => {
    multiplayer.leaveRoom();
    switchScreen('lobby');
    document.getElementById('player-name').value = '';
});
