import { KEYWORDS } from "./parser";

export const COMMANDS = {
  RUN: () => console.log("RUN"), // Starts the execution loop
  NEW: () => console.log("NEW"), // Wipes the programMap clear
  LIST: () => console.log("LIST"), // Displays the program lines in the view array
  STOP: () => console.log("STOP"), // Halts the frame loop
};

function printToConsole(message: string) {
  console.log(message); // TODO: Replace with actual console output logic
}

export function handleCommand(
  command: string,
  programMap: Map<number, string>,
) {
  const cmd = command.trim();
  if (Object.hasOwn(COMMANDS, cmd)) {
    COMMANDS[cmd as keyof typeof COMMANDS]();
    return;
  }

  const match = cmd.match(/^(\d+)\s*(.*)$/);
  if (match) {
    const lineNum = parseInt(match[1], 10);
    const code = match[2].trim();
    if (code === "") {
      programMap.delete(lineNum);
    } else {
      programMap.set(lineNum, code);
      return lineNum; // Return the line number for further processing if needed
    }
  } else {
    const allCommands = [...Object.keys(COMMANDS), ...KEYWORDS];
    let closestMatch: string = "";
    for (const command of allCommands) {
      const distance = levenshteinDistance(cmd.toUpperCase(), command);
      if (distance < 2)
        closestMatch =
          distance < levenshteinDistance(cmd.toUpperCase(), closestMatch)
            ? command
            : closestMatch;
    }
    console.log(allCommands);
    // If it's neither a command nor a numbered line, log an editor error
    closestMatch === ""
      ? printToConsole("SYNTAX ERROR")
      : printToConsole(`Syntax Error: Did you mean ${closestMatch}`);
  }
}

export function renderEditor(
  programMap: Map<number, string>,
  commandsContainer: HTMLElement,
) {
  const sortedLines = [...programMap.keys()].sort((a, b) => a - b);
  commandsContainer.innerHTML = ""; // Clear previous content

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

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = new Array(rows * cols).fill(0);

  // Initialize the first row
  for (let i = 0; i < rows; i++) {
    matrix[i] = i;
  }

  // Initialize the first column
  for (let j = 0; j < cols; j++) {
    matrix[j * rows] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] !== b[j - 1]) {
        matrix[j * rows + i] = Math.min(
          matrix[(j - 1) * rows + i] + 1, // Insertion
          matrix[j * rows + (i - 1)] + 1, // Deletion
          matrix[(j - 1) * rows + (i - 1)] + 1, // Substitution
        );
      } else {
        matrix[j * rows + i] = matrix[(j - 1) * rows + (i - 1)];
      }
    }
  }

  return matrix[rows * cols - 1];
}
