import type { ASTNode, Program } from "./ast_types";
import {
  create_environment,
  type Environment,
  type RuntimeResult,
  type RuntimeValue,
} from "./runtime";

export type ControlFlowSignal = {
  type: "ControlFlow";
  action: "BREAK" | "CONTINUE" | "RETURN";
  value?: any;
};

function is_control_flow(val: any): val is ControlFlowSignal {
  return val !== null && typeof val === "object" && val.type === "ControlFlow";
}

export function hoist_program(program: Program, env: Environment) {
  for (const node of program.body) {
    if (node.type === "SubDeclaration") {
      env.functionMap.set(node.name, {
        arity: node.parameters.length,
        is_native: false,
        declaration: node,
        closure: env,
      });
    }
  }
}

export function* evaluate_program(
  node: ASTNode,
  env: Environment,
): Generator<RuntimeResult, any, any> {
  switch (node.type) {
    case "NumericLiteral":
      return { type: Number.isInteger(node.value) ? "i32" : "f32", value: node.value } as RuntimeValue;
    case "StringLiteral":
      return { type: "string", value: node.value } as RuntimeValue;
    case "BooleanLiteral":
      return { type: "bool", value: node.value } as RuntimeValue;

    case "Identifier": {
      const value = env.get(node.name);
      if (value === null)
        yield {
          status: "error",
          message: `Undefined variable: ${node.name}`,
          line: node.line,
          column: node.column,
        };
      return value;
    }

    case "BinaryExpression": {
      const left = (yield* evaluate_program(node.left, env)) as RuntimeValue;
      const right = (yield* evaluate_program(node.right, env)) as RuntimeValue;

      if (!left || !right) return null;

      switch (node.operator) {
        case "+": {
          if (left.type === "string" || right.type === "string") {
            return { type: "string", value: String(left.value) + String(right.value) } as RuntimeValue;
          }
          return { type: left.type === "f32" || right.type === "f32" ? "f32" : "i32", value: Number(left.value) + Number(right.value) } as RuntimeValue;
        }
        case "-": return { type: left.type === "f32" || right.type === "f32" ? "f32" : "i32", value: Number(left.value) - Number(right.value) } as RuntimeValue;
        case "*": return { type: left.type === "f32" || right.type === "f32" ? "f32" : "i32", value: Number(left.value) * Number(right.value) } as RuntimeValue;
        case "/": return { type: left.type === "f32" || right.type === "f32" ? "f32" : "i32", value: Number(left.value) / Number(right.value) } as RuntimeValue;
        case "%": return { type: left.type === "f32" || right.type === "f32" ? "f32" : "i32", value: Number(left.value) % Number(right.value) } as RuntimeValue;
        case "==": return { type: "bool", value: left.value == right.value } as RuntimeValue;
        case "!=": return { type: "bool", value: left.value != right.value } as RuntimeValue;
        case "<": return { type: "bool", value: Number(left.value) < Number(right.value) } as RuntimeValue;
        case "<=": return { type: "bool", value: Number(left.value) <= Number(right.value) } as RuntimeValue;
        case ">": return { type: "bool", value: Number(left.value) > Number(right.value) } as RuntimeValue;
        case ">=": return { type: "bool", value: Number(left.value) >= Number(right.value) } as RuntimeValue;
        case "AND": return { type: "bool", value: left.value && right.value } as RuntimeValue;
        case "OR": return { type: "bool", value: left.value || right.value } as RuntimeValue;
        case "NOT": return { type: "bool", value: !left.value } as RuntimeValue;
        default:
          yield {
            status: "error",
            message: `Unknown operator: '${node.operator}'`,
            line: node.line,
            column: node.column,
          };
      }
      return null;
    }

    case "VariableDeclaration": {
      const declared_value = (yield* evaluate_program(node.value, env)) as RuntimeValue;
      env.define(node.target, declared_value);
      return declared_value;
    }

    case "Assignment": {
      if (node.target.type === "Identifier") {
        let assigned_value = (yield* evaluate_program(node.value, env)) as RuntimeValue;
        const current_value = env.get(node.target.name);
        if (current_value !== null) {
          switch (node.operator) {
            case "+=": assigned_value = { type: current_value.type, value: Number(current_value.value) + Number(assigned_value.value) } as RuntimeValue; break;
            case "-=": assigned_value = { type: current_value.type, value: Number(current_value.value) - Number(assigned_value.value) } as RuntimeValue; break;
            case "*=": assigned_value = { type: current_value.type, value: Number(current_value.value) * Number(assigned_value.value) } as RuntimeValue; break;
            case "/=": assigned_value = { type: current_value.type, value: Number(current_value.value) / Number(assigned_value.value) } as RuntimeValue; break;
            case "%=": assigned_value = { type: current_value.type, value: Number(current_value.value) % Number(assigned_value.value) } as RuntimeValue; break;
          }
        }
        const success = env.assign(node.target.name, assigned_value);
        if (!success) {
          yield {
            status: "error",
            message: `Cannot assign to undefined variable: ${node.target.name}`,
            line: node.line,
            column: node.column,
          };
        }
      } else if (node.target.type === "IndexExpression") {
        let assigned_value = (yield* evaluate_program(node.value, env)) as RuntimeValue;
        const target_object = (yield* evaluate_program(node.target.object, env)) as RuntimeValue;
        const index_value = (yield* evaluate_program(node.target.index, env)) as RuntimeValue;

        if (!target_object || !target_object.value) {
          yield { status: "error", message: `Cannot index into a non-object.`, line: node.line, column: node.column };
          return null;
        }

        const current = target_object.value[index_value.value] as RuntimeValue | undefined;
        if (current) {
          switch (node.operator) {
            case "+=": assigned_value = { type: current.type, value: Number(current.value) + Number(assigned_value.value) } as RuntimeValue; break;
            case "-=": assigned_value = { type: current.type, value: Number(current.value) - Number(assigned_value.value) } as RuntimeValue; break;
            case "*=": assigned_value = { type: current.type, value: Number(current.value) * Number(assigned_value.value) } as RuntimeValue; break;
            case "/=": assigned_value = { type: current.type, value: Number(current.value) / Number(assigned_value.value) } as RuntimeValue; break;
            case "%=": assigned_value = { type: current.type, value: Number(current.value) % Number(assigned_value.value) } as RuntimeValue; break;
          }
        }
        target_object.value[index_value.value] = assigned_value;
      }
      return null;
    }

    case "IndexExpression": {
      const target_object = (yield* evaluate_program(node.object, env)) as RuntimeValue;
      const index_value = (yield* evaluate_program(node.index, env)) as RuntimeValue;

      if (!target_object || !target_object.value) {
        yield { status: "error", message: "Cannot read index of undefined.", line: node.line, column: node.column };
        return null;
      }

      const result = target_object.value[index_value.value] as RuntimeValue | undefined;
      if (result === undefined) {
        yield { status: "error", message: `Index '${index_value.value}' out of bounds.`, line: node.line, column: node.column };
        return null;
      }
      return result;
    }

    case "ArrayLiteral": {
      const elements: RuntimeValue[] = [];
      for (const element of node.elements) {
        elements.push((yield* evaluate_program(element, env)) as RuntimeValue);
      }
      return { type: "array", value: elements } as RuntimeValue;
    }

    case "DictionaryLiteral": {
      const dict: Record<string, RuntimeValue> = {};
      for (const prop of node.properties) {
        dict[prop.key] = (yield* evaluate_program(prop.value, env)) as RuntimeValue;
      }
      return { type: "dictionary", value: dict } as RuntimeValue;
    }

    case "BreakStatement": return { type: "ControlFlow", action: "BREAK" };
    case "ContinueStatement": return { type: "ControlFlow", action: "CONTINUE" };
    case "ReturnStatement": {
      const return_value = node.argument ? (yield* evaluate_program(node.argument, env)) as RuntimeValue : null;
      return { type: "ControlFlow", action: "RETURN", value: return_value };
    }

    case "IfStatement": {
      const condition_value = (yield* evaluate_program(node.condition, env)) as RuntimeValue;
      if (condition_value && condition_value.value) {
        for (const stmt of node.body) {
          const result = yield* evaluate_program(stmt, env);
          if (is_control_flow(result)) return result;
        }
      } else if (node.alternate) {
        if (Array.isArray(node.alternate)) {
          for (const stmt of node.alternate) {
            const result = yield* evaluate_program(stmt, env);
            if (is_control_flow(result)) return result;
          }
        } else if (node.alternate.type === "IfStatement") {
          const result = yield* evaluate_program(node.alternate, env);
          if (is_control_flow(result)) return result;
        }
      }
      return null;
    }

    case "WhileStatement": {
      while (true) {
        const condition_value = (yield* evaluate_program(node.condition, env)) as RuntimeValue;
        if (!condition_value || !condition_value.value) break;

        let break_loop = false;
        for (const stmt of node.body) {
          const result = yield* evaluate_program(stmt, env);
          if (is_control_flow(result)) {
            if (result.action === "BREAK") { break_loop = true; break; }
            if (result.action === "CONTINUE") { break; }
            if (result.action === "RETURN") { return result; }
          }
        }
        if (break_loop) break;

        // Add this back! It allows the worker to pause execution.
        yield { status: "running" };
      }
      return null;
    }

    case "FunctionCall": {
      if (node.caller === "SYNC") {
        yield { status: "sync" };
        return { type: "any", value: null } as RuntimeValue;
      }

      const func_entry = env.functionMap.get(node.caller);
      if (!func_entry) {
        yield { status: "error", message: `Undefined function: ${node.caller}`, line: node.line, column: node.column };
        return null;
      }

      const evaluated_args: RuntimeValue[] = [];
      for (const arg of node.args) {
        evaluated_args.push((yield* evaluate_program(arg, env)) as RuntimeValue);
      }

      if (func_entry.arity !== -1 && evaluated_args.length !== func_entry.arity) {
        yield { status: "error", message: `Function ${node.caller} expects ${func_entry.arity} arguments, but got ${evaluated_args.length}.`, line: node.line, column: node.column };
        return null;
      }

      if (func_entry.is_native && func_entry.native_fn) {
        return func_entry.native_fn(...evaluated_args);
      }
      else if (func_entry.declaration) {
        const parent_env = func_entry.closure || env;
        const sub_env = create_environment(parent_env, parent_env.functionMap);

        func_entry.declaration.parameters.forEach((param, idx) =>
          sub_env.define(param.name, evaluated_args[idx]),
        );

        let final_return_value = null;
        for (const stmt of func_entry.declaration.body) {
          const result = yield* evaluate_program(stmt, sub_env);
          if (is_control_flow(result) && result.action === "RETURN") {
            final_return_value = result.value;
            break;
          }
        }
        return final_return_value;
      }
      return null;
    }

    case "SubDeclaration": return null;
    case "ImportStatement": return null;

    case "SwitchStatement": {
      const discriminant_value = (yield* evaluate_program(node.discriminant, env)) as RuntimeValue;
      let matched = false;
      for (const case_node of node.cases) {
        const case_value = (yield* evaluate_program(case_node.value, env)) as RuntimeValue;
        if (discriminant_value && case_value && discriminant_value.value === case_value.value) {
          matched = true;
          for (const stmt of case_node.body) {
            const result = yield* evaluate_program(stmt, env);
            if (is_control_flow(result)) return result;
          }
          break;
        }
      }
      if (!matched && node.default_case) {
        for (const stmt of node.default_case) {
          const result = yield* evaluate_program(stmt, env);
          if (is_control_flow(result)) return result;
        }
      }
      return null;
    }

    case "UnaryExpression": {
      const arg_value = (yield* evaluate_program(node.argument, env)) as RuntimeValue;
      if (!arg_value) return null;
      switch (node.operator) {
        case "-": return { type: arg_value.type, value: -Number(arg_value.value) } as RuntimeValue;
        case "NOT": return { type: "bool", value: !arg_value.value } as RuntimeValue;
        case "~": return { type: "i32", value: ~Number(arg_value.value) } as RuntimeValue;
        default:
          yield { status: "error", message: `Unknown unary operator: '${node.operator}'`, line: node.line, column: node.column };
      }
      return null;
    }

    case "Program": {
      let last_evaluated: any = null;
      for (const statement of node.body) {
        last_evaluated = yield* evaluate_program(statement, env);
      }
      return last_evaluated as RuntimeValue | null;
    }

    default:
      yield { status: "error", message: `Unimplemented AST Node: ${node}` };
      return null;
  }
}
