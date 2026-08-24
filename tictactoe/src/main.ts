import "./style.css";

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
document.querySelector("#app")?.append(canvas);


type player = "X" | "O" | "";
let current_player: player = "X";

const BOX_SIZE = 150;
const size = "3 3";
const [rows, columns] = size.split(" ").map(num => parseInt(num, 10));
const moves: player[] = [];
const X_OFFSET = (canvas.width / 2) - ((BOX_SIZE * rows) / 2);
const Y_OFFSET = (canvas.height / 2) - ((BOX_SIZE * columns) / 2);

function init() {
  for (let i = 0; i < rows * columns; i++) moves[i] = "";
  drawGrid();
}

function drawGrid() {
  ctx.strokeRect(X_OFFSET, Y_OFFSET, BOX_SIZE * 3, BOX_SIZE * 3);
  moves.forEach((player, index) => {
    const x = index % columns;
    const y = Math.floor(index / columns);
    const x_pos = x * BOX_SIZE + X_OFFSET;
    const y_pos = y * BOX_SIZE + Y_OFFSET;
    const font_size = 56;
    ctx.font = `${font_size}px agave`
    const metrics = ctx.measureText(player);
    ctx.fillText(player, x_pos + (BOX_SIZE / 2) - (metrics.width / 2), y_pos + (BOX_SIZE / 2) + (font_size / 2));
    ctx.strokeRect(x_pos, y_pos, BOX_SIZE, BOX_SIZE);
  })
}

function checkLine(line: player[]): player {
  if (line.length === 0) return "";

  const first = line[0];

  if (first === "") return "";

  for (let i = 1; i < line.length; i++) {
    if (line[i] !== first) {
      return "";
    }
  }

  return first;
}

function getRows(): player[][] {
  const result: player[][] = [];

  for (let y = 0; y < rows; y++) {
    const row: player[] = [];

    for (let x = 0; x < columns; x++) {
      row.push(moves[y * columns + x]);
    }

    result.push(row);
  }

  return result;
}

function getCols(): player[][] {
  const result: player[][] = [];

  for (let x = 0; x < columns; x++) {
    const col: player[] = [];

    for (let y = 0; y < rows; y++) {
      col.push(moves[y * columns + x]);
    }

    result.push(col);
  }

  return result;
}

function getDiagonals(): player[][] {
  const major: player[] = [];
  const minor: player[] = [];

  for (let i = 0; i < rows; i++) {
    major.push(moves[i * columns + i]);
    minor.push(moves[i * columns + (columns - 1 - i)]);
  }

  return [major, minor];
}

function checkWin(): player {
  const lines = [
    ...getRows(),
    ...getCols(),
    ...getDiagonals(),
  ];

  for (const line of lines) {
    const winner = checkLine(line);

    if (winner !== "") {
      return winner;
    }
  }

  return "";
}

canvas.onclick = (e) => {
  const mouse_x = e.clientX;
  const mouse_y = e.clientY;

  moves.forEach((player, index) => {
    const x = index % columns;
    const y = Math.floor(index / columns);
    const x_pos = x * BOX_SIZE + X_OFFSET;
    const y_pos = y * BOX_SIZE + Y_OFFSET;

    if (
      (mouse_x >= x_pos && mouse_x <= x_pos + BOX_SIZE) &&
      (mouse_y >= y_pos && mouse_y <= y_pos + BOX_SIZE)
    ) {
      if (player === "") {
        moves[index] = current_player;
        current_player = current_player === "X" ? "O" : "X";
      }
    }
  })

  ctx.clearRect(X_OFFSET, Y_OFFSET, BOX_SIZE * 3, BOX_SIZE * 3);
  drawGrid();

  const win = checkWin();
  console.log(win);

  if (win !== "") {
    alert(`${win} is the winner`);
    init();
  }
}

init()
