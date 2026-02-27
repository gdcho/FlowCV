import { useState, useEffect } from "react";

const STORAGE_KEY = "FlowCV-settings";

interface Settings {
  apiKey: string;
  model: string;
  maxTokens: number;
}

const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  model: "claude-sonnet-4-6",
  maxTokens: 4096,
};

const MODELS = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (Recommended)" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6 (Highest quality)" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (Fastest)" },
];

export default function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "ok" | "fail"
  >("idle");
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const stored = result[STORAGE_KEY] as Partial<Settings> | undefined;
      if (stored) {
        setSettings((prev) => ({ ...prev, ...stored }));
      }
    });
  }, []);

  function handleSave() {
    chrome.storage.local.set({ [STORAGE_KEY]: settings }, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  async function handleTestKey() {
    const trimmedKey = settings.apiKey.trim();
    if (!trimmedKey) return;
    // Auto-trim whitespace from the stored key
    if (trimmedKey !== settings.apiKey) {
      setSettings((s) => ({ ...s, apiKey: trimmedKey }));
    }
    setTestStatus("testing");
    setTestError(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": trimmedKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: settings.model,
          max_tokens: 16,
          messages: [{ role: "user", content: 'Say "ok".' }],
        }),
      });
      if (res.ok) {
        setTestStatus("ok");
      } else {
        const body = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setTestError(body?.error?.message ?? `HTTP ${res.status}`);
        setTestStatus("fail");
      }
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Network error");
      setTestStatus("fail");
    }
  }

  return (
    <div
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "2rem",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div style={{ marginBottom: "2rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "0.5rem",
          }}
        >
          <div
            style={{
              width: 4,
              height: "1.75rem",
              background: "#398453",
              borderRadius: 2,
            }}
          />
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#1f2937",
              margin: 0,
            }}
          >
            FlowCV Settings
          </h1>
        </div>
        <p
          style={{
            color: "#6b7280",
            marginTop: "0.25rem",
            fontSize: "0.875rem",
          }}
        >
          Configure your Anthropic API key and preferences.
        </p>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #9cc1a9",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <h2 style={{ fontWeight: 600, marginBottom: "1rem", color: "#111827" }}>
          Anthropic API Key
        </h2>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <input
            type={showKey ? "text" : "password"}
            value={settings.apiKey}
            onChange={(e) =>
              setSettings((s) => ({ ...s, apiKey: e.target.value }))
            }
            placeholder="sk-ant-api03-..."
            style={{
              flex: 1,
              padding: "0.5rem 0.75rem",
              border: "1px solid #9cc1a9",
              borderRadius: "0.5rem",
              fontFamily: "monospace",
              fontSize: "0.875rem",
              outline: "none",
            }}
          />
          <button
            onClick={() => setShowKey((v) => !v)}
            style={{
              padding: "0.5rem 0.75rem",
              background: "#cee0d4",
              border: "1px solid #9cc1a9",
              borderRadius: "0.5rem",
              cursor: "pointer",
              fontSize: "0.75rem",
              color: "#086528",
            }}
          >
            {showKey ? "Hide" : "Show"}
          </button>
          <button
            onClick={() => void handleTestKey()}
            disabled={!settings.apiKey || testStatus === "testing"}
            style={{
              padding: "0.5rem 0.75rem",
              background:
                testStatus === "ok"
                  ? "#cee0d4"
                  : testStatus === "fail"
                    ? "#fee2e2"
                    : "#cee0d4",
              border:
                "1px solid " +
                (testStatus === "ok"
                  ? "#9cc1a9"
                  : testStatus === "fail"
                    ? "#fca5a5"
                    : "#9cc1a9"),
              borderRadius: "0.5rem",
              cursor: "pointer",
              fontSize: "0.75rem",
              color:
                testStatus === "ok"
                  ? "#086528"
                  : testStatus === "fail"
                    ? "#991b1b"
                    : "#398453",
            }}
          >
            {testStatus === "testing"
              ? "Testing…"
              : testStatus === "ok"
                ? "Valid!"
                : testStatus === "fail"
                  ? "Invalid"
                  : "Test Key"}
          </button>
        </div>
        {testStatus === "fail" && testError && (
          <p
            style={{
              fontSize: "0.75rem",
              color: "#dc2626",
              marginBottom: "0.5rem",
              fontFamily: "monospace",
              wordBreak: "break-all",
            }}
          >
            {testError}
          </p>
        )}
        <p style={{ fontSize: "0.75rem", color: "#6b7280" }}>
          Get your API key from{" "}
          <a
            href="https://console.anthropic.com"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#398453" }}
          >
            console.anthropic.com
          </a>
          . Stored locally — never sent anywhere except Anthropic's API.
        </p>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #9cc1a9",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <h2 style={{ fontWeight: 600, marginBottom: "1rem", color: "#111827" }}>
          Model
        </h2>
        <select
          value={settings.model}
          onChange={(e) =>
            setSettings((s) => ({ ...s, model: e.target.value }))
          }
          style={{
            width: "100%",
            padding: "0.5rem 0.75rem",
            border: "1px solid #9cc1a9",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            background: "#fff",
          }}
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <button
          onClick={handleSave}
          style={{
            padding: "0.625rem 1.5rem",
            background: "#398453",
            color: "#fff",
            border: "none",
            borderRadius: "0.5rem",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          Save Settings
        </button>
        {saved && (
          <span
            style={{ color: "#086528", fontSize: "0.875rem", fontWeight: 500 }}
          >
            Saved!
          </span>
        )}
      </div>
    </div>
  );
}
