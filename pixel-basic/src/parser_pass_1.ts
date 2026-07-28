import type { LexError, Token } from "./tokenizer";

export const Errors: LexError[] = [];
export type SymbolType =
  "VARIABLE" | "CONSTANT" | "SUB" | "ARRAY" | "DICTIONARY";

interface SymbolEntry {
  name: string;
  type: SymbolType;
  node_index: number;
  is_hoisted: boolean;
  arity?: number; // Optional property for function arity
}

export type Scope = {
  id: number;
  parent_id: number | null; // Points to the outer scope
  start_token: number; // The index of the 'THEN' token
  end_token: number; // The index of the 'END' token
  symbols: Map<string, SymbolEntry>;
};

export function pass_1_scope_analysis(tokens: Token[], scopes: Scope[]): void {
  const blocksToBeClosed: Token[] = [];
  let active_scope_id = 0;

  scopes.push({
    id: active_scope_id,
    parent_id: null,
    start_token: 0,
    end_token: 0,
    symbols: new Map<string, SymbolEntry>(),
  });

  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];

    // 1. Scope Opening
    if (
      token.type === "IF" ||
      token.type === "DO" ||
      token.type === "SUB" ||
      token.type === "WHILE"
    ) {
      const new_scope: Scope = {
        id: scopes.length,
        parent_id: active_scope_id,
        start_token: i,
        end_token: -1,
        symbols: new Map<string, SymbolEntry>(),
      };
      scopes.push(new_scope);
      active_scope_id = new_scope.id;
      blocksToBeClosed.push(token);
    }

    // 2. Subroutine Registration
    if (token.type === "SUB") {
      const child_scope = scopes[active_scope_id];
      // The function name belongs to the outer scope so it can be called
      const parent_scope =
        scopes[child_scope.parent_id !== null ? child_scope.parent_id : 0];
      const variable_name_token = tokens[i + 1];

      if (!variable_name_token) {
        Errors.push({
          message: "SUB statement must be followed by a variable name.",
          line: token.line,
          column: token.column,
        });
        continue;
      }

      if (variable_name_token.type !== "ID") {
        Errors.push({
          message: `SUB statement must be followed by a variable name, but found ${variable_name_token.type}.`,
          line: variable_name_token.line,
          column: variable_name_token.column,
        });
        continue;
      }

      let arity = 0;
      while (i + 1 < tokens.length && tokens[i + 1].type !== "THEN") {
        i++;
        token = tokens[i];

        if (token.type === "COMMA") continue;

        if (token.type !== "ID") {
          Errors.push({
            message: `SUB arguments must be an ID, but found ${token.type}`,
            line: token.line,
            column: token.column,
          });
          continue;
        }

        // Register the parameter as a local variable inside the function's CHILD scope
        child_scope.symbols.set(token.value, {
          name: token.value,
          type: "VARIABLE",
          node_index: i,
          is_hoisted: true,
        });

        arity++;
      }

      // Register the function name in the PARENT scope
      parent_scope.symbols.set(variable_name_token.value, {
        type: "SUB",
        arity: arity,
        node_index: i,
        is_hoisted: true,
        name: variable_name_token.value,
      });
    }

    // 3. Variable/Constant Registration
    if (token.type === "LET" || token.type === "CONST") {
      const current_scope = scopes[active_scope_id];
      const variable_name_token = tokens[i + 1];
      const token_after_declaration = tokens[i + 3];
      const third_token_after_declaration = tokens[i + 5];

      if (!variable_name_token) {
        Errors.push({
          message: `${token.type} statement must be followed by a variable name.`,
          line: token.line,
          column: token.column,
        });
        continue;
      }

      if (variable_name_token.type !== "ID") {
        Errors.push({
          message: `${token.type} statement must be followed by a variable name, but found ${variable_name_token.type}.`,
          line: variable_name_token.line,
          column: variable_name_token.column,
        });
        continue;
      }

      // Safe access using optional chaining
      if (
        token_after_declaration?.type === "LBRACKET" &&
        third_token_after_declaration?.type === "DECLARATION"
      ) {
        current_scope.symbols.set(variable_name_token.value, {
          name: variable_name_token.value,
          type: "DICTIONARY",
          node_index: i,
          is_hoisted: true,
        });
      } else if (token_after_declaration?.type === "LBRACKET") {
        current_scope.symbols.set(variable_name_token.value, {
          name: variable_name_token.value,
          type: "ARRAY",
          node_index: i,
          is_hoisted: true,
        });
      } else {
        current_scope.symbols.set(variable_name_token.value, {
          name: variable_name_token.value,
          type: token.type === "LET" ? "VARIABLE" : "CONSTANT",
          node_index: i,
          is_hoisted: true,
        });
      }
    }

    // 4. Scope Closure
    if (token.type === "END") {
      const current_scope = scopes[active_scope_id];
      const next_token = tokens[i + 1] || null;

      if (!next_token) {
        Errors.push({
          message: "Unexpected END without a matching opening statement.",
          line: token.line,
          column: token.column,
        });
        continue;
      }

      const opening_token = blocksToBeClosed.pop();
      if (next_token.type !== opening_token?.type) {
        Errors.push({
          message: `Mismatched END statement. Expected to close ${opening_token?.type}, but found ${next_token.type}.`,
          line: token.line,
          column: token.column,
        });
        continue;
      }

      current_scope.end_token = i;
      active_scope_id =
        current_scope.parent_id !== null ? current_scope.parent_id : 0;
      i++;
    }
  }
}
