import type { ATSScoreResult } from "@/types/ats";

interface Props {
  result: ATSScoreResult;
}

const CATEGORIES: Array<{
  key: keyof ATSScoreResult["breakdown"];
  label: string;
}> = [
  { key: "keywords", label: "Keywords" },
  { key: "formatting", label: "Formatting" },
  { key: "experience", label: "Experience" },
  { key: "education", label: "Education" },
  { key: "location", label: "Location" },
];

function scoreColor(ratio: number) {
  return ratio >= 0.7 ? "#16a34a" : ratio >= 0.5 ? "#d97706" : "#dc2626";
}

export function ATSScorePanel({ result }: Props) {
  const { overall, breakdown, missingKeywords, matchedKeywords, improvements } =
    result;

  const overallColor = scoreColor(overall / 100);
  const overallBg =
    overall >= 70 ? "#dcfce7" : overall >= 50 ? "#fef3c7" : "#fee2e2";
  const overallBorder =
    overall >= 70 ? "#86efac" : overall >= 50 ? "#fcd34d" : "#fca5a5";

  const label =
    overall >= 70 ? "Good match" : overall >= 50 ? "Moderate match" : "Low match";

  return (
    <div>
      {/* Overall score card */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          padding: "12px 14px",
          background: overallBg,
          border: `1px solid ${overallBorder}`,
          borderRadius: "10px",
          marginBottom: "10px",
        }}
      >
        <div
          style={{
            fontSize: "40px",
            fontWeight: 800,
            color: overallColor,
            lineHeight: 1,
            minWidth: "52px",
          }}
        >
          {overall}
          <span style={{ fontSize: "16px", fontWeight: 600, color: overallColor + "99" }}>
            /100
          </span>
        </div>
        <div>
          <p style={{ fontSize: "13px", fontWeight: 700, color: overallColor, margin: 0 }}>
            {label}
          </p>
          <p style={{ fontSize: "10px", color: "#6b7280", margin: "2px 0 0" }}>
            Based on ATS scoring criteria
          </p>
        </div>
      </div>

      {/* Score breakdown */}
      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          overflow: "hidden",
          marginBottom: "10px",
        }}
      >
        <p
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "#6b7280",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            padding: "7px 10px",
            margin: 0,
            borderBottom: "1px solid #f3f4f6",
          }}
        >
          Score Breakdown
        </p>
        {CATEGORIES.map(({ key, label: catLabel }) => {
          const cat = breakdown[key];
          const ratio = cat.score / cat.max;
          const barColor = scoreColor(ratio);
          return (
            <div
              key={key}
              style={{ padding: "7px 10px", borderBottom: "1px solid #f9fafb" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "3px",
                }}
              >
                <span
                  style={{ fontSize: "11px", fontWeight: 600, color: "#374151" }}
                >
                  {catLabel}
                </span>
                <span style={{ fontSize: "11px", color: "#6b7280" }}>
                  {cat.score}/{cat.max}
                </span>
              </div>
              <div
                style={{
                  background: "#f3f4f6",
                  borderRadius: "4px",
                  height: "4px",
                  marginBottom: "3px",
                }}
              >
                <div
                  style={{
                    background: barColor,
                    width: `${ratio * 100}%`,
                    height: "100%",
                    borderRadius: "4px",
                  }}
                />
              </div>
              <p style={{ fontSize: "10px", color: "#9ca3af", margin: 0, lineHeight: 1.3 }}>
                {cat.note}
              </p>
            </div>
          );
        })}
      </div>

      {/* Keywords */}
      {(matchedKeywords.length > 0 || missingKeywords.length > 0) && (
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "8px 10px",
            marginBottom: "10px",
          }}
        >
          <p
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0 0 6px",
            }}
          >
            Keywords
          </p>
          {matchedKeywords.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "4px",
                marginBottom: missingKeywords.length > 0 ? "6px" : 0,
              }}
            >
              {matchedKeywords.map((kw) => (
                <span
                  key={kw}
                  style={{
                    background: "#dcfce7",
                    color: "#16a34a",
                    fontSize: "10px",
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: "9999px",
                  }}
                >
                  + {kw}
                </span>
              ))}
            </div>
          )}
          {missingKeywords.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {missingKeywords.map((kw) => (
                <span
                  key={kw}
                  style={{
                    background: "#fee2e2",
                    color: "#dc2626",
                    fontSize: "10px",
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: "9999px",
                  }}
                >
                  - {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Improvements */}
      {improvements.length > 0 && (
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "8px 10px",
          }}
        >
          <p
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0 0 6px",
            }}
          >
            How to Improve
          </p>
          <ol style={{ margin: 0, padding: "0 0 0 14px" }}>
            {improvements.map((tip, i) => (
              <li
                key={i}
                style={{
                  fontSize: "11px",
                  color: "#374151",
                  marginBottom: "5px",
                  lineHeight: 1.4,
                }}
              >
                {tip}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
