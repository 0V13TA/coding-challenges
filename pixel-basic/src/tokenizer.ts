const KEYWORDS = [
  "LET",
  "REM",
  "CONST",

  //
  "DO",
  "IF",
  "END",
  "SUB",
  "THEN",
  "ELSE",
  "WHILE",

  //
  "CASE",
  "SWITCH",
  "DEFAULT",

  //
  "BREAK",
  "RETURN",
  "CONTINUE",

  //
  "SCREEN",
];

const OPERATORS = [
  "PLUS",
  "MINUS",
  "DIVIDE",
  "MODULO",
  "MULTIPLY",

  //
  "LTHAN",
  "GTHAN",
  "GTEQUAL",
  "EQUALTO",
  "LTEQUAL",
  "NOTEQUALTO",

  //
  "DECLARATION",
  "ADD_DECLARE",
  "SUB_DECLARE",
  "MULT_DECLARE",
  "DIV_DECLARE",
  "MOD_DECLARE",

  //
  "BITWISE",
  "LOGICAL",
];

const PUNCTUATIONS = ["LBRACKET", "RBRACKET", "LPAREN", "RPAREN", "COMMA"];
const LITERALS = ["BOOLEAN", "ID", "STRING", "NUMBER"];

export const TOKENS = [...LITERALS, ...KEYWORDS, ...OPERATORS, ...PUNCTUATIONS];

function isValidID(id: string) {}

export function tokenize(sourceCode: string) {
  let lexeme = "";
  let tokens = [];
  for (let i = 0; i < sourceCode.length; i++) {
    const char = sourceCode[i];
    if (char.trim()) lexeme += char;

    // TODO: Change this, so that proper checking
    // for matching quotes are guaranteed
    if (
      !char.trim() &&
      !(lexeme.startsWith('"') || lexeme.endsWith('"')) &&
      (lexeme.startsWith("'") || lexeme.startsWith('"'))
    )
      continue;

    if (!char.trim()) {
      if (!lexeme.trim()) continue;
      const keywordIndex = KEYWORDS.indexOf(lexeme);
      if (keywordIndex > 0) {
        tokens.push(lexeme);
        lexeme = "";
        continue;
      }

      if (lexeme === "TRUE" || lexeme === "FALSE") {
        tokens.push(`BOOLEAN ${lexeme}`);
        lexeme = "";
        continue;
      }

      if (!isNaN(parseInt(lexeme))) {
        tokens.push(`NUMBER ${lexeme}`);
        lexeme = "";
        continue;
      }

      if (
        (lexeme.startsWith("'") && lexeme.endsWith("'")) ||
        (lexeme.startsWith('"') && lexeme.endsWith('"'))
      ) {
        tokens.push(`STRING ${lexeme.slice(1, lexeme.length - 1)}`);
        lexeme = "";
        continue;
      }

      lexeme = "";
    }
  }

  return tokens;
}
