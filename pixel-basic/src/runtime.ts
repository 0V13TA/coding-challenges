import type { SubDeclaration } from "./ast_types";

export type ValueType = "i32" | "f32" | "bool" | "string" | "array" | "dictionary" | "any";

// The Tagged Union wrapper for all memory
export type RuntimeValue = {
  type: ValueType;
  value: any; // The underlying raw data
};

export type Environment = {
  values: Map<string, RuntimeValue>;
  parent: Environment | null;
  functionMap: Map<string, Callable>;
  get: (name: string) => RuntimeValue | null;
  define: (name: string, value: RuntimeValue) => void;
  assign: (name: string, value: RuntimeValue) => boolean;
};

export type RuntimeResult =
  | { status: "running" }
  | { status: "done"; value?: RuntimeValue }
  | { status: "sync" }
  | { status: "error"; message: string; line?: number; column?: number };

export type Callable = {
  arity: number;
  is_native: boolean;
  declaration?: SubDeclaration;
  native_fn?: (...args: RuntimeValue[]) => RuntimeValue;
  closure?: Environment;
};

export function create_environment(
  parent: Environment | null = null,
  functionMap: Map<string, Callable> = new Map<string, Callable>(),
): Environment {
  const values = new Map<string, RuntimeValue>();

  return {
    values,
    parent,
    functionMap,

    define: (name, value) => {
      values.set(name, value);
    },

    get: (name) => {
      if (values.has(name)) return values.get(name) || null;
      if (parent) return parent.get(name);
      return null;
    },

    assign: (name, value) => {
      if (values.has(name)) {
        values.set(name, value);
        return true;
      }
      if (parent && parent.assign(name, value)) {
        return true;
      }
      return false;
    },
  };
}
