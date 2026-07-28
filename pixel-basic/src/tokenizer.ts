// prettier-ignore
export const KEYWORDS = [
  "LET", "REM", "CONST",

  //
  "DO", "IF", "END",
  "SUB", "THEN", "ELSE",
  "WHILE",

  //
  "CASE", "SWITCH", "DEFAULT",

  //
  "BREAK", "RETURN", "CONTINUE",

  //
  "SCREEN",
];

// prettier-ignore
const OPERATORS = [
  "PLUS", "MINUS", "DIVIDE",
  "MODULO", "MULTIPLY",

  //
  "LTHAN", "GTHAN", "GTEQUAL",
  "EQUALTO", "LTEQUAL", "NOTEQUALTO",

  //
  "DECLARATION", "ADD_DECLARE",
  "SUB_DECLARE", "MULT_DECLARE",
  "DIV_DECLARE", "MOD_DECLARE",

  //
  "BITWISE", "LOGICAL",
];

const PUNCTUATIONS = ["LBRACKET", "RBRACKET", "LPAREN", "RPAREN", "COMMA"];
const LITERALS = ["BOOLEAN", "ID", "STRING", "NUMBER"];

export const TOKENS = [...LITERALS, ...KEYWORDS, ...OPERATORS, ...PUNCTUATIONS];

function isAlpha(char: string) {
  let firstChar = char;
  if (char.length > 1) {
    console.log(
      "Invalid input only 1 character is required. Checking first character",
    );
    firstChar = char[0];
  }

  if (
    (firstChar >= "A" && firstChar <= "Z") ||
    (firstChar >= "a" && firstChar <= "z")
  )
    return true;
  return false;
}

function isNum(num: string) {
  let foundDot = false;
  for (const char of num) {
    if (char === "." && !foundDot) {
      foundDot = true;
      continue;
    }
    if (isNaN(parseInt(char))) return false;
  }
  return true;
}

function isValidID(id: string) {
  const firstChar = id[0];
  let isValid = false;

  if (!(isAlpha(firstChar) || firstChar === "_")) return false;

  for (const char of id) {
    if (char === "_" || isAlpha(char) || isNum(char)) isValid = true;
    else isValid = false;
  }
  return isValid;
}

export function tokenize(sourceCode: string) {
  let lexeme = "";
  let tokens = [];
  let closingDQ = false,
    closingSQ = false,
    escapeMode = false; // closing double and single quotes
  for (let i = 0; i < sourceCode.length; i++) {
    const char = sourceCode[i];

    // Finding strings
    if (char === "'" && closingSQ === false && closingDQ === false) {
      closingSQ = true;
      continue;
    }

    if (closingSQ && char !== "'") {
      if (char == "\\") {
        escapeMode = true;
        continue;
      }
      lexeme += char;
      continue;
    }

    if (char === "'" && closingSQ) {
      if (escapeMode) {
        lexeme += char;
        escapeMode = false;
        continue;
      }
      closingSQ = false;
      tokens.push(`STRING ${lexeme}`);
      lexeme = "";
      continue;
    }

    if (char === '"' && closingDQ === false && closingSQ === false) {
      closingDQ = true;
      continue;
    }

    if (closingDQ && char !== '"') {
      if (char == "\\") {
        escapeMode = true;
        continue;
      }
      lexeme += char;
      continue;
    }

    if (char === '"' && closingDQ) {
      if (escapeMode) {
        lexeme += char;
        escapeMode = false;
        continue;
      }
      closingDQ = false;
      tokens.push(`STRING ${lexeme}`);
      lexeme = "";
      continue;
    }

    if (char.trim()) lexeme += char;
    if (!char.trim()) {
      if (!lexeme.trim()) continue;
      const keywordIndex = KEYWORDS.indexOf(lexeme);
      if (keywordIndex !== -1) {
        tokens.push(lexeme);
        lexeme = "";
        continue;
      }

      if (lexeme === "TRUE" || lexeme === "FALSE") {
        tokens.push(`BOOLEAN ${lexeme}`);
        lexeme = "";
        continue;
      }

      if (lexeme === "NOT" || lexeme === "AND" || lexeme === "OR") {
        tokens.push(`LOGICAL ${lexeme}`);
        lexeme = "";
        continue;
      }

      if (isNum(lexeme)) {
        tokens.push(`NUMBER ${lexeme}`);
        lexeme = "";
        continue;
      }

      if (isValidID(lexeme)) {
        tokens.push(`SYMBOL ${lexeme}`);
        lexeme = "";
        continue;
      }

      switch (lexeme) {
        // BITWISE
        case "~":
        case "&":
        case "|":
        case "^":
          tokens.push(`BITWISE ${lexeme}`);
          lexeme = "";
          continue;

        // Basic Arithmetic
        case "+":
          tokens.push("PLUS");
          lexeme = "";
          continue;
        case "-":
          tokens.push("MINUS");
          lexeme = "";
          continue;
        case "/":
          tokens.push("DIVIDE");
          lexeme = "";
          continue;
        case "*":
          tokens.push("MULTIPLY");
          lexeme = "";
          continue;
        case "%":
          tokens.push("MODULO");
          lexeme = "";
          continue;

        // Comparisons
        case "<":
          tokens.push("LTHAN");
          lexeme = "";
          continue;
        case ">":
          tokens.push("GTHAN");
          lexeme = "";
          continue;
        case "<=":
          tokens.push("LTEQUAL");
          lexeme = "";
          continue;
        case ">=":
          tokens.push("GTEQUAL");
          lexeme = "";
          continue;
        case "==":
          tokens.push("EQUALTO");
          lexeme = "";
          continue;

        // Declarations
        case "=":
          tokens.push("DECLARATION");
          lexeme = "";
          continue;
        case "+=":
          tokens.push("ADD_DECLARE");
          lexeme = "";
          continue;
        case "-=":
          tokens.push("SUB_DECLARE");
          lexeme = "";
          continue;
        case "*=":
          tokens.push("MULT_DECLARE");
          lexeme = "";
          continue;
        case "/=":
          tokens.push("DIV_DECLARE");
          lexeme = "";
          continue;
        case "%=":
          tokens.push("MOD_DECLARE");
          lexeme = "";
          continue;

        // Punctuations
        case "[":
          tokens.push("LBRACKET");
          lexeme = "";
          continue;
        case "]":
          tokens.push("RBRACKET");
          lexeme = "";
          continue;
        case "(":
          tokens.push("LPAREN");
          lexeme = "";
          continue;
        case ")":
          tokens.push("RPAREN");
          lexeme = "";
          continue;
        case ",":
          tokens.push("COMMA");
          lexeme = "";
          continue;

        default:
          console.log(`SYNTAX ERROR: ${lexeme} is not a valid token`);
      }

      lexeme = "";
    }
  }

  return tokens;
}
