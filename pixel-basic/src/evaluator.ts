import type { ASTNode, Program } from "./ast_types";
import {
  create_environment,
  type Environment,
  type RuntimeResult,
} from "./runtime";

// Define what a control flow signal looks like
export type ControlFlowSignal = {
  type: "ControlFlow";
  action: "BREAK" | "CONTINUE" | "RETURN";
  value?: any; // Only used to pass data back from a RETURN
};

// Type guard to easily check if a returned value is a signal
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
      });
    }
  }
}

export function* evaluate_program(
  node: ASTNode,
  env: Environment,
): Generator<RuntimeResult, any, any> {
  switch (node.type) {
    // --- Literals ---
    case "NumericLiteral":
    case "StringLiteral":
    case "BooleanLiteral":
      return node.value;

    case "Identifier": {
      const value = env.get(node.name);
      if (value === null)
        yield { status: "error", message: `Undefined variable: ${node.name}` };
      return value;
    }

    // --- Expressions ---
    case "BinaryExpression": {
      const left = yield* evaluate_program(node.left, env);
      const right = yield* evaluate_program(node.right, env);

      switch (node.operator) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          return left / right;
        case "%":
          return left % right;
        case "==":
          return left == right;
        case "!=":
          return left != right;
        case "<":
          return left < right;
        case "<=":
          return left <= right;
        case ">":
          return left > right;
        case ">=":
          return left >= right;
        case "AND":
          return left && right;
        case "OR":
          return left || right;
        case "NOT":
          return !left;
        default:
          yield {
            status: "error",
            message: `Unknown operator: '${node.operator}'`,
          };
      }
      return null;
    }

    // --- Variable Declarations ---
    case "VariableDeclaration": {
      const declared_value = yield* evaluate_program(node.value, env);
      env.define(node.target, declared_value);
      return declared_value;
    }

    case "Assignment": {
      if (node.target.type === "Identifier") {
        let assigned_value = yield* evaluate_program(node.value, env);

        // --- Handle compound assignment operators (e.g., +=, -=, etc.) ---
        const current_value = env.get(node.target.name);
        switch (node.operator) {
          case "+=": {
            if (current_value !== null)
              assigned_value = current_value + assigned_value;

            break;
          }
          case "-=": {
            if (current_value !== null)
              assigned_value = current_value - assigned_value;

            break;
          }
          case "*=": {
            if (current_value !== null)
              assigned_value = current_value * assigned_value;
            break;
          }
          case "/=": {
            if (current_value !== null)
              assigned_value = current_value / assigned_value;
            break;
          }
          case "%=": {
            if (current_value !== null)
              assigned_value = current_value % assigned_value;
            break;
          }
        }
        const success = env.assign(node.target.name, assigned_value);
        if (!success) {
          yield {
            status: "error",
            message: `Cannot assign to undefined variable: ${node.target.name}`,
          };
        }
      } else if (node.target.type === "IndexExpression") {
        // 1. Evaluate the value being assigned
        let assigned_value = yield* evaluate_program(node.value, env);

        // 2. Evaluate the object (the array or dictionary)
        const target_object = yield* evaluate_program(node.target.object, env);

        if (
          !target_object ||
          (typeof target_object !== "object" && !Array.isArray(target_object))
        ) {
          yield { status: "error", message: `Cannot index into a non-object.` };
          return null;
        }

        // 3. Evaluate the index/key
        const index_value = yield* evaluate_program(node.target.index, env);

        // 4. Handle compound operators for array/dict elements
        switch (node.operator) {
          case "+=":
            assigned_value = target_object[index_value] + assigned_value;
            break;
          case "-=":
            assigned_value = target_object[index_value] - assigned_value;
            break;
          case "*=":
            assigned_value = target_object[index_value] * assigned_value;
            break;
          case "/=":
            assigned_value = target_object[index_value] / assigned_value;
            break;
          case "%=":
            assigned_value = target_object[index_value] % assigned_value;
            break;
        }

        // 5. Apply the mutation
        target_object[index_value] = assigned_value;
      }
      return null;
    }

    case "IndexExpression": {
      const target_object = yield* evaluate_program(node.object, env);
      const index_value = yield* evaluate_program(node.index, env);

      if (!target_object) {
        yield { status: "error", message: "Cannot read index of undefined." };
        return null;
      }

      const result = target_object[index_value];

      if (result === undefined) {
        yield {
          status: "error",
          message: `Index '${index_value}' out of bounds or missing.`,
        };
        return null;
      }

      return result;
    }

    case "ArrayLiteral": {
      const elements = [];
      for (const element of node.elements) {
        elements.push(yield* evaluate_program(element, env));
      }
      return elements;
    }

    case "DictionaryLiteral": {
      const dict: Record<string, any> = {};
      for (const prop of node.properties) {
        dict[prop.key] = yield* evaluate_program(prop.value, env);
      }
      return dict;
    }

    case "BreakStatement":
      return { type: "ControlFlow", action: "BREAK" };

    case "ContinueStatement":
      return { type: "ControlFlow", action: "CONTINUE" };

    case "ReturnStatement": {
      // Evaluate the expression to the right of RETURN, if it exists
      const return_value = node.argument
        ? yield* evaluate_program(node.argument, env)
        : null;
      return { type: "ControlFlow", action: "RETURN", value: return_value };
    }

    case "IfStatement": {
      const condition_value = yield* evaluate_program(node.condition, env);

      if (condition_value) {
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
        } else {
          if (node.alternate.type === "IfStatement") {
            const result = yield* evaluate_program(node.alternate, env);
            if (is_control_flow(result)) return result;
          }
        }
      }

      return null;
    }

    case "WhileStatement": {
      while (yield* evaluate_program(node.condition, env)) {
        let break_loop = false;
        for (const stmt of node.body) {
          const result = yield* evaluate_program(stmt, env);
          if (is_control_flow(result)) {
            if (result.action === "BREAK") {
              break_loop = true;
              break;
            }
            if (result.action === "CONTINUE") {
              break;
            }
            if (result.action === "RETURN") {
              return result;
            }
          }
        }

        if (break_loop) break;
        yield { status: "running" }; // Yield control back to the caller after each iteration
      }
      return null;
    }

    // --- Functions ---
    case "FunctionCall": {
      const func_entry = env.functionMap.get(node.caller);
      if (!func_entry) {
        yield {
          status: "error",
          message: `Undefined function: ${node.caller}`,
        };
        return null;
      }

      const evaluated_args: ASTNode[] = [];
      for (const arg of node.args)
        evaluated_args.push(yield* evaluate_program(arg, env));

      if (evaluated_args.length !== func_entry.arity) {
        yield {
          status: "error",
          message: `Function ${node.caller} expects ${func_entry.arity} arguments, but got ${evaluated_args.length}.`,
        };
        return null;
      }

      if (func_entry.is_native && func_entry.native_fn)
        return func_entry.native_fn(...evaluated_args);
      else if (func_entry.declaration) {
        const sub_env = create_environment(env, env.functionMap);

        func_entry.declaration.parameters.forEach((param_name, idx) =>
          sub_env.define(param_name, evaluated_args[idx]),
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

    case "Program": {
      let last_evaluated = null;
      for (const statement of node.body) {
        last_evaluated = yield* evaluate_program(statement, env);
      }
      return last_evaluated;
    }

    default:
      yield {
        status: "error",
        message: `Unimplemented AST Node: ${node.type}`,
      };
      return null;
  }
}
