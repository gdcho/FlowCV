/**
 * bridge.ts - Runs in the PAGE's MAIN world via chrome.scripting.executeScript.
 *
 * Supports both Monaco Editor (older Overleaf) and CodeMirror 6 (current Overleaf).
 * The message listener is set up immediately - no waiting for editor to load.
 *
 * DO NOT import from other src/ modules. This file compiles as a standalone bundle.
 */

const BRIDGE_SOURCE = "LATEX_FLOW_BRIDGE";
const CONTENT_SOURCE = "LATEX_FLOW_CONTENT";

// ─── Monaco support (older Overleaf) ─────────────────────────────────────────

interface MonacoPos {
  lineNumber: number;
  column: number;
}
interface MonacoModel {
  getValue(): string;
  getPositionAt(offset: number): MonacoPos;
  pushEditOperations(
    b: null,
    ops: Array<{
      range: {
        startLineNumber: number;
        startColumn: number;
        endLineNumber: number;
        endColumn: number;
      };
      text: string;
    }>,
    c: () => null,
  ): void;
  pushStackElement(): void;
}

declare global {
  interface Window {
    monaco?: {
      editor: { getEditors(): Array<{ getModel(): MonacoModel | null }> };
    };
    __LATEX_FLOW_BRIDGE__?: boolean;
  }
}

function getMonacoContent(): string | null {
  if (!window.monaco) return null;
  const editors = window.monaco.editor.getEditors();
  return editors[0]?.getModel()?.getValue() ?? null;
}

function applyMonacoEdit(original: string, modified: string): boolean {
  const model = window.monaco?.editor.getEditors()[0]?.getModel();
  if (!model) return false;
  const full = model.getValue();
  const idx = full.indexOf(original);
  if (idx === -1) return false;
  const s = model.getPositionAt(idx);
  const e = model.getPositionAt(idx + original.length);
  model.pushStackElement();
  model.pushEditOperations(
    null,
    [
      {
        range: {
          startLineNumber: s.lineNumber,
          startColumn: s.column,
          endLineNumber: e.lineNumber,
          endColumn: e.column,
        },
        text: modified,
      },
    ],
    () => null,
  );
  model.pushStackElement();
  return true;
}

// ─── CodeMirror 6 support (current Overleaf, 2023+) ──────────────────────────

type CMEditorView = {
  state: { doc: { toString(): string } };
  dispatch(t: unknown): void;
};

function isEditorView(v: unknown): v is CMEditorView {
  return !!(
    v &&
    typeof v === "object" &&
    (v as CMEditorView).state?.doc &&
    typeof (v as CMEditorView).state.doc.toString === "function" &&
    typeof (v as CMEditorView).dispatch === "function"
  );
}

/**
 * Find the CodeMirror 6 EditorView from the .cm-content DOM element.
 *
 * CM6 sets `element.cmView = ContentView` and ContentView.view → EditorView.
 * However Overleaf's minified CM6 bundle may rename `cmView` to a short key.
 * Strategy:
 *  1. Try the canonical `cmView.view` property (unminified builds).
 *  2. Scan all own enumerable properties of .cm-content for anything that
 *     quacks like an EditorView (has .state.doc + .dispatch) or a ContentView
 *     (has .view.state.doc + .view.dispatch). This handles minified builds.
 */
function getCMView(): CMEditorView | null {
  const contentEl = document.querySelector<HTMLElement>(
    ".cm-editor .cm-content",
  );
  if (!contentEl) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const named = (contentEl as any).cmView?.view;
  if (isEditorView(named)) return named;

  // Scan own enumerable properties - handles minified property names
  for (const key of Object.keys(contentEl as object)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prop = (contentEl as any)[key];
    if (!prop || typeof prop !== "object") continue;
    if (isEditorView(prop)) return prop;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (isEditorView((prop as any).view)) return (prop as any).view;
  }

  return null;
}

function getCodeMirrorContent(): string | null {
  // Primary: access EditorView.state.doc
  const view = getCMView();
  if (view) return view.state.doc.toString();

  // Fallback: reconstruct from visible .cm-line DOM elements
  const contentEl = document.querySelector<HTMLElement>(
    ".cm-editor .cm-content",
  );
  if (!contentEl) return null;
  const lines = contentEl.querySelectorAll(".cm-line");
  if (lines.length === 0) return null;
  return Array.from(lines)
    .map((l) => l.textContent ?? "")
    .join("\n");
}

function applyCodeMirrorEdit(original: string, modified: string): boolean {
  const view = getCMView();
  if (!view) return false;
  const full = view.state.doc.toString();
  const idx = full.indexOf(original);
  if (idx === -1) return false;
  view.dispatch({
    changes: { from: idx, to: idx + original.length, insert: modified },
  });
  return true;
}

// ─── Overleaf compile trigger ─────────────────────────────────────────────────

function triggerCompile(): void {
  // Try multiple selectors - Overleaf's DOM varies across versions
  const selectors = [
    'button[data-ol-tooltip="Recompile"]',
    'button[aria-label="Recompile"]',
    'button[aria-label*="ecompile"]',
    '.btn-recompile',
  ]
  for (const sel of selectors) {
    const btn = document.querySelector<HTMLElement>(sel)
    if (btn) { btn.click(); return }
  }
  // Fallback: scan all buttons for visible "Recompile" text
  for (const btn of document.querySelectorAll<HTMLElement>('button')) {
    if (btn.textContent?.trim().toLowerCase().includes('recompile')) {
      btn.click(); return
    }
  }
  console.warn('[FlowCV Bridge] Could not find Overleaf Recompile button')
}

// ─── Message listener ─────────────────────────────────────────────────────────
// Set up IMMEDIATELY - the Sidebar can call requestContent() at any time.

window.addEventListener("message", (event: MessageEvent) => {
  const msg = event.data as {
    source: string;
    type: string;
    requestId?: string;
    payload?: unknown;
  };
  if (!msg || msg.source !== CONTENT_SOURCE) return;

  switch (msg.type) {
    case "LATEX_FLOW_GET_CONTENT": {
      // Try Monaco first, then CodeMirror 6
      const content = getMonacoContent() ?? getCodeMirrorContent();

      if (!content) {
        // Editor not ready yet - don't respond; requestContent() will retry.
        console.warn(
          "[FlowCV Bridge] Editor not ready - no content found (Monaco + CodeMirror tried)",
        );
        return;
      }

      window.postMessage(
        {
          source: BRIDGE_SOURCE,
          type: "LATEX_FLOW_CONTENT_RESPONSE",
          requestId: msg.requestId,
          payload: { content },
        },
        "*",
      );
      break;
    }

    case "LATEX_FLOW_APPLY_CHANGES": {
      const { changes } = msg.payload as {
        changes: Array<{ original: string; modified: string }>;
      };
      let appliedCount = 0;

      for (const change of changes) {
        const ok =
          applyCodeMirrorEdit(change.original, change.modified) ||
          applyMonacoEdit(change.original, change.modified);
        if (ok) appliedCount++;
        else
          console.warn(
            "[FlowCV Bridge] Could not find text to replace:",
            change.original.slice(0, 60),
          );
      }

      window.postMessage(
        {
          source: BRIDGE_SOURCE,
          type: "LATEX_FLOW_APPLY_DONE",
          payload: { appliedCount },
        },
        "*",
      );

      // Auto-recompile if at least one change was applied
      if (appliedCount > 0) {
        setTimeout(triggerCompile, 300)
      }
      break;
    }
  }
});

// Signal ready right away - listener is already active above.
window.postMessage(
  { source: BRIDGE_SOURCE, type: "LATEX_FLOW_BRIDGE_READY" },
  "*",
);
console.log("[FlowCV] Bridge ready (Monaco + CodeMirror 6 supported)");
