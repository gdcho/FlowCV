/**
 * bridge-client.ts — Typed postMessage wrapper for the ISOLATED world side.
 *
 * Provides Promise-based APIs over the raw window.postMessage protocol,
 * with timeouts and automatic cleanup.
 */

import type { BridgeMessage } from "@/types/messages";
import { BRIDGE_SOURCE } from "@/types/messages";
import type { ProposedChange } from "@/types/ai";

type MessageHandler = (msg: BridgeMessage) => void;
const handlers = new Set<MessageHandler>();

// Single global listener — avoid duplicating event listeners on re-import
let listenerAttached = false;

function ensureListener() {
  if (listenerAttached) return;
  listenerAttached = true;

  window.addEventListener("message", (event: MessageEvent) => {
    const msg = event.data as BridgeMessage;
    if (!msg || msg.source !== BRIDGE_SOURCE) return;
    handlers.forEach((h) => h(msg));
  });
}

/** Subscribe to bridge messages. Returns a cleanup function. */
export function onBridgeMessage(handler: MessageHandler): () => void {
  ensureListener();
  handlers.add(handler);
  return () => handlers.delete(handler);
}

/** Wait for the bridge to signal it is ready. */
export function waitForBridgeReady(timeoutMs = 15000): Promise<void> {
  ensureListener();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error("[FlowCV] Bridge ready timeout — Monaco may not have loaded"),
      );
    }, timeoutMs);

    const cleanup = onBridgeMessage((msg) => {
      if (msg.type === "LATEX_FLOW_BRIDGE_READY") {
        clearTimeout(timeout);
        cleanup();
        resolve();
      }
    });
  });
}

/**
 * Read LaTeX content directly from CodeMirror 6's DOM elements.
 * Content scripts in the ISOLATED world can query the page DOM directly —
 * no MAIN world bridge required for reading.
 */
function readFromDOM(): string | null {
  // Standard CodeMirror 6 structure: .cm-editor > .cm-scroller > .cm-content > .cm-line*
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

/** Request the current LaTeX content from the editor.
 *
 *  Strategy:
 *  1. Send LATEX_FLOW_GET_CONTENT to the MAIN world bridge (retrying every 800ms).
 *  2. After 3s with no bridge response, fall back to reading .cm-line DOM nodes
 *     directly from the ISOLATED world — works even if bridge injection failed.
 *  3. At full timeout, one final DOM read before rejecting.
 */
export function requestContent(timeoutMs = 20000): Promise<string> {
  ensureListener();
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    let done = false;

    const finish = (content: string) => {
      if (done) return;
      done = true;
      clearTimeout(deadline);
      clearTimeout(domFallbackTimer);
      clearInterval(retryInterval);
      cleanup();
      resolve(content);
    };

    const deadline = setTimeout(() => {
      if (done) return;
      done = true;
      clearInterval(retryInterval);
      clearTimeout(domFallbackTimer);
      cleanup();
      // Last-chance DOM read
      const content = readFromDOM();
      if (content && content.length > 50) resolve(content);
      else reject(new Error("[FlowCV] Could not read editor content"));
    }, timeoutMs);

    // If the bridge hasn't responded within 3s, try the DOM fallback
    const domFallbackTimer = setTimeout(() => {
      if (done) return;
      const content = readFromDOM();
      if (content && content.length > 50) finish(content);
    }, 3000);

    const cleanup = onBridgeMessage((msg) => {
      if (
        msg.type === "LATEX_FLOW_CONTENT_RESPONSE" &&
        msg.requestId === requestId
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        finish((msg as any).payload.content as string);
      }
    });

    const sendRequest = () => {
      if (done) return;
      window.postMessage(
        {
          source: "LATEX_FLOW_CONTENT",
          type: "LATEX_FLOW_GET_CONTENT",
          requestId,
        },
        "*",
      );
    };

    sendRequest();
    const retryInterval = setInterval(sendRequest, 800);
  });
}

/** Apply a list of changes to the editor via the MAIN world bridge.
 *
 *  The bridge uses view.dispatch() / model.pushEditOperations() on the
 *  full in-memory document — safe for CodeMirror 6's virtual DOM where
 *  only visible lines are rendered.
 *
 *  NOTE: The DOM execCommand fallback was intentionally removed. It read
 *  only the rendered (visible) lines and overwrote the entire editor with
 *  truncated content, causing data loss. If the bridge doesn't respond,
 *  this resolves with 0 so ApplyButton shows a clear error.
 */
export function applyChanges(
  changes: Array<Pick<ProposedChange, "original" | "modified">>,
): Promise<number> {
  ensureListener();
  return new Promise((resolve) => {
    let done = false;

    const finish = (count: number) => {
      if (done) return;
      done = true;
      clearTimeout(deadline);
      cleanup();
      resolve(count);
    };

    const deadline = setTimeout(() => {
      finish(-1); // -1 signals timeout (bridge not responding), vs 0 = bridge responded, text not found
    }, 8000);

    const cleanup = onBridgeMessage((msg) => {
      if (msg.type === "LATEX_FLOW_APPLY_DONE") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        finish((msg as any).payload.appliedCount as number);
      }
    });

    window.postMessage(
      {
        source: "LATEX_FLOW_CONTENT",
        type: "LATEX_FLOW_APPLY_CHANGES",
        payload: { changes },
      },
      "*",
    );
  });
}
