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
}
