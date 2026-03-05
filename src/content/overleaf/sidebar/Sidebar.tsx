import { useEffect, useRef, useState } from "react";
import { LOGO_DATA_URL } from "@/logo";
import { useSidebarStore } from "@/store/sidebar-store";
import { useJDStore } from "@/store/jd-store";
import { StatusIndicator } from "../components/StatusIndicator";
import { JobContextPanel } from "../components/JobContextPanel";
import { ChangePreview } from "../components/ChangePreview";
import { ApplyButton } from "../components/ApplyButton";
import { ATSScorePanel } from "../components/ATSScorePanel";
import { requestContent } from "../bridge-client";
import { parseLatexDocument } from "@/lib/latex-parser";
import type { RuntimeMessage } from "@/types/messages";
import type { ProposedChange } from "@/types/ai";
import type { ATSScoreResult } from "@/types/ats";
import { TOGGLE_EVENT } from "./mount";

function isRuntimeValid(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5 text-ov shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function Section({
  title,
  badge,
  summary,
  defaultOpen = true,
  children,
}: {
  title: string;
  badge?: string | number;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mx-3 mb-2 rounded-lg border border-gray-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{title}</span>
          {badge != null && (
            <span className="text-[10px] font-semibold text-ov bg-ov-pale px-1.5 py-0.5 rounded-full">{badge}</span>
          )}
        </div>
        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={2.5}
          className={`text-gray-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {!open && summary && (
        <p className="px-3 py-1.5 text-xs text-gray-500 truncate border-t border-gray-100">{summary}</p>
      )}
      {open && <div className="border-t border-gray-100 pt-1 pb-1">{children}</div>}
    </div>
  );
}

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [contextInvalid, setContextInvalid] = useState(!isRuntimeValid());
  const {
    status,
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

  const [atsStatus, setAtsStatus] = useState<"idle" | "loading" | "complete" | "error">("idle");
  const [atsResult, setAtsResult] = useState<ATSScoreResult | null>(null);
  const [atsError, setAtsError] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => setIsOpen((v) => !v);
    document.addEventListener(TOGGLE_EVENT, handler);
    return () => document.removeEventListener(TOGGLE_EVENT, handler);
  }, []);

  useEffect(() => {
    const btn = document.getElementById("FlowCV-toggle") as HTMLButtonElement | null;
    if (btn) btn.style.right = isOpen ? "288px" : "0";
  }, [isOpen]);

  useEffect(() => {
    if (!isRuntimeValid()) { setContextInvalid(true); return; }
    fetchJD().catch(console.error);
  }, [fetchJD]);

  function handleAnalyze() {
    if (status === "loading" || status === "streaming") return;
    if (!isRuntimeValid()) { setContextInvalid(true); return; }

    reset();
    setStatus("loading");

    requestContent()
      .then((content) => {
        const parsed = parseLatexDocument(content);
        setBlocks(parsed);

        if (!jobContext) {
          setError("No job description captured. Visit a LinkedIn job posting first.");
          return;
        }
        if (parsed.length === 0) {
          setError("No LaTeX blocks found. Make sure your Overleaf project is open and loaded.");
          return;
        }

        let port: chrome.runtime.Port;
        try {
          port = chrome.runtime.connect({ name: "FlowCV-analyze" });
        } catch {
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

        port.onDisconnect.addListener(() => { portRef.current = null; });
        port.postMessage({
          type: "ANALYZE_REQUEST",
          payload: { blocks: parsed, jd: jobContext, atsResult: atsResult ?? undefined },
        });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not read Overleaf editor. Is a project open?");
      });
  }

  function handleATSCheck() {
    if (atsStatus === "loading") return;
    if (!isRuntimeValid()) { setContextInvalid(true); return; }

    setAtsStatus("loading");
    setAtsResult(null);
    setAtsError(null);

    requestContent()
      .then((resumeText) => {
        if (!jobContext) {
          setAtsStatus("error");
          setAtsError("No job description captured. Visit a LinkedIn job posting first.");
          return;
        }

        let port: chrome.runtime.Port;
        try {
          port = chrome.runtime.connect({ name: "FlowCV-ats" });
        } catch {
          setContextInvalid(true);
          return;
        }

        port.onMessage.addListener((msg: RuntimeMessage) => {
          if (msg.type === "ATS_SCORE_COMPLETE") {
            setAtsStatus("complete");
            setAtsResult(msg.payload.result);
            port.disconnect();
          } else if (msg.type === "ATS_SCORE_ERROR") {
            setAtsStatus("error");
            setAtsError(msg.payload.error);
            port.disconnect();
          }
        });

        port.postMessage({ type: "ATS_SCORE_REQUEST", payload: { resumeText, jd: jobContext } });
      })
      .catch((err: unknown) => {
        setAtsStatus("error");
        setAtsError(err instanceof Error ? err.message : "Could not read Overleaf editor. Is a project open?");
      });
  }

  if (!isOpen) return null;

  const analyzeDisabled = status === "loading" || status === "streaming" || !jobContext;
  const atsDisabled = atsStatus === "loading" || !jobContext;
  const showChanges = status === "complete" || status === "applied";

  return (
    <div
      className="flex flex-col overflow-hidden bg-gray-50 border-l border-gray-200"
      style={{ pointerEvents: "auto", width: "288px", height: "100vh", boxShadow: "-4px 0 20px rgba(0,0,0,0.12)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-ov shrink-0">
        <div className="flex items-center gap-2">
          <img src={LOGO_DATA_URL} width={26} height={26} className="rounded" alt="" />
          <span className="text-sm font-bold text-white">FlowCV</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white transition-colors p-0.5" aria-label="Close sidebar">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Extension context invalidated banner */}
      {contextInvalid && (
        <div className="mx-3 mt-2.5 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-[11px] font-semibold text-amber-800">Extension reloaded</p>
          <p className="text-[10px] text-amber-600 mt-0.5">Refresh this page to reconnect (Cmd+Shift+R)</p>
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto pt-2">

        {/* Job description */}
        <Section
          title="Job Description"
          summary={jobContext ? `${jobContext.title ?? "Untitled"} @ ${jobContext.company ?? "Unknown"}` : "No job description captured"}
        >
          <JobContextPanel
            jobContext={jobContext}
            isLoading={jdLoading}
            fetchError={jdError}
            onRefresh={() => void fetchJD()}
            onClear={clearJD}
          />
        </Section>

        {/* ATS score */}
        {atsStatus !== "idle" && (
          <Section
            title="ATS Score"
            badge={atsResult ? `${atsResult.overall}/100` : undefined}
            summary={
              atsResult
                ? `${atsResult.overall >= 70 ? "Good" : atsResult.overall >= 50 ? "Moderate" : "Low"} match · ${atsResult.missingKeywords.slice(0, 3).join(", ")}${atsResult.missingKeywords.length > 3 ? " +more" : ""} missing`
                : atsStatus === "loading" ? "Scoring…" : undefined
            }
          >
            <div className="px-3 py-2">
              {atsStatus === "loading" && (
                <div className="flex items-center gap-2 rounded-lg bg-ov-pale border border-ov-light p-3">
                  <Spinner />
                  <p className="text-xs text-ov-dark">Scoring against ATS criteria…</p>
                </div>
              )}
              {atsStatus === "error" && atsError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-xs font-semibold text-red-700 mb-0.5">Scoring failed</p>
                  <p className="text-xs text-red-600">{atsError}</p>
                </div>
              )}
              {atsStatus === "complete" && atsResult && (
                <ATSScorePanel result={atsResult} />
              )}
            </div>
          </Section>
        )}

        {/* Analyze status */}
        <StatusIndicator status={status} errorMessage={errorMessage} streamingText={streamingText} />

        {/* Suggested changes */}
        {showChanges && (
          <Section
            title="Suggested Changes"
            badge={proposedChanges.length > 0 ? proposedChanges.length : undefined}
            summary={
              proposedChanges.length === 0
                ? "Already well-matched - no changes needed"
                : proposedChanges.slice(0, 2).map((c) => c.block?.label ?? c.blockId).join(", ") + (proposedChanges.length > 2 ? ` +${proposedChanges.length - 2} more` : "")
            }
            defaultOpen={true}
          >
            {proposedChanges.length === 0 ? (
              <div className="mx-3 my-2 p-3 rounded-lg bg-ov-pale border border-ov-light">
                <p className="text-xs font-semibold text-ov-dark mb-0.5">Already well-matched</p>
                <p className="text-xs text-ov">No changes needed - your resume is a strong match for this role.</p>
              </div>
            ) : (
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
          </Section>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-3 py-2.5 border-t border-gray-200 bg-white space-y-1.5">
        <button
          onClick={handleAnalyze}
          disabled={analyzeDisabled}
          className="w-full py-2 rounded-lg bg-ov disabled:bg-ov-light text-white text-sm font-semibold transition-colors hover:bg-ov-dark disabled:cursor-default"
        >
          {status === "loading" || status === "streaming"
            ? "Analyzing…"
            : status === "applied"
              ? atsResult ? "Re-Analyze (with ATS)" : "Re-Analyze"
              : atsResult ? "Analyze & Tailor (with ATS)" : "Analyze & Tailor"}
        </button>

        <button
          onClick={handleATSCheck}
          disabled={atsDisabled}
          className="w-full py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 text-xs font-semibold transition-colors hover:bg-gray-50 hover:text-gray-800 disabled:opacity-40 disabled:cursor-default"
        >
          {atsStatus === "loading" ? "Scoring…" : atsStatus === "complete" ? "Re-score ATS" : "Check ATS Score"}
        </button>

        {!jobContext && (
          <p className="text-[10px] text-gray-400 text-center">Capture a JD from LinkedIn first</p>
        )}
      </div>
    </div>
  );
}
