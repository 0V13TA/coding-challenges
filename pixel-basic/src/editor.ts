import { KEYWORDS } from "./tokenizer";

export const COMMANDS = {
  RUN: () => console.log("RUN"),
  NEW: () => console.log("NEW"),
  LIST: () => console.log("LIST"),
  STOP: () => console.log("STOP"),
};

// Autocomplete helper
export function getSuggestions(prefix: string): string[] {
  if (!prefix) return [];
  const allCommands = [...Object.keys(COMMANDS), ...KEYWORDS];
  return allCommands.filter((cmd) =>
    cmd.toLowerCase().startsWith(prefix.toLowerCase()),
  );
}

export function handleCommand(
  command: string,
  programMap: Map<number, string>,
): { lineNumber?: number; error?: string } {
  const cmd = command.trim();

  // 1. Direct command match
  if (Object.hasOwn(COMMANDS, cmd)) {
    COMMANDS[cmd as keyof typeof COMMANDS]();
    return {};
  }

  // 2. Numbered line match
  const match = cmd.match(/^(\d+)\s*(.*)$/);
  if (match) {
    const lineNum = parseInt(match[1], 10);
    const code = match[2].trim();

    if (code === "") {
      programMap.delete(lineNum);
    } else {
      programMap.set(lineNum, code);
      return { lineNumber: lineNum };
    }
    return {};
  }

  // 3. Error handling with existing Levenshtein logic
  const allCommands = [...Object.keys(COMMANDS), ...KEYWORDS];
  let closestMatch: string = "";

  for (const knownCommand of allCommands) {
    const distance = levenshteinDistance(cmd.toUpperCase(), knownCommand);
    if (distance < 2) {
      closestMatch =
        closestMatch === "" ||
        distance < levenshteinDistance(cmd.toUpperCase(), closestMatch)
          ? knownCommand
          : closestMatch;
    }
  }

  const errorMsg =
    closestMatch === ""
      ? "SYNTAX ERROR"
      : `Syntax Error: Did you mean ${closestMatch}?`;

  return { error: errorMsg };
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = new Array(rows * cols).fill(0);

  for (let i = 0; i < rows; i++) matrix[i] = i;
  for (let j = 0; j < cols; j++) matrix[j * rows] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] !== b[j - 1]) {
        matrix[j * rows + i] = Math.min(
          matrix[(j - 1) * rows + i] + 1,
          matrix[j * rows + (i - 1)] + 1,
          matrix[(j - 1) * rows + (i - 1)] + 1,
        );
      } else {
        matrix[j * rows + i] = matrix[(j - 1) * rows + (i - 1)];
      }
    }
  }
  return matrix[rows * cols - 1];
}

function hideAutocomplete(
  autocompleteList: HTMLUListElement,
  currentSuggestions: string[],
  selectedIndex: number,
) {
  autocompleteList.style.display = "none";
  currentSuggestions.splice(0);
  selectedIndex = -1;
}

export function renderEditor(
  programMap: Map<number, string>,
  commandsContainer: HTMLElement,
) {
  const sortedLines = [...programMap.keys()].sort((a, b) => a - b);
  commandsContainer.innerHTML = "";

  for (const lineNum of sortedLines) {
    const lineRow = document.createElement("div");
    lineRow.className = "command-line";

    const numSpan = document.createElement("span");
    numSpan.className = "line-number";
    numSpan.textContent = lineNum.toString();

    const codeSpan = document.createElement("div");
    codeSpan.className = "command";
    codeSpan.textContent = programMap.get(lineNum) || "";

    lineRow.appendChild(numSpan);
    lineRow.appendChild(codeSpan);
    commandsContainer.appendChild(lineRow);
  }

  // Auto-scroll the container to maintain focus on the latest execution line
  commandsContainer.scrollTop = commandsContainer.scrollHeight;
}

export function renderAutocomplete(
  selectedIndex: number,
  currentSuggestions: string[],
  inputElement: HTMLInputElement,
  autocompleteList: HTMLUListElement,
) {
  if (currentSuggestions.length === 0) {
    hideAutocomplete(autocompleteList, currentSuggestions, selectedIndex);
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
      applySuggestion(
        suggestion,
        inputElement,
        selectedIndex,
        currentSuggestions,
        autocompleteList,
      );
    });
    autocompleteList.appendChild(li);
  });
}

export function applySuggestion(
  suggestion: string,
  inputElement: HTMLInputElement,
  selectedIndex: number,
  currentSuggestions: string[],
  autocompleteList: HTMLUListElement,
) {
  const words = inputElement.value.split(" ");
  words[words.length - 1] = suggestion; // Replace currently typing word
  inputElement.value = words.join(" ") + " ";
  hideAutocomplete(autocompleteList, currentSuggestions, selectedIndex);
  inputElement.focus();
}

export function handleAutocompleteNavigation(
  selectedIndex: number,
  currentSuggestions: string[],
  programMap: Map<number, string>,
  errorDisplay: HTMLElement,
  inputForm: HTMLFormElement,
  commandsContainer: HTMLElement,
  inputElement: HTMLInputElement,
  autocompleteList: HTMLUListElement,
) {
  if (inputForm && inputElement && commandsContainer) {
    // 1. Handle Typing (Autocomplete Filtering)
    inputElement.addEventListener("input", () => {
      const rawInput = inputElement.value;
      const words = rawInput.split(" ");
      const currentWord = words[words.length - 1]; // Only autocomplete the active word

      if (currentWord.length > 0) {
        currentSuggestions = getSuggestions(currentWord);
        selectedIndex = currentSuggestions.length > 0 ? 0 : -1;
        renderAutocomplete(
          selectedIndex,
          currentSuggestions,
          inputElement,
          autocompleteList,
        );
      } else {
        hideAutocomplete(autocompleteList, currentSuggestions, selectedIndex);
      }
    });

    // 2. Handle Keyboard Navigation (Up, Down, Tab, Enter)
    inputElement.addEventListener("keydown", (e) => {
      if (currentSuggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          selectedIndex = (selectedIndex + 1) % currentSuggestions.length;
          renderAutocomplete(
            selectedIndex,
            currentSuggestions,
            inputElement,
            autocompleteList,
          );
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          selectedIndex =
            (selectedIndex - 1 + currentSuggestions.length) %
            currentSuggestions.length;
          renderAutocomplete(
            selectedIndex,
            currentSuggestions,
            inputElement,
            autocompleteList,
          );
        } else if (e.key === "Tab" || e.key === "Enter") {
          if (selectedIndex >= 0) {
            e.preventDefault();
            applySuggestion(
              currentSuggestions[selectedIndex],
              inputElement,
              selectedIndex,
              currentSuggestions,
              autocompleteList,
            );
          }
        } else if (e.key === "Escape") {
          hideAutocomplete(autocompleteList, currentSuggestions, selectedIndex);
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
      hideAutocomplete(autocompleteList, currentSuggestions, selectedIndex);
    });
  }
}
