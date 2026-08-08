import { COMMANDS, handleAutocompleteNavigation, renderEditor } from "./editor";
import { evaluate_program, hoist_program } from "./evaluator";
import {
  define_builtin_constants,
  define_builtin_functions,
  pass_1_scope_analysis,
  type Scope,
  type SymbolEntry,
} from "./parser_pass_1";
import { parse_program } from "./parser_pass_2";
import { create_environment, type Environment } from "./runtime";
import "./style.css";
import { tokenize } from "./tokenizer";

const canvas = document.getElementById("graphics-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
if (!ctx) throw new Error("Sorry but your system does not support HTML Canvas");

const uiOverlay = document.getElementById("ui-overlay") as HTMLElement;
const inputElement = document.getElementById("input") as HTMLInputElement;
const inputForm = document.getElementById("input-form") as HTMLFormElement;
const hudToggle = document.getElementById("hud-toggle") as HTMLButtonElement;
const errorDisplay = document.getElementById("error-display") as HTMLElement;
const autocompleteList = document.getElementById(
  "autocomplete-list",
) as HTMLUListElement;
const commandsContainer = document.getElementById(
  "commands-container",
) as HTMLElement;

const toggleEditorState = () => {
  uiOverlay.classList.toggle("drawer-closed");
  const isClosed = uiOverlay.classList.contains("drawer-closed");

  if (!isClosed) {
    setTimeout(() => inputElement.focus(), 50);
  } else {
    inputElement.blur();
  }
};

hudToggle.addEventListener("click", toggleEditorState);
window.addEventListener("keydown", (e) => keys_down.add(e.key));
window.addEventListener("keyup", (e) => keys_down.delete(e.key));

if (uiOverlay) {
  window.addEventListener("keydown", (e) => {
    if (e.key === "`") {
      e.preventDefault();
      toggleEditorState();
    }
  });
}

// Update mouse & touch pointer variables asynchronously
const updatePointerCoordinates = (clientX: number, clientY: number) => {
  if (active_env) {
    active_env.assign("MOUSE_X", clientX);
    active_env.assign("MOUSE_Y", clientY);
  }
};

addEventListener("mousemove", (e) => {
  updatePointerCoordinates(e.clientX, e.clientY);
});

// Map touch events to canvas pointer coordinates
addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length > 0) {
      updatePointerCoordinates(e.touches[0].clientX, e.touches[0].clientY);
    }
  },
  { passive: true },
);

addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 0) {
      updatePointerCoordinates(e.touches[0].clientX, e.touches[0].clientY);
    }
  },
  { passive: true },
);

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (ctx) {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const keys_down = new Set<string>();
const programMap = new Map<number, string>();

let selectedIndex: number = -1;
let currentSuggestions: string[] = [];

// --- Execution State ---
let animation_frame_id: number | null = null;
let active_env: Environment | null = null;

// --- Language Setup & Parsing Pipeline ---
function compile_and_run(source_code: string) {
  // Halt any previously running instance
  if (animation_frame_id !== null) {
    cancelAnimationFrame(animation_frame_id);
    animation_frame_id = null;
  }

  // Generate a fresh environment for every run
  active_env = create_environment(
    null,
    define_builtin_functions(ctx, keys_down),
  );
  define_builtin_constants(active_env, canvas.width, canvas.height);

  let scopes: Scope[] = [
    {
      id: 0,
      parent_id: null,
      start_token: 0,
      end_token: 0,
      symbols: new Map<string, SymbolEntry>(),
    },
  ];

  // Pipeline execution
  const { tokens } = tokenize(source_code);
  pass_1_scope_analysis(tokens, scopes);
  const ast = parse_program(tokens, scopes);

  hoist_program(ast, active_env);
  const interpreter = evaluate_program(ast, active_env);

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
      animation_frame_id = requestAnimationFrame(engine_tick);
    } else {
      console.log("Program Execution Terminated.");
      animation_frame_id = null;
    }
  }

  // Clear past errors and kick off the engine
  errorDisplay.style.display = "none";
  animation_frame_id = requestAnimationFrame(engine_tick);
}

// --- Command Bindings ---
COMMANDS.RUN = () => {
  uiOverlay.classList.add("drawer-closed");
  inputElement.blur();

  // Extract user code from the editor
  const values = programMap.values();
  const programText = Array.from(values).join("\n");

  compile_and_run(programText);
};

COMMANDS.STOP = () => {
  if (animation_frame_id !== null) {
    cancelAnimationFrame(animation_frame_id);
    animation_frame_id = null;
    active_env = null;
    console.log("Engine Halted.");
  }
};

COMMANDS.NEW = () => {
  COMMANDS.STOP();
  programMap.clear();
  renderEditor(programMap, commandsContainer);
  ctx.clearRect(0, 0, canvas.width, canvas.height); // Wipe the visual buffer
  console.log("Environment Cleared.");
};

COMMANDS.LIST = () => {
  uiOverlay.classList.remove("drawer-closed");
  setTimeout(() => inputElement.focus(), 50);
};

// Initialize the autocomplete handler
handleAutocompleteNavigation(
  selectedIndex,
  currentSuggestions,
  programMap,
  errorDisplay,
  inputForm,
  commandsContainer,
  inputElement,
  autocompleteList,
);
