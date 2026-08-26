import './style.css'

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("scoreEl");
const finalScoreEl = document.getElementById("finalScoreEl");
const gameOverModal = document.getElementById("gameOverModal");
const restartButton = document.getElementById("restartButton");
const highScoreIndicator = document.getElementById("highScoreIndicator");

canvas.width = innerWidth;
canvas.height = innerHeight;

document.body.appendChild(canvas);

let animationId;
let scoreCount = 0;
let enemySpeed = 0.5;
const enemySizes = [10, 20, 30];

/**
 * @type {Bullet[]}
 * */
const bulletList = [];
/**
 * @type {Enemy[]}
 * */
const enemyList = [];

class Player {
  constructor() {
    this.x = canvas.width / 2;
    this.y = canvas.height / 2;
    this.radius = 30;
    this.color = "blue";
  }

  draw() {
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Bullet {
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.dx = 0;
    this.dy = 0;
    this.radius = 10;
    this.color = "green";
    bulletList.push(this);
  }

  draw() {
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * @param {number} x1
   * @param {number} y1
   * @param {number} r1
   * @param {number} x2
   * @param {number} y2
   * @param {number} r2
   **/
  checkCollision(x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const disSq = dx * dx + dy * dy;
    const radiusSum = r1 + r2;
    return disSq <= (radiusSum * radiusSum);
  }

  update() {
    this.draw();
    this.x += this.dx;
    this.y += this.dy;

    if (this.x + this.radius > canvas.width ||
      this.x - this.radius < 0 ||
      this.y + this.radius > canvas.height ||
      this.y - this.radius < 0)
      bulletList.splice(bulletList.findIndex((value) => value === this), 1);

    for (let i = enemyList.length - 1; i >= 0; i--) {
      const enemy = enemyList[i];
      if (this.checkCollision(enemy.x, enemy.y, enemy.radius, this.x, this.y, this.radius)) {
        enemy.radius -= 10;
        scoreCount += 10;
        bulletList.splice(bulletList.findIndex((value) => value === this), 1);

        if (enemy.radius <= 0) {
          enemyList.splice(i, 1);
        }

        scoreEl.innerText = scoreCount;

        return;
      }
    }
  }
}

class Enemy {
  /**
   * @param {string} color
   * @param {number} radius
   * @param {number} x
   * @param {number} y
   * */
  constructor(x, y, radius, color) {
    this.x = x;
    this.y = y;
    this.speed = (Math.random() * 0.5) + enemySpeed;
    this.color = color;
    this.radius = radius;
    enemyList.push(this);
  }

  draw() {
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * @param {number} x1
   * @param {number} y1
   * @param {number} r1
   * @param {number} x2
   * @param {number} y2
   * @param {number} r2
   **/
  checkCollision(x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const disSq = dx * dx + dy * dy;
    const radiusSum = r1 + r2;
    return disSq <= (radiusSum * radiusSum);
  }

  update() {
    this.draw();
    const angle = Math.atan2(player.y - this.y, player.x - this.x);
    this.x += Math.cos(angle) * this.speed;
    this.y += Math.sin(angle) * this.speed;

    if (this.radius <= 0) enemyList.splice(enemyList.findIndex((enemy) => enemy === this), 1);
  }
}

const player = new Player();

let enemySpawnInterval = 100;
let frameCount = 0;

function spawnEnemy() {
  const radius = enemySizes[Math.floor(Math.random() * enemySizes.length)];
  const color = `hsl(${Math.random() * 360}, 50%, 50%)`;

  let x, y;

  // Decide which edge to spawn on (0: top, 1: right, 2: bottom, 3: left)
  const edge = Math.floor(Math.random() * 4);

  switch (edge) {
    case 0: // Top edge
      x = Math.random() * canvas.width;
      y = -radius;
      break;
    case 1: // Right edge
      x = canvas.width + radius;
      y = Math.random() * canvas.height;
      break;
    case 2: // Bottom edge
      x = Math.random() * canvas.width;
      y = canvas.height + radius;
      break;
    case 3: // Left edge
      x = -radius;
      y = Math.random() * canvas.height;
      break;
  }
  new Enemy(x, y, radius, color);
}

function animate() {
  animationId = requestAnimationFrame(animate);
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (scoreCount === 350 && enemySpeed != 3) enemySpeed = 3;
  else if (scoreCount === 700) enemySpawnInterval = 60;
  else if (scoreCount === 1050 && enemySpeed != 5) enemySpeed = 5;

  for (let i = bulletList.length - 1; i >= 0; i--) {
    bulletList[i].update();
  }

  for (let i = enemyList.length - 1; i >= 0; i--) {
    const enemy = enemyList[i];
    enemy.update();

    if (enemy.radius > 0 && enemy.checkCollision(enemy.x, enemy.y, enemy.radius, player.x, player.y, player.radius)) {
      player.color = "red";
      cancelAnimationFrame(animationId);
      gameOverModal.style.display = "flex";
      finalScoreEl.innerText = scoreCount;

      const highScore = localStorage.getItem("highScore") || 0;
      if (scoreCount > highScore) {
        localStorage.setItem("highScore", scoreCount);
        highScoreIndicator.classList.remove("hidden");
      }
    }
  }

  player.draw();

  if (frameCount % enemySpawnInterval === 0) {
    spawnEnemy();
  }
  frameCount++;
}

canvas.addEventListener("click", (e) => {
  const angle = Math.atan2(
    e.clientY - player.y, // deltaY: mouse Y - player Y
    e.clientX - player.x  // deltaX: mouse X - player X
  );
  const speed = 5;
  const bullet = new Bullet(player.x, player.y);
  bullet.dx = Math.cos(angle) * speed;
  bullet.dy = Math.sin(angle) * speed;
})

restartButton.onclick = () => location.reload();

animate();

