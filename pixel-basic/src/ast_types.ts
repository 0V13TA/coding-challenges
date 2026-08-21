// --- Literals (The raw data) ---
export type NumericLiteral = {
  type: "NumericLiteral";
  value: number;
  line: number;
  column: number;
};
export type StringLiteral = {
  type: "StringLiteral";
  value: string;
  line: number;
  column: number;
};
export type BooleanLiteral = {
  type: "BooleanLiteral";
  value: boolean;
  line: number;
  column: number;
};
export type Identifier = {
  type: "Identifier";
  name: string;
  line: number;
  column: number;
};

// --- Data Structures ---
export type ArrayLiteral = {
  type: "ArrayLiteral";
  elements: ASTNode[];
  line: number;
  column: number;
};
export type DictionaryLiteral = {
  type: "DictionaryLiteral";
  properties: { key: string; value: ASTNode }[];
  line: number;
  column: number;
};

// --- Operations & Access ---
export type UnaryExpression = {
  type: "UnaryExpression";
  operator: string;
  argument: ASTNode;
  line: number;
  column: number;
};
export type BinaryExpression = {
  type: "BinaryExpression";
  operator: string;
  left: ASTNode;
  right: ASTNode;
  line: number;
  column: number;
};
export type IndexExpression = {
  type: "IndexExpression";
  object: ASTNode;
  index: ASTNode;
  line: number;
  column: number;
};
export type FunctionCall = {
  type: "FunctionCall";
  caller: string;
  args: ASTNode[];
  line: number;
  column: number;
};

// --- Variables & Memory ---
export type VariableDeclaration = {
  type: "VariableDeclaration";
  is_constant: boolean;
  is_export: boolean;
  target: string;
  value: ASTNode;
  line: number;
  column: number;
};
export type Assignment = {
  type: "Assignment";
  operator: string;
  target: ASTNode;
  value: ASTNode;
  line: number;
  column: number;
};

// --- Control Flow ---
export type IfStatement = {
  type: "IfStatement";
  condition: ASTNode;
  body: ASTNode[];
  alternate?: ASTNode[] | IfStatement;
  line: number;
  column: number;
};
export type WhileStatement = {
  type: "WhileStatement";
  condition: ASTNode;
  body: ASTNode[];
  line: number;
  column: number;
};
export type SwitchStatement = {
  type: "SwitchStatement";
  discriminant: ASTNode;
  cases: { value: ASTNode; body: ASTNode[] }[];
  default_case?: ASTNode[];
  line: number;
  column: number;
};
export type BreakStatement = {
  type: "BreakStatement";
  line: number;
  column: number;
};
export type ContinueStatement = {
  type: "ContinueStatement";
  line: number;
  column: number;
};
export type ReturnStatement = {
  type: "ReturnStatement";
  argument?: ASTNode;
  line: number;
  column: number;
};

// --- Functions & Subroutines ---
export type SubDeclaration = {
  type: "SubDeclaration";
  name: string;
  parameters: string[];
  body: ASTNode[];
  is_export: boolean;
  line: number;
  column: number;
};

export type ImportStatement = {
  type: "ImportStatement";
  symbols: string[];
  source: string;
  line: number;
  column: number;
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
  | ImportStatement
  | Program;

export type Program = {
  type: "Program";
  body: ASTNode[];
  line: number;
  column: number;
};
