import { evaluate_program, hoist_program } from "./evaluator";
import {
  define_builtin_constants,
  define_builtin_functions,
  Errors,
  pass_1_scope_analysis,
  type Scope,
  type SymbolEntry,
} from "./parser_pass_1";
import { parse_program } from "./parser_pass_2";
import { create_environment, type Environment } from "./runtime";
import { tokenize } from "./tokenizer";
import type { ProjectFile } from "./serialize";

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let active_env: Environment | null = null;
let animation_frame_id: number | null = null;
const keys_down = new Set<string>();
const imageAssets = new Map<string, ImageBitmap>();
let allFiles: ProjectFile[] = [];

function stop_engine() {
  if (animation_frame_id !== null) {
    cancelAnimationFrame(animation_frame_id);
    animation_frame_id = null;
  }
  active_env = null;
  keys_down.clear();
  if (ctx && canvas) {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  self.postMessage({ type: "HALTED" });
}

function compile_and_run(entry_filename: string) {
  stop_engine();
  if (!ctx || !canvas) return;

  const currentCanvas = canvas; // Local non-null reference

  const update_env = (name: string, value: any) => {
    if (active_env) {
      active_env.assign(name, {
        type: Number.isInteger(value) ? "i32" : "f32",
        value,
      });
    }
  };

  const moduleCache = new Map<
    string,
    { env: Environment; ast: import("./ast_types").Program }
  >();
  const loadingStack = new Set<string>();

  function load_module(
    filename: string,
  ): { env: Environment; ast: import("./ast_types").Program } | null {
    if (moduleCache.has(filename)) return moduleCache.get(filename)!;
    if (loadingStack.has(filename)) {
      self.postMessage({
        type: "ERROR",
        message: `Circular import detected: ${[...loadingStack, filename].join(" -> ")}`,
      });
      return null;
    }
    loadingStack.add(filename);
    const fileData = allFiles.find((f) => f.filename === filename);
    if (!fileData) {
      self.postMessage({
        type: "ERROR",
        message: `Module not found: '${filename}'`,
      });
      return null;
    }

    const mod_env = create_environment(
      null,
      define_builtin_functions(
        ctx as unknown as CanvasRenderingContext2D,
        keys_down,
        update_env,
        imageAssets as unknown as Map<string, CanvasImageSource>,
      ),
    );
    define_builtin_constants(mod_env, currentCanvas.width, currentCanvas.height);
    mod_env.assign("SCR_W", { type: "i32", value: currentCanvas.width });
    mod_env.assign("SCR_H", { type: "i32", value: currentCanvas.height });

    const scopes: Scope[] = [
      { id: 0, parent_id: null, start_token: 0, end_token: 0, symbols: new Map<string, SymbolEntry>() },
    ];
    Errors.length = 0;

    const { tokens, errors: lexErrors } = tokenize(fileData.content);
    if (lexErrors && lexErrors.length > 0) {
      self.postMessage({
        type: "ERROR",
        message: `[${filename}] Lex Error: ${lexErrors[0].message}`,
      });
      return null;
    }

    pass_1_scope_analysis(tokens, scopes);
    if (Errors.length > 0) {
      self.postMessage({
        type: "ERROR",
        message: `[${filename}] Scope Error: ${Errors[0].message}`,
      });
      return null;
    }

    const ast = parse_program(tokens, scopes);
    if (Errors.length > 0) {
      self.postMessage({
        type: "ERROR",
        message: `[${filename}] Parse Error: ${Errors[0].message}`,
      });
      return null;
    }

    for (const node of ast.body) {
      if (node.type === "ImportStatement") {
        const targetMod = load_module(node.source);
        if (!targetMod) return null;
        for (const sym of node.symbols) {
          if (targetMod.env.functionMap.has(sym)) {
            const fn_entry = targetMod.env.functionMap.get(sym)!;
            if (fn_entry.declaration && !fn_entry.declaration.is_export) {
              self.postMessage({
                type: "ERROR",
                message: `[${filename}] Import Error: Subroutine '${sym}' is not exported in '${node.source}'.`,
              });
              return null;
            }
            mod_env.functionMap.set(sym, fn_entry);
          } else {
            let is_exported = false;
            for (const tNode of targetMod.ast.body) {
              if (tNode.type === "VariableDeclaration" && tNode.target === sym && tNode.is_export) {
                is_exported = true;
                break;
              }
            }
            if (!is_exported) {
              self.postMessage({
                type: "ERROR",
                message: `[${filename}] Import Error: Variable '${sym}' is not exported in '${node.source}'.`,
              });
              return null;
            }
            const val = targetMod.env.get(sym);
            if (val !== null) mod_env.define(sym, val);
          }
        }
      }
    }

    hoist_program(ast, mod_env);
    if (filename !== entry_filename) {
      const interpreter = evaluate_program(ast, mod_env);
      let result = interpreter.next();
      while (!result.done) {
        if (result.value && result.value.status === "error") {
          const prefix = result.value.line ? `[Line ${result.value.line}] ` : "";
          self.postMessage({
            type: "ERROR",
            message: `[${filename}] Runtime Error ${prefix}: ${result.value.message}`,
          });
          return null;
        }
        result = interpreter.next();
      }
    }

    loadingStack.delete(filename);
    const modData = { env: mod_env, ast };
    moduleCache.set(filename, modData);
    return modData;
  }

  const entryModule = load_module(entry_filename);
  if (!entryModule) return;

  active_env = entryModule.env;
  const interpreter = evaluate_program(entryModule.ast, active_env);

  function engine_tick() {
    const start = performance.now();
    let is_running = true;
    let result;

    // Execute as many instructions as possible within a 12ms frame budget
    while (performance.now() - start < 12) {
      result = interpreter.next();

      if (result.done || (result.value && result.value.status !== "running")) {
        if (result.value?.status === "sync") {
          // The script explicitly requested a frame boundary
          is_running = true;
        } else {
          // The script naturally ended or errored
          is_running = false;
        }
        break;
      }
    }

    if (is_running) {
      // Budget expired or SYNC called! Yield back to the browser to paint.
      animation_frame_id = requestAnimationFrame(engine_tick);
    } else {
      if (result?.value?.status === "error") {
        const prefix = result.value.line ? `[Line ${result.value.line}] ` : "";
        self.postMessage({
          type: "ERROR",
          message: `${prefix}${result.value.message}`,
        });
      }
      animation_frame_id = null;
    }
  }

  self.postMessage({ type: "STARTED" });
  animation_frame_id = requestAnimationFrame(engine_tick);
}

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;
  switch (type) {
    case "INIT":
      canvas = payload.canvas;
      ctx = canvas!.getContext("2d")!;
      break;
    case "SET_FILES":
      allFiles = payload.files;
      break;
    case "SET_ASSETS":
      imageAssets.clear();
      for (const item of payload.assets) {
        imageAssets.set(item.name, item.bitmap);
      }
      break;
    case "RUN":
      compile_and_run(payload.filename || "main.basic");
      break;
    case "STOP":
      stop_engine();
      break;
    case "RESIZE":
      if (canvas && ctx) {
        canvas.width = payload.width;
        canvas.height = payload.height;
        if (active_env) {
          active_env.assign("SCR_W", { type: "i32", value: payload.width });
          active_env.assign("SCR_H", { type: "i32", value: payload.height });
          active_env.assign("HOST_W", { type: "i32", value: payload.width });
          active_env.assign("HOST_H", { type: "i32", value: payload.height });
        }
      }
      break;
    case "INPUT_MOUSE_MOVE":
      if (active_env) {
        active_env.assign("MOUSE_X", { type: "i32", value: payload.x });
        active_env.assign("MOUSE_Y", { type: "i32", value: payload.y });
      }
      break;
    case "INPUT_MOUSE_DOWN":
      if (active_env) {
        active_env.assign("MOUSE_DOWN", { type: "bool", value: payload.down });
      }
      break;
    case "INPUT_KEY":
      if (payload.down) {
        keys_down.add(payload.key);
      } else {
        keys_down.delete(payload.key);
      }
      break;
  }
};
