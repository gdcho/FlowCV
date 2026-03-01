import { useState, useEffect } from "react";
import type { JobContext } from "@/types/job";
import { LOGO_DATA_URL, OVERLEAF_LOGO_URL } from "../logo";

interface Settings {
  apiKey?: string;
}
type CaptureStatus =
  | "idle"
  | "capturing"
  | "success"
  | "error"
  | "not-job-page";

type PageContext = "none" | "feed" | "posting";

function getPageContext(url: string): PageContext {
  if (!url) return "none";
  // LinkedIn: actual job posting has currentJobId in query OR /jobs/view/ in path
  if (url.includes("linkedin.com")) {
    return url.includes("currentJobId=") || url.includes("/jobs/view/")
      ? "posting"
      : "feed";
  }
  // Indeed: actual job posting has viewjob in path or jk= param
  if (url.includes("indeed.com")) {
    return url.includes("viewjob") || url.includes("jk=")
      ? "posting"
      : "feed";
  }
  return "none";
}

export default function Popup() {
  const [jd, setJD] = useState<JobContext | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>("idle");
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [activeTabUrl, setActiveTabUrl] = useState<string>("");

  useEffect(() => {
    async function load() {
      try {
        const [jdResp, settingsResp, tabs] = await Promise.all([
          chrome.runtime.sendMessage({ type: "GET_JD" }),
          chrome.runtime.sendMessage({ type: "GET_SETTINGS" }),
          chrome.tabs.query({ active: true, currentWindow: true }),
        ]);
        setJD((jdResp as { payload: JobContext | null }).payload);
        setSettings((settingsResp as { payload: Settings }).payload ?? {});
        setActiveTabUrl(tabs[0]?.url ?? "");
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load().catch(console.error);
  }, []);

  async function handleCapture() {
    setCaptureStatus("capturing");
    setCaptureError(null);

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) throw new Error("No active tab");

      type CaptureResp =
        | { success: true; title: string | null; company: string | null }
        | { success: false; error?: string };

      async function sendCapture(tabId: number): Promise<CaptureResp> {
        return chrome.tabs.sendMessage(tabId, {
          type: "CAPTURE_JD_REQUEST",
        }) as Promise<CaptureResp>;
      }

      let resp: CaptureResp;
      try {
        resp = await sendCapture(tab.id);
      } catch (connErr) {
        const msg =
          connErr instanceof Error ? connErr.message : String(connErr);
        if (
          msg.includes("Receiving end does not exist") ||
          msg.includes("Could not establish connection")
        ) {
          // Content script not yet active on this tab - happens when the
          // extension was just installed/updated and the tab predates it.
          setCaptureStatus("error");
          setCaptureError("Refresh the page and try again");
          return;
        }
        throw connErr;
      }

      if (resp.success) {
        setCaptureStatus("success");
        const jdResp = await chrome.runtime.sendMessage({ type: "GET_JD" });
        setJD((jdResp as { payload: JobContext | null }).payload);
      } else {
        setCaptureStatus("error");
        setCaptureError(
          resp.error ?? "Could not find job description on this page",
        );
      }
    } catch (err) {
      setCaptureStatus("error");
      setCaptureError(
        err instanceof Error ? err.message : "Failed to connect to tab",
      );
    }
  }

  function handleClearJD() {
    chrome.runtime
      .sendMessage({ type: "SAVE_JD", payload: null })
      .catch(() => {});
    setJD(null);
    setCaptureStatus("idle");
  }

  const hasApiKey = Boolean(settings.apiKey);
  const pageContext = getPageContext(activeTabUrl);

  return (
    <div
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", width: 320 }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #398453, #086528)",
          color: "white",
          padding: "0.875rem 1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <img
            src={LOGO_DATA_URL}
            width={20}
            height={20}
            style={{ borderRadius: 3 }}
            alt=""
          />
          <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>FlowCV</span>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            padding: "1.25rem",
            textAlign: "center",
            color: "#9ca3af",
            fontSize: "0.8125rem",
          }}
        >
          Loading…
        </div>
      ) : (
        <div
          style={{
            padding: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.625rem",
          }}
        >
          {/* ── API key row ── */}
          <Row
            dot={hasApiKey ? "green" : "amber"}
            label={
              hasApiKey
                ? "API key configured"
                : "API key missing - click Settings"
            }
            action={
              <SmallBtn onClick={() => chrome.runtime.openOptionsPage()}>
                Settings
              </SmallBtn>
            }
          />

          {/* ── JD section ── */}
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "0.625rem",
              overflow: "hidden",
            }}
          >
            {/* Current JD */}
            <div style={{ padding: "0.625rem 0.75rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: jd ? "0.375rem" : 0,
                }}
              >
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Job Description
                </span>
                {jd && (
                  <button
                    onClick={handleClearJD}
                    style={{
                      ...linkStyle,
                      color: "#ef4444",
                      fontSize: "0.6875rem",
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {jd ? (
                <div>
                  <p
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "#111827",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {jd.title ?? "Untitled Position"}
                  </p>
                  {jd.company && (
                    <p
                      style={{
                        fontSize: "0.6875rem",
                        color: "#6b7280",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {jd.company}
                    </p>
                  )}

                  {/* Summary */}
                  {jd.summary && (
                    <p
                      style={{
                        fontSize: "0.6875rem",
                        color: "#4b5563",
                        marginTop: "0.375rem",
                        lineHeight: 1.45,
                      }}
                    >
                      {jd.summary}
                    </p>
                  )}

                  {/* Qualifications */}
                  {jd.qualifications && jd.qualifications.length > 0 && (
                    <div style={{ marginTop: "0.375rem" }}>
                      <p
                        style={{
                          fontSize: "0.625rem",
                          fontWeight: 600,
                          color: "#6b7280",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          marginBottom: "0.2rem",
                        }}
                      >
                        Qualifications
                      </p>
                      <ul
                        style={{
                          margin: 0,
                          padding: 0,
                          listStyle: "none",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.125rem",
                        }}
                      >
                        {jd.qualifications.map((q, i) => (
                          <li
                            key={i}
                            style={{
                              fontSize: "0.6875rem",
                              color: "#374151",
                              display: "flex",
                              gap: "0.3rem",
                              alignItems: "flex-start",
                            }}
                          >
                            <span
                              style={{
                                color: "#6ba37e",
                                flexShrink: 0,
                                marginTop: "0.05rem",
                              }}
                            >
                              ›
                            </span>
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Keyword chips - capped at 8 */}
                  {jd.keywords.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.25rem",
                        marginTop: "0.375rem",
                      }}
                    >
                      {jd.keywords.slice(0, 8).map((kw) => (
                        <span
                          key={kw}
                          style={{
                            background: "#cee0d4",
                            color: "#086528",
                            fontSize: "0.625rem",
                            fontWeight: 600,
                            padding: "1px 6px",
                            borderRadius: "9999px",
                          }}
                        >
                          {kw}
                        </span>
                      ))}
                      {jd.keywords.length > 8 && (
                        <span
                          style={{
                            fontSize: "0.625rem",
                            color: "#9ca3af",
                            alignSelf: "center",
                          }}
                        >
                          +{jd.keywords.length - 8} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "#9ca3af",
                    marginTop: "0.125rem",
                  }}
                >
                  No job description captured yet
                </p>
              )}
            </div>

            {/* Capture button */}
            <div
              style={{
                borderTop: "1px solid #e5e7eb",
                padding: "0.5rem 0.75rem",
                background: "#fff",
              }}
            >
              {pageContext === "posting" ? (
                <button
                  onClick={() => void handleCapture()}
                  disabled={captureStatus === "capturing"}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    background:
                      captureStatus === "success"
                        ? "#086528"
                        : captureStatus === "error"
                          ? "#dc2626"
                          : "#398453",
                    color: "white",
                    border: "none",
                    borderRadius: "0.5rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor:
                      captureStatus === "capturing" ? "default" : "pointer",
                    opacity: captureStatus === "capturing" ? 0.7 : 1,
                    transition: "background 0.15s",
                  }}
                >
                  {captureStatus === "capturing"
                    ? "⏳ Capturing…"
                    : captureStatus === "success"
                      ? "✓ Captured! Capture another?"
                      : captureStatus === "error"
                        ? "✗ Failed - Try again"
                        : jd
                          ? "⚡ Capture new JD from this tab"
                          : "⚡ Capture JD from this tab"}
                </button>
              ) : pageContext === "feed" ? (
                <p
                  style={{
                    fontSize: "0.6875rem",
                    color: "#6b7280",
                    textAlign: "center",
                    padding: "0.125rem 0",
                    lineHeight: 1.5,
                  }}
                >
                  Open a specific job posting first -
                  <br />
                  the URL should contain{" "}
                  <code
                    style={{
                      fontSize: "0.625rem",
                      background: "#f3f4f6",
                      padding: "1px 4px",
                      borderRadius: 3,
                      fontFamily: "monospace",
                    }}
                  >
                    currentJobId
                  </code>
                </p>
              ) : (
                <p
                  style={{
                    fontSize: "0.6875rem",
                    color: "#9ca3af",
                    textAlign: "center",
                    padding: "0.125rem 0",
                  }}
                >
                  Navigate to a LinkedIn or Indeed job posting to capture
                </p>
              )}
              {captureStatus === "error" && captureError && (
                <p
                  style={{
                    fontSize: "0.6875rem",
                    color: "#dc2626",
                    marginTop: "0.375rem",
                    textAlign: "center",
                  }}
                >
                  {captureError}
                </p>
              )}
            </div>
          </div>

          {/* ── Bottom actions ── */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() =>
                void chrome.tabs.create({ url: "https://www.overleaf.com" })
              }
              style={{
                flex: 1,
                padding: "0.5rem",
                background: "#398453",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem" }}>
                <img src={OVERLEAF_LOGO_URL} width={14} height={14} style={{ borderRadius: 2 }} alt="" />
                Open Overleaf
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  dot,
  label,
  action,
}: {
  dot: "green" | "amber";
  label: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "0.5rem",
        padding: "0.5rem 0.625rem",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: dot === "green" ? "#10b981" : "#f59e0b",
          flexShrink: 0,
          display: "inline-block",
        }}
      />
      <p
        style={{
          flex: 1,
          fontSize: "0.75rem",
          color: "#374151",
          fontWeight: 500,
        }}
      >
        {label}
      </p>
      {action}
    </div>
  );
}

function SmallBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} style={linkStyle}>
      {children}
    </button>
  );
}

const linkStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "#398453",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  flexShrink: 0,
  fontWeight: 600,
};
