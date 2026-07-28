import "./style.css";
import ExampleSource from "./assets/practice.basic?raw";
import { tokenize } from "./tokenizer";
import { renderEditor, handleCommand, getSuggestions } from "./editor";
import { pass_1_scope_analysis, type Scope } from "./parser_pass_1";

const canvas = document.getElementById("graphics-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
const inputForm = document.getElementById("input-form") as HTMLFormElement;
const inputElement = document.getElementById("input") as HTMLInputElement;
const commandsContainer = document.getElementById(
  "commands-container",
) as HTMLElement;

// New UI Elements
const errorDisplay = document.getElementById("error-display") as HTMLElement;
const autocompleteList = document.getElementById(
  "autocomplete-list",
) as HTMLUListElement;

const programMap = new Map<number, string>();

let currentSuggestions: string[] = [];
let selectedIndex: number = -1;

let scopes: Scope[] = [];
const tokens = tokenize(ExampleSource).tokens;
pass_1_scope_analysis(tokens, scopes);
console.log(scopes);

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
  autocompleteList.style.display = "block";

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
      errorDisplay.style.display = "block";
    } else {
      errorDisplay.style.display = "none";
      inputElement.value = `${result.lineNumber !== undefined ? result.lineNumber + 10 : ""} `;
    }

    renderEditor(programMap, commandsContainer);
    hideAutocomplete();
  });
}
