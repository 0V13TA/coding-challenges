// --- Literals (The raw data) ---
export type NumericLiteral = { type: "NumericLiteral"; value: number };
export type StringLiteral = { type: "StringLiteral"; value: string };
export type BooleanLiteral = { type: "BooleanLiteral"; value: boolean };
export type Identifier = { type: "Identifier"; name: string };

// --- Data Structures ---
export type ArrayLiteral = {
  type: "ArrayLiteral";
  elements: ASTNode[];
};
export type DictionaryLiteral = {
  type: "DictionaryLiteral";
  // Stores key-value pairs (e.g., fly = "To move above groud")
  properties: { key: string; value: ASTNode }[];
};

// --- Operations & Access ---
export type UnaryExpression = {
  type: "UnaryExpression";
  operator: string; // e.g., "-", "NOT", "~"
  argument: ASTNode;
};

export type BinaryExpression = {
  type: "BinaryExpression";
  operator: string; // e.g., "+", "<", "==", "AND"
  left: ASTNode;
  right: ASTNode;
};

export type IndexExpression = {
  type: "IndexExpression";
  object: ASTNode; // The array or dictionary (e.g., `scores`)
  index: ASTNode; // The lookup value (e.g., `0` or `i`)
};

export type FunctionCall = {
  type: "FunctionCall";
  caller: string;
  args: ASTNode[];
};

// --- Variables & Memory ---
export type VariableDeclaration = {
  type: "VariableDeclaration";
  is_constant: boolean; // True if CONST, False if LET
  target: string;
  value: ASTNode;
};

export type Assignment = {
  type: "Assignment";
  operator: string; // "=", "+=", "-=", etc.
  target: ASTNode; // Could be an Identifier or an IndexExpression (e.g., scores[0] = 50)
  value: ASTNode;
};

// --- Control Flow ---
export type IfStatement = {
  type: "IfStatement";
  condition: ASTNode;
  body: ASTNode[];
  alternate?: ASTNode[] | IfStatement; // Handles ELSE and ELSE IF
};

export type WhileStatement = {
  type: "WhileStatement";
  condition: ASTNode;
  body: ASTNode[];
};

export type SwitchStatement = {
  type: "SwitchStatement";
  discriminant: ASTNode;
  cases: { value: ASTNode; body: ASTNode[] }[];
  default_case?: ASTNode[];
};

export type BreakStatement = { type: "BreakStatement" };
export type ContinueStatement = { type: "ContinueStatement" };
export type ReturnStatement = { type: "ReturnStatement"; argument?: ASTNode };

// --- Functions & Subroutines ---
export type SubDeclaration = {
  type: "SubDeclaration";
  name: string;
  parameters: string[];
  body: ASTNode[];
};

export type ASTNode =
  | NumericLiteral
  | StringLiteral
  | BooleanLiteral
  | Identifier
  | ArrayLiteral
  | DictionaryLiteral
  | UnaryExpression
  | BinaryExpression
  | IndexExpression
  | FunctionCall
  | VariableDeclaration
  | Assignment
  | IfStatement
  | WhileStatement
  | SwitchStatement
  | BreakStatement
  | ContinueStatement
  | ReturnStatement
  | SubDeclaration
  | Program;

export type Program = {
  type: "Program";
  body: ASTNode[];
};
