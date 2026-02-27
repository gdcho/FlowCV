import { useEffect, useRef, useState } from "react";
import { LOGO_DATA_URL } from "@/logo";
import { useSidebarStore } from "@/store/sidebar-store";
import { useJDStore } from "@/store/jd-store";
import { StatusIndicator } from "../components/StatusIndicator";
import { JobContextPanel } from "../components/JobContextPanel";
import { BlockList } from "../components/BlockList";
import { ChangePreview } from "../components/ChangePreview";
import { ApplyButton } from "../components/ApplyButton";
import { requestContent } from "../bridge-client";
import { parseLatexDocument } from "@/lib/latex-parser";
import type { RuntimeMessage } from "@/types/messages";
import type { ProposedChange } from "@/types/ai";
import { TOGGLE_EVENT } from "./mount";

function isRuntimeValid(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [contextInvalid, setContextInvalid] = useState(!isRuntimeValid());
  const {
    status,
    blocks,
    proposedChanges,
    streamingText,
    errorMessage,
    selectedChangeIds,
    setStatus,
    setBlocks,
    appendStreamChunk,
    setProposedChanges,
    setError,
    toggleChangeSelection,
    selectAllChanges,
    deselectAllChanges,
    reset,
  } = useSidebarStore();

  const {
    jobContext,
    isLoading: jdLoading,
    fetchError: jdError,
    fetch: fetchJD,
    clear: clearJD,
  } = useJDStore();
  const portRef = useRef<chrome.runtime.Port | null>(null);

  // Listen for toggle events dispatched by the external toggle button
  useEffect(() => {
    const handler = () => setIsOpen((v) => !v);
    document.addEventListener(TOGGLE_EVENT, handler);
    return () => document.removeEventListener(TOGGLE_EVENT, handler);
  }, []);

  // Shift the external toggle button left when sidebar panel is open
  useEffect(() => {
    const btn = document.getElementById(
      "FlowCV-toggle",
    ) as HTMLButtonElement | null;
    if (btn) btn.style.right = isOpen ? "300px" : "0";
  }, [isOpen]);

  // Fetch JD on mount
  useEffect(() => {
    if (!isRuntimeValid()) {
      setContextInvalid(true);
      return;
    }
    fetchJD().catch(console.error);
  }, [fetchJD]);

  function handleAnalyze() {
    if (status === "loading" || status === "streaming") return;

    if (!isRuntimeValid()) {
      setContextInvalid(true);
      return;
    }

    reset();
    setStatus("loading");

    // Step 1: Read LaTeX from Monaco
    requestContent()
      .then((content) => {
        const parsed = parseLatexDocument(content);
        setBlocks(parsed);

        if (!jobContext) {
          setError(
            "No job description captured. Visit a LinkedIn or Indeed page first.",
          );
          return;
        }

        if (parsed.length === 0) {
          setError(
            "No LaTeX blocks found. Make sure your Overleaf project is open and loaded.",
          );
          return;
        }

        // Step 2: Connect a long-lived port and stream AI analysis
        let port: chrome.runtime.Port;
        try {
          port = chrome.runtime.connect({ name: "FlowCV-analyze" });
        } catch (err) {
          setContextInvalid(true);
          return;
        }
        portRef.current = port;

        port.onMessage.addListener((msg: RuntimeMessage) => {
          if (msg.type === "ANALYZE_STREAM_CHUNK") {
            setStatus("streaming");
            appendStreamChunk(msg.payload.chunk);
          } else if (msg.type === "ANALYZE_COMPLETE") {
            setStatus("complete");
            setProposedChanges(msg.payload.changes as ProposedChange[]);
            port.disconnect();
          } else if (msg.type === "ANALYZE_ERROR") {
            setError(msg.payload.error);
            port.disconnect();
          }
        });

        port.onDisconnect.addListener(() => {
          portRef.current = null;
        });

        port.postMessage({
          type: "ANALYZE_REQUEST",
          payload: { blocks: parsed, jd: jobContext },
        });
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : "Could not read Overleaf editor. Is a project open?",
        );
      });
  }

  // The toggle button is rendered outside the shadow DOM (in mount.ts).
  // This component only renders the panel itself.
  if (!isOpen) return null;

  return (
    <div
      style={{
        pointerEvents: "auto",
        width: "288px",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#f9fafb",
        borderLeft: "1px solid #e5e7eb",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          background: "#398453",
          color: "white",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <img
            src={LOGO_DATA_URL}
            width={18}
            height={18}
            style={{ borderRadius: 3 }}
            alt=""
          />
          <span style={{ fontSize: "14px", fontWeight: 700 }}>FlowCV</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: "none",
            border: "none",
            color: "#9cc1a9",
            cursor: "pointer",
            padding: "2px",
          }}
        >
          <svg
            width="16"
            height="16"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Extension context invalidated banner */}
      {contextInvalid && (
        <div
          style={{
            margin: "8px 12px",
            padding: "10px 12px",
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: "8px",
          }}
        >
          <p
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#92400e",
              margin: 0,
            }}
          >
            Extension reloaded
          </p>
          <p style={{ fontSize: "10px", color: "#b45309", margin: "3px 0 0" }}>
            Refresh this page to reconnect (Cmd+Shift+R)
          </p>
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto py-3">
        <JobContextPanel
          jobContext={jobContext}
          isLoading={jdLoading}
          fetchError={jdError}
          onRefresh={() => void fetchJD()}
          onClear={clearJD}
        />

        <StatusIndicator
          status={status}
          errorMessage={errorMessage}
          streamingText={streamingText}
        />

        {(status === "complete" || status === "applied") && (
          <>
            <ChangePreview
              changes={proposedChanges}
              selectedIds={selectedChangeIds}
              onToggle={toggleChangeSelection}
              onSelectAll={selectAllChanges}
              onDeselectAll={deselectAllChanges}
            />
            <ApplyButton
              changes={proposedChanges}
              selectedIds={selectedChangeIds}
              onApplied={() => setStatus("applied")}
            />
          </>
        )}

        {(status === "idle" ||
          status === "complete" ||
          status === "applied") && <BlockList blocks={blocks} />}
      </div>

      {/* Footer analyze button */}
      <div className="shrink-0 px-3 py-2.5 border-t border-gray-200 bg-white">
        <button
          onClick={handleAnalyze}
          disabled={
            status === "loading" || status === "streaming" || !jobContext
          }
          className="w-full py-2 px-4 rounded-lg bg-ov hover:bg-ov-dark disabled:bg-ov-light text-white text-sm font-semibold transition-colors"
        >
          {status === "loading" || status === "streaming"
            ? "Analyzing…"
            : status === "applied"
              ? "Re-Analyze"
              : "Analyze & Tailor"}
        </button>
        {!jobContext && (
          <p className="text-[10px] text-gray-400 text-center mt-1">
            Capture a JD from LinkedIn/Indeed first
          </p>
        )}
      </div>
    </div>
  );
}
