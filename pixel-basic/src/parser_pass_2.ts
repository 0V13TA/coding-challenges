import { Errors, type Scope } from "./parser_pass_1";
import type { Token } from "./tokenizer";
import type { ASTNode, Program, IfStatement, Identifier } from "./ast_types";

type ParserState = {
  tokens: Token[];
  scopes: Scope[];
  currentIndex: number;
  active_scope_id: number;
};

const BP = {
  DEFAULT: 0,
  COMMA: 10,
  ASSIGN: 20,
  LOGICAL: 30, // AND, OR
  COMPARISON: 40, // <, >, ==
  TERM: 50, // +, -
  FACTOR: 60, // *, /, %
  UNARY: 70, // -x, NOT x
  CALL: 80, // Function calls (), Array indexing []
  PRIMARY: 90,
};

function get_bp(type: string): number {
  switch (type) {
    case "PLUS":
    case "MINUS":
      return BP.TERM;
    case "MULTIPLY":
    case "DIVIDE":
    case "MODULO":
      return BP.FACTOR;
    case "EQUALTO":
    case "NOTEQUALTO":
    case "LTHAN":
    case "GTHAN":
    case "LTEQUAL":
    case "GTEQUAL":
      return BP.COMPARISON;
    case "AND":
    case "OR":
      return BP.LOGICAL;
    case "LPAREN":
    case "LBRACKET":
      return BP.CALL;
    default:
      return BP.DEFAULT;
  }
}

// Helper to grab the current token
function peek(state: ParserState): Token {
  return state.tokens[state.currentIndex];
}

// Helper to grab the current token and advance the pointer
function advance(state: ParserState): Token {
  const current_token = state.tokens[state.currentIndex];
  state.currentIndex++;
  return current_token;
}

// Helper to assert that the next token is what we expect (e.g., matching THEN after an IF)
function expect(
  state: ParserState,
  type: string,
  error_msg: string,
): Token | null {
  if (peek(state).type === type) {
    return advance(state);
  }

  Errors.push({
    message: error_msg,
    line: peek(state).line,
    column: peek(state).column,
  });
  return null;
}

function nud(state: ParserState, token: Token): ASTNode {
  switch (token.type) {
    case "NUMBER":
      return { type: "NumericLiteral", value: parseFloat(token.value) };
    case "STRING":
      return { type: "StringLiteral", value: token.value };
    case "BOOLEAN":
      return { type: "BooleanLiteral", value: token.value === "TRUE" };
    case "ID":
      return { type: "Identifier", name: token.value };

    // Unary operators like `-5` or `NOT TRUE`
    case "MINUS":
    case "NOT":
      return {
        type: "UnaryExpression",
        operator: token.value,
        argument: parse_expression(state, BP.UNARY),
      };

    // Grouping: `(5 + 5)`
    case "LPAREN":
      const expr = parse_expression(state, BP.DEFAULT);
      expect(state, "RPAREN", "Expected closing ')' after expression.");
      return expr;

    default:
      Errors.push({
        message: `Unexpected token in expression: ${token.value}`,
        line: token.line,
        column: token.column,
      });
      // Return a dummy node so the parser doesn't crash during error recovery
      return { type: "NumericLiteral", value: 0 };
  }
}

function led(state: ParserState, token: Token, left: ASTNode): ASTNode {
  switch (token.type) {
    // --- Binary Math & Logic ---
    case "PLUS":
    case "MINUS":
    case "MULTIPLY":
    case "DIVIDE":
    case "MODULO":
    case "EQUALTO":
    case "NOTEQUALTO":
    case "LTHAN":
    case "GTHAN":
    case "LTEQUAL":
    case "GTEQUAL":
    case "AND":
    case "OR":
      return {
        type: "BinaryExpression",
        operator: token.value,
        left: left,
        // Notice we pass the binding power of the CURRENT operator into the right side
        right: parse_expression(state, get_bp(token.type)),
      };

    // --- Function Calls ---
    case "LPAREN":
      const args: ASTNode[] = [];
      // If the next token isn't a closing paren, we have arguments to parse
      if (peek(state).type !== "RPAREN") {
        do {
          args.push(parse_expression(state, BP.DEFAULT));
        } while (peek(state).type === "COMMA" && advance(state)); // Consume commas
      }
      expect(state, "RPAREN", "Expected ')' after function arguments.");

      return {
        type: "FunctionCall",
        caller: (left as Identifier).name,
        args,
      };

    // --- Array/Dictionary Indexing ---
    case "LBRACKET":
      const index = parse_expression(state, BP.DEFAULT);
      expect(state, "RBRACKET", "Expected ']' after index.");

      return {
        type: "IndexExpression",
        object: left,
        index: index,
      };

    default:
      return left;
  }
}

export function parse_program(tokens: Token[], scopes: Scope[]): Program {
  const state: ParserState = {
    tokens,
    currentIndex: 0,
    scopes,
    active_scope_id: 0, // Starts at global scope
  };

  const body: ASTNode[] = [];

  while (state.currentIndex < state.tokens.length) {
    // Skip stray newlines between statements
    if (peek(state).type === "NEWLINE") {
      advance(state);
      continue;
    }

    const statement = parse_statement(state);
    if (statement) {
      body.push(statement);
    } else {
      // If parse_statement returns null (error recovery), just advance to prevent infinite loop
      advance(state);
    }
  }

  return { type: "Program", body };
}

export function parse_expression(
  state: ParserState,
  current_bp: number,
): ASTNode {
  // 1. Grab the very first token and parse it as a prefix (Null Denotation)
  let token = advance(state);
  let left = nud(state, token);

  // 2. Keep looping as long as the NEXT token's binding power is higher
  //    than the binding power of the expression we are currently evaluating.
  while (state.currentIndex < state.tokens.length) {
    const next_token = peek(state);
    const next_bp = get_bp(next_token.type);

    if (current_bp >= next_bp) {
      break;
    }

    // 3. The next operator binds tighter! Consume it and parse it as an infix (Left Denotation)
    token = advance(state);
    left = led(state, token, left);
  }

  return left;
}

function parse_statement(state: ParserState): ASTNode | null {
  const token = peek(state);

  switch (token.type) {
    case "LET":
    case "CONST":
      return parse_declaration(state);
    case "WHILE":
      return parse_while(state);
    case "IF":
      return parse_if(state);
    case "SUB":
      return parse_subroutine(state);
    case "ID":
      // If it's an ID, it's either a function call or an assignment (like `accumulator +=`)
      return parse_assignment_or_call(state);
    default:
      Errors.push({
        message: `Unexpected token '${token.value}' at start of statement.`,
        line: token.line,
        column: token.column,
      });
      return null;
  }
}

function parse_declaration(state: ParserState): ASTNode | null {
  // 1. Consume the LET or CONST keyword
  const keyword = advance(state);
  const is_constant = keyword.type === "CONST";

  // 2. Expect an identifier
  const id_token = expect(
    state,
    "ID",
    "Expected variable name after declaration.",
  );
  if (!id_token) return null;

  // 3. Expect an equals sign
  const assign_token = expect(
    state,
    "DECLARATION",
    "Expected '=' after variable name.",
  );
  if (!assign_token) return null;

  // 4. HANDOFF TO PRATT PARSER: Parse whatever comes after the '='
  // (We will build parse_expression next)
  const expression_value = parse_expression(state, 0);

  // 5. Build and return the complete AST node
  return {
    type: "VariableDeclaration",
    is_constant,
    target: id_token.value,
    value: expression_value,
  };
}

function parse_while(state: ParserState): ASTNode | null {
  advance(state); // Consume 'WHILE'

  // Parse the condition expression (e.g., accumulator < 20)
  const condition = parse_expression(state, 0);

  if (!expect(state, "THEN", "Expected 'THEN' after WHILE condition."))
    return null;

  const body: ASTNode[] = [];

  // Consume statements until we hit an END token
  while (
    state.currentIndex < state.tokens.length &&
    peek(state).type !== "END"
  ) {
    if (peek(state).type === "NEWLINE") {
      advance(state);
      continue;
    }
    const stmt = parse_statement(state);
    if (stmt) body.push(stmt);
  }

  // Ensure we found the END keyword and that it's followed by WHILE
  if (!expect(state, "END", "Expected 'END' to close WHILE block."))
    return null;
  if (!expect(state, "WHILE", "Expected 'WHILE' after END.")) return null;

  return {
    type: "WhileStatement",
    condition,
    body,
  };
}

function parse_if(state: ParserState): ASTNode | null {
  advance(state); // Consume 'IF'

  const condition = parse_expression(state, 0);

  if (!expect(state, "THEN", "Expected 'THEN' after IF condition."))
    return null;

  const body: ASTNode[] = [];
  let alternate: ASTNode[] | IfStatement | undefined = undefined;

  // Consume the main body
  while (
    state.currentIndex < state.tokens.length &&
    peek(state).type !== "ELSE" &&
    peek(state).type !== "END"
  ) {
    if (peek(state).type === "NEWLINE") {
      advance(state);
      continue;
    }
    const stmt = parse_statement(state);
    if (stmt) body.push(stmt);
  }

  // Check for an ELSE or ELSE IF block
  if (peek(state).type === "ELSE") {
    advance(state); // Consume 'ELSE'

    if (peek(state).type === "IF") {
      // Recursively parse the 'ELSE IF' branch
      const nested_if = parse_if(state);
      if (nested_if && nested_if.type === "IfStatement") {
        alternate = nested_if;
      }
    } else {
      // Parse a standard 'ELSE' body
      const elseBody: ASTNode[] = [];
      while (
        state.currentIndex < state.tokens.length &&
        peek(state).type !== "END"
      ) {
        if (peek(state).type === "NEWLINE") {
          advance(state);
          continue;
        }
        const stmt = parse_statement(state);
        if (stmt) elseBody.push(stmt);
      }
      alternate = elseBody;
    }
  }

  // If this was the top-level IF (not an internal ELSE IF), we expect an END IF
  // We only consume END IF if the current token is END, because a nested parse_if
  // might have already consumed it.
  if (peek(state).type === "END") {
    advance(state); // Consume 'END'
    expect(state, "IF", "Expected 'IF' after END.");
  }

  return {
    type: "IfStatement",
    condition,
    body,
    alternate,
  };
}

function parse_subroutine(state: ParserState): ASTNode | null {
  advance(state); // Consume 'SUB'

  const name_token = expect(state, "ID", "Expected subroutine name.");
  if (!name_token) return null;

  const parameters: string[] = [];

  // Parse arguments until we hit THEN
  while (peek(state).type !== "THEN") {
    if (peek(state).type === "COMMA") {
      advance(state);
      continue;
    }
    const param_token = expect(state, "ID", "Expected parameter name.");
    if (param_token) parameters.push(param_token.value);
  }

  expect(state, "THEN", "Expected 'THEN' after SUB arguments.");

  const body: ASTNode[] = [];

  // Parse the function body
  while (
    state.currentIndex < state.tokens.length &&
    peek(state).type !== "END"
  ) {
    if (peek(state).type === "NEWLINE") {
      advance(state);
      continue;
    }
    const stmt = parse_statement(state);
    if (stmt) body.push(stmt);
  }

  expect(state, "END", "Expected 'END' to close SUB block.");
  expect(state, "SUB", "Expected 'SUB' after END.");

  return {
    type: "SubDeclaration",
    name: name_token.value,
    parameters,
    body,
  };
}

function parse_assignment_or_call(state: ParserState): ASTNode | null {
  // We use the Pratt parser to resolve the left side.
  // It will return an Identifier or an IndexExpression (e.g., array[0])
  const target = parse_expression(state, BP.ASSIGN);

  const next_token = peek(state);

  // If the expression is followed by an assignment operator, it's an Assignment
  if (
    next_token.type === "DECLARATION" ||
    next_token.type === "ADD_DECLARE" ||
    next_token.type === "SUB_DECLARE"
    // Add other assignment operators here...
  ) {
    const operator = advance(state); // Consume the assignment operator
    const value = parse_expression(state, 0);

    return {
      type: "Assignment",
      operator: operator.value,
      target,
      value,
    };
  }

  // If it wasn't an assignment, and the expression was a FunctionCall node
  // generated by the Pratt parser, then it's a standalone function execution.
  if (target.type === "FunctionCall") {
    return target; // We just return the Pratt node directly
  }

  // If it's a standalone ID without parens (e.g., `nice_function "hello"`),
  // we need to construct a FunctionCall manually.
  if (target.type === "Identifier") {
    const args: ASTNode[] = [];

    // Parse arguments until we hit a newline or another statement boundary
    while (
      state.currentIndex < state.tokens.length &&
      peek(state).type !== "NEWLINE" &&
      peek(state).type !== "END"
    ) {
      args.push(parse_expression(state, 0));
      if (peek(state).type === "COMMA") advance(state);
    }

    return {
      type: "FunctionCall",
      caller: target.name,
      args,
    };
  }

  Errors.push({
    message:
      "Invalid statement structure. Expected assignment or function call.",
    line: peek(state).line,
    column: peek(state).column,
  });
  return null;
}
