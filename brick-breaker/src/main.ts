import "./style.css";
import { GameScreen, type GameState } from "./types";
import * as GamePlay from "./screens/gameplay.ts";
import * as Pause from "./screens/pause.ts";
import * as GameOver from "./screens/gameover.ts";

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d")!;
document.body.append(canvas);

canvas.width = innerWidth * 0.99;
canvas.height = innerHeight * 0.99;

const gameState: GameState = {
  life: 3,
  ctx: ctx,
  bombCount: 0,
  ballSize: 0.015,
  dropSpeed: 0.01,
  ballSpeed: 0.01,
  ghostDrawn: false,
  paddleSpeed: 0.01,
  gameScreen: GameScreen.GAME_PLAY,

  ballArray: [],
  blockArray: [],
  shooterArray: [],
  activeStatuses: [],
  uniqueDropArray: [],

  volume: {
    music: 100,
    general: 100,
    effects: 100,
  },
};

GamePlay.init(gameState);

function animate() {
  requestAnimationFrame(animate);

  switch (gameState.gameScreen) {
    case GameScreen.PAUSE_SCREEN:
      Pause.update();
      break;
    case GameScreen.GAME_PLAY:
      GamePlay.update(gameState);
      break;
    case GameScreen.GAME_OVER:
      GameOver.update();
      break;
    default:
      console.error("Invalid Screen type", gameState.gameScreen);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  switch (gameState.gameScreen) {
    case GameScreen.PAUSE_SCREEN:
      Pause.draw(gameState);
      break;
    case GameScreen.GAME_PLAY:
      GamePlay.draw(gameState);
      break;
    case GameScreen.GAME_OVER:
      GameOver.draw(gameState);
      break;
    default:
      console.error("Invalid Screen type", gameState.gameScreen);
  }
}

animate();

addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    if (gameState.gameScreen === GameScreen.GAME_PLAY) {
      gameState.gameScreen = GameScreen.PAUSE_SCREEN;
    } else if (gameState.gameScreen === GameScreen.PAUSE_SCREEN) {
      gameState.gameScreen = GameScreen.GAME_PLAY;
    }
  }

  if (gameState.gameScreen === GameScreen.GAME_OVER && e.code === "Space") {
    // Simple Reset Logic
    gameState.life = 3;
    gameState.gameScreen = GameScreen.GAME_PLAY;
    GamePlay.init(gameState); // Re-init level
  }
});

// Double Click -> Toggle Pause
window.addEventListener("dblclick", () => {
  if (gameState.gameScreen === GameScreen.GAME_PLAY) {
    gameState.gameScreen = GameScreen.PAUSE_SCREEN;
  } else if (gameState.gameScreen === GameScreen.PAUSE_SCREEN) {
    gameState.gameScreen = GameScreen.GAME_PLAY;
  }
});

// Single Click -> Restart Game (ONLY if in Game Over)
window.addEventListener("click", () => {
  if (gameState.gameScreen === GameScreen.GAME_OVER) {
    gameState.life = 3;
    gameState.gameScreen = GameScreen.GAME_PLAY;
    GamePlay.init(gameState);
  }
});
