import { handleJDMessages } from "./handlers/jd";
import { handleSettingsMessages } from "./handlers/settings";
import { getSettings } from "./storage";
import { runAIPipeline, CHANGES_SENTINEL } from "./ai/pipeline";
import type { RuntimeMessage } from "@/types/messages";

// ─── Short-lived messages (sendMessage) ──────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: RuntimeMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    switch (message.type) {
      case "SAVE_JD":
      case "GET_JD":
        handleJDMessages(message, sendResponse);
        return true; // async

      case "GET_SETTINGS":
      case "SAVE_SETTINGS":
        handleSettingsMessages(message, sendResponse);
        return true; // async

      case "BRIDGE_INJECT_REQUEST": {
        // Inject bridge.js into the Overleaf tab's MAIN world.
        // chrome.scripting.executeScript bypasses the page's CSP — necessary for Overleaf.
        // Return true so the message port stays open until executeScript resolves.
        const tabId = sender.tab?.id;
        if (tabId == null) {
          sendResponse({ ok: false, error: "no tabId" });
          return false;
        }
        chrome.scripting
          .executeScript({
            target: { tabId },
            files: ["src/injected/bridge.js"],
            world: "MAIN",
          })
          .then(() => sendResponse({ ok: true }))
          .catch((err: unknown) => {
            console.error("[FlowCV] Bridge injection failed:", err);
            sendResponse({ ok: false, error: String(err) });
          });
        return true;
      }

      default:
        return false;
    }
  },
);

// ─── Long-lived streaming connection (onConnect port) ────────────────────────
// Using a port keeps the service worker alive for the full Claude stream duration.

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "FlowCV-analyze") return;

  port.onMessage.addListener(async (message: RuntimeMessage) => {
    if (message.type !== "ANALYZE_REQUEST") return;

    const { blocks, jd } = message.payload;

    try {
      const { apiKey, model, maxTokens } = await getSettings();

      if (!apiKey) {
        port.postMessage({
          type: "ANALYZE_ERROR",
          payload: {
            error:
              "No API key configured. Click the extension icon → Options to add your Anthropic API key.",
          },
        });
        return;
      }

      for await (const chunk of runAIPipeline({
        blocks,
        jd,
        apiKey,
        model,
        maxTokens,
      })) {
        // Detect the final sentinel chunk that carries the parsed changes
        if (chunk.startsWith("{") && chunk.includes(CHANGES_SENTINEL)) {
          try {
            const payload = JSON.parse(chunk) as Record<string, unknown>;
            port.postMessage({
              type: "ANALYZE_COMPLETE",
              payload: { changes: payload[CHANGES_SENTINEL] },
            });
          } catch {
            port.postMessage({
              type: "ANALYZE_ERROR",
              payload: { error: "Failed to parse AI response" },
            });
          }
        } else {
          port.postMessage({
            type: "ANALYZE_STREAM_CHUNK",
            payload: { chunk },
          });
        }
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown error occurred";
      port.postMessage({
        type: "ANALYZE_ERROR",
        payload: { error: errorMsg },
      });
    }
  });
});
