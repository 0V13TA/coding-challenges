import type { Callable } from "./runtime";
import type { LexError, Token } from "./tokenizer";

export const Errors: LexError[] = [];
export type SymbolType =
  "VARIABLE" | "CONSTANT" | "SUB" | "NATIVE_SUB" | "ARRAY" | "DICTIONARY";

export interface SymbolEntry {
  name: string;
  type: SymbolType;
  node_index: number;
  is_hoisted: boolean;
  arity?: number; // Optional property for function arity
  native_fn?: (...args: any[]) => any; // Optional property for native function reference
}

export type Scope = {
  id: number;
  parent_id: number | null; // Points to the outer scope
  start_token: number; // The index of the 'THEN' token
  end_token: number; // The index of the 'END' token
  symbols: Map<string, SymbolEntry>;
};

export function define_builtin_functions(
  ctx: CanvasRenderingContext2D,
  keys_down: Set<string>,
): Map<string, Callable> {
  const global_symbols = new Map<string, Callable>();

  // --- Rendering State Machine ---
  const buffers = new Map<
    number,
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  >();
  buffers.set(0, ctx); // 0 is always the main presentation screen

  let next_buffer_id = 1;
  let active_buffer_id = 0;

  let do_fill = true;
  let do_stroke = false;

  // Helper to resolve the active target context
  const get_ctx = () => {
    const active = buffers.get(active_buffer_id);
    if (!active)
      throw new Error(`Buffer ID ${active_buffer_id} does not exist.`);
    return active;
  };

  // ==========================================
  // Buffer Management API
  // ==========================================

  global_symbols.set("CREATE_BUFFER", {
    arity: 2,
    is_native: true,
    native_fn: (w: number, h: number) => {
      const offscreen = new OffscreenCanvas(w, h);
      const off_ctx = offscreen.getContext("2d");
      if (!off_ctx) return -1;
      const id = next_buffer_id++;
      buffers.set(id, off_ctx as OffscreenCanvasRenderingContext2D);
      return id;
    },
  });

  global_symbols.set("BIND_BUFFER", {
    arity: 1,
    is_native: true,
    native_fn: (id: number) => {
      if (buffers.has(id)) active_buffer_id = id;
    },
  });

  global_symbols.set("DRAW_BUFFER", {
    arity: 5,
    is_native: true,
    native_fn: (id: number, x: number, y: number, w: number, h: number) => {
      const source_ctx = buffers.get(id);
      if (source_ctx && source_ctx.canvas) {
        get_ctx().drawImage(source_ctx.canvas, x, y, w, h);
      }
    },
  });

  global_symbols.set("FREE_BUFFER", {
    arity: 1,
    is_native: true,
    native_fn: (id: number) => {
      if (id !== 0) {
        buffers.delete(id);
        if (active_buffer_id === id) active_buffer_id = 0; // Fallback to main screen
      }
    },
  });

  // ==========================================
  // 2D Graphics API (State & Primitives)
  // ==========================================

  global_symbols.set("FILL_COLOR", {
    arity: 3,
    is_native: true,
    native_fn: (r: number, g: number, b: number) => {
      get_ctx().fillStyle = `rgb(${r}, ${g}, ${b})`;
      do_fill = true;
    },
  });

  global_symbols.set("STROKE_COLOR", {
    arity: 3,
    is_native: true,
    native_fn: (r: number, g: number, b: number) => {
      get_ctx().strokeStyle = `rgb(${r}, ${g}, ${b})`;
      do_stroke = true;
    },
  });

  global_symbols.set("STROKE_WEIGHT", {
    arity: 1,
    is_native: true,
    native_fn: (w: number) => {
      get_ctx().lineWidth = w;
    },
  });

  global_symbols.set("NO_FILL", {
    arity: 0,
    is_native: true,
    native_fn: () => {
      do_fill = false;
    },
  });

  global_symbols.set("NO_STROKE", {
    arity: 0,
    is_native: true,
    native_fn: () => {
      do_stroke = false;
    },
  });

  global_symbols.set("CLEAR_SCREEN", {
    arity: 0,
    is_native: true,
    native_fn: () => {
      const c = get_ctx();
      c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    },
  });

  global_symbols.set("DRAW_RECT", {
    arity: 4,
    is_native: true,
    native_fn: (x: number, y: number, w: number, h: number) => {
      const c = get_ctx();
      if (do_fill) c.fillRect(x, y, w, h);
      if (do_stroke) c.strokeRect(x, y, w, h);
    },
  });

  global_symbols.set("DRAW_CIRCLE", {
    arity: 3,
    is_native: true,
    native_fn: (x: number, y: number, radius: number) => {
      const c = get_ctx();
      c.beginPath();
      c.arc(x, y, radius, 0, Math.PI * 2);
      if (do_fill) c.fill();
      if (do_stroke) c.stroke();
    },
  });

  global_symbols.set("DRAW_LINE", {
    arity: 4,
    is_native: true,
    native_fn: (x1: number, y1: number, x2: number, y2: number) => {
      const c = get_ctx();
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      if (do_stroke) c.stroke();
    },
  });

  global_symbols.set("DRAW_TRIANGLE", {
    arity: 6,
    is_native: true,
    native_fn: (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      x3: number,
      y3: number,
    ) => {
      const c = get_ctx();
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.lineTo(x3, y3);
      c.closePath();
      if (do_fill) c.fill();
      if (do_stroke) c.stroke();
    },
  });

  // ==========================================
  // Matrix Transformations
  // ==========================================

  global_symbols.set("PUSH_MATRIX", {
    arity: 0,
    is_native: true,
    native_fn: () => get_ctx().save(),
  });

  global_symbols.set("POP_MATRIX", {
    arity: 0,
    is_native: true,
    native_fn: () => get_ctx().restore(),
  });

  global_symbols.set("TRANSLATE", {
    arity: 2,
    is_native: true,
    native_fn: (x: number, y: number) => get_ctx().translate(x, y),
  });

  global_symbols.set("ROTATE", {
    arity: 1,
    is_native: true,
    native_fn: (angle: number) => get_ctx().rotate(angle),
  });

  // ==========================================
  // Extended Mathematics API
  // ==========================================

  global_symbols.set("SQRT", {
    arity: 1,
    is_native: true,
    native_fn: Math.sqrt,
  });
  global_symbols.set("POW", { arity: 2, is_native: true, native_fn: Math.pow });
  global_symbols.set("ABS", { arity: 1, is_native: true, native_fn: Math.abs });
  global_symbols.set("FLOOR", {
    arity: 1,
    is_native: true,
    native_fn: Math.floor,
  });
  global_symbols.set("CEIL", {
    arity: 1,
    is_native: true,
    native_fn: Math.ceil,
  });
  global_symbols.set("SIN", { arity: 1, is_native: true, native_fn: Math.sin });
  global_symbols.set("COS", { arity: 1, is_native: true, native_fn: Math.cos });
  global_symbols.set("TAN", { arity: 1, is_native: true, native_fn: Math.tan });
  global_symbols.set("ATAN2", {
    arity: 2,
    is_native: true,
    native_fn: Math.atan2,
  });

  global_symbols.set("CLAMP", {
    arity: 3,
    is_native: true,
    native_fn: (val: number, min: number, max: number) =>
      Math.max(min, Math.min(max, val)),
  });

  global_symbols.set("LERP", {
    arity: 3,
    is_native: true,
    native_fn: (start: number, end: number, amt: number) =>
      start + (end - start) * amt,
  });

  global_symbols.set("RND", {
    arity: 2,
    is_native: true,
    native_fn: (min: number, max: number) => Math.random() * (max - min) + min,
  });

  // Keep existing I/O
  global_symbols.set("PRINT", {
    arity: -1, // -1 if you want to support varargs, otherwise set specific arity
    is_native: true,
    native_fn: (...args: any[]) => console.log(...args),
  });

  global_symbols.set("IS_KEY_DOWN", {
    arity: 1,
    is_native: true,
    native_fn: (key: string) => keys_down.has(key),
  });

  return global_symbols;
}

export function pass_1_scope_analysis(tokens: Token[], scopes: Scope[]): void {
  const blocksToBeClosed: Token[] = [];
  let active_scope_id = 0;

  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];

    // 1. Scope Opening
    if (
      token.type === "IF" ||
      token.type === "DO" ||
      token.type === "SUB" ||
      token.type === "WHILE" ||
      token.type === "SWITCH" ||
      token.type === "CASE" ||
      token.type === "DEFAULT"
    ) {
      if (token.type === "IF" && i > 0 && tokens[i - 1].type === "ELSE") {
        continue;
      }

      if (token.type === "IF") {
        let lookahead = i + 1;
        // Find the corresponding THEN token
        while (lookahead < tokens.length && tokens[lookahead].type !== "THEN") {
          lookahead++;
        }
        // If the token after THEN is NOT a newline, it's a single-line IF.
        // We skip pushing a scope block because there is no END IF.
        if (
          lookahead + 1 < tokens.length &&
          tokens[lookahead + 1].type !== "NEWLINE"
        ) {
          continue;
        }
      }

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
