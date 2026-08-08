import "./style.css";
import ExampleSource from "./assets/p.basic?raw";
import { tokenize } from "./tokenizer";
import {
  renderEditor,
  handleCommand,
  getSuggestions,
  COMMANDS,
} from "./editor";
import {
  define_builtin_functions,
  Errors,
  pass_1_scope_analysis,
  type Scope,
  type SymbolEntry,
} from "./parser_pass_1";
import { parse_program } from "./parser_pass_2";

const canvas = document.getElementById("graphics-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const inputForm = document.getElementById("input-form") as HTMLFormElement;
const inputElement = document.getElementById("input") as HTMLInputElement;
const commandsContainer = document.getElementById(
  "commands-container",
) as HTMLElement;

const uiOverlay = document.getElementById("ui-overlay") as HTMLElement;

// Create top HUD overlay button
const hudToggle = document.getElementById("hud-toggle") as HTMLButtonElement;

const toggleEditorState = () => {
  uiOverlay.classList.toggle("drawer-closed");
  const isClosed = uiOverlay.classList.contains("drawer-closed");

  if (!isClosed) {
    setTimeout(() => inputElement.focus(), 50);
  } else {
    inputElement.blur();
  }
};

// Wire HUD button click handler
hudToggle.addEventListener("click", toggleEditorState);

// Refactor keyboard toggle to use the shared state function
if (uiOverlay) {
  window.addEventListener("keydown", (e) => {
    if (e.key === "`") {
      e.preventDefault();
      toggleEditorState();
    }
  });
}

COMMANDS.RUN = () => {
  uiOverlay.classList.add("drawer-closed");
  inputElement.blur();
};

// Create and inject the drawer toggle button
if (uiOverlay) {
  // Toggle UI overlay via Backquote (`) key for a raw terminal flow
  window.addEventListener("keydown", (e) => {
    if (e.key === "`") {
      e.preventDefault(); // Prevent typing backticks into the input
      uiOverlay.classList.toggle("drawer-closed");

      const isClosed = uiOverlay.classList.contains("drawer-closed");

      if (!isClosed) {
        // Yield execution momentarily to allow CSS transform to begin before focusing
        setTimeout(() => inputElement.focus(), 50);
      } else {
        inputElement.blur();
      }
    }
  });
}
// New UI Elements
const errorDisplay = document.getElementById("error-display") as HTMLElement;
const autocompleteList = document.getElementById(
  "autocomplete-list",
) as HTMLUListElement;

// At the top of main.ts
const keys_down = new Set<string>();

window.addEventListener("keydown", (e) => keys_down.add(e.key));
window.addEventListener("keyup", (e) => keys_down.delete(e.key));

const programMap = new Map<number, string>();

let currentSuggestions: string[] = [];
let selectedIndex: number = -1;

let scopes: Scope[] = [
  {
    id: 0,
    parent_id: null, // Points to the outer scope
    start_token: 0, // The index of the 'THEN' token
    end_token: 0, // The index of the 'END' token
    symbols: new Map<string, SymbolEntry>(),
  },
];
const tokens = tokenize(ExampleSource).tokens;
pass_1_scope_analysis(tokens, scopes);
const ast = parse_program(tokens, scopes);
console.log("Errors:", Errors);
import { create_environment } from "./runtime";
import { evaluate_program, hoist_program } from "./evaluator";

resizeCanvas();
const global_env = create_environment(
  null,
  define_builtin_functions(ctx, keys_down),
);
// Define static mathematical constants
global_env.define("PI", Math.PI);
global_env.define("HALF_PI", Math.PI / 2);
global_env.define("TWO_PI", Math.PI * 2);

// Initialize dynamic system variables
global_env.define("SCR_W", canvas.width);
global_env.define("SCR_H", canvas.height);
global_env.define("MOUSE_X", 0);
global_env.define("MOUSE_Y", 0);

// Update mouse & touch pointer variables asynchronously
const updatePointerCoordinates = (clientX: number, clientY: number) => {
  global_env.assign("MOUSE_X", clientX);
  global_env.assign("MOUSE_Y", clientY);
};

window.addEventListener("mousemove", (e) => {
  updatePointerCoordinates(e.clientX, e.clientY);
});

// Map touch events to canvas pointer coordinates
window.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length > 0) {
      updatePointerCoordinates(e.touches[0].clientX, e.touches[0].clientY);
    }
  },
  { passive: true },
);

window.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 0) {
      updatePointerCoordinates(e.touches[0].clientX, e.touches[0].clientY);
    }
  },
  { passive: true },
);
hoist_program(ast, global_env);
const interpreter = evaluate_program(ast, global_env);

const TARGET_FPS = 60;
const STEP_MS = 1000 / TARGET_FPS;
let last_time = performance.now();
let accumulator = 0;

function engine_tick(current_time: number) {
  let delta_time = current_time - last_time;
  last_time = current_time;

  // Cap delta to avoid death spirals on tab switch
  if (delta_time > 250) delta_time = 250;
  accumulator += delta_time;

  let is_running = true;

  // Process logical frames
  while (accumulator >= STEP_MS) {
    const result = interpreter.next();
    accumulator -= STEP_MS;

    if (result.done || (result.value && result.value.status !== "running")) {
      is_running = false;
      if (result.value?.status === "error") {
        errorDisplay.textContent = result.value.message;
        errorDisplay.style.display = "flex";
      }
      break;
    }
  }

  if (is_running) {
    requestAnimationFrame(engine_tick);
  } else {
    console.log("Program Execution Terminated.");
  }
}

// Kick off the engine
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (ctx) {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}
window.addEventListener("resize", resizeCanvas);
requestAnimationFrame(engine_tick);

function hideAutocomplete() {
  autocompleteList.style.display = "none";
  currentSuggestions = [];
  selectedIndex = -1;
}

function renderAutocomplete() {
  if (currentSuggestions.length === 0) {
    hideAutocomplete();
    return;
  }

  autocompleteList.innerHTML = "";
  autocompleteList.style.display = "flex";

  currentSuggestions.forEach((suggestion, index) => {
    const li = document.createElement("li");
    li.textContent = suggestion;
    if (index === selectedIndex) {
      li.classList.add("selected");
    }

    li.addEventListener("mousedown", (e) => {
      e.preventDefault(); // Prevent input from losing focus
      applySuggestion(suggestion);
    });
    autocompleteList.appendChild(li);
  });
}

function applySuggestion(suggestion: string) {
  const words = inputElement.value.split(" ");
  words[words.length - 1] = suggestion; // Replace currently typing word
  inputElement.value = words.join(" ") + " ";
  hideAutocomplete();
  inputElement.focus();
}

if (inputForm && inputElement && commandsContainer) {
  // 1. Handle Typing (Autocomplete Filtering)
  inputElement.addEventListener("input", () => {
    const rawInput = inputElement.value;
    const words = rawInput.split(" ");
    const currentWord = words[words.length - 1]; // Only autocomplete the active word

    if (currentWord.length > 0) {
      currentSuggestions = getSuggestions(currentWord);
      selectedIndex = currentSuggestions.length > 0 ? 0 : -1;
      renderAutocomplete();
    } else {
      hideAutocomplete();
    }
  });

  // 2. Handle Keyboard Navigation (Up, Down, Tab, Enter)
  inputElement.addEventListener("keydown", (e) => {
    if (currentSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % currentSuggestions.length;
        renderAutocomplete();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex =
          (selectedIndex - 1 + currentSuggestions.length) %
          currentSuggestions.length;
        renderAutocomplete();
      } else if (e.key === "Tab" || e.key === "Enter") {
        if (selectedIndex >= 0) {
          e.preventDefault();
          applySuggestion(currentSuggestions[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        hideAutocomplete();
      }
    }
  });

  // 3. Handle Form Submission
  inputForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const rawInput = inputElement.value.trim();
    if (!rawInput) return;

    // Execute command and get result object
    const result = handleCommand(rawInput, programMap);

    // Toggle Error UI
    if (result.error) {
      errorDisplay.textContent = result.error;
      errorDisplay.style.display = "flex";
    } else {
      errorDisplay.style.display = "none";
      inputElement.value = `${result.lineNumber !== undefined ? result.lineNumber + 10 : ""} `;
    }

    renderEditor(programMap, commandsContainer);
    hideAutocomplete();
  });
}
