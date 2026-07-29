export type TokenType =
  | "LET"
  | "CONST"
  | "IF"
  | "THEN"
  | "ELSE"
  | "WHILE"
  | "DO"
  | "END"
  | "SUB"
  | "RETURN"
  | "BREAK"
  | "CONTINUE"
  | "SWITCH"
  | "CASE"
  | "DEFAULT"
  | "EQUALTO"
  | "NOTEQUALTO"
  | "LTEQUAL"
  | "GTEQUAL"
  | "ADD_DECLARE"
  | "SUB_DECLARE"
  | "MULT_DECLARE"
  | "DIV_DECLARE"
  | "MOD_DECLARE"
  | "DECLARATION"
  | "PLUS"
  | "MINUS"
  | "MULTIPLY"
  | "DIVIDE"
  | "MODULO"
  | "LTHAN"
  | "GTHAN"
  | "BITWISE"
  | "LPAREN"
  | "RPAREN"
  | "LBRACKET"
  | "RBRACKET"
  | "LBRACE"
  | "RBRACE"
  | "COMMA"
  | "COLON"
  | "NUMBER"
  | "STRING"
  | "BOOLEAN"
  | "ID"
  | "NEWLINE"
  | "AND"
  | "OR"
  | "NOT";

export type Token = {
  type: TokenType;
  value: string;
  line: number;
  column: number;
};

export type LexError = {
  message: string;
  line: number;
  column: number;
};

export const KEYWORDS = new Set([
  "LET",
  "CONST",
  "IF",
  "THEN",
  "ELSE",
  "WHILE",
  "DO",
  "END",
  "SUB",
  "RETURN",
  "BREAK",
  "CONTINUE",
  "SWITCH",
  "CASE",
  "DEFAULT",
]);

const TWO_CHAR_OPERATORS: Record<string, string> = {
  "==": "EQUALTO",
  "!=": "NOTEQUALTO",
  "<=": "LTEQUAL",
  ">=": "GTEQUAL",
  "+=": "ADD_DECLARE",
  "-=": "SUB_DECLARE",
  "*=": "MULT_DECLARE",
  "/=": "DIV_DECLARE",
  "%=": "MOD_DECLARE",
};

const ONE_CHAR_OPERATORS: Record<string, string> = {
  "=": "DECLARATION",
  "+": "PLUS",
  "-": "MINUS",
  "*": "MULTIPLY",
  "/": "DIVIDE",
  "%": "MODULO",
  "<": "LTHAN",
  ">": "GTHAN",
  "&": "BITWISE",
  "|": "BITWISE",
  "^": "BITWISE",
  "~": "BITWISE",
};

const PUNCTUATION: Record<string, string> = {
  "(": "LPAREN",
  ")": "RPAREN",
  "[": "LBRACKET",
  "]": "RBRACKET",
  "{": "LBRACE",
  "}": "RBRACE",
  ",": "COMMA",
  ":": "COLON",
};

function isAlpha(c: string) {
  return /[A-Za-z]/.test(c);
}

function isDigit(c: string) {
  return /[0-9]/.test(c);
}

function isAlphaNumeric(c: string) {
  return /[A-Za-z0-9_]/.test(c);
}

export function tokenize(source: string): {
  tokens: Token[];
  errors: LexError[];
} {
  const tokens: Token[] = [];
  const errors: LexError[] = [];

  let i = 0;
  let currentLine = 1;
  let currentColumn = 1;

  const advance = (amount: number = 1) => {
    for (let step = 0; step < amount; step++) {
      if (source[i] === "\n") {
        currentLine++;
        currentColumn = 1;
      } else {
        currentColumn++;
      }
      i++;
    }
  };

  while (i < source.length) {
    let c = source[i];

    const startLine = currentLine;
    const startCol = currentColumn;

    const addToken = (type: TokenType, value: string) => {
      tokens.push({ type, value, line: startLine, column: startCol });
    };

    //-----------------------------------
    // whitespace
    //-----------------------------------

    if (c === " " || c === "\t" || c === "\r") {
      advance();
      continue;
    }

    //-----------------------------------
    // newline
    //-----------------------------------

    if (c === "\n") {
      addToken("NEWLINE", "\\n");
      advance();
      continue;
    }

    //-----------------------------------
    // strings
    //-----------------------------------

    if (c === '"' || c === "'") {
      const quote = c;
      i++;

      let value = "";

      while (i < source.length) {
        c = source[i];

        if (c === "\\") {
          value += source[i + 1];
          advance(2);
          continue;
        }

        if (c === quote) {
          advance();
          break;
        }

        value += c;
        advance();
      }

      addToken("STRING", value);

      continue;
    }

    //-----------------------------------
    // numbers
    //-----------------------------------

    if (isDigit(c)) {
      let value = "";

      while (i < source.length && (isDigit(source[i]) || source[i] === ".")) {
        value += source[i];
        advance();
      }

      addToken("NUMBER", value);

      continue;
    }

    //-----------------------------------
    // identifiers / keywords
    //-----------------------------------

    if (isAlpha(c) || c === "_") {
      let value = "";

      while (i < source.length && isAlphaNumeric(source[i])) {
        value += source[i];
        advance();
      }

      const upper = value.toUpperCase();

      if (upper === "TRUE" || upper === "FALSE") {
        addToken("BOOLEAN", upper);

        continue;
      }

      if (upper === "AND" || upper === "OR" || upper === "NOT") {
        addToken(upper as TokenType, upper);
        continue;
      }

      // REM comment
      if (upper === "REM") {
        while (i < source.length && source[i] !== "\n") advance();

        continue;
      }

      if (KEYWORDS.has(upper)) {
        addToken(upper as TokenType, upper);
      } else {
        addToken("ID", value);
      }

      continue;
    }

    //-----------------------------------
    // two-character operators
    //-----------------------------------

    const two = source.substring(i, i + 2);

    if (two in TWO_CHAR_OPERATORS) {
      addToken(TWO_CHAR_OPERATORS[two] as TokenType, two);

      advance(2);
      continue;
    }

    //-----------------------------------
    // one-character operators
    //-----------------------------------

    if (c in ONE_CHAR_OPERATORS) {
      addToken(ONE_CHAR_OPERATORS[c] as TokenType, c);

      advance();
      continue;
    }

    //-----------------------------------
    // punctuation
    //-----------------------------------

    if (c in PUNCTUATION) {
      addToken(PUNCTUATION[c] as TokenType, c);

      advance();
      continue;
    }

    errors.push({
      message: `Unexpected character '${c}'`,
      line: currentLine,
      column: currentColumn,
    });
    advance();
  }

  return { tokens, errors };
}
