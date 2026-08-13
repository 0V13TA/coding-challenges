import { Errors, type Scope } from "./parser_pass_1";
import type { Token, TokenType } from "./tokenizer";
import type {
  ASTNode,
  Program,
  IfStatement,
  Identifier,
  ArrayLiteral,
  DictionaryLiteral,
  WhileStatement,
  SubDeclaration,
  Assignment,
  FunctionCall,
  BreakStatement,
  ContinueStatement,
  ReturnStatement,
  SwitchStatement,
  VariableDeclaration,
} from "./ast_types";

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

function peek(state: ParserState, i: number = 0): Token {
  return (
    state.tokens[state.currentIndex + i] || {
      type: "EOF",
      value: "EOF",
      line: -1,
      column: -1,
    }
  );
}

function advance(state: ParserState): Token {
  const current_token = peek(state);
  if (state.currentIndex < state.tokens.length) {
    state.currentIndex++;
  }
  return current_token;
}

function expect(
  state: ParserState,
  type: TokenType[] | TokenType,
  error_msg: string,
): Token | null {
  const current_type = peek(state).type;
  const is_match = Array.isArray(type)
    ? type.includes(current_type)
    : type === current_type;

  if (is_match) {
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
  const { line, column } = token;
  switch (token.type) {
    case "NUMBER":
      return {
        type: "NumericLiteral",
        value: parseFloat(token.value),
        line,
        column,
      };
    case "STRING":
      return { type: "StringLiteral", value: token.value, line, column };
    case "BOOLEAN":
      return {
        type: "BooleanLiteral",
        value: token.value === "TRUE",
        line,
        column,
      };
    case "ID":
      return { type: "Identifier", name: token.value, line, column };
    case "MINUS":
    case "NOT":
    case "BITWISE":
      return {
        type: "UnaryExpression",
        operator: token.value,
        argument: parse_expression(state, BP.UNARY),
        line,
        column,
      };
    case "LPAREN":
      const expr = parse_expression(state, BP.DEFAULT);
      expect(state, "RPAREN", "Expected closing ')' after expression.");
      return expr;
    case "LBRACKET":
      return parse_array_and_dict(state, token);
    default:
      Errors.push({
        message: `Unexpected token in expression: ${token.value}`,
        line: token.line,
        column: token.column,
      });
      return { type: "NumericLiteral", value: 0, line, column };
  }
}

function led(state: ParserState, token: Token, left: ASTNode): ASTNode {
  const { line, column } = token;
  switch (token.type) {
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
        right: parse_expression(state, get_bp(token.type)),
        line,
        column,
      };
    case "LPAREN":
      const args: ASTNode[] = [];
      if (peek(state).type !== "RPAREN") {
        do {
          args.push(parse_expression(state, BP.DEFAULT));
        } while (peek(state).type === "COMMA" && advance(state));
      }
      expect(state, "RPAREN", "Expected ')' after function arguments.");
      return {
        type: "FunctionCall",
        caller: (left as Identifier).name,
        args,
        line,
        column,
      };
    case "LBRACKET":
      const index = parse_expression(state, BP.DEFAULT);
      expect(state, "RBRACKET", "Expected ']' after index.");
      return {
        type: "IndexExpression",
        object: left,
        index: index,
        line,
        column,
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
    active_scope_id: 0,
  };

  const body: ASTNode[] = [];

  while (state.currentIndex < state.tokens.length) {
    if (peek(state).type === "NEWLINE") {
      advance(state);
      continue;
    }

    const statement = parse_statement(state);
    if (statement) {
      body.push(statement);
    } else {
      advance(state);
    }
  }

  return { type: "Program", body, line: 1, column: 1 };
}

export function parse_expression(
  state: ParserState,
  current_bp: number,
): ASTNode {
  let token = advance(state);
  let left = nud(state, token);

  while (state.currentIndex < state.tokens.length) {
    const next_token = peek(state);
    const next_bp = get_bp(next_token.type);

    if (current_bp >= next_bp) {
      break;
    }

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
    case "SWITCH":
      return parse_switch(state);
    case "BREAK":
      return parse_break(state);
    case "CONTINUE":
      return parse_continue(state);
    case "RETURN":
      return parse_return(state);
    case "ID":
      return parse_assignment_or_call(state);
    default:
      Errors.push({
        message: `Unexpected token '${token.value}' at start of statement.`,
        line: token.line,
        column: token.column,
      });
      advance(state);
      return null;
  }
}

function parse_declaration(state: ParserState): VariableDeclaration | null {
  const keyword = advance(state);
  const is_constant = keyword.type === "CONST";
  const id_token = expect(
    state,
    "ID",
    "Expected variable name after declaration.",
  );
  if (!id_token) return null;

  const assign_token = expect(
    state,
    "DECLARATION",
    "Expected '=' after variable name.",
  );
  if (!assign_token) return null;

  const expression_value = parse_expression(state, 0);

  return {
    type: "VariableDeclaration",
    is_constant,
    target: id_token.value,
    value: expression_value,
    line: keyword.line,
    column: keyword.column,
  };
}

function parse_array_and_dict(
  state: ParserState,
  open_token: Token,
): ArrayLiteral | DictionaryLiteral {
  let is_dictionary = false;
  let lookahead_index = 0;

  while (peek(state, lookahead_index).type === "NEWLINE") {
    lookahead_index++;
  }

  if (
    peek(state, lookahead_index).type === "ID" &&
    peek(state, lookahead_index + 1).type === "DECLARATION"
  ) {
    is_dictionary = true;
  }

  if (is_dictionary) {
    const properties: { key: string; value: ASTNode }[] = [];
    while (
      state.currentIndex < state.tokens.length &&
      peek(state).type !== "RBRACKET"
    ) {
      if (peek(state).type === "NEWLINE" || peek(state).type === "COMMA") {
        advance(state);
        continue;
      }
      const key_token = expect(
        state,
        "ID",
        "Expected an 'ID' for key in Dictionary",
      );
      if (!key_token) break;

      expect(state, "DECLARATION", "Expected '=' after dictionary key.");
      const value = parse_expression(state, BP.DEFAULT);

      if (properties.some((p) => p.key === key_token.value)) {
        Errors.push({
          message: `Key '${key_token.value}' already exists in dictionary.`,
          line: key_token.line,
          column: key_token.column,
        });
      } else {
        properties.push({ key: key_token.value, value });
      }
    }
    expect(state, "RBRACKET", "Expected ']' to close dictionary.");
    return {
      type: "DictionaryLiteral",
      properties,
      line: open_token.line,
      column: open_token.column,
    };
  } else {
    const elements: ASTNode[] = [];
    while (
      state.currentIndex < state.tokens.length &&
      peek(state).type !== "RBRACKET"
    ) {
      if (peek(state).type === "NEWLINE" || peek(state).type === "COMMA") {
        advance(state);
        continue;
      }
      elements.push(parse_expression(state, BP.DEFAULT));
    }
    expect(state, "RBRACKET", "Expected ']' to close array.");
    return {
      type: "ArrayLiteral",
      elements,
      line: open_token.line,
      column: open_token.column,
    };
  }
}

function parse_while(state: ParserState): WhileStatement | null {
  const startToken = advance(state); // Consume 'WHILE'
  const condition = parse_expression(state, 0);

  if (!expect(state, "THEN", "Expected 'THEN' after WHILE condition."))
    return null;

  const body: ASTNode[] = [];

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

  if (!expect(state, "END", "Expected 'END' to close WHILE block."))
    return null;
  if (!expect(state, "WHILE", "Expected 'WHILE' after END.")) return null;

  return {
    type: "WhileStatement",
    condition,
    body,
    line: startToken.line,
    column: startToken.column,
  };
}

function parse_if(state: ParserState): IfStatement | null {
  const startToken = advance(state); // Consume 'IF'
  const condition = parse_expression(state, 0);

  if (!expect(state, "THEN", "Expected 'THEN' after IF condition."))
    return null;

  const body: ASTNode[] = [];
  let alternate: ASTNode[] | IfStatement | undefined = undefined;

  if (peek(state).type !== "NEWLINE") {
    const stmt = parse_statement(state);
    if (stmt) body.push(stmt);
    return {
      type: "IfStatement",
      condition,
      body,
      alternate,
      line: startToken.line,
      column: startToken.column,
    };
  }

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

  if (peek(state).type === "ELSE") {
    advance(state); // Consume 'ELSE'
    if (peek(state).type === "IF") {
      const nested_if = parse_if(state);
      if (nested_if && nested_if.type === "IfStatement") {
        alternate = nested_if;
      }
    } else {
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

  if (peek(state).type === "END") {
    advance(state); // Consume 'END'
    expect(state, "IF", "Expected 'IF' after END.");
  }

  return {
    type: "IfStatement",
    condition,
    body,
    alternate,
    line: startToken.line,
    column: startToken.column,
  };
}

function parse_subroutine(state: ParserState): SubDeclaration | null {
  const startToken = advance(state); // Consume 'SUB'

  const name_token = expect(state, "ID", "Expected subroutine name.");
  if (!name_token) return null;

  const parameters: string[] = [];

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
    line: startToken.line,
    column: startToken.column,
  };
}

function parse_assignment_or_call(
  state: ParserState,
): Assignment | FunctionCall | null {
  const startToken = peek(state);

  let is_assignment = false;
  let lookahead = 1;
  let next_tok = peek(state, lookahead);

  // Fast forward to see if an assignment operator or array indexing follows the ID
  if (next_tok.type === "LBRACKET") {
    is_assignment = true;
  } else if (
    next_tok.type === "DECLARATION" ||
    next_tok.type === "ADD_DECLARE" ||
    next_tok.type === "SUB_DECLARE" ||
    next_tok.type === "DIV_DECLARE" ||
    next_tok.type === "MULT_DECLARE" ||
    next_tok.type === "MOD_DECLARE"
  ) {
    is_assignment = true;
  }

  // 1. Route to Assignment Parsing
  if (is_assignment) {
    const target = parse_expression(state, BP.ASSIGN);
    const operator = advance(state); // Consume the assignment operator
    const value = parse_expression(state, 0);
    return {
      type: "Assignment",
      operator: operator.value,
      target,
      value,
      line: startToken.line,
      column: startToken.column,
    };
  }

  // 2. Route to Function Call Parsing
  const caller_token = advance(state); // Consume the ID
  const args: ASTNode[] = [];

  // Handle optional parentheses (e.g. DRAW_RECT(-25) or DRAW_RECT -25)
  if (peek(state).type === "LPAREN") {
    advance(state); // consume '('
    if (peek(state).type !== "RPAREN") {
      do {
        args.push(parse_expression(state, 0));
      } while (peek(state).type === "COMMA" && advance(state));
    }
    expect(state, "RPAREN", "Expected ')' after function arguments.");
  } else {
    // Parse space-separated arguments seamlessly
    while (
      state.currentIndex < state.tokens.length &&
      peek(state).type !== "NEWLINE" &&
      peek(state).type !== "END"
    ) {
      args.push(parse_expression(state, 0));
      if (peek(state).type === "COMMA") advance(state);
    }
  }

  return {
    type: "FunctionCall",
    caller: caller_token.value,
    args,
    line: startToken.line,
    column: startToken.column,
  };
}
function parse_break(state: ParserState): BreakStatement | null {
  const t = advance(state);
  return { type: "BreakStatement", line: t.line, column: t.column };
}

function parse_continue(state: ParserState): ContinueStatement | null {
  const t = advance(state);
  return { type: "ContinueStatement", line: t.line, column: t.column };
}

function parse_return(state: ParserState): ReturnStatement | null {
  const t = advance(state);
  let argument: ASTNode | undefined = undefined;

  if (peek(state).type !== "NEWLINE" && peek(state).type !== "END") {
    argument = parse_expression(state, 0);
  }

  return { type: "ReturnStatement", argument, line: t.line, column: t.column };
}

function parse_switch(state: ParserState): SwitchStatement | null {
  const startToken = advance(state); // Consume 'SWITCH'
  const discriminant = parse_expression(state, 0);

  if (!expect(state, "THEN", "Expected 'THEN' after SWITCH condition."))
    return null;

  const cases: { value: ASTNode; body: ASTNode[] }[] = [];
  let default_case: ASTNode[] | undefined = undefined;

  while (
    state.currentIndex < state.tokens.length &&
    peek(state).type !== "END"
  ) {
    if (peek(state).type === "NEWLINE") {
      advance(state);
      continue;
    }

    if (peek(state).type === "CASE") {
      advance(state);
      const value = parse_expression(state, 0);
      expect(state, "THEN", "Expected 'THEN' after CASE value.");

      const body: ASTNode[] = [];
      while (
        peek(state).type !== "END" &&
        peek(state).type !== "CASE" &&
        peek(state).type !== "DEFAULT"
      ) {
        if (peek(state).type === "NEWLINE") {
          advance(state);
          continue;
        }
        const stmt = parse_statement(state);
        if (stmt) body.push(stmt);
      }
      expect(state, "END", "Expected 'END' to close CASE block.");
      expect(state, "CASE", "Expected 'CASE' after END.");

      cases.push({ value, body });
    } else if (peek(state).type === "DEFAULT") {
      advance(state);
      expect(state, "THEN", "Expected 'THEN' after DEFAULT.");

      const body: ASTNode[] = [];
      while (peek(state).type !== "END") {
        if (peek(state).type === "NEWLINE") {
          advance(state);
          continue;
        }
        const stmt = parse_statement(state);
        if (stmt) body.push(stmt);
      }
      expect(state, "END", "Expected 'END' to close DEFAULT block.");
      expect(state, "DEFAULT", "Expected 'DEFAULT' after END.");

      default_case = body;
    } else {
      Errors.push({
        message: `Unexpected token '${peek(state).value}' inside SWITCH block.`,
        line: peek(state).line,
        column: peek(state).column,
      });
      advance(state);
    }
  }

  expect(state, "END", "Expected 'END' to close SWITCH block.");
  expect(state, "SWITCH", "Expected 'SWITCH' after END.");

  return {
    type: "SwitchStatement",
    discriminant,
    cases,
    default_case,
    line: startToken.line,
    column: startToken.column,
  };
}
