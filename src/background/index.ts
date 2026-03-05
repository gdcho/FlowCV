import Anthropic from "@anthropic-ai/sdk";
import { handleJDMessages } from "./handlers/jd";
import { handleSettingsMessages } from "./handlers/settings";
import { getSettings } from "./storage";
import { runAIPipeline, CHANGES_SENTINEL } from "./ai/pipeline";
import { buildATSSystemPrompt, buildATSUserPrompt } from "./ai/ats-prompt";
import type { ATSScoreResult } from "@/types/ats";
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
        // chrome.scripting.executeScript bypasses the page's CSP - necessary for Overleaf.
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

      case "RELOAD_AND_CAPTURE": {
        // Reload the tab from the background SW (popup closes on navigation,
        // so the SW must orchestrate reload + capture to survive the page load).
        const { tabId } = message.payload;
        (async () => {
          try {
            await chrome.tabs.reload(tabId);

            // Wait for tab to finish loading (max 15 s).
            const deadline = Date.now() + 15000;
            while (Date.now() < deadline) {
              const tab = await chrome.tabs.get(tabId);
              if (tab.status === "complete") break;
              await new Promise<void>((r) => setTimeout(r, 500));
            }

            // Grace period for content script to initialize.
            await new Promise<void>((r) => setTimeout(r, 800));

            type CaptureResp =
              | { success: true; title: string | null; company: string | null }
              | { success: false; error?: string };

            const resp = await chrome.tabs.sendMessage(tabId, {
              type: "CAPTURE_JD_REQUEST",
            }) as CaptureResp;

            // Re-open the popup so the user sees the captured JD.
            // The popup closes when the tab reloads, so we reopen it here.
            // chrome.action.openPopup() requires Chrome 127+; ignore if unavailable.
            if (resp.success) {
              try {
                await chrome.action.openPopup();
              } catch {
                // Silently ignore - older Chrome or restrictive context
              }
            }

            sendResponse(resp);
          } catch (err: unknown) {
            sendResponse({
              success: false,
              error: err instanceof Error ? err.message : "Reload failed",
            });
          }
        })();
        return true; // async sendResponse
      }

      default:
        return false;
    }
  },
);

// ─── Long-lived streaming connection (onConnect port) ────────────────────────
// Using a port keeps the service worker alive for the full Claude stream duration.

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "FlowCV-ats") {
    port.onMessage.addListener(async (message: RuntimeMessage) => {
      if (message.type !== "ATS_SCORE_REQUEST") return;

      const { resumeText, jd } = message.payload;

      try {
        const { apiKey } = await getSettings();

        if (!apiKey) {
          port.postMessage({
            type: "ATS_SCORE_ERROR",
            payload: { error: "No API key configured. Click the extension icon -> Options to add your Anthropic API key." },
          });
          return;
        }

        const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
        const response = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: buildATSSystemPrompt(),
          messages: [
            { role: "user", content: buildATSUserPrompt(resumeText, jd) },
          ],
        });

        const text =
          response.content[0].type === "text" ? response.content[0].text : "";

        // Extract JSON - Claude may wrap in a code fence despite instructions
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in ATS response");

        const result = JSON.parse(jsonMatch[0]) as ATSScoreResult;
        port.postMessage({ type: "ATS_SCORE_COMPLETE", payload: { result } });
      } catch (err: unknown) {
        const raw = err instanceof Error ? err.message : String(err);
        let friendly = raw;
        if (raw.includes("overloaded")) {
          friendly = "Anthropic API is overloaded. Wait a moment and try again.";
        } else if (raw.includes("529") || raw.includes("rate_limit")) {
          friendly = "API rate limit reached. Wait a moment and try again.";
        } else if (raw.includes("401") || raw.includes("authentication")) {
          friendly = "Invalid API key. Check your key in Options.";
        }
        port.postMessage({
          type: "ATS_SCORE_ERROR",
          payload: { error: friendly },
        });
      }
    });
    return;
  }

  if (port.name !== "FlowCV-analyze") return;

  port.onMessage.addListener(async (message: RuntimeMessage) => {
    if (message.type !== "ANALYZE_REQUEST") return;

    const { blocks, jd, atsResult } = message.payload;

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
        atsResult,
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
      const raw = err instanceof Error ? err.message : String(err);
      let errorMsg = raw;
      if (raw.includes("overloaded")) {
        errorMsg = "Anthropic API is overloaded. Wait a moment and try again.";
      } else if (raw.includes("rate_limit")) {
        errorMsg = "API rate limit reached. Wait a moment and try again.";
      } else if (raw.includes("401") || raw.includes("authentication")) {
        errorMsg = "Invalid API key. Check your key in Options.";
      }
      port.postMessage({
        type: "ANALYZE_ERROR",
        payload: { error: errorMsg },
      });
    }
  });
});
