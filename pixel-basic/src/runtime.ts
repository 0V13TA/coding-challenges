import type { SubDeclaration } from "./ast_types";

export type Environment = {
  values: Map<string, any>;
  parent: Environment | null;
  functionMap: Map<string, Callable>;
  get: (name: string) => any | null;
  define: (name: string, value: any) => void;
  assign: (name: string, value: any) => boolean;
};

export type RuntimeResult =
  | { status: "running" }
  | { status: "done"; value?: any }
  | { status: "error"; message: string };

export type Callable = {
  arity: number;
  is_native: boolean;
  declaration?: SubDeclaration;
  native_fn?: (...args: any[]) => any;
};

export function create_environment(
  parent: Environment | null = null,
  functionMap: Map<string, Callable> = new Map<string, Callable>(),
): Environment {
  const values = new Map<string, any>();

  return {
    values,
    parent,
    functionMap,

    define: (name, value) => {
      values.set(name, value);
    },

    get: (name) => {
      if (values.has(name)) return values.get(name);
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
