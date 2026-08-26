import type { Callable, Environment, RuntimeValue } from "./runtime";
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
  native_fn?: (...args: RuntimeValue[]) => RuntimeValue; // Strict Typing!
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
  update_env: (name: string, value: any) => void,
  imageAssets: Map<string, CanvasImageSource>,
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

  const get_ctx = () => {
    const active = buffers.get(active_buffer_id);
    if (!active)
      throw new Error(`Buffer ID ${active_buffer_id} does not exist.`);
    return active;
  };

  // Helper for void returns
  const VOID: RuntimeValue = { type: "any", value: null };

  global_symbols.set("SYNC", {
    arity: 0,
    is_native: true,
    native_fn: () => VOID,
  });

  // ==========================================
  // Buffer Management API
  // ==========================================

  global_symbols.set("CREATE_BUFFER", {
    arity: 2,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      const w = Number(args[0].value);
      const h = Number(args[1].value);
      const offscreen = new OffscreenCanvas(w, h);
      const off_ctx = offscreen.getContext("2d");
      if (!off_ctx) return { type: "i32", value: -1 };
      const id = next_buffer_id++;
      buffers.set(id, off_ctx as OffscreenCanvasRenderingContext2D);
      return { type: "i32", value: id };
    },
  });

  global_symbols.set("BIND_BUFFER", {
    arity: 1,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      const id = Number(args[0].value);
      if (buffers.has(id)) active_buffer_id = id;
      return VOID;
    },
  });

  global_symbols.set("SCREEN", {
    arity: 2,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      const w = Number(args[0].value);
      const h = Number(args[1].value);
      ctx.canvas.width = w;
      ctx.canvas.height = h;
      update_env("SCR_W", w);
      update_env("SCR_H", h);
      return VOID;
    },
  });

  global_symbols.set("DRAW_BUFFER", {
    arity: 5,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      const id = Number(args[0].value);
      const source_ctx = buffers.get(id);
      if (source_ctx && source_ctx.canvas) {
        get_ctx().drawImage(
          source_ctx.canvas,
          Number(args[1].value),
          Number(args[2].value),
          Number(args[3].value),
          Number(args[4].value)
        );
      }
      return VOID;
    },
  });

  global_symbols.set("FREE_BUFFER", {
    arity: 1,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      const id = Number(args[0].value);
      if (id !== 0) {
        buffers.delete(id);
        if (active_buffer_id === id) active_buffer_id = 0;
      }
      return VOID;
    },
  });

  // ==========================================
  // 2D Graphics API (State & Primitives)
  // ==========================================

  global_symbols.set("FILL_COLOR", {
    arity: 3,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      get_ctx().fillStyle = `rgb(${Number(args[0].value)}, ${Number(args[1].value)}, ${Number(args[2].value)})`;
      do_fill = true;
      return VOID;
    },
  });

  global_symbols.set("STROKE_COLOR", {
    arity: 3,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      get_ctx().strokeStyle = `rgb(${Number(args[0].value)}, ${Number(args[1].value)}, ${Number(args[2].value)})`;
      do_stroke = true;
      return VOID;
    },
  });

  global_symbols.set("STROKE_WEIGHT", {
    arity: 1,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      get_ctx().lineWidth = Number(args[0].value);
      return VOID;
    },
  });

  global_symbols.set("NO_FILL", {
    arity: 0,
    is_native: true,
    native_fn: () => { do_fill = false; return VOID; },
  });

  global_symbols.set("NO_STROKE", {
    arity: 0,
    is_native: true,
    native_fn: () => { do_stroke = false; return VOID; },
  });

  global_symbols.set("CLEAR_SCREEN", {
    arity: 0,
    is_native: true,
    native_fn: () => {
      const c = get_ctx();
      c.clearRect(0, 0, c.canvas.width, c.canvas.height);
      return VOID;
    },
  });

  global_symbols.set("DRAW_RECT", {
    arity: 4,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      const c = get_ctx();
      const x = Number(args[0].value), y = Number(args[1].value), w = Number(args[2].value), h = Number(args[3].value);
      if (do_fill) c.fillRect(x, y, w, h);
      if (do_stroke) c.strokeRect(x, y, w, h);
      return VOID;
    },
  });

  global_symbols.set("DRAW_CIRCLE", {
    arity: 3,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      const c = get_ctx();
      c.beginPath();
      c.arc(Number(args[0].value), Number(args[1].value), Number(args[2].value), 0, Math.PI * 2);
      if (do_fill) c.fill();
      if (do_stroke) c.stroke();
      return VOID;
    },
  });

  global_symbols.set("DRAW_LINE", {
    arity: 4,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      const c = get_ctx();
      c.beginPath();
      c.moveTo(Number(args[0].value), Number(args[1].value));
      c.lineTo(Number(args[2].value), Number(args[3].value));
      if (do_stroke) c.stroke();
      return VOID;
    },
  });

  global_symbols.set("DRAW_TRIANGLE", {
    arity: 6,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      const c = get_ctx();
      c.beginPath();
      c.moveTo(Number(args[0].value), Number(args[1].value));
      c.lineTo(Number(args[2].value), Number(args[3].value));
      c.lineTo(Number(args[4].value), Number(args[5].value));
      c.closePath();
      if (do_fill) c.fill();
      if (do_stroke) c.stroke();
      return VOID;
    },
  });

  global_symbols.set("DRAW_IMAGE", {
    arity: 5,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      const c = get_ctx();
      const img = imageAssets.get(String(args[0].value));
      if (img) c.drawImage(img, Number(args[1].value), Number(args[2].value), Number(args[3].value), Number(args[4].value));
      return VOID;
    },
  });

  global_symbols.set("SET_FONT", {
    arity: 2,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      get_ctx().font = `${Number(args[0].value)}px "${String(args[1].value)}", monospace`;
      return VOID;
    },
  });

  global_symbols.set("TEXT_ALIGN", {
    arity: 1,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      get_ctx().textAlign = String(args[0].value) as CanvasTextAlign;
      return VOID;
    },
  });

  global_symbols.set("DRAW_TEXT", {
    arity: 3,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      const c = get_ctx();
      const x = Number(args[0].value), y = Number(args[1].value), text = String(args[2].value);
      if (do_fill) c.fillText(text, x, y);
      if (do_stroke) c.strokeText(text, x, y);
      return VOID;
    },
  });

  // ==========================================
  // Matrix Transformations
  // ==========================================

  global_symbols.set("PUSH_MATRIX", { arity: 0, is_native: true, native_fn: () => { get_ctx().save(); return VOID; } });
  global_symbols.set("POP_MATRIX", { arity: 0, is_native: true, native_fn: () => { get_ctx().restore(); return VOID; } });
  global_symbols.set("TRANSLATE", { arity: 2, is_native: true, native_fn: (...args: RuntimeValue[]) => { get_ctx().translate(Number(args[0].value), Number(args[1].value)); return VOID; } });
  global_symbols.set("ROTATE", { arity: 1, is_native: true, native_fn: (...args: RuntimeValue[]) => { get_ctx().rotate(Number(args[0].value)); return VOID; } });

  // ==========================================
  // Extended Mathematics API
  // ==========================================

  const wrapMath1 = (fn: (x: number) => number) => (...args: RuntimeValue[]): RuntimeValue => {
    const res = fn(Number(args[0].value));
    return { type: Number.isInteger(res) ? "i32" : "f32", value: res };
  };

  const wrapMath2 = (fn: (x: number, y: number) => number) => (...args: RuntimeValue[]): RuntimeValue => {
    const res = fn(Number(args[0].value), Number(args[1].value));
    return { type: Number.isInteger(res) ? "i32" : "f32", value: res };
  };

  global_symbols.set("SQRT", { arity: 1, is_native: true, native_fn: wrapMath1(Math.sqrt) });
  global_symbols.set("POW", { arity: 2, is_native: true, native_fn: wrapMath2(Math.pow) });
  global_symbols.set("ABS", { arity: 1, is_native: true, native_fn: wrapMath1(Math.abs) });
  global_symbols.set("FLOOR", { arity: 1, is_native: true, native_fn: wrapMath1(Math.floor) });
  global_symbols.set("CEIL", { arity: 1, is_native: true, native_fn: wrapMath1(Math.ceil) });
  global_symbols.set("SIN", { arity: 1, is_native: true, native_fn: wrapMath1(Math.sin) });
  global_symbols.set("COS", { arity: 1, is_native: true, native_fn: wrapMath1(Math.cos) });
  global_symbols.set("TAN", { arity: 1, is_native: true, native_fn: wrapMath1(Math.tan) });
  global_symbols.set("ATAN2", { arity: 2, is_native: true, native_fn: wrapMath2(Math.atan2) });

  global_symbols.set("CLAMP", {
    arity: 3,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      const res = Math.max(Number(args[1].value), Math.min(Number(args[2].value), Number(args[0].value)));
      return { type: Number.isInteger(res) ? "i32" : "f32", value: res };
    },
  });

  global_symbols.set("LERP", {
    arity: 3,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      const start = Number(args[0].value), end = Number(args[1].value), amt = Number(args[2].value);
      const res = start + (end - start) * amt;
      return { type: Number.isInteger(res) ? "i32" : "f32", value: res };
    },
  });

  global_symbols.set("RND", {
    arity: 2,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      const min = Number(args[0].value), max = Number(args[1].value);
      const res = Math.random() * (max - min) + min;
      return { type: Number.isInteger(res) ? "i32" : "f32", value: res };
    },
  });

  // Keep existing I/O
  global_symbols.set("PRINT", {
    arity: -1,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      console.log(...args.map(a => a.value));
      return VOID;
    },
  });

  global_symbols.set("IS_KEY_DOWN", {
    arity: 1,
    is_native: true,
    native_fn: (...args: RuntimeValue[]) => {
      return { type: "bool", value: keys_down.has(String(args[0].value)) };
    },
  });

  return global_symbols;
}

export function define_builtin_constants(
  global_env: Environment,
  scr_wdith: number,
  scr_height: number,
) {
  // Define static mathematical constants
  global_env.define("PI", { type: "f32", value: Math.PI });
  global_env.define("TWO_PI", { type: "f32", value: Math.PI * 2 });
  global_env.define("HALF_PI", { type: "f32", value: Math.PI / 2 });

  // Initialize dynamic system variables
  global_env.define("MOUSE_X", { type: "i32", value: 0 });
  global_env.define("MOUSE_Y", { type: "i32", value: 0 });
  global_env.define("MOUSE_DOWN", { type: "bool", value: false });
  global_env.define("SCR_W", { type: "i32", value: scr_wdith });
  global_env.define("SCR_H", { type: "i32", value: scr_height });
  global_env.define("HOST_W", { type: "i32", value: scr_wdith });
  global_env.define("HOST_H", { type: "i32", value: scr_height });
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
        while (lookahead < tokens.length && tokens[lookahead].type !== "THEN") {
          lookahead++;
        }
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
      const parent_scope = scopes[child_scope.parent_id !== null ? child_scope.parent_id : 0];
      const variable_name_token = tokens[i + 1];

      if (!variable_name_token || variable_name_token.type !== "ID") {
        Errors.push({ message: "Invalid SUB name.", line: token.line, column: token.column });
        continue;
      }

      i++; // Safely advance past the SUB token to the name token

      let arity = 0;
      while (i + 1 < tokens.length && tokens[i + 1].type !== "THEN") {
        i++;
        token = tokens[i];

        // Break early if we hit the return type annotation (e.g. : f32 THEN)
        if (token.type === "COLON" && tokens[i + 1]?.type === "ID" && tokens[i + 2]?.type === "THEN") {
          i += 1; // Skip the return type ID, next loop sees THEN
          continue;
        }

        if (token.type === "COMMA") continue;

        if (token.type !== "ID") {
          Errors.push({
            message: `SUB arguments must be an ID, but found ${token.type}`,
            line: token.line, column: token.column,
          });
          continue;
        }

        child_scope.symbols.set(token.value, {
          name: token.value,
          type: "VARIABLE",
          node_index: i,
          is_hoisted: true,
        });
        arity++;

        // Silently skip parameter type annotation if present
        if (tokens[i + 1]?.type === "COLON") {
          i += 2;
        }
      }

      parent_scope.symbols.set(variable_name_token.value, {
        type: "SUB", arity, node_index: i, is_hoisted: true, name: variable_name_token.value,
      });
    }

    // 3. Variable/Constant Registration
    if (token.type === "LET" || token.type === "CONST") {
      const current_scope = scopes[active_scope_id];
      const variable_name_token = tokens[i + 1];

      if (!variable_name_token || variable_name_token.type !== "ID") {
        Errors.push({ message: "Invalid variable name.", line: token.line, column: token.column });
        continue;
      }

      let lookahead = i + 2;
      while (
        lookahead < tokens.length &&
        tokens[lookahead].type !== "DECLARATION" &&
        tokens[lookahead].type !== "COLON_EQUAL"
      ) {
        lookahead++;
      }

      const token_after_assign = tokens[lookahead + 1];
      const next_after_assign = tokens[lookahead + 2];

      let symType: SymbolType = token.type === "LET" ? "VARIABLE" : "CONSTANT";

      if (token_after_assign?.type === "LBRACKET") {
        if (next_after_assign?.type === "ID" && tokens[lookahead + 3]?.type === "DECLARATION") {
          symType = "DICTIONARY";
        } else {
          symType = "ARRAY";
        }
      }

      current_scope.symbols.set(variable_name_token.value, {
        name: variable_name_token.value,
        type: symType,
        node_index: i,
        is_hoisted: true,
      });
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
