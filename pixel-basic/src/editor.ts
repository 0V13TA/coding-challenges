import { basicSetup } from "codemirror";
import {
  EditorView,
  keymap,
  Decoration,
  type DecorationSet,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { EditorState, RangeSetBuilder } from "@codemirror/state";
import { autocompletion, CompletionContext } from "@codemirror/autocomplete";
import {
  defaultKeymap,
  historyField,
  indentWithTab,
} from "@codemirror/commands";
// Import tokenize to scan the live document
import { KEYWORDS, tokenize } from "./tokenizer";

// --- Custom Theme ---
const pixelBasicTheme = EditorView.theme(
  {
    "&": {
      color: "var(--text-main)",
      backgroundColor: "transparent",
      height: "100%",
      fontSize: "1rem",
    },
    ".cm-content": { fontFamily: "var(--font-mono)", padding: "16px 0" },
    ".cm-gutters": {
      backgroundColor: "var(--bg-base)",
      color: "var(--text-muted)",
      borderRight: "2px solid rgba(203, 166, 247, 0.2)",
      paddingRight: "8px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      color: "var(--text-accent)",
    },
    ".cm-activeLine": { backgroundColor: "rgba(255, 255, 255, 0.05)" },
    ".cm-cursor": {
      borderLeftColor: "var(--text-accent)",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "rgba(203, 166, 247, 0.3) !important",
      },
    ".cm-tooltip.cm-tooltip-autocomplete": {
      backgroundColor: "var(--bg-base)",
      border: "2px solid var(--text-accent)",
      color: "var(--text-muted)",
      boxShadow: "var(--ui-shadow)",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "var(--text-accent)",
      color: "var(--bg-base)",
      fontWeight: "bold",
    },
    // Custom Syntax Token Colors
    ".cm-comment": {
      color: "var(--color-comment)",
      fontStyle: "italic",
      opacity: "0.8",
    },
    ".cm-keyword": { color: "var(--color-keyword)", fontWeight: "600" },
    ".cm-function": { color: "var(--color-function)" },
    ".cm-literal": { color: "var(--color-literal)" },
    ".cm-operator": { color: "var(--color-operator)" },
  },
  { dark: true },
);

// --- Custom Regex Syntax Highlighter ---
const builtinsArray = [
  "CREATE_BUFFER",
  "BIND_BUFFER",
  "DRAW_BUFFER",
  "FREE_BUFFER",
  "SCREEN",
  "FILL_COLOR",
  "STROKE_COLOR",
  "STROKE_WEIGHT",
  "NO_FILL",
  "NO_STROKE",
  "CLEAR_SCREEN",
  "DRAW_RECT",
  "DRAW_CIRCLE",
  "DRAW_LINE",
  "DRAW_TRIANGLE",
  "DRAW_TEXT",
  "DRAW_IMAGE",
  "SET_FONT",
  "TEXT_ALIGN",
  "PUSH_MATRIX",
  "POP_MATRIX",
  "TRANSLATE",
  "ROTATE",
  "SQRT",
  "POW",
  "ABS",
  "FLOOR",
  "CEIL",
  "SIN",
  "COS",
  "TAN",
  "ATAN2",
  "CLAMP",
  "LERP",
  "RND",
  "PRINT",
  "IS_KEY_DOWN",
  "PI",
  "TWO_PI",
  "HALF_PI",
  "MOUSE_X",
  "MOUSE_Y",
  "MOUSE_DOWN",
  "SCR_W",
  "SCR_H",
  "HOST_W",
  "HOST_H",
];

const keywordsRegexStr = Array.from(KEYWORDS).join("|");
const builtinsRegexStr = builtinsArray.join("|");

// Captures: 1:Comment, 2:String, 3:Keyword, 4:Function, 5:Boolean, 6:Number, 7:Operator, 8:Negative Number
const syntaxRegex = new RegExp(
  `(REM.*)|("[^"]*"|'[^']*')|\\b(${keywordsRegexStr})\\b|\\b(${builtinsRegexStr})\\b|\\b(TRUE|FALSE)\\b|(-?\\b\\d+(?:\\.\\d+)?)\\b|([+\\-*/%<>=!&|^~\\[\\](){},:]+)`,
  "gi",
);

const syntaxHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.getDeco(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged)
        this.decorations = this.getDeco(update.view);
    }

    getDeco(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>();
      for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to);
        let match;
        syntaxRegex.lastIndex = 0;
        while ((match = syntaxRegex.exec(text)) !== null) {
          const start = from + match.index;
          const end = start + match[0].length;
          if (match[1])
            builder.add(start, end, Decoration.mark({ class: "cm-comment" }));
          else if (match[2])
            builder.add(start, end, Decoration.mark({ class: "cm-literal" }));
          else if (match[3])
            builder.add(start, end, Decoration.mark({ class: "cm-keyword" }));
          else if (match[4])
            builder.add(start, end, Decoration.mark({ class: "cm-function" }));
          else if (match[5])
            builder.add(start, end, Decoration.mark({ class: "cm-literal" }));
          else if (match[6])
            builder.add(start, end, Decoration.mark({ class: "cm-literal" }));
          else if (match[7])
            builder.add(start, end, Decoration.mark({ class: "cm-operator" }));
        }
      }
      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations },
);

// --- Autocomplete Provider ---
function pixelBasicCompletions(context: CompletionContext) {
  const word = context.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  // 1. Static Options
  const keywordOptions = Array.from(KEYWORDS).map((kw) => ({
    label: kw,
    type: "keyword",
  }));

  const builtinOptions = builtinsArray.map((fn) => ({
    label: fn,
    type: "function",
  }));

  // 2. Dynamic Source Scanning
  const sourceCode = context.state.doc.toString();
  const { tokens } = tokenize(sourceCode); // Tokenize the live document

  const userVars = new Set<string>();
  const userFuncs = new Set<string>();

  // Extract variables, functions, and parameters based on sequence
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Variables: LET <ID> or CONST <ID>
    if (
      (token.type === "LET" || token.type === "CONST") &&
      tokens[i + 1]?.type === "ID"
    ) {
      userVars.add(tokens[i + 1].value);
    }
    // Subroutines: SUB <ID> param1, param2 THEN
    else if (token.type === "SUB" && tokens[i + 1]?.type === "ID") {
      userFuncs.add(tokens[i + 1].value);

      // Lookahead to gather parameters inside the function signature
      let j = i + 2;
      while (
        j < tokens.length &&
        tokens[j].type !== "THEN" &&
        tokens[j].type !== "NEWLINE"
      ) {
        if (tokens[j].type === "ID") userVars.add(tokens[j].value);
        j++;
      }
    }
  }

  // Format sets into CodeMirror options
  const userVarOptions = Array.from(userVars).map((v) => ({
    label: v,
    type: "variable",
  }));
  const userFuncOptions = Array.from(userFuncs).map((f) => ({
    label: f,
    type: "function",
  }));

  return {
    from: word.from,
    options: [
      ...keywordOptions,
      ...builtinOptions,
      ...userVarOptions,
      ...userFuncOptions,
    ],
  };
}

// --- Serialization ---
export function serializeEditorState(view: EditorView) {
  return view.state.toJSON({ history: historyField });
}

// --- Initialization ---
export function createEditor(
  parentContainer: HTMLElement,
  initialData: string | any,
  onRun: (code: string) => void,
): EditorView {
  const extensions = [
    basicSetup,
    pixelBasicTheme,
    syntaxHighlightPlugin,
    autocompletion({ override: [pixelBasicCompletions] }),
    keymap.of([
      ...defaultKeymap,
      indentWithTab,
      {
        key: "Shift-Enter",
        run: (view) => {
          onRun(view.state.doc.toString());
          return true;
        },
        preventDefault: true,
      },
    ]),
  ];

  let state;
  if (typeof initialData === "string") {
    state = EditorState.create({ doc: initialData, extensions });
  } else {
    state = EditorState.fromJSON(
      initialData,
      { extensions },
      { history: historyField },
    );
  }

  return new EditorView({
    state,
    parent: parentContainer,
  });
}
